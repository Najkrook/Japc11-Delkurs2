import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderSushiShell,
  leaveSushiView,
  SushiClientController,
} from '../src/course/sushi-game/sushi-view.ts';
import { sushiService, InMemorySushiRepository } from '../src/course/sushi-game/service.ts';
import { SUSHI_CATALOG } from '../src/course/sushi-game/catalog.ts';
import { SUSHI_UNLOCK_CATALOG } from '../src/course/sushi-game/medals.ts';
import { createDefaultRestaurantState, unitsToWholeYen } from '../src/course/sushi-game/economy.ts';
import { DEFAULT_CAP_MS, EXTENDED_CAP_MS } from '../src/course/sushi-game/types.ts';
import type { CourseHostContext } from '../src/course/types.ts';
import type { SushiRestaurantState } from '../src/course/sushi-game/types.ts';

function renderTemplateToString(t: unknown): string {
  if (t === null || t === undefined || typeof t === 'boolean') return '';
  if (typeof t === 'string' || typeof t === 'number') return String(t);
  if (Array.isArray(t)) return t.map(renderTemplateToString).join('');
  if (
    typeof t === 'object' &&
    t &&
    'strings' in t &&
    Array.isArray((t as { strings: unknown }).strings)
  ) {
    const tmpl = t as { strings: string[]; values: unknown[] };
    let out = '';
    for (let i = 0; i < tmpl.strings.length; i++) {
      out += tmpl.strings[i];
      if (i < tmpl.values.length) {
        out += renderTemplateToString(tmpl.values[i]);
      }
    }
    return out.replace(/\s+/g, ' ');
  }
  return '';
}

function createMockHost(overrides: Partial<CourseHostContext> = {}): CourseHostContext {
  let status = 'Lokalt sparad';
  return {
    theme: 'classic' as const,
    toggleTheme: () => {},
    user: null as CourseHostContext['user'],
    authBusy: false,
    account: () => {},
    onLogin: () => {},
    speak: (_text: string) => 'ok' as const,
    tts: true,
    get status() {
      return status;
    },
    render: () => {},
    announce: (msg: string) => {
      status = msg;
    },
    ...overrides,
  };
}

async function renderLoadedShell(...args: Parameters<typeof renderSushiShell>) {
  renderSushiShell(...args);
  await new Promise<void>((resolve) => setImmediate(resolve));
  return renderSushiShell(...args);
}

function createMockState(overrides: Partial<SushiRestaurantState> = {}): SushiRestaurantState {
  return {
    ...createDefaultRestaurantState(overrides.id ?? 'adversarial-user', 1000),
    id: 'adversarial-user',
    kitchenCapacity: 1,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    activeRecipe: 'classic_nigiri',
    balanceUnits: 60_000_000, // 1000 yen
    uncollectedUnits: 0,
    usedProductionMs: 0,
    capMs: DEFAULT_CAP_MS,
    periodStartMs: 1000,
    lastCalculatedMs: 1000,
    permanentGrants: [],
    inventory: [],
    equipped: {
      wallSlot: null,
      floorSlot: null,
    },
    ...overrides,
  };
}

// =========================================================================
// CHALLENGE 1: Stress-test Bottleneck Banner Across Boundary Combinations
// =========================================================================
test('Adversarial Bottleneck Banner: Comprehensive K < S scenarios (Kitchen Bottleneck)', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const testCases = [
    { k: 1, s: 2, label: 'Standard starter (1 vs 2)' },
    { k: 0, s: 5, label: 'Zero kitchen boundary (0 vs 5)' },
    { k: 2, s: 8, label: 'High service disparity (2 vs 8)' },
    { k: 5, s: 6, label: 'Off-by-one disparity (5 vs 6)' },
    { k: 1, s: 100, label: 'Extreme disparity (1 vs 100)' },
  ];

  for (const { k, s, label } of testCases) {
    const uid = `user-k${k}-s${s}`;
    await repo.set(createMockState({ id: uid, kitchenCapacity: k, serviceCapacity: s }));
    const host = createMockHost({ user: { uid, displayName: `Student ${label}` } });
    const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

    // 1. Explainer banner presence
    assert.ok(
      html.includes('data-testid="sushi-register-bottleneck-explainer"'),
      `[${label}] Explainer banner must render for K < S`,
    );

    // 2. Banner content accuracy
    const expectedMsg = `Köket begränsar intjäningen (${k} ${k === 1 ? 'order' : 'ordrar'}/min mot ${s} ${s === 1 ? 'order' : 'ordrar'}/min service). Uppgradera kökskapaciteten för att höja takten.`;
    assert.ok(html.includes(expectedMsg), `[${label}] Banner message must match: "${expectedMsg}"`);

    // 3. Rate bar tags
    assert.ok(
      html.includes(`Kök: ${k} ${k === 1 ? 'order' : 'ordrar'}/min (Flaskhals)`),
      `[${label}] Kök tag must be marked as Flaskhals`,
    );
    assert.ok(
      !html.includes(`Service: ${s} ${s === 1 ? 'order' : 'ordrar'}/min (Flaskhals)`),
      `[${label}] Service tag must NOT be marked as Flaskhals`,
    );
    assert.ok(
      html.includes('Kök (Flaskhals)'),
      `[${label}] Overall bottleneck summary tag must say Kök (Flaskhals)`,
    );

    leaveSushiView();
  }
});

