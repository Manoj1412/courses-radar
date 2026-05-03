// Tiny production Node server that runs the TanStack Start SSR handler.
// Serves the built client assets (dist/client/) statically and proxies any
// remaining request to the built SSR handler (dist/server/server.js). This
// replaces `vite dev` for the preview environment so the homepage is
// interactive within ~1s instead of 10s (dev mode ships ~111 module files).

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Load .env so YOUTUBE_API_KEY / GEMINI_API_KEY / REACT_APP_BACKEND_URL
// are available to the SSR handler and server functions.
(function loadDotEnv() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
})();

const CLIENT_DIR = join(__dirname, "dist", "client");
const SERVER_ENTRY = join(__dirname, "dist", "server", "server.js");

if (!existsSync(CLIENT_DIR) || !existsSync(SERVER_ENTRY)) {
  console.error(
    "\n[server] dist/ not found. Run `yarn build` first.\n" +
      `  CLIENT_DIR: ${CLIENT_DIR}\n  SERVER_ENTRY: ${SERVER_ENTRY}\n`,
  );
  process.exit(1);
}

// Dynamic import of the built SSR handler (must be the built file, not src)
const ssr = await import(SERVER_ENTRY);
const ssrHandler = ssr.default ?? ssr.server ?? ssr;

const app = new Hono();

// 1) Serve built client assets statically
app.use(
  "/assets/*",
  serveStatic({
    root: "./dist/client",
    onNotFound: () => {},
  }),
);

// 2) Serve other static files (favicon, placeholder, etc.)
const staticExtensions = new Set([
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".gif",
  ".css",
  ".js",
  ".mjs",
  ".map",
  ".txt",
  ".xml",
  ".woff",
  ".woff2",
  ".ttf",
]);

app.use(async (c, next) => {
  const url = new URL(c.req.url);
  const ext = extname(url.pathname);
  if (ext && staticExtensions.has(ext)) {
    const filePath = join(CLIENT_DIR, url.pathname);
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      const mime = {
        ".ico": "image/x-icon",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".css": "text/css",
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".map": "application/json",
        ".txt": "text/plain",
        ".xml": "application/xml",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
      }[ext];
      c.header("Content-Type", mime || "application/octet-stream");
      c.header("Cache-Control", "public, max-age=31536000, immutable");
      return c.body(buf);
    }
  }
  return next();
});

// 3) All other requests -> SSR handler
app.all("*", async (c) => {
  try {
    const response = await ssrHandler.fetch(c.req.raw);
    return response;
  } catch (err) {
    console.error("[server] SSR error:", err);
    return c.text("Internal Server Error", 500);
  }
});

const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

serve({ fetch: app.fetch, hostname: host, port }, (info) => {
  console.log(`[server] listening on http://${info.address}:${info.port}`);
});
