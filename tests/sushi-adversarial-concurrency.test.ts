import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SushiService,
  InMemorySushiRepository,
} from '../src/course/sushi-game/service.ts';
import {
  unitsToWholeYen,
  yenToUnits,
} from '../src/course/sushi-game/economy.ts';
import {
  MS_PER_MINUTE,
  MS_PER_HOUR,
} from '../src/course/sushi-game/types.ts';

test('Adversarial Concurrency: 50 simultaneous identical idempotencyKey requests yield exactly 1 transfer', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'adversarial-user-identical';
  const t0 = 1_000_000;
  await service.getOrInitRestaurant(uid, t0);

  // 60 minutes accrual = 600 yen (36,000,000 units)
  const t60m = t0 + 60 * MS_PER_MINUTE;
  const duplicateKey = 'shared-idempotency-key-xyz';

  // Fire 50 concurrent requests simultaneously
  const N = 50;
  const promises = Array.from({ length: N }, () =>
    service.collectRevenue(uid, duplicateKey, t60m),
  );

  const results = await Promise.all(promises);

  const processedCount = results.filter((r) => !r.wasAlreadyProcessed).length;
  const duplicateCount = results.filter((r) => r.wasAlreadyProcessed).length;

  assert.equal(processedCount, 1, 'Exactly one request must execute the transfer');
  assert.equal(duplicateCount, N - 1, 'All other 49 requests must be flagged as already processed');

  const processedResult = results.find((r) => !r.wasAlreadyProcessed)!;
  assert.equal(processedResult.collectedYen, 600, 'Processed request must collect 600 yen');
  assert.equal(processedResult.collectedUnits, 36_000_000, 'Processed request must collect 36M units');

  for (const dup of results.filter((r) => r.wasAlreadyProcessed)) {
    assert.equal(dup.collectedYen, 0, 'Duplicate request must yield 0 yen');
    assert.equal(dup.collectedUnits, 0, 'Duplicate request must yield 0 units');
  }

  // Inspect authoritative state in repository
  const finalState = await service.getOrInitRestaurant(uid, t60m);
  assert.equal(unitsToWholeYen(finalState.balanceUnits), 600, 'Authoritative balance must be exactly 600 yen');
  assert.equal(finalState.balanceUnits, 36_000_000, 'Authoritative balance must be exactly 36M units');
  assert.equal(finalState.uncollectedUnits, 0, 'Uncollected units must be 0');
});

test('Adversarial Concurrency: 30 simultaneous distinct idempotencyKey requests serialize without balance doubling or lost funds', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'adversarial-user-distinct';
  const t0 = 2_000_000;
  await service.getOrInitRestaurant(uid, t0);

  // 120 minutes accrual = 1,200 yen (72,000,000 units)
  const t120m = t0 + 120 * MS_PER_MINUTE;

  const N = 30;
  const promises = Array.from({ length: N }, (_, i) =>
    service.collectRevenue(uid, `distinct-key-${i}`, t120m),
  );

  const results = await Promise.all(promises);

  // Invariant: Total collected across all results must equal exactly 1,200 yen
  const totalCollectedUnits = results.reduce((acc, r) => acc + r.collectedUnits, 0);
  const totalCollectedYen = results.reduce((acc, r) => acc + r.collectedYen, 0);

  assert.equal(totalCollectedUnits, 72_000_000, 'Conservation of money: sum of collectedUnits must equal exactly 72M units');
  assert.equal(totalCollectedYen, 1200, 'Conservation of money: sum of collectedYen must equal exactly 1200 yen');

  // Verify that every distinct key was recorded and none was flagged as already processed
  for (const res of results) {
    assert.equal(res.wasAlreadyProcessed, false, 'Each distinct key is unique and not already processed');
  }

  // Authoritative state check
  const finalState = await service.getOrInitRestaurant(uid, t120m);
  assert.equal(finalState.balanceUnits, 72_000_000, 'Final balance must strictly equal total collected units');
  assert.equal(finalState.uncollectedUnits, 0, 'Final uncollected units must be 0');
  assert.equal(Object.keys(finalState.processedRequests || {}).length, N, 'All distinct keys must be recorded in processedRequests');
});

