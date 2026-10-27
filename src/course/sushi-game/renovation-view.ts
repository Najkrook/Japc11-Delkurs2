import { html } from 'lit-html';
import type { SushiRestaurantState } from './types.ts';
import { nextRenovation } from './renovations.ts';

export function renderRenovationCard(
  state: SushiRestaurantState,
  actions: {
    buy: () => void;
    preview: () => void;
    study: (chapter: number, week: string) => void;
  },
  busy: boolean,
  preview = false,
) {
  const next = nextRenovation(state);
  if (!next)
    return html`<p class="sushi-renovation-complete">
      Restaurangnivå 3/3 · Alla renoveringar är klara!
    </p>`;
  const medal = state.permanentGrants.includes(next.bronzeGrant);
  const affordable = state.balanceUnits >= next.priceUnits;
  return html`<article class="sushi-renovation-card" data-testid="sushi-renovation-card">
    ${preview ? '' : html`<img src=${next.image} width="240" height="160" alt="Nästa restaurangnivå" />`}
    <div>
      <span>Nästa renovering · Nivå ${next.targetTier}/3</span>
      <h3>${next.name}</h3>
      <p>¥ ${next.priceYen.toLocaleString('sv-SE')} · Kapitel ${next.chapter} brons (60 %)</p>
      <p>Öppnar köp från kapitel ${next.chapters}. Inga produktionsbonusar.</p>
      ${!medal ? html`<button type="button" class="pixel-btn" @click=${() => actions.study(next.chapter, `week-${next.chapter - 5}`)}>Studera kapitel ${next.chapter} →</button>` : ''}
      ${!affordable ? html`<p>Saknar ¥ ${Math.ceil((next.priceUnits - state.balanceUnits) / 60000).toLocaleString('sv-SE')} i disponibelt saldo.</p>` : ''}
      <div class="sushi-renovation-actions">
        ${preview ? '' : html`<button type="button" class="pixel-btn sushi-btn-secondary" data-testid="preview-renovation" ?disabled=${busy} @click=${actions.preview}>Förhandsvisa renovering</button>`}
        <button
          type="button"
          class="pixel-btn sushi-btn-primary"
          data-testid="buy-renovation"
          ?disabled=${busy || !medal || !affordable}
          @click=${actions.buy}
        >
          ${busy ? 'Väntar…' : `Renovera · ¥ ${next.priceYen.toLocaleString('sv-SE')}`}
        </button>
      </div>
    </div>
  </article>`;
}
