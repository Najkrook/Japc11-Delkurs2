import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SushiService,
  InMemorySushiRepository,
  sushiService,
  sushiStorageKey,
  type SushiStorageLike,
} from '../src/course/sushi-game/service.ts';
import { unitsToWholeYen, yenToUnits } from '../src/course/sushi-game/economy.ts';
import { DEFAULT_CAP_MS, MS_PER_HOUR, MS_PER_MINUTE } from '../src/course/sushi-game/types.ts';

sushiService.setRepository(new InMemorySushiRepository());

test('SushiService: Initializes new restaurant with canonical defaults', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  const restaurant = await service.getOrInitRestaurant('student-alice', t0);

  assert.equal(restaurant.id, 'student-alice');
  assert.equal(restaurant.ownerUid, 'student-alice');
  assert.equal(restaurant.createdAtMs, t0);
  assert.equal(restaurant.accountedAtMs, t0);
  assert.equal(restaurant.periodStartMs, t0);
  assert.equal(restaurant.balanceUnits, 0);
  assert.equal(restaurant.uncollectedUnits, 0);
  assert.equal(restaurant.kitchenCapacity, 1);
  assert.equal(restaurant.serviceCapacity, 2);
  assert.equal(restaurant.averageRevenuePerOrder, 10);
  assert.equal(restaurant.capMs, DEFAULT_CAP_MS);
  assert.equal(restaurant.usedProductionMs, 0);
  assert.deepEqual(restaurant.permanentGrants, []);
  assert.deepEqual(restaurant.inventory, []);
  assert.deepEqual(restaurant.equipped, { wallSlot: null, floorSlot: null });
});

test('SushiService: Reopening existing restaurant evaluates lazy accrual up to server nowMs', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 0;
  await service.getOrInitRestaurant('student-bob', t0);

  // Return after 30 minutes
  const t30m = 30 * MS_PER_MINUTE;
  const reopened = await service.getOrInitRestaurant('student-bob', t30m);

  // 30 min at 10 yen/min = 300 yen (18,000,000 units)
  assert.equal(unitsToWholeYen(reopened.uncollectedUnits), 300);
  assert.equal(reopened.uncollectedUnits, 18_000_000);
  assert.equal(reopened.usedProductionMs, 30 * MS_PER_MINUTE);
  assert.equal(reopened.accountedAtMs, t30m);
  assert.equal(reopened.balanceUnits, 0); // Not collected yet
});

test('SushiService: Accrual clamps to 8-hour cap and stops production on long absence', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 0;
  await service.getOrInitRestaurant('student-charlie', t0);

  // Return after 10 hours (2 hours beyond 8h cap)
  const t10h = 10 * MS_PER_HOUR;
  const reopened = await service.getOrInitRestaurant('student-charlie', t10h);

  // Exactly 8 hours productive time = 480 min * 10 = 4,800 yen
  assert.equal(unitsToWholeYen(reopened.uncollectedUnits), 4800);
  assert.equal(reopened.usedProductionMs, DEFAULT_CAP_MS);
  assert.equal(reopened.accountedAtMs, t10h); // Clock advanced, but production stopped
});

test('SushiService: User isolation ensures independent states', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  await service.getOrInitRestaurant('user-1', 0);
  await service.getOrInitRestaurant('user-2', 0);

  // User 1 collects after 30 min
  await service.collectRevenue('user-1', 'req-1', 30 * MS_PER_MINUTE);

  const user1 = await service.getOrInitRestaurant('user-1', 30 * MS_PER_MINUTE);
  const user2 = await service.getOrInitRestaurant('user-2', 30 * MS_PER_MINUTE);

  assert.equal(unitsToWholeYen(user1.balanceUnits), 300);
  assert.equal(user1.uncollectedUnits, 0);

  assert.equal(user2.balanceUnits, 0);
  assert.equal(unitsToWholeYen(user2.uncollectedUnits), 300);
});

