// main.ts — "THE WORLD, Wednesday 18 November 2026" — one front page.
// Entry for make.fun bounty news-image-20261118 (account @do-tinh).
// Pure Node 22 standard library only. No network, no clock, no randomness:
// the same bytes come out of every run. Writes /output/entry.png
// (or $MAKEFUN_OUTPUT_DIR/entry.png), exactly 1024x1024 PNG.
//
// The picture is drawn from scratch: a software rasteriser, glyph outlines
// from font.json (DejaVu, embedded in this repo), flat vector illustrations.
// All nine stories were checked against at least two reputable sources
// dated 18 November 2026; see README.md for the source list.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const W = 1024;
const H = 1024;

// ---- palette: cream paper, ink, one red accent (per the brief) ----
const PAPER = [246, 241, 230, 255];
const PAPER2 = [238, 231, 211, 255]; // slightly darker cream for icon bands
const INK = [26, 26, 26, 255];
const RED = [179, 38, 30, 255];
const GREY = [110, 105, 96, 255];
const NAVY = [27, 42, 56, 255]; // lead illustration panel
const NAVY2 = [38, 58, 76, 255];
const CREAM = [246, 241, 230, 255];
const SEA = [168, 196, 209, 255];
const SAND = [228, 214, 184, 255];
const BLUE = [46, 90, 172, 255];
const GOLD = [212, 175, 55, 255];
const GREEN = [30, 142, 90, 255];
const TEAL = [42, 120, 120, 255];
const SKY = [96, 140, 165, 255];
const WHITE = [255, 255, 255, 255];

// ---- raster ----
const img = new Uint8Array(W * H * 4);
function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = c[3];
}
function fillRect(x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) px(xx, yy, c);
  }
}
// Even-odd scanline fill of a set of closed polygons (handles holes, e.g. "o", "a").
function fillPolys(polys, c) {
  let minY = H, maxY = 0;
  for (const p of polys) for (const pt of p) {
    if (pt[1] < minY) minY = pt[1];
    if (pt[1] > maxY) maxY = pt[1];
  }
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(H - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (const p of polys) {
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i]));
      const x1 = Math.min(W - 1, Math.floor(xs[i + 1]));
      for (let x = x0; x <= x1; x++) px(x, y, c);
    }
  }
}
function fillPoly(points, c) { fillPolys([points], c); }
function fillCircle(cx, cy, r, c) {
  const n = 28;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  fillPoly(pts, c);
}
function fillEllipse(cx, cy, rx, ry, c) {
  const n = 28;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  fillPoly(pts, c);
}
function fillRoundRect(x, y, w, h, r, c) {
  fillRect(x + r, y, w - 2 * r, h, c);
  fillRect(x, y + r, w, h - 2 * r, c);
  fillCircle(x + r, y + r, r, c);
  fillCircle(x + w - r, y + r, r, c);
  fillCircle(x + r, y + h - r, r, c);
  fillCircle(x + w - r, y + h - r, r, c);
}
// Thick line as a rotated rectangle.
function line(x0, y0, x1, y1, w, c) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
  fillPoly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], c);
}
function polyline(points, w, c) {
  for (let i = 0; i + 1 < points.length; i++) line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], w, c);
}
function arcPoints(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
// 8-point starburst (for intercepts).
function burst(cx, cy, rOut, rIn, c) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  fillPoly(pts, c);
}
// 4-point sparkle star.
function sparkle(cx, cy, r, c) {
  fillPoly([[cx, cy - r], [cx + r * 0.28, cy - r * 0.28], [cx + r, cy], [cx + r * 0.28, cy + r * 0.28], [cx, cy + r], [cx - r * 0.28, cy + r * 0.28], [cx - r, cy], [cx - r * 0.28, cy - r * 0.28]], c);
}

