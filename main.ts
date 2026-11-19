// The World, Wednesday 18 November 2026 — one front page (v2).
// Entry for the make.fun bounty "Sum up 18 November's world news in one image"
// (news-image-20261118, account @do-tinh). A program that draws a newspaper
// front page — one lead story, nine secondary stories, a world map with pins,
// a day-in-numbers strip and ~25 one-line briefs — and writes it to
// /output/entry.png (1024x1024 PNG).
//
// Pure Node 22 standard library. No network, no clock, no randomness: two runs
// write byte-identical files. The picture is drawn from scratch by this file
// (software rasteriser + glyph outlines from font.json, DejaVu fonts embedded
// in this repo). This file was written by the entrant's agent in the build
// session; font.json is a data file extracted from the system DejaVu fonts.
//
// Text is restricted to the glyphs the embedded font carries: A-Z a-z 0-9 and
// space ' , - . : ; middle-dot and the euro sign. No other punctuation is
// used anywhere on the page.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// ---------- page ----------
const W = 1024;
const H = 1024;

// ---------- palette ----------
const PAPER = [246, 241, 230];
const PAPER_DARK = [238, 231, 216];
const INK = [26, 26, 26];
const INK_SOFT = [74, 70, 66];
const RED = [179, 38, 30];
const RED_DARK = [140, 28, 22];
const BLUE = [38, 84, 138];
const BLUE_LIGHT = [220, 227, 234];
const TEAL = [24, 122, 106];
const AMBER = [198, 132, 26];
const GREEN = [46, 125, 50];
const PURPLE = [110, 68, 160];
const SKY = [168, 205, 225];
const SAND = [214, 196, 160];
const GRAY = [120, 118, 112];
const WHITE = [255, 255, 255];
const NAVY = [24, 42, 68];

// ---------- pixel buffer ----------
const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = PAPER[0];
  buf[i * 3 + 1] = PAPER[1];
  buf[i * 3 + 2] = PAPER[2];
}

function setPx(x: number, y: number, c: number[]): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      i += 3;
    }
  }
}

// Even-odd scanline fill over a list of closed contours (holes stay empty).
function fillContours(contours: number[][][], c: number[]): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const contour of contours) {
    for (const p of contour) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
  }
  if (!isFinite(minY)) return;
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (const contour of contours) {
      const n = contour.length;
      for (let i = 0; i < n; i++) {
        const a = contour[i];
        const b = contour[(i + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]));
      const xb = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) {
        const i = (y * W + x) * 3;
        buf[i] = c[0];
        buf[i + 1] = c[1];
        buf[i + 2] = c[2];
      }
    }
  }
}

function fillPolygon(pts: number[][], c: number[]): void {
  fillContours([pts], c);
}

function fillCircle(cx: number, cy: number, r: number, c: number[]): void {
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
    const xa = Math.max(0, Math.ceil(cx - dx));
    const xb = Math.min(W - 1, Math.floor(cx + dx));
    for (let x = xa; x <= xb; x++) {
      const i = (y * W + x) * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
}

// Ring outline: outer circle minus inner circle.
function ring(cx: number, cy: number, rOuter: number, rInner: number, c: number[]): void {
  fillCircle(cx, cy, rOuter, c);
  fillCircle(cx, cy, rInner, PAPER);
}

function drawThickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: number[]): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  fillPolygon(
    [
      [x0 + nx, y0 + ny],
      [x1 + nx, y1 + ny],
      [x1 - nx, y1 - ny],
      [x0 - nx, y0 - ny],
    ],
    c
  );
  fillCircle(x0, y0, w / 2, c);
  fillCircle(x1, y1, w / 2, c);
}

