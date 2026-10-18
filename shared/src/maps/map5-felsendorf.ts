import type { MapSource } from './parseMap';

export const map5: MapSource = {
  id: 'felsendorf',
  name: 'Das Felsendorf',
  description:
    'Vier Gebäude zwischen Felsen, einer Straße und einer Fremdleitung. Nur mit einem gut verzweigten Netz reicht das Budget.',
  tips: [
    'Die Straße hat Lücken – dort ist die Querung günstig.',
    'An der Fremdleitung (rot-weiße Absperrung) darf nicht gegraben werden. Das Trafohaus erreichst du nur von unten.',
    'Felsen sind teuer – außer für den Dachs. Und der Fuchs ahnt alte Leerrohre unter der Wiese im Süden.',
  ],
  grid: [
    'BB....^^^....BB.',
    'AB....^^^....BA.',
    '......^^^.......',
    '####.######.####',
    '................',
    '.D..xxxx...%%...',
    '....xBBx...%%.BB',
    '..^^xABx^^.%%.AB',
    '..^^.???????^^..',
    '..====....====..',
  ],
  buildingNames: ['Haus Gams', 'Hütte Murmel', 'Trafohaus', 'Laden Luchs'],
  budget: 56,
  timeLimitSec: 360,
  stars: { two: 48, three: 44 },
  parCost: 48,
};