// ---- PNG encoder (filter 0 rows, zlib level 9) ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: None
    Buffer.from(img.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- text: glyph outlines from font.json ----
const HERE = dirname(fileURLToPath(import.meta.url));
const FONT = JSON.parse(readFileSync(join(HERE, "font.json"), "utf-8"));
const UPM = FONT.upm;

function glyph(fontName, ch) {
  const f = FONT.fonts[fontName];
  const g = f.glyphs[ch];
  if (!g) return null;
  return g; // [advance, contours]
}
function textWidth(text, fontName, size, tracking = 0) {
  const scale = size / UPM;
  let w = 0;
  for (const ch of text) {
    const g = glyph(fontName, ch);
    if (g) w += g[0] * scale + tracking;
  }
  return w - tracking;
}
// Greedy word wrap; returns lines that fit maxW. Keeps words whole.
function wrap(text, fontName, size, maxW, tracking = 0) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, fontName, size, tracking) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
// Draw one glyph with its top-left at (x, baselineY). Returns advance in px.
function drawGlyph(ch, fontName, size, x, baselineY, c) {
  const g = glyph(fontName, ch);
  if (!g) return size * 0.5;
  const scale = size / UPM;
  const polys = g[1].map((contour) =>
    contour.map(([gx, gy]) => [x + gx * scale, baselineY - gy * scale])
  );
  if (polys.length) fillPolys(polys, c);
  return g[0] * scale;
}
function drawText(text, fontName, size, x, baselineY, c, tracking = 0) {
  let cx = x;
  for (const ch of text) {
    cx += drawGlyph(ch, fontName, size, cx, baselineY, c) + tracking;
  }
  return cx;
}
// Draw (possibly multi-line) text; lines already wrapped. align: "left"|"center".
function drawLines(lines, fontName, size, x, firstBaselineY, lineHeight, c, tracking = 0, align = "left", maxW = 0) {
  let y = firstBaselineY;
  for (const ln of lines) {
    let lx = x;
    if (align === "center" && maxW) lx = x + (maxW - textWidth(ln, fontName, size, tracking)) / 2;
    drawText(ln, fontName, size, lx, y, c, tracking);
    y += lineHeight;
  }
  return y;
}
function drawCentered(text, fontName, size, cx, baselineY, c, tracking = 0) {
  const w = textWidth(text, fontName, size, tracking);
  drawText(text, fontName, size, cx - w / 2, baselineY, c, tracking);
}

// ---- content: 9 stories, each checked against >= 2 sources dated 18 Nov 2026 ----
const LEAD = {
  label: "MIDDLE EAST \u00b7 IRAN WAR",
  head: "Kuwait and Bahrain intercept Iranian drones",
  deck: "Iran says it aimed at the US base at Ali Al Salem. No damage reported.",
};
const CARDS = [
  { label: "ASIA \u00b7 APEC", head: "Xi greets Trump at APEC in Shenzhen",
    deck: "A first meeting of the three is set for Thursday.", icon: "flags" },
  { label: "EUROPE \u00b7 UKRAINE AID", head: "EU proposes \u20ac45bn loan for Ukraine",
    deck: "Kyiv would repay only once Russia pays reparations.", icon: "eu" },
  { label: "WORLD \u00b7 SPACE", head: "Voyager 1, one light-day from Earth",
    deck: "Signals from the 1977 probe now take a full day.", icon: "voyager" },
  { label: "WORLD \u00b7 CLIMATE", head: "COP31 splits over fossil-fuel exit",
    deck: "Antalya talks argue over the draft as Friday nears.", icon: "globe" },
  { label: "ASIA \u00b7 WEATHER", head: "Cyclone Akvan nears India's coast",
    deck: "Landfall due Friday; Andhra Pradesh is on red alert.", icon: "cyclone" },
  { label: "ASIA \u00b7 LABOUR", head: "Wage protests close Bangladesh factories",
    deck: "Workers seek Tk 30,000 a month; highways blocked.", icon: "factory" },
  { label: "WORLD \u00b7 GAMES", head: "GTA VI goes on sale at midnight",
    deck: "The launch rolls out by time zone, New Zealand first.", icon: "pad" },
  { label: "OCEANIA \u00b7 DIPLOMACY", head: "Australia sanctions Daniella Weiss",
    deck: "Canberra lists three people and four groups.", icon: "seal" },
];

