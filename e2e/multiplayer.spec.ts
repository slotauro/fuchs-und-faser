import { expect, test } from '@playwright/test';
import { planRoute } from './helpers';

test('Szenario D: zwei Spieler sehen denselben Zustand und dasselbe Budget', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto('/');
  await host.getByTestId('menu-create').click();
  await host.getByTestId('mp-name').fill('Fiona');
  await host.getByTestId('animal-fox').click();
  await host.getByTestId('mp-go').click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Beitritt über den Einladungslink
  await guest.goto(`/?room=${code}`);
  await guest.getByTestId('mp-name').fill('Moritz');
  await expect(guest.getByTestId('mp-code')).toHaveValue(code);
  await guest.getByTestId('mp-go').click();
  await expect(guest.getByTestId('players')).toContainText('Fiona');
  await expect(host.getByTestId('players')).toContainText('Moritz');

  await guest.getByTestId('mp-ready').click();
  await expect(host.getByTestId('mp-start')).toBeEnabled();
  await host.getByTestId('mp-start').click();

  await expect(host.getByTestId('budget')).toHaveText('40 / 40');
  await expect(guest.getByTestId('budget')).toHaveText('40 / 40');

  await planRoute(guest, '1,6 1,5 2,5 2,4 2,3 3,3 4,3 5,3 5,2 5,1');
  await guest.getByTestId('build').click();

  await expect(guest.getByTestId('budget')).toHaveText('27 / 40');
  await expect(host.getByTestId('budget')).toHaveText('27 / 40');
  await expect(host.getByTestId('connected')).toHaveText('1 / 3');

  // Verbindungsverlust: Neuladen tritt automatisch wieder bei und zeigt denselben Stand.
  await guest.reload();
  await expect(guest.getByTestId('budget')).toHaveText('27 / 40');
  await expect(guest.getByTestId('connected')).toHaveText('1 / 3');

  // Der Host baut weiter am gemeinsamen Netz
  await planRoute(host, '6,3 7,3 8,3 9,3 10,3 11,3 11,2 11,1');
  await host.getByTestId('build').click();
  await expect(guest.getByTestId('budget')).toHaveText('20 / 40');
  await expect(guest.getByTestId('connected')).toHaveText('2 / 3');
});