// ---------- PNG encoder (stdlib only, deterministic) ----------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- font + text ----------
// font.json: { upm: 2048, fonts: { serif, sansBold, sans } }.
// Each face: { glyphs: { char: [advance, [contour, ...]] } }, contour = [[x, y], ...]
// in font units, y up, baseline y = 0. Glyphs carried: A-Z a-z 0-9 space ' , -
// . : ; middle-dot and the euro sign. Any other character is rendered as a
// space so a stray character can never crash the run.
type Glyph = [number, number[][][]];

const FONT: { upm: number; fonts: Record<string, { glyphs: Record<string, Glyph> }> } =
  JSON.parse(readFileSync(join(DIR, "font.json"), "utf8"));
const UPM: number = FONT.upm;
const FACES = FONT.fonts;

function glyphFor(face: string, ch: string): Glyph | null {
  const f = FACES[face];
  if (!f) return null;
  return f.glyphs[ch] ?? null;
}

function textWidth(text: string, size: number, face: string): number {
  const s = size / UPM;
  let w = 0;
  for (const ch of text) {
    const g = glyphFor(face, ch);
    w += (g ? g[0] : 700) * s;
  }
  return w;
}

// Draw text with (x, baselineY) as the start of the baseline.
function drawText(text: string, x: number, baselineY: number, size: number, color: number[], face: string): number {
  const s = size / UPM;
  let cx = x;
  for (const ch of text) {
    const g = glyphFor(face, ch);
    if (!g) {
      cx += 700 * s;
      continue;
    }
    const adv = g[0];
    const contours = g[1];
    const scaled: number[][][] = contours.map((contour) =>
      contour.map(([px, py]) => [cx + px * s, baselineY - py * s])
    );
    fillContours(scaled, color);
    cx += adv * s;
  }
  return cx;
}

// Center text on (cx, baselineY).
function drawTextCentered(text: string, cx: number, baselineY: number, size: number, color: number[], face: string): void {
  const w = textWidth(text, size, face);
  drawText(text, cx - w / 2, baselineY, size, color, face);
}

function wrapText(text: string, size: number, face: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (textWidth(test, size, face) <= maxW || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw a wrapped block; returns the number of lines drawn.
function drawBlock(
  text: string,
  x: number,
  topY: number,
  size: number,
  color: number[],
  face: string,
  maxW: number,
  lineH: number
): number {
  const lines = wrapText(text, size, face, maxW);
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, topY + size + i * lineH, size, color, face);
  }
  return lines.length;
}

// Shrink the font until the text fits maxW (never below minSize). Returns size used.
function fitText(text: string, size: number, minSize: number, face: string, maxW: number): number {
  let s = size;
  while (s > minSize && textWidth(text, s, face) > maxW) s -= 1;
  return s;
}

// ---------- flat illustrations ----------
// Each icon draws inside the box (x, y, w, h). All shapes are flat vector
// forms built from the rasteriser above. No image assets are used.

function iconRadar(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  const cx = x + w * 0.34;
  const cy = y + h * 0.52;
  const r = Math.min(w, h) * 0.34;
  fillCircle(cx, cy, r, [28, 90, 78]);
  ring(cx, cy, r * 0.66, r * 0.62, [120, 200, 180]);
  ring(cx, cy, r * 0.36, r * 0.32, [120, 200, 180]);
  fillPolygon(
    [
      [cx, cy],
      [cx + r * 0.9, cy - r * 0.45],
      [cx + r * 0.55, cy + r * 0.35],
    ],
    [120, 200, 180]
  );
  fillCircle(cx - r * 0.35, cy - r * 0.3, 3, AMBER);
  fillCircle(cx + r * 0.4, cy + r * 0.25, 3, RED);
  fillCircle(cx + r * 0.1, cy - r * 0.55, 3, WHITE);
  // drone silhouettes, right side
  const dx = x + w * 0.72;
  const dy = y + h * 0.3;
  drawThickLine(dx - 16, dy - 8, dx + 16, dy - 8, 3, INK);
  drawThickLine(dx - 16, dy + 8, dx + 16, dy + 8, 3, INK);
  fillRect(dx - 7, dy - 4, 14, 8, INK);
  fillCircle(dx - 16, dy - 8, 4, INK);
  fillCircle(dx + 16, dy - 8, 4, INK);
  fillCircle(dx - 16, dy + 8, 4, INK);
  fillCircle(dx + 16, dy + 8, 4, INK);
  const dx2 = x + w * 0.74;
  const dy2 = y + h * 0.68;
  drawThickLine(dx2 - 12, dy2 - 6, dx2 + 12, dy2 - 6, 3, RED);
  drawThickLine(dx2 - 12, dy2 + 6, dx2 + 12, dy2 + 6, 3, RED);
  fillRect(dx2 - 5, dy2 - 3, 10, 6, RED);
  drawText("GULF", x + 8, y + h - 8, 15, [150, 190, 175], "sansBold");
}

