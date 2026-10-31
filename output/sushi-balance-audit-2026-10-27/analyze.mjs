import fs from 'node:fs/promises';
import {
  SUSHI_CATALOG,
  previewCatalogPurchase,
  previewUpgradeImpact,
} from '../../src/course/sushi-game/catalog.ts';
import {
  createDefaultRestaurantState,
  calculateProductionRate,
  calculateAccrual,
} from '../../src/course/sushi-game/economy.ts';
import {
  SushiService,
  InMemorySushiRepository,
} from '../../src/course/sushi-game/domain-service.ts';
import {
  createFreshCourseProgress,
  getWeekProgressSummary,
} from '../../src/course/course-state.ts';
import { courseWeeks } from '../../src/course/data/index.ts';
const out = new URL('./', import.meta.url);
const U = 60000,
  H = 3600000,
  D = 24 * H;
const rate = (s) =>
  calculateProductionRate(s.kitchenCapacity, s.serviceCapacity, s.averageRevenuePerOrder)
    .yenPerMinute;
const functional = SUSHI_CATALOG.filter((i) => i.requiredTier === 'bronze');
const repo = new InMemorySushiRepository(),
  service = new SushiService(repo);
let serial = 0;
async function buy(s, item, now) {
  await repo.set(s);
  const result = await service.purchaseCatalogItem(s.id, item.id, `audit-${++serial}`, now);
  if (!result.success) throw Error(`${item.id}: ${result.reason}`);
  return result.state;
}
let ordered = createDefaultRestaurantState('ordered', 0, {
  balanceUnits: 1000000 * U,
  permanentGrants: SUSHI_CATALOG.map((i) => i.id),
});
const upgrades = [];
for (const item of functional) {
  const before = rate(ordered),
    preview = previewCatalogPurchase(ordered, item.id);
  ordered = await buy(ordered, item, 0);
  upgrades.push({
    id: item.id,
    name: item.name,
    chapter: item.requiredLesson,
    price: item.priceYen,
    before,
    after: rate(ordered),
    delta: preview.yenDelta,
    K: ordered.kitchenCapacity,
    S: ordered.serviceCapacity,
    A: ordered.averageRevenuePerOrder,
    capHours: ordered.capMs / H,
    earnMinutes: item.priceYen / before,
    paybackMinutes: preview.yenDelta > 0 ? item.priceYen / preview.yenDelta : null,
  });
}
async function cadence(intervalHours) {
  let s = createDefaultRestaurantState(`cadence-${intervalHours}`, 0),
    ledger = [];
  // All three chapter medals become eligible together every seven days.
  // This deliberately isolates the economy from unknown learning speed.
  for (let day = 0; day <= 42; day += intervalHours / 24) {
    const now = Math.round(day * D),
      chapter = Math.min(12, 6 + Math.floor((day + 1e-9) / 7));
    s.permanentGrants = SUSHI_CATALOG.filter((i) => i.requiredLesson <= chapter).map((i) => i.id);
    await repo.set(s);
    s = (await service.collectRevenue(s.id, `collect-${++serial}`, now)).state;
    const bought = [];
    // Production purchases before visual purchases; fixed catalog order within each group.
    for (const item of [
      ...functional,
      ...SUSHI_CATALOG.filter((i) => i.requiredTier !== 'bronze'),
    ]) {
      if (
        item.requiredLesson <= chapter &&
        !s.inventory.includes(item.id) &&
        s.balanceUnits >= item.priceUnits
      ) {
        s = await buy(s, item, now);
        bought.push(item.id);
      }
    }
    ledger.push({
      day,
      chapter,
      wallet: s.balanceUnits / U,
      owned: s.inventory.length,
      rate: rate(s),
      bought,
    });
  }
  return {
    intervalHours,
    finalWallet: s.balanceUnits / U,
    owned: s.inventory.length,
    rate: rate(s),
    ledger,
  };
}
// At-once eligibility: find the fastest exact-affordability order for all six
// rate upgrades. Cap extension is deferred; it has no benefit when collecting
// before 8h. Every tested wait is <8h; an assertion below checks this assumption.
const growth = functional.filter((i) => i.category !== 'cap');
function stats(items) {
  let K = 1,
    S = 2,
    A = 10;
  for (const i of items) {
    K += i.kitchenCapacityDelta ?? 0;
    S += i.serviceCapacityDelta ?? 0;
    A += i.averageRevenueDelta ?? 0;
  }
  return Math.min(K, S) * A;
}
let best = { minutes: Infinity, order: [] };
function permute(chosen, left, minutes) {
  if (!left.length) {
    if (minutes < best.minutes) best = { minutes, order: chosen.map((i) => i.id) };
    return;
  }
  for (const i of left)
    permute(
      [...chosen, i],
      left.filter((x) => x !== i),
      minutes + i.priceYen / stats(chosen),
    );
}
permute([], growth, 0);
let catchup = createDefaultRestaurantState('catchup', 0, {
    permanentGrants: SUSHI_CATALOG.map((i) => i.id),
  }),
  time = 0;
