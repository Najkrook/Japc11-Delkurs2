import { RESTAURANT_SCENES } from './tier-scenes.ts';
import { currentRestaurantTier } from './renovations.ts';
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

/** Permanent project scenery sits outside the two interchangeable decor slots. */
function renderProjectImprovements(state: SushiRestaurantState) {
  const built = new Set(state.completedProjects ?? []);
  return [
    built.has('study_nook')
      ? svg`<g data-testid="art-project-study_nook" aria-hidden="true" transform="translate(235 565)">
      <path d="M0 0 106 -60 150 -35 44 25Z" fill="#c69353" stroke="#714327" stroke-width="4"/>
      <path d="M0 0 44 25 44 135 0 110Z" fill="#6d432c" stroke="#54321f" stroke-width="4"/>
      <path d="M44 25 150 -35 150 75 44 135Z" fill="#a66c3b" stroke="#714327" stroke-width="4"/>
      <path d="M51 32 141 -20 141 13 51 65Z M51 80 141 28 141 65 51 117Z" fill="#4d3628"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => svg`<g transform=${`translate(${55 + i * 14} ${30 - i * 8})`}><path d="M0 0 10 -6 10 23 0 29Z" fill=${['#d4a347', '#827e57', '#a45d50', '#d4b78a', '#68856e', '#95764f'][i]} stroke="#563d2b" stroke-width="1.5"/><path d="M0 48 10 42 10 69 0 75Z" fill=${['#8c5a46', '#c99a51', '#769078', '#c8b28b', '#af6b51', '#7c7761'][i]}/></g>`)}
      <path d="M64 128 95 145 133 123 102 106Z" fill="#d1a15f" stroke="#774a2d" stroke-width="3"/>
      <path d="M69 129 96 143 127 125 101 111Z" fill="#f8edc5" stroke="#c9b78e" stroke-width="2"/><path d="M96 143 101 111" stroke="#b9a37c" stroke-width="2"/>
    </g>`
      : '',
    built.has('lantern_evening')
      ? svg`<g data-testid="art-project-lantern_evening" aria-hidden="true">
      <path d="M756 80Q1050 175 1380 405" fill="none" stroke="#5b392a" stroke-width="5"/>
      ${[
        [823, 109],
        [950, 166],
        [1075, 230],
        [1200, 303],
        [1325, 379],
      ].map(
        ([x, y], i) => svg`<g transform=${`translate(${x} ${y})`}>
        <path d="M0 0v23" stroke="#644432" stroke-width="3"/>
        <ellipse cx="0" cy="49" rx="26" ry="35" fill="#ffd16b" opacity=".18"/>
        <rect x="-18" y="22" width="36" height="50" rx="13" fill=${i % 2 ? '#e6b86a' : '#bc5945'} stroke="#7e4531" stroke-width="3"/>
        <path d="M-14 34h28M-17 46h34M-14 59h28" stroke="#f6d99b" stroke-width="2" opacity=".65"/><path d="M-10 22h20M-10 72h20" stroke="#5b392b" stroke-width="5"/>
      </g>`,
      )}
    </g>`
      : '',
    built.has('garden_terrace')
      ? svg`<g data-testid="art-project-garden_terrace" aria-hidden="true">
      ${[
        [153, 744],
        [1260, 879],
      ].map(
        ([x, y]) => svg`<g transform=${`translate(${x} ${y})`}>
        <ellipse cx="0" cy="10" rx="104" ry="45" fill="#65816b" opacity=".17"/>
        <path d="M-75 7Q-31 -29 17 -4T88 18" fill="none" stroke="#a4a18a" stroke-width="18" stroke-linecap="round"/>
        <ellipse cx="-63" cy="-12" rx="29" ry="15" fill="#72805c" stroke="#536844" stroke-width="3"/><ellipse cx="-52" cy="-29" rx="26" ry="23" fill="#78925c"/><ellipse cx="-72" cy="-28" rx="20" ry="17" fill="#8b9a61"/>
        <path d="M26 -7 43 3 60 -7 43 -17Z" fill="#d5ccb2" stroke="#79765d" stroke-width="2"/><path d="M38 -8v-32h11v32" fill="#a8a38c" stroke="#79765d" stroke-width="2"/>
        <path d="M29 -39 43 -47 58 -39 43 -30Z" fill="#e9d5a4" stroke="#79765d" stroke-width="2"/><path d="M28 -47 43 -59 59 -47 43 -38Z" fill="#b6ad91" stroke="#79765d" stroke-width="2"/>
        <ellipse cx="78" cy="-1" rx="20" ry="11" fill="#72835c"/><ellipse cx="73" cy="-13" rx="16" ry="18" fill="#82945f"/>
      </g>`,
      )}
    </g>`
      : '',
    built.has('hanami_festival')
      ? svg`<g data-testid="art-project-hanami_festival" aria-hidden="true" transform="translate(365 753) scale(.8)">
      <path d="M-132 0 0 -71 132 0 0 71Z" fill="#a45346" stroke="#713e30" stroke-width="5"/>
      <path d="M-112 0 0 -60 112 0 0 60Z" fill="none" stroke="#d7aa66" stroke-width="3"/>
      <path d="M-90 1 2 -47 89 0 -1 48Z" fill="#eed8a2" stroke="#9e7e51" stroke-width="2"/>
      <ellipse cx="-31" cy="1" rx="21" ry="11" fill="#faf0d2" stroke="#b59e73" stroke-width="2"/><ellipse cx="-31" cy="-1" rx="12" ry="5" fill="#d98c66"/>
      <ellipse cx="33" cy="6" rx="18" ry="9" fill="#faf0d2" stroke="#b59e73" stroke-width="2"/><ellipse cx="33" cy="4" rx="10" ry="5" fill="#80a072"/>
      ${[
        [-7, -19],
        [-5, 24],
        [64, -7],
      ].map(
        ([x, y]) =>
          svg`<g transform=${`translate(${x} ${y})`}><path d="M-7 -12h14v17q-7 7 -14 0Z" fill="#f2e9ca" stroke="#907653" stroke-width="2"/><ellipse cy="-12" rx="7" ry="3" fill="#8b9c6b"/></g>`,
      )}
      <path d="M-137 -2v-91M138 -2v-91M-137 -93Q0 -34 138 -93" stroke="#825235" stroke-width="4" fill="none"/>
      ${[-96, -48, 0, 48, 96].map((x, i) => svg`<path d=${`M${x} ${-75 + Math.abs(x) / 12}l18 9-18 15Z`} fill=${i % 2 ? '#e5b76f' : '#c67a79'} stroke="#975951" stroke-width="1.5"/>`)}
    </g>`
      : '',
  ];
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
          trägolv. ${prep ? 'Förbättrad beredningsbänk' : 'Grundkök'}.
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
        <g
          transform=${`translate(${layout.projectOffset[0] * 1536} ${layout.projectOffset[1] * 1024})`}
        >
          ${renderProjectImprovements(state)}
        </g>
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
          const x = layout.dishes[0][0] * 1536 + i * 40;
          const y = layout.dishes[0][1] * 1024 + i * 21;
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
            aria-label="Se japanska fraser med gästen"
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
      <span>Din lilla sushibar</span
      ><span
        >${prep ? 'Utökat kök' : 'Grundkök'} ·
        ${conveyor ? 'Transportband' : 'Serveringsdisk'}</span
      >
    </figcaption>
  </figure>`;
}
