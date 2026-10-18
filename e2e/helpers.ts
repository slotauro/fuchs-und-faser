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
  await canvas.click({ position: { x: (margin + (x + 0.5) * tile) * scale, y: (margin + (y + 0.5) * tile) * scale } });
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
