export const app = document.getElementById('app')!;
export const overlay = document.getElementById('overlay')!;

/** Neuer Bildschirm: oben beginnen, statt die alte Scrollposition zu behalten. */
export function resetScroll(): void {
  window.scrollTo(0, 0);
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function $(selector: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Element fehlt: ${selector}`);
  return el;
}

export function showOverlay(html: string): HTMLElement {
  overlay.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${html}</div>`;
  overlay.hidden = false;
  overlay.querySelector<HTMLElement>('button')?.focus();
  return overlay;
}

export function hideOverlay(): void {
  overlay.hidden = true;
  overlay.innerHTML = '';
}

export function toast(message: string, kind: 'info' | 'error' | 'ok' = 'info'): void {
  const box = document.getElementById('toasts')!;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild?.remove();
  setTimeout(() => el.remove(), 3500);
}

export function setConnectionBanner(message: string | null): void {
  const el = document.getElementById('conn-banner')!;
  el.hidden = message === null;
  el.textContent = message ?? '';
}
