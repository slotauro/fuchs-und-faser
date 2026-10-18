/** Gemeinsame Farbwelt für Gelände (Canvas), Spielfeld (Phaser) und UI (CSS-Variablen in style.css). */
export const PALETTE = {
  outline: '#3b2f25',
  cream: '#fffaf0',
  forest: '#2f5d3a',
  fiber: '#ff8a1f',
  fiberDeep: '#d8590b',
  fiberGlow: '#ffd29a',
  bad: '#d64534',
  ok: '#3f9a52',

  meadow: ['#8fc75a', '#86c053', '#98cd63'],
  meadowDark: '#6fa844',
  meadowLight: '#b5dd7f',
  flowers: ['#fff6e0', '#ffd54d', '#f59bb6', '#c9a7ff'],

  soil: '#8a6239',
  soilDark: '#5e3f22',
  root: '#6b4423',
  rootLight: '#9a6a3c',

  paving: '#e3dac6',
  pavingDark: '#c4b89e',
  asphalt: '#5b5f66',
  asphaltDark: '#474a50',
  curb: '#d8d2c4',
  marking: '#f7f1dd',

  stone: '#b9b0a2',
  stoneLight: '#d8d0c2',
  stoneDark: '#7e7468',
  moss: '#7da350',

  water: '#4fa6c9',
  waterDeep: '#3485a8',
  foam: '#e6f6fb',
  plank: '#c99556',
  plankDark: '#8e6332',

  conduit: '#8d949c',
  conduitLight: '#d9dee3',
  warnRed: '#d9412f',
  warnWhite: '#fbf6ec',
} as const;

/** CSS-Farbe → Phaser-Zahl. */
export const hex = (css: string): number => parseInt(css.slice(1), 16);
