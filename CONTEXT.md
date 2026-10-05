# Project context

Compact notes for picking this project back up. README.md covers how to run and
build it; this file covers **what was decided and why**, so those decisions
don't get re-litigated or accidentally undone.

## What this is

A 5x5 nonogram (picross) puzzle game for iPhone. Fully offline, no accounts, no
ads, no network calls of any kind. Puzzles are generated on the device.

**Live:** https://sussiboicode.github.io/5x5-nono-iphone/ (GitHub Pages, repo
`SussiBoiCode/5x5-nono-iphone`)

Moved off Netlify on 2026-10-05, after the Netlify account ran out of credits
and blocked deploys. The old https://nono55.netlify.app (site id
`5288d523-2340-4222-9e1d-6af02ed9de1d`) still serves the last Netlify build,
but it no longer gets updates. Moving reset the saved stats, because they are
stored per-origin.

## How it ships

Installed from Safari via **Share → Add to Home Screen**. It is a real
home-screen app: own icon, fullscreen, works in airplane mode, never expires,
costs nothing.

Expo Go was tried first and **dropped**: it re-downloads the JS bundle from a
dev server on every launch, so the PC has to be running. It is still the
convenient way to develop (`npm.cmd start` + hot reload), just not how the game
is delivered.

A native build via EAS was ruled out: EAS internal distribution
[requires a paid Apple Developer account](https://docs.expo.dev/build/internal-distribution/)
($99/yr). Free Apple IDs cannot create the provisioning profile, and the
"free Apple ID, expires after 7 days" route is Xcode free provisioning, which
needs a Mac. Not worth it for this game.

## Deploying

```
npm.cmd run build:pwa     # optional: verify the build locally first
npm.cmd run serve:pwa     # then http://localhost:4173
```

Pushing to `main` deploys. `.github/workflows/pages.yml` runs
`npm run build:pwa` on GitHub Actions and publishes `dist/` to Pages, so `dist/`
stays gitignored and deploys are reproducible from source. Pages' source is set
to "GitHub Actions", not a branch. That also avoids Jekyll, which would drop the
`_expo/` folder because its name starts with an underscore.

**Never change the URL** (don't rename the repo). A new URL orphans the
installed home-screen app and resets the saved stats (they are per-origin).

After deploying, **open the app twice**. The first launch serves the cached old
version while the new service worker installs; the second gets the new build.

## Decisions worth keeping

- **Every puzzle is verified solvable without guessing** before it is dealt
  (`isSolvableByLogic`): a line-by-line solver settles each cell that every
  fitting placement of a row/column clue agrees on, and repeats until the board
  is full. Only checking for one solution (`hasUniqueSolution`) used to deal
  about 1 in 90 boards that stall partway, usually ones full of 1s. Logic-solvable
  implies unique (checked on 146k random grids). Generating one takes ~0.01 ms.
- **Taps ignore Safari's emulated mouse events** (`Board.tsx`). After a tap,
  Safari fires a fake mousedown. React Native Web drops it unless the finger
  wobbled (any touchmove), and then that mousedown re-toggled the cell: a 1-2
  frame "ghost". A mousedown within 1 s of a touch is now ignored.
- **The grid is centred by flanking it with an equal spacer** opposite the clue
  gutter. This costs cell size (44px at 375pt wide) and that trade was made
  deliberately.
- **Clear / New puzzle sit above the mode switch.** Overshooting the switch then
  lands on the stats row instead of wiping the board.
- **The mode switch does not animate.** It jumps. The slide left a visible
  compositing trail on iOS.
- **The background View sits outside SafeAreaView**, so it paints the full
  window. Putting the background colour on SafeAreaView leaves the strips behind
  the status bar and home indicator white — very obvious in dark mode.
- **Stats are Solved / Best / Average.** No streak: with no mistake limit there
  is nothing for a streak to measure.

## Gotchas already hit (don't rediscover these)

- **PowerShell:** use `npm.cmd`, not `npm`. Bare `npm` resolves to `npm.ps1`,
  which is blocked by the execution policy. Git Bash and cmd.exe are fine.
- **Expo web export emits absolute asset paths** (`/_expo/...`). The build
  rewrites them relative so the app also works from a subfolder.
- **Netlify served `.webmanifest` as `application/octet-stream`**, so the old
  `netlify.toml` had to set the Content-Type. GitHub Pages already sends
  `application/manifest+json` (checked 2026-10-05), so no config is needed.
  Pages caches every file for 10 minutes and allows no custom headers. That's
  fine: browsers skip the HTTP cache when they check `sw.js` for updates.
- **Safari reads two quick taps on neighbouring cells as double-tap zoom.**
  The build injects `touch-action: manipulation`.
- **Service workers need HTTPS.** A `http://192.168.x.x` LAN address loads the
  page but silently refuses to install it, so it will not work offline.
  `localhost` is the only exception.
- The `dataviz`-style preview browser used during development **cannot register
  service workers**, so offline behaviour can only be confirmed on the phone.

## Open items

- `SafeAreaView` from `react-native` is deprecated and will be removed in a
  future release. The fix is `react-native-safe-area-context` (already bundled
  in Expo Go). Unrelated to the white-bar bug, which is already fixed.
- Per `AGENTS.md`, check https://docs.expo.dev/versions/v57.0.0/ before writing
  code. Most of this app is React Native core, which that index does not cover.
