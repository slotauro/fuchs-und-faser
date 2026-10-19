import type { AnimalId } from '@fuf/shared';

/**
 * Die vier Tierfiguren als Vektorgrafik. Alle teilen dieselben Proportionen (großer Kopf,
 * kompakter Körper), dieselbe Kontur und Licht von oben links. Jede Figur gibt es in drei
 * Ansichten: von vorne (leicht nach rechts gedreht), von der Seite (Blick nach rechts; nach links
 * spiegelt das Spielfeld) und von hinten. Für die Laufanimation hat jede Ansicht zwei Schritt-Posen.
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

export type AnimalView = 'front' | 'side' | 'back';
/** `stand` im Stillstand; `stepA`/`stepB` wechseln sich beim Laufen ab. */
export type AnimalPose = 'stand' | 'stepA' | 'stepB';

export const ANIMAL_VIEWS: AnimalView[] = ['front', 'side', 'back'];
export const ANIMAL_POSES: AnimalPose[] = ['stand', 'stepA', 'stepB'];

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

interface Foot {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

const foot = (fill: string, { x, y, rx, ry }: Foot) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${O}" stroke-width="3"/>`;

// ---------------------------------------------------------------- Frontansicht

/** Füße von vorne: beim Schritt hebt sich abwechselnd ein Fuß. */
function frontFeet(pose: AnimalPose): [Foot, Foot] {
  const down = (x: number): Foot => ({ x, y: 114, rx: 11, ry: 7 });
  const up = (x: number): Foot => ({ x, y: 108, rx: 10, ry: 6 });
  if (pose === 'stepA') return [up(51), down(80)];
  if (pose === 'stepB') return [down(50), up(79)];
  return [down(50), down(80)];
}

/** Armwinkel von vorne (links, rechts); die Arme schwingen gegengleich zu den Füßen. */
const FRONT_ARMS: Record<AnimalPose, [number, number]> = { stand: [20, -20], stepA: [8, -32], stepB: [32, -8] };

/** Körper, Füße und Arme – für alle Tiere gleich gebaut. */
function body(id: AnimalId, pose: AnimalPose): string {
  const f = FUR[id];
  const [left, right] = frontFeet(pose);
  return `
    ${foot(f.feet, left)}
    ${foot(f.feet, right)}
    <ellipse cx="64" cy="92" rx="27" ry="24" fill="url(#${id}-fur)" stroke="${O}" stroke-width="3"/>
    <ellipse cx="66" cy="97" rx="16" ry="15" fill="url(#${id}-belly)"/>`;
}

const arms = (id: AnimalId, pose: AnimalPose) => {
  const f = FUR[id];
  const [l, r] = FRONT_ARMS[pose];
  return `<ellipse cx="40" cy="95" rx="7" ry="11" transform="rotate(${l} 40 95)" fill="${f.dark}" stroke="${O}" stroke-width="3"/>
    <ellipse cx="89" cy="95" rx="7" ry="11" transform="rotate(${r} 89 95)" fill="${f.dark}" stroke="${O}" stroke-width="3"/>`;
};

function head(id: AnimalId, inner: string): string {
  return `<ellipse cx="65" cy="52" rx="33" ry="29" fill="url(#${id}-fur)" stroke="${O}" stroke-width="3"/>${inner}`;
}

function fox(pose: AnimalPose): string {
  return `
    <path d="M42 98 C22 104 6 90 8 70 C9 56 20 46 30 48 C24 60 30 74 44 84 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 58 C17 49 24 46 30 48 C26 54 25 59 26 64 C21 64 16 62 14 58 Z" fill="#fff4e4" stroke="${O}" stroke-width="2.5"/>
    ${body('fox', pose)}
    <path d="M52 76 Q66 92 80 76 Q78 98 66 104 Q54 98 52 76 Z" fill="#fff4e4"/>
    ${arms('fox', pose)}
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

function mole(pose: AnimalPose): string {
  // Grabschaufeln wippen beim Laufen gegengleich auf und ab
  const [l, r] = pose === 'stepA' ? [-4, 4] : pose === 'stepB' ? [4, -4] : [0, 0];
  return `
    <path d="M40 104 q-10 2 -12 -6" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${body('mole', pose)}
    <g stroke="${O}" stroke-width="3">
      <ellipse cx="35" cy="${96 + l}" rx="12" ry="9" transform="rotate(25 35 ${96 + l})" fill="#f6a9bb"/>
      <ellipse cx="94" cy="${96 + r}" rx="12" ry="9" transform="rotate(-25 94 ${96 + r})" fill="#f6a9bb"/>
    </g>
    <path d="M26 ${96 + l} l-5 -3 M27 ${101 + l} l-6 0 M30 ${105 + l} l-4 3 M103 ${96 + r} l5 -3 M102 ${101 + r} l6 0 M99 ${105 + r} l4 3" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>
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

/** Schraubenschlüssel des Bibers (Griff unten, Maul oben), um `pivot` gedreht und danach um (dx, dy) verschoben. */
const wrench = (angle: number, pivotX: number, pivotY: number, dx = 0, dy = 0) => `
    <g transform="translate(${dx} ${dy}) rotate(${angle} ${pivotX} ${pivotY})">
      <rect x="93" y="70" width="7" height="34" rx="3" fill="#9aa3ab" stroke="${O}" stroke-width="2.5"/>
      <path d="M88 70 a8.5 8.5 0 1 1 17 0 l-4 0 l0 -5 l-9 0 l0 5 Z" fill="#c7cdd3" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    </g>`;

function beaver(pose: AnimalPose): string {
  const scales = [0, 1, 2, 3].map((i) => `<path d="M${10 + i * 8} 94 l6 18" stroke="#3b2a1f" stroke-width="1.8" opacity="0.6"/>`).join('');
  return `
    <ellipse cx="26" cy="104" rx="22" ry="11" transform="rotate(-18 26 104)" fill="#5b4636" stroke="${O}" stroke-width="3"/>
    ${scales}
    <path d="M10 100 l34 -8 M12 108 l32 -8" stroke="#3b2a1f" stroke-width="1.8" opacity="0.6"/>
    ${body('beaver', pose)}
    ${arms('beaver', pose)}
    ${wrench(-35, 96, 92)}
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

/** Spitzhacke des Dachses (Stiel mit Metallkopf), um `pivot` gedreht. */
const pickaxe = (angle: number, pivotX: number, pivotY: number) => `
    <g transform="rotate(${angle} ${pivotX} ${pivotY})">
      <rect x="31" y="40" width="7" height="62" rx="3" fill="#a46a3a" stroke="${O}" stroke-width="2.5"/>
      <path d="M14 46 Q34 30 56 46 Q34 40 14 46 Z" fill="#9aa3ab" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    </g>`;

function badger(pose: AnimalPose): string {
  return `
    <path d="M40 100 q-12 0 -14 -8" stroke="${O}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M40 100 q-12 0 -14 -8" stroke="#b9b3ac" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${pickaxe(30, 34, 70)}
    ${body('badger', pose)}
    <path d="M44 80 Q64 72 84 80 L82 90 Q64 84 46 90 Z" fill="#5f5a55" opacity="0.5"/>
    ${arms('badger', pose)}
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

// ---------------------------------------------------------------- Seitenansicht (Blick nach rechts)

/** Hinterer und vorderer Fuß im Profil; beim Schritt greift ein Fuß nach vorne, der andere hebt hinten ab. */
function sideFeet(pose: AnimalPose): [Foot, Foot] {
  const down = (x: number): Foot => ({ x, y: 114, rx: 12, ry: 6.5 });
  const up = (x: number): Foot => ({ x, y: 109, rx: 11, ry: 6 });
  if (pose === 'stepA') return [up(44), down(80)];
  if (pose === 'stepB') return [down(76), up(48)];
  return [down(54), down(72)];
}

/** Schwung des sichtbaren Arms (Drehung um die Schulter, negativ = nach vorne). */
const SIDE_SWING: Record<AnimalPose, number> = { stand: -6, stepA: 26, stepB: -30 };

const SHOULDER = { x: 64, y: 84 };

/** Körper im Profil mit hinterem Fuß (abgedunkelt), vorderem Fuß und Bauch nach rechts. */
function sideBody(id: AnimalId, pose: AnimalPose, belly = true): string {
  const f = FUR[id];
  const [back, front] = sideFeet(pose);
  return `
    ${foot(f.feet, back)}<ellipse cx="${back.x}" cy="${back.y}" rx="${back.rx}" ry="${back.ry}" fill="${O}" opacity="0.25"/>
    <ellipse cx="62" cy="92" rx="24" ry="23" fill="url(#${id}-fur)" stroke="${O}" stroke-width="3"/>
    ${belly ? `<ellipse cx="72" cy="97" rx="11" ry="14" fill="url(#${id}-belly)"/>` : ''}
    ${foot(f.feet, front)}`;
}

/** Sichtbarer Arm im Profil, optional mit Werkzeug in der Pfote. */
function sideArm(id: AnimalId, pose: AnimalPose, tool = ''): string {
  const f = FUR[id];
  return `<g transform="rotate(${SIDE_SWING[pose]} ${SHOULDER.x} ${SHOULDER.y})">
      ${tool}
      <ellipse cx="${SHOULDER.x}" cy="${SHOULDER.y + 11}" rx="7" ry="12" fill="${f.dark}" stroke="${O}" stroke-width="3"/>
    </g>`;
}

function sideHead(id: AnimalId, inner: string, fill = `url(#${id}-fur)`): string {
  return `<ellipse cx="64" cy="52" rx="29" ry="27" fill="${fill}" stroke="${O}" stroke-width="3"/>${inner}`;
}

const sideEye = (x = 80, y = 48) =>
  `<ellipse cx="${x}" cy="${y}" rx="4.4" ry="5.4" fill="${O}"/><circle cx="${x + 1.6}" cy="${y - 2}" r="1.8" fill="#fff"/>`;

const sideCheek = `<circle cx="74" cy="62" r="5" fill="#ff8c8c" opacity="0.35"/>`;

/**
 * Schnauze im Profil: Fläche ohne Kontur (überdeckt die Kopfkontur), dazu nur die äußere Kontur,
 * damit sie nahtlos aus dem Kopf wächst.
 */
const snout = (fillPath: string, edgePath: string, fill: string) =>
  `<path d="${fillPath}" fill="${fill}"/><path d="${edgePath}" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

function foxSide(pose: AnimalPose): string {
  return `
    <path d="M42 100 C20 108 4 94 6 74 C7 60 18 50 28 52 C22 64 28 78 44 86 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M10 62 C13 53 20 50 28 52 C24 58 23 63 24 68 C18 68 13 66 10 62 Z" fill="#fff4e4" stroke="${O}" stroke-width="2.5"/>
    ${sideBody('fox', pose, false)}
    <path d="M70 74 Q86 84 84 98 Q80 108 70 110 Q74 94 70 74 Z" fill="#fff4e4"/>
    ${sideArm('fox', pose)}
    <path d="M60 30 L64 4 L80 26 Z" fill="#c65a17" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M42 34 L38 4 L62 26 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M44 28 L41 12 L55 25 Z" fill="${O}" opacity="0.85"/>
    ${sideHead('fox', `
      <path d="M40 66 Q58 78 86 66 Q80 80 62 80 Q46 78 40 66 Z" fill="#fff4e4"/>
      ${snout('M82 40 Q100 48 112 58 Q106 68 84 68 Z', 'M90 42 Q102 49 112 58 Q106 67 88 66', 'url(#fox-fur)')}
      <path d="M86 66 Q100 67 110 61 Q104 71 88 72 Z" fill="#fff4e4"/>
      <ellipse cx="111" cy="58" rx="4.5" ry="3.6" fill="${O}"/>
      <path d="M100 68 q-5 3 -9 0" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      ${sideEye()}
      ${sideCheek}`)}`;
}

function moleSide(pose: AnimalPose): string {
  const paw = `<ellipse cx="${SHOULDER.x + 4}" cy="${SHOULDER.y + 22}" rx="12" ry="9" transform="rotate(-20 ${SHOULDER.x + 4} ${SHOULDER.y + 22})" fill="#f6a9bb" stroke="${O}" stroke-width="3"/>
      <path d="M78 ${SHOULDER.y + 16} l5 -3 M80 ${SHOULDER.y + 21} l6 0 M78 ${SHOULDER.y + 26} l4 3" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>`;
  return `
    <path d="M40 104 q-10 2 -12 -6" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${sideBody('mole', pose)}
    <g transform="rotate(${SIDE_SWING[pose]} ${SHOULDER.x} ${SHOULDER.y})">
      <ellipse cx="${SHOULDER.x}" cy="${SHOULDER.y + 10}" rx="7" ry="11" fill="#3c3534" stroke="${O}" stroke-width="3"/>
      ${paw}
    </g>
    ${sideHead('mole', `
      ${snout('M82 52 Q102 52 110 60 Q104 72 84 72 Z', 'M88 52 Q102 52 110 60 Q104 72 86 72', '#f6b4c2')}
      <ellipse cx="108" cy="60" rx="4.5" ry="4" fill="#e9708f"/>
      <path d="M98 74 q-5 3 -9 0" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M74 50 q5 -4 10 0" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${sideCheek}`)}
    <path d="M36 38 Q38 12 66 11 Q92 12 96 36 Z" fill="#f5c227" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M28 40 Q66 31 104 37 Q106 43 100 44 Q66 38 34 46 Q28 46 28 40 Z" fill="#e0a915" stroke="${O}" stroke-width="3"/>
    <rect x="86" y="16" width="12" height="20" rx="4" transform="rotate(20 92 26)" fill="#ff8a1f" stroke="${O}" stroke-width="2.5"/>
    <path d="M44 30 Q48 18 60 15" stroke="#fff6c8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>`;
}

function beaverSide(pose: AnimalPose): string {
  const scales = [0, 1, 2, 3].map((i) => `<path d="M${8 + i * 8} 98 l5 16" stroke="#3b2a1f" stroke-width="1.8" opacity="0.6"/>`).join('');
  // Schlüssel liegt in der Pfote am Armende und zeigt nach vorne oben
  const tool = wrench(30, 96, 92, -30, 12);
  return `
    <ellipse cx="24" cy="106" rx="22" ry="9" transform="rotate(-12 24 106)" fill="#5b4636" stroke="${O}" stroke-width="3"/>
    ${scales}
    <path d="M6 104 l36 -6" stroke="#3b2a1f" stroke-width="1.8" opacity="0.6"/>
    ${sideBody('beaver', pose)}
    ${sideArm('beaver', pose, tool)}
    <circle cx="50" cy="30" r="10" fill="url(#beaver-fur)" stroke="${O}" stroke-width="3"/>
    <circle cx="50" cy="30" r="4.5" fill="#6e4122"/>
    ${sideHead('beaver', `
      ${snout('M80 46 Q104 48 108 60 Q106 74 84 74 Z', 'M90 47 Q104 50 108 60 Q106 74 86 74', '#e6c39b')}
      <ellipse cx="106" cy="55" rx="5" ry="4" fill="${O}"/>
      <rect x="94" y="72" width="9" height="10" rx="2" fill="#fffaf0" stroke="${O}" stroke-width="2.5"/>
      ${sideEye(78, 46)}
      ${sideCheek}`)}`;
}

function badgerSide(pose: AnimalPose): string {
  return `
    <path d="M40 100 q-12 0 -14 -8" stroke="${O}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M40 100 q-12 0 -14 -8" stroke="#b9b3ac" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${pickaxe(24, 34, 70)}
    ${sideBody('badger', pose)}
    <path d="M44 78 Q60 72 80 76 L80 86 Q62 82 46 88 Z" fill="#5f5a55" opacity="0.5"/>
    ${sideArm('badger', pose)}
    <circle cx="50" cy="32" r="9" fill="#3b3836" stroke="${O}" stroke-width="3"/>
    <circle cx="50" cy="32" r="4" fill="#f4f1ec"/>
    ${sideHead('badger', `
      ${snout('M82 44 Q102 50 110 60 Q104 70 84 70 Z', 'M90 45 Q102 50 110 60 Q104 69 88 68', '#f4f1ec')}
      <path d="M38 40 Q52 30 72 36 Q92 42 108 56 Q96 58 86 56 Q74 56 66 58 Q50 60 40 54 Z" fill="#2f2c2a"/>
      <path d="M42 62 Q56 76 80 70 Q70 80 54 78 Z" fill="#8f8a84" opacity="0.6"/>
      <ellipse cx="80" cy="48" rx="4.4" ry="5" fill="#fff"/>
      <ellipse cx="81" cy="48.5" rx="3" ry="3.6" fill="${O}"/><circle cx="82" cy="47" r="1.2" fill="#fff"/>
      <ellipse cx="109" cy="60" rx="4.5" ry="3.6" fill="${O}"/>
      <path d="M100 68 q-5 3 -9 0" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      ${sideCheek}`, '#f4f1ec')}`;
}

// ---------------------------------------------------------------- Rückansicht

/** Rücken, Arme und Fußsohlen von hinten; beim Schritt hebt sich abwechselnd eine Sohle. */
function backBody(id: AnimalId, pose: AnimalPose): string {
  const f = FUR[id];
  const [left, right] = frontFeet(pose);
  const [l, r] = FRONT_ARMS[pose === 'stepA' ? 'stepB' : pose === 'stepB' ? 'stepA' : 'stand'];
  const sole = (p: Foot) => `${foot(f.feet, p)}<ellipse cx="${p.x}" cy="${p.y + 1}" rx="${p.rx * 0.5}" ry="${p.ry * 0.5}" fill="#fff" opacity="0.25"/>`;
  return `
    ${sole(left)}
    ${sole(right)}
    <ellipse cx="40" cy="95" rx="7" ry="11" transform="rotate(${l} 40 95)" fill="${f.dark}" stroke="${O}" stroke-width="3"/>
    <ellipse cx="89" cy="95" rx="7" ry="11" transform="rotate(${r} 89 95)" fill="${f.dark}" stroke="${O}" stroke-width="3"/>
    <ellipse cx="64" cy="92" rx="27" ry="24" fill="url(#${id}-fur)" stroke="${O}" stroke-width="3"/>
    <path d="M44 80 Q64 90 84 80" stroke="${O}" stroke-width="2" fill="none" opacity="0.25"/>`;
}

/** Hinterkopf ohne Gesicht, mit dunklerem Nacken. */
function backHead(id: AnimalId, fill = `url(#${id}-fur)`): string {
  return `<ellipse cx="65" cy="52" rx="33" ry="29" fill="${fill}" stroke="${O}" stroke-width="3"/>
    <path d="M40 68 Q65 86 90 68 Q82 79 65 80 Q48 79 40 68 Z" fill="${FUR[id].dark}" opacity="0.3"/>`;
}

function foxBack(pose: AnimalPose): string {
  return `
    ${backBody('fox', pose)}
    <path d="M38 36 L30 6 L58 26 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M94 36 L102 6 L74 26 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 12 L30 6 L38 12 Z M100 12 L102 6 L94 12 Z" fill="${O}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    ${backHead('fox')}
    <path d="M62 106 C58 124 94 124 106 100 C114 84 106 68 94 68 C100 82 94 98 76 100 Z" fill="url(#fox-fur)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M94 68 C104 66 112 76 110 88 C106 86 102 84 100 84 C101 78 99 72 94 68 Z" fill="#fff4e4" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`;
}

function moleBack(pose: AnimalPose): string {
  const [l, r] = pose === 'stepA' ? [4, -4] : pose === 'stepB' ? [-4, 4] : [0, 0];
  return `
    ${backBody('mole', pose)}
    <g stroke="${O}" stroke-width="3">
      <ellipse cx="34" cy="${96 + l}" rx="11" ry="8" transform="rotate(25 34 ${96 + l})" fill="#f6a9bb"/>
      <ellipse cx="95" cy="${96 + r}" rx="11" ry="8" transform="rotate(-25 95 ${96 + r})" fill="#f6a9bb"/>
    </g>
    <path d="M64 108 q4 8 -2 12" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${backHead('mole')}
    <path d="M30 38 Q32 12 65 11 Q98 12 100 38 Z" fill="#f5c227" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 39 Q65 30 106 39 Q106 45 100 45 Q65 38 30 45 Q24 45 24 39 Z" fill="#e0a915" stroke="${O}" stroke-width="3"/>
    <path d="M65 12 V38" stroke="#e0a915" stroke-width="5"/>
    <path d="M32 44 Q65 62 98 44" stroke="#3b3836" stroke-width="3" fill="none" opacity="0.8"/>
    <path d="M40 30 Q44 18 56 15" stroke="#fff6c8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>`;
}

function beaverBack(pose: AnimalPose): string {
  const scales = [0, 1, 2].map((i) => `<path d="M${54 + i * 10} 98 V124" stroke="#3b2a1f" stroke-width="1.8" opacity="0.6"/>`).join('');
  return `
    ${wrench(-35, 96, 92, -56, 2)}
    ${backBody('beaver', pose)}
    <ellipse cx="40" cy="95" rx="7" ry="8" fill="#6e4122" stroke="${O}" stroke-width="3"/>
    <circle cx="38" cy="30" r="10" fill="url(#beaver-fur)" stroke="${O}" stroke-width="3"/>
    <circle cx="92" cy="30" r="10" fill="url(#beaver-fur)" stroke="${O}" stroke-width="3"/>
    ${backHead('beaver')}
    <ellipse cx="64" cy="110" rx="17" ry="14" fill="#5b4636" stroke="${O}" stroke-width="3"/>
    <g clip-path="url(#beaver-tail)">${scales}<path d="M46 106 H82 M46 114 H82" stroke="#3b2a1f" stroke-width="1.8" opacity="0.6"/></g>
    <clipPath id="beaver-tail"><ellipse cx="64" cy="110" rx="15" ry="12"/></clipPath>`;
}

function badgerBack(pose: AnimalPose): string {
  return `
    ${backBody('badger', pose)}
    ${pickaxe(-40, 34, 70)}
    <path d="M64 108 q-4 8 2 12" stroke="${O}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M64 108 q-4 8 2 12" stroke="#b9b3ac" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="38" cy="32" r="9" fill="#3b3836" stroke="${O}" stroke-width="3"/>
    <circle cx="92" cy="32" r="9" fill="#3b3836" stroke="${O}" stroke-width="3"/>
    ${backHead('badger', '#f4f1ec')}
    <path d="M44 28 Q52 24 56 34 Q58 56 54 78 Q46 72 42 56 Q40 40 44 28 Z" fill="#2f2c2a"/>
    <path d="M86 28 Q78 24 74 34 Q72 56 76 78 Q84 72 88 56 Q90 40 86 28 Z" fill="#2f2c2a"/>`;
}

type Draw = (pose: AnimalPose) => string;

const DRAW: Record<AnimalId, Record<AnimalView, Draw>> = {
  fox: { front: fox, side: foxSide, back: foxBack },
  mole: { front: mole, side: moleSide, back: moleBack },
  beaver: { front: beaver, side: beaverSide, back: beaverBack },
  badger: { front: badger, side: badgerSide, back: badgerBack },
};

export type AnimalVariant = 'full' | 'portrait';

/** Tierfigur als Inline-SVG. `portrait` zeigt nur Kopf und Schultern (für kleine Listen). */
export function animalSvg(id: AnimalId, label?: string, variant: AnimalVariant = 'full'): string {
  const title = label ? `<title>${label}</title>` : '';
  const viewBox = variant === 'portrait' ? '20 0 90 90' : '0 0 128 128';
  const shadow = variant === 'full' ? `<ellipse cx="64" cy="120" rx="40" ry="6" fill="${O}" opacity="0.18"/>` : '';
  return `<svg viewBox="${viewBox}" role="img" aria-label="${label ?? id}" class="animal-svg">${title}${defs(id)}${shadow}${DRAW[id].front('stand')}</svg>`;
}

/** Tierfigur als Data-URL (ohne Bodenschatten – den zeichnet das Spielfeld selbst). */
export function animalDataUrl(id: AnimalId, view: AnimalView = 'front', pose: AnimalPose = 'stand'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${defs(id)}${DRAW[id][view](pose)}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
