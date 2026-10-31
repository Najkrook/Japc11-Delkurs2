import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SushiService,
  InMemorySushiRepository,
  type SushiStorageLike,
} from '../src/course/sushi-game/service.ts';
import { MS_PER_MINUTE } from '../src/course/sushi-game/types.ts';

test('Deep Adversarial: __proto__ key handles fresh collection, retry idempotency, and preserves Object.prototype purity', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'proto-adversarial-user';
  const t0 = 1_000_000;
  await service.getOrInitRestaurant(uid, t0);

  const t10m = t0 + 10 * MS_PER_MINUTE; // 100 yen (6,000,000 units)

  // 1. Fresh call with '__proto__'
  const res1 = await service.collectRevenue(uid, '__proto__', t10m);
  assert.equal(
    res1.wasAlreadyProcessed,
    false,
    '__proto__ key must NOT trigger false alreadyProcessed on fresh call',
  );
  assert.equal(res1.collectedYen, 100, '__proto__ key must collect accrued 100 yen');
  assert.equal(res1.collectedUnits, 6_000_000, '__proto__ key must collect 6M units');
  assert.equal(res1.state.balanceUnits, 6_000_000, 'balanceUnits must reflect 6M units');

  // 2. Immediate retry with '__proto__'
  const res2 = await service.collectRevenue(uid, '__proto__', t10m + 1000);
  assert.equal(
    res2.wasAlreadyProcessed,
    true,
    '__proto__ key retry must be recognized as already processed',
  );
  assert.equal(res2.collectedYen, 0, '__proto__ retry must yield 0 yen');
  assert.equal(res2.collectedUnits, 0, '__proto__ retry must yield 0 units');
  assert.equal(res2.state.balanceUnits, 6_000_000, 'balanceUnits must not be double credited');

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
  assert.equal(
    Object.prototype.hasOwnProperty('resultSummary'),
    false,
    'Object.prototype hasOwnProperty must be false',
  );
});

test('Deep Adversarial: Distinctiveness across all 5 prototype keys on the same restaurant instance', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'single-user-all-prototype-keys';
  let currentTime = 10_000_000;
  await service.getOrInitRestaurant(uid, currentTime);

  const targetKeys = ['toString', 'valueOf', 'constructor', 'hasOwnProperty', '__proto__'];

  // Apply each key sequentially with 10 minutes accrued between each
  let totalExpectedUnits = 0;
  for (let i = 0; i < targetKeys.length; i++) {
    const key = targetKeys[i];
    currentTime += 10 * MS_PER_MINUTE; // accrue 100 yen (6,000,000 units)
    totalExpectedUnits += 6_000_000;

    const res = await service.collectRevenue(uid, key, currentTime);
    assert.equal(
      res.wasAlreadyProcessed,
      false,
      `Key '${key}' (index ${i}) must be recognized as fresh even when prior prototype keys exist`,
    );
    assert.equal(res.collectedYen, 100, `Key '${key}' must collect 100 yen`);
    assert.equal(res.collectedUnits, 6_000_000, `Key '${key}' must collect 6,000,000 units`);
    assert.equal(
      res.state.balanceUnits,
      totalExpectedUnits,
      `Balance must accurately track accumulated units`,
    );
  }

  // Now verify that EVERY single one of the 5 keys is recognized as already processed upon retry
  for (const key of targetKeys) {
    const retryRes = await service.collectRevenue(uid, key, currentTime + 5000);
    assert.equal(
      retryRes.wasAlreadyProcessed,
      true,
      `Key '${key}' must be recognized as already processed during retry phase`,
    );
    assert.equal(retryRes.collectedYen, 0, `Retry for '${key}' must yield 0 yen`);
    assert.equal(retryRes.collectedUnits, 0, `Retry for '${key}' must yield 0 units`);
    assert.equal(
      retryRes.state.balanceUnits,
      totalExpectedUnits,
      `Balance must not change on retry`,
    );
  }

  // Check that an unrelated prototype property is STILL recognized as fresh
  currentTime += 10 * MS_PER_MINUTE;
  const isProtoRes = await service.collectRevenue(uid, 'isPrototypeOf', currentTime);
  assert.equal(isProtoRes.wasAlreadyProcessed, false, "'isPrototypeOf' must still be fresh");
  assert.equal(isProtoRes.collectedYen, 100, "'isPrototypeOf' must collect accrued yen");

  // Verify state persistence and processedRequests integrity
  const finalState = await service.getOrInitRestaurant(uid, currentTime);
  for (const key of [...targetKeys, 'isPrototypeOf']) {
    assert.equal(
      Object.hasOwn(finalState.processedRequests || {}, key),
      true,
      `Key '${key}' must be an own property of finalState.processedRequests`,
    );
  }
});

