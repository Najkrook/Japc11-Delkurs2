import { html, type TemplateResult } from 'lit-html';
import type { CourseHostContext, CourseProgressData } from '../types.ts';
import { courseWeeks } from '../data/index.ts';
import {
  calculateProductionRate,
  unitsToWholeYen,
  createDefaultRestaurantState,
} from './economy.ts';
import {
  evaluateMedalGrants,
  mergePermanentGrants,
} from './medals.ts';
import {
  SUSHI_CATALOG,
  SUSHI_CATALOG as SUSHI_UNLOCK_CATALOG,
  getCatalogItem,
  previewCatalogPurchase,
} from './catalog.ts';
import type {
  SushiRestaurantState,
  ProductionRate,
} from './types.ts';
import {
  getOrInitRestaurant,
  collectRevenue,
  syncMedalGrants,
  purchaseCatalogItem,
} from './service.ts';

if (typeof window !== 'undefined') {
  try {
    // @ts-expect-error Dynamic CSS import is handled by Vite for lazy bundling
    void import('./sushi.css');
  } catch {}
}

/**
 * Kontrollerar om den aktuella användaren är en fullvärdig autentiserad Google-användare.
 * Anonyma eller saknade sessioner får ingen tillgång till restaurangen.
 */
function isAuthenticatedGoogleUser(
  user: CourseHostContext['user'],
): user is NonNullable<CourseHostContext['user']> {
  if (!user || !user.uid) return false;
  const rawUser = user as { isAnonymous?: boolean };
  return rawUser.isAnonymous !== true;
}

/**
 * Controller class managing the client lifecycle, real-time ticker,
 * visibility throttling, and manual revenue collection.
 */
export class SushiClientController {
  public uid: string | null = null;
  public state: SushiRestaurantState | null = null;
  public loading: boolean = false;
  public error: string | null = null;
  public isCollecting: boolean = false;
  public isBuying: string | null = null;
  public buyError: string | null = null;
  public announcement: string = '';
  public recentlyUnlocked: string[] = [];
  public clientReceivedAtMs: number = Date.now();
  private tickerId: ReturnType<typeof setInterval> | number | null = null;
  private visibilityCleanup: (() => void) | null = null;
  private idempotencyKey: string | null = null;
  private host: CourseHostContext | null = null;

  public init(
    uid: string,
    host: CourseHostContext,
    courseProgressSnapshot?: CourseProgressData | null,
  ): void {
    const earnedGrants = courseProgressSnapshot
      ? evaluateMedalGrants(courseProgressSnapshot, courseWeeks)
      : [];

    if (this.uid === uid && this.state !== null) {
      this.host = host;
      if (earnedGrants.length > 0) {
        void this.syncGrantsIfChanged(earnedGrants);
      }
      return;
    }

    this.reset();
    this.uid = uid;
    this.host = host;
    this.clientReceivedAtMs = Date.now();

    // Default optimistic state ensures synchronous renders succeed immediately
    this.state = createDefaultRestaurantState(uid, this.clientReceivedAtMs);
    if (earnedGrants.length > 0) {
      this.state.permanentGrants = mergePermanentGrants([], earnedGrants);
    }
    this.loading = true;

    // Fetch authoritative state from backend with retroactive grants
    void getOrInitRestaurant(uid, this.clientReceivedAtMs, earnedGrants)
      .then((authoritative) => {
        if (this.uid !== uid) return; // Account switched while in flight
        const prevGrants = new Set(this.state?.permanentGrants || []);
        const newGrants = authoritative.permanentGrants.filter((g) => !prevGrants.has(g));

        this.state = authoritative;
        this.clientReceivedAtMs = Date.now();
        this.loading = false;

        if (newGrants.length > 0) {
          this.recentlyUnlocked = Array.from(new Set([...this.recentlyUnlocked, ...newGrants]));
          this.announcement = this.formatAnnouncement(newGrants);
        } else {
          this.announcement = `Välkommen till din sushirestaurang! Intäktstakten är ${
            calculateProductionRate(
              authoritative.kitchenCapacity,
              authoritative.serviceCapacity,
              authoritative.averageRevenuePerOrder,
            ).yenPerMinute
          } yen per minut.`;
        }
        this.host?.render();
      })
      .catch((_err: unknown) => {
        if (this.uid !== uid) return;
        this.loading = false;
        this.error = 'Kunde inte ansluta till restaurangen. Kontrollera anslutningen och försök igen.';
        this.host?.render();
      });

    // Start 1 Hz local ticker
    if (typeof window !== 'undefined') {
      this.tickerId = window.setInterval(() => {
        // Suppress DOM re-renders in background tabs to conserve CPU and battery
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        if (this.host && !this.loading) {
          this.host.render();
        }
      }, 1000);

      // Throttling via Page Visibility API
      if (typeof document !== 'undefined') {
        const onVisibility = () => {
          if (document.visibilityState === 'visible') {
            this.host?.render();
          }
        };
        document.addEventListener('visibilitychange', onVisibility);
        this.visibilityCleanup = () => {
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }
    }
  }

  public reset(): void {
    if (this.tickerId !== null) {
      if (typeof window !== 'undefined' && window.clearInterval) {
        window.clearInterval(this.tickerId as number);
      } else {
        clearInterval(this.tickerId as ReturnType<typeof setInterval>);
      }
      this.tickerId = null;
    }
    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = null;
    }
    this.uid = null;
    this.state = null;
    this.loading = false;
    this.error = null;
    this.isCollecting = false;
    this.isBuying = null;
    this.buyError = null;
    this.announcement = '';
    this.recentlyUnlocked = [];
    this.idempotencyKey = null;
    this.host = null;
  }

