# Nonogram 5x5

A 5x5 nonogram (picross) for iPhone, built with Expo. No network calls, no
accounts, no ads — puzzles are generated on the device.

**Live:** https://sussiboicode.github.io/5x5-nono-iphone/

See [CONTEXT.md](CONTEXT.md) for the decisions behind the setup.

## Installing it on the iPhone

1. Open <https://sussiboicode.github.io/5x5-nono-iphone/> in **Safari** (Chrome on iOS cannot install
   home-screen apps).
2. Tap **Share → Add to Home Screen**.
3. Open it once from the home screen while still online, so the service worker
   finishes caching.
4. Turn on airplane mode and open it again to confirm it works offline.

It then runs with no PC, no Wi-Fi and no expiry date, with its own icon and no
browser chrome.

> Expo Go was tried first and dropped: it re-downloads the bundle from a dev
> server every launch, so the PC has to be running. It is still handy for
> development (see below), just not for playing.

## Shipping an update

```
npm.cmd run build:pwa     # optional: build locally to check it first
npm.cmd run serve:pwa     # then open http://localhost:4173
```

To deploy, push to `main`. The GitHub Actions workflow
(`.github/workflows/pages.yml`) runs `npm run build:pwa` and publishes `dist/`
to GitHub Pages, so `dist/` stays gitignored and a deploy is reproducible from
source.

Keep the same repo name and Pages URL. A new URL orphans the installed
home-screen app and resets the saved stats, since those are stored per-origin.

After deploying, **open the app twice**: the first launch serves the cached old
version while the new service worker installs, the second gets the new build.

### What the build does

`npm.cmd run build:pwa` writes a self-contained static site to `dist/`:

- runs Expo's web export
- generates the icons (`scripts/make-icons.mjs` writes the PNGs directly with
  Node's zlib, so no image library is needed)
- writes `manifest.webmanifest` so iOS installs it as a real app
- writes `sw.js`, a service worker that precaches **every** exported file, so
  after the first load the game never touches the network
- rewrites Expo's absolute asset paths to relative ones, so it also works when
  hosted from a subfolder
- adds `touch-action: manipulation` (stops Safari treating two quick taps on
  neighbouring cells as double-tap zoom), themes `<body>` for both colour
  schemes, and applies `env(safe-area-inset-*)` padding so the layout clears the
  notch and home indicator in fullscreen

Service workers require **HTTPS**. A plain `http://192.168.x.x` address loads
the page but silently refuses to install it, so it will not work offline;
`localhost` is the only exception, which is why `serve:pwa` works for testing.

## How to play

- The switch at the bottom chooses between **Fill** and **Mark**. Tap anywhere
  on it and the knob moves to the other side, so mode is readable at a glance
  from the knob's position and colour without looking straight at it.
- Clear and New puzzle sit *above* the switch deliberately: overshooting the
  switch lands on the stats row rather than on a button that wipes the board.
- Tapping a cell steps it through a loop. In **Fill** the loop is
  empty → filled → × → empty; in **Mark** it runs the other way,
  empty → × → filled → empty. So the switch only decides what the first tap on
  a blank cell does, and any state is at most two taps away.
- Drag to paint a run of cells in one stroke: every cell gets the state the
  first cell stepped to.
- An × marks a cell you've deduced is empty. Marks are an aid only — they don't
  affect whether the puzzle counts as solved.
- A clue turns grey when the filled cells in that row or column match it.
- The stopwatch counts up, pauses when you background the app, and stops when
  you solve the puzzle. There is no time limit.

## Project layout

| Path | What it does |
| --- | --- |
| `App.tsx` | Screen layout, stopwatch, win detection |
| `src/game/nonogram.ts` | Puzzle generation, clue derivation, exhaustive solution counting |
| `src/storage.ts` | Local persistence (stats + the in-progress board) via AsyncStorage |
| `src/components/Board.tsx` | Grid, clue gutters and the drag-to-paint gesture |
| `src/components/Toolbar.tsx` | Mode switch and buttons |
| `src/components/StatsBar.tsx` | Solved / best / average row |
| `src/theme.ts` | Light and dark palettes |
| `scripts/build-pwa.mjs` | Builds the installable offline home-screen app |
| `scripts/make-icons.mjs` | Generates icon PNGs with no image dependency |

### Puzzle generation

Every puzzle is checked to be **solvable without guessing** before it is
dealt. `isSolvableByLogic` solves it the way a person does: for each row and
column it lists every placement of the clue that fits the cells already
settled, settles any cell they all agree on, and repeats until the board is
full. Having exactly one solution is not enough on its own: some unique boards
(often ones full of 1s) stall partway and need a guess. A board this solver
finishes always has exactly one solution. Generating one takes about 0.01 ms.

## Development

```
npm.cmd start        # dev server; press w for browser, or scan the QR in Expo Go
npx tsc --noEmit     # typecheck
```

In **PowerShell** use `npm.cmd`, not `npm` — bare `npm` resolves to `npm.ps1`,
which the execution policy blocks with "running scripts is disabled on this
system". Git Bash and cmd.exe are fine with plain `npm`.

If a QR scan hangs at "Downloading", Windows Firewall is usually blocking port
8081; allow Node through it, or use `npm.cmd start -- --tunnel`.

The `react-dom` / `react-native-web` dependencies are what make the web build
possible — both for development in a browser and for the shipped home-screen
app.
