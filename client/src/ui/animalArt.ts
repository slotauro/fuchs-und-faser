import type { AnimalId } from '@fuf/shared';

/**
 * Die vier Tierfiguren als Vektorgrafik. Alle teilen dieselben Proportionen (großer Kopf,
 * kompakter Körper), dieselbe Kontur und Licht von oben links. Die Figur schaut leicht nach rechts;
 * auf dem Spielfeld wird sie für die Laufrichtung gespiegelt.
 */

const O = '#3b2f25';

interface Fur {
  base: string;
  light: string;
  dark: string;
  belly: string;
  bellyLight: string;
  feet: string;
}

const FUR: Record<AnimalId, Fur> = {
  fox: { base: '#ef7d2d', light: '#ffb06a', dark: '#c65a17', belly: '#fff4e4', bellyLight: '#ffffff', feet: '#4a2f22' },
  mole: { base: '#5f5654', light: '#8e8381', dark: '#3c3534', belly: '#8f817c', bellyLight: '#a89a94', feet: '#f29bb0' },
  beaver: { base: '#9a5f33', light: '#c98c58', dark: '#6e4122', belly: '#e2bf93', bellyLight: '#f3dcbc', feet: '#5b3a22' },
  badger: { base: '#8f8a84', light: '#c2bdb6', dark: '#5f5a55', belly: '#d9d4cc', bellyLight: '#f4f1ec', feet: '#3b3836' },
};

/** Akzentfarbe je Tier für Ringe, Vorschau-Linien und UI. */
export const ANIMAL_COLORS: Record<AnimalId, number> = {
  fox: 0xef7d2d,
  mole: 0x7a6f8f,
  beaver: 0x9a5f33,
  badger: 0x5f6f7a,
};

function defs(id: AnimalId): string {
  const f = FUR[id];
  return `<defs>
    <radialGradient id="${id}-fur" cx="0.35" cy="0.3" r="0.85">
      <stop offset="0" stop-color="${f.light}"/><stop offset="0.55" stop-color="${f.base}"/><stop offset="1" stop-color="${f.dark}"/>
    </radialGradient>
    <radialGradient id="${id}-belly" cx="0.4" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${f.bellyLight}"/><stop offset="1" stop-color="${f.belly}"/>
    </radialGradient>
  </defs>`;
}

const eyes = (closed = false) =>
  closed
    ? `<path d="M49 51 q5 -4 10 0 M71 51 q5 -4 10 0" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="54" cy="50" rx="4.6" ry="5.4" fill="${O}"/><ellipse cx="78" cy="50" rx="4.6" ry="5.4" fill="${O}"/>
       <circle cx="55.6" cy="48" r="1.8" fill="#fff"/><circle cx="79.6" cy="48" r="1.8" fill="#fff"/>`;

const cheeks = `<circle cx="45" cy="62" r="5" fill="#ff8c8c" opacity="0.35"/><circle cx="88" cy="62" r="5" fill="#ff8c8c" opacity="0.35"/>`;

/** Körper, Füße und Arme – für alle Tiere gleich gebaut. */
function body(id: AnimalId): string {
  const f = FUR[id];
  return `
    <ellipse cx="50" cy="114" rx="11" ry="7" fill="${f.feet}" stroke="${O}" stroke-width="3"/>
    <ellipse cx="80" cy="114" rx="11" ry="7" fill="${f.feet}" stroke="${O}" stroke-width="3"/>
    <ellipse cx="64" cy="92" rx="27" ry="24" fill="url(#${id}-fur)" stroke="${O}" stroke-width="3"/>
    <ellipse cx="66" cy="97" rx="16" ry="15" fill="url(#${id}-belly)"/>`;
}

const arms = (id: AnimalId) => {
  const f = FUR[id];
  return `<ellipse cx="40" cy="95" rx="7" ry="11" transform="rotate(20 40 95)" fill="${f.dark}" stroke="${O}" stroke-width="3"/>
    <ellipse cx="89" cy="95" rx="7" ry="11" transform="rotate(-20 89 95)" fill="${f.dark}" stroke="${O}" stroke-width="3"/>`;
};

function head(id: AnimalId, inner: string): string {
  return `<ellipse cx="65" cy="52" rx="33" ry="29" fill="url(#${id}-fur)" stroke="${O}" stroke-width="3"/>${inner}`;
}

