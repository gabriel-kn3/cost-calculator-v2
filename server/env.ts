/**
 * Validated environment. Fails loudly at boot rather than producing a subtly
 * misconfigured server -- notably around tunnelling, where a wrong cookie
 * setting fails silently in the browser and is miserable to debug.
 */
import { z } from "zod";
import "dotenv/config";

const bool = (dflt: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? dflt : /^(1|true|yes|on)$/i.test(v)));

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  /** 0.0.0.0 so Tailscale/LAN can reach it; loopback-only auth still applies. */
  HOST: z.string().default("0.0.0.0"),

  DB_MODE: z.enum(["sqlite", "supabase"]).default("sqlite"),
  DATABASE_PATH: z.string().default("./data/app.db"),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_KEY: z.string().optional(),

  /**
   * Set when serving through a tunnel. Forces password auth on (loopback
   * auto-trust is disabled) and relaxes Vite's host check in dev.
   */
  TUNNEL_MODE: bool(false),
  /**
   * Skip the password for requests originating on this machine. Defensible for
   * a single-user local tool: anyone already on the box can read data/app.db
   * directly. Ignored entirely when TUNNEL_MODE is set.
   */
  LOCAL_TRUST_MODE: bool(true),

  /** argon2id hash produced by `npm run setup:password`. */
  APP_PASSWORD_HASH: z.string().optional(),
  SESSION_MINUTES: z.coerce.number().int().positive().default(480),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === "production";
