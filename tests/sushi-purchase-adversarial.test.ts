/**
 * Adversarial & Stress Test Suite for Milestone 3
 * Tickets 06, 07, 08: Shop Catalog, Capacity & Cap Upgrades
 *
 * Tests concurrency swarms, prototype pollution attacks, idempotency under race conditions,
 * and currency conservation during interleaved collections and purchases.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SushiService,
  InMemorySushiRepository,
  type SushiStorageLike,
} from '../src/course/sushi-game/service.ts';
import { yenToUnits, unitsToWholeYen } from '../src/course/sushi-game/economy.ts';
import { MS_PER_MINUTE } from '../src/course/sushi-game/types.ts';

test('Adversarial-Purchase: __proto__ key handles fresh purchase, retry idempotency, and preserves Object.prototype purity', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'proto-buyer';
  const t0 = 1_000_000;

  // Unlocked prep_counter (300 yen), starting balance 500 yen
  await service.getOrInitRestaurant(uid, t0, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(500) },
    result: null,
  }));

  // 1. Fresh purchase with '__proto__'
  const res1 = await service.purchaseCatalogItem(uid, 'prep_counter', '__proto__', t0 + 1000);
  assert.equal(res1.success, true);
  assert.equal(
    res1.wasAlreadyProcessed,
    false,
    '__proto__ key must NOT trigger false alreadyProcessed on fresh call',
  );
  assert.equal(res1.debitedYen, 50);
  assert.equal(unitsToWholeYen(res1.state.balanceUnits), 450);

  // 2. Retry with '__proto__' key
  const res2 = await service.purchaseCatalogItem(uid, 'prep_counter', '__proto__', t0 + 2000);
  assert.equal(res2.success, true);
  assert.equal(
    res2.wasAlreadyProcessed,
    true,
    '__proto__ retry must be recognized as already processed',
  );
  assert.equal(res2.debitedUnits, 3_000_000);
  assert.equal(unitsToWholeYen(res2.state.balanceUnits), 450, 'Balance must NOT be debited twice');

  // 3. Strict prototype purity check: verify Object.prototype was NOT polluted
  const cleanObject: any = {};
  assert.equal(
    cleanObject.processedAtMs,
    undefined,
    'Object.prototype must not have processedAtMs',
  );
  assert.equal(
    cleanObject.resultSummary,
    undefined,
    'Object.prototype must not have resultSummary',
  );
  assert.equal(
    Object.prototype.hasOwnProperty('processedAtMs'),
    false,
    'Object.prototype hasOwnProperty must be false',
  );
});

test('Adversarial-Purchase: Concurrent duplicate rapid-clicks with SAME idempotency key serialize safely', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'rapid-clicker';
  const t0 = 1_000_000;

  // User has exactly 300 yen (enough for 1 prep_counter)
  await service.getOrInitRestaurant(uid, t0, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(50) },
    result: null,
  }));

  const key = 'rapid_click_key_123';
  const promises = [];
  // 15 simultaneous clicks
  for (let i = 0; i < 15; i++) {
    promises.push(service.purchaseCatalogItem(uid, 'prep_counter', key, t0 + i * 10));
  }

  const results = await Promise.all(promises);

  // All 15 calls should return success: true
  assert.equal(results.length, 15);
  for (const r of results) {
    assert.equal(r.success, true);
  }

  // Exactly one call should be fresh (wasAlreadyProcessed: false)
  const freshCount = results.filter((r) => r.wasAlreadyProcessed === false).length;
  const cachedCount = results.filter((r) => r.wasAlreadyProcessed === true).length;
  assert.equal(freshCount, 1, 'Exactly one purchase call must execute');
  assert.equal(cachedCount, 14, '14 calls must return cached result');

  // Verify final repository state
  const finalState = await repo.get(uid);
  assert.ok(finalState);
  assert.equal(finalState.balanceUnits, 0, 'Balance must be 0 (no double debiting)');
  assert.deepEqual(
    finalState.inventory,
    ['prep_counter'],
    'Item must appear in inventory exactly once',
  );
  assert.equal(finalState.kitchenCapacity, 3);
});

test('Adversarial-Purchase: Concurrent swarm with DIFFERENT idempotency keys cannot overspend or duplicate items', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'swarm-buyer';
  const t0 = 1_000_000;

  // User has 300 yen (enough for prep_counter only once)
  await service.getOrInitRestaurant(uid, t0, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(50) },
    result: null,
  }));

  // 20 concurrent purchase calls with DISTINCT idempotency keys
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(
      service.purchaseCatalogItem(uid, 'prep_counter', `key_distinct_${i}`, t0 + i * 5),
    );
  }

  const results = await Promise.all(promises);

  const successResults = results.filter((r) => r.success === true);
  const failureResults = results.filter((r) => r.success === false);

  assert.equal(successResults.length, 1, 'Exactly one purchase can succeed');
  assert.equal(failureResults.length, 19, '19 purchases must be rejected');

  // The 19 rejections must be ALREADY_OWNED (or INSUFFICIENT_FUNDS)
  for (const f of failureResults) {
    assert.ok(
      f.reason === 'ALREADY_OWNED' || f.reason === 'INSUFFICIENT_FUNDS',
      `Rejection reason must be ALREADY_OWNED or INSUFFICIENT_FUNDS, got ${f.reason}`,
    );
  }

  // Repository state must be strictly consistent
  const state = await repo.get(uid);
  assert.ok(state);
  assert.equal(state.balanceUnits, 0);
  assert.deepEqual(state.inventory, ['prep_counter']);
  assert.equal(state.kitchenCapacity, 3);
});

test('Adversarial-Purchase: Interleaved concurrent purchases and revenue collections preserve currency conservation', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'interleaved-user';
  const t0 = 1_000_000;

  // User unlocked prep_counter (300 yen) and cap_extension_12h (1800 yen), starting balance 5,000 yen
  await service.getOrInitRestaurant(uid, t0, ['prep_counter', 'cap_extension_12h']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(5000) },
    result: null,
  }));

  // Launch parallel operations: collect revenue and purchase prep counter
  const t10m = t0 + 10 * MS_PER_MINUTE; // 100 yen accrued
  const p1 = service.collectRevenue(uid, 'collect_int_1', t10m);
  const p2 = service.purchaseCatalogItem(uid, 'prep_counter', 'buy_int_1', t10m);

  const [resCollect, resBuy] = await Promise.all([p1, p2]);

  assert.equal(resCollect.wasAlreadyProcessed, false);
  assert.equal(resBuy.success, true);

  // Final state:
  // Initial balance: 5,000 yen
  // Collected: 100 yen
  // Spent: 300 yen
  // Net balance must be exactly 5,000 + 100 - 300 = 4,800 yen!
  const finalState = await repo.get(uid);
  assert.ok(finalState);
  assert.equal(
    unitsToWholeYen(finalState.balanceUnits),
    5050,
    'Interleaved collect and purchase must conserve exact balance (5000 + 100 - 50 = 5050)',
  );
  assert.deepEqual(finalState.inventory, ['prep_counter']);
  assert.equal(finalState.kitchenCapacity, 3);
});

test('Adversarial-Purchase: Multi-user swarm (10 users x 10 concurrent requests) maintains strict per-user isolation', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const t0 = 1_000_000;
  const userCount = 10;

  // Initialize 10 users with prep_counter grant and 600 yen balance each
  for (let i = 0; i < userCount; i++) {
    const uid = `swarm-user-${i}`;
    await service.getOrInitRestaurant(uid, t0, ['prep_counter']);
    await repo.transaction(uid, async (current) => ({
      state: { ...current!, balanceUnits: yenToUnits(600) },
      result: null,
    }));
  }

  // Each user launches 10 concurrent purchase requests for prep_counter with the same idempotency key
  const allPromises = [];
  for (let i = 0; i < userCount; i++) {
    const uid = `swarm-user-${i}`;
    for (let c = 0; c < 10; c++) {
      allPromises.push(
        service.purchaseCatalogItem(uid, 'prep_counter', `key_user_${i}`, t0 + c * 10),
      );
    }
  }

  await Promise.all(allPromises);

  // Verify all 10 users have independent, correct final balances
  for (let i = 0; i < userCount; i++) {
    const uid = `swarm-user-${i}`;
    const state = await repo.get(uid);
    assert.ok(state, `State for ${uid} must exist`);
    assert.equal(
      unitsToWholeYen(state.balanceUnits),
      550,
      `${uid} must have exactly 600 - 50 = 550 yen`,
    );
    assert.deepEqual(state.inventory, ['prep_counter']);
    assert.equal(state.kitchenCapacity, 3);
  }
});