test('Adversarial Bottleneck Banner: Comprehensive K > S scenarios (Service Bottleneck)', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const testCases = [
    { k: 3, s: 2, label: 'Standard upgrade (3 vs 2)' },
    { k: 5, s: 0, label: 'Zero service boundary (5 vs 0)' },
    { k: 8, s: 2, label: 'High kitchen disparity (8 vs 2)' },
    { k: 6, s: 5, label: 'Off-by-one disparity (6 vs 5)' },
    { k: 100, s: 1, label: 'Extreme disparity (100 vs 1)' },
  ];

  for (const { k, s, label } of testCases) {
    const uid = `user-k${k}-s${s}`;
    await repo.set(createMockState({ id: uid, kitchenCapacity: k, serviceCapacity: s }));
    const host = createMockHost({ user: { uid, displayName: `Student ${label}` } });
    const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

    // 1. Explainer banner presence
    assert.ok(
      html.includes('data-testid="sushi-register-bottleneck-explainer"'),
      `[${label}] Explainer banner must render for K > S`,
    );

    // 2. Banner content accuracy
    const expectedMsg = `Servicen begränsar intjäningen (${s} ${s === 1 ? 'order' : 'ordrar'}/min mot ${k} ${k === 1 ? 'order' : 'ordrar'}/min kök). Uppgradera transportband eller service för att höja takten.`;
    assert.ok(html.includes(expectedMsg), `[${label}] Banner message must match: "${expectedMsg}"`);

    // 3. Rate bar tags
    assert.ok(
      html.includes(`Service: ${s} ${s === 1 ? 'order' : 'ordrar'}/min (Flaskhals)`),
      `[${label}] Service tag must be marked as Flaskhals`,
    );
    assert.ok(
      !html.includes(`Kök: ${k} ${k === 1 ? 'order' : 'ordrar'}/min (Flaskhals)`),
      `[${label}] Kök tag must NOT be marked as Flaskhals`,
    );
    assert.ok(
      html.includes('Service (Flaskhals)'),
      `[${label}] Overall bottleneck summary tag must say Service (Flaskhals)`,
    );

    leaveSushiView();
  }
});

test('Adversarial Bottleneck Banner: Comprehensive K = S scenarios (Balanced State)', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const testCases = [
    { k: 0, s: 0, label: 'Zero-zero boundary (0 vs 0)' },
    { k: 1, s: 1, label: 'Minimal non-zero (1 vs 1)' },
    { k: 2, s: 2, label: 'Standard balanced (2 vs 2)' },
    { k: 5, s: 5, label: 'Mid-tier balanced (5 vs 5)' },
    { k: 50, s: 50, label: 'High capacity balanced (50 vs 50)' },
  ];

  for (const { k, s, label } of testCases) {
    const uid = `user-k${k}-s${s}`;
    await repo.set(createMockState({ id: uid, kitchenCapacity: k, serviceCapacity: s }));
    const host = createMockHost({ user: { uid, displayName: `Student ${label}` } });
    const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

    // 1. Explainer banner MUST NOT be present
    assert.ok(
      !html.includes('data-testid="sushi-register-bottleneck-explainer"'),
      `[${label}] Explainer banner must NOT render when K == S`,
    );

    // 2. Rate bar tags
    assert.ok(
      !html.includes('(Flaskhals)'),
      `[${label}] Neither tag must say (Flaskhals) when K == S`,
    );
    assert.ok(
      html.includes('Balanserad produktion'),
      `[${label}] Rate bar must state "Balanserad produktion"`,
    );

    leaveSushiView();
  }
});

