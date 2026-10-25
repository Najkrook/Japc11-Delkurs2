import { html, svg } from 'lit-html';
import type { SushiRestaurantState } from './types.ts';

type Point = readonly [x: number, y: number, z: number];
const ISO_X = Math.sqrt(3) / 2;

// One shared 30° projection keeps the room, furniture and upgrade layers aligned.
function project([x, y, z]: Point) {
  return [438 + (x - y) * ISO_X, 240 + (x + y) / 2 - z];
}

function face(points: Point[], fill: string) {
  return svg`<polygon points=${points.map((point) => project(point).join(',')).join(' ')} fill=${fill} />`;
}

function line(from: Point, to: Point, color = '#b98760', width = 2) {
  const [x1, y1] = project(from);
  const [x2, y2] = project(to);
  return svg`<line x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke=${color} stroke-width=${width} />`;
}

function box(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  top: string,
  front: string,
  side: string,
) {
  return svg`
    ${face(
      [
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      front,
    )}
    ${face(
      [
        [x + w, y, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x + w, y, z + h],
      ],
      side,
    )}
    ${face(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      top,
    )}`;
}

function tabletop(x: number, y: number, z: number) {
  const [px, py] = project([x, y, z]);
  return `matrix(${ISO_X} 0.5 ${-ISO_X} 0.5 ${px} ${py})`;
}

function stool(x: number, y: number) {
  return svg`<g>
    <g transform=${tabletop(x, y, 0)} stroke="none"><ellipse cx="4" cy="5" rx="27" ry="24" fill="#b48763" opacity="0.25" /></g>
    ${[-12, 12].flatMap((dx) => [-12, 12].map((dy) => line([x + dx, y + dy, 4], [x + dx * 0.8, y + dy * 0.8, 43], '#936346', 5)))}
    ${line([x - 11, y + 11, 19], [x + 11, y + 11, 19], '#936346', 3)}
    <g transform=${tabletop(x, y, 44)}><circle cy="4" r="24" fill="#936346"/><circle r="24" fill="#e4b77e"/><circle r="18" fill="none" stroke="#c99462" stroke-width="1.5"/></g>
  </g>`;
}

function sushiPlate(x: number, y: number, salmon = false) {
  return svg`<g transform=${`translate(${x} ${y})`}>
    <ellipse rx="24" ry="16" fill="#f8ebcc" stroke="#bca17e" stroke-width="2"/>
    <ellipse rx="18" ry="11" fill="none" stroke="#d7c6a6" stroke-width="1.5"/>
    <rect x="-14" y="-10" width="28" height="17" rx="7" fill="#fff9e9" stroke-width="1.5"/>
    <rect x="-16" y="-14" width="32" height="14" rx="6" fill=${salmon ? '#e8896d' : '#315f50'} stroke-width="1.5"/>
    ${salmon ? svg`<path d="m-8-12 4 10m6-10 4 10" stroke="#ffe2b9" stroke-width="2"/>` : svg`<path d="M-5-12h10v10H-5z" fill="#e4b77e" stroke="none"/>`}
  </g>`;
}

