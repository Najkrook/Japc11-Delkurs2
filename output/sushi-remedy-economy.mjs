import fs from 'node:fs/promises';
import { SUSHI_CATALOG } from '../src/course/sushi-game/catalog.ts';
import { SUSHI_PROJECTS, projectEligibility } from '../src/course/sushi-game/projects.ts';
import { InMemorySushiRepository, SushiService } from '../src/course/sushi-game/domain-service.ts';
import { calculateProductionRate } from '../src/course/sushi-game/economy.ts';
const H = 3600000,
  U = 60000;
const rates = (s) =>
  calculateProductionRate(s.kitchenCapacity, s.serviceCapacity, s.averageRevenuePerOrder)
    .yenPerMinute;
async function simulate(gap) {
  const repo = new InMemorySushiRepository(),
    service = new SushiService(repo),
    uid = 'cadence-' + gap;
  let state = await service.getOrInitRestaurant(uid, 0),
    ledger = [];
  for (let hour = 0; hour <= 42 * 24; hour += gap) {
    const chapter = Math.min(12, 6 + Math.floor(hour / (7 * 24))),
      now = hour * H;
    state = await service.syncMedalGrants(
      uid,
      SUSHI_CATALOG.filter((x) => x.requiredLesson <= chapter).map((x) => x.id),
      now,
    );
    state = (await service.collectRevenue(uid, 'collect-' + hour, now)).state;
    const purchases = [];
    for (const item of [
      ...SUSHI_CATALOG.filter((x) => x.requiredTier === 'bronze'),
      ...SUSHI_CATALOG.filter((x) => x.requiredTier !== 'bronze'),
    ]) {
      if (
        !state.inventory.includes(item.id) &&
        state.permanentGrants.includes(item.id) &&
        state.balanceUnits >= item.priceUnits
      ) {
        const result = await service.purchaseCatalogItem(uid, item.id, 'item-' + item.id, now);
        if (!result.success) throw Error(result.reason);
        state = result.state;
        purchases.push(item.id);
      }
    }
    for (const project of SUSHI_PROJECTS) {
      if (
        !(state.completedProjects ?? []).includes(project.id) &&
        projectEligibility(state, project).eligible &&
        state.balanceUnits >= project.priceUnits
      ) {
        const result = await service.purchaseRestaurantProject(
          uid,
          project.id,
          'project-' + project.id,
          now,
        );
        if (!result.success) throw Error(result.reason);
        state = result.state;
        purchases.push(project.id);
      }
    }
    ledger.push({
      day: hour / 24,
      chapter,
      inventory: state.inventory.length,
      projects: state.completedProjects ?? [],
      wallet: state.balanceUnits / U,
      rate: rates(state),
      purchases,
    });
  }
  return { gapHours: gap, final: ledger.at(-1), ledger };
}
const result = {
  policy:
    'Start at zero. All three chapter grants unlock every seven days; collect each visit, then buy eligible core bronze items, visual catalog items, then optional projects in catalog order. No active study earnings or starter cash.',
  catalogCost: SUSHI_CATALOG.reduce((x, y) => x + y.priceYen, 0),
  projectCost: SUSHI_PROJECTS.reduce((x, y) => x + y.priceYen, 0),
  cadences: await Promise.all([simulate(168), simulate(24), simulate(12)]),
};
await fs.writeFile(
  new URL('sushi-remedy-economy.json', import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify(
    { ...result, cadences: result.cadences.map(({ gapHours, final }) => ({ gapHours, final })) },
    null,
    2,
  ),
);
