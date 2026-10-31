import { renderProjectImprovements } from './project-scene.ts';
import {
  renderEntranceHostStation,
  renderExpandedPrepWorktop,
  renderStarterPrepCabinet,
  renderTierThreeConveyor,
} from './equipment-scene.ts';
import { RECIPE_DISPLAY_SIZE } from './recipe-display.ts';
import { RESTAURANT_SCENES } from './tier-scenes.ts';
import { currentRestaurantTier, RESTAURANT_TIER_NAMES } from './renovations.ts';
import type { RestaurantTier } from './types.ts';
import { html, svg } from 'lit-html';
import type { SushiRestaurantState } from './types.ts';
import { calculateProductionRate } from './economy.ts';
import { getCatalogItem } from './catalog.ts';
import { SUSHI_PROJECTS } from './projects.ts';

// Asset cells are separate from the starter room: ownership never changes a baked-in image.
const ATLAS_SIZE = 1254;
const CELL = ATLAS_SIZE / 5;
export const SUSHI_SPRITES: Record<string, number> = {
  prep_counter: 0,
  cap_extension_12h: 1,
  precision_knife: 2,
  conveyor_belt: 3,
  service_counter: 4,
  sous_chef: 5,
  master_license: 6,
  salmon_nigiri: 7,
  kappamaki: 8,
  maguro_nigiri: 9,
  ebi_nigiri: 10,
  tamago_nigiri: 11,
  sashimi_plate: 12,
  omakase_menu: 13,
  paper_lantern: 14,
  potted_plant: 15,
  wave_print: 16,
  noren_curtain: 17,
  andon_lantern: 18,
  sakura_bonsai: 19,
  golden_maneki_neko: 20,
};
export function spriteStyle(index: number): string {
  // Shop and purchase previews use the same art as the installed upgrades.
  const upgradeArt: Record<number, string> = {
    0: 'tier-1-prep-cabinet.png',
    3: 'tier-3-l-conveyor.png',
    4: 'entrance-host-station.png',
  };
  if (upgradeArt[index]) {
    const orientation = index === 4 ? '; transform: scaleX(-1)' : '';
    return `background-image: url('/sprites/sushi/upgrades/${upgradeArt[index]}'); background-size: contain; background-position: center; background-repeat: no-repeat${orientation}`;
  }
  // These cells touch their neighbours in the source atlas. Use the same
  // isolated bounds as the scene so shop and purchase thumbnails stay clean.
  if (index === 1) return 'background-size: 553.40% 500%; background-position: 26.77% 0%';
  if (index === 16) return 'background-size: 545.22% 660%; background-position: 26.37% 71.90%';
  if (index === 14) return 'background-size: 614.71% 500%; background-position: 100% 50%';
  return `background-position: ${(index % 5) * 25}% ${Math.floor(index / 5) * 25}%`;
}
function sprite(index: number, x: number, y: number, size: number) {
  // The wave-print cell includes the next row's chef hat; isolate the actual print.
  const viewBox =
    index === 1
      ? '275 0 226.6 250.8'
      : index === 16
        ? '270 765 230 190'
        : index === 14
          ? '1050 501.6 204 250.8'
          : `${(index % 5) * CELL} ${Math.floor(index / 5) * CELL} ${CELL} ${CELL}`;
  return svg`<svg x=${x} y=${y} width=${size} height=${size}
    viewBox=${viewBox}
    overflow="hidden" aria-hidden="true">
    <image href="/sprites/sushi/tycoon-atlas.png" width=${ATLAS_SIZE} height=${ATLAS_SIZE}/>
  </svg>`;
}
const recipes = [
  'salmon_nigiri',
  'kappamaki',
  'maguro_nigiri',
  'ebi_nigiri',
  'tamago_nigiri',
  'sashimi_plate',
  'omakase_menu',
];

export interface RestaurantSceneArrival {
  readonly itemId: string;
  readonly sequence: number;
}

