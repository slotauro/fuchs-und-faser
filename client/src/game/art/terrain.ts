import type { MapDef, TileType } from '@fuf/shared';
import { PALETTE as P } from './palette';
import { cellRng, hashString, mulberry32 } from './rng';

/**
 * Zeichnet den Boden einer Karte als eine zusammenhängende Canvas-Textur:
 * Wiese mit Farbverlauf und Halmen, Wege, Straßen mit Bordstein, Wasser mit runden Ufern,
 * Felsen, Wurzeln, Leerrohre und Fremdleitungen. Häuser, Verteiler und Figuren sind eigene Sprites.
 */

type At = (x: number, y: number) => TileType | null;
type Ctx = CanvasRenderingContext2D;

const isWater = (t: TileType | null) => t === 'water' || t === 'bridgeSite';
const isRoad = (t: TileType | null) => t === 'road';
const isPaving = (t: TileType | null) => t === 'sidewalk';
const isConduit = (t: TileType | null, revealed: boolean) => t === 'conduit' || (revealed && t === 'hiddenConduit');

/** Wie `fillRect`, aber mit runden Außenecken dort, wo kein Nachbar derselben Fläche liegt. */
function regionCell(
  ctx: Ctx,
  x: number,
  y: number,
  T: number,
  same: (dx: number, dy: number) => boolean,
  radius: number,
  inflate = 0,
): void {
  const up = same(0, -1);
  const down = same(0, 1);
  const left = same(-1, 0);
  const right = same(1, 0);
  const l = x * T - (left ? 0 : inflate);
  const r = (x + 1) * T + (right ? 0 : inflate);
  const t = y * T - (up ? 0 : inflate);
  const b = (y + 1) * T + (down ? 0 : inflate);
  const rad = (a: boolean, c: boolean) => (!a && !c ? radius : 0);
  const tl = rad(up, left);
  const tr = rad(up, right);
  const br = rad(down, right);
  const bl = rad(down, left);
  ctx.beginPath();
  ctx.moveTo(l + tl, t);
  ctx.lineTo(r - tr, t);
  ctx.quadraticCurveTo(r, t, r, t + tr);
  ctx.lineTo(r, b - br);
  ctx.quadraticCurveTo(r, b, r - br, b);
  ctx.lineTo(l + bl, b);
  ctx.quadraticCurveTo(l, b, l, b - bl);
  ctx.lineTo(l, t + tl);
  ctx.quadraticCurveTo(l, t, l + tl, t);
  ctx.closePath();
  ctx.fill();
}

function blob(ctx: Ctx, cx: number, cy: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** Grashalme und Blüten auf einer Fläche. */
function grass(ctx: Ctx, x0: number, y0: number, w: number, h: number, rnd: () => number, T: number, flowers: boolean): void {
  const count = Math.round((w * h) / (T * T) * 14);
  for (let i = 0; i < count; i++) {
    const x = x0 + rnd() * w;
    const y = y0 + rnd() * h;
    const len = T * (0.05 + rnd() * 0.06);
    ctx.strokeStyle = rnd() < 0.5 ? P.meadowDark : P.meadowLight;
    ctx.lineWidth = T * 0.018;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - len * 0.5, y);
    ctx.lineTo(x - len * 0.2, y - len);
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.1, y - len * 1.2);
    ctx.moveTo(x + len * 0.5, y);
    ctx.lineTo(x + len * 0.45, y - len * 0.9);
    ctx.stroke();
  }
  if (!flowers) return;
  const blooms = Math.floor(rnd() * 3);
  for (let i = 0; i < blooms; i++) {
    const x = x0 + w * (0.15 + rnd() * 0.7);
    const y = y0 + h * (0.15 + rnd() * 0.7);
    const color = P.flowers[Math.floor(rnd() * P.flowers.length)];
    const r = T * 0.026;
    ctx.fillStyle = color;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f2a33a';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pebble(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(59,47,37,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.2, y + r * 0.35, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.stoneLight;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function boulder(ctx: Ctx, cx: number, cy: number, r: number, rnd: () => number): void {
  const pts: [number, number][] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = 0.78 + rnd() * 0.3;
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.8]);
  }
  const path = () => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  // Schlagschatten nach rechts unten
  ctx.save();
  ctx.translate(r * 0.18, r * 0.28);
  ctx.fillStyle = 'rgba(40,30,20,0.28)';
  path();
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.6, cy + r);
  g.addColorStop(0, P.stoneLight);
  g.addColorStop(0.55, P.stone);
  g.addColorStop(1, P.stoneDark);
  ctx.fillStyle = g;
  path();
  ctx.fill();
  ctx.strokeStyle = P.outline;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = r * 0.07;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Kante und Moos
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.moveTo(pts[5][0] * 0.7 + cx * 0.3, pts[5][1] * 0.7 + cy * 0.3);
  ctx.lineTo(pts[0][0] * 0.75 + cx * 0.25, pts[0][1] * 0.75 + cy * 0.25);
  ctx.stroke();
  ctx.fillStyle = P.moss;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.28, r * 0.13, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

