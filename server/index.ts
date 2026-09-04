/**
 * The single process: API + UI on ONE origin, one port, in dev and prod.
 *
 * This is the fix for the defect that made v2 untunnellable. Its client built
 * its base URL as `${protocol}//${hostname}:8000`, so behind a tunnel it asked
 * for https://something.trycloudflare.com:8000 -- a port the tunnel does not
 * expose. Serving the API under /api from the same process removes that, and
 * with it CORS and every SameSite cookie problem.
 */
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env, isProd } from "./env.js";
import { openDb } from "./db.js";
import { createDataStore } from "./repo/index.js";
import { createAuth } from "./auth.js";
import { createApiRouter } from "./routes/index.js";

async function main() {
  const app = express();

  // Behind Tailscale/Cloudflare/ngrok the TLS terminates at the tunnel and we
  // receive plain HTTP. Without this, req.secure is always false and the
  // session cookie's `secure` flag is computed wrongly.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // The Vite dev client needs inline scripts and a websocket; a CSP tuned
      // for the built bundle would break it.
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: "25mb" })); // backup restore payloads
  app.use(cookieParser());

  const store = createDataStore();
  // Auth shares the same database file but owns its own handle, so session
  // writes never contend with a repository transaction.
  const { db: authDb } = openDb(env.DATABASE_PATH, { migrate: false });
  const auth = createAuth({ db: authDb });

  app.use("/api", createApiRouter(store, auth));

  if (isProd) {
    const { serveStatic } = await import("./vite.js");
    serveStatic(app);
  } else {
    const { attachVite } = await import("./vite.js");
    await attachVite(app);
  }

  const server = app.listen(env.PORT, env.HOST, () => {
    const where = env.HOST === "0.0.0.0" ? "localhost" : env.HOST;
    console.log(`cost-calculator listening on http://${where}:${env.PORT}`);
    console.log(`  mode      ${env.NODE_ENV}`);
    console.log(`  datastore ${store.mode} (${env.DATABASE_PATH})`);
    console.log(
      `  auth      ${
        env.TUNNEL_MODE
          ? "password required (TUNNEL_MODE)"
          : env.LOCAL_TRUST_MODE
            ? "trusted on localhost, password required from anywhere else"
            : "password required"
      }`,
    );
    if (!env.APP_PASSWORD_HASH) {
      console.log("  WARNING   no password configured -- run `npm run setup:password` before sharing");
    }
  });

  const shutdown = async () => {
    server.close();
    await store.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
