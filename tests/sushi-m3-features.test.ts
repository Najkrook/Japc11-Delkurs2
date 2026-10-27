import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUSHI_CATALOG,
  getCatalogItem,
  previewCatalogPurchase,
} from '../src/course/sushi-game/catalog.ts';
import { MEDAL_GRANT_RULES } from '../src/course/sushi-game/medals.ts';
import { renderRestaurantScene } from '../src/course/sushi-game/restaurant-scene.ts';
import {
  renderSushiShell,
  leaveSushiView,
  SushiClientController,
} from '../src/course/sushi-game/sushi-view.ts';
import { sushiService, InMemorySushiRepository } from '../src/course/sushi-game/service.ts';
import type { CourseHostContext } from '../src/course/types.ts';
import type { SushiRestaurantState } from '../src/course/sushi-game/types.ts';
import { unitsToWholeYen } from '../src/course/sushi-game/economy.ts';

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
    id: 'test-user',
    kitchenCapacity: 1,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    activeRecipe: 'classic_nigiri',
    balanceUnits: 60_000_000, // 1000 yen
    uncollectedUnits: 0,
    usedProductionMs: 0,
    capMs: 28_800_000,
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

test('Milestone 3 Master Catalog: 21 items with exact prices and total 48,000 yen', () => {
  assert.equal(SUSHI_CATALOG.length, 21, 'Must have exactly 21 master catalog items');

  const bronzeItems = SUSHI_CATALOG.filter((i) => i.requiredTier === 'bronze');
  const silverItems = SUSHI_CATALOG.filter((i) => i.requiredTier === 'silver');
  const goldItems = SUSHI_CATALOG.filter((i) => i.requiredTier === 'gold');

  assert.equal(bronzeItems.length, 7, '7 Bronze upgrade items across chapters 6-12');
  assert.equal(silverItems.length, 7, '7 Silver recipe items across chapters 6-12');
  assert.equal(goldItems.length, 7, '7 Gold decor items across chapters 6-12');

  const totalYen = SUSHI_CATALOG.reduce((acc, item) => acc + item.priceYen, 0);
  const totalUnits = SUSHI_CATALOG.reduce((acc, item) => acc + item.priceUnits, 0);

  assert.equal(totalYen, 48_000, 'Total catalog investment must be exactly 48,000 Yen');
  assert.equal(totalUnits, 2_880_000_000, 'Total internal units must be exactly 2,880,000,000');

  const bronzeYen = bronzeItems.reduce((acc, i) => acc + i.priceYen, 0);
  const silverYen = silverItems.reduce((acc, i) => acc + i.priceYen, 0);
  const goldYen = goldItems.reduce((acc, i) => acc + i.priceYen, 0);

  assert.equal(bronzeYen, 31_500, 'Bronze upgrades total exactly 31,500 Yen');
  assert.equal(silverYen, 11_400, 'Silver recipes total exactly 11,400 Yen');
  assert.equal(goldYen, 5_100, 'Gold decor totals exactly 5,100 Yen');

  // Verify integer unit consistency: priceUnits === priceYen * 60,000
  for (const item of SUSHI_CATALOG) {
    assert.equal(item.priceUnits, item.priceYen * 60_000, `Item ${item.id} unit pricing`);
  }
});

test('Milestone 3 Medal Rules: All 21 items mapped to chapters 6-12 with correct tiers', () => {
  assert.equal(MEDAL_GRANT_RULES.length, 21, 'Must map all 21 items in medal rules');

  for (let chapter = 6; chapter <= 12; chapter++) {
    const chapterRules = MEDAL_GRANT_RULES.filter((r) => r.lessonNumber === chapter);
    assert.equal(
      chapterRules.length,
      3,
      `Chapter ${chapter} must have bronze, silver, gold grants`,
    );
    assert.ok(
      chapterRules.some((r) => r.requiredTier === 'bronze'),
      `Chapter ${chapter} bronze`,
    );
    assert.ok(
      chapterRules.some((r) => r.requiredTier === 'silver'),
      `Chapter ${chapter} silver`,
    );
    assert.ok(
      chapterRules.some((r) => r.requiredTier === 'gold'),
      `Chapter ${chapter} gold`,
    );
  }
});

test('Milestone 3 Restaurant Scene: Renders all recipe plates when owned', () => {
  const allRecipes = [
    'salmon_nigiri',
    'kappamaki',
    'maguro_nigiri',
    'ebi_nigiri',
    'tamago_nigiri',
    'sashimi_plate',
    'omakase_menu',
  ];

  const state = createMockState({ inventory: allRecipes });
  const rendered = renderRestaurantScene(state);
  const htmlStr = renderTemplateToString(rendered);

  for (const recipe of allRecipes) {
    assert.ok(htmlStr.includes(`data-testid="art-${recipe}"`), `Contains art-${recipe}`);
  }
});

