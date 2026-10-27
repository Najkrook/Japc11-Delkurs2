import { test, expect, type Page } from '@playwright/test';
import { SUSHI_CATALOG } from '../../src/course/sushi-game/catalog.ts';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import {
  InMemorySushiRepository,
  SushiService,
} from '../../src/course/sushi-game/domain-service.ts';
import { createFreshCourseProgress } from '../../src/course/course-state.ts';
import { getGuestStudyDeck } from '../../src/course/sushi-game/study-companion.ts';

const NOW = Date.UTC(2026, 9, 27, 12);
const ALL_GRANTS = SUSHI_CATALOG.map((item) => item.id);

async function openRestaurant(
  page: Page,
  id: string,
  items: string[] = [],
  yen = 0,
  grants: string[] = ALL_GRANTS,
  finaleSeen = true,
) {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  let state = createDefaultRestaurantState(id, NOW, {
    balanceUnits: 10_000_000 * 60_000,
    permanentGrants: grants,
    restaurantTier: 3, // These fixtures isolate economy effects from renovation gates.
  });
  for (const itemId of items) {
    await repo.set(state);
    const result = await service.purchaseCatalogItem(id, itemId, `fixture-${itemId}`, NOW);
    if (!result.success) throw new Error(`Fixture purchase failed: ${result.reason}`);
    state = result.state;
  }
  state.balanceUnits = yen * 60_000;
  const course = createFreshCourseProgress();
  course.activeWeekId = 'week-7';
  course.activeSubView = 'sushi';
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(
    ({ fixture, progress, seen }) => {
      sessionStorage.setItem(
        'japc11-mock-user',
        JSON.stringify({ uid: fixture.id, displayName: 'Balansprov' }),
      );
      if (!sessionStorage.getItem(`remedy-fixture-${fixture.id}`)) {
        localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
        localStorage.setItem(`japc11-dk2-course-v1-${fixture.id}`, JSON.stringify(progress));
        if (seen) localStorage.setItem(`japc11-sushi-finale-seen-${fixture.id}`, 'true');
        sessionStorage.setItem(`remedy-fixture-${fixture.id}`, 'true');
      }
    },
    { fixture: state, progress: course, seen: finaleSeen },
  );
  await page.goto('/#/sushi');
  await expect(page.getByTestId('sushi-cash-register')).toBeVisible();
  return state;
}

test('bronze newcomer can collect and renovate after five minutes', async ({ page }) => {
  await openRestaurant(page, 'remedy-onboarding', [], 0, ['prep_counter']);
  await expect(page.getByTestId('sushi-spendable-balance')).toContainText('0');
  await expect(page.getByTestId('sushi-cap-badge-standard')).toHaveText('24h kassa');
  await page.clock.setFixedTime(NOW + 5 * 60_000);
  await expect(page.getByTestId('sushi-uncollected-amount')).toContainText('50');
  await page.getByTestId('sushi-collect-btn').click();
  await page.getByTestId('sushi-goal-action').click();
  await page.getByTestId('buy-btn-prep_counter').click();
  await expect(page.getByTestId('owned-indicator-prep_counter')).toBeVisible();
  await expect(page.getByTestId('sushi-rate-info')).toContainText('20 ¥/min');
  await expect(page.getByTestId('sushi-live-announcer')).toContainText('10 till 20');
  await expect(page.getByTestId('sushi-spendable-balance')).toContainText('¥ 0');
});

for (const fixture of [
  {
    name: 'precision knife',
    id: 'precision_knife',
    owned: ['prep_counter', 'cap_extension_12h'],
    yen: 2400,
    before: 20,
    after: 22,
  },
  {
    name: 'service counter',
    id: 'service_counter',
    owned: ['prep_counter', 'cap_extension_12h', 'precision_knife', 'conveyor_belt'],
    yen: 5400,
    before: 44,
    after: 48,
  },
]) {
  test(`${fixture.name} preview, state and announcement agree on immediate benefit`, async ({
    page,
  }) => {
    await openRestaurant(page, `remedy-${fixture.id}`, fixture.owned, fixture.yen);
    await expect(page.getByTestId('sushi-rate-info')).toContainText(`${fixture.before} ¥/min`);
    await page.getByTestId('sushi-toggle-shop').click();
    const preview = page.getByTestId(`upgrade-preview-${fixture.id}`);
    await expect(preview).toContainText(`${fixture.after} ¥/min`);
    await page.getByTestId(`buy-btn-${fixture.id}`).click();
    await expect(page.getByTestId(`owned-indicator-${fixture.id}`)).toBeVisible();
    await expect(page.getByTestId('sushi-rate-info')).toContainText(`${fixture.after} ¥/min`);
    await expect(page.getByTestId('sushi-live-announcer')).toContainText(
      `${fixture.before} till ${fixture.after}`,
    );
  });
}

test('growth goal recommends real bottleneck relief independently from personalization', async ({
  page,
}) => {
  await openRestaurant(page, 'remedy-goals', ['prep_counter'], 4000);
  await expect(page.getByTestId('sushi-goal-grow')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('sushi-goal-action')).toContainText('Transportband');
  await page.locator('.sushi-goal-reason summary').click();
  await expect(page.getByTestId('sushi-goal-reason')).toContainText('+10 ¥/min');
  await page.getByTestId('sushi-goal-personalize').click();
  await expect(page.getByTestId('sushi-goal-action')).toContainText('Papperslykta');
  await expect(page.getByTestId('sushi-goal-reason')).toContainText('intäkten ändras inte');
});

