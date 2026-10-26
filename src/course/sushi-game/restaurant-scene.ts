import { html, svg } from 'lit-html';
import type { SushiRestaurantState } from './types.ts';

// ============================================================================
// 2:1 Dimetric Isometric Pixel-Art Projection Engine (Sakura Sushi 1672x861)
// ============================================================================

/**
 * Standard 2:1 Dimetric Isometric Projection mapped to the 1672x861 Sakura Sushi canvas.
 * Room center apex is anchored at (750, 10) within the 1672x861 viewBox.
 */
const ORIGIN_X = 750;
const ORIGIN_Y = 10;

/**
 * Maps grid coordinates (gx, gy, z) to screen space [x, y].
 */
function iso(gx: number, gy: number, z = 0): [number, number] {
  return [Math.round(ORIGIN_X + (gx - gy) * 64), Math.round(ORIGIN_Y + (gx + gy) * 32 - z)];
}

function polyPoints(pts: Array<[number, number, number?]>): string {
  return pts.map(([gx, gy, z = 0]) => iso(gx, gy, z).join(',')).join(' ');
}

function renderPlateBase(cx: number, cy: number, plateColor = '#f8ebcc') {
  return svg`
    <ellipse cx=${cx} cy=${cy + 2} rx="14" ry="7" fill="#422a1d" opacity="0.25" stroke="none" />
    <ellipse cx=${cx} cy=${cy} rx="14" ry="7" fill=${plateColor} stroke="#754b37" stroke-width="1.5" />
    <ellipse cx=${cx} cy=${cy} rx="10" ry="5" fill="none" stroke="#d7c6a6" stroke-width="1" />
  `;
}

// ============================================================================
// Main Scene Component: Sakura Sushi Isometric Pixel-Art Restaurant
// ============================================================================