test('SushiService: collectRevenue transfers uncollected into spendable balance and resets timer', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  await service.getOrInitRestaurant('student-dave', 0);

  // Collect at T=60m
  const t60m = 60 * MS_PER_MINUTE;
  const result = await service.collectRevenue('student-dave', 'key-collect-1', t60m);

  assert.equal(result.wasAlreadyProcessed, false);
  assert.equal(result.collectedYen, 600); // 60 min * 10 yen
  assert.equal(result.collectedUnits, 36_000_000);
  assert.equal(unitsToWholeYen(result.state.balanceUnits), 600);
  assert.equal(result.state.uncollectedUnits, 0);
  assert.equal(result.state.usedProductionMs, 0);
  assert.equal(result.state.periodStartMs, t60m);
  assert.equal(result.state.accountedAtMs, t60m);
});

test('SushiService: Idempotent collection returns cached result on duplicate idempotencyKey', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  await service.getOrInitRestaurant('student-eve', 0);

  const t60m = 60 * MS_PER_MINUTE;
  const firstCall = await service.collectRevenue('student-eve', 'duplicate-key-123', t60m);
  assert.equal(firstCall.wasAlreadyProcessed, false);
  assert.equal(firstCall.collectedYen, 600);
  assert.equal(unitsToWholeYen(firstCall.state.balanceUnits), 600);

  // Immediate retry with the EXACT same key
  const secondCall = await service.collectRevenue('student-eve', 'duplicate-key-123', t60m + 1000);
  assert.equal(secondCall.wasAlreadyProcessed, true);
  assert.equal(secondCall.collectedYen, 0);
  assert.equal(secondCall.collectedUnits, 0);
  // Balance is preserved and NOT double-credited
  assert.equal(unitsToWholeYen(secondCall.state.balanceUnits), 600);
});

test('SushiService: Concurrent collections are serialized safely', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  await service.getOrInitRestaurant('student-frank', 0);

  const t30m = 30 * MS_PER_MINUTE;
  // Two concurrent collection requests with distinct keys arriving at same millisecond
  const [resA, resB] = await Promise.all([
    service.collectRevenue('student-frank', 'concurrent-key-A', t30m),
    service.collectRevenue('student-frank', 'concurrent-key-B', t30m),
  ]);

  // One of them collects the 300 yen; the other collects 0 yen (since register was just flushed)
  const totalCollectedYen = resA.collectedYen + resB.collectedYen;
  assert.equal(totalCollectedYen, 300);

  const finalState = await service.getOrInitRestaurant('student-frank', t30m);
  assert.equal(unitsToWholeYen(finalState.balanceUnits), 300);
  assert.equal(finalState.uncollectedUnits, 0);
});

test('SushiService: Validation and error paths', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  // Missing UID
  await assert.rejects(service.getOrInitRestaurant(''), /INVALID_UID/);

  // Missing idempotency key
  await assert.rejects(service.collectRevenue('student-grace', ''), /INVALID_IDEMPOTENCY_KEY/);

  // Collect on non-existent restaurant
  await assert.rejects(
    service.collectRevenue('student-nonexistent', 'key-1'),
    /RESTAURANT_NOT_FOUND/,
  );
});

test('InMemorySushiRepository: Backing storage mirrors state and hydrates across sessions', async () => {
  const mockStorageMap = new Map<string, string>();
  const mockStorage: SushiStorageLike = {
    getItem: (k: string) => mockStorageMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mockStorageMap.set(k, v);
    },
    removeItem: (k: string) => {
      mockStorageMap.delete(k);
    },
  };

  const uid = 'student-storage-1';
  const expectedKey = sushiStorageKey(uid);
  assert.equal(expectedKey, `japc11-dk2-sushi-v1-${uid}`);

  // Session 1: initialize and mutate state
  const repo1 = new InMemorySushiRepository(mockStorage);
  const service1 = new SushiService(repo1);
  await service1.getOrInitRestaurant(uid, 0);
  await service1.collectRevenue(uid, 'key-init', 30 * MS_PER_MINUTE);

  // Assert it was mirrored to backing storage
  assert.ok(mockStorageMap.has(expectedKey));
  const storedJson = JSON.parse(mockStorageMap.get(expectedKey)!);
  assert.equal(storedJson.id, uid);
  assert.equal(storedJson.balanceUnits, 18_000_000);

  // Session 2: Fresh repository instance (simulates page reload / F5)
  const repo2 = new InMemorySushiRepository(mockStorage);
  const service2 = new SushiService(repo2);

  // Reopening lazily hydrates from backing storage
  const restored = await service2.getOrInitRestaurant(uid, 30 * MS_PER_MINUTE);
  assert.equal(restored.id, uid);
  assert.equal(restored.balanceUnits, 18_000_000);
});

