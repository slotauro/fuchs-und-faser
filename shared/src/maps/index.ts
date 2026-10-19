import type { MapDef } from '../types';
import { map1 } from './map1-erstes-haus';
import { map2 } from './map2-wurzelallee';
import { map3 } from './map3-tierstadt';
import { map4 } from './map4-muehlbach';
import { map5 } from './map5-felsendorf';
import { parseMap } from './parseMap';

export const MAPS: MapDef[] = [map1, map2, map3, map4, map5].map(parseMap);

export function getMap(id: string): MapDef {
  const map = MAPS.find((m) => m.id === id);
  if (!map) throw new Error(`Unbekannte Karte: ${id}`);
  return map;
}

export function isMapId(id: unknown): id is string {
  return typeof id === 'string' && MAPS.some((m) => m.id === id);
}