test('Adversarial Concurrency: Rapid alternating collection waves maintain exact fund conservation', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'adversarial-user-waves';
  const t0 = 0;
  await service.getOrInitRestaurant(uid, t0);

  let currentTime = t0;
  let totalAccumulatedUnits = 0;

  // 10 waves, 1 minute elapsed between waves. Each wave fires 5 concurrent requests (1 with fresh key, 4 duplicates)
  for (let wave = 1; wave <= 10; wave++) {
    currentTime += 1 * MS_PER_MINUTE;
    const waveKey = `wave-key-${wave}`;

    const batch = Array.from({ length: 5 }, () =>
      service.collectRevenue(uid, waveKey, currentTime),
    );

    const waveResults = await Promise.all(batch);
    const waveCollectedUnits = waveResults.reduce((acc, r) => acc + r.collectedUnits, 0);
    totalAccumulatedUnits += waveCollectedUnits;

    // In each wave, exactly 1 minute of production = 10 yen = 600,000 units
    assert.equal(waveCollectedUnits, 600_000, `Wave ${wave} must collect exactly 600,000 units`);
  }

  assert.equal(totalAccumulatedUnits, 6_000_000, '10 minutes of production must accumulate exactly 6,000,000 units (100 yen)');

  const finalState = await service.getOrInitRestaurant(uid, currentTime);
  assert.equal(finalState.balanceUnits, 6_000_000, 'Final balance must match accumulated units');
  assert.equal(finalState.uncollectedUnits, 0, 'Uncollected units must be 0 after all collections');
});

test('Adversarial Concurrency: Multi-user swarm with 10 users and 100 interleaved operations guarantees strict isolation', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const userIds = Array.from({ length: 10 }, (_, i) => `student-user-${i}`);
  const t0 = 10_000_000;

  // Initialize all users
  await Promise.all(userIds.map((uid) => service.getOrInitRestaurant(uid, t0)));

  // Time advances 30 minutes
  const t30m = t0 + 30 * MS_PER_MINUTE;

  // 100 interleaved operations across all users
  const operations: Promise<unknown>[] = [];
  const userCollectedSums: Record<string, number> = {};
  for (const uid of userIds) {
    userCollectedSums[uid] = 0;
  }

  for (let i = 0; i < 100; i++) {
    const uid = userIds[i % userIds.length];
    const opType = i % 3;

    if (opType === 0) {
      // Lazy evaluation getOrInit
      operations.push(service.getOrInitRestaurant(uid, t30m));
    } else if (opType === 1) {
      // Unique collection
      const key = `user-op-key-${i}`;
      operations.push(
        service.collectRevenue(uid, key, t30m).then((res) => {
          userCollectedSums[uid] += res.collectedUnits;
          return res;
        }),
      );
    } else {
      // Duplicate collection attempt
      const key = `user-op-key-shared-${uid}`;
      operations.push(
        service.collectRevenue(uid, key, t30m).then((res) => {
          userCollectedSums[uid] += res.collectedUnits;
          return res;
        }),
      );
    }
  }

  await Promise.all(operations);

  // Verify isolation for every single user
  for (const uid of userIds) {
    const state = await service.getOrInitRestaurant(uid, t30m);
    assert.equal(state.id, uid, `State ID must match user ${uid}`);
    assert.equal(state.ownerUid, uid, `Owner UID must match user ${uid}`);

    // Invariant: User balance must strictly match what was returned in that user's collection calls
    assert.equal(
      state.balanceUnits,
      userCollectedSums[uid],
      `User ${uid} balance must strictly equal the units collected by that user`,
    );

    // Verify processedRequests contains only keys for this user
    for (const key of Object.keys(state.processedRequests || {})) {
      assert.ok(
        !key.includes('student-user-') || key.includes(uid),
        `Key ${key} in user ${uid} must not belong to another user`,
      );
    }
  }
});

test('Adversarial Stress: Prototype pollution / Object prototype keys in idempotencyKey', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-prototype-check';
  const t0 = 0;
  await service.getOrInitRestaurant(uid, t0);

  // Accrue 10 minutes (100 yen = 6,000,000 units)
  const t10m = 10 * MS_PER_MINUTE;

  // Test idempotencyKey collision with Object.prototype properties
  // E.g. 'toString', 'valueOf', 'constructor', '__proto__'
  const prototypeProperties = ['toString', 'valueOf', 'constructor', 'hasOwnProperty', 'isPrototypeOf'];

  for (const prop of prototypeProperties) {
    const userForProp = `${uid}-${prop}`;
    await service.getOrInitRestaurant(userForProp, t0);

    // Initial collection attempt with prototype property name as key
    const res = await service.collectRevenue(userForProp, prop, t10m);

    // A valid fresh key should NOT be falsely treated as already processed
    // If res.wasAlreadyProcessed is true, this reveals a vulnerability where
    // Object.prototype properties trick the idempotency check!
    assert.equal(
      res.wasAlreadyProcessed,
      false,
      `Idempotency key '${prop}' must not falsely trigger wasAlreadyProcessed via Object prototype lookup`,
    );
    assert.equal(
      res.collectedYen,
      100,
      `Idempotency key '${prop}' must collect the 100 accrued yen`,
    );

    // Immediate retry with the same key should now legitimately be treated as processed
    const retryRes = await service.collectRevenue(userForProp, prop, t10m);
    assert.equal(
      retryRes.wasAlreadyProcessed,
      true,
      `Retry with '${prop}' must be flagged as already processed`,
    );
    assert.equal(retryRes.collectedYen, 0, 'Retry must yield 0 yen');
  }
});
