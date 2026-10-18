import type { MapSource } from './parseMap';

export const map1: MapSource = {
  id: 'erstes-haus',
  name: 'Das erste Haus',
  description: 'Dein erster Auftrag: Verbinde den Netzverteiler mit dem Hausanschluss.',
  tips: [
    'Bewege dein Tier mit den Pfeiltasten vom Netzverteiler los – hinter ihm entsteht die Leitung.',
    'Ein Schritt zurück nimmt das letzte Feld wieder weg. Alternativ: Felder anklicken oder ziehen.',
    'Felsen sind teuer. Manchmal ist der Umweg günstiger als der direkte Weg.',
  ],
  grid: [
    '..............',
    '..............',
    '...^^.....BB..',
    '.D.^^.....BB..',
    '...^^......A..',
    '..............',
    '==============',
    '..............',
    '..............',
  ],
  buildingNames: ['Haus Igel'],
  budget: 22,
  timeLimitSec: 180,
  stars: { two: 17, three: 15 },
  parCost: 15,
};