interface DrawEnv {
  ctx: Ctx;
  T: number;
  at: At;
  revealed: boolean;
  seed: string;
}

/** Bodenart unter einem Leerrohr: Gehweg, wenn es in einem Gehweg-Streifen liegt, sonst Wiese. */
function conduitBase(env: DrawEnv, x: number, y: number): 'paving' | 'meadow' {
  let paving = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let t = env.at(x + dx, y + dy);
    // entlang einer Leerrohr-Trasse weitersuchen
    let k = 1;
    while (t === 'conduit' || t === 'hiddenConduit') {
      k++;
      t = env.at(x + dx * k, y + dy * k);
    }
    if (isPaving(t) && dy === 0) paving++;
  }
  return paving > 0 ? 'paving' : 'meadow';
}

function drawPavingCell(env: DrawEnv, x: number, y: number): void {
  const { ctx, T, at } = env;
  const rnd = cellRng(env.seed, x, y);
  const pavingLike = (t: TileType | null) => isPaving(t) || ((t === 'conduit' || t === 'hiddenConduit') && conduitBase(env, x, y) === 'paving');
  ctx.fillStyle = P.paving;
  regionCell(ctx, x, y, T, (dx, dy) => pavingLike(at(x + dx, y + dy)), T * 0.12);
  // Pflastersteine
  ctx.strokeStyle = P.pavingDark;
  ctx.lineWidth = T * 0.02;
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const yy = y * T + (r * T) / rows;
    ctx.beginPath();
    ctx.moveTo(x * T, yy);
    ctx.lineTo((x + 1) * T, yy);
    ctx.stroke();
    const offset = r % 2 ? T / 4 : 0;
    for (let c = 0; c < 2; c++) {
      const xx = x * T + offset + (c * T) / 2;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + T / rows);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.15})`;
    ctx.fillRect(x * T + rnd() * T * 0.8, y * T + rnd() * T * 0.8, T * 0.18, T * 0.1);
  }
}

function drawRoadCell(env: DrawEnv, x: number, y: number): void {
  const { ctx, T, at } = env;
  const rnd = cellRng(env.seed, x, y);
  ctx.fillStyle = P.asphalt;
  ctx.fillRect(x * T, y * T, T, T);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x * T + rnd() * T, y * T + rnd() * T, T * 0.03, T * 0.03);
  }
  const horizontal = isRoad(at(x - 1, y)) || isRoad(at(x + 1, y)) || !(isRoad(at(x, y - 1)) || isRoad(at(x, y + 1)));
  // Bordstein zu allen Nicht-Straßen-Nachbarn
  const curb = T * 0.07;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (isRoad(at(x + dx, y + dy))) continue;
    ctx.fillStyle = P.curb;
    const rx = dx === 1 ? (x + 1) * T - curb : x * T;
    const ry = dy === 1 ? (y + 1) * T - curb : y * T;
    ctx.fillRect(rx, ry, dx === 0 ? T : curb, dy === 0 ? T : curb);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const sx = dx === 1 ? rx - curb * 0.5 : dx === -1 ? rx + curb : rx;
    const sy = dy === 1 ? ry - curb * 0.5 : dy === -1 ? ry + curb : ry;
    ctx.fillRect(sx, sy, dx === 0 ? T : curb * 0.5, dy === 0 ? T : curb * 0.5);
  }
  // Mittelstreifen
  ctx.fillStyle = P.marking;
  if (horizontal) {
    ctx.fillRect(x * T + T * 0.12, y * T + T * 0.47, T * 0.36, T * 0.06);
    ctx.fillRect(x * T + T * 0.62, y * T + T * 0.47, T * 0.26, T * 0.06);
  } else {
    ctx.fillRect(x * T + T * 0.47, y * T + T * 0.12, T * 0.06, T * 0.36);
    ctx.fillRect(x * T + T * 0.47, y * T + T * 0.62, T * 0.06, T * 0.26);
  }
}

function drawWaterCell(env: DrawEnv, x: number, y: number, tile: TileType): void {
  const { ctx, T, at } = env;
  const same = (dx: number, dy: number) => isWater(at(x + dx, y + dy));
  // Uferböschung
  ctx.fillStyle = '#6f9a4a';
  regionCell(ctx, x, y, T, same, T * 0.42, T * 0.06);
  ctx.fillStyle = '#c9b582';
  regionCell(ctx, x, y, T, same, T * 0.38, T * 0.02);
  const g = ctx.createLinearGradient(0, y * T, 0, (y + 1) * T);
  g.addColorStop(0, P.water);
  g.addColorStop(1, P.waterDeep);
  ctx.fillStyle = g;
  regionCell(ctx, x, y, T, same, T * 0.34, -T * 0.03);
  // Wellen
  const rnd = cellRng(env.seed, x, y);
  ctx.strokeStyle = 'rgba(230,246,251,0.7)';
  ctx.lineWidth = T * 0.025;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const wx = x * T + T * (0.15 + rnd() * 0.45);
    const wy = y * T + T * (0.2 + i * 0.28);
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + T * 0.08, wy - T * 0.05, wx + T * 0.16, wy);
    ctx.quadraticCurveTo(wx + T * 0.24, wy + T * 0.05, wx + T * 0.32, wy);
    ctx.stroke();
  }
  // Schaumkante am Ufer
  ctx.strokeStyle = 'rgba(230,246,251,0.85)';
  ctx.lineWidth = T * 0.03;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (same(dx, dy)) continue;
    const inset = T * 0.06;
    ctx.beginPath();
    if (dy === -1) { ctx.moveTo(x * T + T * 0.3, y * T + inset); ctx.lineTo((x + 1) * T - T * 0.3, y * T + inset); }
    if (dy === 1) { ctx.moveTo(x * T + T * 0.3, (y + 1) * T - inset); ctx.lineTo((x + 1) * T - T * 0.3, (y + 1) * T - inset); }
    if (dx === -1) { ctx.moveTo(x * T + inset, y * T + T * 0.3); ctx.lineTo(x * T + inset, (y + 1) * T - T * 0.3); }
    if (dx === 1) { ctx.moveTo((x + 1) * T - inset, y * T + T * 0.3); ctx.lineTo((x + 1) * T - inset, (y + 1) * T - T * 0.3); }
    ctx.stroke();
  }
  if (tile === 'bridgeSite') {
    // Markierte Querungsstelle: Pfähle an den Ecken und Plankenmarkierung
    ctx.strokeStyle = P.plank;
    ctx.globalAlpha = 0.9;
    ctx.setLineDash([T * 0.1, T * 0.07]);
    ctx.lineWidth = T * 0.05;
    ctx.strokeRect(x * T + T * 0.2, y * T + T * 0.08, T * 0.6, T * 0.84);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    for (const [px, py] of [[0.2, 0.1], [0.8, 0.1], [0.2, 0.9], [0.8, 0.9]]) {
      const cx = x * T + px * T;
      const cy = y * T + py * T;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx + T * 0.02, cy + T * 0.03, T * 0.06, T * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.plankDark;
      ctx.beginPath();
      ctx.arc(cx, cy, T * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.plank;
      ctx.beginPath();
      ctx.arc(cx - T * 0.01, cy - T * 0.012, T * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRootsCell(env: DrawEnv, x: number, y: number): void {
  const { ctx, T, at } = env;
  const rnd = cellRng(env.seed, x, y);
  const same = (dx: number, dy: number) => at(x + dx, y + dy) === 'roots';
  ctx.fillStyle = P.soilDark;
  regionCell(ctx, x, y, T, same, T * 0.3, T * 0.04);
  ctx.fillStyle = P.soil;
  regionCell(ctx, x, y, T, same, T * 0.26, 0);
  // Laub und Erdkrümel
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(94,63,34,0.6)' : 'rgba(176,132,74,0.6)';
    ctx.beginPath();
    ctx.ellipse(x * T + rnd() * T, y * T + rnd() * T, T * 0.035, T * 0.02, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dicke, knorrige Wurzeln, über die Kachelgrenzen hinweg verbunden
  const drawRoot = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, w: number) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(40,25,10,0.35)';
    ctx.lineWidth = w + T * 0.03;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + T * 0.02);
    ctx.quadraticCurveTo(cx, cy + T * 0.02, x2, y2 + T * 0.02);
    ctx.stroke();
    ctx.strokeStyle = P.root;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
    ctx.strokeStyle = P.rootLight;
    ctx.lineWidth = w * 0.3;
    ctx.beginPath();
    ctx.moveTo(x1, y1 - w * 0.2);
    ctx.quadraticCurveTo(cx, cy - w * 0.2, x2, y2 - w * 0.2);
    ctx.stroke();
  };
  const X = x * T;
  const Y = y * T;
  // Position eines Wurzelaustritts auf einer Kante – identisch für beide angrenzenden Zellen
  const edge = (ex: number, ey: number, dir: 'h' | 'v', k: number) => 0.25 + cellRng(`${env.seed}:${dir}${k}`, ex, ey)() * 0.5;
  const leftY = Y + T * edge(x, y, 'v', 0);
  const rightY = Y + T * edge(x + 1, y, 'v', 0);
  const topX = X + T * edge(x, y, 'h', 0);
  const bottomX = X + T * edge(x, y + 1, 'h', 0);
  const inside = (dx: number, dy: number) => same(dx, dy);
  const lx = inside(-1, 0) ? X : X + T * 0.15;
  const rx = inside(1, 0) ? X + T : X + T * 0.85;
  const ty = inside(0, -1) ? Y : Y + T * 0.15;
  const by = inside(0, 1) ? Y + T : Y + T * 0.85;
  drawRoot(lx, leftY, X + T * (0.3 + rnd() * 0.4), Y + T * (0.2 + rnd() * 0.6), rx, rightY, T * 0.11);
  drawRoot(topX, ty, X + T * (0.2 + rnd() * 0.6), Y + T * (0.3 + rnd() * 0.4), bottomX, by, T * 0.08);
  const bx = X + T * (0.3 + rnd() * 0.4);
  drawRoot(bx, Y + T * (0.35 + rnd() * 0.3), bx + T * (rnd() - 0.5) * 0.3, Y + T * 0.75, bx + T * (rnd() - 0.5) * 0.5, Y + T * (0.8 + rnd() * 0.1), T * 0.05);
}

function drawRockCell(env: DrawEnv, x: number, y: number): void {
  const { ctx, T, at } = env;
  const rnd = cellRng(env.seed, x, y);
  const same = (dx: number, dy: number) => at(x + dx, y + dy) === 'rock';
  // Schotterbett: erst ein dunklerer Rand, dann deckende helle Fläche – zu Felsnachbarn hin geschlossen
  const spots: [number, number, number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    spots.push([x * T + T * (0.2 + rnd() * 0.6), y * T + T * (0.2 + rnd() * 0.6), T * (0.24 + rnd() * 0.08), T * (0.2 + rnd() * 0.06), rnd() * 3]);
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (same(dx, dy)) spots.push([x * T + T * (0.5 + dx * 0.42), y * T + T * (0.5 + dy * 0.42), T * 0.3, T * 0.3, 0]);
  }
  for (const [fill, grow] of [['#968b77', T * 0.035], ['#bdb29c', 0]] as const) {
    ctx.fillStyle = fill;
    for (const [gx, gy, rx, ry, rot] of spots) {
      ctx.beginPath();
      ctx.ellipse(gx, gy, rx + grow, ry + grow, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 8; i++) pebble(ctx, x * T + rnd() * T, y * T + rnd() * T, T * (0.02 + rnd() * 0.02));
  boulder(ctx, x * T + T * (0.36 + rnd() * 0.06), y * T + T * 0.42, T * 0.27, rnd);
  boulder(ctx, x * T + T * (0.7 + rnd() * 0.06), y * T + T * 0.68, T * 0.19, rnd);
  if (rnd() < 0.6) boulder(ctx, x * T + T * 0.24, y * T + T * 0.78, T * 0.11, rnd);
}

function drawConduitCell(env: DrawEnv, x: number, y: number, hidden: boolean): void {
  const { ctx, T, at, revealed } = env;
  const horizontal =
    isConduit(at(x - 1, y), revealed) || isConduit(at(x + 1, y), revealed) ||
    !(isConduit(at(x, y - 1), revealed) || isConduit(at(x, y + 1), revealed));
  ctx.save();
  ctx.translate(x * T + T / 2, y * T + T / 2);
  if (!horizontal) ctx.rotate(Math.PI / 2);
  const len = T / 2;
  const leftOpen = horizontal ? isConduit(at(x - 1, y), revealed) : isConduit(at(x, y - 1), revealed);
  const rightOpen = horizontal ? isConduit(at(x + 1, y), revealed) : isConduit(at(x, y + 1), revealed);
  const l = leftOpen ? -len : -len + T * 0.1;
  const r = rightOpen ? len : len - T * 0.1;
  // Graben
  ctx.fillStyle = 'rgba(70,55,40,0.35)';
  ctx.fillRect(l, -T * 0.2, r - l, T * 0.4);
  // Abdeckplatte aus Metall mit Rillen
  const g = ctx.createLinearGradient(0, -T * 0.17, 0, T * 0.17);
  g.addColorStop(0, P.conduitLight);
  g.addColorStop(1, P.conduit);
  ctx.fillStyle = g;
  ctx.fillRect(l, -T * 0.16, r - l, T * 0.32);
  ctx.strokeStyle = 'rgba(59,47,37,0.45)';
  ctx.lineWidth = T * 0.02;
  ctx.strokeRect(l, -T * 0.16, r - l, T * 0.32);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * T * 0.18, -T * 0.16);
    ctx.lineTo(i * T * 0.18, T * 0.16);
    ctx.stroke();
  }
  // Rohrsymbol: zwei Kreise
  ctx.fillStyle = '#5f666e';
  for (const px of [-T * 0.09, T * 0.09]) {
    ctx.beginPath();
    ctx.arc(px, 0, T * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9b3d';
    ctx.beginPath();
    ctx.arc(px, 0, T * 0.025, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5f666e';
  }
  ctx.restore();
  if (hidden) {
    // aufgedeckt durch die Spürnase: Funkeln und gestrichelter Rahmen
    ctx.strokeStyle = '#ffd54d';
    ctx.lineWidth = T * 0.03;
    ctx.setLineDash([T * 0.08, T * 0.06]);
    ctx.strokeRect(x * T + T * 0.06, y * T + T * 0.06, T * 0.88, T * 0.88);
    ctx.setLineDash([]);
    sparkle(ctx, x * T + T * 0.82, y * T + T * 0.18, T * 0.09);
  }
}

function sparkle(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? r * 0.35 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawForeignCell(env: DrawEnv, x: number, y: number): void {
  const { ctx, T } = env;
  const X = x * T;
  const Y = y * T;
  // aufgegrabene Erde mit sichtbarer roter Fremdleitung
  ctx.fillStyle = P.soil;
  ctx.beginPath();
  ctx.ellipse(X + T / 2, Y + T * 0.6, T * 0.42, T * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a1271b';
  ctx.lineWidth = T * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(X + T * 0.12, Y + T * 0.62);
  ctx.quadraticCurveTo(X + T * 0.5, Y + T * 0.5, X + T * 0.88, Y + T * 0.66);
  ctx.stroke();
  // Baustellenbarke: rot-weiß gestreifter Balken auf zwei Füßen
  const bx = X + T * 0.1;
  const by = Y + T * 0.2;
  const bw = T * 0.8;
  const bh = T * 0.2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(bx + T * 0.03, by + bh + T * 0.27, bw, T * 0.04);
  ctx.fillStyle = '#4b4f55';
  ctx.fillRect(bx + T * 0.06, by + bh, T * 0.05, T * 0.3);
  ctx.fillRect(bx + bw - T * 0.11, by + bh, T * 0.05, T * 0.3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.fillStyle = P.warnWhite;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = P.warnRed;
  for (let i = -2; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(bx + i * T * 0.16, by + bh);
    ctx.lineTo(bx + i * T * 0.16 + T * 0.08, by + bh);
    ctx.lineTo(bx + i * T * 0.16 + T * 0.16, by);
    ctx.lineTo(bx + i * T * 0.16 + T * 0.08, by);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = P.outline;
  ctx.lineWidth = T * 0.02;
  ctx.strokeRect(bx, by, bw, bh);
}

function drawMeadowCell(env: DrawEnv, x: number, y: number, flowers: boolean): void {
  const rnd = cellRng(env.seed, x, y);
  const { ctx, T } = env;
  grass(ctx, x * T, y * T, T, T, rnd, T, flowers);
  if (rnd() < 0.25) pebble(ctx, x * T + T * (0.2 + rnd() * 0.6), y * T + T * (0.2 + rnd() * 0.6), T * 0.025);
}

function drawPadCell(env: DrawEnv, x: number, y: number, color: string): void {
  const { ctx, T } = env;
  ctx.fillStyle = 'rgba(59,47,37,0.15)';
  ctx.beginPath();
  ctx.roundRect(x * T + T * 0.08, y * T + T * 0.12, T * 0.86, T * 0.84, T * 0.12);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x * T + T * 0.06, y * T + T * 0.08, T * 0.86, T * 0.84, T * 0.12);
  ctx.fill();
}

function drawCell(env: DrawEnv, x: number, y: number): void {
  const tile = env.at(x, y)!;
  switch (tile) {
    case 'meadow':
      drawMeadowCell(env, x, y, true);
      break;
    case 'sidewalk':
      drawPavingCell(env, x, y);
      break;
    case 'road':
      drawRoadCell(env, x, y);
      break;
    case 'water':
    case 'bridgeSite':
      drawWaterCell(env, x, y, tile);
      break;
    case 'roots':
      drawRootsCell(env, x, y);
      break;
    case 'rock':
      drawRockCell(env, x, y);
      break;
    case 'conduit':
    case 'hiddenConduit':
      if (conduitBase(env, x, y) === 'paving') drawPavingCell(env, x, y);
      else drawMeadowCell(env, x, y, false);
      if (tile === 'conduit' || env.revealed) drawConduitCell(env, x, y, tile === 'hiddenConduit');
      break;
    case 'foreignLine':
      drawMeadowCell(env, x, y, false);
      drawForeignCell(env, x, y);
      break;
    case 'distributor':
      drawMeadowCell(env, x, y, false);
      drawPadCell(env, x, y, '#cfc8b8');
      break;
    case 'building':
      // Wiese unter dem Haus-Sprite (der Schlagschatten kommt vom Haus selbst)
      drawMeadowCell(env, x, y, false);
      break;
    case 'connection':
      drawMeadowCell(env, x, y, false);
      drawPadCell(env, x, y, P.paving);
      break;
  }
}

/** Reihenfolge: flache Flächen zuerst, Erhebungen (Felsen, Barken) zuletzt. */
const LAYER_ORDER: TileType[][] = [
  ['meadow', 'distributor', 'connection', 'building'],
  ['sidewalk', 'road', 'conduit', 'hiddenConduit'],
  ['water', 'bridgeSite', 'roots'],
  ['rock', 'foreignLine'],
];

function paintBase(ctx: Ctx, w: number, h: number, seed: string, T: number): void {
  ctx.fillStyle = P.meadow[0];
  ctx.fillRect(0, 0, w, h);
  const rnd = mulberry32(hashString(`base:${seed}`));
  const blobs = Math.round((w * h) / (T * T) * 0.7);
  for (let i = 0; i < blobs; i++) {
    const color = rnd() < 0.5 ? P.meadowLight : P.meadowDark;
    blob(ctx, rnd() * w, rnd() * h, T * (0.9 + rnd() * 1.4), color, 0.13);
  }
}

/**
 * Zeichnet die ganze Karte inklusive Randbereich. Weltkoordinate (0,0) liegt bei (margin, margin).
 */
export function renderTerrain(map: MapDef, revealed: boolean, T: number, margin: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = map.width * T + margin * 2;
  canvas.height = map.height * T + margin * 2;
  const ctx = canvas.getContext('2d')!;
  paintBase(ctx, canvas.width, canvas.height, map.id, T);
  const env: DrawEnv = {
    ctx,
    T,
    revealed,
    seed: map.id,
    at: (x, y) => (x < 0 || y < 0 || x >= map.width || y >= map.height ? null : map.tiles[y][x]),
  };
  ctx.save();
  ctx.translate(margin, margin);
  // Gras im Randbereich
  const marginRnd = mulberry32(hashString(`margin:${map.id}`));
  grass(ctx, -margin, -margin, map.width * T + margin * 2, margin, marginRnd, T, true);
  grass(ctx, -margin, map.height * T, map.width * T + margin * 2, margin, marginRnd, T, true);
  grass(ctx, -margin, 0, margin, map.height * T, marginRnd, T, true);
  grass(ctx, map.width * T, 0, margin, map.height * T, marginRnd, T, true);
  for (const layer of LAYER_ORDER) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (layer.includes(map.tiles[y][x])) drawCell(env, x, y);
      }
    }
  }
  ctx.restore();
  // weiche Vignette für Tiefe
  const v = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.45,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(40,50,20,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Einzelne Kachel für die Legende – gleiche Zeichenroutinen wie das Spielfeld. */
export function renderTileSwatch(tile: TileType, size = 30): HTMLCanvasElement {
  const ratio = Math.max(2, window.devicePixelRatio || 1);
  const T = size * ratio;
  const canvas = document.createElement('canvas');
  canvas.width = T;
  canvas.height = T;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = P.meadow[0];
  ctx.fillRect(0, 0, T, T);
  const shown: TileType = tile === 'hiddenConduit' ? 'conduit' : tile;
  // Straßen und Leerrohre als Streifen zeigen, damit Markierungen richtig liegen
  const strip = shown === 'road' || shown === 'conduit' || shown === 'sidewalk';
  const env: DrawEnv = {
    ctx,
    T,
    revealed: true,
    seed: `swatch-${tile}`,
    at: (x, y) => (x === 0 && y === 0 ? shown : strip && y === 0 && Math.abs(x) === 1 ? shown : null),
  };
  drawCell(env, 0, 0);
  return canvas;
}
