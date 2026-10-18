import { expect, test } from '@playwright/test';
import { planRoute, startSolo } from './helpers';

test('Szenario A: gültige Route schließt das Haus an und zeigt das Ergebnis', async ({ page }) => {
  await startSolo(page, 'erstes-haus', 'fox');
  await expect(page.getByTestId('budget')).toHaveText('22 / 22');
  await planRoute(page, '1,4 1,5 2,5 3,5 4,5 5,5 6,5 7,5 8,5 9,5 10,5 11,5 11,4');
  await expect(page.getByTestId('planned')).toHaveText('15');
  await expect(page.getByTestId('plan-msg')).toContainText('Jetzt bauen');
  await page.getByTestId('build').click();
  const result = page.getByTestId('result');
  await expect(result).toContainText('Alle Gebäude sind am Netz');
  await expect(result.getByTestId('score')).toContainText('/ 100');
  await expect(page.getByTestId('budget')).toHaveText('7 / 22');
  await expect(page.getByTestId('connected')).toHaveText('1 / 1');
});

test('Szenario B: ungültige Route wird abgelehnt, Budget bleibt unverändert', async ({ page }) => {
  await startSolo(page, 'wurzelallee', 'fox');
  await planRoute(page, '2,4 3,4 4,4 5,4 6,4 7,4');
  await expect(page.getByTestId('plan-msg')).toContainText('Wurzelzone');
  await page.getByTestId('build').click();
  await expect(page.locator('.toast.error')).toContainText('Wurzelzone');
  await expect(page.getByTestId('budget')).toHaveText('26 / 26');
  await expect(page.getByTestId('connected')).toHaveText('0 / 1');
});

test('Szenario C: Maulwurfstunnel wird genau einmal angewendet', async ({ page }) => {
  await startSolo(page, 'wurzelallee', 'mole');
  // erst direkt vor der Wurzelzone lässt sich die Fähigkeit scharf schalten
  await expect(page.getByTestId('ability')).toBeDisabled();
  await planRoute(page, '2,4 3,4 4,4 5,4 6,4');
  await expect(page.getByTestId('plan-msg')).toContainText('Wurzelzone voraus');
  await page.getByTestId('ability').click();
  await expect(page.getByTestId('ability')).toHaveAttribute('aria-pressed', 'true');
  await planRoute(page, '7,4 8,4 9,4 10,4 11,4 12,4 13,4 14,4');
  await expect(page.getByTestId('plan-msg')).toContainText('mit Maulwurfstunnel');
  await page.getByTestId('build').click();
  await expect(page.getByTestId('result')).toContainText('Alle Gebäude sind am Netz');
  await expect(page.getByTestId('budget')).toHaveText('11 / 26');
  await expect(page.getByTestId('ability')).toContainText('verbraucht');
});

test('Dachs: Felsen werden ohne Aktivierung günstiger', async ({ page }) => {
  await startSolo(page, 'erstes-haus', 'badger');
  await expect(page.getByTestId('ability')).toBeDisabled();
  await expect(page.getByTestId('ability')).toContainText('automatisch');
  await planRoute(page, '2,3 2,4 3,4 4,4 5,4 6,4 7,4 8,4 9,4 10,4 11,4');
  await expect(page.getByTestId('plan-msg')).toContainText('mit Hart im Nehmen');
  await page.getByTestId('build').click();
  await expect(page.getByTestId('result')).toContainText('Alle Gebäude sind am Netz');
  await expect(page.getByTestId('ability')).toContainText('verbraucht');
});

test('Szenario F: Zeitablauf beendet die Runde mit Auswertung', async ({ page }) => {
  await page.clock.install();
  await startSolo(page, 'erstes-haus', 'badger');
  await page.clock.fastForward(181_000);
  await page.clock.runFor(500);
  const result = page.getByTestId('result');
  await expect(result).toContainText('Auftrag nicht geschafft');
  await expect(result).toContainText('Die Zeit ist abgelaufen');
});

test('Pfeiltasten: das Tier läuft los und legt dabei die Leitung', async ({ page }) => {
  await startSolo(page, 'erstes-haus', 'mole');
  const keys = ['ArrowDown', 'ArrowDown', ...Array(10).fill('ArrowRight')];
  for (const key of keys) await page.keyboard.press(key);
  await expect(page.getByTestId('planned')).toHaveText('12');
  // Ein Schritt zurück nimmt das letzte Feld wieder weg
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('planned')).toHaveText('11');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('plan-msg')).toContainText('Jetzt bauen');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('result')).toContainText('Alle Gebäude sind am Netz');
  await expect(page.getByTestId('budget')).toHaveText('7 / 22');
});