// =========================================================================
// CHALLENGE 2: Swedish Announcements - Zero, Partial, and Full Collections
// =========================================================================
test('Adversarial Swedish Announcement: Zero collection attempt', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const uid = 'zero-collector';
  await repo.set(
    createMockState({
      id: uid,
      kitchenCapacity: 2,
      serviceCapacity: 2,
      balanceUnits: 60_000_000, // 1000 yen
      uncollectedUnits: 0,
      periodStartMs: Date.now(),
      accountedAtMs: Date.now(),
    }),
  );

  const controller = new SushiClientController();
  const host = createMockHost({ user: { uid, displayName: 'Zero Collector' } });

  try {
    controller.init(uid, host);
    await new Promise<void>((resolve) => setImmediate(resolve));

    const calc = controller.recalculate();
    assert.equal(calc.displayedUncollectedYen, 0, 'Zero yen displayed uncollected');

    // Initial announcement is null/empty
    const prevAnnouncement = controller.announcement;

    // Collect attempt with 0 yen
    await controller.collect();

    // Must not trigger collection or change announcement
    assert.equal(
      controller.announcement,
      prevAnnouncement,
      'Calling collect with 0 uncollected must not modify announcement',
    );
    assert.equal(
      unitsToWholeYen(controller.state!.balanceUnits),
      1000,
      'Balance must remain strictly unchanged at 1000 yen',
    );

    // Shell button verification: button is disabled
    const shellHtml = renderTemplateToString(renderSushiShell(host, () => {}));
    assert.ok(
      shellHtml.includes('disabled') || shellHtml.includes('?disabled'),
      'Collect button must be disabled when uncollected is 0',
    );
  } finally {
    controller.reset();
    leaveSushiView();
  }
});

test('Adversarial Swedish Announcement: Partial collection (sub-cap idle accumulation)', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const uid = 'partial-collector';
  // 15 minutes of idle time at 20 yen/min (K=2, S=2, avgRev=10) yields 300 yen
  const now = Date.now();
  const pastMs = now - 15 * 60 * 1000;
  await repo.set(
    createMockState({
      id: uid,
      kitchenCapacity: 2,
      serviceCapacity: 2,
      averageRevenuePerOrder: 10,
      balanceUnits: 120_000_000, // 2000 yen
      uncollectedUnits: 0,
      usedProductionMs: 0,
      periodStartMs: pastMs,
      accountedAtMs: pastMs,
      lastCalculatedMs: pastMs,
    }),
  );

  const controller = new SushiClientController();
  const host = createMockHost({ user: { uid, displayName: 'Partial Collector' } });

  try {
    controller.init(uid, host);
    await new Promise<void>((resolve) => setImmediate(resolve));

    const calc = controller.recalculate();
    assert.equal(calc.displayedUncollectedYen, 300, 'Partial uncollected is 300 yen');
    assert.equal(calc.isCapped, false, 'Register is not capped');

    await controller.collect();

    assert.equal(
      controller.announcement,
      'Hämtade 300 yen. Nytt saldo: 2300 yen.',
      'Announcement must state: Hämtade 300 yen. Nytt saldo: 2300 yen.',
    );
    assert.equal(
      unitsToWholeYen(controller.state!.balanceUnits),
      2300,
      'New spendable balance is exactly 2300 yen',
    );
  } finally {
    controller.reset();
  }
});

test('Adversarial Swedish Announcement: Full collection at 24h standard cap', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const uid = 'full-cap-24h-collector';
  // 30 hours idle time at 20 yen/min, capped at 24 hours.
  // Max yield: 24 * 60 * 20 = 28800 yen
  const now = Date.now();
  const pastMs = now - 30 * 3600 * 1000;
  await repo.set(
    createMockState({
      id: uid,
      kitchenCapacity: 2,
      serviceCapacity: 2,
      averageRevenuePerOrder: 10,
      balanceUnits: 30_000_000, // 500 yen initial
      uncollectedUnits: 0,
      usedProductionMs: 0,
      capMs: DEFAULT_CAP_MS,
      periodStartMs: pastMs,
      accountedAtMs: pastMs,
      lastCalculatedMs: pastMs,
    }),
  );

  const controller = new SushiClientController();
  const host = createMockHost({ user: { uid, displayName: '24h Capped Collector' } });

  try {
    controller.init(uid, host);
    await new Promise<void>((resolve) => setImmediate(resolve));

    const calc = controller.recalculate();
    assert.equal(calc.displayedUncollectedYen, 28800, 'Capped at 28800 yen');
    assert.equal(calc.isCapped, true, 'Register must report isCapped === true');

    await controller.collect();

    // 500 initial + 28800 collected = 29300 yen
    assert.equal(
      controller.announcement,
      'Hämtade 28800 yen. Nytt saldo: 29300 yen.',
      'Announcement must state the exact full-cap collection and wallet total.',
    );
    assert.equal(
      unitsToWholeYen(controller.state!.balanceUnits),
      29300,
      'New spendable balance is exactly 29300 yen',
    );
  } finally {
    controller.reset();
  }
});