test('InMemorySushiRepository: Resilient against backing storage exceptions and corrupted JSON', async () => {
  // 1. Corrupted JSON in storage
  const corruptedStorageMap = new Map<string, string>();
  corruptedStorageMap.set(sushiStorageKey('student-corrupt'), '{ not-valid-json ]');
  const corruptStorage: SushiStorageLike = {
    getItem: (k: string) => corruptedStorageMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      corruptedStorageMap.set(k, v);
    },
    removeItem: (k: string) => {
      corruptedStorageMap.delete(k);
    },
  };

  const repoCorrupt = new InMemorySushiRepository(corruptStorage);
  const state = await repoCorrupt.get('student-corrupt');
  assert.equal(state, null, 'Corrupted JSON should be safely ignored and yield null');

  // 2. Storage throwing errors (private browsing or quota exceeded)
  const throwingStorage: SushiStorageLike = {
    getItem: () => {
      throw new Error('SecurityError: The operation is insecure');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('SecurityError');
    },
  };

  const repoThrowing = new InMemorySushiRepository(throwingStorage);
  const serviceThrowing = new SushiService(repoThrowing);

  // Should succeed in-memory without throwing
  const created = await serviceThrowing.getOrInitRestaurant('student-throw', 0);
  assert.equal(created.id, 'student-throw');
  const collected = await serviceThrowing.collectRevenue(
    'student-throw',
    'k-throw',
    10 * MS_PER_MINUTE,
  );
  assert.equal(collected.wasAlreadyProcessed, false);
});

test('InMemorySushiRepository: Clear removes backing storage entries', async () => {
  const mockStorageMap = new Map<string, string>();
  const mockStorage: SushiStorageLike = {
    getItem: (k: string) => mockStorageMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mockStorageMap.set(k, v);
    },
    removeItem: (k: string) => {
      mockStorageMap.delete(k);
    },
  };

  const repo = new InMemorySushiRepository(mockStorage);
  const service = new SushiService(repo);
  await service.getOrInitRestaurant('student-clear-1', 0);
  await service.getOrInitRestaurant('student-clear-2', 0);

  assert.ok(mockStorageMap.has(sushiStorageKey('student-clear-1')));
  assert.ok(mockStorageMap.has(sushiStorageKey('student-clear-2')));

  repo.clear();

  assert.equal(mockStorageMap.has(sushiStorageKey('student-clear-1')), false);
  assert.equal(mockStorageMap.has(sushiStorageKey('student-clear-2')), false);
});

test('SushiService: Default singleton in Node.js test environment has zero storage side-effects', () => {
  const defaultRepo = sushiService.getRepository() as InMemorySushiRepository;
  assert.ok(defaultRepo instanceof InMemorySushiRepository);
  assert.equal(
    defaultRepo.getBackingStorage(),
    null,
    'In Node.js (no window), backingStorage must be null',
  );
});

// ---------------------------------------------------------------------------
// Milestone 2 (Ticket 05): Permanent Grants & Service Sync Tests
// ---------------------------------------------------------------------------

