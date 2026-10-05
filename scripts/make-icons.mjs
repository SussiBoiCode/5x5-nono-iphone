/**
 * Generates the PWA / home-screen icons as PNGs.
 *
 * Written against Node's built-in zlib rather than an image library so the
 * project needs no extra dependency to produce icons. A PNG is just a header,
 * a zlib-compressed block of filtered scanlines, and a footer.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BG = [14, 14, 17, 255]; // matches the app's dark background
const EMPTY = [38, 38, 46, 255];
const FILLED = [242, 242, 245, 255];
const ACCENT = [76, 134, 255, 255];

// A deliberate diagonal band, so the icon reads as a solved nonogram.
const PATTERN = [
  [1, 1, 0, 0, 0],
  [1, 1, 1, 0, 0],
  [0, 1, 2, 1, 0],
  [0, 0, 1, 1, 1],
  [0, 0, 0, 1, 1],
];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // bytes 10-12 stay zero: deflate, adaptive filtering, no interlacing

  // Each scanline is prefixed with its filter type (0 = none).
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const from = y * width * 4;
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, from, from + width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Draws the icon at `size` and returns raw RGBA pixels. */
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, [r, g, b, a]) => {
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) put(x, y, BG);
  }

  // Generous padding keeps the grid inside a maskable icon's safe zone.
  const pad = size * 0.17;
  const span = size - pad * 2;
  const gap = span * 0.035;
  const cell = (span - gap * 4) / 5;
  const radius = cell * 0.18;

  const inRoundedRect = (x, y, left, top, w, h, r) => {
    if (x < left || y < top || x >= left + w || y >= top + h) return false;
    const dx = Math.min(x - left, left + w - 1 - x);
    const dy = Math.min(y - top, top + h - 1 - y);
    if (dx >= r || dy >= r) return true;
    const ox = r - dx;
    const oy = r - dy;
    return ox * ox + oy * oy <= r * r;
  };

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const value = PATTERN[row][col];
      const colour = value === 2 ? ACCENT : value === 1 ? FILLED : EMPTY;
      const left = pad + col * (cell + gap);
      const top = pad + row * (cell + gap);
      const x0 = Math.floor(left);
      const y0 = Math.floor(top);
      const x1 = Math.ceil(left + cell);
      const y1 = Math.ceil(top + cell);
      for (let y = y0; y < y1 && y < size; y++) {
        for (let x = x0; x < x1 && x < size; x++) {
          if (x < 0 || y < 0) continue;
          if (inRoundedRect(x, y, left, top, cell, cell, radius)) put(x, y, colour);
        }
      }
    }
  }

  return px;
}

export function writeIcons(outDir) {
  mkdirSync(outDir, { recursive: true });
  const sizes = {
    "icon-192.png": 192,
    "icon-512.png": 512,
    "apple-touch-icon.png": 180,
    "favicon-64.png": 64,
  };
  for (const [name, size] of Object.entries(sizes)) {
    writeFileSync(join(outDir, name), encodePng(size, size, drawIcon(size)));
  }
  return Object.keys(sizes);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? join(ROOT, "dist");
  console.log("wrote", writeIcons(out).join(", "), "to", out);
}