test('Milestone 3 Restaurant Scene: Renders equipment visual cues and wall/floor decor', () => {
  const equipment = ['precision_knife', 'service_counter', 'sous_chef', 'master_license'];
  const decor = ['noren_curtain', 'golden_maneki_neko', 'andon_lantern', 'sakura_bonsai'];

  const state = createMockState({
    inventory: [...equipment, ...decor],
    equipped: {
      wallSlot: 'noren_curtain',
      floorSlot: 'golden_maneki_neko',
    },
  });

  const rendered = renderRestaurantScene(state);
  const htmlStr = renderTemplateToString(rendered);

  for (const eq of equipment) {
    assert.ok(htmlStr.includes(`data-testid="art-${eq}"`), `Contains visual cue art-${eq}`);
  }
  assert.ok(htmlStr.includes('data-testid="art-noren_curtain"'), 'Contains wall art-noren_curtain');
  assert.ok(
    htmlStr.includes('data-testid="art-golden_maneki_neko"'),
    'Contains floor art-golden_maneki_neko',
  );
  assert.ok(
    htmlStr.includes('Gyllene Maneki-neko på golvet.'),
    'Accessible description describes golden cat',
  );
  assert.ok(
    htmlStr.includes('Norendraperi på väggen.'),
    'Accessible description describes noren curtain',
  );
});

test('Milestone 3 Restaurant Scene: State-driven pixel artwork for catalog purchases', () => {
  // Test remaining wall/floor decor: paper_lantern, wave_print, potted_plant, sakura_bonsai with cap extension
  const state1 = createMockState({
    inventory: ['paper_lantern', 'potted_plant', 'cap_extension_12h'],
    equipped: {
      wallSlot: 'paper_lantern',
      floorSlot: 'potted_plant',
    },
  });
  const html1 = renderTemplateToString(renderRestaurantScene(state1));
  assert.ok(html1.includes('data-testid="art-paper_lantern"'), 'Renders art-paper_lantern');
  assert.ok(html1.includes('data-testid="art-potted_plant"'), 'Renders art-potted_plant');
  assert.ok(html1.includes('data-testid="art-cap-extension"'), 'Renders art-cap-extension');
  assert.ok(html1.includes('Papperslykta på väggen.'), 'Desc describes paper lantern');
  assert.ok(html1.includes('Krukväxt på golvet.'), 'Desc describes potted plant');

  // Test wave_print and andon_lantern
  const state2 = createMockState({
    inventory: ['wave_print', 'andon_lantern'],
    equipped: {
      wallSlot: 'wave_print',
      floorSlot: 'andon_lantern',
    },
  });
  const html2 = renderTemplateToString(renderRestaurantScene(state2));
  assert.ok(html2.includes('data-testid="art-wave_print"'), 'Renders art-wave_print');
  assert.ok(html2.includes('data-testid="art-andon_lantern"'), 'Renders art-andon_lantern');
  assert.ok(html2.includes('Vågmotiv på väggen.'), 'Desc describes wave print');
  assert.ok(html2.includes('Andon-golvlykta på golvet.'), 'Desc describes andon lantern');

  // Test sakura_bonsai
  const state3 = createMockState({
    inventory: ['sakura_bonsai'],
    equipped: {
      wallSlot: null,
      floorSlot: 'sakura_bonsai',
    },
  });
  const html3 = renderTemplateToString(renderRestaurantScene(state3));
  assert.ok(html3.includes('data-testid="art-sakura_bonsai"'), 'Renders art-sakura_bonsai');
  assert.ok(html3.includes('Sakura-bonsai på golvet.'), 'Desc describes sakura bonsai');

  // The scene is state-driven vector geometry, without baked-in furniture.
  assert.ok(
    html1.includes('/sprites/sushi/starter-room.png'),
    'Scene loads the empty starter room',
  );
  assert.ok(
    !html1.includes('sakura_sushi_scene.png'),
    'The original pre-furnished raster is not used',
  );
});