function luckyCatSprite(x: number, y: number, size: number) {
  return svg`<svg x=${x} y=${y} width=${size} height=${size} viewBox="0 0 256 256" overflow="hidden" aria-hidden="true">
    <image class="sushi-lucky-cat-frames" href="/sprites/sushi/activity/lucky-cat-waving.png" width="1024" height="256"/>
  </svg>`;
}

/** Decorative choreography only; it never records an order or changes earnings. */
export function getRestaurantActivity(
  state: SushiRestaurantState,
  tier = currentRestaurantTier(state),
) {
  const { ordersPerMinute } = calculateProductionRate(
    state.kitchenCapacity,
    state.serviceCapacity,
    state.averageRevenuePerOrder,
  );
  const guests = Math.min(3, state.serviceCapacity, RESTAURANT_SCENES[tier].guests.length);
  const dishes = ['basic_nigiri', ...recipes.filter((id) => state.inventory.includes(id))];
  return {
    cycleSeconds: Math.max(8, 12 - Math.min(4, ordersPerMinute - 1)),
    guests,
    dishes,
    servings: Array.from({ length: guests * dishes.length }, (_, index) => ({
      dish: dishes[Math.floor(index / guests)],
      guest: index % guests,
    })),
  };
}

function activityKeyframes(servings: number, guests: number) {
  const at = (fraction: number, count: number) => `${((100 * fraction) / count).toFixed(5)}%`;
  return `
    @keyframes sushi-plate-travel-${servings} {
      0%, ${at(0.399, servings)} { opacity: 0; transform: translate(var(--plate-start-x), var(--plate-start-y)); }
      ${at(0.4, servings)} { opacity: 1; transform: translate(var(--plate-start-x), var(--plate-start-y)); }
      ${at(0.5, servings)} { opacity: 1; transform: translate(var(--plate-corner-x), var(--plate-corner-y)); }
      ${at(0.699, servings)} { opacity: 1; transform: translate(var(--plate-end-x), var(--plate-end-y)); }
      ${at(0.7, servings)}, 100% { opacity: 0; transform: translate(var(--plate-end-x), var(--plate-end-y)); }
    }
    @keyframes sushi-plate-dining-${servings} {
      0%, ${at(0.699, servings)} { opacity: 0; }
      ${at(0.7, servings)}, ${at(0.9, servings)} { opacity: 1; }
      ${at(1, servings)}, 100% { opacity: 0; }
    }
    @keyframes sushi-guest-dining-${guests} {
      0%, ${at(0.7, guests)} { transform: none; }
      ${at(0.8, guests)} { transform: translate(2px, -2px) rotate(-2deg); }
      ${at(0.9, guests)} { transform: translate(1px, -1px) rotate(-1deg); }
      ${at(1, guests)}, 100% { transform: none; }
    }
    @keyframes sushi-guest-happy-${guests} {
      0%, ${at(0.9, guests)} { transform: scale(1); }
      ${at(0.95, guests)} { transform: scale(1.18); }
      ${at(1, guests)}, 100% { transform: scale(1); }
    }
  `;
}

function servingDish(id: string, size = 62) {
  return id === 'basic_nigiri'
    ? svg`<image href="/sprites/sushi/tiers/tier-1-sprites/basic-nigiri.png" width=${size} height=${size}/>`
    : sprite(SUSHI_SPRITES[id], 0, 0, size);
}

