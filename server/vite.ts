/**
 * Vite wiring. In development Vite runs as Express middleware so there is a
 * single origin and a single port; in production we serve the built bundle.
 */
import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import { env } from "./env.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
/** Vite serves client/; the built bundle lands in dist/. */
const clientRoot = path.join(projectRoot, "client");

export async function attachVite(app: Express) {
  const { createServer } = await import("vite");

  const vite = await createServer({
    // Vite looks for its config inside `root` by default; ours lives at the
    // project root, so point at it explicitly or the @ alias will not resolve.
    configFile: path.join(projectRoot, "vite.config.ts"),
    root: clientRoot,
    appType: "spa",
    server: {
      middlewareMode: true,
      // Vite rejects unknown Host headers, which is exactly what a tunnel
      // sends. Opened up only when we are deliberately tunnelling.
      allowedHosts: env.TUNNEL_MODE ? true : undefined,
      hmr: env.TUNNEL_MODE ? { clientPort: 443, protocol: "wss" } : true,
    },
  });

  app.use(vite.middlewares);
  return vite;
}

export function serveStatic(app: Express) {
  const dist = path.join(projectRoot, "dist");
  if (!fs.existsSync(dist)) {
    throw new Error(`No build found at ${dist}. Run \`npm run build\` first.`);
  }

  app.use(express.static(dist, { index: false }));

  // SPA fallback. NOTE: Express 5 throws on app.get("*") -- path-to-regexp v8
  // no longer accepts a bare wildcard -- so this is a terminal middleware.
  app.use((_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}