function iconGlobe(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, BLUE_LIGHT);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.4;
  fillCircle(cx, cy, r, BLUE);
  // meridian + parallel chords
  for (const f of [-0.55, 0, 0.55]) {
    const dx = f * r;
    const hh = Math.sqrt(Math.max(0, r * r - dx * dx));
    drawThickLine(cx + dx, cy - hh, cx + dx, cy + hh, 2, [150, 195, 225]);
  }
  for (const f of [-0.55, 0, 0.55]) {
    const dy = f * r;
    const ww = Math.sqrt(Math.max(0, r * r - dy * dy));
    drawThickLine(cx - ww, cy + dy, cx + ww, cy + dy, 2, [150, 195, 225]);
  }
  // land blobs
  fillCircle(cx - r * 0.35, cy - r * 0.25, r * 0.22, GREEN);
  fillCircle(cx + r * 0.3, cy + r * 0.3, r * 0.18, AMBER);
  fillCircle(cx + r * 0.45, cy - r * 0.35, r * 0.12, GREEN);
  // star
  const sx = x + w - 14;
  const sy = y + 12;
  fillPolygon(
    [
      [sx, sy - 7],
      [sx + 2, sy - 2],
      [sx + 7, sy - 2],
      [sx + 3, sy + 2],
      [sx + 5, sy + 7],
      [sx, sy + 4],
      [sx - 5, sy + 7],
      [sx - 3, sy + 2],
      [sx - 7, sy - 2],
      [sx - 2, sy - 2],
    ],
    RED
  );
}

function iconEuro(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, PAPER_DARK);
  const cx = x + w / 2;
  const cy = y + h * 0.56;
  fillCircle(cx - 12, cy + 12, 15, AMBER);
  fillCircle(cx + 12, cy + 12, 15, [214, 158, 40]);
  fillCircle(cx, cy + 2, 16, [232, 184, 64]);
  ring(cx, cy + 2, 16, 13, [176, 128, 30]);
  drawTextCentered("€", cx, cy + 14, 30, INK, "sansBold");
  drawTextCentered("EU", cx, y + 16, 14, INK_SOFT, "sansBold");
}

function iconVoyager(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  const pts: number[][] = [
    [x + 8, y + 10],
    [x + 20, y + 26],
    [x + w - 14, y + 14],
    [x + w - 30, y + 34],
    [x + 30, y + h - 18],
  ];
  for (const [sx, sy] of pts) fillCircle(sx, sy, 2, WHITE);
  const cx = x + w * 0.42;
  const cy = y + h * 0.55;
  // dish (gold cone)
  fillPolygon(
    [
      [cx - 26, cy - 18],
      [cx + 26, cy - 18],
      [cx, cy + 6],
    ],
    [232, 184, 64]
  );
  fillRect(cx - 4, cy + 4, 8, 16, [200, 160, 60]);
  // boom + antenna
  drawThickLine(cx + 4, cy + 8, cx + 30, cy + 22, 3, WHITE);
  fillCircle(cx + 30, cy + 22, 3, WHITE);
  drawThickLine(cx - 4, cy + 8, cx - 28, cy + 20, 3, WHITE);
  fillCircle(cx - 28, cy + 20, 3, RED);
  drawText("1 LIGHT-DAY", x + 8, y + h - 8, fitText("1 LIGHT-DAY", 13, 7, "sansBold", w - 16), [150, 190, 220], "sansBold");
}

