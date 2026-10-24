import { html, svg } from 'lit-html';
import type { SushiRestaurantState } from './types.ts';

/** Original project artwork. All layers share a fixed front-facing coordinate system. */
export function renderRestaurantScene(state: SushiRestaurantState) {
  const owns = (id: string) => state.inventory.includes(id);
  const wall = state.equipped.wallSlot;
  const plant = state.equipped.floorSlot === 'potted_plant' && owns('potted_plant');
  const prep = owns('prep_counter');
  const conveyor = owns('conveyor_belt');
  return html`<figure
    class="sushi-illustration"
    data-testid="restaurant-scene"
    data-paused=${typeof document !== 'undefined' && document.hidden}
  >
    <svg
      viewBox="0 0 960 520"
      role="img"
      aria-labelledby="restaurant-art-title restaurant-art-desc"
    >
      <title id="restaurant-art-title">Din sushirestaurang</title>
      <desc id="restaurant-art-desc">
        Illustrerat tvärsnitt framifrån. ${prep ? 'Förbättrad beredningsbänk' : 'Grundkök'}.
        ${conveyor ? 'Transportband installerat' : 'Serveringsdisk utan transportband'}.
        ${wall === 'paper_lantern' && owns(wall) ? 'Papperslykta på väggen.' : ''}
        ${wall === 'wave_print' && owns(wall) ? 'Vågmotiv på väggen.' : ''}
        ${plant ? 'Krukväxt på golvet.' : ''}
      </desc>
      <g stroke="#583e32" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
        <path fill="#ead3ac" d="M0 0h960v520H0z" stroke="none" />
        <path fill="#fff4da" d="M28 25h904v386H28z" />
        <path fill="#b57550" d="M0 411h960v109H0z" />
        <path d="M0 450h960M0 492h960M180 411v39m220 0v42m220-81v39m180 0v42" stroke="#966344" />
        <path fill="#754b37" d="M20 15h920v25H20zM20 40h22v371H20zm898 0h22v371h-22z" />
        <path fill="#83b6af" d="M352 73h256v135H352z" />
        <path fill="#d6e6d7" d="M358 143q60-70 118-14t126-13v86H358z" stroke="none" />
        <path d="M480 75v130M354 140h251" stroke="#fff4da" stroke-width="8" />
        <path fill="#23655f" d="M318 43h324v46q-35 27-70 0-45 27-92 0-45 27-92 0-35 27-70 0z" />
        <path d="M388 44v44m92-44v44m92-44v44" stroke="#a6cbc1" stroke-width="2" />
        <circle cx="480" cy="65" r="12" fill="#fff4da" stroke="none" />
        <path d="M474 65h12m-6-6v12" stroke="#23655f" stroke-width="2" />
        <path fill="#a46e48" d="M78 196h210v12H78z" />
        <g fill="#ede4cb">
          <path d="M93 160h35v34H93zM142 153h35v41h-35z" />
          <path fill="#23655f" d="M208 165q23-23 43 0l-5 29h-33z" />
        </g>
        <path d="M97 172h26m24-8h25" stroke="#d48868" />
        <path fill="#936346" d="M80 285h800v128H80z" />
        <path fill="#f0c88f" d="M68 270h824v23H68z" />
        <path d="M100 311h760M345 297v105m270-105v105" stroke="#c89160" />
        <path fill="#e4d9bc" d="M100 231h150v38H100z" />
        <path fill="#356e64" d="M118 222h115v13H118z" />
        <path fill="#f8efdb" d="M360 251q0-17 24-17h46q24 0 24 17v13h-94z" />
        <path fill="#c88563" d="M356 238q48-23 101 0l-4 12h-92z" />
        <path fill="#d8c8a7" d="M681 249h130l-16 14h-98z" />
        <g fill="#fff4da"><path d="M706 236h24v12h-24zM755 236h24v12h-24z" /></g>
        <g fill="#345c4c"><path d="M713 235h10v13h-10zM762 235h10v13h-10z" /></g>
        ${prep ? svg`<g data-testid="art-prep-counter"><path fill="#77938b" d="M94 300h216v103H94z"/><path fill="#dbe2d6" d="M87 283h230v20H87z"/><path d="M202 313v78m-87-49h65m-65 33h65"/><path fill="#e7bd80" d="M106 265h124v17H106z"/><path fill="#d8dfd5" d="m152 255 59-17 4 14-58 13z"/><path d="m152 255-25 8" stroke-width="9"/></g>` : ''}
        <g fill="#e4b77e">
          <path d="M266 429v62m36-62v62m356-62v62m36-62v62" />
          <rect x="246" y="412" width="76" height="20" rx="10" />
          <rect x="638" y="412" width="76" height="20" rx="10" />
        </g>
        ${
          conveyor
            ? svg`<g data-testid="art-conveyor-belt"><rect x="73" y="329" width="814" height="58" rx="29" fill="#456d65"/><rect x="87" y="339" width="786" height="35" rx="18" fill="#a7c5af"/><path class="sushi-belt-tread" d="M110 356h738" stroke="#668e7b" stroke-width="22" stroke-dasharray="3 30"/>
          <g fill="#f8ebcc"><ellipse cx="245" cy="350" rx="42" ry="10"/><ellipse cx="480" cy="350" rx="42" ry="10"/><ellipse cx="715" cy="350" rx="42" ry="10"/></g>
          <g fill="#e49a7b"><path d="M222 342q23-24 46 0zM457 342q23-24 46 0zM692 342q23-24 46 0z"/></g></g>`
            : ''
        }
        ${owns('salmon_nigiri') ? svg`<g data-testid="art-salmon_nigiri"><path fill="#23655f" d="M526 262h90l-10 8h-70z"/><path fill="#fff4da" d="M539 250q28-17 53 0v10h-53z"/><path fill="#e8896d" d="M533 245q30-20 65 0l-5 10h-55z"/><path d="m552 240 6 9m12-12 6 10" stroke="#ffe2b9" stroke-width="3"/></g>` : ''}
        ${wall === 'paper_lantern' && owns(wall) ? svg`<g data-testid="art-paper_lantern"><path d="M768 40v43"/><rect x="735" y="83" width="66" height="91" rx="28" fill="#e9a077"/><path d="M741 103h54m-58 18h62m-59 18h56m-49 18h42" stroke="#b9634e" stroke-width="2"/><path d="M754 82h28m-28 92h28" stroke-width="7"/></g>` : ''}
        ${wall === 'wave_print' && owns(wall) ? svg`<g data-testid="art-wave_print"><path fill="#b6774c" d="M692 88h151v107H692z"/><path fill="#f8ebcc" d="M701 97h133v89H701z"/><circle cx="794" cy="120" r="13" fill="#db8668" stroke="none"/><path fill="#55988f" d="M703 172q40-92 69-25-22-22-28 13 50-32 88 4v20H703z" stroke="none"/><path d="M710 174q23-35 47-9t64 2" stroke="#fff4da" stroke-width="3"/></g>` : ''}
        ${plant ? svg`<g data-testid="art-potted_plant"><path d="M853 440v-97m0 59-32-30m32 11 29-28" stroke="#416956"/><g fill="#65906c"><ellipse cx="819" cy="366" rx="24" ry="12" transform="rotate(32 819 366)"/><ellipse cx="878" cy="351" rx="23" ry="12" transform="rotate(-30 878 351)"/><ellipse cx="850" cy="333" rx="12" ry="26"/></g><path fill="#d99170" d="M821 418h64l-10 52h-44z"/><path fill="#ebaf87" d="M817 416h72v13h-72z"/></g>` : ''}
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
