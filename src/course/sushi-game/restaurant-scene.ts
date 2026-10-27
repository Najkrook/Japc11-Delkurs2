import { html, svg } from 'lit-html';
import type { SushiRestaurantState } from './types.ts';

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
  return svg`<svg x=${x} y=${y} width=${size} height=${size}
    viewBox=${`${(index % 5) * CELL} ${Math.floor(index / 5) * CELL} ${CELL} ${CELL}`}
    overflow="hidden" aria-hidden="true">
    <image href="/sprites/sushi/tycoon-atlas.png" width=${ATLAS_SIZE} height=${ATLAS_SIZE}/>
  </svg>`;
}
const placements: Record<string, [number, number, number]> = {
  prep_counter: [540, 403, 170],
  cap_extension_12h: [1050, 325, 76],
  precision_knife: [650, 550, 76],
  conveyor_belt: [720, 593, 300],
  service_counter: [1055, 680, 190],
  sous_chef: [760, 365, 150],
  master_license: [1130, 380, 100],
  paper_lantern: [1135, 380, 125],
  wave_print: [1135, 380, 125],
  noren_curtain: [1135, 380, 125],
  potted_plant: [1190, 615, 150],
  andon_lantern: [1190, 615, 150],
  sakura_bonsai: [1190, 615, 150],
  golden_maneki_neko: [1190, 615, 150],
};
const recipes = [
  'salmon_nigiri',
  'kappamaki',
  'maguro_nigiri',
  'ebi_nigiri',
  'tamago_nigiri',
  'sashimi_plate',
  'omakase_menu',
];
export function renderRestaurantScene(
  state: SushiRestaurantState,
  options: {
    onGreet?: (guest: number) => void;
    paused?: boolean;
  } = {},
) {
  const owns = (id: string) => state.inventory.includes(id);
  const wall = state.equipped.wallSlot;
  const floor = state.equipped.floorSlot;
  const prep = owns('prep_counter');
  const conveyor = owns('conveyor_belt');
  // Customers illustrate capacity, not tracked sales or a separate economy simulation.
  const guests = Math.min(3, state.serviceCapacity);
  return html`<figure
    class="sushi-illustration"
    data-testid="restaurant-scene"
    data-paused=${Boolean(options.paused || (typeof document !== 'undefined' && document.hidden))}
  >
    <div class="sushi-pixel-world">
      <svg
        viewBox="0 0 1536 1024"
        role="img"
        aria-labelledby="restaurant-art-title restaurant-art-desc"
      >
        <title id="restaurant-art-title">Din sushirestaurang</title>
        <desc id="restaurant-art-desc">
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
          ${wall === 'paper_lantern' && owns('paper_lantern') ? 'Papperslykta på väggen.' : ''}
          ${wall === 'wave_print' && owns('wave_print') ? 'Vågmotiv på väggen.' : ''}
          ${wall === 'noren_curtain' && owns('noren_curtain') ? 'Norendraperi på väggen.' : ''}
          ${floor === 'potted_plant' && owns('potted_plant') ? 'Krukväxt på golvet.' : ''}
          ${floor === 'andon_lantern' && owns('andon_lantern') ? 'Andon-golvlykta på golvet.' : ''}
          ${floor === 'sakura_bonsai' && owns('sakura_bonsai') ? 'Sakura-bonsai på golvet.' : ''}
          ${floor === 'golden_maneki_neko' && owns('golden_maneki_neko') ? 'Gyllene Maneki-neko på golvet.' : ''}
        </desc>
        <image
          data-testid="starter-room"
          href="/sprites/sushi/starter-room.png"
          width="1536"
          height="1024"
        />
        ${Object.entries(placements).map(([id, [x, y, size]]) => {
          const decor = [
            'paper_lantern',
            'wave_print',
            'noren_curtain',
            'potted_plant',
            'andon_lantern',
            'sakura_bonsai',
            'golden_maneki_neko',
          ].includes(id);
          if (!owns(id) || (decor && wall !== id && floor !== id)) return '';
          const marker =
            id === 'prep_counter'
              ? 'art-prep-counter'
              : id === 'conveyor_belt'
                ? 'art-conveyor-belt'
                : id === 'cap_extension_12h'
                  ? 'art-cap-extension'
                  : `art-${id}`;
          return svg`<g data-testid="${marker}" class=${id === 'conveyor_belt' ? 'sushi-belt-tread' : 'sushi-owned-sprite'}>${sprite(SUSHI_SPRITES[id], x, y, size)}</g>`;
        })}
        <g class="sushi-chef-working">${sprite(21, 690, 360, 170)}</g>
        ${recipes.map((id, i) => (owns(id) ? svg`<g data-testid="${`art-${id}`}">${sprite(SUSHI_SPRITES[id], 535 + i * 47, 502 + i * 25, 62)}</g>` : ''))}
      </svg>
      <div class="sushi-kitchen-steam" aria-hidden="true"><i></i><i></i><i></i></div>
      ${Array.from(
        { length: guests },
        (_, i) =>
          html`<button
            type="button"
            class="sushi-scene-guest"
            data-testid=${`sushi-guest-${i}`}
            aria-label="Prata med gäst på japanska"
            style=${`left:${27.6 + i * 6.2}%;top:${47.5 + i * 5.3}%;--guest-delay:${i * 0.6}s`}
            @click=${() => options.onGreet?.(i)}
          >
            <span class="sushi-atlas-sprite" style=${spriteStyle(22 + i)} aria-hidden="true"></span>
            <span class="sushi-guest-heart" aria-hidden="true">♥</span>
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