function iconLeaf(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [214, 232, 214]);
  const cx = x + w / 2;
  const cy = y + h / 2;
  // leaf: two arcs approximated by a polygon
  const leaf: number[][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    leaf.push([cx - 26 + 52 * t, cy - 20 + 34 * Math.sin(t * Math.PI) * 0.4 - 8 * t]);
  }
  for (let i = 12; i >= 0; i--) {
    const t = i / 12;
    leaf.push([cx - 26 + 52 * t, cy + 6 + 30 * Math.sin(t * Math.PI) * 0.55]);
  }
  fillPolygon(leaf, GREEN);
  drawThickLine(cx - 22, cy + 2, cx + 22, cy - 6, 2, [30, 90, 40]);
  fillCircle(cx + 20, cy - 18, 9, BLUE);
  fillCircle(cx + 20, cy - 18, 9, BLUE);
  drawText("COP31", x + 8, y + h - 8, 14, INK_SOFT, "sansBold");
}

function iconCyclone(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [205, 225, 238]);
  const cx = x + w / 2;
  const cy = y + h * 0.46;
  // spiral of dots, tightening inward
  for (let t = 0; t < Math.PI * 4.4; t += 0.35) {
    const r = 26 - (t / (Math.PI * 4.4)) * 22;
    const px = cx + r * Math.cos(t);
    const py = cy + r * Math.sin(t) * 0.85;
    fillCircle(px, py, 3.2, TEAL);
  }
  fillCircle(cx, cy, 5, RED);
  // rain cloud
  fillCircle(x + w * 0.28, y + h - 18, 9, WHITE);
  fillCircle(x + w * 0.45, y + h - 22, 11, WHITE);
  fillCircle(x + w * 0.62, y + h - 18, 9, WHITE);
  fillRect(x + w * 0.28, y + h - 18, w * 0.34, 10, WHITE);
  drawThickLine(x + w * 0.34, y + h - 6, x + w * 0.3, y + h - 1, 2, BLUE);
  drawThickLine(x + w * 0.5, y + h - 6, x + w * 0.46, y + h - 1, 2, BLUE);
  drawThickLine(x + w * 0.64, y + h - 6, x + w * 0.6, y + h - 1, 2, BLUE);
}

function iconFactory(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [228, 226, 220]);
  const bx = x + 10;
  const by = y + h - 34;
  fillRect(bx, by, w - 20, 34, [96, 110, 128]);
  fillRect(bx, by - 14, 26, 14, [96, 110, 128]);
  fillRect(bx + w - 42, by - 22, 8, 22, [70, 82, 96]);
  fillRect(bx + w - 28, by - 18, 8, 18, [70, 82, 96]);
  fillCircle(bx + w - 38, by - 28, 5, GRAY);
  fillCircle(bx + w - 30, by - 34, 6, GRAY);
  fillCircle(bx + w - 20, by - 40, 5, GRAY);
  fillRect(bx + 6, by + 18, 10, 16, RED);
  fillRect(bx + 22, by + 8, 12, 8, SKY);
  fillRect(bx + 40, by + 8, 12, 8, SKY);
  fillRect(bx + 58, by + 8, 12, 8, SKY);
}