const catchupLedger = [];
const catchupOrder = [
  ...best.order.map((id) => SUSHI_CATALOG.find((i) => i.id === id)),
  ...SUSHI_CATALOG.filter((i) => !best.order.includes(i.id)),
];
for (const item of catchupOrder) {
  const waitMs = Math.ceil(Math.max(0, item.priceUnits - catchup.balanceUnits) / rate(catchup));
  if (waitMs > catchup.capMs) throw Error('At-once wait exceeds cap');
  time += waitMs;
  await repo.set(catchup);
  catchup = (await service.collectRevenue(catchup.id, `collect-${++serial}`, time)).state;
  catchup = await buy(catchup, item, time);
  catchupLedger.push({ item: item.id, atHours: time / H, rate: rate(catchup) });
}
const mastery = courseWeeks.map((week) => {
  const p = createFreshCourseProgress();
  for (const x of week.vocab) p.masteredVocabIds[x.id] = true;
  for (const x of week.kanji) p.masteredKanjiIds[x.id] = true;
  for (const x of week.conjugations) p.masteredDojoIds[x.id] = true;
  const summary = getWeekProgressSummary(p, week);
  const total = summary.vocabTotal + summary.kanjiTotal + summary.dojoTotal + summary.quizTotal;
  return {
    chapter: week.lessonNumber,
    vocab: week.vocab.length,
    kanji: week.kanji.length,
    dojo: week.conjugations.length,
    quiz: week.quiz.length,
    total,
    noQuizPercent: (100 * (total - week.quiz.length)) / total,
    noQuizMedal: summary.medal,
    bronzeItems: Math.ceil(total * 0.6),
    silverItems: Math.ceil(total * 0.8),
    goldItems: total,
    goldExtraOverSilver: total - Math.ceil(total * 0.8),
  };
});
const capSensitivity = [4, 8, 12, 24, 48, 168].map((hours) => ({
  hours,
  base8h: calculateAccrual(createDefaultRestaurantState('cap', 0), hours * H).earnedUnits / U,
  base12h:
    calculateAccrual(createDefaultRestaurantState('cap12', 0, { capMs: 12 * H }), hours * H)
      .earnedUnits / U,
  upgraded8h: 20 * 60 * Math.min(hours, 8),
  upgraded12h: 20 * 60 * Math.min(hours, 12),
  lostPercent12h: Math.max(0, 1 - 12 / hours) * 100,
}));
const categoryTotals = Object.fromEntries(
  ['bronze', 'silver', 'gold'].map((t) => [
    t,
    SUSHI_CATALOG.filter((i) => i.requiredTier === t).reduce((n, i) => n + i.priceYen, 0),
  ]),
);
let candidateState = createDefaultRestaurantState('candidate', 0);
const candidateUpgrades = functional.map((item) => {
  const deltas = {
    ...item,
    averageRevenueDelta:
      item.id === 'precision_knife' || item.id === 'service_counter'
        ? 1
        : item.id === 'master_license'
          ? 3
          : item.averageRevenueDelta,
  };
  const preview = previewUpgradeImpact(candidateState, deltas);
  candidateState = {
    ...candidateState,
    kitchenCapacity: preview.newKitchenCapacity,
    serviceCapacity: preview.newServiceCapacity,
    averageRevenuePerOrder:
      candidateState.averageRevenuePerOrder + (deltas.averageRevenueDelta ?? 0),
    capMs: preview.newCapMs,
  };
  return {
    id: item.id,
    chapter: item.requiredLesson,
    rate: rate(candidateState),
    revenuePerOrder: candidateState.averageRevenuePerOrder,
  };
});
const weekly = await cadence(168),
  daily = await cadence(24),
  twiceDaily = await cadence(12);
const result = {
  auditedAt: '2026-10-27',
  commit: '1137913',
  catalogTotal: SUSHI_CATALOG.reduce((n, i) => n + i.priceYen, 0),
  categoryTotals,
  upgrades,
  candidateUpgrades,
  cadences: [weekly, daily, twiceDaily],
  catchup: {
    hours: time / H,
    growthHours: best.minutes / 60,
    growthOrder: best.order,
    ledger: catchupLedger,
  },
  mastery,
  capSensitivity,
  decor: { count: SUSHI_CATALOG.filter((i) => i.category === 'decoration').length, slots: 2 },
  catalog: SUSHI_CATALOG.map((i) => ({
    id: i.id,
    name: i.name,
    chapter: i.requiredLesson,
    tier: i.requiredTier,
    price: i.priceYen,
    category: i.category,
    slot: i.slotType ?? null,
  })),
};
await fs.writeFile(new URL('balance-data.json', out), JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      ...result,
      cadences: result.cadences.map(({ ledger, ...s }) => ({
        ...s,
        weeklySnapshots: ledger.filter((x) => x.day % 7 === 0),
      })),
      catalog: undefined,
      catchup: { ...result.catchup, ledger: undefined },
    },
    null,
    2,
  ),
);
