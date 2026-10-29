import { RESTAURANT_SCENES, type TierScene } from './tier-scenes.ts';
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
  return `background-position: ${(index % 5) * 25}% ${Math.floor(index / 5) * 25}%`;
}
function sprite(index: number, x: number, y: number, size: number) {
  // The wave-print cell includes the next row's chef hat; isolate the actual print.
  const viewBox =
    index === 16
      ? '270 765 230 190'
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

/** Project art shares the room's painted materials and isometric camera. */
function renderProjectImprovements(state: SushiRestaurantState, layout: TierScene) {
  const built = new Set(state.completedProjects ?? []);
  const projects = [
    { id: 'study_nook', file: 'study-nook' },
    { id: 'lantern_evening', file: 'lantern-evening' },
    { id: 'garden_terrace', file: 'garden-terrace' },
    { id: 'hanami_festival', file: 'hanami-festival-deck' },
  ] as const;
  return projects
    .filter((project) => built.has(project.id))
    .map((project) => {
      const [x, y, size] = layout.projects[project.id];
      const width = size * 1536;
      return svg`<image data-testid=${`art-project-${project.id}`} aria-hidden="true"
      href=${`/sprites/sushi/projects/${project.file}.png`}
      x=${x * 1536} y=${y * 1024} width=${width} height=${(width * 2) / 3}/>`;
    });
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
  const placements = Object.fromEntries(
    Object.entries(layout.placements).map(([id, [x, y, size]]) => [
      id,
      [x * 1536, y * 1024, size * 1536],
    ]),
  );
  const owns = (id: string) => state.inventory.includes(id);
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
  const conveyor = owns('conveyor_belt');
  // Customers illustrate capacity, not tracked sales or a separate economy simulation.
  const { guests, cycleSeconds, servings } = getRestaurantActivity(state, tier);
  const renderPlacement = ([id, [x, y, size]]: [string, number[]]) => {
    if (id === 'sous_chef') return '';
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
    return svg`<g data-testid="${marker}" class=${id === 'conveyor_belt' ? 'sushi-belt-tread' : id === 'sous_chef' ? 'sushi-owned-sprite sushi-sous-chef-working' : 'sushi-owned-sprite'} data-arrival-sequence=${arrival?.sequence ?? ''}>
            <g class=${arrival ? 'sushi-item-arrival' : ''} style=${`--item-arrival:sushi-item-arrive-${(arrival?.sequence ?? 0) % 2 ? 'a' : 'b'};--arrival-x:${x + size / 2}px;--arrival-y:${y + size}px`}>
              <g class=${ambient} style=${`transform-origin:${x + size / 2}px ${y + size * 0.1}px`}>
                <g class=${glow ? 'sushi-decoration-glow' : ''}>${id === 'golden_maneki_neko' ? luckyCatSprite(x, y, size) : id === 'conveyor_belt' ? svg`<image href="/sprites/sushi/tiers/conveyor-surface.png" x=${x} y=${y} width=${size} height=${size * 0.55}/>` : sprite(SUSHI_SPRITES[id], x, y, size)}</g>
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
            62,
          ]
        : placements[spotlightId]
      : undefined;
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
          ${owns('service_counter') ? 'Uppgraderad serveringsdisk.' : ''}
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
        ${renderProjectImprovements(state, layout)}
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
            <g class=${arrival ? 'sushi-item-arrival' : ''} style=${`--item-arrival:sushi-item-arrive-${(arrival?.sequence ?? 0) % 2 ? 'a' : 'b'};--arrival-x:${x + 31}px;--arrival-y:${y + 62}px`}>${sprite(SUSHI_SPRITES[id], x, y, 62)}</g>
          </g>`;
        })}
        <g class="sushi-serving-layer" aria-hidden="true">
          ${servings.map(({ dish, guest }, index) => {
            const endX = layout.dishes[guest][0] * 1536;
            const endY = layout.dishes[guest][1] * 1024;
            return svg`<g class="sushi-serving-slot" data-dish=${dish} data-guest=${guest} style=${`--serving-delay:${(index - servings.length) * cycleSeconds}s;--plate-start-x:${conveyor ? layout.beltStart[0] * 1536 : layout.chef[0] * 1536 - 10}px;--plate-start-y:${conveyor ? layout.beltStart[1] * 1024 : layout.chef[1] * 1024 - 85}px;--plate-end-x:${conveyor ? layout.beltEnd[0] * 1536 : endX}px;--plate-end-y:${conveyor ? layout.beltEnd[1] * 1024 : endY}px`}>
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
          <rect x=${spotlight[0] - 12} y=${spotlight[1] - 12} width=${spotlight[2] + 24} height=${spotlight[2] + 24} rx="20" fill="none" stroke="#fff9e7" stroke-width="12"/>
          <rect x=${spotlight[0] - 12} y=${spotlight[1] - 12} width=${spotlight[2] + 24} height=${spotlight[2] + 24} rx="20" fill="none" stroke="#b77416" stroke-width="5"/>
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
