import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SushiService,
  InMemorySushiRepository,
  type SushiRestaurantRepository,
} from '../src/course/sushi-game/service.ts';
import { MS_PER_MINUTE, type SushiRestaurantState } from '../src/course/sushi-game/types.ts';

test('Medal Sync Concurrency: 50 simultaneous concurrent calls with overlapping and distinct grants converge to exact set union', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-concurrency-50';
  const t0 = 1_000_000;
  await service.getOrInitRestaurant(uid, t0);

  // Available grant pool of 12 distinct grants (7 canonical MVP + 5 extended)
  const grantPool = [
    'prep_counter',
    'salmon_nigiri',
    'paper_lantern',
    'cap_extension_12h',
    'potted_plant',
    'conveyor_belt',
    'wave_print',
    'tuna_roll',
    'neon_sign',
    'tea_set',
    'master_knife',
    'golden_noren',
  ];

  // Generate 50 concurrent calls with deterministic pseudo-random overlapping subsets
  const N = 50;
  const calls: { grants: string[]; timeOffset: number }[] = [];
  const allSubmittedGrants = new Set<string>();

  for (let i = 0; i < N; i++) {
    // Pick 2-4 items per call, deliberately overlapping
    const subset: string[] = [];
    const count = 2 + (i % 3);
    for (let c = 0; c < count; c++) {
      const grant = grantPool[(i * 3 + c) % grantPool.length];
      subset.push(grant);
      allSubmittedGrants.add(grant);
    }
    // Include some duplicate grants within individual calls to test intra-call deduplication
    if (i % 4 === 0) {
      subset.push(subset[0]);
    }
    calls.push({ grants: subset, timeOffset: i * 10 });
  }

  // Fire all 50 calls simultaneously
  const results = await Promise.all(
    calls.map((call) => service.syncMedalGrants(uid, call.grants, t0 + call.timeOffset)),
  );

  assert.equal(results.length, N, 'All 50 calls must complete');

  // Authoritative check from repository
  const finalState = await service.getOrInitRestaurant(uid, t0 + 10_000);
  assert.ok(finalState, 'Final state must exist');

  // 1. Verify exact set union
  const finalSet = new Set(finalState.permanentGrants);
  assert.equal(
    finalSet.size,
    allSubmittedGrants.size,
    `Final set size (${finalSet.size}) must match all submitted distinct grants (${allSubmittedGrants.size})`,
  );
  for (const expected of allSubmittedGrants) {
    assert.ok(finalSet.has(expected), `Final permanentGrants must include '${expected}'`);
  }

  // 2. Verify strict absence of duplicates
  assert.equal(
    finalState.permanentGrants.length,
    finalSet.size,
    'permanentGrants array must contain zero duplicate items',
  );

  // 3. Verify invariants on restaurant state
  assert.equal(finalState.id, uid);
  assert.equal(finalState.ownerUid, uid);
  assert.equal(finalState.kitchenCapacity, 1);
  assert.equal(finalState.serviceCapacity, 2);
});

test('Medal Sync Concurrency: Cold Start Stampede with 30 simultaneous calls creates restaurant once and converges to set union', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-cold-stampede';
  const t0 = 2_000_000;

  // Verify restaurant does not exist initially
  const initial = await repo.get(uid);
  assert.equal(initial, null, 'Restaurant must not exist prior to cold start stampede');

  const stampedeGrants = [
    ['prep_counter'],
    ['salmon_nigiri', 'prep_counter'],
    ['paper_lantern'],
    ['cap_extension_12h', 'potted_plant'],
    ['conveyor_belt', 'wave_print'],
    ['prep_counter', 'conveyor_belt'],
    ['tuna_sashimi'],
    ['tamago_nigiri', 'potted_plant'],
    ['ramen_side', 'wave_print'],
    ['tea_set'],
  ];

  const N = 30;
  const expectedUnion = new Set<string>();
  const promises: Promise<SushiRestaurantState>[] = [];

  for (let i = 0; i < N; i++) {
    const batch = stampedeGrants[i % stampedeGrants.length];
    for (const g of batch) expectedUnion.add(g);
    promises.push(service.syncMedalGrants(uid, batch, t0 + i * 5));
  }

  const results = await Promise.all(promises);

  assert.equal(results.length, N, 'All 30 cold start calls must resolve');

  // Verify authoritative state in repo
  const finalState = await repo.get(uid);
  assert.ok(finalState, 'Authoritative restaurant must have been created');
  assert.equal(finalState.id, uid);
  assert.equal(finalState.ownerUid, uid);
  assert.equal(finalState.balanceUnits, 0);

  // Set union verification
  const finalSet = new Set(finalState.permanentGrants);
  assert.equal(
    finalSet.size,
    expectedUnion.size,
    `Final grants count (${finalSet.size}) must match expected set union count (${expectedUnion.size})`,
  );
  assert.equal(
    finalState.permanentGrants.length,
    finalSet.size,
    'No duplicates allowed in cold start stampede result',
  );
  for (const exp of expectedUnion) {
    assert.ok(finalSet.has(exp), `Grant '${exp}' must be present in permanentGrants`);
  }
});

