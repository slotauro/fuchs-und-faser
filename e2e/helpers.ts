import { expect, type Page } from '@playwright/test';

/** Klickt auf eine Kachel des Spielfelds (Rasterkoordinaten). */
export async function clickCell(page: Page, x: number, y: number): Promise<void> {
  const board = page.getByTestId('board');
  const cols = Number(await board.getAttribute('data-cols'));
  const tile = Number(await board.getAttribute('data-tile'));
  const margin = Number(await board.getAttribute('data-margin'));
  const canvas = board.locator('canvas');
  const box = (await canvas.boundingBox())!;
  // Das Spielfeld hat einen dekorativen Rand; Weltpixel → Bildschirmpixel über die Skalierung
  const scale = box.width / (cols * tile + margin * 2);
  const px = box.x + (margin + (x + 0.5) * tile) * scale;
  const py = box.y + (margin + (y + 0.5) * tile) * scale;
  const viewport = page.viewportSize();
  // Direkt mit der Maus klicken: `canvas.click` wartet vor jedem Klick auf ein stabiles Element über mehrere
  // Animationsframes, was im Headless-Browser ohne GPU sekundenlang dauert. Außerhalb des Sichtbereichs
  // übernimmt `canvas.click` das Scrollen.
  if (viewport && py >= 0 && py < viewport.height && px >= 0 && px < viewport.width) await page.mouse.click(px, py);
  else await canvas.click({ position: { x: px - box.x, y: py - box.y } });
}

export async function planRoute(page: Page, route: string): Promise<void> {
  for (const part of route.trim().split(/\s+/)) {
    const [x, y] = part.split(',').map(Number);
    await clickCell(page, x, y);
  }
}

export async function startSolo(page: Page, mapId: string, animal: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId('menu-play').click();
  await page.getByTestId(`map-${mapId}`).click();
  await page.getByTestId(`animal-${animal}`).click();
  await page.getByTestId('start-solo').click();
  await expect(page.locator('#board canvas')).toBeVisible();
}