function fox(): string {
  return `
    <path d="M42 98 C22 104 6 90 8 70 C9 56 20 46 30 48 C24 60 30 74 44 84 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 58 C17 49 24 46 30 48 C26 54 25 59 26 64 C21 64 16 62 14 58 Z" fill="#fff4e4" stroke="${O}" stroke-width="2.5"/>
    ${body('fox')}
    <path d="M52 76 Q66 92 80 76 Q78 98 66 104 Q54 98 52 76 Z" fill="#fff4e4"/>
    ${arms('fox')}
    <path d="M38 36 L30 6 L58 26 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M94 36 L102 6 L74 26 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M38 30 L33 12 L50 26 Z" fill="${O}" opacity="0.85"/><path d="M94 30 L99 12 L82 26 Z" fill="${O}" opacity="0.85"/>
    ${head('fox', `
      <path d="M33 56 Q44 54 54 62 Q65 52 76 62 Q86 54 97 56 Q92 78 65 81 Q38 78 33 56 Z" fill="#fff4e4"/>
      ${eyes()}
      <ellipse cx="66" cy="62" rx="5.5" ry="4" fill="${O}"/>
      <path d="M60 68 q6 5 12 0" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      ${cheeks}`)}`;
}

function mole(): string {
  return `
    <path d="M40 104 q-10 2 -12 -6" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${body('mole')}
    <g stroke="${O}" stroke-width="3">
      <ellipse cx="35" cy="96" rx="12" ry="9" transform="rotate(25 35 96)" fill="#f6a9bb"/>
      <ellipse cx="94" cy="96" rx="12" ry="9" transform="rotate(-25 94 96)" fill="#f6a9bb"/>
    </g>
    <path d="M26 96 l-5 -3 M27 101 l-6 0 M30 105 l-4 3 M103 96 l5 -3 M102 101 l6 0 M99 105 l4 3" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>
    ${head('mole', `
      ${eyes(true)}
      <ellipse cx="66" cy="64" rx="13" ry="9" fill="#f6b4c2" stroke="${O}" stroke-width="2.5"/>
      <ellipse cx="66" cy="60" rx="6" ry="4.4" fill="#e9708f"/>
      <path d="M60 71 q6 4 12 0" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      ${cheeks}`)}
    <path d="M30 38 Q32 12 65 11 Q98 12 100 38 Z" fill="#f5c227" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 39 Q65 30 106 39 Q106 45 100 45 Q65 38 30 45 Q24 45 24 39 Z" fill="#e0a915" stroke="${O}" stroke-width="3"/>
    <rect x="58" y="14" width="14" height="24" rx="4" fill="#ff8a1f" stroke="${O}" stroke-width="2.5"/>
    <path d="M40 30 Q44 18 56 15" stroke="#fff6c8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>`;
}

function beaver(): string {
  const scales = [0, 1, 2, 3].map((i) => `<path d="M${10 + i * 8} 94 l6 18" stroke="#3b2a1f" stroke-width="1.8" opacity="0.6"/>`).join('');
  return `
    <ellipse cx="26" cy="104" rx="22" ry="11" transform="rotate(-18 26 104)" fill="#5b4636" stroke="${O}" stroke-width="3"/>
    ${scales}
    <path d="M10 100 l34 -8 M12 108 l32 -8" stroke="#3b2a1f" stroke-width="1.8" opacity="0.6"/>
    ${body('beaver')}
    ${arms('beaver')}
    <g transform="rotate(-35 96 92)">
      <rect x="93" y="70" width="7" height="34" rx="3" fill="#9aa3ab" stroke="${O}" stroke-width="2.5"/>
      <path d="M88 70 a8.5 8.5 0 1 1 17 0 l-4 0 l0 -5 l-9 0 l0 5 Z" fill="#c7cdd3" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    </g>
    <ellipse cx="89" cy="95" rx="7" ry="8" fill="#6e4122" stroke="${O}" stroke-width="3"/>
    <circle cx="38" cy="30" r="10" fill="url(#beaver-fur)" stroke="${O}" stroke-width="3"/>
    <circle cx="92" cy="30" r="10" fill="url(#beaver-fur)" stroke="${O}" stroke-width="3"/>
    <circle cx="38" cy="30" r="4.5" fill="#6e4122"/><circle cx="92" cy="30" r="4.5" fill="#6e4122"/>
    ${head('beaver', `
      <ellipse cx="66" cy="65" rx="17" ry="12" fill="#e6c39b" stroke="${O}" stroke-width="2.5"/>
      ${eyes()}
      <ellipse cx="66" cy="59" rx="6" ry="4.2" fill="${O}"/>
      <rect x="60" y="68" width="12" height="11" rx="2" fill="#fffaf0" stroke="${O}" stroke-width="2.5"/>
      <path d="M66 68 V79" stroke="${O}" stroke-width="2"/>
      ${cheeks}`)}`;
}