test('Medal Sync Concurrency: Multi-User Swarm (10 users x 20 concurrent calls = 200 operations) guarantees strict isolation and convergence', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const userCount = 10;
  const callsPerUser = 20;
  const t0 = 5_000_000;

  const users = Array.from({ length: userCount }, (_, i) => `user-swarm-${i}`);
  const expectedGrantsPerUser = new Map<string, Set<string>>();

  for (const uid of users) {
    expectedGrantsPerUser.set(uid, new Set<string>());
  }

  // Pre-seed half the users, leave half for cold start sync
  for (let i = 0; i < userCount; i += 2) {
    await service.getOrInitRestaurant(users[i], t0);
  }

  const allSwarmPromises: Promise<SushiRestaurantState>[] = [];

  for (let u = 0; u < userCount; u++) {
    const uid = users[u];
    const userUnion = expectedGrantsPerUser.get(uid)!;

    for (let c = 0; c < callsPerUser; c++) {
      // Create user-specific grants + shared grants
      const userSpecificGrant = `grant-${uid}-c${c}`;
      const sharedGrant = `shared-grant-${c % 5}`;
      const batch = [userSpecificGrant, sharedGrant];

      userUnion.add(userSpecificGrant);
      userUnion.add(sharedGrant);

      allSwarmPromises.push(service.syncMedalGrants(uid, batch, t0 + c * 20));
    }
  }

  assert.equal(allSwarmPromises.length, userCount * callsPerUser); // 200 operations

  // Execute all 200 concurrent operations across 10 users simultaneously
  const swarmResults = await Promise.all(allSwarmPromises);
  assert.equal(swarmResults.length, 200);

  // Verify strict isolation and exact set union for EVERY user
  for (const uid of users) {
    const state = await service.getOrInitRestaurant(uid, t0 + 100_000);
    assert.ok(state, `State for ${uid} must exist`);
    assert.equal(state.id, uid);

    const expectedSet = expectedGrantsPerUser.get(uid)!;
    const actualSet = new Set(state.permanentGrants);

    // 1. Exact set size
    assert.equal(
      actualSet.size,
      expectedSet.size,
      `User ${uid} must have exactly ${expectedSet.size} distinct grants, got ${actualSet.size}`,
    );

    // 2. Zero duplicates
    assert.equal(
      state.permanentGrants.length,
      actualSet.size,
      `User ${uid} permanentGrants array must have zero duplicates`,
    );

    // 3. User union match
    for (const exp of expectedSet) {
      assert.ok(actualSet.has(exp), `User ${uid} must have expected grant '${exp}'`);
    }

    // 4. Isolation: check that NO other user's specific grants leaked in
    for (const otherUid of users) {
      if (otherUid === uid) continue;
      for (const grant of state.permanentGrants) {
        assert.ok(
          !grant.startsWith(`grant-${otherUid}-`),
          `LEAK DETECTED: Grant '${grant}' from ${otherUid} leaked into ${uid}!`,
        );
      }
    }
  }
});