test('Deep Adversarial: Concurrent duplicate requests with __proto__ key serialize atomically', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'concurrent-proto-user';
  const t0 = 20_000_000;
  await service.getOrInitRestaurant(uid, t0);

  const t30m = t0 + 30 * MS_PER_MINUTE; // 300 yen (18,000,000 units)
  const N = 25;

  const promises = Array.from({ length: N }, () => service.collectRevenue(uid, '__proto__', t30m));

  const results = await Promise.all(promises);

  const processedCount = results.filter((r) => !r.wasAlreadyProcessed).length;
  const duplicateCount = results.filter((r) => r.wasAlreadyProcessed).length;

  assert.equal(processedCount, 1, 'Exactly 1 request with key __proto__ must execute the transfer');
  assert.equal(
    duplicateCount,
    N - 1,
    'All other concurrent __proto__ requests must be flagged as duplicates',
  );

  const winner = results.find((r) => !r.wasAlreadyProcessed)!;
  assert.equal(winner.collectedYen, 300, 'Winner must collect 300 yen');
  assert.equal(winner.collectedUnits, 18_000_000, 'Winner must collect 18M units');

  const finalState = await service.getOrInitRestaurant(uid, t30m);
  assert.equal(finalState.balanceUnits, 18_000_000, 'Authoritative balance must be 18M units');
});

test('Deep Adversarial: Concurrent distinct prototype keys execute safely and conserve funds', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'concurrent-distinct-proto-keys';
  const t0 = 30_000_000;
  await service.getOrInitRestaurant(uid, t0);

  const t60m = t0 + 60 * MS_PER_MINUTE; // 600 yen (36,000,000 units)
  const targetKeys = ['toString', 'valueOf', 'constructor', 'hasOwnProperty', '__proto__'];

  // Fire all 5 distinct prototype keys concurrently at the exact same millisecond
  const promises = targetKeys.map((key) => service.collectRevenue(uid, key, t60m));
  const results = await Promise.all(promises);

  // All 5 should be accepted as unique keys
  for (let i = 0; i < results.length; i++) {
    assert.equal(
      results[i].wasAlreadyProcessed,
      false,
      `Key '${targetKeys[i]}' was never sent before, so wasAlreadyProcessed must be false`,
    );
  }

  // Exact conservation of funds: sum of collectedUnits across all 5 must equal 36,000,000 units
  const totalCollectedUnits = results.reduce((sum, r) => sum + r.collectedUnits, 0);
  assert.equal(
    totalCollectedUnits,
    36_000_000,
    'Sum of collected units must strictly equal 36M units',
  );

  const finalState = await service.getOrInitRestaurant(uid, t60m);
  assert.equal(
    finalState.balanceUnits,
    36_000_000,
    'Final authoritative balance must equal 36M units',
  );
  assert.equal(finalState.uncollectedUnits, 0, 'Uncollected units must be 0');

  // Retrying all 5 keys must now yield wasAlreadyProcessed: true
  const retryResults = await Promise.all(
    targetKeys.map((key) => service.collectRevenue(uid, key, t60m + 1000)),
  );
  for (let i = 0; i < retryResults.length; i++) {
    assert.equal(
      retryResults[i].wasAlreadyProcessed,
      true,
      `Retry of key '${targetKeys[i]}' must be flagged as already processed`,
    );
    assert.equal(
      retryResults[i].collectedUnits,
      0,
      `Retry of key '${targetKeys[i]}' must yield 0 units`,
    );
  }
});

test('Deep Adversarial: Backing storage JSON serialization roundtrip with prototype keys', async () => {
  const mockStorageMap = new Map<string, string>();
  const mockStorage: SushiStorageLike = {
    getItem: (key: string) => mockStorageMap.get(key) ?? null,
    setItem: (key: string, val: string) => {
      mockStorageMap.set(key, val);
    },
    removeItem: (key: string) => {
      mockStorageMap.delete(key);
    },
  };

  const repo1 = new InMemorySushiRepository(mockStorage);
  const service1 = new SushiService(repo1);

  const uid = 'backing-storage-proto-user';
  const t0 = 40_000_000;
  await service1.getOrInitRestaurant(uid, t0);

  const targetKeys = ['toString', 'valueOf', 'constructor', 'hasOwnProperty', '__proto__'];
  let curTime = t0;

  for (const key of targetKeys) {
    curTime += 10 * MS_PER_MINUTE;
    const res = await service1.collectRevenue(uid, key, curTime);
    assert.equal(res.wasAlreadyProcessed, false);
  }

  // Now create a completely fresh repository instance simulating a new browser tab/session
  // that hydrates from mockStorage via JSON.parse
  const repo2 = new InMemorySushiRepository(mockStorage);
  const service2 = new SushiService(repo2);

  // Test that hydrated state recognizes all 5 prototype keys as already processed
  for (const key of targetKeys) {
    const checkRes = await service2.collectRevenue(uid, key, curTime + 1000);
    assert.equal(
      checkRes.wasAlreadyProcessed,
      true,
      `Hydrated state from JSON must recognize '${key}' as already processed`,
    );
    assert.equal(checkRes.collectedUnits, 0);
  }

  // And a new fresh key is still accepted
  curTime += 10 * MS_PER_MINUTE;
  const freshRes = await service2.collectRevenue(uid, 'fresh-non-prototype-key', curTime);
  assert.equal(freshRes.wasAlreadyProcessed, false, 'Hydrated repository accepts fresh key');
  assert.equal(freshRes.collectedYen, 100, 'Fresh key collects 100 yen');
});