/** Original vector artwork, viewed from above the open front corner. */
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
      viewBox="0 0 960 710"
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
      <g stroke="#583e32" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
        <path fill="#fff4da" d="M0 0h960v710H0z" stroke="none" />
        <ellipse cx="480" cy="568" rx="293" ry="100" fill="#583e32" opacity="0.07" stroke="none" />
        <!-- Layer 1: Floor slab and the two rear walls leave the near corner open. -->
        ${box(0, 0, -16, 460, 370, 16, '#e3bd8b', '#b57550', '#936346')}
        <g stroke="#c99e70" stroke-width="1.5">
          ${Array.from({ length: 9 }, (_, i) => line([0, (i + 1) * 37, 0], [460, (i + 1) * 37, 0], '#c99e70', 1.5))}
          ${Array.from({ length: 10 }, (_, row) =>
            [0, 1, 2].map((col) => {
              const x = 70 + col * 150 + (row % 2) * 60;
              return line([x, row * 37, 0], [x, (row + 1) * 37, 0], '#c99e70', 1.5);
            }),
          )}
        </g>
        ${face(
          [
            [0, 0, 0],
            [0, 370, 0],
            [0, 370, 200],
            [0, 0, 200],
          ],
          '#f4e5c7',
        )}
        ${face(
          [
            [0, 0, 0],
            [460, 0, 0],
            [460, 0, 200],
            [0, 0, 200],
          ],
          '#e8d5b3',
        )}
        ${line([0, 0, 200], [0, 370, 200], '#936346', 9)}
        ${line([0, 0, 200], [460, 0, 200], '#936346', 9)}
        ${line([0, 0, 0], [0, 0, 200], '#936346', 7)}
        ${line([0, 370, 0], [0, 370, 200], '#936346', 7)}
        ${line([460, 0, 0], [460, 0, 200], '#936346', 7)}
        ${line([0, 0, 12], [0, 370, 12], '#b57550', 8)}
        ${line([0, 0, 12], [460, 0, 12], '#b57550', 8)}

        <!-- Window and noren follow the left wall's plane. -->
        <g transform=${`matrix(${ISO_X} -0.5 0 1 ${project([0, 370, 200]).join(' ')})`}>
          <path fill="#a46e48" d="M105 37h185v113H105z" />
          <path fill="#83b6af" d="M112 44h171v99H112z" />
          <path fill="#d6e6d7" d="M112 115q38-49 78-22t93-10v60H112z" stroke="none" />
          <path d="M196 44v99m-84-49h171" stroke="#fff4da" stroke-width="5" />
          <path fill="#23655f" d="M98 25h199v36q-22 15-44 0-26 15-55 0-29 15-55 0-23 15-45 0z" />
          <path d="M143 27v33m55-33v33m55-33v33" stroke="#a6cbc1" stroke-width="1.5" />
          <circle cx="198" cy="42" r="9" fill="#fff4da" stroke="none" />
          <path d="M193 42h10m-5-5v10" stroke="#23655f" stroke-width="1.5" />
        </g>

        <!-- Right wall base shelf. -->
        <g transform=${`matrix(${ISO_X} 0.5 0 1 ${project([0, 0, 200]).join(' ')})`}>
          <path fill="#a46e48" d="M36 89h137v9H36z" />
          <path fill="#ede4cb" d="M49 63h23v25H49zM83 58h24v30H83z" />
          <path d="M52 70h17m18-4h17" stroke="#d48868" />
          <path fill="#23655f" d="M130 71q14-13 26 0l-3 17h-20z" />
        </g>

        <!-- Layer 2: Base kitchen, island counter, and customer stools. -->
        ${box(25, 18, 0, 395, 58, 73, '#c69260', '#b57550', '#936346')}
        ${[125, 225, 325].map((x) => line([x, 76, 7], [x, 76, 68], '#936346'))}
        ${[63, 163, 263, 363].map((x) => line([x, 77, 55], [x + 20, 77, 55], '#583e32', 3))}
        ${box(19, 12, 73, 407, 70, 8, '#f0c88f', '#d6a16b', '#b98760')}
        <g transform=${tabletop(42, 28, 82)}>
          <rect width="83" height="35" rx="8" fill="#77938b" />
          <rect x="6" y="5" width="71" height="25" rx="6" fill="#c8d8cd" />
          <circle cx="42" cy="18" r="4" fill="#77938b" stroke="none" />
        </g>
        ${line([78, 25, 82], [78, 25, 105], '#77938b', 4)}
        ${line([78, 25, 105], [78, 41, 105], '#77938b', 4)}
        ${box(155, 30, 81, 74, 32, 6, '#e7bd80', '#c99462', '#b98760')}
        <g transform=${tabletop(161, 35, 88)}>
          <path fill="#e8896d" d="M7 3h37q10 9 0 18H7z" />
          <path d="m17 4 6 16m6-16 6 16" stroke="#ffe2b9" stroke-width="2" />
          <path d="M52 3v21" stroke="#583e32" stroke-width="4" />
        </g>
        ${box(329, 27, 81, 53, 36, 23, '#f8efdb', '#e4d9bc', '#c9bda2')}
        <g transform=${tabletop(355, 45, 105)}>
          <ellipse rx="21" ry="12" fill="#23655f" />
          <path d="M-6 0H6" stroke="#fff4da" stroke-width="3" />
        </g>

        <!-- Low island and customer stools. -->
        ${box(100, 190, 0, 298, 68, 83, '#e4b77e', '#b57550', '#936346')}
        ${[123, 160, 197, 234, 271, 308, 345, 382].map((x) => line([x, 259, 9], [x, 259, 75], '#c99462', 3))}
        ${box(90, 180, 83, 318, 88, 9, '#f0c88f', '#d6a16b', '#b98760')}
        ${[145, 250, 355].map((x) => stool(x, 314))}

        <!-- Layer 3: Equipment upgrades, conveyor belt, and recipe plates. -->
        ${
          prep
            ? svg`<g data-testid="art-prep-counter">
          ${box(19, 105, 0, 60, 113, 73, '#96b1a3', '#77938b', '#56786e')}
          ${box(14, 100, 73, 70, 123, 7, '#dbe2d6', '#b9c7ba', '#96b1a3')}
          ${[24, 49].map((z) => line([80, 116, z], [80, 205, z], '#b9c7ba'))}
          ${box(25, 133, 80, 44, 58, 4, '#e7bd80', '#c99462', '#b98760')}
          <g transform=${tabletop(31, 146, 85)}><path fill="#d8dfd5" d="M5 0h9v30H5z"/><path d="M9 30v12" stroke-width="5"/><circle cx="26" cy="18" r="8" fill="#e8896d"/></g>
        </g>`
            : ''
        }
        ${
          owns('precision_knife')
            ? svg`<g data-testid="art-precision_knife" transform=${tabletop(198, 34, 88)}>
          <rect x="0" y="0" width="12" height="24" rx="2" fill="#754b37"/>
          <path fill="#e2e8f0" d="M4 2h5l1 18-6 3z"/>
        </g>`
            : ''
        }
        ${
          owns('service_counter')
            ? svg`<g data-testid="art-service_counter" transform=${tabletop(90, 180, 93)}>
          <rect x="4" y="4" width="310" height="80" rx="8" fill="none" stroke="#d4af37" stroke-width="4"/>
        </g>`
            : ''
        }
        ${
          owns('sous_chef')
            ? svg`<g data-testid="art-sous_chef" transform=${`translate(${project([272, 54, 82]).join(' ')})`}>
          <path fill="#23655f" d="M-16 0h32l5 24h-42z"/>
          <circle cy="-12" r="12" fill="#fde6c4"/>
          <path fill="#ffffff" d="M-13-20q0-12 13-12t13 12v5h-26z"/>
          <path fill="#356e64" d="M-13-17h26v3h-26z"/>
        </g>`
            : ''
        }
        ${
          owns('master_license')
            ? svg`<g data-testid="art-master_license" transform=${`matrix(${ISO_X} 0.5 0 1 ${project([0, 0, 200]).join(' ')})`}>
          <rect x="195" y="42" width="44" height="52" rx="2" fill="#fff4da" stroke="#754b37" stroke-width="3"/>
          <path d="M217 52v28M207 60h20M209 70h16" stroke="#583e32" stroke-width="2"/>
          <rect x="224" y="76" width="8" height="8" fill="#c53030" stroke="none"/>
        </g>`
            : ''
        }
        <g transform=${tabletop(90, 180, 93)}>
          ${
            conveyor
              ? svg`<g data-testid="art-conveyor-belt">
            <rect x="7" y="8" width="304" height="72" rx="36" fill="#456d65"/>
            <rect x="14" y="15" width="290" height="58" rx="29" fill="#a7c5af"/>
            <rect class="sushi-belt-tread" x="25" y="24" width="268" height="40" rx="20" fill="none" stroke="#668e7b" stroke-width="12" stroke-dasharray="3 30"/>
            <rect x="49" y="33" width="220" height="22" rx="11" fill="#456d65" stroke="none"/>
            ${sushiPlate(46, 43)}${sushiPlate(151, 24)}${sushiPlate(270, 46)}
          </g>`
              : svg`
            <rect x="20" y="22" width="80" height="44" rx="4" fill="#23655f"/>
            ${sushiPlate(60, 44)}
            <path d="M224 24h58m-58 7h58" stroke="#936346" stroke-width="3"/>
            <circle cx="279" cy="55" r="12" fill="#77938b"/><circle cx="279" cy="55" r="7" fill="#315f50" stroke="none"/>`
          }
          ${owns('salmon_nigiri') ? svg`<g data-testid="art-salmon_nigiri">${sushiPlate(158, conveyor ? 66 : 48, true)}</g>` : ''}
          ${
            owns('kappamaki')
              ? svg`<g data-testid="art-kappamaki"><g data-testid="art-kappa_maki" transform="translate(105 64)">
            <rect x="-18" y="-10" width="36" height="20" rx="4" fill="#356e64"/>
            <circle cx="-8" cy="0" r="6" fill="#fff4da"/><rect x="-10" y="-2" width="4" height="4" fill="#68d391"/>
            <circle cx="8" cy="0" r="6" fill="#fff4da"/><rect x="6" y="-2" width="4" height="4" fill="#68d391"/>
          </g></g>`
              : ''
          }
          ${
            owns('maguro_nigiri')
              ? svg`<g data-testid="art-maguro_nigiri" transform="translate(212 64)">
            <ellipse rx="20" ry="13" fill="#f8ebcc"/>
            <rect x="-12" y="-8" width="24" height="12" rx="5" fill="#c53030"/>
          </g>`
              : ''
          }
          ${
            owns('ebi_nigiri')
              ? svg`<g data-testid="art-ebi_nigiri" transform="translate(98 24)">
            <ellipse rx="20" ry="13" fill="#f8ebcc"/>
            <rect x="-12" y="-8" width="24" height="12" rx="5" fill="#f56565"/>
          </g>`
              : ''
          }
          ${
            owns('tamago_nigiri')
              ? svg`<g data-testid="art-tamago_nigiri" transform="translate(205 24)">
            <ellipse rx="20" ry="13" fill="#f8ebcc"/>
            <rect x="-12" y="-8" width="24" height="12" rx="4" fill="#f6e05e"/>
            <rect x="-3" y="-8" width="6" height="12" fill="#233d34"/>
          </g>`
              : ''
          }
          ${
            owns('sashimi_plate')
              ? svg`<g data-testid="art-sashimi_plate" transform="translate(254 22)">
            <rect x="-18" y="-11" width="36" height="22" rx="4" fill="#2d3748"/>
            <path fill="#e8896d" d="M-10-5h12l-3 10h-12z"/>
            <path fill="#c53030" d="M2-5h12l-3 10H-1z"/>
          </g>`
              : ''
          }
          ${
            owns('omakase_menu')
              ? svg`<g data-testid="art-omakase_menu" transform="translate(32 68)">
            <rect x="-18" y="-10" width="36" height="20" rx="3" fill="#7b1113" stroke="#ecc94b" stroke-width="2"/>
            <circle cx="-6" cy="0" r="5" fill="#ed8936"/>
            <rect x="3" y="-5" width="10" height="10" rx="2" fill="#f6e05e"/>
          </g>`
              : ''
          }
        </g>

        <!-- Layer 4: Wall and floor decorations. -->
        <g transform=${`matrix(${ISO_X} 0.5 0 1 ${project([0, 0, 200]).join(' ')})`}>
          ${
            wall === 'wave_print' && owns(wall)
              ? svg`<g data-testid="art-wave_print">
            <path fill="#b6774c" d="M270 34h125v91H270z"/>
            <path fill="#f8ebcc" d="M277 41h111v77H277z"/>
            <circle cx="360" cy="62" r="11" fill="#db8668" stroke="none"/>
            <path fill="#55988f" d="M280 105q32-74 58-23-19-18-24 11 43-27 71 4v18H280z" stroke="none"/>
            <path d="M284 109q20-30 41-8t53 1" fill="none" stroke="#fff4da" stroke-width="2.5"/>
          </g>`
              : ''
          }
          ${
            wall === 'noren_curtain' && owns(wall)
              ? svg`<g data-testid="art-noren_curtain">
            <path d="M258 30h144" stroke="#d69e2e" stroke-width="4"/>
            <path fill="#1a365d" d="M264 33h42v72q-21 7-42 0zM310 33h42v72q-21 7-42 0zM356 33h42v72q-21 7-42 0z"/>
            <circle cx="285" cy="68" r="10" fill="none" stroke="#fff4da" stroke-width="2"/>
            <circle cx="331" cy="68" r="10" fill="none" stroke="#fff4da" stroke-width="2"/>
            <circle cx="377" cy="68" r="10" fill="none" stroke="#fff4da" stroke-width="2"/>
          </g>`
              : ''
          }
        </g>
        ${
          wall === 'paper_lantern' && owns(wall)
            ? svg`<g data-testid="art-paper_lantern" transform=${`translate(${project([336, 12, 193]).join(' ')})`}>
          <path d="M0 0v22"/><rect x="-23" y="22" width="46" height="64" rx="20" fill="#e9a077"/>
          <path d="M-19 36h38m-41 13h44m-42 13h40m-35 13h30" stroke="#b9634e" stroke-width="1.5"/>
          <path d="M-10 22h20m-20 64h20" stroke-width="4"/>
        </g>`
            : ''
        }
        ${
          floor === 'potted_plant' && owns(floor)
            ? svg`<g data-testid="art-potted_plant" transform=${`translate(${project([428, 194, 0]).join(' ')})`}>
          <ellipse cy="-2" rx="27" ry="13" fill="#583e32" opacity="0.12" stroke="none"/>
          <path fill="#d99170" d="M-23-41h46L17-5q-17 10-34 0z"/>
          <ellipse cy="-41" rx="25" ry="12" fill="#ebaf87"/><ellipse cy="-41" rx="18" ry="7" fill="#79533b"/>
          <path d="M0-42v-74m0 50-22-27m22 12 23-28" stroke="#416956" stroke-width="3"/>
          <g fill="#65906c" stroke="#416956" stroke-width="2"><path d="M-19-87q-36-3-31-25 30-4 31 25z"/><path d="M18-96q5-31 34-29 1 26-34 29z"/><path d="M0-108q-20-28 1-47 21 25-1 47z"/></g>
        </g>`
            : ''
        }
        ${
          floor === 'andon_lantern' && owns(floor)
            ? svg`<g data-testid="art-andon_lantern" transform=${`translate(${project([428, 194, 0]).join(' ')})`}>
          <ellipse cy="-2" rx="26" ry="12" fill="#583e32" opacity="0.12" stroke="none"/>
          <rect x="-20" y="-88" width="40" height="72" rx="3" fill="#fefcbf" stroke="#583e32" stroke-width="3"/>
          <path d="M-20-64h40M-20-40h40M0-88v72M-16-16v14M16-16v14" stroke="#583e32" stroke-width="2.5"/>
          <circle cy="-52" r="9" fill="#f6e05e" opacity="0.6" stroke="none"/>
        </g>`
            : ''
        }
        ${
          floor === 'sakura_bonsai' && owns(floor)
            ? svg`<g data-testid="art-sakura_bonsai" transform=${`translate(${project([428, 194, 0]).join(' ')})`}>
          <ellipse cy="-2" rx="28" ry="13" fill="#583e32" opacity="0.12" stroke="none"/>
          <ellipse cy="-12" rx="26" ry="10" fill="#2c5282"/>
          <ellipse cy="-16" rx="21" ry="6" fill="#2f855a"/>
          <path d="M0-16q-10-24 4-42t-5-32" stroke="#5a3a28" stroke-width="6" fill="none"/>
          <circle cx="-2" cy="-92" r="14" fill="#fed7e2"/>
          <circle cx="-16" cy="-82" r="11" fill="#fbb6ce"/>
          <circle cx="14" cy="-86" r="12" fill="#f687b3"/>
        </g>`
            : ''
        }
        ${
          floor === 'golden_maneki_neko' && owns(floor)
            ? svg`<g data-testid="art-golden_maneki_neko" transform=${`translate(${project([428, 194, 0]).join(' ')})`}>
          <ellipse cy="-2" rx="28" ry="13" fill="#583e32" opacity="0.12" stroke="none"/>
          <path fill="#9b2c2c" d="M-26-16h52l-4 14h-44z"/>
          <ellipse cy="-38" rx="20" ry="22" fill="#ecc94b"/>
          <circle cy="-68" r="15" fill="#ecc94b"/>
          <polygon points="-13,-76 -8,-92 -2,-78" fill="#ecc94b"/>
          <polygon points="2,-78 8,-92 13,-76" fill="#ecc94b"/>
          <rect x="-11" y="-56" width="22" height="5" rx="2.5" fill="#e53e3e"/>
        </g>`
            : ''
        }
      </g>
    </svg>
    <figcaption>
      <span>Din lilla sushibar</span
      ><span
        >${prep ? 'Utökat kök' : 'Grundkök'} ·
        ${conveyor ? 'Transportband' : 'Serveringsdisk'}</span
      >
    </figcaption>
  </figure>`;
}
