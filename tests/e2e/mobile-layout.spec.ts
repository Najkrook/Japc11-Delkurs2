import { test, expect } from '@playwright/test';

test.describe('Mobile Viewport (375x812) Layout & Touch Targets', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('topbar is compact (<= 100px), main content starts above the fold (y < 200px), and buttons have comfortable touch targets', async ({
    page,
  }) => {
    // Ensure SpeechSynthesis is available in test environment so TTS buttons render
    await page.addInitScript(() => {
      if (!('speechSynthesis' in window)) {
        (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
          speak: () => {},
          cancel: () => {},
          getVoices: () => [],
        };
        (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
          function () {};
      }
    });

    await page.goto('/');

    // 1. Verify .course-topbar height is compact (<= 100 px, well under ~15% of 812px = 121.8px)
    const topbar = page.locator('.course-topbar');
    await expect(topbar).toBeVisible();
    const topbarBox = await topbar.boundingBox();
    expect(topbarBox).not.toBeNull();
    expect(topbarBox!.height).toBeLessThanOrEqual(100);

    // 2. Verify navigation links are placed in a horizontal scroll container
    const nav = page.locator('.course-top-nav');
    await expect(nav).toBeVisible();
    const navOverflowX = await nav.evaluate((el) => window.getComputedStyle(el).overflowX);
    expect(['auto', 'scroll']).toContain(navOverflowX);

    // 3. Verify main content area begins above the fold (y < 200 px) without being pushed down by the 693px sidebar
    const mainContainer = page.locator('.course-main-container');
    await expect(mainContainer).toBeVisible();
    const mainBox = await mainContainer.boundingBox();
    expect(mainBox).not.toBeNull();
    expect(mainBox!.y).toBeLessThan(200);

    // Also check the editorial title heading or first bento card
    const editorialHeader = page.locator('.course-editorial-header');
    await expect(editorialHeader).toBeVisible();
    const headerBox = await editorialHeader.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.y).toBeLessThan(200);

    // 4. Verify touch targets for interactive buttons:
    // .mini-audio-btn
    const miniAudioBtn = page.locator('.mini-audio-btn').first();
    await expect(miniAudioBtn).toBeVisible();
    const audioBox = await miniAudioBtn.boundingBox();
    expect(audioBox).not.toBeNull();
    expect(audioBox!.height).toBeGreaterThanOrEqual(36);
    expect(audioBox!.width).toBeGreaterThanOrEqual(36);

    // .course-pill-icon-btn (Uttal pill)
    const pillBtn = page.locator('.course-pill-icon-btn').first();
    if ((await pillBtn.count()) > 0) {
      const pillBox = await pillBtn.boundingBox();
      expect(pillBox).not.toBeNull();
      expect(pillBox!.height).toBeGreaterThanOrEqual(36);
      expect(pillBox!.width).toBeGreaterThanOrEqual(36);
    }

    // .mode-switch-pill in the sidebar
    const modeSwitchPill = page.locator('.mode-switch-pill').first();
    await expect(modeSwitchPill).toBeAttached();
    const modeBox = await modeSwitchPill.boundingBox();
    expect(modeBox).not.toBeNull();
    expect(modeBox!.height).toBeGreaterThanOrEqual(36);
    expect(modeBox!.width).toBeGreaterThanOrEqual(36);

    // 5. Verify that sidebar is located below main container on mobile
    const sidebar = page.locator('.course-sidebar');
    await expect(sidebar).toBeAttached();
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(sidebarBox!.y).toBeGreaterThan(mainBox!.y);
  });
});
