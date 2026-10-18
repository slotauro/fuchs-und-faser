import type { MapSource } from './parseMap';

export const map3: MapSource = {
  id: 'tierstadt',
  name: 'Die kleine Tierstadt',
  description:
    'Drei Gebäude, eine Straße und eine alte Leerrohrtrasse. Ideal, um gemeinsam zu bauen.',
  tips: [
    'Gebaute Leitungen gehören zum Netz – weitere Routen können dort abzweigen.',
    'Die Leerrohrtrasse am Gehweg kostet nur 0,5 Punkte pro Kachel.',
    'Die Straße zu queren ist teuer. Plant, wo ihr sie nur einmal quert.',
  ],
  grid: [
    '....BB.....BB...',
    '....BA.....AB...',
    '................',
    '==oooooooooooo==',
    '################',
    '================',
    '..^^.......%%%%%',
    '.D.^.......%%.BB',
    '...........%%.AB',
    '..??????????..x.',
  ],
  buildingNames: ['Bäckerei Hase', 'Schule Specht', 'Haus Dachsbau'],
  budget: 40,
  timeLimitSec: 240,
  stars: { two: 36, three: 32 },
  parCost: 36,
};