export function renderRestaurantScene(
  state: SushiRestaurantState,
  options: {
    tier?: RestaurantTier;
    previewing?: boolean;
    transition?: number;
    onGreet?: (guest: number) => void;
    paused?: boolean;
    productionStopped?: boolean;
    previewDecorationId?: string | null;
    arrival?: RestaurantSceneArrival | null;
    spotlightItemId?: string;
  } = {},
) {
  const tier = options.tier ?? currentRestaurantTier(state);
  const layout = RESTAURANT_SCENES[tier];
  const owns = (id: string) => state.inventory.includes(id);
  const placements = Object.fromEntries(
    Object.entries(layout.placements).map(([id, [x, y, size]]) => [
      id,
      [x * 1536, y * 1024, size * 1536],
    ]),
  );
  // The entrance host station and floor decoration can coexist without sharing
  // the same footprint in the larger dining room.
  if (tier === 3 && owns('service_counter')) {
    for (const id of ['potted_plant', 'andon_lantern', 'sakura_bonsai', 'golden_maneki_neko']) {
      placements[id] = [0.28 * 1536, 0.39 * 1024, 0.075 * 1536];
    }
  }
  const candidate = getCatalogItem(options.previewDecorationId ?? '');
  const previewDecoration = candidate?.category === 'decoration' ? candidate : undefined;
  const sceneTitle = previewDecoration
    ? 'Förhandsvisning av din restaurang'
    : 'Din sushirestaurang';
  const wall =
    previewDecoration?.slotType === 'wallSlot' ? previewDecoration.id : state.equipped.wallSlot;
  const floor =
    previewDecoration?.slotType === 'floorSlot' ? previewDecoration.id : state.equipped.floorSlot;
  const showsDecoration = (id: string) =>
    (wall === id || floor === id) && (owns(id) || previewDecoration?.id === id);
  const prep = owns('prep_counter');
  // Preserve legacy ownership and its earned capacity in earlier tiers, but
  // only install and animate the conveyor in its new tier-three home.
  const conveyor = tier === 3 && owns('conveyor_belt');
  // Customers illustrate capacity, not tracked sales or a separate economy simulation.
  const { guests, cycleSeconds, servings } = getRestaurantActivity(state, tier);
  const renderPlacement = ([id, [x, y, size]]: [string, number[]]) => {
    if (id === 'sous_chef' || (id === 'conveyor_belt' && !conveyor)) return '';
    const decor = getCatalogItem(id)?.category === 'decoration';
    if (decor ? !showsDecoration(id) : !owns(id)) return '';
    const marker =
      id === 'prep_counter'
        ? 'art-prep-counter'
        : id === 'conveyor_belt'
          ? 'art-conveyor-belt'
          : id === 'cap_extension_12h'
            ? 'art-cap-extension'
            : `art-${id}`;
    const arrival = options.arrival?.itemId === id ? options.arrival : null;
    const ambient =
      id === 'paper_lantern'
        ? 'sushi-lantern-sway'
        : id === 'noren_curtain'
          ? 'sushi-curtain-flutter'
          : '';
    const glow = id === 'paper_lantern' || id === 'andon_lantern';
    // Wall art follows its wall plane. The early-tier knife follows its built-in board.
    const wallAngle =
      id === 'noren_curtain' || id === 'master_license' ? -25 : id === 'wave_print' ? 25 : 0;
    const spriteTransform =
      id === 'precision_knife' && tier < 3
        ? `translate(${2 * x + size} 0) scale(-1 1)`
        : wallAngle
          ? `translate(${x + size / 2} ${y + size / 2}) skewY(${wallAngle}) translate(${-x - size / 2} ${-y - size / 2})`
          : '';
    const art =
      id === 'golden_maneki_neko'
        ? luckyCatSprite(x, y, size)
        : id === 'conveyor_belt'
          ? renderTierThreeConveyor(x, y, size)
          : id === 'service_counter'
            ? renderEntranceHostStation(x, y, size)
            : id === 'prep_counter'
              ? tier === 1
                ? renderStarterPrepCabinet(x, y, size)
                : renderExpandedPrepWorktop(tier, x, y, size)
              : sprite(SUSHI_SPRITES[id], x, y, size);
    return svg`<g data-testid="${marker}" class=${id === 'conveyor_belt' ? 'sushi-belt-tread' : id === 'sous_chef' ? 'sushi-owned-sprite sushi-sous-chef-working' : 'sushi-owned-sprite'} data-arrival-sequence=${arrival?.sequence ?? ''}>
            <g class=${arrival ? 'sushi-item-arrival' : ''} style=${`--item-arrival:sushi-item-arrive-${(arrival?.sequence ?? 0) % 2 ? 'a' : 'b'};--arrival-x:${x + size / 2}px;--arrival-y:${y + size}px`}>
              <g class=${ambient} style=${`transform-origin:${x + size / 2}px ${y + size * 0.1}px`}>
                <g class=${glow ? 'sushi-decoration-glow' : ''} transform=${spriteTransform}>${art}</g>
              </g>
            </g>
          </g>`;
  };
  const frontIds = new Set(['conveyor_belt', 'service_counter']);
  const spotlightId = options.spotlightItemId;
  const recipeIndex = recipes.indexOf(spotlightId ?? '');
  const spotlight =
    spotlightId && owns(spotlightId)
      ? recipeIndex >= 0
        ? [
            layout.recipeDisplays[recipeIndex][0] * 1536,
            layout.recipeDisplays[recipeIndex][1] * 1024,
            RECIPE_DISPLAY_SIZE,
          ]
        : placements[spotlightId]
      : undefined;
  const spotlightHeight = spotlight
    ? spotlightId === 'conveyor_belt'
      ? spotlight[2] * ((0.28 * 1024) / (0.45 * 1536))
      : spotlightId === 'service_counter'
        ? (spotlight[2] * 729) / 858
        : spotlightId === 'prep_counter'
          ? spotlight[2] * (tier === 1 ? (920 * 1.28) / 1110 : 0.5)
          : spotlight[2]
    : 0;
  return html`<figure
    class="sushi-illustration"
    data-testid="restaurant-scene"
    data-paused=${Boolean(options.paused || (typeof document !== 'undefined' && document.hidden))}
    data-production-stopped=${Boolean(options.productionStopped)}
    data-tier=${tier}
    data-transition=${options.transition ?? 0}
    data-conveyor=${conveyor}
    data-preview-decoration=${previewDecoration?.id ?? ''}
    style=${`--activity-cycle:${cycleSeconds}s;--serving-period:${cycleSeconds * servings.length}s;--guest-period:${cycleSeconds * guests}s`}
  >
    <style>
      ${activityKeyframes(servings.length, guests)}
    </style>
    <div
      class="sushi-pixel-world"
      style=${`--room-enter:${options.transition ? `sushi-room-enter-${options.transition % 2 ? 'a' : 'b'}` : 'none'}`}
    >
      <svg
        viewBox="0 0 1536 1024"
        role="img"
        aria-labelledby="restaurant-art-title restaurant-art-desc"
      >
        <title id="restaurant-art-title">${sceneTitle}</title>
        <desc id="restaurant-art-desc">
          ${previewDecoration ? `Förhandsvisning: ${previewDecoration.name}. Prova utan att ändra inredningen.` : ''}
          Isometrisk vy snett uppifrån genom restaurangens öppna hörn, med två väggar och synligt
          ${layout.floorMaterial === 'tile' ? 'klinkergolv och en separat matplats' : 'trägolv'}.
          ${prep ? 'Förbättrad beredningsbänk' : 'Grundkök'}.
          ${conveyor ? 'Transportband installerat' : 'Serveringsdisk utan transportband'}.
          ${owns('precision_knife') ? 'Precisionskniv vid beredningsbänken.' : ''}
          ${owns('service_counter') ? 'Kassa och välkomstdisk vid entrén.' : ''}
          ${owns('sous_chef') ? 'Assisterande souschef i köket.' : ''}
          ${owns('master_license') ? 'Inramad mästarlicens på väggen.' : ''}
          ${owns('salmon_nigiri') ? 'Laxnigiri på disken.' : ''}
          ${owns('kappamaki') ? 'Kappamaki på disken.' : ''}
          ${owns('maguro_nigiri') ? 'Tonfisknigiri på disken.' : ''}
          ${owns('ebi_nigiri') ? 'Räknigiri på disken.' : ''}
          ${owns('tamago_nigiri') ? 'Tamagonigiri på disken.' : ''}
          ${owns('sashimi_plate') ? 'Sashimitallrik på disken.' : ''}
          ${owns('omakase_menu') ? 'Omakasemeny på disken.' : ''}
          ${showsDecoration('paper_lantern') ? 'Papperslykta på väggen.' : ''}
          ${showsDecoration('wave_print') ? 'Vågmotiv på väggen.' : ''}
          ${showsDecoration('noren_curtain') ? 'Norendraperi på väggen.' : ''}
          ${showsDecoration('potted_plant') ? 'Krukväxt på golvet.' : ''}
          ${showsDecoration('andon_lantern') ? 'Andon-golvlykta på golvet.' : ''}
          ${showsDecoration('sakura_bonsai') ? 'Sakura-bonsai på golvet.' : ''}
          ${showsDecoration('golden_maneki_neko') ? 'Gyllene Maneki-neko på golvet.' : ''}
          ${SUSHI_PROJECTS.filter((project) => state.completedProjects?.includes(project.id))
            .map((project) => `${project.name} finns på plats.`)
            .join(' ')}
        </desc>
        <image data-testid="starter-room" href=${layout.room} width="1536" height="1024" />
        ${renderProjectImprovements(state, tier)}
        ${owns('sous_chef') ? svg`<g class="sushi-sous-chef-working" data-testid="art-sous_chef">${sprite(SUSHI_SPRITES.sous_chef, placements.sous_chef[0], placements.sous_chef[1], placements.sous_chef[2])}</g>` : ''}
        ${Object.entries(placements)
          .filter(([id]) => !frontIds.has(id))
          .map(renderPlacement)}
        <svg
          x=${layout.chef[0] * 1536 - layout.chef[2] * 768}
          y=${layout.chef[1] * 1024 - layout.chef[2] * 1536}
          width=${layout.chef[2] * 1536}
          height=${layout.chef[2] * 1536}
          viewBox="0 0 256 256"
          overflow="hidden"
          aria-hidden="true"
        >
          <image
            class="sushi-chef-working"
            data-testid="sushi-activity-chef"
            href="/sprites/sushi/tiers/tier-1-sprites/chef-preparing.png"
            width="1024"
            height="256"
          />
        </svg>
        <image
          href=${layout.foreground}
          width="1536"
          height="1024"
          aria-hidden="true"
          pointer-events="none"
          data-testid="counter-foreground"
        />

        ${Object.entries(placements)
          .filter(([id]) => frontIds.has(id))
          .map(renderPlacement)}
        ${recipes.map((id, i) => {
          if (!owns(id)) return '';
          const [px, py] = layout.recipeDisplays[i];
          const x = px * 1536;
          const y = py * 1024;
          const arrival = options.arrival?.itemId === id ? options.arrival : null;
          return svg`<g data-testid="${`art-${id}`}" data-arrival-sequence=${arrival?.sequence ?? ''}>
            <g class=${arrival ? 'sushi-item-arrival' : ''} style=${`--item-arrival:sushi-item-arrive-${(arrival?.sequence ?? 0) % 2 ? 'a' : 'b'};--arrival-x:${x + RECIPE_DISPLAY_SIZE / 2}px;--arrival-y:${y + RECIPE_DISPLAY_SIZE}px`}>
              <ellipse cx=${x + RECIPE_DISPLAY_SIZE * 0.5} cy=${y + RECIPE_DISPLAY_SIZE * 0.87}
                rx=${RECIPE_DISPLAY_SIZE * 0.3} ry=${RECIPE_DISPLAY_SIZE * 0.075}
                fill="#57321c" fill-opacity="0.3" aria-hidden="true"/>
              ${sprite(SUSHI_SPRITES[id], x, y, RECIPE_DISPLAY_SIZE)}
            </g>
          </g>`;
        })}
        <g class="sushi-serving-layer" aria-hidden="true">
          ${servings.map(({ dish, guest }, index) => {
            const endX = layout.dishes[guest][0] * 1536;
            const endY = layout.dishes[guest][1] * 1024;
            const startX = conveyor ? layout.beltStart[0] * 1536 : layout.chef[0] * 1536 - 10;
            const startY = conveyor ? layout.beltStart[1] * 1024 : layout.chef[1] * 1024 - 85;
            const travelEndX = conveyor ? layout.beltEnd[0] * 1536 : endX;
            const travelEndY = conveyor ? layout.beltEnd[1] * 1024 : endY;
            const cornerX = conveyor
              ? layout.beltCorner[0] * 1536
              : startX + (travelEndX - startX) / 3;
            const cornerY = conveyor
              ? layout.beltCorner[1] * 1024
              : startY + (travelEndY - startY) / 3;
            return svg`<g class="sushi-serving-slot" data-dish=${dish} data-guest=${guest} style=${`--serving-delay:${(index - servings.length) * cycleSeconds}s;--plate-start-x:${startX}px;--plate-start-y:${startY}px;--plate-corner-x:${cornerX}px;--plate-corner-y:${cornerY}px;--plate-end-x:${travelEndX}px;--plate-end-y:${travelEndY}px`}>
              <g class="sushi-travelling-plate" style=${`animation-name:sushi-plate-travel-${servings.length}`}>${servingDish(dish, conveyor ? 48 : 62)}</g>
              <g transform=${`translate(${endX} ${endY})`}><g class="sushi-served-plate" style=${`animation-name:sushi-plate-dining-${servings.length}`}>${servingDish(dish)}</g></g>
            </g>`;
          })}
        </g>
        <g class="sushi-petals" aria-hidden="true">
          ${[
            [80, 380, 55, 300, 12, -4],
            [1440, 300, -25, 390, 15, -9],
            [1080, 920, -170, 80, 16, -2],
          ].map(
            ([x, y, drift, fall, duration, delay]) =>
              svg`<image class="sushi-falling-petal" href="/sprites/sushi/activity/cherry-petal.png" width="26" height="26" style=${`--petal-x:${x}px;--petal-y:${y}px;--petal-drift:${drift}px;--petal-fall:${fall}px;animation-duration:${duration}s;animation-delay:${delay}s`}/>`,
          )}
        </g>
        ${
          spotlight
            ? svg`<g class="sushi-purchase-spotlight" data-testid="sushi-purchase-spotlight" data-item-id=${spotlightId} aria-hidden="true" pointer-events="none">
          <rect x=${spotlight[0] - 12} y=${spotlight[1] - 12} width=${spotlight[2] + 24} height=${spotlightHeight + 24} rx="20" fill="none" stroke="#fff9e7" stroke-width="12"/>
          <rect x=${spotlight[0] - 12} y=${spotlight[1] - 12} width=${spotlight[2] + 24} height=${spotlightHeight + 24} rx="20" fill="none" stroke="#b77416" stroke-width="5"/>
        </g>`
            : ''
        }
      </svg>
      <div
        class="sushi-kitchen-steam"
        style=${`left:${layout.steam[0] * 100}%;top:${layout.steam[1] * 100}%`}
        aria-hidden="true"
      >
        <i></i><i></i><i></i>
      </div>
      ${Array.from(
        { length: guests },
        (_, i) =>
          html`<button
            type="button"
            class="sushi-scene-guest"
            data-testid=${`sushi-guest-${i}`}
            aria-label=${`Se japanska fraser med gäst ${i + 1}`}
            ?disabled=${Boolean(previewDecoration || options.previewing)}
            style=${`left:${layout.guests[i][0] * 100 - 5.6}%;top:${layout.guests[i][1] * 100 - 15.3}%;width:11.2%;--guest-delay:${(i - guests) * cycleSeconds}s`}
            @click=${() => options.onGreet?.(i)}
          >
            <span
              class="sushi-atlas-sprite"
              style=${`background-image:url(/sprites/sushi/tiers/tier-1-sprites/${['guest-seated', 'guest-coral', 'guest-mustard'][i]}.png);background-size:100% 100%;animation-name:sushi-guest-dining-${guests}`}
              aria-hidden="true"
            ></span>
            <span
              class="sushi-guest-heart"
              style=${`animation-name:sushi-guest-happy-${guests}`}
              aria-hidden="true"
              >♥</span
            >
          </button>`,
      )}
    </div>
    <figcaption class="sr-only">
      <span>${RESTAURANT_TIER_NAMES[tier]}</span
      ><span
        >${prep ? 'Utökat kök' : 'Grundkök'} ·
        ${conveyor ? 'Transportband' : 'Serveringsdisk'}</span
      >
    </figcaption>
  </figure>`;
}
