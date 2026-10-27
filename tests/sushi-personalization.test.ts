import test from 'node:test';
import assert from 'node:assert/strict';
import { SushiService, InMemorySushiRepository } from '../src/course/sushi-game/domain-service.ts';
import { calculateAccrual } from '../src/course/sushi-game/economy.ts';
import { SushiClientController } from '../src/course/sushi-game/sushi-view.ts';
import { sushiService } from '../src/course/sushi-game/service.ts';
import type { CourseHostContext } from '../src/course/types.ts';

async function setup() {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const state = await service.getOrInitRestaurant('owner', 1000, [
    'salmon_nigiri',
    'paper_lantern',
    'wave_print',
    'potted_plant',
  ]);
  await repo.set({ ...state, restaurantTier: 2, balanceUnits: 600_000_000 });
  return { repo, service };
}

test('silver recipe requires its grant and collected funds, persists once and has no economic effect', async () => {
  const { repo, service } = await setup();
  await service.getOrInitRestaurant('locked', 1000);
  const locked = await service.purchaseCatalogItem('locked', 'salmon_nigiri', 'locked', 1000);
  assert.equal(locked.success, false);
  if (!locked.success) assert.equal(locked.reason, 'ITEM_LOCKED');
  const before = (await repo.get('owner'))!;
  const bought = await service.purchaseCatalogItem('owner', 'salmon_nigiri', 'recipe', 61_000);
  assert.ok(bought.success);
  if (!bought.success) return;
  const expected = calculateAccrual(before, 61_000).updatedState;
  assert.equal(bought.state.balanceUnits, before.balanceUnits - 36_000_000);
  for (const field of [
    'kitchenCapacity',
    'serviceCapacity',
    'averageRevenuePerOrder',
    'capMs',
    'uncollectedUnits',
    'usedProductionMs',
    'periodStartMs',
  ] as const) {
    assert.equal(bought.state[field], expected[field]);
  }
  await service.purchaseCatalogItem('owner', 'salmon_nigiri', 'recipe', 61_000);
  const reloaded = await new SushiService(repo).getOrInitRestaurant('owner', 61_000);
  assert.deepEqual(reloaded.inventory, ['salmon_nigiri']);
  assert.equal(reloaded.balanceUnits, bought.state.balanceUnits);
  assert.equal(reloaded.activeRecipe, before.activeRecipe);
});

test('decoration UI preserves confirmed selection on failure and ignores a late result after account change', async () => {
  const { repo, service } = await setup();
  await service.purchaseCatalogItem('owner', 'paper_lantern', 'buy', 1000);
  sushiService.setRepository(repo);
  const host = { render() {} } as CourseHostContext;
  const controller = new SushiClientController();
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  const transaction = repo.transaction.bind(repo);
  let release = () => {};
  try {
    controller.init('owner', host);
    await flush();
    repo.transaction = async () => {
      throw new Error('Offline');
    };
    await controller.equip('wallSlot', 'paper_lantern');
    assert.ok(controller.equipError);
    assert.equal(controller.state!.equipped.wallSlot, null);
    repo.transaction = transaction;
    await controller.equip('wallSlot', 'paper_lantern');
    assert.equal(controller.equipError, null);
    assert.equal(controller.state!.equipped.wallSlot, 'paper_lantern');
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    repo.transaction = async (...args) => {
      const delay = first;
      first = false;
      const result = await transaction(...args);
      if (delay) await held;
      return result;
    };
    const late = controller.equip('wallSlot', null);
    await flush();
    controller.init('other', host);
    await flush();
    release();
    await late;
    assert.equal(controller.state!.id, 'other');
    assert.equal(controller.state!.equipped.wallSlot, null);
    assert.equal(controller.isEquipping, false);
  } finally {
    release();
    controller.reset();
  }
});

test('decorations validate ownership and slot, preserve economy and support replace/remove/retry', async () => {
  const { repo, service } = await setup();
  assert.equal(
    (await service.equipDecoration('owner', 'wallSlot', 'paper_lantern', 'unowned', 1000)).success,
    false,
  );
  for (const item of ['paper_lantern', 'wave_print', 'potted_plant']) {
    assert.ok((await service.purchaseCatalogItem('owner', item, item, 1000)).success);
  }
  const before = (await repo.get('owner'))!;
  for (const [slot, item] of [
    ['floorSlot', 'paper_lantern'],
    ['x', 'wave_print'],
    ['wallSlot', 'prep_counter'],
    ['wallSlot', 'unknown'],
  ]) {
    assert.equal(
      (await service.equipDecoration('owner', slot, item, 'invalid', 61_000)).success,
      false,
    );
  }
  assert.deepEqual(await repo.get('owner'), before);
  assert.ok(
    (await service.equipDecoration('owner', 'wallSlot', 'paper_lantern', 'first', 61_000)).success,
  );
  const placed = (await repo.get('owner'))!;
  const expected = calculateAccrual(before, 61_000).updatedState;
  for (const key of [
    'accountedAtMs',
    'balanceUnits',
    'uncollectedUnits',
    'usedProductionMs',
    'periodStartMs',
    'kitchenCapacity',
    'serviceCapacity',
    'averageRevenuePerOrder',
    'capMs',
  ] as const)
    assert.deepEqual(placed[key], expected[key]);
  await service.equipDecoration('owner', 'wallSlot', 'wave_print', 'second', 61_000);
  await service.equipDecoration('owner', 'wallSlot', 'paper_lantern', 'first', 61_000);
  assert.equal(
    (await repo.get('owner'))!.equipped.wallSlot,
    'wave_print',
    'old retry cannot undo a later selection',
  );
  assert.equal(
    (await service.equipDecoration('owner', 'wallSlot', null, 'first', 61_000)).success,
    false,
  );
  await service.equipDecoration('owner', 'floorSlot', 'potted_plant', 'floor', 61_000);
  await service.equipDecoration('owner', 'wallSlot', null, 'remove', 61_000);
  const reopened = await new SushiService(repo).getOrInitRestaurant('owner', 61_000);
  assert.deepEqual(reopened.equipped, { wallSlot: null, floorSlot: 'potted_plant' });
  assert.equal(reopened.balanceUnits, before.balanceUnits);
  assert.equal(reopened.periodStartMs, before.periodStartMs);
  assert.deepEqual(reopened.inventory, before.inventory);
});
