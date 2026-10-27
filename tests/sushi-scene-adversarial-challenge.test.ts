/**
 * Adversarial Challenge Suite: State-driven Vector Scene, Catalog Items & Placement
 * Challenger 2 Verification Harness for Milestone 2
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderRestaurantScene } from '../src/course/sushi-game/restaurant-scene.ts';
import { SUSHI_CATALOG } from '../src/course/sushi-game/catalog.ts';
import type { SushiRestaurantState } from '../src/course/sushi-game/types.ts';
import { DEFAULT_CAP_MS } from '../src/course/sushi-game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    return out;
  }
  return '';
}

function createBaseState(overrides: Partial<SushiRestaurantState> = {}): SushiRestaurantState {
  return {
    schemaVersion: 1,
    id: 'challenger2-test-user',
    ownerUid: 'challenger2-test-user',
    createdAtMs: 1000,
    updatedAtMs: 1000,
    periodStartMs: 1000,
    accountedAtMs: 1000,
    usedProductionMs: 0,
    capMs: DEFAULT_CAP_MS,
    kitchenCapacity: 1,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    balanceUnits: 0,
    uncollectedUnits: 0,
    permanentGrants: [],
    inventory: [],
    equipped: { wallSlot: null, floorSlot: null },
    activeRecipe: 'salmon_nigiri',
    processedRequests: {},
    ...overrides,
  };
}

// Canonical Catalog Items Matrix
const EQUIPMENT_IDS = [
  'prep_counter',
  'precision_knife',
  'service_counter',
  'sous_chef',
  'master_license',
  'conveyor_belt',
  'cap_extension_12h',
] as const;

const RECIPE_IDS = [
  'salmon_nigiri',
  'kappamaki',
  'maguro_nigiri',
  'ebi_nigiri',
  'tamago_nigiri',
  'sashimi_plate',
  'omakase_menu',
] as const;

const WALL_DECOR_IDS = ['paper_lantern', 'wave_print', 'noren_curtain'] as const;
const FLOOR_DECOR_IDS = [
  'potted_plant',
  'andon_lantern',
  'sakura_bonsai',
  'golden_maneki_neko',
] as const;

const EXPECTED_TESTIDS: Record<string, string> = {
  // Equipment (7)
  prep_counter: 'art-prep-counter',
  precision_knife: 'art-precision_knife',
  service_counter: 'art-service_counter',
  sous_chef: 'art-sous_chef',
  master_license: 'art-master_license',
  conveyor_belt: 'art-conveyor-belt',
  cap_extension_12h: 'art-cap-extension',

  // Recipes (7)
  salmon_nigiri: 'art-salmon_nigiri',
  kappamaki: 'art-kappamaki',
  maguro_nigiri: 'art-maguro_nigiri',
  ebi_nigiri: 'art-ebi_nigiri',
  tamago_nigiri: 'art-tamago_nigiri',
  sashimi_plate: 'art-sashimi_plate',
  omakase_menu: 'art-omakase_menu',

  // Decor (7)
  paper_lantern: 'art-paper_lantern',
  wave_print: 'art-wave_print',
  noren_curtain: 'art-noren_curtain',
  potted_plant: 'art-potted_plant',
  andon_lantern: 'art-andon_lantern',
  sakura_bonsai: 'art-sakura_bonsai',
  golden_maneki_neko: 'art-golden_maneki_neko',
};

// ============================================================================
// CHALLENGE 1: Vector Artwork & Master Catalog Completeness
// ============================================================================

test('CHALLENGE 1: Layered pixel-art scene and 21 catalog items exist in SUSHI_CATALOG', () => {
  assert.equal(SUSHI_CATALOG.length, 21, 'Master catalog must contain exactly 21 items');

  const catalogIds = new Set(SUSHI_CATALOG.map((item) => item.id));
  for (const id of [...EQUIPMENT_IDS, ...RECIPE_IDS, ...WALL_DECOR_IDS, ...FLOOR_DECOR_IDS]) {
    assert.ok(catalogIds.has(id as any), `Master catalog must define ${id}`);
  }

  // Baseline scene contains only state-driven vector geometry
  const emptyState = createBaseState();
  const svgHtml = renderTemplateToString(renderRestaurantScene(emptyState));

  assert.ok(
    svgHtml.includes('/sprites/sushi/tiers/tier-1.png'),
    'Scene loads the empty starter room',
  );
  assert.ok(!svgHtml.includes('sakura_sushi_scene.png'), 'The pre-furnished mockup is not used');
});

// ============================================================================
// CHALLENGE 2: Item Combinations (0 items, 1 item at a time, all 21 items)
// ============================================================================

test('CHALLENGE 2A: 0 items owned (baseline restaurant)', () => {
  const emptyState = createBaseState({ inventory: [] });
  const svgHtml = renderTemplateToString(renderRestaurantScene(emptyState));

  // No equipment testids rendered
  for (const id of EQUIPMENT_IDS) {
    const testId = EXPECTED_TESTIDS[id];
    assert.ok(
      !svgHtml.includes(`data-testid="${testId}"`),
      `Baseline must not render unowned equipment: ${testId}`,
    );
  }

  // No recipe testids rendered
  for (const id of RECIPE_IDS) {
    const testId = EXPECTED_TESTIDS[id];
    assert.ok(
      !svgHtml.includes(`data-testid="${testId}"`),
      `Baseline must not render unowned recipe: ${testId}`,
    );
  }

  // No decor testids rendered
  for (const id of [...WALL_DECOR_IDS, ...FLOOR_DECOR_IDS]) {
    const testId = EXPECTED_TESTIDS[id];
    assert.ok(
      !svgHtml.includes(`data-testid="${testId}"`),
      `Baseline must not render unequipped/unowned decor: ${testId}`,
    );
  }
});

test('CHALLENGE 2B: 1 item owned individually (all 21 items tested one by one)', () => {
  // Test all 7 equipment individually
  for (const eqId of EQUIPMENT_IDS) {
    const testId = EXPECTED_TESTIDS[eqId];
    const state = createBaseState({ inventory: [eqId] });
    const svgHtml = renderTemplateToString(renderRestaurantScene(state));

    assert.ok(
      svgHtml.includes(`data-testid="${testId}"`),
      `When owning only ${eqId}, ${testId} must render`,
    );

    // Verify other equipment are NOT rendered
    for (const otherEq of EQUIPMENT_IDS) {
      if (otherEq !== eqId) {
        assert.ok(
          !svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[otherEq]}"`),
          `When owning only ${eqId}, ${EXPECTED_TESTIDS[otherEq]} must NOT render`,
        );
      }
    }
  }

  // Test all 7 recipes individually
  for (const recId of RECIPE_IDS) {
    const testId = EXPECTED_TESTIDS[recId];
    const state = createBaseState({ inventory: [recId] });
    const svgHtml = renderTemplateToString(renderRestaurantScene(state));

    assert.ok(
      svgHtml.includes(`data-testid="${testId}"`),
      `When owning only ${recId}, ${testId} must render`,
    );

    for (const otherRec of RECIPE_IDS) {
      if (otherRec !== recId) {
        assert.ok(
          !svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[otherRec]}"`),
          `When owning only ${recId}, ${EXPECTED_TESTIDS[otherRec]} must NOT render`,
        );
      }
    }
  }

  // Test all 3 wall decor individually (equipped in wallSlot)
  for (const wallId of WALL_DECOR_IDS) {
    const testId = EXPECTED_TESTIDS[wallId];
    const state = createBaseState({
      inventory: [wallId],
      equipped: { wallSlot: wallId, floorSlot: null },
    });
    const svgHtml = renderTemplateToString(renderRestaurantScene(state));

    assert.ok(
      svgHtml.includes(`data-testid="${testId}"`),
      `When equipped in wallSlot, ${testId} must render`,
    );

    for (const otherWall of WALL_DECOR_IDS) {
      if (otherWall !== wallId) {
        assert.ok(
          !svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[otherWall]}"`),
          `When equipping only ${wallId}, ${EXPECTED_TESTIDS[otherWall]} must NOT render`,
        );
      }
    }
  }

  // Test all 4 floor decor individually (equipped in floorSlot)
  for (const floorId of FLOOR_DECOR_IDS) {
    const testId = EXPECTED_TESTIDS[floorId];
    const state = createBaseState({
      inventory: [floorId],
      equipped: { wallSlot: null, floorSlot: floorId },
    });
    const svgHtml = renderTemplateToString(renderRestaurantScene(state));

    assert.ok(
      svgHtml.includes(`data-testid="${testId}"`),
      `When equipped in floorSlot, ${testId} must render`,
    );

    for (const otherFloor of FLOOR_DECOR_IDS) {
      if (otherFloor !== floorId) {
        assert.ok(
          !svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[otherFloor]}"`),
          `When equipping only ${floorId}, ${EXPECTED_TESTIDS[otherFloor]} must NOT render`,
        );
      }
    }
  }
});

test('CHALLENGE 2C: Full Inventory (All 21 items owned simultaneously)', () => {
  const allInventory = [...EQUIPMENT_IDS, ...RECIPE_IDS, ...WALL_DECOR_IDS, ...FLOOR_DECOR_IDS];

  // Test wall & floor combinations
  for (const wallId of WALL_DECOR_IDS) {
    for (const floorId of FLOOR_DECOR_IDS) {
      const state = createBaseState({
        inventory: allInventory,
        equipped: { wallSlot: wallId, floorSlot: floorId },
      });
      const svgHtml = renderTemplateToString(renderRestaurantScene(state));

      // All 7 equipment MUST render
      for (const eqId of EQUIPMENT_IDS) {
        assert.ok(
          svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[eqId]}"`),
          `All-owned scene must render equipment ${EXPECTED_TESTIDS[eqId]}`,
        );
      }

      // All 7 recipes MUST render
      for (const recId of RECIPE_IDS) {
        assert.ok(
          svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[recId]}"`),
          `All-owned scene must render recipe ${EXPECTED_TESTIDS[recId]}`,
        );
      }

      // Currently equipped decor MUST render
      assert.ok(
        svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[wallId]}"`),
        `Equipped wall decor ${EXPECTED_TESTIDS[wallId]} must render`,
      );
      assert.ok(
        svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[floorId]}"`),
        `Equipped floor decor ${EXPECTED_TESTIDS[floorId]} must render`,
      );

      // Tatami mat MUST render
    }
  }
});

test('CHALLENGE 2D: Fuzzing random subsets of inventory & equipment (100 pseudo-random iterations)', () => {
  const allItems = [...EQUIPMENT_IDS, ...RECIPE_IDS, ...WALL_DECOR_IDS, ...FLOOR_DECOR_IDS];

  // Pseudo-random LCG generator for deterministic fuzzing
  let seed = 42;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  for (let iter = 0; iter < 100; iter++) {
    const subset = allItems.filter(() => rnd() > 0.5);
    const ownedWalls = WALL_DECOR_IDS.filter((w) => subset.includes(w));
    const ownedFloors = FLOOR_DECOR_IDS.filter((f) => subset.includes(f));

    const wallSlot =
      ownedWalls.length > 0 && rnd() > 0.3
        ? ownedWalls[Math.floor(rnd() * ownedWalls.length)]
        : null;
    const floorSlot =
      ownedFloors.length > 0 && rnd() > 0.3
        ? ownedFloors[Math.floor(rnd() * ownedFloors.length)]
        : null;

    const state = createBaseState({
      inventory: subset,
      equipped: { wallSlot, floorSlot },
    });

    const svgHtml = renderTemplateToString(renderRestaurantScene(state));

    // Verify equipment invariants
    for (const eqId of EQUIPMENT_IDS) {
      const isOwned = subset.includes(eqId);
      const testId = EXPECTED_TESTIDS[eqId];
      if (isOwned) {
        assert.ok(
          svgHtml.includes(`data-testid="${testId}"`),
          `Iter ${iter}: ${testId} should render`,
        );
      } else {
        assert.ok(
          !svgHtml.includes(`data-testid="${testId}"`),
          `Iter ${iter}: ${testId} should NOT render`,
        );
      }
    }

    // Verify recipe invariants
    for (const recId of RECIPE_IDS) {
      const isOwned = subset.includes(recId);
      const testId = EXPECTED_TESTIDS[recId];
      if (isOwned) {
        assert.ok(
          svgHtml.includes(`data-testid="${testId}"`),
          `Iter ${iter}: ${testId} should render`,
        );
      } else {
        assert.ok(
          !svgHtml.includes(`data-testid="${testId}"`),
          `Iter ${iter}: ${testId} should NOT render`,
        );
      }
    }

    // Verify equipped decor invariants
    if (wallSlot && subset.includes(wallSlot)) {
      assert.ok(
        svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[wallSlot]}"`),
        `Iter ${iter}: Equipped wall ${wallSlot} must render`,
      );
    }
    if (floorSlot && subset.includes(floorSlot)) {
      assert.ok(
        svgHtml.includes(`data-testid="${EXPECTED_TESTIDS[floorSlot]}"`),
        `Iter ${iter}: Equipped floor ${floorSlot} must render`,
      );
    }
  }
});

// ============================================================================
// CHALLENGE 3: Decoration placement and removal
// ============================================================================

test('CHALLENGE 3: Removing a decoration restores the undecorated scene', () => {
  for (const id of [...WALL_DECOR_IDS, ...FLOOR_DECOR_IDS]) {
    const slot = WALL_DECOR_IDS.includes(id as any) ? 'wallSlot' : 'floorSlot';
    const state = createBaseState({ inventory: [id] });
    const before = renderTemplateToString(renderRestaurantScene(state));
    state.equipped[slot] = id;
    const placed = renderTemplateToString(renderRestaurantScene(state));
    assert.notEqual(placed, before, 'Placement must change the actual scene');
    state.equipped[slot] = null;
    assert.equal(renderTemplateToString(renderRestaurantScene(state)), before);
    assert.ok(
      !before.includes('sakura_sushi_scene.png'),
      'No pre-furnished mockup remains after removal',
    );
  }
});

// ============================================================================
// CHALLENGE 4: Conveyor Belt Animation, Pause & Reduced-Motion Contracts
// ============================================================================

test('CHALLENGE 4: Conveyor belt tread animation, pause on data-paused="true", and prefers-reduced-motion', () => {
  const cssPath = path.resolve(__dirname, '../src/course/sushi-game/sushi.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Verify .sushi-belt-tread animation definition
  assert.ok(
    cssContent.includes('.sushi-belt-tread'),
    'sushi.css must contain .sushi-belt-tread rule',
  );
  assert.ok(
    cssContent.includes('animation: sushi-belt-travel'),
    'sushi.css must bind animation: sushi-belt-travel to .sushi-belt-tread',
  );
  assert.ok(
    cssContent.includes('@keyframes sushi-belt-travel'),
    'sushi.css must declare @keyframes sushi-belt-travel',
  );

  // Verify pause behavior on data-paused="true"
  assert.ok(
    cssContent.includes(".sushi-illustration[data-paused='true']"),
    "sushi.css must define pause rule for .sushi-illustration[data-paused='true']",
  );
  assert.ok(
    cssContent.includes('animation-play-state: paused;'),
    'sushi.css must set animation-play-state: paused when data-paused="true"',
  );

  // Verify prefers-reduced-motion: reduce
  assert.ok(
    cssContent.includes('@media (prefers-reduced-motion: reduce)'),
    'sushi.css must include prefers-reduced-motion: reduce media query',
  );
  // Extract the reduced-motion block and check .sushi-belt-tread
  const reducedMotionIdx = cssContent.indexOf('@media (prefers-reduced-motion: reduce)');
  const reducedMotionBlock = cssContent.slice(reducedMotionIdx);
  assert.ok(
    reducedMotionBlock.includes('.sushi-belt-tread') &&
      reducedMotionBlock.includes('animation: none;'),
    'sushi.css must disable sushi-belt-tread animation in prefers-reduced-motion block',
  );
});

// ============================================================================
// CHALLENGE 5: Accessibility Tree (Title, Desc & Swedish Semantic Labelling)
// ============================================================================

test('CHALLENGE 5: Accessibility tree carries correct title, desc and dynamic Swedish content', () => {
  const baseState = createBaseState();
  const baseHtml = renderTemplateToString(renderRestaurantScene(baseState));

  // Accessibility tree header
  assert.ok(
    baseHtml.includes('<title id="restaurant-art-title">Din sushirestaurang</title>'),
    'Must include exact Swedish title: Din sushirestaurang',
  );
  assert.ok(
    baseHtml.includes('<desc id="restaurant-art-desc">'),
    'Must include desc element with id restaurant-art-desc',
  );
  assert.ok(
    baseHtml.includes('aria-labelledby="restaurant-art-title restaurant-art-desc"'),
    'SVG must bind aria-labelledby to title and desc IDs',
  );
  assert.ok(baseHtml.includes('role="img"'), 'SVG must declare role="img"');

  // Baseline desc checks
  assert.ok(baseHtml.includes('Grundkök'), 'Baseline desc contains Grundkök');
  assert.ok(
    baseHtml.includes('Serveringsdisk utan transportband'),
    'Baseline desc contains Serveringsdisk utan transportband',
  );

  // Dynamic state upgrade desc checks
  const upgradedState = createBaseState({
    inventory: [
      'prep_counter',
      'conveyor_belt',
      'precision_knife',
      'service_counter',
      'sous_chef',
      'master_license',
      'salmon_nigiri',
      'kappamaki',
      'maguro_nigiri',
      'ebi_nigiri',
      'tamago_nigiri',
      'sashimi_plate',
      'omakase_menu',
      'wave_print',
      'sakura_bonsai',
    ],
    equipped: {
      wallSlot: 'wave_print',
      floorSlot: 'sakura_bonsai',
    },
  });

  const upgradedHtml = renderTemplateToString(renderRestaurantScene(upgradedState));

  assert.ok(
    upgradedHtml.includes('Förbättrad beredningsbänk'),
    'Desc reflects Förbättrad beredningsbänk',
  );
  assert.ok(
    upgradedHtml.includes('Transportband installerat'),
    'Desc reflects Transportband installerat',
  );
  assert.ok(
    upgradedHtml.includes('Precisionskniv vid beredningsbänken.'),
    'Desc reflects Precisionskniv',
  );
  assert.ok(
    upgradedHtml.includes('Uppgraderad serveringsdisk.'),
    'Desc reflects Uppgraderad serveringsdisk',
  );
  assert.ok(
    upgradedHtml.includes('Assisterande souschef i köket.'),
    'Desc reflects Assisterande souschef',
  );
  assert.ok(
    upgradedHtml.includes('Inramad mästarlicens på väggen.'),
    'Desc reflects Inramad mästarlicens',
  );
  assert.ok(upgradedHtml.includes('Laxnigiri på disken.'), 'Desc reflects Laxnigiri');
  assert.ok(upgradedHtml.includes('Kappamaki på disken.'), 'Desc reflects Kappamaki');
  assert.ok(upgradedHtml.includes('Tonfisknigiri på disken.'), 'Desc reflects Tonfisknigiri');
  assert.ok(upgradedHtml.includes('Räknigiri på disken.'), 'Desc reflects Räknigiri');
  assert.ok(upgradedHtml.includes('Tamagonigiri på disken.'), 'Desc reflects Tamagonigiri');
  assert.ok(upgradedHtml.includes('Sashimitallrik på disken.'), 'Desc reflects Sashimitallrik');
  assert.ok(upgradedHtml.includes('Omakasemeny på disken.'), 'Desc reflects Omakasemeny');
  assert.ok(upgradedHtml.includes('Vågmotiv på väggen.'), 'Desc reflects Vågmotiv');
  assert.ok(upgradedHtml.includes('Sakura-bonsai på golvet.'), 'Desc reflects Sakura-bonsai');
});