// ---- small flat icons (drawn in a 229x46 band) ----
function drawIcon(kind, x, y0) {
  const cy = y0 + 23;
  if (kind === "flags") {
    // China flag
    fillRect(x + 8, y0 + 12, 34, 22, RED);
    fillCircle(x + 16, y0 + 19, 2, GOLD);
    fillCircle(x + 24, y0 + 16, 1.4, GOLD);
    fillCircle(x + 27, y0 + 21, 1.4, GOLD);
    fillCircle(x + 24, y0 + 26, 1.4, GOLD);
    fillCircle(x + 19, y0 + 27, 1.4, GOLD);
    // US flag
    fillRect(x + 46, y0 + 12, 34, 22, WHITE);
    for (let i = 0; i < 4; i++) fillRect(x + 46, y0 + 12 + i * 6, 34, 3, RED);
    fillRect(x + 46, y0 + 12, 14, 12, BLUE);
    fillCircle(x + 50, y0 + 16, 1, WHITE);
    fillCircle(x + 55, y0 + 20, 1, WHITE);
  } else if (kind === "eu") {
    fillCircle(x + 28, cy, 18, BLUE);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      fillCircle(x + 28 + Math.cos(a) * 12, cy + Math.sin(a) * 12, 1.8, GOLD);
    }
  } else if (kind === "voyager") {
    polyline([[x + 14, y0 + 36], [x + 26, y0 + 22], [x + 40, y0 + 10]], 2, INK);
    fillEllipse(x + 26, y0 + 22, 13, 5, GOLD);
    line(x + 26, y0 + 22, x + 26, y0 + 30, 2, INK);
    sparkle(x + 52, y0 + 12, 4, GOLD);
    sparkle(x + 60, y0 + 30, 3, INK);
    fillCircle(x + 14, y0 + 14, 1.6, INK);
  } else if (kind === "globe") {
    fillCircle(x + 28, cy, 18, TEAL);
    fillEllipse(x + 22, cy - 5, 7, 4, CREAM);
    fillEllipse(x + 34, cy + 6, 6, 4, CREAM);
    fillPoly([[x + 48, y0 + 8], [x + 58, y0 + 8], [x + 56, y0 + 20], [x + 50, y0 + 20]], GREEN);
    line(x + 48, y0 + 8, x + 58, y0 + 20, 1.5, GREEN);
  } else if (kind === "cyclone") {
    const pts = [];
    for (let t = 0; t <= 2.6 * Math.PI * 2; t += 0.25) {
      const r = 3 + t * 1.05;
      pts.push([x + 28 + Math.cos(t) * r, cy + Math.sin(t) * r * 0.9]);
    }
    polyline(pts, 3, SKY);
    fillCircle(x + 52, y0 + 32, 3, SKY);
    fillPoly([[x + 58, y0 + 26], [x + 62, y0 + 34], [x + 54, y0 + 34]], SKY);
  } else if (kind === "factory") {
    fillRect(x + 8, y0 + 22, 40, 14, INK);
    fillPoly([[x + 8, y0 + 22], [x + 16, y0 + 14], [x + 24, y0 + 22], [x + 32, y0 + 14], [x + 40, y0 + 22], [x + 48, y0 + 14], [x + 48, y0 + 22]], INK);
    fillRect(x + 50, y0 + 10, 6, 26, INK);
    fillRect(x + 12, y0 + 28, 7, 8, RED);
  } else if (kind === "pad") {
    fillRoundRect(x + 8, y0 + 12, 46, 24, 8, INK);
    fillPoly([[x + 18, y0 + 19], [x + 22, y0 + 19], [x + 22, y0 + 15], [x + 26, y0 + 15], [x + 26, y0 + 19], [x + 30, y0 + 19], [x + 30, y0 + 23], [x + 26, y0 + 23], [x + 26, y0 + 27], [x + 22, y0 + 27], [x + 22, y0 + 23], [x + 18, y0 + 23]], CREAM);
    fillCircle(x + 40, y0 + 20, 3, CREAM);
    fillCircle(x + 46, y0 + 26, 3, RED);
    fillCircle(x + 46, y0 + 18, 2.4, CREAM);
  } else if (kind === "seal") {
    fillRect(x + 10, y0 + 9, 34, 28, WHITE);
    line(x + 10, y0 + 9, x + 44, y0 + 9, 1.5, INK);
    line(x + 10, y0 + 37, x + 44, y0 + 37, 1.5, INK);
    line(x + 10, y0 + 9, x + 10, y0 + 37, 1.5, INK);
    line(x + 44, y0 + 9, x + 44, y0 + 37, 1.5, INK);
    line(x + 14, y0 + 16, x + 36, y0 + 16, 2, INK);
    line(x + 14, y0 + 22, x + 36, y0 + 22, 2, INK);
    line(x + 14, y0 + 28, x + 28, y0 + 28, 2, INK);
    fillCircle(x + 48, y0 + 30, 9, RED);
    line(x + 44, y0 + 26, x + 52, y0 + 34, 2, WHITE);
    line(x + 52, y0 + 26, x + 44, y0 + 34, 2, WHITE);
  }
}

