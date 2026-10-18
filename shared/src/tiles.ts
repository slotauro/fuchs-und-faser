import type { Cell, HalfPoints, TileType } from './types';

export interface TileInfo {
  label: string;
  /** Baukosten pro Kachel in halben Punkten; `null` = ohne Fähigkeit nicht bebaubar. */
  cost: HalfPoints | null;
  /** Kurze Erklärung, warum hier nicht gebaut werden kann. */
  blockedMessage?: string;
  description: string;
}

export const TILE_INFO: Record<TileType, TileInfo> = {
  meadow: { label: 'Wiese', cost: 2, description: 'Normaler Baugrund' },
  sidewalk: { label: 'Gehweg', cost: 2, description: 'Bau entlang des Gehwegs' },
  road: { label: 'Straße', cost: 8, description: 'Querung mit erhöhten Kosten' },
  rock: { label: 'Felsen', cost: 6, description: 'Schwieriger Untergrund, teuer' },
  roots: {
    label: 'Wurzelzone',
    cost: null,
    blockedMessage: 'Wurzelzone – Umweg oder Maulwurfstunnel nötig',
    description: 'Natürliches Hindernis',
  },
  water: {
    label: 'Wasser',
    cost: null,
    blockedMessage: 'Wasser – hier ist keine Querung möglich',
    description: 'Nicht bebaubar',
  },
  bridgeSite: {
    label: 'Querungsstelle',
    cost: null,
    blockedMessage: 'Wasser – nur der Biber kann hier einen Übergang bauen',
    description: 'Wasser mit vorgesehener Querung',
  },
  conduit: { label: 'Leerrohr', cost: 1, description: 'Vorhandene Infrastruktur, sehr günstig' },
  hiddenConduit: { label: 'Wiese', cost: 2, description: 'Normaler Baugrund' },
  foreignLine: {
    label: 'Fremdleitung',
    cost: null,
    blockedMessage: 'Fremdleitung – hier darf nicht gegraben werden',
    description: 'Bestehende Leitung eines anderen Netzes',
  },
  distributor: {
    label: 'Netzverteiler',
    cost: null,
    blockedMessage: 'Der Netzverteiler ist bereits Teil des Netzes',
    description: 'Startpunkt des Glasfasernetzes',
  },
  building: {
    label: 'Gebäude',
    cost: null,
    blockedMessage: 'Gebäude – die Leitung muss am Hausanschlusspunkt enden',
    description: 'Anschlussziel',
  },
  connection: {
    label: 'Hausanschluss',
    cost: 6,
    description: 'Zielpunkt, Anschluss kostet pauschal 3 Punkte',
  },
};

/** Aufgedecktes verborgenes Leerrohr verhält sich wie ein normales Leerrohr. */
export function effectiveTile(tile: TileType, scoutRevealed: boolean): TileType {
  return tile === 'hiddenConduit' && scoutRevealed ? 'conduit' : tile;
}

export const cellKey = (c: Cell): string => `${c.x},${c.y}`;

export function parseCellKey(key: string): Cell {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export const isAdjacent = (a: Cell, b: Cell): boolean =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

export function neighbors(c: Cell, width: number, height: number): Cell[] {
  const result: Cell[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = c.x + dx;
    const y = c.y + dy;
    if (x >= 0 && y >= 0 && x < width && y < height) result.push({ x, y });
  }
  return result;
}

/** Halbe Punkte als deutsch formatierte Punktzahl, z. B. 7 -> "3,5". */
export function formatPoints(half: HalfPoints): string {
  return (half / 2).toLocaleString('de-DE', { maximumFractionDigits: 1 });
}