function iconController(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 222, 240]);
  const cx = x + w / 2;
  const cy = y + h * 0.52;
  fillRect(cx - 30, cy - 14, 60, 26, PURPLE);
  fillCircle(cx - 28, cy + 10, 12, PURPLE);
  fillCircle(cx + 28, cy + 10, 12, PURPLE);
  // d-pad
  fillRect(cx - 24, cy - 8, 5, 16, WHITE);
  fillRect(cx - 29, cy - 3, 15, 5, WHITE);
  // buttons
  fillCircle(cx + 16, cy - 8, 3.5, AMBER);
  fillCircle(cx + 24, cy - 2, 3.5, RED);
  fillCircle(cx + 16, cy + 4, 3.5, TEAL);
  fillCircle(cx + 8, cy - 2, 3.5, WHITE);
  drawText("VI", cx - 8, y + h - 8, 16, PURPLE, "sansBold");
}

function iconDocument(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, PAPER_DARK);
  const dx = x + w * 0.2;
  const dy = y + 8;
  const dw = w * 0.56;
  const dh = h - 16;
  fillRect(dx, dy, dw, dh, WHITE);
  fillRect(dx + 6, dy + 8, dw - 12, 4, RED);
  for (let i = 0; i < 4; i++) {
    fillRect(dx + 6, dy + 20 + i * 9, dw - 12 - (i === 3 ? 14 : 0), 3, INK_SOFT);
  }
  // red seal
  const sx = x + w * 0.72;
  const sy = y + h * 0.68;
  fillCircle(sx, sy, 13, RED);
  ring(sx, sy, 13, 9, RED);
  fillCircle(sx, sy, 9, RED_DARK);
  drawTextCentered("X", sx, sy + 5, 14, WHITE, "sansBold");
}

// ---------- world map ----------
// Simplified continent outlines in [lon, lat]. Drawn equirectangular into the
// box, latitude clipped to [-55, 78].
const CONTINENTS: number[][][] = [
  [[-168, 66], [-150, 70], [-130, 71], [-110, 68], [-95, 69], [-85, 66], [-80, 73], [-65, 62], [-55, 52], [-60, 46], [-70, 42], [-76, 35], [-81, 26], [-87, 21], [-95, 19], [-105, 20], [-112, 28], [-120, 34], [-125, 42], [-125, 49], [-135, 58], [-150, 60], [-162, 58]],
  [[-55, 60], [-45, 60], [-32, 64], [-22, 70], [-25, 76], [-40, 76], [-55, 74], [-58, 68]],
  [[-79, 8], [-72, 11], [-62, 9], [-52, 4], [-44, -3], [-35, -8], [-39, -17], [-48, -27], [-57, -38], [-66, -45], [-70, -53], [-74, -44], [-73, -30], [-72, -18], [-79, -6], [-81, 0]],
  [[-10, 36], [-9, 43], [-2, 44], [3, 43], [8, 44], [12, 44], [18, 41], [23, 36], [26, 39], [28, 41], [23, 40], [19, 42], [13, 45], [7, 48], [0, 49], [-4, 50], [-10, 54], [-6, 58], [5, 58], [8, 62], [13, 66], [18, 70], [25, 71], [30, 70], [32, 67], [35, 62], [40, 58], [38, 52], [35, 48], [30, 46], [27, 44], [22, 40], [18, 40], [14, 38], [10, 37]],
  [[-17, 15], [-10, 31], [0, 36], [10, 37], [20, 32], [30, 31], [34, 28], [38, 20], [43, 12], [48, 11], [51, 12], [46, 5], [41, -2], [38, -12], [34, -18], [32, -26], [28, -33], [20, -35], [16, -28], [12, -18], [9, -1], [9, 4], [-8, 5], [-13, 8], [-17, 12]],
  [[30, 36], [36, 42], [42, 46], [48, 50], [54, 54], [60, 58], [66, 66], [72, 71], [80, 73], [90, 75], [100, 76], [110, 76], [120, 73], [130, 71], [140, 70], [150, 65], [158, 60], [162, 55], [160, 50], [158, 52], [150, 58], [142, 54], [140, 45], [135, 42], [130, 36], [127, 34], [122, 30], [120, 24], [114, 20], [109, 14], [105, 9], [100, 7], [98, 11], [95, 16], [91, 22], [88, 22], [85, 19], [80, 13], [77, 8], [74, 14], [71, 20], [67, 24], [63, 25], [58, 26], [54, 27], [51, 29], [48, 31], [45, 34], [42, 38], [38, 41], [34, 40], [30, 38]],
  [[113, -22], [114, -31], [116, -35], [122, -34], [129, -32], [135, -35], [140, -38], [146, -39], [150, -37], [153, -32], [153, -27], [150, -23], [146, -19], [142, -14], [141, -11], [136, -12], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20], [113, -22]],
];

