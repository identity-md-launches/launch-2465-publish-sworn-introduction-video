// Renders the Sworn intro as a PNG frame sequence (1920x1080, 30 fps) plus a quiet
// synthesized WAV bed. Cards are the Renderer SVGs from artifacts/cards, rasterized
// unchanged with resvg (scaled only) and placed on the frame.
// usage: NODE_PATH=<dir with @resvg/resvg-js> node video/render.cjs <outdir> [onlyFrame]
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const ROOT = path.join(__dirname, "..");
const OUT = process.argv[2];
const ONLY = process.argv[3] !== undefined ? Number(process.argv[3]) : null;
const FPS = 30, W = 1920, H = 1080, DUR = 59.8;
const BG = "#0a0a0a", TXT = "#d9e0da", ACC = "#00ff41", MUT = "#8c968e";
const FONT = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf";
const FAMILY = "Liberation Mono";
const CARD = 680, CX = 110, CY = 200;

const cardPng = {};
for (const f of ["card-1", "card-3", "preview-1", "preview-3", "preview-6", "preview-8", "preview-10"]) {
  const svg = fs.readFileSync(path.join(ROOT, "artifacts/cards", f + ".svg"), "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: CARD } }).render().asPng();
  cardPng[f] = "data:image/png;base64," + Buffer.from(png).toString("base64");
}
const mark = "data:image/svg+xml;base64," + fs.readFileSync(path.join(ROOT, "artifacts/sworn-mark.svg")).toString("base64");

const clamp = (x) => Math.max(0, Math.min(1, x));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// a text line: types in at cps (or fades in when cps=0), holds until end, fades out
function line(t, o) {
  const { s, x, y, size = 40, color = TXT, t0, t1, cps = 28, anchor = "start", cursor = false } = o;
  if (t < t0 || t >= t1) return "";
  let shown = s, op = 1;
  if (cps) shown = s.slice(0, Math.min(s.length, Math.floor((t - t0) * cps) + 1));
  else op = clamp((t - t0) / 0.4);
  op *= clamp((t1 - t) / 0.35);
  let out = `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" opacity="${op.toFixed(3)}" text-anchor="${anchor}" xml:space="preserve">${esc(shown)}</text>`;
  const typing = cps && shown.length < s.length;
  if (cursor && (typing || Math.floor(t * 2) % 2 === 0)) {
    const cx = x + shown.length * size * 0.6 + 4;
    out += `<rect x="${cx.toFixed(1)}" y="${y - size * 0.8}" width="${size * 0.55}" height="${size * 0.95}" fill="${ACC}" opacity="${op.toFixed(3)}"/>`;
  }
  return out;
}
function card(t, name, t0, t1, fadeIn = 0.6) {
  if (t < t0 || t >= t1) return "";
  const op = clamp((t - t0) / fadeIn) * clamp((t1 - t) / 0.35);
  return `<image x="${CX}" y="${CY}" width="${CARD}" height="${CARD}" opacity="${op.toFixed(3)}" href="${cardPng[name]}"/>`;
}

// storyboard; every line is listed in artifacts/VIDEO.md with the same times
const L = [];
const add = (o) => L.push(o);
// (1) 0-6
add({ s: "19,522 wallets", x: 240, y: 430, size: 56, t0: 0.3, t1: 6.0 });
add({ s: "66 hours of real gas", x: 240, y: 530, size: 56, t0: 1.6, t1: 6.0 });
add({ s: "one game: who is still onchain?", x: 240, y: 630, size: 56, t0: 3.0, t1: 6.0, cursor: true });
// (2) 6-11
add({ s: "the game settled", x: 240, y: 490, size: 56, t0: 6.3, t1: 11.0 });
add({ s: "the list stayed onchain", x: 240, y: 590, size: 56, t0: 8.0, t1: 11.0, cursor: true });
// (3) 11-17
add({ s: "sworn reads that history", x: 240, y: 490, size: 56, t0: 11.3, t1: 17.0 });
add({ s: "and turns it into facts about wallets", x: 240, y: 590, size: 56, t0: 13.3, t1: 17.0, cursor: true });
// (4) 17-28, text column right of the card
const TX = 870;
add({ s: "every card starts empty", x: TX, y: 420, size: 34, t0: 17.4, t1: 28.0 });
add({ s: "direct facts light up straight from the chain", x: TX, y: 500, size: 34, t0: 19.8, t1: 28.0 });
add({ s: "25 facts. 13 families.", x: TX, y: 580, size: 34, color: ACC, t0: 24.0, t1: 28.0 });
add({ s: "card #1, minted: Registry.tokenURI(1)", x: TX, y: 700, size: 22, color: MUT, cps: 0, t0: 17.4, t1: 19.6 });
add({ s: "previews: Renderer.tokenURIOf + state override", x: TX, y: 700, size: 22, color: MUT, cps: 0, t0: 19.6, t1: 28.0 });
// (5) 28-39
add({ s: "the rest is sworn by the swarm", x: TX, y: 400, size: 34, t0: 28.4, t1: 39.0 });
add({ s: "11 IMD agents read the logs. 7 must agree", x: TX, y: 480, size: 34, t0: 30.8, t1: 39.0 });
add({ s: "the oracle signs. the registry checks.", x: TX, y: 640, size: 34, t0: 35.2, t1: 39.0 });
add({ s: "card #3, minted: Registry.tokenURI(3)", x: TX, y: 760, size: 22, color: MUT, cps: 0, t0: 28.4, t1: 39.0 });
// (6) 39-46, code on black
add({ s: "hasTrait(wallet, 601)", x: 360, y: 420, size: 52, t0: 39.3, t1: 46.0, cps: 18 });
add({ s: "true", x: 360, y: 500, size: 52, color: ACC, cps: 0, t0: 41.0, t1: 46.0 });
add({ s: "any contract can read it", x: 360, y: 640, size: 40, t0: 42.0, t1: 46.0 });
add({ s: "no merkle root. no snapshot.", x: 360, y: 710, size: 40, t0: 43.6, t1: 46.0, cursor: true });
// (7) 46-52
add({ s: "mint a card: 0.1 IMD", x: 240, y: 400, size: 52, t0: 46.3, t1: 52.0 });
add({ s: "request a fact: 0.5 IMD", x: 240, y: 490, size: 52, t0: 47.5, t1: 52.0 });
add({ s: "your card updates itself", x: 240, y: 580, size: 52, color: ACC, t0: 48.8, t1: 52.0 });
add({ s: "fees are forwarded to the BurnExecutor for bridging and burning on Base", x: 240, y: 700, size: 24, color: MUT, cps: 0, t0: 49.6, t1: 52.0 });
// (8) 52-56
add({ s: "contracts, site and this video: built by the swarm", x: 200, y: 490, size: 44, t0: 52.3, t1: 56.0, cps: 36 });
add({ s: "no owner. no backend. no coin.", x: 200, y: 580, size: 44, t0: 53.8, t1: 56.0, cursor: true });
// (9) 56-59.8
add({ s: "swornbyswarm.sites.imd.fun", x: 960, y: 690, size: 44, anchor: "middle", cps: 0, t0: 56.4, t1: 60 });
add({ s: "@swornbyswarm", x: 960, y: 760, size: 32, color: MUT, anchor: "middle", cps: 0, t0: 56.8, t1: 60 });

function frame(t) {
  let b = "";
  // (4) card #1 then previews, cross-faded so the hive fills cell by cell
  const seq = [["card-1", 17.0], ["preview-1", 19.6], ["preview-3", 21.3], ["preview-6", 23.0], ["preview-8", 24.7], ["preview-10", 26.4]];
  seq.forEach(([n, a], i) => {
    const next = seq[i + 1];
    // keep the outgoing card fully under the incoming one until its fade is done
    b += card(t, n, a, next ? next[1] + 0.6 : 28.0, i === 0 ? 0.6 : 0.6);
  });
  // (5) card #3 and eleven seat markers filling one by one
  b += card(t, "card-3", 28.0, 39.0);
  if (t >= 31.6 && t < 39.0) {
    const op = clamp((39.0 - t) / 0.35);
    for (let i = 0; i < 11; i++) {
      const on = t >= 32.0 + i * 0.3;
      const x = TX + i * 40;
      b += `<rect x="${x}" y="532" width="24" height="24" fill="${on ? ACC : "none"}" stroke="${on ? ACC : MUT}" stroke-width="2" opacity="${op.toFixed(3)}"/>`;
    }
  }
  // (9) the Sworn mark
  if (t >= 56.0) b += `<image x="880" y="420" width="160" height="160" opacity="${clamp((t - 56.0) / 0.5).toFixed(3)}" href="${mark}"/>`;
  for (const o of L) b += line(t, o);
  const fade = clamp(t / 0.3) * clamp((DUR - t) / 0.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="${FAMILY}"><rect width="${W}" height="${H}" fill="${BG}"/><g opacity="${fade.toFixed(3)}">${b}</g></svg>`;
}

const opts = { font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: FAMILY, monospaceFamily: FAMILY } };
fs.mkdirSync(OUT, { recursive: true });
const N = Math.round(DUR * FPS);
let last = null, lastFile = null;
for (let i = 0; i < N; i++) {
  if (ONLY !== null && i !== ONLY) continue;
  const svg = frame(i / FPS);
  const file = path.join(OUT, `f${String(i).padStart(4, "0")}.png`);
  if (svg === last) fs.copyFileSync(lastFile, file);
  else fs.writeFileSync(file, new Resvg(svg, opts).render().asPng());
  last = svg; lastFile = file;
}

// quiet instrumental bed: a soft A minor drone with slow swells, -30 dBFS-ish
if (ONLY === null) {
  const SR = 48000, n = Math.round(DUR * SR);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  const notes = [110, 164.81, 220, 261.63];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    notes.forEach((f, k) => { v += Math.sin(2 * Math.PI * f * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * (0.05 + k * 0.03) * t + k)); });
    const env = Math.min(1, t / 3) * Math.min(1, (DUR - t) / 3);
    buf.writeInt16LE(Math.round(v / notes.length * 0.05 * env * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, "bed.wav"), buf);
}
