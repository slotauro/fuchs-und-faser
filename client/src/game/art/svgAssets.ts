import { PALETTE as P } from './palette';
import type { HouseVariant } from './layout';

/**
 * Vektor-Assets der Spielwelt. Alle teilen Kontur (#3b2f25), Licht von oben links und
 * weiche Verläufe. Sie werden als Data-URL in Phaser geladen (keine externen Dateien).
 */

const O = P.outline;

export function svgDoc(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

// ---------- Häuser ----------

interface HouseLook {
  roof: string;
  roofDark: string;
  wall: string;
  wallShade: string;
  door: string;
  trim: string;
}

const HOUSE_LOOKS: Record<HouseVariant, HouseLook> = {
  cottage: { roof: '#d0613f', roofDark: '#a5442b', wall: '#f6e6c6', wallShade: '#e2cda4', door: '#4f7d4a', trim: '#fffaf0' },
  villa: { roof: '#5b7896', roofDark: '#435a73', wall: '#f8f1e6', wallShade: '#e4d8c6', door: '#9a5f33', trim: '#f6c453' },
  bakery: { roof: '#9b5434', roofDark: '#753c23', wall: '#fde8c8', wallShade: '#efd3a8', door: '#7a4a2a', trim: '#fffaf0' },
  school: { roof: '#4f8a5b', roofDark: '#3a6a44', wall: '#f4d98f', wallShade: '#e2c36f', door: '#3f5f8a', trim: '#fffaf0' },
};

export interface HouseOptions {
  variant: HouseVariant;
  /** Breite/Höhe der Grundfläche in Kacheln. */
  w: number;
  h: number;
  /** Lage des Hausanschlusses an der Vorderwand (falls er innerhalb der Grundfläche liegt). */
  socketColumn: number | null;
}

/** Pixel je Kachel in den Haus-SVGs. */
export const HOUSE_UNIT = 100;
/** Dachüberstand nach oben (Anteil einer Kachel), damit das Haus Höhe bekommt. */
export const HOUSE_OVERHANG = 0.3;

function windowSvg(x: number, y: number, w: number, h: number, trim: string): string {
  return `<g>
    <rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="4" fill="${trim}" stroke="${O}" stroke-width="2.5"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="url(#glass)"/>
    <path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="${trim}" stroke-width="3"/>
    <path d="M${x + 4} ${y + h - 6} L${x + w / 2 - 4} ${y + 4}" stroke="#ffffff" stroke-width="3" opacity="0.5"/>
    <rect x="${x - 5}" y="${y + h + 3}" width="${w + 10}" height="6" rx="2" fill="${trim}" stroke="${O}" stroke-width="2"/>
  </g>`;
}

export function houseSvg(opts: HouseOptions): string {
  const L = HOUSE_LOOKS[opts.variant];
  const U = HOUSE_UNIT;
  const W = opts.w * U;
  const top = HOUSE_OVERHANG * U;
  const H = opts.h * U + top;
  const pad = 8;
  const wallTop = top + opts.h * U * 0.46;
  const wallBottom = H - 10;
  const eave = wallTop + 6;
  // Tür auf der Seite gegenüber dem Anschluss
  const socketX = opts.socketColumn === null ? null : (opts.socketColumn + 0.5) * U;
  const doorX = socketX === null ? W / 2 : socketX > W / 2 ? W * 0.27 : W * 0.73;
  const doorW = 30;
  const doorH = 46;
  const windowsX = [W * 0.22, W * 0.5, W * 0.78].filter((x) => Math.abs(x - doorX) > 34 && (socketX === null || Math.abs(x - socketX) > 40));

  let extras = '';
  if (opts.variant === 'bakery') {
    // gestreifte Markise und Brezelschild
    const ax = windowsX[0] ?? W * 0.5;
    const stripes = Array.from({ length: 6 }, (_, i) =>
      `<rect x="${ax - 33 + i * 11}" y="${wallTop + 14}" width="11" height="16" fill="${i % 2 ? '#fffaf0' : P.fiber}"/>`).join('');
    extras += `<g>${stripes}<rect x="${ax - 33}" y="${wallTop + 14}" width="66" height="16" fill="none" stroke="${O}" stroke-width="2.5"/>
      <path d="M${ax - 33} ${wallTop + 30} q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0 q5.5 7 11 0" fill="${P.fiber}" stroke="${O}" stroke-width="2"/></g>`;
    extras += `<g transform="translate(${doorX + 26} ${wallTop + 18})"><circle r="11" fill="#fffaf0" stroke="${O}" stroke-width="2.5"/>
      <path d="M-6 3 q-2 -9 6 -6 q8 -3 6 6 M-5 -1 l10 0" stroke="#b5702c" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
  }
  if (opts.variant === 'school') {
    // Uhr im Giebel und Glockenturm
    extras += `<g transform="translate(${W / 2} ${top + opts.h * U * 0.25})"><circle r="15" fill="#fffaf0" stroke="${O}" stroke-width="3"/>
      <path d="M0 0 V-9 M0 0 L7 4" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/></g>`;
    extras += `<g transform="translate(${W * 0.78} ${top - 4})"><rect x="-12" y="0" width="24" height="26" fill="${L.wall}" stroke="${O}" stroke-width="2.5"/>
      <path d="M-16 2 L0 -16 L16 2 Z" fill="${L.roofDark}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-6 22 q0 -14 6 -14 q6 0 6 14 Z" fill="#f2b01e" stroke="${O}" stroke-width="2"/></g>`;
  }
  const chimney =
    opts.variant === 'school'
      ? ''
      : `<g><rect x="${W * 0.7}" y="${top - 2}" width="20" height="34" fill="#b4513a" stroke="${O}" stroke-width="2.5"/>
         <rect x="${W * 0.7 - 3}" y="${top - 6}" width="26" height="8" rx="2" fill="#8c3d2a" stroke="${O}" stroke-width="2.5"/></g>`;

  const roofTiles = Array.from({ length: 6 }, (_, i) => {
    const y = top + 10 + i * ((eave - top - 10) / 6);
    return `<path d="M${pad + 4} ${y} H${W - pad - 4}" stroke="${L.roofDark}" stroke-width="2" opacity="0.45"/>`;
  }).join('');

  return svgDoc(W, H, `
    <defs>
      <linearGradient id="roof-${opts.variant}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${L.roof}"/><stop offset="1" stop-color="${L.roofDark}"/>
      </linearGradient>
      <linearGradient id="wall-${opts.variant}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${L.wall}"/><stop offset="1" stop-color="${L.wallShade}"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#bfe6ff"/><stop offset="1" stop-color="#6aa9d6"/>
      </linearGradient>
    </defs>
    <rect x="${pad + 10}" y="${top + 18}" width="${W - pad * 2}" height="${H - top - 20}" rx="10" fill="#3b2f25" opacity="0.22"/>
    <rect x="${pad + 4}" y="${wallTop}" width="${W - pad * 2 - 8}" height="${wallBottom - wallTop}" fill="url(#wall-${opts.variant})" stroke="${O}" stroke-width="3"/>
    <rect x="${pad + 4}" y="${wallBottom - 8}" width="${W - pad * 2 - 8}" height="8" fill="#c9b48e" stroke="${O}" stroke-width="2.5"/>
    ${chimney}
    <path d="M${pad - 4} ${eave} L${pad + 14} ${top + 6} Q${pad + 18} ${top} ${pad + 26} ${top} H${W - pad - 26} Q${W - pad - 18} ${top} ${W - pad - 14} ${top + 6} L${W - pad + 4} ${eave} Z"
      fill="url(#roof-${opts.variant})" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    ${roofTiles}
    <path d="M${pad + 24} ${top + 6} H${W - pad - 24}" stroke="#ffffff" stroke-width="4" opacity="0.35" stroke-linecap="round"/>
    <path d="M${pad - 4} ${eave} H${W - pad + 4}" stroke="${O}" stroke-width="3"/>
    ${windowsX.map((x) => windowSvg(x - 15, wallTop + 22, 30, 24, L.trim)).join('')}
    <g>
      <rect x="${doorX - doorW / 2 - 4}" y="${wallBottom - doorH - 12}" width="${doorW + 8}" height="${doorH + 4}" rx="6" fill="${L.trim}" stroke="${O}" stroke-width="2.5"/>
      <rect x="${doorX - doorW / 2}" y="${wallBottom - doorH - 8}" width="${doorW}" height="${doorH}" rx="4" fill="${L.door}" stroke="${O}" stroke-width="2.5"/>
      <circle cx="${doorX + doorW / 2 - 7}" cy="${wallBottom - doorH / 2 - 8}" r="2.6" fill="#f6c453"/>
      <rect x="${doorX - doorW / 2 - 8}" y="${wallBottom - 10}" width="${doorW + 16}" height="7" rx="2" fill="#bfb5a2" stroke="${O}" stroke-width="2"/>
    </g>
    ${extras}`);
}

// ---------- Natur ----------

export function treeSvg(kind: 0 | 1 | 2): string {
  if (kind === 1) {
    // Tanne
    return svgDoc(100, 145, `
      <defs><linearGradient id="fir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5f9e58"/><stop offset="1" stop-color="#2f6a3d"/></linearGradient></defs>
      <ellipse cx="52" cy="138" rx="30" ry="7" fill="${O}" opacity="0.25"/>
      <rect x="44" y="112" width="12" height="26" rx="3" fill="#7a4e2c" stroke="${O}" stroke-width="2.5"/>
      <path d="M50 6 L84 62 H68 L92 100 H70 L94 122 H6 L30 100 H8 L32 62 H16 Z" fill="url(#fir)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M50 14 L34 58 M50 40 L28 94" stroke="#9fd07a" stroke-width="3" opacity="0.6" stroke-linecap="round"/>`);
  }
  const big = kind === 2;
  const w = big ? 120 : 110;
  const blobs = big
    ? [[60, 52, 40], [32, 70, 26], [90, 70, 26], [60, 82, 30]]
    : [[55, 48, 34], [32, 66, 24], [80, 64, 24], [56, 76, 28]];
  const fruit = big
    ? ''
    : [[40, 60], [70, 52], [62, 80], [84, 72]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#e2483a" stroke="${O}" stroke-width="1.5"/>`).join('');
  return svgDoc(w, 130, `
    <defs><radialGradient id="leaf${kind}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#a8d86e"/><stop offset="0.6" stop-color="#6cab47"/><stop offset="1" stop-color="#3f7a35"/></radialGradient></defs>
    <ellipse cx="${w / 2 + 4}" cy="123" rx="${w * 0.36}" ry="7" fill="${O}" opacity="0.25"/>
    <path d="M${w / 2 - 7} 124 Q${w / 2 - 4} 96 ${w / 2 - 6} 80 H${w / 2 + 6} Q${w / 2 + 4} 96 ${w / 2 + 8} 124 Z" fill="#7a4e2c" stroke="${O}" stroke-width="2.5"/>
    <g stroke="${O}" stroke-width="3">${blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#leaf${kind})"/>`).join('')}</g>
    ${blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r - 1.5}" fill="url(#leaf${kind})"/>`).join('')}
    <path d="M${w / 2 - 22} 34 q10 -12 24 -10" stroke="#d6f0a8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>
    ${fruit}`);
}

export function bushSvg(kind: 0 | 1): string {
  const flowers = kind === 0 ? '#f59bb6' : '#fff6e0';
  return svgDoc(70, 50, `
    <defs><radialGradient id="bush${kind}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#9fd06a"/><stop offset="1" stop-color="#4f8c3c"/></radialGradient></defs>
    <ellipse cx="37" cy="45" rx="30" ry="5" fill="${O}" opacity="0.25"/>
    <g stroke="${O}" stroke-width="2.5"><circle cx="22" cy="30" r="15" fill="url(#bush${kind})"/><circle cx="48" cy="30" r="15" fill="url(#bush${kind})"/><circle cx="35" cy="21" r="16" fill="url(#bush${kind})"/></g>
    <circle cx="22" cy="30" r="13.5" fill="url(#bush${kind})"/><circle cx="48" cy="30" r="13.5" fill="url(#bush${kind})"/><circle cx="35" cy="21" r="14.5" fill="url(#bush${kind})"/>
    ${[[24, 26], [40, 16], [50, 32], [32, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${flowers}" stroke="${O}" stroke-width="1"/>`).join('')}`);
}

export function stoneSvg(): string {
  return svgDoc(50, 34, `
    <defs><linearGradient id="st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.stoneLight}"/><stop offset="1" stop-color="${P.stoneDark}"/></linearGradient></defs>
    <ellipse cx="26" cy="30" rx="22" ry="4" fill="${O}" opacity="0.25"/>
    <path d="M6 28 Q4 14 16 10 Q26 4 32 12 Q44 12 44 26 Q36 31 22 30 Z" fill="url(#st)" stroke="${O}" stroke-width="2.5"/>
    <path d="M14 14 Q20 10 26 12" stroke="#fff" stroke-width="2.5" opacity="0.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="18" cy="12" rx="6" ry="2.5" fill="${P.moss}"/>`);
}

// ---------- Netztechnik ----------

export function distributorSvg(): string {
  return svgDoc(100, 110, `
    <defs><linearGradient id="cab" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6f8f86"/><stop offset="0.6" stop-color="#557168"/><stop offset="1" stop-color="#3f5751"/></linearGradient></defs>
    <ellipse cx="54" cy="100" rx="40" ry="8" fill="${O}" opacity="0.28"/>
    <rect x="18" y="22" width="64" height="76" rx="6" fill="url(#cab)" stroke="${O}" stroke-width="3"/>
    <rect x="14" y="14" width="72" height="14" rx="4" fill="#7fa096" stroke="${O}" stroke-width="3"/>
    <path d="M50 32 V92" stroke="${O}" stroke-width="2" opacity="0.6"/>
    <rect x="24" y="36" width="20" height="10" rx="2" fill="#3a4d48"/>
    <rect x="56" y="36" width="20" height="10" rx="2" fill="#3a4d48"/>
    <circle cx="30" cy="41" r="2.6" fill="#7dff8e"/><circle cx="37" cy="41" r="2.6" fill="#ffd54d"/>
    <circle cx="62" cy="41" r="2.6" fill="#7dff8e"/>
    <g transform="translate(50 70)"><circle r="13" fill="#fffaf0" stroke="${O}" stroke-width="2.5"/>
      <path d="M-8 4 Q-2 -10 8 -4" stroke="${P.fiber}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="-8" cy="4" r="2.5" fill="${P.fiber}"/><circle cx="8" cy="-4" r="2.5" fill="${P.fiber}"/></g>
    <path d="M24 24 H40" stroke="#fff" stroke-width="3" opacity="0.35" stroke-linecap="round"/>`);
}

export function shaftSvg(): string {
  return svgDoc(40, 40, `
    <circle cx="21" cy="22" r="16" fill="${O}" opacity="0.25"/>
    <circle cx="20" cy="20" r="16" fill="#8d949c" stroke="${O}" stroke-width="2.5"/>
    <circle cx="20" cy="20" r="11.5" fill="#b9c0c7" stroke="${P.fiber}" stroke-width="3"/>
    <path d="M12 16 H28 M12 20 H28 M12 24 H28" stroke="#7a828a" stroke-width="2"/>`);
}

export function socketSvg(connected: boolean): string {
  const face = connected ? '#7fd08e' : '#f6c94a';
  const faceDark = connected ? '#3f9a52' : '#d9a21c';
  const symbol = connected
    ? `<path d="M38 50 L47 59 L64 40" stroke="#fffaf0" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<circle cx="50" cy="50" r="13" fill="#3b2f25"/><circle cx="45" cy="50" r="3" fill="#f6c94a"/><circle cx="55" cy="50" r="3" fill="#f6c94a"/>`;
  return svgDoc(100, 100, `
    <defs><linearGradient id="sock${connected ? 1 : 0}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${face}"/><stop offset="1" stop-color="${faceDark}"/></linearGradient></defs>
    <rect x="24" y="28" width="60" height="62" rx="12" fill="${O}" opacity="0.25"/>
    <rect x="20" y="22" width="60" height="60" rx="12" fill="url(#sock${connected ? 1 : 0})" stroke="${O}" stroke-width="3.5"/>
    <rect x="26" y="26" width="48" height="10" rx="5" fill="#fff" opacity="0.35"/>
    ${symbol}`);
}

/** Abzeichen über der Figur, solange die geplante Route die Fähigkeit nutzt. */
export function abilityBadgeSvg(animal: 'fox' | 'mole' | 'beaver' | 'badger'): string {
  const icons = {
    fox: `<circle cx="22" cy="22" r="8" fill="#bfe6ff" stroke="${O}" stroke-width="3"/><path d="M28 28 L36 36" stroke="${O}" stroke-width="5" stroke-linecap="round"/>`,
    mole: `<path d="M14 34 L28 20" stroke="#a46a3a" stroke-width="4.5" stroke-linecap="round"/><path d="M26 12 L34 20 L28 28 Q22 26 20 20 Z" fill="#c7cdd3" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`,
    beaver: `<rect x="9" y="17" width="28" height="12" rx="2" fill="${P.plank}" stroke="${O}" stroke-width="2.5"/><path d="M16 17 V29 M23 17 V29 M30 17 V29" stroke="${P.plankDark}" stroke-width="2"/>`,
    badger: `<path d="M14 34 L30 16" stroke="#a46a3a" stroke-width="4.5" stroke-linecap="round"/><path d="M18 10 Q30 8 36 20 Q30 14 18 10 Z" fill="#c7cdd3" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`,
  };
  return svgDoc(46, 46, `
    <circle cx="24" cy="25" r="20" fill="${O}" opacity="0.25"/>
    <circle cx="23" cy="23" r="20" fill="${P.cream}" stroke="${P.fiber}" stroke-width="3.5"/>
    ${icons[animal]}`);
}

/**
 * Ein Kachelstück der Biberbrücke für eine waagerechte Route (senkrecht wird es gedreht).
 * Links und rechts offen, damit benachbarte Stücke zu einer durchgehenden Brücke werden.
 */
export function bridgeSvg(): string {
  const planks = Array.from({ length: 8 }, (_, i) => {
    const x = 6.25 + i * 12.5;
    return `<path d="M${x} 24 V76" stroke="${P.plankDark}" stroke-width="2"/><path d="M${x - 9} 28 V40" stroke="#fff" stroke-width="2" opacity="0.25" stroke-linecap="round"/>`;
  }).join('');
  const posts = [12, 88]
    .flatMap((x) => [18, 82].map((y) => `<circle cx="${x}" cy="${y}" r="6.5" fill="${P.plankDark}" stroke="${O}" stroke-width="2.5"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="2.5" fill="${P.plank}"/>`))
    .join('');
  return svgDoc(100, 100, `
    <rect x="0" y="28" width="100" height="58" fill="${O}" opacity="0.28"/>
    <rect x="0" y="22" width="100" height="56" fill="${P.plank}"/>
    ${planks}
    <rect x="0" y="14" width="100" height="8" fill="${P.plankDark}" stroke="${O}" stroke-width="2.5"/>
    <rect x="0" y="78" width="100" height="8" fill="${P.plankDark}" stroke="${O}" stroke-width="2.5"/>
    ${posts}`);
}

/** Maulwurfshügel an Tunnel-Ein- und -Ausgang. */
export function molehillSvg(): string {
  return svgDoc(60, 44, `
    <defs><radialGradient id="hill" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="${P.rootLight}"/><stop offset="1" stop-color="${P.soilDark}"/></radialGradient></defs>
    <ellipse cx="32" cy="38" rx="27" ry="5.5" fill="${O}" opacity="0.22"/>
    <path d="M5 37 Q10 13 30 10 Q50 13 55 37 Z" fill="url(#hill)" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="30" cy="16" rx="8" ry="4" fill="${P.soilDark}" stroke="${O}" stroke-width="2"/>
    <circle cx="16" cy="30" r="2.6" fill="${P.soilDark}"/><circle cx="40" cy="26" r="2.2" fill="${P.soilDark}"/><circle cx="46" cy="33" r="2.8" fill="${P.soilDark}"/>
    <path d="M14 24 Q18 16 26 14" stroke="#fff" stroke-width="2.5" fill="none" opacity="0.3" stroke-linecap="round"/>`);
}

/** Alle SVG-Texturen, die das Spielfeld vorlädt (Schlüssel → SVG, Pixelgröße). */
export function worldAssets(): { key: string; svg: string }[] {
  return [
    { key: 'tree-0', svg: treeSvg(0) },
    { key: 'tree-1', svg: treeSvg(1) },
    { key: 'tree-2', svg: treeSvg(2) },
    { key: 'bush-0', svg: bushSvg(0) },
    { key: 'bush-1', svg: bushSvg(1) },
    { key: 'stone', svg: stoneSvg() },
    { key: 'distributor', svg: distributorSvg() },
    { key: 'shaft', svg: shaftSvg() },
    { key: 'socket', svg: socketSvg(false) },
    { key: 'socket-on', svg: socketSvg(true) },
    { key: 'bridge', svg: bridgeSvg() },
    { key: 'molehill', svg: molehillSvg() },
    ...(['fox', 'mole', 'beaver', 'badger'] as const).map((id) => ({ key: `badge-${id}`, svg: abilityBadgeSvg(id) })),
  ];
}

/** Liest die Pixelgröße aus dem SVG-Wurzelelement (für `load.svg`). */
export function svgSize(svg: string): { width: number; height: number } {
  const m = /width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/.exec(svg)!;
  return { width: Number(m[1]), height: Number(m[2]) };
}
