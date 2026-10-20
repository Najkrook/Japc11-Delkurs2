import { test, expect } from '@playwright/test';

test.describe('Ticket 10: Hash-routing och delbara direktlänkar', () => {
  test('URL-hash ändras vid byte av vecka och studievy', async ({ page }) => {
    await page.goto('/');

    // Initial load defaults to vecka 1
    await expect(page).toHaveURL(/#\/vecka\/week-1/);
    await expect(page.locator('main h1')).toContainText('Vecka 1 · Lektion 6');

    // Click て-form Dojo in top nav
    await page
      .getByRole('button', { name: /て-form Dojo/ })
      .first()
      .click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/dojo/);
    await expect(page.locator('main h1')).toContainText('Träna verbens て-form steg för steg');

    // Click Glosor
    await page.getByRole('button', { name: 'Glosor', exact: true }).first().click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/vocab/);
    await expect(page.locator('.fc-counter, .flashcard-deck, main')).toBeVisible();

    // Click Grammatik
    await page.getByRole('button', { name: 'Grammatikregler', exact: true }).first().click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/grammar/);

    // Switch week to Vecka 2 via sidebar ribbon
    await page.getByRole('tab', { name: /Vecka 2/ }).click();
    await expect(page).toHaveURL(/#\/vecka\/week-2$/);
    await expect(page.locator('main h1')).toContainText('Vecka 2 · Lektion 7');

    // Click Kurs-Arena
    await page.locator('[data-course-nav="arena"]').first().click();
    await expect(page).toHaveURL(/#\/arena/);
    await expect(page.locator('main h1')).toContainText('Tävla i det nya kursmaterialet');

    // Click Extra studier
    await page.locator('[data-course-nav="extra-top"], [data-course-nav="extra"]').first().click();
    await expect(page).toHaveURL(/#\/extra/);
    await expect(page.locator('main h1')).toContainText('Extra studier · Tae Kim Anime Immersion');
  });

  test('Sidladdning med befintlig hash öppnar rätt vecka och vy direkt', async ({ page }) => {
    // 1. Direct link to Vecka 2 Dojo
    await page.goto('/#/vecka/week-2/dojo');
    await expect(page).toHaveURL(/#\/vecka\/week-2\/dojo/);
    await expect(page.locator('main h1')).toContainText('Träna verbens て-form steg för steg');

    // 2. Direct link to Vecka 3 Vocab
    await page.goto('/#/vecka/week-3/vocab');
    await expect(page).toHaveURL(/#\/vecka\/week-3\/vocab/);
    await expect(page.locator('.course-top-link.active')).toContainText('Glosor');

    // 3. Direct link to Extra studier
    await page.goto('/#/extra');
    await expect(page).toHaveURL(/#\/extra/);
    await expect(page.locator('main h1')).toContainText('Extra studier · Tae Kim Anime Immersion');
  });

  test('Bakåt- och framåtknappar navigerar i historiken istället för att lämna sajten', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/vecka\/week-1/);

    // Navigate to Dojo
    await page
      .getByRole('button', { name: /て-form Dojo/ })
      .first()
      .click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/dojo/);

    // Navigate to Glosor
    await page.getByRole('button', { name: 'Glosor', exact: true }).first().click();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/vocab/);

    // Navigate to Kurs-Arena
    await page.locator('[data-course-nav="arena"]').first().click();
    await expect(page).toHaveURL(/#\/arena/);

    // Step 1 back -> should return to Glosor
    await page.goBack();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/vocab/);
    await expect(page.locator('.course-top-link.active')).toContainText('Glosor');

    // Step 2 back -> should return to Dojo
    await page.goBack();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/dojo/);
    await expect(page.locator('main h1')).toContainText('Träna verbens て-form steg för steg');

    // Step 3 back -> should return to Hub
    await page.goBack();
    await expect(page).toHaveURL(/#\/vecka\/week-1/);
    await expect(page.locator('main h1')).toContainText('Vecka 1 · Lektion 6');

    // Step forward -> should return to Dojo
    await page.goForward();
    await expect(page).toHaveURL(/#\/vecka\/week-1\/dojo/);
    await expect(page.locator('main h1')).toContainText('Träna verbens て-form steg för steg');
  });

  test('Direktlänk med arenarumskod förifyller koden i Kurs-Arena', async ({ page }) => {
    // Open direct link with room code 4821
    await page.goto('/#/arena/4821');

    await expect(page).toHaveURL(/#\/arena\/4821/);
    await expect(page.locator('main h1')).toContainText('Tävla i det nya kursmaterialet');

    // Verify room code input is prefilled
    const input = page.locator('#arena-code-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('4821');
  });

  test('Skapa rum uppdaterar URL till arenakod och att lämna återställer URL', async ({ page }) => {
    await page.goto('/#/arena');
    await expect(page).toHaveURL(/#\/arena/);

    // Create room
    await page.locator('[data-arena-action="create-room"]').click();
    const roomCodeEl = page.getByTestId('arena-room-code');
    await expect(roomCodeEl).toBeVisible();
    const roomCode = (await roomCodeEl.textContent())?.trim();
    expect(roomCode).toMatch(/^\d{4}$/);

    // URL should now reflect the room code
    await expect(page).toHaveURL(new RegExp(`#/arena/${roomCode}`));

    // Leave room
    await page.getByRole('button', { name: /Lämna rummet/ }).click();
    await expect(page).toHaveURL(/#\/arena$/);
    await expect(page.locator('main h1')).toContainText('Tävla i det nya kursmaterialet');
  });
});