test('all seven gold honors have a home without buying or equipping decoration', async ({
  page,
}, info) => {
  const grants = SUSHI_CATALOG.filter((item) => item.requiredTier === 'gold').map(
    (item) => item.id,
  );
  await openRestaurant(page, 'remedy-honors', [], 0, grants);
  await page.getByTestId('sushi-honors-shortcut').click();
  await expect(
    page.getByTestId('sushi-chapter-honors').locator('[data-earned="true"]'),
  ).toHaveCount(7);
  for (let chapter = 6; chapter <= 12; chapter++) {
    await expect(page.getByTestId(`sushi-honor-${chapter}`)).toContainText(
      'Guld · sparat för alltid',
    );
  }
  await expect(page.getByTestId('placed-wallSlot')).toContainText('Tom plats');
  await expect(page.getByTestId('placed-floorSlot')).toContainText('Tom plats');
  await page.screenshot({ path: info.outputPath('chapter-honors.png') });
  await page.reload();
  await page.getByTestId('sushi-honors-shortcut').click();
  await expect(
    page.getByTestId('sushi-chapter-honors').locator('[data-earned="true"]'),
  ).toHaveCount(7);
});

test('guest recall uses selected chapter sources, reveals meaning and changes no mastery or money', async ({
  page,
}, info) => {
  const uid = 'remedy-guest';
  await openRestaurant(page, uid);
  const before = await page.evaluate(
    (id) => ({
      course: localStorage.getItem(`japc11-dk2-course-v1-${id}`),
      state: JSON.parse(localStorage.getItem(`japc11-dk2-sushi-v1-${id}`)!),
    }),
    uid,
  );
  await page.getByTestId('sushi-guest-0').click();
  await page.getByTestId('sushi-start-guest-practice').click();
  const deck = getGuestStudyDeck(12);
  await expect(page.getByLabel('Kapitel för gästträning')).toHaveValue('12');
  await expect(page.getByTestId('sushi-practice-prompt')).toHaveText(deck[0].promptJp);
  await expect(page.getByTestId('sushi-practice-source')).toContainText(
    `Kapitel 12 · ${deck[0].sourceTitleSv}`,
  );
  await expect(page.getByTestId('sushi-practice-answer')).toHaveCount(0);
  await page.getByTestId('sushi-reveal-guest-answer').click();
  await expect(page.getByTestId('sushi-practice-answer')).toContainText(deck[0].answerSv);
  await page.screenshot({ path: info.outputPath('chapter-practice.png') });
  await page.getByTestId('sushi-next-guest-example').click();
  await expect(page.getByTestId('sushi-practice-prompt')).toHaveText(deck[1].promptJp);
  await expect(page.getByTestId('sushi-practice-answer')).toHaveCount(0);
  await page.getByLabel('Kapitel för gästträning').selectOption('6');
  await expect(page.getByLabel('Kapitel för gästträning')).toHaveValue('6');
  await expect(page.getByTestId('sushi-practice-source')).toContainText('Kapitel 6');
  const after = await page.evaluate(
    (id) => ({
      course: localStorage.getItem(`japc11-dk2-course-v1-${id}`),
      state: JSON.parse(localStorage.getItem(`japc11-dk2-sushi-v1-${id}`)!),
    }),
    uid,
  );
  expect(after.course).toBe(before.course);
  expect(after.state.balanceUnits).toBe(before.state.balanceUnits);
  expect(after.state.inventory).toEqual(before.state.inventory);
  expect(after.state.permanentGrants).toEqual(before.state.permanentGrants);
});

test('optional savings project changes the room, persists and leaves income alone', async ({
  page,
}, info) => {
  await openRestaurant(page, 'remedy-project', ['prep_counter'], 60_000);
  await expect(page.getByTestId('art-project-study_nook')).toHaveCount(0);
  await page.getByTestId('sushi-toggle-menu').click();
  await page.getByTestId('buy-project-study_nook').click();
  await expect(page.getByTestId('sushi-project-study_nook')).toContainText(
    'Byggt · syns i restaurangen',
  );
  await expect(page.getByTestId('sushi-project-study_nook').getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('sushi-rate-info')).toContainText('20 ¥/min');
  await page.getByTestId('sushi-close-menu-btn').click();
  await expect(page.getByTestId('art-project-study_nook')).toBeVisible();
  await page.screenshot({ path: info.outputPath('study-nook.png') });
  await page.reload();
  await expect(page.getByTestId('art-project-study_nook')).toBeVisible();
  await expect(page.getByTestId('sushi-spendable-balance')).toContainText('¥ 0');
});

test('the core finale celebrates 21 rewards with no optional projects and returns to study', async ({
  page,
}, info) => {
  await openRestaurant(page, 'remedy-finale', ALL_GRANTS, 0, ALL_GRANTS, false);
  const finale = page.getByTestId('sushi-finale');
  await expect(finale).toBeVisible();
  await expect(finale).toContainText('alla 21 kursbelöningar');
  await expect(finale).toContainText('frivilliga sparmål');
  await expect(page.getByTestId('sushi-rate-info')).toContainText('90 ¥/min');
  await expect(page.locator('[data-testid^="art-project-"]')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('sushi-finale-studies')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('sushi-finale-continue')).toBeFocused();
  await page.screenshot({ path: info.outputPath('finale.png') });
  await page.getByTestId('sushi-finale-studies').click();
  await expect(page).toHaveURL(/#\/vecka\/week-7/);
  await page.locator('[data-course-nav="sushi"]').first().click();
  await expect(finale).toHaveCount(0);
  await page.getByTestId('sushi-replay-finale').click();
  await expect(finale).toBeVisible();
});
