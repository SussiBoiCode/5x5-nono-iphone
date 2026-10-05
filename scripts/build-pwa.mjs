/**
 * Builds the installable home-screen version of the game.
 *
 * Runs Expo's static web export, then adds the three things a plain export is
 * missing: icons, a web app manifest, and a service worker that precaches
 * every asset so the game opens with no network at all.
 *
 *   node scripts/build-pwa.mjs
 *
 * The output in dist/ is a folder of static files. Anything that serves it
 * over HTTPS will do; service workers are only allowed on HTTPS or localhost.
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { writeIcons } from "./make-icons.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

const THEME_DARK = "#0E0E11";
const THEME_LIGHT = "#F6F6F8";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

console.log("> expo export --platform web");
execSync("npx expo export --platform web --clear", { cwd: ROOT, stdio: "inherit" });

console.log("> icons");
writeIcons(DIST);

console.log("> manifest");
const manifest = {
  name: "Nonogram 5x5",
  short_name: "Nonogram",
  description: "Offline 5x5 nonogram puzzles.",
  // Relative so the app also works when served from a subfolder.
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "portrait",
  background_color: THEME_DARK,
  theme_color: THEME_DARK,
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
writeFileSync(join(DIST, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

console.log("> index.html");
const indexPath = join(DIST, "index.html");
let html = readFileSync(indexPath, "utf8");

const head = `
    <link rel="manifest" href="manifest.webmanifest" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />
    <link rel="icon" href="favicon-64.png" sizes="64x64" type="image/png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Nonogram" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${THEME_DARK}" media="(prefers-color-scheme: dark)" />
    <style>
      /* A puzzle is tapped fast and repeatedly. Without touch-action, Safari
         reads two quick taps on nearby cells as double-tap-to-zoom, and a slow
         tap as a text selection or a callout. */
      html, body, #root {
        touch-action: manipulation;
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }
      /* The page behind the app must be themed too. #root is inset by the safe
         areas below, so whatever is behind it shows as a strip at the top and
         bottom - and an unthemed body paints those strips white in dark mode. */
      html, body { background-color: ${THEME_LIGHT}; }
      @media (prefers-color-scheme: dark) {
        html, body { background-color: ${THEME_DARK}; }
      }
      /* Standalone mode draws under the notch and the home indicator, so the
         root has to inset itself; React Native Web has no SafeAreaView on web. */
      body { overscroll-behavior: none; }
      #root {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
        box-sizing: border-box;
      }
    </style>`;

if (!html.includes("manifest.webmanifest")) {
  html = html.replace("</head>", `${head}\n  </head>`);
}

// Expo emits root-absolute asset paths ("/_expo/..."), which 404 when the app
// is hosted in a subfolder such as a GitHub Pages project site. The app is a
// single page with no nested routes, so plain relative paths work everywhere.
html = html.replace(/(\s(?:src|href)=")\/(?!\/)/g, "$1");

// viewport-fit=cover is what makes env(safe-area-inset-*) report real values.
html = html.replace(
  /(<meta name="viewport" content=")([^"]*)(")/,
  (whole, start, content, end) =>
    content.includes("viewport-fit") ? whole : `${start}${content},viewport-fit=cover${end}`
);

const register = `
    <script>
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("sw.js").catch(function (error) {
            console.warn("Service worker registration failed:", error);
          });
        });
      }
    </script>`;
if (!html.includes("serviceWorker.register")) {
  html = html.replace("</body>", `${register}\n  </body>`);
}
writeFileSync(indexPath, html);

console.log("> service worker");
// Precache everything the export produced, so the first launch is the only
// one that needs a network.
const precache = walk(DIST)
  .map((file) => relative(DIST, file).split(sep).join(posix.sep))
  .filter((file) => file !== "sw.js")
  .concat(["./"]);

const sw = `/* Generated by scripts/build-pwa.mjs - do not edit by hand. */
const CACHE = "nonogram-5x5-${Date.now()}";
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // One failed asset should not fail the whole install.
        Promise.all(
          PRECACHE.map((path) =>
            cache.add(new Request(path, { cache: "reload" })).catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // A navigation offline must still resolve to the app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("index.html").then((hit) => hit || caches.match("./"))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
    })
  );
});
`;
writeFileSync(join(DIST, "sw.js"), sw);

console.log(`\nDone. ${precache.length - 1} files in dist/, all precached.`);
console.log("Serve dist/ over HTTPS, open it in Safari, then Share > Add to Home Screen.");