function badger(): string {
  return `
    <path d="M40 100 q-12 0 -14 -8" stroke="${O}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M40 100 q-12 0 -14 -8" stroke="#b9b3ac" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g transform="rotate(30 34 70)">
      <rect x="31" y="40" width="7" height="62" rx="3" fill="#a46a3a" stroke="${O}" stroke-width="2.5"/>
      <path d="M14 46 Q34 30 56 46 Q34 40 14 46 Z" fill="#9aa3ab" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    </g>
    ${body('badger')}
    <path d="M44 80 Q64 72 84 80 L82 90 Q64 84 46 90 Z" fill="#5f5a55" opacity="0.5"/>
    ${arms('badger')}
    <circle cx="38" cy="32" r="9" fill="#3b3836" stroke="${O}" stroke-width="3"/>
    <circle cx="92" cy="32" r="9" fill="#3b3836" stroke="${O}" stroke-width="3"/>
    <circle cx="38" cy="32" r="4" fill="#f4f1ec"/><circle cx="92" cy="32" r="4" fill="#f4f1ec"/>
    <ellipse cx="65" cy="52" rx="33" ry="29" fill="#f4f1ec" stroke="${O}" stroke-width="3"/>
    <path d="M40 30 Q50 26 56 38 Q60 52 58 66 Q50 64 46 54 Q40 42 40 30 Z" fill="#2f2c2a"/>
    <path d="M90 30 Q80 26 74 38 Q70 52 72 66 Q80 64 84 54 Q90 42 90 30 Z" fill="#2f2c2a"/>
    <path d="M36 52 Q34 70 50 78 L42 62 Z M94 52 Q96 70 80 78 L88 62 Z" fill="#8f8a84" opacity="0.6"/>
    <ellipse cx="54" cy="50" rx="4.4" ry="5" fill="#fff"/><ellipse cx="76" cy="50" rx="4.4" ry="5" fill="#fff"/>
    <ellipse cx="54.5" cy="50.5" rx="3" ry="3.6" fill="${O}"/><ellipse cx="75.5" cy="50.5" rx="3" ry="3.6" fill="${O}"/>
    <circle cx="55.5" cy="49" r="1.2" fill="#fff"/><circle cx="76.5" cy="49" r="1.2" fill="#fff"/>
    <ellipse cx="65" cy="66" rx="6" ry="4.4" fill="${O}"/>
    <path d="M59 72 q6 4 12 0" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    ${cheeks}`;
}

const DRAW: Record<AnimalId, () => string> = { fox, mole, beaver, badger };

export type AnimalVariant = 'full' | 'portrait';

/** Tierfigur als Inline-SVG. `portrait` zeigt nur Kopf und Schultern (für kleine Listen). */
export function animalSvg(id: AnimalId, label?: string, variant: AnimalVariant = 'full'): string {
  const title = label ? `<title>${label}</title>` : '';
  const viewBox = variant === 'portrait' ? '20 0 90 90' : '0 0 128 128';
  const shadow = variant === 'full' ? `<ellipse cx="64" cy="120" rx="40" ry="6" fill="${O}" opacity="0.18"/>` : '';
  return `<svg viewBox="${viewBox}" role="img" aria-label="${label ?? id}" class="animal-svg">${title}${defs(id)}${shadow}${DRAW[id]()}</svg>`;
}

/** Tierfigur als Data-URL (ohne Bodenschatten – den zeichnet das Spielfeld selbst). */
export function animalDataUrl(id: AnimalId): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${defs(id)}${DRAW[id]()}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