test('SushiService: getOrInitRestaurant initializes cold start with initialGrants', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  const initialGrants = ['prep_counter', 'salmon_nigiri'];
  const state = await service.getOrInitRestaurant('student-cold-start', t0, initialGrants);

  assert.equal(state.id, 'student-cold-start');
  assert.deepEqual(
    state.permanentGrants,
    ['prep_counter', 'salmon_nigiri'],
    'New restaurant initialized with pre-earned study grants',
  );
});

test('SushiService: getOrInitRestaurant on reopening merges newly earned grants into permanentGrants', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  await service.getOrInitRestaurant('student-reopen', t0, ['prep_counter']);

  const t1 = t0 + 30 * MS_PER_MINUTE;
  const reopened = await service.getOrInitRestaurant('student-reopen', t1, [
    'prep_counter',
    'cap_extension_12h',
  ]);

  assert.deepEqual(
    reopened.permanentGrants,
    ['prep_counter', 'cap_extension_12h'],
    'Reopened restaurant seamlessly merges new grants into permanentGrants',
  );
  assert.equal(reopened.uncollectedUnits, 30 * 10 * 60_000, '30m idle earnings accrued');
});

test('SushiService: getOrInitRestaurant reopening with empty or fewer grants never revokes previously stored grants', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  await service.getOrInitRestaurant('student-drop', t0, [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
  ]);

  // Reopen with fewer grants (e.g. unmarking vocabulary):
  const t1 = t0 + 10 * MS_PER_MINUTE;
  const reopened = await service.getOrInitRestaurant('student-drop', t1, ['prep_counter']);

  assert.deepEqual(
    reopened.permanentGrants,
    ['prep_counter', 'salmon_nigiri', 'paper_lantern'],
    'Stored grants are preserved even if current progress yields fewer grants',
  );

  // Reopen with empty grants:
  const t2 = t1 + 10 * MS_PER_MINUTE;
  const reopenedEmpty = await service.getOrInitRestaurant('student-drop', t2, []);
  assert.deepEqual(
    reopenedEmpty.permanentGrants,
    ['prep_counter', 'salmon_nigiri', 'paper_lantern'],
    'Stored grants are preserved when reopening with empty grants',
  );
});

test('SushiService: syncMedalGrants validates uid and earnedGrants array', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  await assert.rejects(
    async () => {
      // @ts-expect-error test invalid uid
      await service.syncMedalGrants('', ['prep_counter']);
    },
    { message: /INVALID_UID/ },
  );

  await assert.rejects(
    async () => {
      // @ts-expect-error test invalid grants
      await service.syncMedalGrants('student-valid', 'not-an-array');
    },
    { message: /INVALID_GRANTS/ },
  );
});

test('SushiService: syncMedalGrants initializes restaurant on demand if not yet existing (cold start)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  const state = await service.syncMedalGrants(
    'student-direct-sync',
    ['prep_counter', 'conveyor_belt'],
    t0,
  );

  assert.equal(state.id, 'student-direct-sync');
  assert.deepEqual(state.permanentGrants, ['prep_counter', 'conveyor_belt']);
  assert.equal(state.balanceUnits, 0);
  assert.equal(state.uncollectedUnits, 0);
});

test('SushiService: syncMedalGrants monotonically accumulates grants and dedupes', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  await service.getOrInitRestaurant('student-accum', t0);

  const s1 = await service.syncMedalGrants('student-accum', ['prep_counter'], t0 + 1000);
  assert.deepEqual(s1.permanentGrants, ['prep_counter']);

  const s2 = await service.syncMedalGrants(
    'student-accum',
    ['prep_counter', 'salmon_nigiri', 'prep_counter'],
    t0 + 2000,
  );
  assert.deepEqual(s2.permanentGrants, ['prep_counter', 'salmon_nigiri']);

  const s3 = await service.syncMedalGrants(
    'student-accum',
    ['cap_extension_12h', 'conveyor_belt'],
    t0 + 3000,
  );
  assert.deepEqual(s3.permanentGrants, [
    'prep_counter',
    'salmon_nigiri',
    'cap_extension_12h',
    'conveyor_belt',
  ]);
});

