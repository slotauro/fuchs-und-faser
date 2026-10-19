import type { MapSource } from './parseMap';

export const map2: MapSource = {
  id: 'wurzelallee',
  name: 'Die Wurzelallee',
  description:
    'Alte Bäume und ein Bach trennen das Haus vom Netz. Jedes Tier findet hier seinen eigenen Weg.',
  tips: [
    'Wurzelzonen und Wasser sind ohne Fähigkeit nicht bebaubar.',
    'Maulwurf und Biber setzen ihre Fähigkeit direkt vor Wurzeln bzw. Wasser ein, der Dachs braucht keine Aktivierung.',
    'Der Fuchs ahnt: Unter der Wiese im Süden liegt vielleicht ein altes Leerrohr.',
  ],
  grid: [
    '.......~~.......',
    '.......~~.......',
    '.......~~.....BB',
    '.......bb.....BB',
    '.D.....%%.....A.',
    '.......%%.......',
    '.......^^.......',
    '.......%%.......',
    '..=====%%.......',
    '..?????????????.',
  ],
  buildingNames: ['Haus Eule'],
  budget: 26,
  timeLimitSec: 240,
  stars: { two: 23, three: 18.5 },
  parCost: 23,
};
