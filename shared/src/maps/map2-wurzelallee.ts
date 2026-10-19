import type { MapSource } from './parseMap';

export const map2: MapSource = {
  id: 'wurzelallee',
  name: 'Die Wurzelallee',
  description:
    'Alte Bäume und ein Bach trennen das Haus vom Netz. Jedes Tier findet hier seinen eigenen Weg.',
  tips: [
    'Wurzelzonen und Wasser sind ohne Fähigkeit nicht bebaubar.',
    'Maulwurf, Biber und Dachs brauchen keine Aktivierung: Ihre Fähigkeit wirkt automatisch in der ersten passenden Route.',
    'Der Fuchs ahnt: Unter der Wiese im Süden liegt vielleicht ein altes Leerrohr.',
  ],
  grid: [
    '.......~~.......',
    '.......~~.......',
    '.......~~.......',
    '.......bb.....BB',
    '.D.....%%.....AB',
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