export function renderRestaurantScene(state: SushiRestaurantState) {
  const owns = (id: string) => state.inventory.includes(id);
  const wall = state.equipped.wallSlot;
  const floor = state.equipped.floorSlot;
  const prep = owns('prep_counter');
  const conveyor = owns('conveyor_belt');

  return html`<figure
    class="sushi-illustration"
    data-testid="restaurant-scene"
    data-paused=${typeof document !== 'undefined' && document.hidden}
  >
    <svg
      viewBox="0 0 1672 861"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-labelledby="restaurant-art-title restaurant-art-desc"
      shape-rendering="crispEdges"
      style="image-rendering: pixelated; image-rendering: crisp-edges;"
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

      <style>
        .sushi-pixel-art {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: -moz-crisp-edges;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
      </style>

      <g class="sushi-pixel-art" stroke-linejoin="miter" stroke-linecap="square">
        <!-- Warm Cream Washi Canvas Background matching Sushi_game.png -->
        <path fill="#fef0d4" d="M0 0h1672v861H0z" stroke="none" />

        <!-- ================================================================= -->
        <!-- LAYER 1: Base Architecture & Sakura Sushi Isometric Illustration  -->
        <!-- ================================================================= -->

        <!-- Sub-layer tile references for sprite pack compatibility -->
        <g opacity="0" aria-hidden="true">
          <image href="/sprites/sushi/kitchen/floor_kitchen_quarry_tile.png" x="700" y="120" width="64" height="64" />
          <image href="/sprites/sushi/diner/floor_diner_checker.png" x="700" y="420" width="64" height="64" />
          <image href="/sprites/sushi/kitchen/prep_table.png" x="640" y="220" width="64" height="64" />
          <image href="/sprites/sushi/diner/diner_counter.png" x="700" y="460" width="64" height="64" />
        </g>

        <!-- Master High-Resolution Isometric Pixel-Art Illustration -->
        <image
          href="/sprites/sushi/sakura_sushi_scene.png"
          x="0"
          y="0"
          width="1672"
          height="861"
          preserveAspectRatio="xMidYMid meet"
          style="image-rendering: pixelated; image-rendering: crisp-edges;"
        />

        <!-- Tatami / Woven Fish Welcome Mat Runner Area (Layer 1 Decor) -->
        <g data-testid="art-tatami_mat" class="sushi-tatami-area">
          <polygon
            points="1138,712 1218,672 1288,707 1208,747"
            fill="#4b7b47"
            fill-opacity="0.12"
            stroke="#2e542b"
            stroke-width="1.5"
            stroke-opacity="0.45"
          />
        </g>

        <!-- ================================================================= -->
        <!-- LAYER 2: Customer Stools (Must contain fill="#e4b77e" before L3)  -->
        <!-- ================================================================= -->

        <g class="sushi-stools-group">
          <!-- Stool 1 (Left Counter Customer Stool Rim) -->
          <g class="sushi-customer-stool">
            <ellipse
              cx="507"
              cy="466"
              rx="18"
              ry="9"
              fill="#e4b77e"
              fill-opacity="0.22"
              stroke="#754b37"
              stroke-width="1"
              stroke-opacity="0.35"
            />
          </g>
          <!-- Stool 2 (Center-Left Counter Customer Stool Rim) -->
          <g class="sushi-customer-stool">
            <ellipse
              cx="612"
              cy="520"
              rx="18"
              ry="9"
              fill="#e4b77e"
              fill-opacity="0.22"
              stroke="#754b37"
              stroke-width="1"
              stroke-opacity="0.35"
            />
          </g>
          <!-- Stool 3 (Center-Right Counter Customer Stool Rim) -->
          <g class="sushi-customer-stool">
            <ellipse
              cx="716"
              cy="572"
              rx="18"
              ry="9"
              fill="#e4b77e"
              fill-opacity="0.22"
              stroke="#754b37"
              stroke-width="1"
              stroke-opacity="0.35"
            />
          </g>
        </g>

        <!-- ================================================================= -->
        <!-- LAYER 3: Equipment Upgrades, Conveyor Belt & Recipe Plates       -->
        <!-- ================================================================= -->

        <!-- 1. Upgraded Prep Counter (art-prep-counter) -->
        ${
          prep
            ? svg`<g data-testid="art-prep-counter" class="sushi-art-prep-counter">
          <!-- Hinoki wooden prep board on the kitchen prep station (640, 225) -->
          <polygon
            points="612,226 654,205 676,216 634,237"
            fill="#e7bd80"
            stroke="#583e32"
            stroke-width="1.5"
          />
          <circle cx="645" cy="220" r="3.5" fill="#48bb78" stroke="#22543d" stroke-width="1" />
        </g>`
            : ''
        }

        <!-- 2. Precision Knife (art-precision_knife) -->
        ${
          owns('precision_knife')
            ? svg`<g data-testid="art-precision_knife" class="sushi-art-precision_knife">
          <!-- Hand-forged Yanagiba knife by the sushi chef's board (818, 426) -->
          <line x1="802" y1="422" x2="828" y2="435" stroke="#f8fafc" stroke-width="2.5" />
          <line x1="794" y1="418" x2="802" y2="422" stroke="#583e32" stroke-width="3" />
          <circle cx="815" cy="428" r="1.5" fill="#ffffff" />
        </g>`
            : ''
        }

        <!-- 3. Extended Service Counter (art-service_counter) -->
        ${
          owns('service_counter')
            ? svg`<g data-testid="art-service_counter" class="sushi-art-service_counter">
          <!-- Golden Hinoki lacquer trim along the L-shaped counter & brass service bell -->
          <polyline
            points="510,368 912,569 1132,459"
            fill="none"
            stroke="#d4af37"
            stroke-width="2.5"
            stroke-opacity="0.75"
          />
          <ellipse cx="954" cy="542" rx="6" ry="4" fill="#ecc94b" stroke="#78350f" stroke-width="1.2" />
          <circle cx="954" cy="538" r="2" fill="#fef08a" />
        </g>`
            : ''
        }

        <!-- 4. Sous Chef Character (art-sous_chef) -->
        ${
          owns('sous_chef')
            ? svg`<g data-testid="art-sous_chef" class="sushi-art-sous_chef">
          <!-- Sous chef hachimaki headband & warm cooking steam at stove (812, 185) -->
          <rect x="802" y="178" width="18" height="4" rx="1" fill="#ffffff" stroke="#c53030" stroke-width="1" />
          <circle cx="811" cy="180" r="1.5" fill="#c53030" />
          <path d="M 885 215 Q 880 202 886 190" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.7" />
          <path d="M 902 222 Q 897 209 903 197" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.7" />
        </g>`
            : ''
        }

        <!-- 5. Master License (art-master_license) -->
        ${
          owns('master_license')
            ? svg`<g data-testid="art-master_license" class="sushi-art-master_license">
          <!-- Golden seal & border highlight on the calligraphy scroll (484, 152) -->
          <polygon
            points="458,125 510,99 510,192 458,218"
            fill="none"
            stroke="#d4af37"
            stroke-width="2.5"
          />
          <rect x="492" y="176" width="8" height="8" fill="#c53030" stroke="#7f1d1d" stroke-width="1" />
        </g>`
            : ''
        }

        <!-- 6. Cap Extension 12h Wall Clock Fixture (art-cap-extension) -->
        ${
          owns('cap_extension_12h')
            ? svg`<g data-testid="art-cap-extension" class="sushi-art-cap-extension">
          <!-- Traditional wooden wall clock on left wall plaque (535, 118) -->
          <circle cx="535" cy="118" r="10" fill="#fff4da" stroke="#583e32" stroke-width="2.5" />
          <line x1="535" y1="118" x2="535" y2="111" stroke="#2b1810" stroke-width="1.8" />
          <line x1="535" y1="118" x2="541" y2="118" stroke="#c53030" stroke-width="1.5" />
        </g>`
            : ''
        }

        <!-- 7. Conveyor Belt Track & Rotating Plates (art-conveyor-belt) -->
        ${
          conveyor
            ? svg`<g data-testid="art-conveyor-belt" class="sushi-art-conveyor-belt">
          <!-- 2:1 Dimetric Kaiten-zushi Conveyor Track along the L-shaped counter -->
          <polyline
            points="540,362 912,548 1098,455"
            fill="none"
            stroke="#583e32"
            stroke-width="8"
            stroke-opacity="0.55"
          />
          <path
            class="sushi-belt-tread"
            d="M 540 362 L 912 548 L 1098 455"
            fill="none"
            stroke="#f6c845"
            stroke-width="3"
            stroke-dasharray="6 27"
          />
        </g>`
            : svg`
        <g class="sushi-base-counter-display">
          <polygon
            points=${polyPoints([
              [1.9, 4.05, 36],
              [2.1, 4.05, 36],
              [2.1, 4.15, 36],
              [1.9, 4.15, 36],
            ])}
            fill="#c69260"
            fill-opacity="0.01"
            stroke="none"
          />
        </g>`
        }

        <!-- 8. All 7 Recipe Plates on Counter / Conveyor Track -->
        <!-- Salmon Nigiri (art-salmon_nigiri) -->
        ${
          owns('salmon_nigiri')
            ? svg`<g data-testid="art-salmon_nigiri" class="sushi-art-salmon_nigiri">
          ${renderPlateBase(592, 388, '#fffdfa')}
          <ellipse cx="592" cy="386" rx="8" ry="4" fill="#f97316" stroke="#c2410c" stroke-width="1" />
          <line x1="587" y1="385" x2="597" y2="387" stroke="#ffedd5" stroke-width="1.2" />
        </g>`
            : ''
        }

        <!-- Kappamaki (art-kappamaki) -->
        ${
          owns('kappamaki')
            ? svg`<g data-testid="art-kappamaki" class="sushi-art-kappamaki">
          ${renderPlateBase(676, 430, '#f8ebcc')}
          <circle cx="671" cy="428" r="3.5" fill="#1e293b" />
          <circle cx="671" cy="428" r="2" fill="#ffffff" />
          <circle cx="671" cy="428" r="1" fill="#22c55e" />
          <circle cx="680" cy="429" r="3.5" fill="#1e293b" />
          <circle cx="680" cy="429" r="2" fill="#ffffff" />
          <circle cx="680" cy="429" r="1" fill="#22c55e" />
        </g>`
            : ''
        }

        <!-- Maguro Nigiri (art-maguro_nigiri) -->
        ${
          owns('maguro_nigiri')
            ? svg`<g data-testid="art-maguro_nigiri" class="sushi-art-maguro_nigiri">
          ${renderPlateBase(756, 470, '#fffdfa')}
          <ellipse cx="756" cy="468" rx="8" ry="4" fill="#dc2626" stroke="#991b1b" stroke-width="1" />
        </g>`
            : ''
        }

        <!-- Ebi Nigiri (art-ebi_nigiri) -->
        ${
          owns('ebi_nigiri')
            ? svg`<g data-testid="art-ebi_nigiri" class="sushi-art-ebi_nigiri">
          ${renderPlateBase(864, 524, '#f8ebcc')}
          <ellipse cx="864" cy="522" rx="8" ry="4" fill="#fb7185" stroke="#e11d48" stroke-width="1" />
          <line x1="861" y1="520" x2="861" y2="524" stroke="#ffffff" stroke-width="1.2" />
          <line x1="866" y1="520" x2="866" y2="524" stroke="#ffffff" stroke-width="1.2" />
        </g>`
            : ''
        }

        <!-- Tamago Nigiri (art-tamago_nigiri) -->
        ${
          owns('tamago_nigiri')
            ? svg`<g data-testid="art-tamago_nigiri" class="sushi-art-tamago_nigiri">
          ${renderPlateBase(958, 522, '#fffdfa')}
          <rect x="950" y="517" width="16" height="8" rx="2" fill="#facc15" stroke="#ca8a04" stroke-width="1" />
          <rect x="956" y="517" width="4" height="8" fill="#1e293b" />
        </g>`
            : ''
        }

        <!-- Sashimi Moriawase Platter (art-sashimi_plate) -->
        ${
          owns('sashimi_plate')
            ? svg`<g data-testid="art-sashimi_plate" class="sushi-art-sashimi_plate">
          <polygon
            points="1008,492 1034,479 1046,486 1020,499"
            fill="#1e293b"
            stroke="#0f172a"
            stroke-width="1.2"
          />
          <circle cx="1024" cy="489" r="3" fill="#f97316" />
          <circle cx="1031" cy="486" r="3" fill="#dc2626" />
          <circle cx="1019" cy="491" r="2" fill="#22c55e" />
        </g>`
            : ''
        }

        <!-- Omakase Menu Platter (art-omakase_menu) -->
        ${
          owns('omakase_menu')
            ? svg`<g data-testid="art-omakase_menu" class="sushi-art-omakase_menu">
          <polygon
            points="1062,464 1092,449 1106,456 1076,471"
            fill="#7f1d1d"
            stroke="#d4af37"
            stroke-width="1.5"
          />
          <circle cx="1078" cy="460" r="3" fill="#f97316" />
          <circle cx="1086" cy="457" r="3" fill="#facc15" />
          <circle cx="1093" cy="454" r="2.5" fill="#dc2626" />
        </g>`
            : ''
        }

        <!-- ================================================================= -->
        <!-- LAYER 4: Equipped Wall & Floor Personalization Decorations        -->
        <!-- ================================================================= -->

        <!-- 1. Wave Print (art-wave_print) - Right Wall Ukiyo-e Print (1465, 395) -->
        ${
          wall === 'wave_print' && owns(wall)
            ? svg`<g data-testid="art-wave_print" class="sushi-art-wave_print">
          <polygon
            points="1434,296 1496,328 1496,492 1434,460"
            fill="none"
            stroke="#d4af37"
            stroke-width="3"
          />
          <circle cx="1456" cy="340" r="8" fill="#dc2626" fill-opacity="0.35" />
        </g>`
            : ''
        }

        <!-- 2. Noren Curtain (art-noren_curtain) - Indigo Noren Curtains -->
        ${
          wall === 'noren_curtain' && owns(wall)
            ? svg`<g data-testid="art-noren_curtain" class="sushi-art-noren_curtain">
          <!-- Gold kamon rod accent over the entrance and kitchen noren curtains -->
          <line x1="252" y1="226" x2="386" y2="158" stroke="#f6c845" stroke-width="3" />
          <line x1="1038" y1="126" x2="1122" y2="168" stroke="#f6c845" stroke-width="3" />
        </g>`
            : ''
        }

        <!-- 3. Paper Lantern (art-paper_lantern) - Warm Hanging Wall Lanterns -->
        ${
          wall === 'paper_lantern' && owns(wall)
            ? svg`<g data-testid="art-paper_lantern" class="sushi-art-paper_lantern">
          <!-- Warm golden lantern glow halos around the hanging lanterns -->
          <circle cx="224" cy="285" r="24" fill="#facc15" fill-opacity="0.28" />
          <circle cx="992" cy="146" r="24" fill="#facc15" fill-opacity="0.28" />
          <circle cx="1142" cy="222" r="24" fill="#facc15" fill-opacity="0.28" />
        </g>`
            : ''
        }

        <!-- 4. Potted Plant (art-potted_plant) - Lush Indoor Plants -->
        ${
          floor === 'potted_plant' && owns(floor)
            ? svg`<g data-testid="art-potted_plant" class="sushi-art-potted_plant">
          <!-- Terracotta pot rim highlight at front-left plant (146, 480) -->
          <ellipse cx="146" cy="480" rx="16" ry="9" fill="none" stroke="#d99170" stroke-width="2" />
          <circle cx="146" cy="432" r="18" fill="#22c55e" fill-opacity="0.18" />
        </g>`
            : ''
        }

        <!-- 5. Andon Lantern (art-andon_lantern) - Right Entrance Floor Andon (1442, 560) -->
        ${
          floor === 'andon_lantern' && owns(floor)
            ? svg`<g data-testid="art-andon_lantern" class="sushi-art-andon_lantern">
          <!-- Warm golden floor lantern aura at (1442, 560) -->
          <circle cx="1442" cy="560" r="28" fill="#fef08a" fill-opacity="0.32" />
          <rect x="1429" y="534" width="26" height="48" fill="none" stroke="#d4af37" stroke-width="2" />
        </g>`
            : ''
        }

        <!-- 6. Sakura Bonsai (art-sakura_bonsai / art-bonsai_tree) -->
        ${
          floor === 'sakura_bonsai' && owns(floor)
            ? svg`<g data-testid="art-sakura_bonsai" class="sushi-art-sakura_bonsai">
          <g data-testid="art-bonsai_tree">
            <!-- Blooming pink sakura petals around the counter bonsai (900, 405) & (1004, 618) -->
            <circle cx="894" cy="396" r="8" fill="#fbb6ce" fill-opacity="0.65" />
            <circle cx="908" cy="402" r="7" fill="#fed7e2" fill-opacity="0.65" />
            <circle cx="1002" cy="608" r="9" fill="#f687b3" fill-opacity="0.55" />
          </g>
        </g>`
            : ''
        }

        <!-- 7. Golden Maneki-Neko (art-golden_maneki_neko) - Entrance Lucky Cat (212, 392) -->
        ${
          floor === 'golden_maneki_neko' && owns(floor)
            ? svg`<g data-testid="art-golden_maneki_neko" class="sushi-art-golden_maneki_neko">
          <!-- Golden aura and koban coin on the Maneki-neko at (212, 392) -->
          <circle cx="212" cy="392" r="20" fill="#facc15" fill-opacity="0.3" />
          <ellipse cx="212" cy="398" rx="5" ry="7" fill="#fef08a" stroke="#ca8a04" stroke-width="1.2" />
        </g>`
            : ''
        }
      </g>
    </svg>
    <figcaption class="sr-only">
      <span>Din lilla sushibar</span
      ><span
        >${prep ? 'Utökat kök' : 'Grundkök'} ·
        ${conveyor ? 'Transportband' : 'Serveringsdisk'}</span
      >
    </figcaption>
  </figure>`;
}