function drawMap(x: number, y: number, w: number, h: number, pins: { lon: number; lat: number; n: number }[]): void {
  fillRect(x, y, w, h, BLUE_LIGHT);
  const LAT_TOP = 78;
  const LAT_BOT = -55;
  const scale = Math.min(w / 360, h / (LAT_TOP - LAT_BOT));
  const mw = 360 * scale;
  const mh = (LAT_TOP - LAT_BOT) * scale;
  const ox = x + (w - mw) / 2;
  const oy = y + (h - mh) / 2;
  const proj = (lon: number, lat: number): [number, number] => [
    ox + ((lon + 180) / 360) * mw,
    oy + ((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * mh,
  ];
  for (const cont of CONTINENTS) {
    fillPolygon(cont.map(([lo, la]) => proj(lo, la)), SAND);
  }
  // graticule
  for (let lo = -120; lo <= 120; lo += 60) {
    const [px] = proj(lo, 0);
    drawThickLine(px, oy, px, oy + mh, 1, [190, 205, 218]);
  }
  for (const la of [60, 30, 0, -30]) {
    const [, py] = proj(0, la);
    drawThickLine(ox, py, ox + mw, py, 1, [190, 205, 218]);
  }
  // pins
  for (const p of pins) {
    const [px, py] = proj(p.lon, p.lat);
    fillCircle(px, py, 10, RED);
    fillCircle(px, py, 10, RED);
    drawTextCentered(String(p.n), px, py + 5, 13, WHITE, "sansBold");
  }
}

// ---------- content ----------
// All 36 stories are dated 18 November 2026 and verified against at least
// two reputable sources each (source links are recorded in the sheet row).
// The 9 main stories are the verified v1 stories; the 27 briefs add the
// two cut stories plus 25 newly verified items.

const LEAD = {
  region: "MIDDLE EAST",
  headline1: "GULF STATES INTERCEPT",
  headline2: "IRAN DRONES",
  deck: "Kuwait and Bahrain intercept drones over the Gulf as Tehran warns of wider war",
};

const SECONDARY: { region: string; icon: (x: number, y: number, w: number, h: number) => void; headline: string; deck: string }[] = [
  { region: "ASIA", icon: iconGlobe, headline: "Xi welcomes Trump at APEC Shenzhen", deck: "Leaders meet as trade talks resume" },
  { region: "EUROPE", icon: iconEuro, headline: "EU 45bn euro loan for Ukraine", deck: "Brussels approves wartime funding" },
  { region: "SPACE", icon: iconVoyager, headline: "Voyager 1 reaches 1 light-day", deck: "Farthest human object sails on" },
  { region: "CLIMATE", icon: iconLeaf, headline: "COP31 deadlocked on phaseout", deck: "Antalya talks stall over end date" },
  { region: "WEATHER", icon: iconCyclone, headline: "Cyclone Akvan approaches India", deck: "Tamil Nadu braces for landfall" },
  { region: "ASIA", icon: iconFactory, headline: "Bangladesh wage protests", deck: "Factories shut as workers strike" },
  { region: "CULTURE", icon: iconController, headline: "GTA VI midnight launch", deck: "Fans queue as game goes on sale" },
  { region: "OCEANIA", icon: iconDocument, headline: "Australia sanctions Daniella Weiss", deck: "Settler leaders hit with bans" },
];

const BRIEFS: { region: string; headline: string }[] = [
  { region: "EUROPE", headline: "Russia fires 141 drones at Ukraine overnight" },
  { region: "MIDDLE EAST", headline: "Israel tanks cross Gaza Yellow Line" },
  { region: "EUROPE", headline: "UK inflation hits one year high" },
  { region: "AMERICAS", headline: "Democrats nominate Jeffries for speaker" },
  { region: "TECH", headline: "Nvidia revenue doubles to 115.8bn" },
  { region: "AFRICA", headline: "Ebola vaccines head to trials in Congo" },
  { region: "EUROPE", headline: "Russian An-12 crash kills 19 in Siberia" },
  { region: "SPORT", headline: "India beat Pakistan 2-1 in SAFF final" },
  { region: "EUROPE", headline: "EU approves Indonesia trade deal" },
  { region: "AMERICAS", headline: "Peltola flips Alaska Senate seat" },
  { region: "TECH", headline: "Waymo pulls robotaxis off freeways" },
  { region: "AFRICA", headline: "Ruto defends record in State of Nation" },
  { region: "SPORT", headline: "Wattimena stuns Littler 10-8 at darts" },
  { region: "ASIA", headline: "William and Kate meet Modi in Delhi" },
  { region: "AFRICA", headline: "Ethiopia and Eritrea mass troops at border" },
  { region: "EUROPE", headline: "Italy adopts antisemitism law 147-93" },
  { region: "MARKETS", headline: "Dow drops 561, stocks fall fifth day" },
  { region: "TECH", headline: "Anthropic prices record IPO at 83 a share" },
  { region: "AFRICA", headline: "Senegal ruling party expels its president" },
  { region: "EUROPE", headline: "London Oyster breach hits 265,000" },
  { region: "AMERICAS", headline: "Rubio says no evidence of attack in outages" },
  { region: "EUROPE", headline: "Gas tanker hit and sunk off Bulgaria" },
  { region: "AFRICA", headline: "South Africa inflation hits 5.2" },
  { region: "TECH", headline: "Russian indicted for spying on Palantir" },
  { region: "EUROPE", headline: "Harry says he would rejoin Army" },
  { region: "AMERICAS", headline: "Haitians march for Bukele troops" },
  { region: "OCEANIA", headline: "M5.8 quake hits Papua New Guinea" },
];

// Numbers strip: first three are column 1, last three column 2.
const NUMBERS: { value: string; label: string }[] = [
  { value: "141", label: "DRONES FIRED" },
  { value: "115.8bn", label: "NVIDIA REVENUE" },
  { value: "56-44", label: "SENATE SPLIT" },
  { value: "45bn", label: "EU LOAN EURO" },
  { value: "1.5tn", label: "ANTHROPIC VALUE" },
  { value: "265,000", label: "OYSTER ACCOUNTS" },
];

// Map pins: 1 Gulf (lead), 2 Shenzhen, 3 Brussels, 4 Antalya, 5 Tamil Nadu,
// 6 Dhaka, 7 Miami, 8 Canberra, 9 Kyiv (Russia drones brief).
const PINS = [
  { lon: 48, lat: 29, n: 1 },
  { lon: 114, lat: 22.5, n: 2 },
  { lon: 4.4, lat: 50.8, n: 3 },
  { lon: 30.7, lat: 36.9, n: 4 },
  { lon: 80, lat: 13, n: 5 },
  { lon: 90.4, lat: 23.8, n: 6 },
  { lon: -80.2, lat: 25.8, n: 7 },
  { lon: 149.1, lat: -35.3, n: 8 },
  { lon: 30.5, lat: 50.4, n: 9 },
];

// ---------- layout ----------
const MX = 24;
const RX = 1000;

function drawMasthead(): void {
  fillRect(MX, 14, RX - MX, 3, INK);
  drawTextCentered("THE WORLD", 512, 64, 56, INK, "serif");
  drawTextCentered("WEDNESDAY 18 NOVEMBER 2026", 512, 86, 17, RED, "sansBold");
  fillRect(MX, 94, RX - MX, 2, INK);
}

function drawLead(): void {
  const y0 = 102;
  drawText(LEAD.region, MX, y0 + 16, 15, RED, "sansBold");
  const hs = Math.min(
    fitText(LEAD.headline1, 44, 32, "serif", 600),
    fitText(LEAD.headline2, 44, 32, "serif", 600)
  );
  drawText(LEAD.headline1, MX, y0 + 66, hs, INK, "serif");
  drawText(LEAD.headline2, MX, y0 + 114, hs, INK, "serif");
  drawBlock(LEAD.deck, MX, y0 + 128, 19, INK_SOFT, "sans", 600, 25);
  iconRadar(648, y0, 352, 228);
}

function drawSecondary(): void {
  const y0 = 346;
  const cellW = 238;
  const cellH = 86;
  for (let i = 0; i < SECONDARY.length; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = MX + col * (cellW + 8);
    const cy = y0 + row * (cellH + 8);
    const s = SECONDARY[i];
    s.icon(cx, cy, 64, 64);
    drawText(s.region, cx + 72, cy + 14, 11, RED, "sansBold");
    drawBlock(s.headline, cx + 72, cy + 17, 15, INK, "sansBold", 166, 19);
    drawText(s.deck, cx, cy + 78, 12, INK_SOFT, "sans");
  }
}

function drawMapNumbers(): void {
  const y0 = 542;
  drawMap(MX, y0, 560, 170, PINS);
  drawText("THE DAY IN NUMBERS", 600, y0 + 16, 14, RED, "sansBold");
  for (let i = 0; i < 3; i++) {
    const vy = y0 + 48 + i * 50;
    drawText(NUMBERS[i].value, 600, vy, 26, INK, "sansBold");
    drawText(NUMBERS[i].label, 600, vy + 16, 11, INK_SOFT, "sans");
    drawText(NUMBERS[i + 3].value, 800, vy, 26, INK, "sansBold");
    drawText(NUMBERS[i + 3].label, 800, vy + 16, 11, INK_SOFT, "sans");
  }
}

function drawBriefs(): void {
  const y0 = 728;
  drawText("ALSO TODAY", MX, y0 + 16, 14, RED, "sansBold");
  const colX = [MX, 528];
  const firstBaseline = y0 + 40;
  const lineH = 16;
  for (let i = 0; i < BRIEFS.length; i++) {
    const col = i < 14 ? 0 : 1;
    const row = i < 14 ? i : i - 14;
    const bx = colX[col];
    const by = firstBaseline + row * lineH;
    const b = BRIEFS[i];
    fillRect(bx, by - 5, 5, 5, RED);
    let x = drawText(b.region, bx + 12, by, 15, RED, "sansBold");
    x = drawText(" · ", x, by, 15, INK_SOFT, "sans");
    drawText(b.headline, x, by, 15, INK, "sans");
  }
}

function drawFooter(): void {
  fillRect(MX, 994, RX - MX, 1, GRAY);
  drawTextCentered(
    "SOURCES: REUTERS, AP, BBC, AL JAZEERA, NPR, THE HINDU, AFP · FACTS AS OF 23:59 UTC",
    512, 1012, 12, INK_SOFT, "sans"
  );
}

// ---------- main ----------
function main(): void {
  drawMasthead();
  drawLead();
  fillRect(MX, 338, RX - MX, 1, GRAY);
  drawSecondary();
  fillRect(MX, 534, RX - MX, 1, GRAY);
  drawMapNumbers();
  fillRect(MX, 720, RX - MX, 1, GRAY);
  drawBriefs();
  drawFooter();
  const png = encodePNG();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "entry.png"), png);
  console.log(`wrote ${join(OUT_DIR, "entry.png")} ${png.length} bytes`);
}
main();
