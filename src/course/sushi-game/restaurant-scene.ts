import { html, svg } from 'lit-html';
import type { SushiRestaurantState } from './types.ts';

/** Original project artwork. All layers share a fixed front-facing coordinate system. */
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
      viewBox="0 0 960 520"
      role="img"
      aria-labelledby="restaurant-art-title restaurant-art-desc"
    >
      <title id="restaurant-art-title">Din sushirestaurang</title>
      <desc id="restaurant-art-desc">
        Illustrerat tvärsnitt framifrån. ${prep ? 'Förbättrad beredningsbänk' : 'Grundkök'}.
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
        <g fill="#e4b77e">
          <path d="M266 429v62m36-62v62m356-62v62m36-62v62" />
          <rect x="246" y="412" width="76" height="20" rx="10" />
          <rect x="638" y="412" width="76" height="20" rx="10" />
        </g>
        ${prep ? svg`<g data-testid="art-prep-counter"><path fill="#77938b" d="M94 300h216v103H94z"/><path fill="#dbe2d6" d="M87 283h230v20H87z"/><path d="M202 313v78m-87-49h65m-65 33h65"/><path fill="#e7bd80" d="M106 265h124v17H106z"/><path fill="#d8dfd5" d="m152 255 59-17 4 14-58 13z"/><path d="m152 255-25 8" stroke-width="9"/></g>` : ''}
        ${owns('precision_knife') ? svg`<g data-testid="art-precision_knife"><path fill="#754b37" d="M214 260h48v6h-48z"/><path fill="#356e64" d="M212 254h14v5h-14z"/><path fill="#c88563" d="M226 254h4v5h-4z"/><path fill="#e2e8f0" d="M230 254h32l8 5h-40z"/><path d="M230 256h30" stroke="#ffffff" stroke-width="1.5"/></g>` : ''}
        ${owns('service_counter') ? svg`<g data-testid="art-service_counter"><path fill="#f6d588" d="M330 268h320v6H330z"/><path fill="#d4af37" d="M328 274h324v3H328z"/><circle cx="335" cy="271" r="2" fill="#754b37"/><circle cx="645" cy="271" r="2" fill="#754b37"/></g>` : ''}
        ${owns('sous_chef') ? svg`<g data-testid="art-sous_chef"><path fill="#ffffff" d="M72 205q0-16 16-16t16 16v18H72z"/><path fill="#e2e8f0" d="M70 223h36v10H70z"/><path fill="#356e64" d="M76 226h24v4H76z"/><circle cx="88" cy="215" r="3" fill="#e8896d"/><path fill="#23655f" d="M68 233h40l8 32H60z"/></g>` : ''}
        ${owns('master_license') ? svg`<g data-testid="art-master_license"><rect x="282" y="98" width="46" height="48" rx="2" fill="#fff4da" stroke="#754b37" stroke-width="4"/><path fill="#ede4cb" d="M288 104h34v36h-34z"/><path d="M305 109v26M295 115h20M297 125h16" stroke="#583e32" stroke-width="2"/><rect x="312" y="128" width="8" height="8" fill="#c53030" stroke="none"/><path d="M298 98v-12m14 12v-12" stroke="#754b37" stroke-width="2"/></g>` : ''}
        ${
          conveyor
            ? svg`<g data-testid="art-conveyor-belt"><rect x="73" y="329" width="814" height="58" rx="29" fill="#456d65"/><rect x="87" y="339" width="786" height="35" rx="18" fill="#a7c5af"/><path class="sushi-belt-tread" d="M110 356h738" stroke="#668e7b" stroke-width="22" stroke-dasharray="3 30"/>
          <g fill="#f8ebcc"><ellipse cx="245" cy="350" rx="42" ry="10"/><ellipse cx="480" cy="350" rx="42" ry="10"/><ellipse cx="715" cy="350" rx="42" ry="10"/></g>
          <g fill="#e49a7b"><path d="M222 342q23-24 46 0zM457 342q23-24 46 0zM692 342q23-24 46 0z"/></g></g>`
            : ''
        }
        ${owns('salmon_nigiri') ? svg`<g data-testid="art-salmon_nigiri"><path fill="#23655f" d="M526 262h90l-10 8h-70z"/><path fill="#fff4da" d="M539 250q28-17 53 0v10h-53z"/><path fill="#e8896d" d="M533 245q30-20 65 0l-5 10h-55z"/><path d="m552 240 6 9m12-12 6 10" stroke="#ffe2b9" stroke-width="3"/></g>` : ''}
        ${owns('kappamaki') ? svg`<g data-testid="art-kappamaki"><g data-testid="art-kappa_maki"><path fill="#356e64" d="M452 262h68l-8 8h-52z"/><circle cx="468" cy="256" r="9" fill="#233d34"/><circle cx="468" cy="256" r="7" fill="#fff4da"/><rect x="465" y="253" width="6" height="6" fill="#68d391" rx="1"/><circle cx="488" cy="256" r="9" fill="#233d34"/><circle cx="488" cy="256" r="7" fill="#fff4da"/><rect x="485" y="253" width="6" height="6" fill="#68d391" rx="1"/><circle cx="508" cy="256" r="9" fill="#233d34"/><circle cx="508" cy="256" r="7" fill="#fff4da"/><rect x="505" y="253" width="6" height="6" fill="#68d391" rx="1"/></g></g>` : ''}
        ${owns('maguro_nigiri') ? svg`<g data-testid="art-maguro_nigiri"><path fill="#a0c4bc" d="M622 262h66l-8 8h-50z"/><path fill="#fff4da" d="M632 252q20-14 44 0v8h-44z"/><path fill="#c53030" d="M628 246q24-18 52 0l-4 9h-44z"/><path d="m644 243 6 8m10-10 6 8" stroke="#feb2b2" stroke-width="2.5"/></g>` : ''}
        ${owns('ebi_nigiri') ? svg`<g data-testid="art-ebi_nigiri"><path fill="#d4dfd5" d="M366 262h66l-8 8h-50z"/><path fill="#fff4da" d="M376 252q20-14 44 0v8h-44z"/><path fill="#f56565" d="M372 246q24-18 52 0l-4 9h-44z"/><path d="M378 248q12-8 24 0m2-7q10-7 20 0" stroke="#ffffff" stroke-width="3"/><path fill="#e53e3e" d="M420 248l12-8-4 12z"/></g>` : ''}
        ${owns('tamago_nigiri') ? svg`<g data-testid="art-tamago_nigiri"><path fill="#4a5568" d="M280 262h66l-8 8h-50z"/><path fill="#fff4da" d="M290 252q20-14 44 0v8h-44z"/><rect x="286" y="244" width="52" height="13" rx="3" fill="#f6e05e"/><rect x="308" y="244" width="10" height="15" fill="#233d34"/></g>` : ''}
        ${owns('sashimi_plate') ? svg`<g data-testid="art-sashimi_plate"><path fill="#2d3748" d="M690 260h74l-8 10h-58z"/><path fill="#48bb78" d="M696 252q14-16 28 0z"/><path fill="#e8896d" d="M710 248l24-10v8l-24 10z"/><path fill="#c53030" d="M720 246l24-10v8l-24 10z"/><circle cx="754" cy="254" r="5" fill="#68d391"/></g>` : ''}
        ${owns('omakase_menu') ? svg`<g data-testid="art-omakase_menu"><rect x="768" y="248" width="76" height="22" rx="3" fill="#7b1113" stroke="#ecc94b" stroke-width="2"/><rect x="774" y="252" width="18" height="14" fill="#233d34"/><circle cx="783" cy="257" r="4" fill="#ed8936"/><path fill="#fff4da" d="M798 256h14v8h-14z"/><path fill="#c53030" d="M796 253h18v4h-18z"/><path fill="#fff4da" d="M818 256h14v8h-14z"/><path fill="#f6e05e" d="M816 253h18v4h-18z"/></g>` : ''}
        ${wall === 'paper_lantern' && owns(wall) ? svg`<g data-testid="art-paper_lantern"><path d="M768 40v43"/><rect x="735" y="83" width="66" height="91" rx="28" fill="#e9a077"/><path d="M741 103h54m-58 18h62m-59 18h56m-49 18h42" stroke="#b9634e" stroke-width="2"/><path d="M754 82h28m-28 92h28" stroke-width="7"/></g>` : ''}
        ${wall === 'wave_print' && owns(wall) ? svg`<g data-testid="art-wave_print"><path fill="#b6774c" d="M692 88h151v107H692z"/><path fill="#f8ebcc" d="M701 97h133v89H701z"/><circle cx="794" cy="120" r="13" fill="#db8668" stroke="none"/><path fill="#55988f" d="M703 172q40-92 69-25-22-22-28 13 50-32 88 4v20H703z" stroke="none"/><path d="M710 174q23-35 47-9t64 2" stroke="#fff4da" stroke-width="3"/></g>` : ''}
        ${wall === 'noren_curtain' && owns(wall) ? svg`<g data-testid="art-noren_curtain"><path d="M678 72h174" stroke="#d69e2e" stroke-width="6"/><path fill="#1a365d" d="M684 75h52v85q-26 8-52 0zM740 75h52v85q-26 8-52 0zM796 75h52v85q-26 8-52 0z"/><circle cx="710" cy="115" r="14" fill="none" stroke="#fff4da" stroke-width="3"/><path d="M705 115h10M710 110v10" stroke="#fff4da" stroke-width="2"/><circle cx="766" cy="115" r="14" fill="none" stroke="#fff4da" stroke-width="3"/><path d="M761 115h10M766 110v10" stroke="#fff4da" stroke-width="2"/><circle cx="822" cy="115" r="14" fill="none" stroke="#fff4da" stroke-width="3"/><path d="M817 115h10M822 110v10" stroke="#fff4da" stroke-width="2"/></g>` : ''}
        ${floor === 'potted_plant' && owns(floor) ? svg`<g data-testid="art-potted_plant"><path d="M853 440v-97m0 59-32-30m32 11 29-28" stroke="#416956"/><g fill="#65906c"><ellipse cx="819" cy="366" rx="24" ry="12" transform="rotate(32 819 366)"/><ellipse cx="878" cy="351" rx="23" ry="12" transform="rotate(-30 878 351)"/><ellipse cx="850" cy="333" rx="12" ry="26"/></g><path fill="#d99170" d="M821 418h64l-10 52h-44z"/><path fill="#ebaf87" d="M817 416h72v13h-72z"/></g>` : ''}
        ${floor === 'andon_lantern' && owns(floor) ? svg`<g data-testid="art-andon_lantern"><path fill="#fefcbf" d="M826 355h54v90h-54z"/><rect x="822" y="348" width="62" height="100" rx="4" fill="none" stroke="#583e32" stroke-width="4"/><path d="M826 385h54M826 415h54M853 355v90" stroke="#583e32" stroke-width="3"/><path d="M824 448v18m58-18v18" stroke="#583e32" stroke-width="6"/><circle cx="853" cy="400" r="12" fill="#f6e05e" opacity="0.6" stroke="none"/></g>` : ''}
        ${floor === 'sakura_bonsai' && owns(floor) ? svg`<g data-testid="art-sakura_bonsai"><ellipse cx="852" cy="450" rx="38" ry="14" fill="#2c5282"/><ellipse cx="852" cy="445" rx="32" ry="8" fill="#2f855a"/><path d="M852 445q-12-30 4-50t-6-40" stroke="#5a3a28" stroke-width="8" fill="none"/><path d="M848 385q20-15 32-5m-25 15q-18-10-24 5" stroke="#5a3a28" stroke-width="5" fill="none"/><circle cx="848" cy="345" r="18" fill="#fed7e2"/><circle cx="832" cy="355" r="14" fill="#fbb6ce"/><circle cx="866" cy="350" r="15" fill="#f687b3"/><circle cx="880" cy="375" r="14" fill="#fed7e2"/><circle cx="825" cy="390" r="12" fill="#fbb6ce"/></g>` : ''}
        ${floor === 'golden_maneki_neko' && owns(floor) ? svg`<g data-testid="art-golden_maneki_neko"><path fill="#9b2c2c" d="M814 445h76l-6 18h-64z"/><circle cx="816" cy="456" r="3" fill="#ecc94b"/><circle cx="888" cy="456" r="3" fill="#ecc94b"/><ellipse cx="852" cy="415" rx="26" ry="28" fill="#ecc94b"/><circle cx="852" cy="372" r="20" fill="#ecc94b"/><polygon points="835,362 842,342 849,360" fill="#ecc94b"/><polygon points="855,360 862,342 869,362" fill="#ecc94b"/><path d="M866 385q14-20 6-36t-12 12" fill="#ecc94b" stroke="#583e32" stroke-width="3"/><rect x="838" y="386" width="28" height="6" rx="3" fill="#e53e3e"/><circle cx="852" cy="392" r="3" fill="#fefcbf"/><circle cx="845" cy="370" r="2" fill="#583e32"/><circle cx="859" cy="370" r="2" fill="#583e32"/></g>` : ''}
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
