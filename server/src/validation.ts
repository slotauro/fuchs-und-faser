import {
  ANIMAL_IDS,
  MAX_NAME_LENGTH,
  ROOM_CODE_LENGTH,
  type AnimalId,
  type Cell,
  type ClientAction,
} from '@fuf/shared';

const MAX_ROUTE_CELLS = 400;

export const isAnimal = (v: unknown): v is AnimalId =>
  typeof v === 'string' && (ANIMAL_IDS as string[]).includes(v);

export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return name.length > 0 ? name : null;
}

export function cleanCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const code = v.trim().toUpperCase();
  return new RegExp(`^[A-Z0-9]{${ROOM_CODE_LENGTH}}$`).test(code) ? code : null;
}

export function cleanCells(v: unknown): Cell[] | null {
  if (!Array.isArray(v) || v.length > MAX_ROUTE_CELLS) return null;
  const cells: Cell[] = [];
  for (const c of v) {
    if (!c || typeof c !== 'object') return null;
    const { x, y } = c as Record<string, unknown>;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    cells.push({ x: x as number, y: y as number });
  }
  return cells;
}

const cleanActionId = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null;

export function cleanAction(v: unknown): ClientAction | null {
  if (!v || typeof v !== 'object') return null;
  const raw = v as Record<string, unknown>;
  const actionId = cleanActionId(raw.actionId);
  if (!actionId) return null;
  switch (raw.type) {
    case 'buildRoute': {
      const cells = cleanCells(raw.cells);
      if (!cells) return null;
      return { type: 'buildRoute', actionId, cells };
    }
    case 'useScout':
      return { type: 'useScout', actionId };
    case 'forfeit':
      return { type: 'forfeit', actionId };
    default:
      return null;
  }
}
