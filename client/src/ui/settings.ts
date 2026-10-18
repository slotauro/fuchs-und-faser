import { MAX_NAME_LENGTH } from '@fuf/shared';

export interface Settings {
  name: string;
  reduceMotion: boolean;
  showTips: boolean;
}

const KEY = 'fuf-settings';
const DEFAULTS: Settings = { name: '', reduceMotion: false, showTips: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Speicher nicht verfügbar – Standardwerte verwenden.
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignorieren – Einstellungen gelten dann nur für diese Sitzung.
  }
  applySettings(settings);
}

export function applySettings(settings: Settings): void {
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
}