test('Milestone 3 Prospective Upgrade Preview: Previews revenue deltas and bottleneck impact', () => {
  const state = createMockState({
    kitchenCapacity: 3,
    serviceCapacity: 2, // Service is bottleneck!
    averageRevenuePerOrder: 10,
  });

  // Buying prep_counter (+2 kitchen) increases potential kitchen capacity but is bottlenecked by service
  const prepPreview = previewCatalogPurchase(state, 'prep_counter');
  assert.ok(prepPreview);
  assert.equal(prepPreview.isBottleneckLimiting, true);
  assert.equal(prepPreview.yenDelta, 0, 'No immediate yen delta because service is bottleneck');
  assert.ok(prepPreview.educationalExplanation.includes('servicen'));

  // Buying conveyor_belt (+2 service) resolves bottleneck
  const conveyorPreview = previewCatalogPurchase(state, 'conveyor_belt');
  assert.ok(conveyorPreview);
  assert.equal(conveyorPreview.isBottleneckLimiting, false);
  assert.ok(conveyorPreview.yenDelta > 0, 'Immediate revenue increase');
});

test('Milestone 3 Controller Announcements: Swedish phrasing for collections and multi-unlocks', () => {
  const controller = new SushiClientController();
  try {
    const single = controller.formatAnnouncement(['tamago_nigiri']);
    assert.ok(single.includes('Grattis! Ny kursbelöning upplåst: Tamagonigiri'));
    assert.ok(single.includes('Kapitel 10'));

    const multi = controller.formatAnnouncement(['sashimi_plate', 'sakura_bonsai']);
    assert.ok(multi.includes('Grattis! 2 nya kursbelöningar upplåsta'));
    assert.ok(multi.includes('Sashimi Moriawase'));
    assert.ok(multi.includes('Sakura Bonsai'));
  } finally {
    controller.reset();
  }
});

test('Milestone 3 Restaurant Scene: Starter room precedes purchased equipment layers', () => {
  const state = createMockState({
    inventory: [
      'prep_counter',
      'precision_knife',
      'service_counter',
      'sous_chef',
      'master_license',
      'conveyor_belt',
    ],
  });
  const rendered = renderRestaurantScene(state);
  const sceneHtml = renderTemplateToString(rendered);

  const stoolsIdx = sceneHtml.indexOf('data-testid="starter-room"');
  const prepIdx = sceneHtml.indexOf('data-testid="art-prep-counter"');
  const knifeIdx = sceneHtml.indexOf('data-testid="art-precision_knife"');
  const counterIdx = sceneHtml.indexOf('data-testid="art-service_counter"');
  const chefIdx = sceneHtml.indexOf('data-testid="art-sous_chef"');
  const licenseIdx = sceneHtml.indexOf('data-testid="art-master_license"');
  const conveyorIdx = sceneHtml.indexOf('data-testid="art-conveyor-belt"');

  assert.ok(stoolsIdx !== -1, 'Stools must be rendered in scene');
  assert.ok(prepIdx !== -1, 'Prep counter must be rendered');
  assert.ok(stoolsIdx < prepIdx, 'Layer 2 customer stools must precede Layer 3 prep counter');
  assert.ok(stoolsIdx < knifeIdx, 'Layer 2 customer stools must precede Layer 3 precision knife');
  assert.ok(stoolsIdx < counterIdx, 'Layer 2 customer stools must precede Layer 3 service counter');
  assert.ok(stoolsIdx < chefIdx, 'Layer 2 customer stools must precede Layer 3 sous chef');
  assert.ok(stoolsIdx < licenseIdx, 'Layer 2 customer stools must precede Layer 3 master license');
  assert.ok(stoolsIdx < conveyorIdx, 'Layer 2 customer stools must precede Layer 3 conveyor belt');
});

test('Milestone 3 Equipment Badges: Renders exact balanced capacities and revenue values', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  try {
    const uid = 'badge-student';
    await repo.set(
      createMockState({
        id: uid,
        inventory: ['precision_knife', 'service_counter', 'sous_chef', 'master_license'],
      }),
    );
    const host = createMockHost({ user: { uid, displayName: 'Badge Student' } });
    const html = renderTemplateToString(await renderLoadedShell(host, () => {}));

    assert.ok(html.includes('Precisionskniv (+1 kök)'), 'Precisionskniv badge shows +1 kök');
    assert.ok(
      html.includes('Utökad serveringsdisk (+2 service)'),
      'Serveringsdisk badge shows +2 service',
    );
    assert.ok(html.includes('Souschef (+2 kök)'), 'Souschef badge shows +2 kök');
    assert.ok(
      html.includes('Mästarcertifiering (+5 ¥/order)'),
      'Mästarcertifiering badge shows +5 ¥/order',
    );
    for (const id of ['precision_knife', 'service_counter', 'sous_chef', 'master_license']) {
      assert.ok(html.includes(`data-testid="scene-${id}"`), `Badge testid scene-${id} is uniform`);
    }
  } finally {
    leaveSushiView();
  }
});

