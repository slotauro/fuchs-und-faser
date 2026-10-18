import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, ServerToClient } from '@fuf/shared';

export type GameSocket = Socket<ServerToClient, ClientToServer>;

const SESSION_KEY = 'fuf-session';

export interface Session {
  code: string;
  token: string;
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ohne Speicher kein automatischer Wiederbeitritt nach Neuladen
  }
}

/** Verbindung zum Spielserver (gleicher Host; im Dev-Modus über den Vite-Proxy). */
export function connect(): GameSocket {
  return io({ transports: ['websocket', 'polling'], reconnectionDelay: 500, reconnectionDelayMax: 3000 });
}

/** Wartet auf die Bestätigung des Servers; bei Zeitüberschreitung wird abgelehnt. */
export function request<T>(send: (ack: (response: T) => void) => void, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    send((response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}