test('Medal Sync Concurrency: Interleaved syncMedalGrants, collectRevenue, and getOrInit preserves economy and grants', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-interleaved-ops';
  const t0 = 10_000_000;
  await service.getOrInitRestaurant(uid, t0);

  // Time advances 60 minutes = 600 yen (36,000,000 units)
  const t60m = t0 + 60 * MS_PER_MINUTE;

  const expectedGrants = new Set<string>();
  const operations: Promise<unknown>[] = [];

  let collectionCallCount = 0;

  // Interleave 15 syncMedalGrants, 15 collectRevenue (distinct keys), 10 getOrInit
  for (let i = 0; i < 40; i++) {
    const op = i % 3;
    if (op === 0) {
      // syncMedalGrants
      const grantName = `interleaved-grant-${i}`;
      expectedGrants.add(grantName);
      operations.push(service.syncMedalGrants(uid, [grantName], t60m));
    } else if (op === 1) {
      // collectRevenue
      const key = `interleaved-collect-key-${collectionCallCount++}`;
      operations.push(service.collectRevenue(uid, key, t60m));
    } else {
      // getOrInitRestaurant
      operations.push(service.getOrInitRestaurant(uid, t60m));
    }
  }

  await Promise.all(operations);

  // Verify final restaurant state
  const finalState = await service.getOrInitRestaurant(uid, t60m);

  // 1. Grants check: all 14 syncMedalGrants must be present and deduplicated
  const finalGrantsSet = new Set(finalState.permanentGrants);
  assert.equal(
    finalGrantsSet.size,
    expectedGrants.size,
    `All interleaved grants must converge to exact union (${expectedGrants.size})`,
  );
  assert.equal(
    finalState.permanentGrants.length,
    finalGrantsSet.size,
    'No duplicate grants after interleaved operations',
  );
  for (const g of expectedGrants) {
    assert.ok(finalGrantsSet.has(g), `Grant '${g}' must be present`);
  }

  // 2. Economy check: total balance collected must equal 600 yen (36,000,000 units)
  assert.equal(
    finalState.balanceUnits,
    36_000_000,
    'Economy fund conservation: balanceUnits must be exactly 36M units (600 yen)',
  );
  assert.equal(finalState.uncollectedUnits, 0, 'Uncollected units must be 0 after collection');
});

test('Medal Sync Concurrency: Edge cases with whitespace, Unicode Japanese characters, and empty grant arrays', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-edge-cases';
  const t0 = 1_000_000;
  await service.getOrInitRestaurant(uid, t0);

  const edgeBatches = [
    ['  prep_counter  ', '   ', 'salmon_nigiri'],
    ['寿司_サーモン', 'カウンター_特上'],
    [],
    ['prep_counter', '  寿司_サーモン  '],
    ['wave_print', ''],
  ];

  await Promise.all(
    edgeBatches.map((batch, idx) => service.syncMedalGrants(uid, batch, t0 + idx * 10)),
  );

  const finalState = await service.getOrInitRestaurant(uid, t0 + 100);

  // Expected sanitized, trimmed, non-empty set union:
  // 'prep_counter', 'salmon_nigiri', '寿司_サーモン', 'カウンター_特上', 'wave_print'
  const expected = new Set([
    'prep_counter',
    'salmon_nigiri',
    '寿司_サーモン',
    'カウンター_特上',
    'wave_print',
  ]);

  const actualSet = new Set(finalState.permanentGrants);
  assert.equal(actualSet.size, expected.size, 'Set size matches trimmed sanitization');
  assert.equal(
    finalState.permanentGrants.length,
    expected.size,
    'No duplicates or empty strings in permanentGrants',
  );

  for (const exp of expected) {
    assert.ok(actualSet.has(exp), `Grant '${exp}' must be present`);
  }
});

test('Medal Sync Concurrency: Lock queue resilience when an intermediate concurrent transaction rejects', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-reject-resilience';
  const t0 = 1_000_000;
  await service.getOrInitRestaurant(uid, t0, ['prep_counter']);

  // Call 1: valid sync
  const p1 = service.syncMedalGrants(uid, ['salmon_nigiri'], t0 + 10);

  // Call 2: deliberately invalid sync (not an array) that rejects
  // @ts-expect-error testing runtime rejection
  const p2 = service.syncMedalGrants(uid, 'not-an-array', t0 + 20);

  // Call 3: valid sync after rejected call
  const p3 = service.syncMedalGrants(uid, ['conveyor_belt'], t0 + 30);

  const res1 = await p1;
  assert.ok(res1.permanentGrants.includes('salmon_nigiri'));

  await assert.rejects(p2, /INVALID_GRANTS/, 'Call 2 must reject cleanly with INVALID_GRANTS');

  const res3 = await p3;
  assert.ok(res3.permanentGrants.includes('conveyor_belt'));

  // Verify that the failure of Call 2 did NOT deadlock Call 3 or corrupt state
  const finalState = await service.getOrInitRestaurant(uid, t0 + 100);
  assert.deepEqual(
    finalState.permanentGrants,
    ['prep_counter', 'salmon_nigiri', 'conveyor_belt'],
    'State converges cleanly despite intermediate transaction failure',
  );
});

