import { test, expect } from '@playwright/test';

test.describe('Ticket 09: Lazy loading av Extra studier (Tae Kim)', () => {
  test('Initial sidladdning hämtar inte extra-studies chunk, men laddas asynkront vid navigering', async ({
    page,
  }) => {
    const requestedUrls: string[] = [];
    page.on('request', (req) => {
      requestedUrls.push(req.url());
    });

    await page.goto('/');

    // Wait until course shell is fully rendered
    await expect(page.locator('main h1')).toBeVisible();

    // Verify extra-studies chunk was NOT requested during initial load
    const hadExtraStudiesInitially = requestedUrls.some((url) => url.includes('extra-studies'));
    expect(hadExtraStudiesInitially).toBe(false);

    // Click Extra studier in sidebar
    await page.locator('[data-course-nav="extra"]').click();

    // Verify main header transitions to Extra studier Tae Kim Anime Immersion
    const mainHeader = page.locator('main h1');
    await expect(mainHeader).toContainText('Extra studier · Tae Kim Anime Immersion');

    // Verify the extra-studies chunk has now been requested
    const hasRequestedExtraStudiesNow = requestedUrls.some((url) => url.includes('extra-studies'));
    expect(hasRequestedExtraStudiesNow).toBe(true);

    // Verify all 6 Arcs are rendered
    await expect(page.locator('.taekim-arc-card')).toHaveCount(6);

    // Test Search functionality
    const searchInput = page.locator('#taekim-search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('anime');
    await expect(page.locator('.search-results-list')).toBeVisible();
    const resultRows = page.locator('.search-result-row');
    await expect(resultRows.first()).toBeVisible();

    // Open first search result card
    await resultRows.first().locator('.search-open-btn').click();

    // Verify study card stage is shown
    const ankiCard = page.locator('.taekim-card-stage');
    await expect(ankiCard).toBeVisible();
    await expect(page.locator('.anki-front-text')).toBeVisible();

    // Flip card to reveal grammar & meaning
    await ankiCard.click();
    await expect(page.locator('.anki-card-answer-revealed')).toBeVisible();
    await expect(page.locator('.taekim-meaning-box')).toBeVisible();

    // Return to Arcs overview
    await page.locator('.anki-back-nav-btn').click();
    await expect(page.locator('.taekim-arc-card')).toHaveCount(6);

    // Return to main study plan hub
    await page.getByRole('button', { name: '← Tillbaka till studieplanen' }).click();
    await expect(page.locator('main h1')).toContainText('Vecka 1 · Lektion 6');
  });
});