test('SushiService: syncMedalGrants strict non-revocation on study mastery drop', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  await service.syncMedalGrants(
    'student-mastery-drop',
    ['prep_counter', 'salmon_nigiri', 'paper_lantern'],
    t0,
  );

  // Student unmarks knowledge: sync with only prep_counter
  const updated = await service.syncMedalGrants(
    'student-mastery-drop',
    ['prep_counter'],
    t0 + 5000,
  );
  assert.deepEqual(
    updated.permanentGrants,
    ['prep_counter', 'salmon_nigiri', 'paper_lantern'],
    'Grants are strictly non-revocable on mastery drop',
  );
});

test('SushiService: syncMedalGrants strict non-revocation on full course reset', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  await service.syncMedalGrants(
    'student-reset',
    ['prep_counter', 'cap_extension_12h', 'conveyor_belt', 'wave_print'],
    t0,
  );

  // Full course reset: sync with empty array
  const updated = await service.syncMedalGrants('student-reset', [], t0 + 5000);
  assert.deepEqual(
    updated.permanentGrants,
    ['prep_counter', 'cap_extension_12h', 'conveyor_belt', 'wave_print'],
    'Grants are strictly non-revocable on course reset',
  );
});

test('SushiService: syncMedalGrants concurrent synchronization serialize and merge safely', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  await service.getOrInitRestaurant('student-concurrent', t0);

  // Concurrent sync calls
  await Promise.all([
    service.syncMedalGrants('student-concurrent', ['prep_counter', 'salmon_nigiri'], t0 + 100),
    service.syncMedalGrants('student-concurrent', ['cap_extension_12h'], t0 + 100),
    service.syncMedalGrants('student-concurrent', ['conveyor_belt', 'wave_print'], t0 + 100),
  ]);

  const final = await service.getOrInitRestaurant('student-concurrent', t0 + 200);
  const expected = [
    'prep_counter',
    'salmon_nigiri',
    'cap_extension_12h',
    'conveyor_belt',
    'wave_print',
  ];
  for (const exp of expected) {
    assert.ok(
      final.permanentGrants.includes(exp),
      `Final grants must contain ${exp} after concurrent sync`,
    );
  }
  assert.equal(final.permanentGrants.length, 5);
});

test('SushiService: syncMedalGrants advances lazy idle revenue accrual to nowMs preserving uncollectedUnits', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const t0 = 1_000_000;
  await service.getOrInitRestaurant('student-accrual-sync', t0);

  // 15 minutes elapsed
  const t15m = t0 + 15 * MS_PER_MINUTE;
  const synced = await service.syncMedalGrants('student-accrual-sync', ['prep_counter'], t15m);

  assert.equal(synced.uncollectedUnits, 15 * 10 * 60_000, '15 minutes accrued (150 yen)');
  assert.equal(synced.usedProductionMs, 15 * MS_PER_MINUTE);
  assert.equal(synced.accountedAtMs, t15m);
});

test('SushiService: processedRequests map is bounded to MAX_PROCESSED_REQUESTS (200) and evicts oldest entries', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'student-bounded-requests';
  await service.getOrInitRestaurant(uid, 1_000);

  for (let i = 1; i <= 210; i++) {
    await service.collectRevenue(uid, `req-${i}`, 1_000 + i * 1_000);
  }

  const final = await service.getOrInitRestaurant(uid, 250_000);
  const keys = Object.keys(final.processedRequests);
  assert.equal(keys.length, 200, 'processedRequests must be capped at 200 entries');
  assert.ok(!Object.hasOwn(final.processedRequests, 'req-1'), 'Oldest entry req-1 must be evicted');
  assert.ok(
    !Object.hasOwn(final.processedRequests, 'req-10'),
    'Oldest entry req-10 must be evicted',
  );
  assert.ok(Object.hasOwn(final.processedRequests, 'req-11'), 'Entry req-11 must be retained');
  assert.ok(
    Object.hasOwn(final.processedRequests, 'req-210'),
    'Newest entry req-210 must be retained',
  );
});
