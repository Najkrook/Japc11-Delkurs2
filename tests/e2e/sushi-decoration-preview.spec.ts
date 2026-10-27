import { test, expect, type Page } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';

async function openShop(page: Page, owned = false) {
  const state = createDefaultRestaurantState(
    'preview-browser',
    Date.now(),
    owned
      ? {
          inventory: ['paper_lantern', 'wave_print', 'potted_plant'],
          permanentGrants: ['paper_lantern', 'wave_print', 'potted_plant'],
          equipped: { wallSlot: 'paper_lantern', floorSlot: 'potted_plant' },
          balanceUnits: 1000 * 60000,
        }
      : {},
  );
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Preview' }),
    );
    if (!localStorage.getItem(`japc11-dk2-sushi-v1-${fixture.id}`))
      localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  await page.goto('/#/sushi');
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByRole('tab', { name: 'Dekoration', exact: true }).click();
}

test('locked decorations can be previewed and browsed without modifying a save', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openShop(page);
  const saved = await page.evaluate(() =>
    localStorage.getItem('japc11-dk2-sushi-v1-preview-browser'),
  );
  await page.getByTestId('preview-decoration-paper_lantern').click();
  const preview = page.getByTestId('sushi-decoration-preview');
  await expect(preview).toBeFocused();
  await expect(preview).toContainText('Låst: Kapitel 6 Guld');
  await expect(page.getByTestId('art-paper_lantern')).toBeVisible();
  await expect(page.getByTestId('sushi-preview-place')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('wall-preview.png') });
  await page.getByTestId('sushi-preview-next').click();
  await expect(page.getByTestId('sushi-preview-name')).toHaveText('Krukväxt');
  await expect(page.getByTestId('art-potted_plant')).toBeVisible();
  await expect(page.getByTestId('art-paper_lantern')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('floor-preview.png') });
  const sceneBox = await page.locator('.sushi-pixel-world').boundingBox();
  const toolbarBox = await preview.boundingBox();
  expect(sceneBox!.y + sceneBox!.height).toBeLessThanOrEqual(toolbarBox!.y + 2);
  expect(sceneBox!.x).toBeGreaterThanOrEqual(0);
  expect(sceneBox!.x + sceneBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByTestId('sushi-preview-shop').click();
  await expect(page.getByRole('tab', { name: 'Dekoration' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('preview-decoration-potted_plant')).toBeFocused();
  await page.getByTestId('preview-decoration-potted_plant').click();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(page.getByTestId('art-potted_plant')).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem('japc11-dk2-sushi-v1-preview-browser')),
  ).toBe(saved);
  expect(errors).toEqual([]);
});

test('owned decoration is applied only by the explicit Place action and survives reload', async ({
  page,
}, testInfo) => {
  await openShop(page, true);
  await page.getByTestId('preview-decoration-wave_print').click();
  await expect(page.getByTestId('art-wave_print')).toBeVisible();
  await expect(page.getByTestId('art-paper_lantern')).toHaveCount(0);
  await expect(page.getByTestId('art-potted_plant')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('owned-preview.png') });
  await page.getByTestId('sushi-preview-close').click();
  await expect(page.getByTestId('art-paper_lantern')).toBeVisible();
  await expect(page.getByTestId('art-wave_print')).toHaveCount(0);
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByTestId('preview-decoration-wave_print').click();
  await page.getByTestId('sushi-preview-place').click();
  await expect(page.getByTestId('sushi-decoration-preview')).toHaveCount(0);
  await expect(page.getByTestId('art-wave_print')).toBeVisible();
  await expect(page.getByTestId('art-potted_plant')).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('japc11-dk2-sushi-v1-preview-browser')!),
  );
  expect(saved.equipped.wallSlot).toBe('wave_print');
  expect(saved.inventory).toEqual(['paper_lantern', 'wave_print', 'potted_plant']);
  expect(saved.balanceUnits).toBe(1000 * 60000);
  await page.reload();
  await expect(page.getByTestId('art-wave_print')).toBeVisible();
  await expect(page.getByTestId('sushi-decoration-preview')).toHaveCount(0);
});