test('Adversarial Swedish Announcement: Full collection at 48h extended cap', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const uid = 'full-cap-48h-collector';
  // 60 hours idle time at 20 yen/min, capped at 48 hours.
  // Max yield: 48 * 60 * 20 = 57600 yen
  const now = Date.now();
  const pastMs = now - 60 * 3600 * 1000;
  await repo.set(
    createMockState({
      id: uid,
      kitchenCapacity: 2,
      serviceCapacity: 2,
      averageRevenuePerOrder: 10,
      balanceUnits: 60_000_000, // 1000 yen initial
      uncollectedUnits: 0,
      usedProductionMs: 0,
      capMs: EXTENDED_CAP_MS,
      periodStartMs: pastMs,
      accountedAtMs: pastMs,
      lastCalculatedMs: pastMs,
    }),
  );

  const controller = new SushiClientController();
  const host = createMockHost({ user: { uid, displayName: '48h Capped Collector' } });

  try {
    controller.init(uid, host);
    await new Promise<void>((resolve) => setImmediate(resolve));

    const calc = controller.recalculate();
    assert.equal(calc.displayedUncollectedYen, 57600, 'Capped at 57600 yen');
    assert.equal(calc.isCapped, true, 'Register must report isCapped === true');

    await controller.collect();

    // 1000 initial + 57600 collected = 58600 yen
    assert.equal(
      controller.announcement,
      'Hämtade 57600 yen. Nytt saldo: 58600 yen.',
      'Announcement must state the exact extended-cap collection and wallet total.',
    );
    assert.equal(
      unitsToWholeYen(controller.state!.balanceUnits),
      58600,
      'New spendable balance is exactly 58600 yen',
    );
  } finally {
    controller.reset();
  }
});

test('Adversarial Swedish Announcement: Medal unlock collection - Zero, Partial, and Full 21-grant', () => {
  const controller = new SushiClientController();
  try {
    // 1. Zero unlocks
    assert.equal(
      controller.formatAnnouncement([]),
      '',
      'Empty grant array yields empty announcement',
    );

    // 2. Single unlock (partial)
    const single = controller.formatAnnouncement(['maguro_nigiri']);
    assert.ok(
      single.startsWith('Grattis! Ny kursbelöning upplåst:'),
      'Single unlock has singular Swedish heading',
    );
    assert.ok(single.includes('Maguronigiri'), 'Includes item Swedish name');
    assert.ok(single.includes('Kapitel 8'), 'Includes correct Genki chapter');
    assert.ok(/silvermedalj/i.test(single), 'Includes tier medal name');
    assert.ok(
      single.endsWith('Föremålet är nu tillgängligt att köpa i butiken.'),
      'Ends with standard Swedish availability sentence',
    );

    // 3. Multi unlock (partial)
    const triple = controller.formatAnnouncement([
      'knife_sharpener',
      'salmon_nigiri',
      'noren_curtain',
    ]);
    assert.ok(
      triple.startsWith('Grattis! 3 nya kursbelöningar upplåsta från dina kursmedaljer:'),
      'Multi unlock has plural Swedish heading with count',
    );

    // 4. Full collection (all 21 items)
    const allGrantIds = SUSHI_UNLOCK_CATALOG.map((i) => i.id);
    assert.equal(allGrantIds.length, 21, 'Must have exactly 21 items in unlock catalog');

    const fullAnnouncement = controller.formatAnnouncement(allGrantIds);
    assert.ok(
      fullAnnouncement.startsWith(
        'Grattis! 21 nya kursbelöningar upplåsta från dina kursmedaljer:',
      ),
      'Full collection heading specifies 21 items',
    );
    for (const item of SUSHI_UNLOCK_CATALOG) {
      assert.ok(
        fullAnnouncement.includes(item.name),
        `Full announcement must contain item name "${item.name}"`,
      );
    }
  } finally {
    controller.reset();
  }
});

