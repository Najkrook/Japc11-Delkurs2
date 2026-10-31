// Investigation harness: no persistent player data is read or changed.
// Run: node docs/sushi-game/audit-investigation.mjs
// Add --assert-ui to fail on the confirmed UI regressions.
import assert from 'node:assert/strict';
import { renderSushiShell, leaveSushiView } from '../../src/course/sushi-game/sushi-view.ts';
import {
  sushiService,
  InMemorySushiRepository,
  SushiService,
} from '../../src/course/sushi-game/service.ts';
import {
  createDefaultRestaurantState,
  calculateProductionRate,
} from '../../src/course/sushi-game/economy.ts';
import { SUSHI_CATALOG, previewCatalogPurchase } from '../../src/course/sushi-game/catalog.ts';

function flatten(value) {
  if (value == null || typeof value === 'boolean' || typeof value === 'function') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (value.strings)
    return value.strings.reduce((s, part, i) => s + part + flatten(value.values[i]), '');
  return '';
}
const realNow = Date.now;
const now = 1_800_000_000_000;
Date.now = () => now;
const repo = new InMemorySushiRepository();
sushiService.setRepository(repo);
const service = new SushiService(repo);
const host = {
  theme: 'classic',
  user: { uid: 'audit-fixture', displayName: 'Audit fixture' },
  authBusy: false,
  authError: null,
  speechNotice: null,
  status: '',
  tts: false,
  toggleTheme() {},
  account() {},
  render() {},
  announce() {},
  clearAuthError() {},
  clearSpeechNotice() {},
  speak() {
    return 'ok';
  },
};
async function renderState(state) {
  leaveSushiView();
  await repo.set(state);
  renderSushiShell(host, () => {});
  await new Promise((resolve) => setImmediate(resolve));
  return flatten(renderSushiShell(host, () => {})).replace(/\s+/g, ' ');
}
function visibleCollectAmount(markup) {
  return markup
    .match(/<strong[^>]*sushi-collect-yen[^>]*>(.*?)<\/strong\s*>/)?.[1]
    .replace(/<[^>]*>/g, '')
    .trim();
}
try {
  const fresh = createDefaultRestaurantState(host.user.uid, now);
  const emptyHtml = await renderState(fresh);
  const fundedHtml = await renderState({ ...fresh, uncollectedUnits: 7 * 60_000 });
  const cappedHtml = await renderState({
    ...fresh,
    usedProductionMs: fresh.capMs,
    uncollectedUnits: 4800 * 60_000,
  });
  await repo.set({ ...fresh, uncollectedUnits: 7 * 60_000 });
  await service.collectRevenue(fresh.id, 'audit-collect', now);
  const collected = await repo.get(fresh.id);
  assert.equal(collected.uncollectedUnits, 0);
  assert.equal(collected.balanceUnits, 7 * 60_000);
  const afterCollectHtml = await renderState(collected);

  const checks = [
    {
      name: 'Empty register shows zero',
      pass: visibleCollectAmount(emptyHtml) === '¥ 0',
      actual: visibleCollectAmount(emptyHtml),
    },
    {
      name: 'Nonempty register shows actual seven yen',
      pass: visibleCollectAmount(fundedHtml) === '¥ 7',
      actual: visibleCollectAmount(fundedHtml),
    },
    {
      name: 'Collected register shows zero',
      pass: visibleCollectAmount(afterCollectHtml) === '¥ 0',
      actual: visibleCollectAmount(afterCollectHtml),
    },
    {
      name: 'Rate is not screen-reader-only',
      pass: !/class="[^"]*sushi-rate-bar[^"]*sr-only/.test(emptyHtml),
    },
    {
      name: 'Cap and full-register warning are not screen-reader-only',
      pass: !/class="sushi-register-center sr-only"/.test(cappedHtml),
      warningRendered: cappedHtml.includes('sushi-capped-badge'),
    },
  ];
  console.log('UI checks (actual rendered lit templates; frozen clock):');
  for (const check of checks) console.log(JSON.stringify(check));
  console.log('Collection accounting: PASS, seven yen moved once; register is zero.');

  let state = {
    ...fresh,
    balanceUnits: 1_000_000 * 60_000,
    permanentGrants: SUSHI_CATALOG.map((i) => i.id),
  };
  await repo.set(state);
  console.log('Chronological bronze purchases through real domain service:');
  for (const item of SUSHI_CATALOG.filter((i) => i.requiredTier === 'bronze')) {
    const preview = previewCatalogPurchase(state, item.id);
    await service.purchaseCatalogItem(state.id, item.id, `audit-${item.id}`, now);
    state = await repo.get(state.id);
    assert.ok(state.inventory.includes(item.id), `${item.id} must be purchased`);
    console.log(
      JSON.stringify({
        item: item.id,
        rate: calculateProductionRate(
          state.kitchenCapacity,
          state.serviceCapacity,
          state.averageRevenuePerOrder,
        ).yenPerMinute,
        delta: preview.yenDelta,
        bottleneckWarning: preview.isBottleneckLimiting,
      }),
    );
  }
  const totals = {};
  for (const item of SUSHI_CATALOG)
    totals[item.category] = (totals[item.category] ?? 0) + item.priceYen;
  const recipes = SUSHI_CATALOG.filter((i) => i.category === 'recipe');
  for (const item of recipes) {
    const before = [state.kitchenCapacity, state.serviceCapacity, state.averageRevenuePerOrder];
    await service.purchaseCatalogItem(state.id, item.id, `audit-${item.id}`, now);
    state = await repo.get(state.id);
    assert.ok(state.inventory.includes(item.id));
    assert.deepEqual(
      [state.kitchenCapacity, state.serviceCapacity, state.averageRevenuePerOrder],
      before,
    );
  }
  console.log(
    'Catalog totals:',
    JSON.stringify({
      byCategory: totals,
      total: Object.values(totals).reduce((a, b) => a + b, 0),
      recipesWithoutRateEffect: recipes.length,
    }),
  );
  const result = { uiFailures: checks.filter((c) => !c.pass).length, uiChecks: checks.length };
  console.log(JSON.stringify(result));
  if (process.argv.includes('--assert-ui'))
    assert.equal(result.uiFailures, 0, 'UI regressions reproduced');
} finally {
  leaveSushiView();
  Date.now = realNow;
}
