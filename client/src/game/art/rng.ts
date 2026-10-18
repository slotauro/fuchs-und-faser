/** Kleiner deterministischer Zufallsgenerator (mulberry32), damit die Welt bei jedem Laden gleich aussieht. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Zufallsfolge für eine Zelle einer Karte (auch für Randzellen mit negativen Koordinaten). */
export function cellRng(mapId: string, x: number, y: number): () => number {
  return mulberry32(hashString(`${mapId}:${x}:${y}`));
}