  private async syncGrantsIfChanged(earnedGrants: string[]): Promise<void> {
    if (!this.state || !this.uid || earnedGrants.length === 0) return;

    const currentGrants = new Set(this.state.permanentGrants || []);
    const newlyEarned = earnedGrants.filter((g) => !currentGrants.has(g));

    if (newlyEarned.length === 0) return;

    try {
      const activeUid = this.uid;
      const updatedState = await syncMedalGrants(activeUid, earnedGrants, Date.now());
      if (this.uid !== activeUid) return;

      this.state = updatedState;
      this.recentlyUnlocked = Array.from(new Set([...this.recentlyUnlocked, ...newlyEarned]));
      this.announcement = this.formatAnnouncement(newlyEarned);
      this.host?.render();
    } catch (_err) {
      // Ticket 05 requirement: Temporary synchronization error is not proof of missing progress.
      // Preserve existing grants without rollback or error banner blocking restaurant usage.
    }
  }

  public dismissRecentlyUnlocked(): void {
    this.recentlyUnlocked = [];
    this.host?.render();
  }

  public getRecentlyUnlockedNames(): string[] {
    return this.recentlyUnlocked.map((id) => {
      const item = SUSHI_UNLOCK_CATALOG.find((cat) => cat.id === id);
      return item ? item.name : id;
    });
  }

  public formatAnnouncement(newGrants: string[]): string {
    if (newGrants.length === 1) {
      const item = SUSHI_UNLOCK_CATALOG.find((i) => i.id === newGrants[0]);
      const name = item ? item.name : newGrants[0];
      const lesson = item
        ? `Kapitel ${item.requiredLesson} ${item.requiredTierLabel}medalj`
        : 'kursmedalj';
      return `Grattis! Ny kursbelöning upplåst: ${name} från ${lesson}. Föremålet är nu tillgängligt att köpa i butiken.`;
    }
    if (newGrants.length > 1) {
      const names = newGrants
        .map((id) => SUSHI_UNLOCK_CATALOG.find((i) => i.id === id)?.name || id)
        .join(', ');
      return `Grattis! ${newGrants.length} nya kursbelöningar upplåsta från dina kursmedaljer: ${names}. Föremålen är nu tillgängliga att köpa i butiken.`;
    }
    return '';
  }

  /**
   * Recalculates estimated uncollected revenue based on elapsed wall-clock time
   * clamped to the 8-hour cap.
   */
  public recalculate(): {
    displayedUncollectedYen: number;
    currentUncollectedUnits: number;
    currentUsedProductionMs: number;
    isCapped: boolean;
    progressPercent: number;
    rate: ProductionRate;
  } {
    if (!this.state) {
      const defaultRate = calculateProductionRate(1, 2, 10);
      return {
        displayedUncollectedYen: 0,
        currentUncollectedUnits: 0,
        currentUsedProductionMs: 0,
        isCapped: false,
        progressPercent: 0,
        rate: defaultRate,
      };
    }

    const rate = calculateProductionRate(
      this.state.kitchenCapacity,
      this.state.serviceCapacity,
      this.state.averageRevenuePerOrder,
    );

    const nowMs = Date.now();
    const elapsedMs = Math.max(0, nowMs - this.clientReceivedAtMs);
    const remainingCapMs = Math.max(0, this.state.capMs - this.state.usedProductionMs);
    const producedMs = Math.min(elapsedMs, remainingCapMs);
    const additionalUnits = rate.yenPerMinute * producedMs;

    const currentUncollectedUnits = this.state.uncollectedUnits + additionalUnits;
    const currentUsedProductionMs = this.state.usedProductionMs + producedMs;
    const isCapped = currentUsedProductionMs >= this.state.capMs;
    const displayedUncollectedYen = Math.floor(currentUncollectedUnits / 60_000);
    const progressPercent = Math.min(
      100,
      Math.floor((currentUsedProductionMs / this.state.capMs) * 100),
    );

    return {
      displayedUncollectedYen,
      currentUncollectedUnits,
      currentUsedProductionMs,
      isCapped,
      progressPercent,
      rate,
    };
  }

