import type { MapSource } from './parseMap';

export const map4: MapSource = {
  id: 'muehlbach',
  name: 'Am Mühlbach',
  description:
    'Der Mühlbach teilt das Dorf. Drei Häuser warten – wer klug abzweigt, spart sich den langen Weg um das Wasser.',
  tips: [
    'Ohne Brücke führt der einzige Weg ans andere Ufer unten um den Bach herum.',
    'Der Biber kann an den beiden Querungsstellen eine Brücke bauen.',
    'Zweige weitere Routen von gebauten Leitungen ab, statt jedes Mal am Verteiler zu beginnen.',
    'Der Fuchs wittert ein verborgenes Leerrohr am Bachufer.',
  ],
  grid: [
    '..BB.....~~...BB',
    '..BA.....~~...AB',
    '%%%%%%...bb.....',
    '.....%...~~.....',
    '.D.......~~..^^.',
    '.........~~..^^.',
    '.........bb.....',
    '..===...?~~.....',
    '..^^....?~~.BB..',
    '........?...AB..',
  ],
  buildingNames: ['Mühle Otter', 'Haus Reiher', 'Hof Eichhorn'],
  budget: 46,
  timeLimitSec: 300,
  stars: { two: 39, three: 35 },
  parCost: 39,
};