// ---- lead illustration: air-defence radar panel over the Gulf ----
function drawLeadArt(x0, y0, x1, y1) {
  fillRect(x0, y0, x1 - x0, y1 - y0, NAVY);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const ringC = [88, 118, 138, 255];
  for (const r of [58, 104, 148]) {
    polyline(arcPoints(cx, cy, r, 0, Math.PI * 2, 48), 2, ringC);
  }
  line(cx - 148, cy, cx + 148, cy, 1, ringC);
  line(cx, cy - 148, cx, cy + 148, 1, ringC);
  // sweep
  const sa = -0.66;
  line(cx, cy, cx + Math.cos(sa) * 148, cy + Math.sin(sa) * 148, 2, CREAM);
  // drone silhouettes (cream) with dotted flight paths
  const drones = [[190, 320], [400, 300], [440, 470]];
  for (const [dx, dy] of drones) {
    fillEllipse(dx, dy, 11, 4.5, CREAM);
    line(dx - 8, dy - 6, dx + 8, dy - 6, 1.5, CREAM);
    line(dx - 8, dy + 6, dx + 8, dy + 6, 1.5, CREAM);
    line(dx, dy, dx - 14, dy + 2, 1.5, CREAM);
  }
  // dotted paths toward the intercepts
  const paths = [[[190, 320], [300, 372]], [[400, 300], [392, 442]], [[440, 470], [392, 442]]];
  for (const [[ax, ay], [bx, by]] of paths) {
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      fillCircle(ax + (bx - ax) * t, ay + (by - ay) * t, 1.6, CREAM);
    }
  }
  // intercepts
  burst(300, 372, 15, 6, RED);
  burst(392, 442, 15, 6, RED);
  fillCircle(300, 372, 3, WHITE);
  fillCircle(392, 442, 3, WHITE);
  // place labels
  drawText("THE GULF", "sansBold", 16, x0 + 16, y0 + 30, CREAM, 1);
  drawText("ALI AL SALEM", "sansBold", 16, x0 + 16, y1 - 14, CREAM, 1);
  drawText("KUWAIT", "sansBold", 16, 300, y1 - 14, CREAM, 1);
  drawText("BAHRAIN", "sansBold", 16, 452, y1 - 14, CREAM, 1);
}

// ---- layout ----
function draw() {
  fillRect(0, 0, W, H, PAPER);
  const M = 36, R = 988;

  // kicker
  drawText("THE WORLD'S NEWS IN ONE PICTURE", "sansBold", 16, M, 52, INK, 1.5);
  const rk = "9 STORIES \u00b7 5 REGIONS \u00b7 ONE DAY";
  drawText(rk, "sansBold", 16, R - textWidth(rk, "sansBold", 16, 1.5), 52, RED, 1.5);
  fillRect(M, 64, R - M, 2, INK);

  // masthead + date
  drawCentered("THE WORLD", "serif", 98, W / 2, 158, INK);
  drawCentered("WEDNESDAY 18 NOVEMBER 2026", "sansBold", 34, W / 2, 208, INK, 1);
  fillRect(M, 222, R - M, 3, INK);
  fillRect(M, 228, R - M, 1, INK);

  // lead story: art left, text right
  drawLeadArt(M, 242, 548, 580);
  const lx = 572, lw = R - lx;
  drawText(LEAD.label, "sansBold", 18, lx, 312, RED, 1);
  fillRect(lx, 324, 64, 4, RED);
  const headLines = wrap(LEAD.head, "serif", 38, lw);
  drawLines(headLines, "serif", 38, lx, 368, 46, INK);
  const deckLines = wrap(LEAD.deck, "sans", 20, lw);
  drawLines(deckLines, "sans", 20, lx, 368 + headLines.length * 46 + 22, 27, INK);
  fillRect(M, 596, R - M, 2, INK);

  // secondary stories: 2 rows x 4 columns
  const colW = 229, gap = 12, rowH = 180, rowGap = 14, top = 612;
  for (let i = 0; i < CARDS.length; i++) {
    const card = CARDS[i];
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * (colW + gap);
    const y = top + row * (rowH + rowGap);
    fillRect(x, y, colW, 46, PAPER2);
    drawIcon(card.icon, x, y);
    drawText(card.label, "sansBold", 16, x, y + 68, RED, 0.5);
    const hl = wrap(card.head, "serif", 19, colW);
    drawLines(hl, "serif", 19, x, y + 94, 23, INK);
    const dl = wrap(card.deck, "sans", 16, colW);
    drawLines(dl, "sans", 16, x, y + 94 + hl.length * 23 + 8, 19, GREY);
    if (hl.length > 2 || dl.length > 2) console.log("OVERFLOW", card.label, "head lines:", hl.length, "deck lines:", dl.length);
  }

  // footer
  drawCentered(
    "Sources: Reuters, AP, AFP, Al Jazeera, BBC \u00b7 Facts as of 23:59 UTC, 18 Nov 2026",
    "sans", 16, W / 2, 1008, INK
  );
}

function main() {
  draw();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
  // diagnostics on stdout only; the file is the entry.
  console.log(JSON.stringify({ bytes: png.length, width: W, height: H }));
}

main();