  /**
   * Executes manual collection ("Hämta intäkter") with optimistic UI update,
   * idempotency key preservation, and rollback on failure.
   */
  public async collect(): Promise<void> {
    if (this.isCollecting || !this.state || !this.uid) return;

    const calc = this.recalculate();
    if (calc.displayedUncollectedYen <= 0) return;

    if (!this.idempotencyKey) {
      this.idempotencyKey = `collect_${this.uid}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;
    }
    const key = this.idempotencyKey;
    const activeUid = this.uid;

    // 1. Optimistic UI update
    const previousSnapshot: SushiRestaurantState = JSON.parse(JSON.stringify(this.state));
    const optimisticCollectedYen = calc.displayedUncollectedYen;
    const optimisticCollectedUnits = calc.currentUncollectedUnits;

    this.state.balanceUnits += optimisticCollectedUnits;
    this.state.uncollectedUnits = 0;
    this.state.usedProductionMs = 0;
    this.clientReceivedAtMs = Date.now();
    this.isCollecting = true;
    this.error = null;
    this.announcement = `Hämtade ${optimisticCollectedYen} yen till kassan! Nytt disponibelt saldo: ${unitsToWholeYen(
      this.state.balanceUnits,
    )} yen.`;
    this.host?.render();

    // 2. Authoritative backend call
    try {
      const res = await collectRevenue(activeUid, key, Date.now());
      if (this.uid === activeUid) {
        this.state = res.state;
        this.clientReceivedAtMs = Date.now();
        this.idempotencyKey = null; // Key succeeded; reset for next collection
        this.isCollecting = false;
        this.announcement = `Intäkter sparade på servern. Nytt saldo: ${unitsToWholeYen(
          this.state.balanceUnits,
        )} yen.`;
        this.host?.render();
      }
    } catch (err: unknown) {
      if (this.uid === activeUid) {
        // Rollback optimistic update
        this.state = previousSnapshot;
        this.isCollecting = false;
        this.error = 'Kunde inte hämta intäkterna på grund av nätverksfel. Försök igen.';
        this.announcement =
          'Fel vid hämtning. Dina intäkter är inte förlorade. Klicka på Försök igen.';
        this.host?.render();
      }
    }
  }

  public retry(): void {
    if (!this.uid || !this.host) return;
    this.error = null;
    this.init(this.uid, this.host);
  }

  /**
   * Purchases an upgrade item from the catalog.
   */
  public async buy(itemId: string): Promise<void> {
    if (this.isBuying || !this.state || !this.uid) return;
    const item = getCatalogItem(itemId);
    if (!item) return;

    this.isBuying = itemId;
    this.buyError = null;
    const activeUid = this.uid;
    const key = `buy_${activeUid}_${itemId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.host?.render();

    try {
      const res = await purchaseCatalogItem(activeUid, itemId, key, Date.now());
      if (this.uid === activeUid) {
        if (res.success) {
          this.state = res.state;
          this.clientReceivedAtMs = Date.now();
          const preview = previewCatalogPurchase(res.state, itemId);
          const feedback = preview?.educationalExplanation || item.effectDescription;
          this.announcement = `Köp genomfört: ${item.name} för ¥ ${item.priceYen}! ${feedback}`;
        } else {
          this.buyError = res.message;
          this.announcement = `Kunde inte köpa ${item.name}: ${res.message}`;
        }
        this.isBuying = null;
        this.host?.render();
      }
    } catch (_err) {
      if (this.uid === activeUid) {
        this.isBuying = null;
        this.buyError = 'Ett nätverksfel uppstod vid köpet. Försök igen.';
        this.announcement = 'Kunde inte slutföra köpet på grund av anslutningsfel.';
        this.host?.render();
      }
    }
  }
}

// Module-level controller singleton
const activeController = new SushiClientController();

/**
 * Renderar spärrsidan (Auth Gate) för oinloggade besökare eller anonyma sessioner.
 * Gäståtkomst eller gästdemo tillåts inte enligt Ticket 02.
 */
function renderSushiAuthGate(host: CourseHostContext, onBackToStudies: () => void): TemplateResult {
  const handleLogin = () => {
    if (host.onLogin) {
      host.onLogin();
    } else {
      host.account();
    }
  };

  return html`
    <div
      class="sushi-auth-gate"
      data-testid="sushi-auth-gate"
      role="region"
      aria-label="Inloggningskrav"
    >
      <div class="sushi-auth-card">
        <div class="sushi-auth-icon" aria-hidden="true">🍣🔒</div>
        <h2>Logga in för att öppna restaurangen</h2>
        <p>
          Din sushirestaurang är personlig och kopplas till dina studieresultat i Genki I. Logga in
          med ditt Google-konto för att starta restaurangen och tjäna yen.
        </p>
        <p class="sushi-auth-note">
          Gäståtkomst eller demo stöds inte. Restaurangen kräver ett inloggat Google-konto.
        </p>

        <div class="sushi-auth-actions">
          <button
            type="button"
            class="sushi-btn-primary"
            data-testid="sushi-login-btn"
            ?disabled=${host.authBusy}
            @click=${handleLogin}
          >
            ${host.authBusy ? 'Loggar in...' : 'Logga in med Google'}
          </button>

          <button
            type="button"
            class="sushi-btn-secondary"
            data-testid="sushi-back-btn"
            @click=${onBackToStudies}
          >
            ← Tillbaka till studierna
          </button>
        </div>

        ${
          host.authError
            ? html`
                <div class="sushi-auth-error" role="alert" data-testid="sushi-auth-error">
                  <span>⚠️ ${host.authError}</span>
                  <button type="button" class="sushi-retry-btn" @click=${handleLogin}>
                    Försök igen
                  </button>
                </div>
              `
            : ''
        }
      </div>
    </div>
  `;
}

/**
 * Renderar restaurangens aktiva vy för en inloggad student.
 * Inkluderar disponibelt saldo, kassaregister med ohämtade intäkter,
 * produktionstakt och flaskhals, åttatimmarstak, hämtningsknapp,
 * permanenta upplåsningar från kursmedaljer, och ARIA live region.
 */
function renderSushiAuthenticatedStage(
  host: CourseHostContext,
  user: NonNullable<CourseHostContext['user']>,
  onBackToStudies: () => void,
  courseProgressSnapshot?: CourseProgressData | null,
  onNavigateToChapter?: (lessonNumber: number, weekId: string) => void,
): TemplateResult {
  activeController.init(user.uid, host, courseProgressSnapshot);

  const displayName = user.displayName || user.email || 'student';
  const state = activeController.state;
  const spendableYen = state ? unitsToWholeYen(state.balanceUnits) : 0;
  const calc = activeController.recalculate();
  const { displayedUncollectedYen, currentUsedProductionMs, isCapped, progressPercent, rate } = calc;

  const usedHoursStr = (currentUsedProductionMs / 3_600_000).toFixed(1);
  const capHoursStr = state ? (state.capMs / 3_600_000).toFixed(0) : '8';

  const bottleneckText =
    rate.bottleneck === 'kitchen'
      ? 'Kök (Flaskhals)'
      : rate.bottleneck === 'service'
        ? 'Service (Flaskhals)'
        : 'Balanserad produktion';

  const handleNavigateToChapter = (lessonNumber: number, weekId: string) => {
    if (onNavigateToChapter) {
      onNavigateToChapter(lessonNumber, weekId);
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.hash = `#/vecka/${weekId}`;
    }
  };

  const unlockedCount =
    state && Array.isArray(state.permanentGrants)
      ? state.permanentGrants.filter((g) => SUSHI_UNLOCK_CATALOG.some((c) => c.id === g)).length
      : 0;

  return html`
    <div class="sushi-container" data-testid="sushi-container">
      <section class="sushi-stage" data-testid="sushi-stage" aria-label="Personlig sushirestaurang">
        <!-- Festlig upplåsningsnotis (Ticket 05) -->
        ${
          activeController.recentlyUnlocked.length > 0
            ? html`
                <aside
                  class="sushi-unlock-banner"
                  data-testid="sushi-unlock-banner"
                  role="status"
                  aria-live="polite"
                >
                  <div class="sushi-unlock-banner-content">
                    <span class="sushi-unlock-banner-icon" aria-hidden="true">🎉🔓</span>
                    <div class="sushi-unlock-banner-text">
                      <strong>Ny kursbelöning upplåst!</strong>
                      <p>
                        Dina framsteg i studierna har låst upp:
                        <strong>${activeController.getRecentlyUnlockedNames().join(', ')}</strong>.
                        Föremålen är nu tillgängliga att köpa för yen i butiken.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="sushi-banner-dismiss-btn"
                    data-testid="sushi-banner-dismiss-btn"
                    @click=${() => activeController.dismissRecentlyUnlocked()}
                    aria-label="Stäng notis om ny upplåsning"
                  >
                    ×
                  </button>
                </aside>
              `
            : ''
        }

        <!-- Scenhuvud med studentens namn och disponibelt saldo -->
        <div class="sushi-stage-header">
          <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.5rem;">
            <h2>Välkommen, ${displayName}!</h2>
            <div class="sushi-balance-badge" data-testid="sushi-spendable-balance">
              <span>Disponibelt saldo:</span>
              <strong class="sushi-balance-amount">¥ ${spendableYen}</strong>
            </div>
          </div>
          <p class="sushi-stage-intro">
            Din restaurang producerar och tjänar yen i realtid. Hämta intäkterna till ditt disponibla saldo.
          </p>
        </div>

        <!-- Kassaregister (Ticket 04) -->
        <div class="sushi-cash-register" data-testid="sushi-cash-register" role="region" aria-label="Kassa och ohämtade intäkter">
          <div class="sushi-register-display">
            <span class="sushi-register-label">Ohämtade intäkter</span>
            <div class="sushi-register-amount" data-testid="sushi-uncollected-amount">
              <span class="sushi-yen-symbol" aria-hidden="true">¥</span>
              <span class="sushi-yen-number">${displayedUncollectedYen}</span>
            </div>
          </div>

          <!-- Takt och flaskhals (Ticket 04) -->
          <div class="sushi-rate-bar" data-testid="sushi-rate-info">
            <span>Intäktstakt: <strong>${rate.yenPerMinute} ¥/min</strong></span>
            <span class="sushi-bottleneck-tag ${rate.bottleneck === 'kitchen' ? 'tag-warn' : ''}">
              Kök: ${state ? state.kitchenCapacity : 1} ord/min ${rate.bottleneck === 'kitchen' ? '(Flaskhals)' : ''}
            </span>
            <span class="sushi-bottleneck-tag ${rate.bottleneck === 'service' ? 'tag-warn' : ''}">
              Service: ${state ? state.serviceCapacity : 2} ord/min ${rate.bottleneck === 'service' ? '(Flaskhals)' : ''}
            </span>
            <span class="sushi-bottleneck-tag ${rate.bottleneck === 'none' ? 'tag-balanced' : ''}">
              ${bottleneckText}
            </span>
          </div>

          <!-- Takmätare och framsteg (Ticket 04 & 08) -->
          <div class="sushi-cap-tracker">
            <div class="sushi-cap-header">
              <div class="sushi-cap-title-row">
                <span>Produktionstid i perioden</span>
                ${state && state.capMs >= 43_200_000
                  ? html`<span class="sushi-cap-badge extended" data-testid="sushi-cap-badge-12h">12h Tak</span>`
                  : html`<span class="sushi-cap-badge standard" data-testid="sushi-cap-badge-8h">8h Tak</span>`}
              </div>
              <span>${usedHoursStr}h / ${capHoursStr}h</span>
            </div>
            <div
              class="sushi-progress-track"
              role="progressbar"
              aria-valuenow=${progressPercent}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Produktionstid i perioden"
            >
              <div
                class="sushi-progress-fill ${isCapped ? 'capped' : ''}"
                style="width: ${progressPercent}%"
              ></div>
            </div>
            ${state && state.capMs >= 43_200_000
              ? html`<div class="sushi-cap-active-indicator" data-testid="sushi-cap-active-badge">✨ Ny produktionstid aktiv! (12 timmar max)</div>`
              : ''}
            ${
              isCapped
                ? html`
                    <div
                      class="sushi-capped-notice"
                      role="status"
                      data-testid="sushi-capped-badge"
                    >
                      ⚠️ Kassan är full (${capHoursStr} timmar) — hämta intäkterna för att återuppta intjäningen.
                    </div>
                  `
                : ''
            }
          </div>

          <!-- Primär hämtningsknapp (Ticket 04) -->
          <button
            type="button"
            class="sushi-btn-primary sushi-collect-btn ${isCapped ? 'pulse-attention' : ''}"
            data-testid="sushi-collect-btn"
            ?disabled=${displayedUncollectedYen <= 0 || activeController.isCollecting}
            @click=${() => void activeController.collect()}
            aria-label="Hämta ${displayedUncollectedYen} intjänade yen till ditt disponibla saldo"
          >
            ${
              activeController.isCollecting
                ? html`<span class="sushi-btn-spinner" aria-hidden="true"></span> Hämtar...`
                : html`<span>Hämta intäkter</span> <strong class="sushi-btn-yen-tag">¥ ${displayedUncollectedYen}</strong>`
            }
          </button>

          ${
            activeController.error
              ? html`
                  <div class="sushi-auth-error" role="alert" data-testid="sushi-collect-error">
                    <span>⚠️ ${activeController.error}</span>
                    <button
                      type="button"
                      class="sushi-retry-btn"
                      @click=${() => void activeController.collect()}
                    >
                      Försök igen
                    </button>
                  </div>
                `
              : ''
          }

          ${
            activeController.buyError
              ? html`
                  <div class="sushi-auth-error" role="alert" data-testid="sushi-buy-error">
                    <span>⚠️ ${activeController.buyError}</span>
                  </div>
                `
              : ''
          }
        </div>

        <!-- Kursbelöningar & Upplåsningar (Ticket 05, 06, 07, 08) -->
        <section
          class="sushi-unlocks-panel"
          data-testid="sushi-unlocks-panel"
          aria-label="Kursbelöningar och upplåsningar"
        >
          <div class="sushi-unlocks-header">
            <div class="sushi-unlocks-title-group">
              <h3>Kursbelöningar & Upplåsningar</h3>
              <span class="sushi-unlocks-count-badge" data-testid="sushi-unlocks-count-badge">
                ${unlockedCount} / ${SUSHI_CATALOG.length} upplåsta
              </span>
            </div>
            <p class="sushi-unlocks-intro">
              Dina studieresultat och kapitelmedaljer i Genki låser upp permanenta köpmöjligheter i butiken.
              Upplåsning ger inte gratis föremål, men gör dem tillgängliga att köpa för intjänade yen.
            </p>
          </div>

          <div class="sushi-unlocks-grid" data-testid="sushi-unlocks-grid">
            ${SUSHI_CATALOG.map((item) => {
              const isOwned = Boolean(
                state?.inventory && state.inventory.includes(item.id),
              );
              const isUnlocked = Boolean(
                state?.permanentGrants && state.permanentGrants.includes(item.id),
              );
              const isNew = activeController.recentlyUnlocked.includes(item.id);
              const canAffordItem = Boolean(state && state.balanceUnits >= item.priceUnits);
              const diffUnits = state ? Math.max(0, item.priceUnits - state.balanceUnits) : item.priceUnits;
              const diffYen = unitsToWholeYen(diffUnits);

              let purchaseState: 'locked' | 'unaffordable' | 'affordable' | 'owned' = 'locked';
              let cardStateClass = 'is-locked';
              if (isOwned) {
                purchaseState = 'owned';
                cardStateClass = 'is-owned';
              } else if (!isUnlocked) {
                purchaseState = 'locked';
                cardStateClass = 'is-locked';
              } else if (!canAffordItem) {
                purchaseState = 'unaffordable';
                cardStateClass = 'is-unlocked is-unaffordable';
              } else {
                purchaseState = 'affordable';
                cardStateClass = 'is-unlocked is-affordable';
              }

              const preview = !isOwned && state ? previewCatalogPurchase(state, item.id) : undefined;

              return html`
                <div
                  class="sushi-unlock-card sushi-shop-card ${cardStateClass}"
                  data-testid="unlock-card-${item.id}"
                  data-item-id="${item.id}"
                  data-purchase-state="${purchaseState}"
                >
                  <div class="sushi-card-top">
                    <span class="sushi-card-icon" aria-hidden="true">${item.icon}</span>
                    <div class="sushi-card-title-group">
                      <strong class="sushi-card-name">${item.name}</strong>
                      <span class="sushi-card-category">${item.categoryLabel}</span>
                    </div>
                    ${isNew
                      ? html`<span class="sushi-pill-new" data-testid="unlock-pill-new-${item.id}">Ny!</span>`
                      : ''}
                  </div>

                  <p class="sushi-card-desc">${item.effectDescription}</p>

                  ${preview && (preview.ordersDelta !== 0 || preview.yenDelta !== 0 || preview.hasImmediateEffect)
                    ? html`
                        <div class="sushi-upgrade-preview" data-testid="upgrade-preview-${item.id}">
                          Takt efter köp: <strong>${preview.prospectiveRate.yenPerMinute} ¥/min</strong>
                          (${preview.yenDelta >= 0 ? '+' : ''}${preview.yenDelta} ¥/min)
                        </div>
                      `
                    : ''}

                  ${preview?.isBottleneckLimiting
                    ? html`
                        <div class="sushi-bottleneck-explainer" data-testid="bottleneck-explainer-${item.id}">
                          💡 ${preview.educationalExplanation}
                        </div>
                      `
                    : ''}

                  <div class="sushi-card-footer">
                    ${isOwned
                      ? html`
                          <div class="sushi-status-line">
                            <span
                              class="sushi-unlock-badge owned"
                              data-testid="unlock-badge-${item.id}"
                            >
                              ✓ Ägd
                            </span>
                            <span class="sushi-price-hint">Köpt (¥ ${item.priceYen})</span>
                          </div>
                          <div class="sushi-owned-indicator" data-testid="owned-indicator-${item.id}">
                            Aktiv i restaurangen
                          </div>
                          <button
                            type="button"
                            class="sushi-btn-buy"
                            disabled
                            data-testid="buy-btn-${item.id}"
                          >
                            Ägd
                          </button>
                        `
                      : !isUnlocked
                        ? html`
                            <div class="sushi-status-line">
                              <span
                                class="sushi-unlock-badge locked"
                                data-testid="unlock-badge-${item.id}"
                              >
                                🔒 Låst
                              </span>
                              <span class="sushi-req-text">
                                Kräver Kapitel ${item.requiredLesson} ${item.requiredTierLabel} (${item.requiredPercent}%)
                              </span>
                            </div>
                            <button
                              type="button"
                              class="sushi-study-link-btn"
                              data-testid="study-link-btn-${item.id}"
                              @click=${() => handleNavigateToChapter(item.requiredLesson, item.targetWeekId)}
                            >
                              Öppna Kapitel ${item.requiredLesson} →
                            </button>
                          `
                        : !canAffordItem
                          ? html`
                              <div class="sushi-status-line">
                                <span
                                  class="sushi-unlock-badge unlocked"
                                  data-testid="unlock-badge-${item.id}"
                                >
                                  🔓 Upplåst köpmöjlighet
                                </span>
                                <span class="sushi-price-hint">Pris i butik: ¥ ${item.priceYen}</span>
                              </div>
                              <div class="sushi-status-line">
                                <span
                                  class="sushi-missing-funds"
                                  data-testid="missing-funds-${item.id}"
                                >
                                  Saknar ¥ ${diffYen}
                                </span>
                              </div>
                              <button
                                type="button"
                                class="sushi-btn-buy"
                                disabled
                                data-testid="buy-btn-${item.id}"
                              >
                                För lite yen (saknar ¥ ${diffYen})
                              </button>
                            `
                          : html`
                              <div class="sushi-status-line">
                                <span
                                  class="sushi-unlock-badge unlocked"
                                  data-testid="unlock-badge-${item.id}"
                                >
                                  🔓 Upplåst köpmöjlighet
                                </span>
                                <span class="sushi-price-hint">Pris i butik: ¥ ${item.priceYen}</span>
                              </div>
                              <button
                                type="button"
                                class="sushi-btn-buy sushi-btn-primary"
                                data-testid="buy-btn-${item.id}"
                                ?disabled=${activeController.isBuying === item.id}
                                @click=${() => void activeController.buy(item.id)}
                              >
                                ${activeController.isBuying === item.id
                                  ? 'Köper...'
                                  : `Köp för ¥ ${item.priceYen}`}
                              </button>
                            `}
                  </div>
                </div>
              `;
            })}
          </div>
        </section>

        <!-- 2D Restaurangscen och statusindikator (Bevarad för struktur & F20-T1 kompatibilitet) -->
        <div class="sushi-scene-placeholder" data-testid="sushi-scene-placeholder">
          <div class="sushi-scene-badge">🍣 Personlig restaurang i drift</div>
          <p class="sushi-scene-desc">
            Grundrestaurang startad med kökskapacitet ${state ? state.kitchenCapacity : 1} och servicekapacitet ${state ? state.serviceCapacity : 2}.
            Restaurangen sparar automatiskt intäkter upp till ${capHoursStr} timmar även när du inte är inloggad.
          </p>
          <div class="sushi-scene-equipment" data-testid="sushi-scene-equipment">
            ${state?.inventory?.includes('prep_counter')
              ? html`<div class="sushi-scene-equipment-badge scene-prep-counter" data-testid="scene-prep-counter">🔪 Förbättrad beredningsbänk (+2 kök)</div>`
              : ''}
            ${state?.inventory?.includes('conveyor_belt')
              ? html`<div class="sushi-scene-equipment-badge scene-conveyor-belt" data-testid="scene-conveyor-belt">🔄 Transportband (+2 service)</div>`
              : ''}
            ${state?.inventory?.includes('cap_extension_12h')
              ? html`<div class="sushi-scene-equipment-badge scene-cap-extension" data-testid="scene-cap-extension">⏰ 12h Produktionstak</div>`
              : ''}
          </div>
        </div>

        <!-- Åtgärder och navigation -->
        <div class="sushi-stage-actions">
          <button
            type="button"
            class="sushi-btn-secondary"
            data-testid="sushi-stage-back-btn"
            @click=${onBackToStudies}
          >
            ← Återgå till studierna
          </button>
        </div>

        <!-- ARIA live announcer för skärmläsare -->
        <div
          class="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="sushi-live-announcer"
        >
          ${activeController.announcement}
        </div>
      </section>
    </div>
  `;
}

/**
 * Huvudkomponent för sushispelets skal.
 * Ersätter hela studieappens toppmeny och sidomeny med ett eget renodlat spelgränssnitt.
 */
export function renderSushiShell(
  host: CourseHostContext,
  onBackToStudies: () => void,
  courseProgressSnapshot?: CourseProgressData | null,
  onNavigateToChapter?: (lessonNumber: number, weekId: string) => void,
): TemplateResult {
  const user = host.user;
  const isAuthed = isAuthenticatedGoogleUser(user);

  if (!isAuthed && activeController.uid !== null) {
    activeController.reset();
  }

  return html`
    <div
      class="sushi-shell"
      data-theme=${host.theme}
      data-testid="sushi-shell"
      data-authenticated="${isAuthed ? 'true' : 'false'}"
    >
      <!-- Separat toppmeny för restaurangen (inga studiemenyer eller sidomenyer) -->
      <header class="sushi-topbar">
        <div class="sushi-topbar-inner">
          <div class="sushi-topbar-left">
            <button
              type="button"
              class="sushi-back-btn"
              data-testid="sushi-back-to-studies"
              @click=${onBackToStudies}
              title="Tillbaka till studierna"
            >
              ← Tillbaka till studierna
            </button>
          </div>

          <div class="sushi-topbar-center">
            <h1 class="sushi-title" lang="ja">
              <span>🍣</span>
              <span>Sushirestaurang</span>
            </h1>
          </div>

          <div class="sushi-topbar-right">
            <button
              type="button"
              class="sushi-icon-btn"
              @click=${() => host.toggleTheme()}
              title=${
                host.theme === 'sakura'
                  ? 'Växla till Washi & Matcha-tema'
                  : 'Slå på Sakura / Kawaii-tema'
              }
            >
              ${host.theme === 'sakura' ? '🍵 Washi' : '🌸 Sakura'}
            </button>

            ${
              isAuthed
                ? html`
                    <button
                      type="button"
                      class="sushi-account-btn logged-in"
                      ?disabled=${host.authBusy}
                      @click=${host.account}
                      title="Inloggad som ${user.displayName || user.email || 'student'} · Klicka för att logga ut"
                    >
                      ${
                        user.photoURL
                          ? html`<img
                              class="sushi-avatar"
                              src=${user.photoURL}
                              alt=""
                              referrerpolicy="no-referrer"
                            />`
                          : html`<span class="sushi-avatar-fallback">
                              ${(user.displayName || user.email || 'S').trim().charAt(0).toUpperCase()}
                            </span>`
                      }
                      <span class="sushi-user-name" data-testid="sushi-user-name">
                        ${user.displayName || user.email || 'Student'}
                      </span>
                      <span class="sushi-logout-hint">(Logga ut)</span>
                    </button>
                  `
                : html`
                    <button
                      type="button"
                      class="sushi-account-btn"
                      ?disabled=${host.authBusy}
                      @click=${() => (host.onLogin ? host.onLogin() : host.account())}
                    >
                      Logga in
                    </button>
                  `
            }
          </div>
        </div>
      </header>

      <!-- Huvudyta: Auth Gate för oinloggade, Spelscen för inloggade -->
      <main class="sushi-main" id="sushi-main">
        ${
          isAuthed
            ? renderSushiAuthenticatedStage(
                host,
                user,
                onBackToStudies,
                courseProgressSnapshot,
                onNavigateToChapter,
              )
            : renderSushiAuthGate(host, onBackToStudies)
        }
      </main>
    </div>
  `;
}