test('Medal Sync Concurrency: Artificial asynchronous latency and jitter maintains serialized atomic convergence', async () => {
  // Custom repository wrapper that injects random delays into transaction execution
  class JitterySushiRepository extends InMemorySushiRepository {
    public override async transaction<T>(
      uid: string,
      updateFn: (
        current: SushiRestaurantState | null,
      ) => Promise<{ state: SushiRestaurantState; result: T }>,
    ): Promise<T> {
      return super.transaction(uid, async (current) => {
        // Inject random jitter before and after updateFn
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15)));
        const res = await updateFn(current);
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15)));
        return res;
      });
    }
  }

  const repo = new JitterySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-jitter-concurrency';
  const t0 = 1_000_000;
  await service.getOrInitRestaurant(uid, t0);

  const distinctGrants = Array.from({ length: 25 }, (_, i) => `jitter-grant-${i}`);
  const expectedUnion = new Set(distinctGrants);

  // Dispatch 25 concurrent calls with jitter
  const promises = distinctGrants.map((grant, idx) =>
    service.syncMedalGrants(uid, [grant, 'shared-jitter-anchor'], t0 + idx * 5),
  );
  expectedUnion.add('shared-jitter-anchor');

  await Promise.all(promises);

  const finalState = await service.getOrInitRestaurant(uid, t0 + 5000);
  const finalSet = new Set(finalState.permanentGrants);

  assert.equal(
    finalSet.size,
    expectedUnion.size,
    'All grants must converge despite asynchronous latency jitter',
  );
  assert.equal(
    finalState.permanentGrants.length,
    expectedUnion.size,
    'No duplicates even with unpredictable transaction completion times',
  );
  for (const exp of expectedUnion) {
    assert.ok(finalSet.has(exp), `Grant '${exp}' must be present`);
  }
});

test('Medal Sync Concurrency: Caller mutation of returned state does not pollute repository state', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-tamper-check';
  const t0 = 1_000_000;
  await service.getOrInitRestaurant(uid, t0);

  const call1 = await service.syncMedalGrants(uid, ['prep_counter'], t0);

  // Hostile caller attempts to mutate the returned state in-place
  (call1.permanentGrants as string[]).push('malicious_grant_unearned');
  call1.permanentGrants.length = 0; // Wipe array

  // Subsequent sync call from course progress
  await service.syncMedalGrants(uid, ['salmon_nigiri'], t0 + 1000);

  // Verify authoritative state in repository was unaffected by caller mutation
  const finalState = await service.getOrInitRestaurant(uid, t0 + 2000);
  assert.ok(finalState.permanentGrants.includes('prep_counter'), 'prep_counter must be preserved');
  assert.ok(finalState.permanentGrants.includes('salmon_nigiri'), 'salmon_nigiri must be present');
  assert.ok(
    !finalState.permanentGrants.includes('malicious_grant_unearned'),
    'Tampered unearned grant must NOT be stored in authoritative repository',
  );
  assert.equal(finalState.permanentGrants.length, 2);
});

test('Medal Sync Concurrency: High-volume stress (100 concurrent calls, large overlapping payloads)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const uid = 'student-high-volume-100';
  const t0 = 1_000_000;

  const N = 100;
  const allExpected = new Set<string>();
  const promises: Promise<SushiRestaurantState>[] = [];

  for (let i = 0; i < N; i++) {
    const batch: string[] = [];
    // Each call has 5 grants: 2 shared across all calls, 3 unique to this call
    batch.push('shared-root-1', 'shared-root-2');
    allExpected.add('shared-root-1');
    allExpected.add('shared-root-2');

    for (let k = 0; k < 3; k++) {
      const grant = `vol-grant-${i}-${k}`;
      batch.push(grant);
      allExpected.add(grant);
    }

    promises.push(service.syncMedalGrants(uid, batch, t0 + i));
  }

  await Promise.all(promises);

  const finalState = await service.getOrInitRestaurant(uid, t0 + 5000);
  const actualSet = new Set(finalState.permanentGrants);

  assert.equal(
    actualSet.size,
    allExpected.size,
    `100 concurrent calls must converge to exact union (${allExpected.size})`,
  );
  assert.equal(
    finalState.permanentGrants.length,
    allExpected.size,
    'Zero duplicates across 100 concurrent calls',
  );
});
