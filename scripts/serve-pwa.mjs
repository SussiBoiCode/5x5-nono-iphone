/**
 * Serves dist/ for local testing. Dependency-free.
 *
 *   node scripts/serve-pwa.mjs [port]
 *
 * Browsers allow service workers on localhost without HTTPS, so the offline
 * behaviour can be verified here exactly as it will behave once hosted.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const port = Number(process.argv[2] ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

if (!existsSync(DIST)) {
  console.error("dist/ not found - run `npm run build:pwa` first.");
  process.exit(1);
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  // normalize collapses any ../ before it can escape dist/.
  let file = join(DIST, normalize(url).replace(/^([/\\])+/, ""));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  // Unknown paths fall back to the app shell, the usual single-page behaviour.
  if (!existsSync(file)) file = join(DIST, "index.html");

  const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  const body = readFileSync(file);
  res.writeHead(200, {
    "Content-Type": type,
    // The service worker itself must never be served stale.
    "Cache-Control": file.endsWith("sw.js") ? "no-cache" : "no-store",
  });
  res.end(body);
}).listen(port, () => {
  console.log(`Serving dist/ at http://localhost:${port}`);
});