test('Milestone 3 Register Bottleneck Explainer: Renders when K != S with pedagogical guidance and hides when balanced', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  try {
    // 1. Kitchen bottleneck (K=1, S=2)
    const uidK1 = 'user-k1-s2';
    await repo.set(createMockState({ id: uidK1, kitchenCapacity: 1, serviceCapacity: 2 }));
    const hostK1 = createMockHost({
      user: { uid: uidK1, displayName: 'Kitchen Bottleneck Student' },
    });
    const htmlK1 = renderTemplateToString(await renderLoadedShell(hostK1, () => {}));

    assert.ok(
      htmlK1.includes('data-testid="sushi-register-bottleneck-explainer"'),
      'Must render register bottleneck banner when K < S',
    );
    assert.ok(
      htmlK1.includes(
        'Köket begränsar intjäningen (1 order/min mot 2 ordrar/min service). Uppgradera kökskapaciteten för att höja takten.',
      ),
      'Must contain specific pedagogical guidance for kitchen bottleneck',
    );
    leaveSushiView();

    // 2. Service bottleneck (K=3, S=2)
    const uidS2 = 'user-k3-s2';
    await repo.set(createMockState({ id: uidS2, kitchenCapacity: 3, serviceCapacity: 2 }));
    const hostS2 = createMockHost({
      user: { uid: uidS2, displayName: 'Service Bottleneck Student' },
    });
    const htmlS2 = renderTemplateToString(await renderLoadedShell(hostS2, () => {}));

    assert.ok(
      htmlS2.includes('data-testid="sushi-register-bottleneck-explainer"'),
      'Must render register bottleneck banner when K > S',
    );
    assert.ok(
      htmlS2.includes(
        'Servicen begränsar intjäningen (2 ordrar/min mot 3 ordrar/min kök). Uppgradera transportband eller service för att höja takten.',
      ),
      'Must contain specific pedagogical guidance for service bottleneck',
    );
    leaveSushiView();

    // 3. Balanced state (K=2, S=2)
    const uidBalanced = 'user-k2-s2';
    await repo.set(createMockState({ id: uidBalanced, kitchenCapacity: 2, serviceCapacity: 2 }));
    const hostBalanced = createMockHost({
      user: { uid: uidBalanced, displayName: 'Balanced Student' },
    });
    const htmlBalanced = renderTemplateToString(await renderLoadedShell(hostBalanced, () => {}));

    assert.ok(
      !htmlBalanced.includes('data-testid="sushi-register-bottleneck-explainer"'),
      'Must NOT render register bottleneck banner when K == S (balanced state)',
    );
    assert.ok(
      htmlBalanced.includes('Balanserad produktion'),
      'Must indicate balanced production in rate bar',
    );
  } finally {
    leaveSushiView();
  }
});

test('Milestone 3 Revenue Collection Announcement: Swedish phrasing with collected amount and new balance', async () => {
  const repo = new InMemorySushiRepository();
  sushiService.setRepository(repo);

  const uid = 'student-collector-m3';
  // 60,000,000 units = 1000 yen starting balance.
  // 30 minutes of idle time at 20 yen/min (K=2, S=2, avgRev=10) yields 600 yen.
  const now = Date.now();
  const pastMs = now - 30 * 60 * 1000;
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
  const host = createMockHost({
    user: { uid, displayName: 'Collector Student' },
  });

  try {
    controller.init(uid, host);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(controller.state, 'Controller state must be loaded');

    // Recalculate shows 600 yen uncollected
    const calc = controller.recalculate();
    assert.equal(calc.displayedUncollectedYen, 600, 'Displayed uncollected should be 600 yen');

    await controller.collect();

    // Verify exact Swedish collection announcement format:
    // "Hämtade ${res.collectedYen} yen. Nytt saldo: ${unitsToWholeYen(this.state.balanceUnits)} yen."
    assert.equal(
      controller.announcement,
      'Hämtade 600 yen. Nytt saldo: 1600 yen.',
      'Announcement must match exact Swedish template: Hämtade ${res.collectedYen} yen. Nytt saldo: ${newBalance} yen.',
    );
    assert.equal(
      unitsToWholeYen(controller.state.balanceUnits),
      1600,
      'Balance must be updated to 1600 yen',
    );
  } finally {
    controller.reset();
  }
});