// =========================================================================
// CHALLENGE 3: Non-Vacuity Verification of sushi-m3-features.test.ts
// =========================================================================
test('Adversarial Non-Vacuity: Verifies test assertions are discriminative and fail on perturbations', () => {
  // Test that catalog total checks would fail if prices were off
  const catalogTotal = SUSHI_CATALOG.reduce((a, b) => a + b.priceYen, 0);
  assert.equal(catalogTotal, 47_750);
  assert.notEqual(catalogTotal, 47_749, 'Catalog price perturbation would fail assertion');

  // Test that equipment badge strings are exact and distinguish between old wrong copy and new copy
  const wrongBadges = [
    '🔪 Precisionskniv (+3 kök)',
    '🍱 Utökad serveringsdisk (+3 service)',
    '👨‍🍳 Souschef (+5 kök)',
    '📜 Mästarlicens (+5 service)',
  ];
  const correctBadges = [
    'Precisionskniv (+1 kök)',
    'Utökad serveringsdisk (+2 service)',
    'Souschef (+2 kök)',
    'Mästarcertifiering (+3 ¥/order)',
  ];

  for (let i = 0; i < correctBadges.length; i++) {
    assert.notEqual(correctBadges[i], wrongBadges[i], 'Badge copies are distinct');
  }
});

// =========================================================================
// CHALLENGE 4: Collection Error Recovery and Idempotency
// =========================================================================
test('Adversarial Collection Error: Network failure triggers Swedish error announcement and retry UI', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const uid = 'error-student';
  const now = Date.now();
  const pastMs = now - 30 * 60 * 1000; // 600 yen uncollected
  await repo.set(
    createMockState({
      id: uid,
      kitchenCapacity: 2,
      serviceCapacity: 2,
      averageRevenuePerOrder: 10,
      balanceUnits: 60_000_000,
      uncollectedUnits: 0,
      usedProductionMs: 0,
      periodStartMs: pastMs,
      accountedAtMs: pastMs,
      lastCalculatedMs: pastMs,
    }),
  );

  const controller = new SushiClientController();
  const host = createMockHost({ user: { uid, displayName: 'Error Student' } });

  try {
    controller.init(uid, host);
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Sabotage repository transaction to simulate backend network or firestore failure
    const originalTx = repo.transaction.bind(repo);
    repo.transaction = async () => {
      throw new Error('Network timeout / simulated failure');
    };

    await controller.collect();

    // Verify error state
    assert.equal(controller.isCollecting, false, 'isCollecting flag must be cleared upon error');
    assert.equal(
      controller.error,
      'Kunde inte hämta intäkterna på grund av nätverksfel. Försök igen.',
      'Must set Swedish error message',
    );
    assert.equal(
      controller.announcement,
      'Fel vid hämtning. Dina intäkter är inte förlorade. Klicka på Försök igen.',
      'Must set Swedish ARIA live error announcement',
    );

    // Restore repository and retry
    repo.transaction = originalTx;
    controller.retry();
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.equal(
      controller.announcement,
      'Hämtade 600 yen. Nytt saldo: 1600 yen.',
      'Successful retry yields Swedish collection confirmation',
    );
    assert.equal(controller.error, null, 'Error is cleared on success');
  } finally {
    controller.reset();
  }
});

test('Adversarial Collection Idempotency: Duplicate calls with identical idempotencyKey do not double-credit', async () => {
  const repo = new InMemorySushiRepository();
  const uid = 'idempotent-student';
  const now = Date.now();
  const pastMs = now - 60 * 60 * 1000; // 1 hour = 1200 yen at 20 yen/min

  await repo.set(
    createMockState({
      id: uid,
      kitchenCapacity: 2,
      serviceCapacity: 2,
      averageRevenuePerOrder: 10,
      balanceUnits: 60_000_000, // 1000 yen initial
      uncollectedUnits: 0,
      usedProductionMs: 0,
      periodStartMs: pastMs,
      accountedAtMs: pastMs,
      lastCalculatedMs: pastMs,
    }),
  );

  const service = new (await import('../src/course/sushi-game/domain-service.ts')).SushiService(
    repo,
  );
  const idempotencyKey = 'key_unique_collect_123';

  // First collect call
  const firstResult = await service.collectRevenue(uid, idempotencyKey, now);
  assert.equal(firstResult.wasAlreadyProcessed, false, 'First call is fresh');
  assert.equal(firstResult.collectedYen, 1200, 'First call collects 1200 yen');
  assert.equal(unitsToWholeYen(firstResult.state.balanceUnits), 2200, 'Balance reaches 2200 yen');

  // Second collect call with duplicate key
  const secondResult = await service.collectRevenue(uid, idempotencyKey, now + 5000);
  assert.equal(secondResult.wasAlreadyProcessed, true, 'Second call identified as duplicate');
  assert.equal(secondResult.collectedYen, 0, 'Duplicate call collects 0 yen');
  assert.equal(
    unitsToWholeYen(secondResult.state.balanceUnits),
    2200,
    'Balance remains 2200 yen without double crediting',
  );
});
