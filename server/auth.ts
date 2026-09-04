/**
 * Authentication for a single-user, self-hosted tool that is sometimes exposed
 * through a tunnel.
 *
 * Design notes:
 *   - Opaque random session tokens in the database, not JWTs. With the DB
 *     three inches away, stateful sessions are simpler AND revocable --
 *     "sign out everywhere" after sharing a tunnel link is one DELETE, which
 *     a JWT cannot do without a blocklist (i.e. without a database).
 *   - The session cookie's `secure` flag is computed PER REQUEST from
 *     req.secure (with trust proxy set). Hardcoding it is the classic tunnel
 *     failure: `true` over local http makes the browser silently drop the
 *     cookie; `false` over https gets it flagged.
 *   - Loopback auto-trust: no password on this machine, always required once
 *     TUNNEL_MODE is set. Anyone already on the box can read data/app.db.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { eq, lt } from "drizzle-orm";
import { verify } from "@node-rs/argon2";
import { openDb, schema } from "./db.js";
import { env } from "./env.js";

const SESSION_COOKIE = "cc_session";
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

type SessionDb = ReturnType<typeof openDb>["db"];

export interface AuthDeps {
  db: SessionDb;
}

function isLoopbackRequest(req: Request): boolean {
  // A forwarding header means the request reached us through something else,
  // so it is not genuinely local no matter what the socket says.
  if (req.headers["x-forwarded-for"] || req.headers["x-forwarded-host"]) return false;
  const ip = req.socket.remoteAddress ?? "";
  return LOOPBACK.has(ip);
}

/** True when this request may skip the password. */
export function isTrustedLocal(req: Request): boolean {
  if (env.TUNNEL_MODE) return false;
  if (!env.LOCAL_TRUST_MODE) return false;
  return isLoopbackRequest(req);
}

/** No password configured and not tunnelling: first-run, nothing to protect yet. */
export function isUnconfigured(): boolean {
  return !env.APP_PASSWORD_HASH;
}

export function createAuth({ db }: AuthDeps) {
  function purgeExpired() {
    db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date().toISOString())).run();
  }

  function issueSession(req: Request, res: Response): string {
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const now = new Date();
    const expires = new Date(now.getTime() + env.SESSION_MINUTES * 60_000);

    db.insert(schema.sessions)
      .values({
        token,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        userAgent: req.get("user-agent") ?? null,
        ip: req.socket.remoteAddress ?? null,
      })
      .run();

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure, // per-request; see the note at the top of this file
      path: "/",
      expires,
    });
    return token;
  }

  function readSession(req: Request) {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
    if (!token) return null;
    const row = db.select().from(schema.sessions).where(eq(schema.sessions.token, token)).get();
    if (!row) return null;
    if (new Date(row.expiresAt) < new Date()) {
      db.delete(schema.sessions).where(eq(schema.sessions.token, token)).run();
      return null;
    }
    return row;
  }

  /** Sliding expiration, matching v2's behaviour on /auth/me. */
  function touchSession(req: Request, res: Response, token: string) {
    const expires = new Date(Date.now() + env.SESSION_MINUTES * 60_000);
    db.update(schema.sessions)
      .set({ expiresAt: expires.toISOString() })
      .where(eq(schema.sessions.token, token))
      .run();
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      path: "/",
      expires,
    });
  }

  function clearSession(req: Request, res: Response) {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
    if (token) db.delete(schema.sessions).where(eq(schema.sessions.token, token)).run();
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  function signOutEverywhere() {
    const n = db.select().from(schema.sessions).all().length;
    db.delete(schema.sessions).run();
    return n;
  }

  async function checkPassword(password: string): Promise<boolean> {
    if (!env.APP_PASSWORD_HASH) return false;
    try {
      return await verify(env.APP_PASSWORD_HASH, password);
    } catch {
      return false;
    }
  }

  /** Gate for everything under /api except health and the auth endpoints. */
  const requireAuth: RequestHandler = (req, res, next) => {
    purgeExpired();

    if (isTrustedLocal(req) || isUnconfigured()) return next();

    const session = readSession(req);
    if (!session) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    next();
  };

  return {
    SESSION_COOKIE,
    issueSession,
    readSession,
    touchSession,
    clearSession,
    signOutEverywhere,
    checkPassword,
    requireAuth,
  };
}

export type Auth = ReturnType<typeof createAuth>;

/** Shape returned by /api/auth/me, mirroring what v2's AuthProvider expects. */
export function describeUser(req: Request) {
  return {
    email: "local",
    mode: env.TUNNEL_MODE ? "tunnel" : "local",
    trustedLocal: isTrustedLocal(req),
    passwordConfigured: !isUnconfigured(),
  };
}

export type { NextFunction };
