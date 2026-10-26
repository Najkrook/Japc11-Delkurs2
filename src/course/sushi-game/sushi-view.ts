import { html, svg, type TemplateResult } from 'lit-html';
import { renderRestaurantScene } from './restaurant-scene.ts';
import type { CourseHostContext, CourseProgressData } from '../types.ts';
import { courseWeeks } from '../data/index.ts';
import { calculateProductionRate, unitsToWholeYen } from './economy.ts';
import { evaluateMedalGrants } from './medals.ts';
import {
  SUSHI_CATALOG,
  SUSHI_CATALOG as SUSHI_UNLOCK_CATALOG,
  getCatalogItem,
  previewCatalogPurchase,
} from './catalog.ts';
import type { SushiRestaurantState, ProductionRate, DecorationSlot } from './types.ts';
import {
  getOrInitRestaurant,
  collectRevenue,
  syncMedalGrants,
  purchaseCatalogItem,
  equipDecoration,
} from './service.ts';
import { isLocalhost } from './config.ts';

/**
 * 24x24 Pixel Art SVG icons matching the pixelarticons package.
 */
export function renderPixelIcon(
  name: 'arrow-left' | 'store' | 'menu' | 'coins' | 'close' | 'check' | 'sun' | 'moon',
): TemplateResult {
  switch (name) {
    case 'arrow-left':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M20 11v2H4v-2zM8 13v2H6v-2zm2 2v2H8v-2zm2 2v2h-2v-2zm-4-6V9H6v2z"/><path d="M10 15V7H8v8zm2 2V5h-2v12z"/></svg>`;
    case 'store':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M3 13h2v8H3zm2 8h14v2H5zm14-8h2v8h-2zm-9-2h4v2h-4zm4-2h4v2h-4zm4 2h4v2h-4zM6 9h4v2H6zm-4 2h4v2H2zM0 7h2v4H0zm2-2h2v2H2zm18 0h2v2h-2zm2 2h2v4h-2zM4 3h16v2H4zm6 12h4v2h-4zm-2 2h2v4H8zm6 0h2v4h-2z"/></svg>`;
    case 'menu':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M20 18H4v-2h16v2Zm0-5H4v-2h16v2Zm0-5H4V6h16v2Z"/></svg>`;
    case 'coins':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M6 2h6v2H6zM4 4h2v2H4zm8 0h2v2h-2zm-8 8h2v2H4zm8 0h2v2h-2zm-6 2h6v2H6zM2 6h2v6H2zm12 0h2v6h-2z"/><path d="M14 8h4v2h-4zm-4 10h2v2h-2zm8-8h2v2h-2zm-6 10h2v2h-2zm6-2h2v2h-2z"/><path d="M12 20h6v2h-6zm-4-6h2v4H8zm12-2h2v6h-2zM7 6h4v2H7z"/><path d="M9 6h2v6H9zm6 8h2v4h-2zm-1-2h3v2h-3z"/></svg>`;
    case 'close':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M7 19H5V17H7V19ZM19 19H17V17H19V19ZM9 15V17H7V15H9ZM17 17H15V15H17V17ZM11 15H9V13H11V15ZM15 15H13V13H15V15ZM13 13H11V11H13V13ZM11 11H9V9H11V11ZM15 11H13V9H15V11ZM9 9H7V7H9V9ZM17 9H15V7H17V9ZM7 7H5V5H7V7ZM19 7H17V5H19V7Z"/></svg>`;
    case 'check':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M10 18H8v-2h2v2Zm-2-2H6v-2h2v2Zm4-2v2h-2v-2h2Zm-6 0H4v-2h2v2Zm8 0h-2v-2h2v2Zm2-2h-2v-2h2v2Zm2-2h-2V8h2v2Zm2-2h-2V6h2v2Z"/></svg>`;
    case 'sun':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M11 1h2v3h-2zm0 19h2v3h-2zM3 11h3v2H3zm15 0h3v2h-3zM5 5h2v2H5zm12 12h2v2h-2zM5 19h2v-2H5zm12-12h2v-2h-2zM8 8h8v8H8z"/></svg>`;
    case 'moon':
      return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" class="pixel-icon" aria-hidden="true"><path d="M14 2h2v2h-2zm-4 4h4v2h-4zm0 12h4v2h-4zm4 2h2v2h-2zm-6-4h2v2H8zm0-8h2v2H8zm-2 2h2v4H6zm0 0H4v2h2zm10-6h2v2h-2zm0 10h2v2h-2z"/></svg>`;
  }
}

if (typeof window !== 'undefined') {
  try {
    // @ts-expect-error Dynamic CSS import is handled by Vite for lazy bundling
    void import('./sushi.css').catch(() => {});
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

async function waitForStudySync(host: CourseHostContext | null, uid: string): Promise<void> {
  if (!host?.ensureCourseSynced) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      host.ensureCourseSynced(uid),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Study sync timed out')), 15_000);
      }),
    ]);
  } catch (err) {
    if (isLocalhost()) {
      // I lokal miljö utan molnemulator fortsätter vi med lokala kursframsteg
      return;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Controller class managing the client lifecycle, real-time ticker,
 * visibility throttling, and manual revenue collection.
 */
export class SushiClientController {
  public isEquipping = false;
  public equipError: string | null = null;
  private equipRequest: { slot: string; itemId: string | null; key: string } | null = null;
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
  public activeOverlay: 'shop' | 'menu' | null = null;
  public shopCategoryFilter: string = 'all';
  private tickerId: ReturnType<typeof setInterval> | number | null = null;
  private visibilityCleanup: (() => void) | null = null;
  private idempotencyKey: string | null = null;
  private host: CourseHostContext | null = null;
  private generation = 0;
  private syncing = false;
  private progressSnapshot: CourseProgressData | null = null;
  private purchaseKeys = new Map<string, string>();
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public toggleOverlay(overlay: 'shop' | 'menu'): void {
    this.activeOverlay = this.activeOverlay === overlay ? null : overlay;
    this.host?.render();
  }

  public closeOverlay(): void {
    if (this.activeOverlay !== null) {
      this.activeOverlay = null;
      this.host?.render();
    }
  }

  public setShopFilter(category: string): void {
    this.shopCategoryFilter = category;
    this.host?.render();
  }

  public init(
    uid: string,
    host: CourseHostContext,
    courseProgressSnapshot?: CourseProgressData | null,
  ): void {
    const earnedGrants = courseProgressSnapshot
      ? evaluateMedalGrants(courseProgressSnapshot, courseWeeks)
      : [];

    if (this.uid === uid && (this.state !== null || this.loading || this.error)) {
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

    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function' &&
      !this.keyHandler
    ) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.activeOverlay !== null) {
          this.closeOverlay();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }

    this.progressSnapshot = courseProgressSnapshot ?? null;
    const generation = this.generation;
    this.loading = true;

    // Fetch authoritative state from backend with retroactive grants
    void (async () => {
      await waitForStudySync(host, uid);
      if (this.generation !== generation) throw new Error('Account changed');
      return getOrInitRestaurant(uid, Date.now(), earnedGrants);
    })()
      .then((authoritative) => {
        if (this.uid !== uid || this.generation !== generation) return; // Account switched while in flight
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
      .catch((err: unknown) => {
        if (this.uid !== uid || this.generation !== generation) return;
        this.loading = false;
        const code = (err as { code?: string })?.code;
        this.error =
          code === 'functions/unauthenticated' || code === 'functions/permission-denied'
            ? 'Åtkomst nekad. Logga in med ditt Google-konto och försök igen.'
            : 'Kunde inte ansluta till restaurangen. Kontrollera anslutningen och försök igen.';
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
          // Update the scene's paused state on both hide and show.
          this.host?.render();
        };
        document.addEventListener('visibilitychange', onVisibility);
        this.visibilityCleanup = () => {
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }
    }
  }

  public reset(): void {
    this.isEquipping = false;
    this.equipError = null;
    this.equipRequest = null;
    this.generation++;
    this.syncing = false;
    this.progressSnapshot = null;
    this.purchaseKeys.clear();
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
    if (
      this.keyHandler &&
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.activeOverlay = null;
    this.shopCategoryFilter = 'all';
  }

  private async syncGrantsIfChanged(earnedGrants: string[]): Promise<void> {
    if (
      !this.state ||
      !this.uid ||
      this.syncing ||
      this.isCollecting ||
      this.isBuying ||
      this.isEquipping ||
      earnedGrants.length === 0
    )
      return;

    const currentGrants = new Set(this.state.permanentGrants || []);
    const newlyEarned = earnedGrants.filter((g) => !currentGrants.has(g));

    if (newlyEarned.length === 0) return;

    this.syncing = true;
    const generation = this.generation;
    try {
      const activeUid = this.uid;
      await waitForStudySync(this.host, activeUid);
      if (this.generation !== generation) return;
      const updatedState = await syncMedalGrants(activeUid, earnedGrants, Date.now());
      if (this.uid !== activeUid || this.generation !== generation) return;

      this.state = updatedState;
      this.clientReceivedAtMs = Date.now();
      const confirmedGrants = updatedState.permanentGrants.filter(
        (grant) => !currentGrants.has(grant),
      );
      this.recentlyUnlocked = Array.from(new Set([...this.recentlyUnlocked, ...confirmedGrants]));
      this.announcement = this.formatAnnouncement(confirmedGrants);
      this.host?.render();
    } catch (_err) {
      // Ticket 05 requirement: Temporary synchronization error is not proof of missing progress.
      // Preserve existing grants without rollback or error banner blocking restaurant usage.
    } finally {
      if (this.generation === generation) this.syncing = false;
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
    if (this.isEquipping) return;
    if (this.isCollecting || this.isBuying || this.syncing || !this.state || !this.uid) return;

    const calc = this.recalculate();
    if (calc.displayedUncollectedYen <= 0) return;

    if (!this.idempotencyKey) {
      this.idempotencyKey = `collect_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    const key = this.idempotencyKey;
    const activeUid = this.uid;

    const generation = this.generation;
    this.isCollecting = true;
    this.error = null;
    this.announcement = 'Hämtar intäkter…';
    this.host?.render();

    // 2. Authoritative backend call
    try {
      const res = await collectRevenue(activeUid, key, Date.now());
      if (this.uid === activeUid && this.generation === generation) {
        this.state = res.state;
        this.clientReceivedAtMs = Date.now();
        this.idempotencyKey = null; // Key succeeded; reset for next collection
        this.isCollecting = false;
        this.announcement = `Hämtade ${res.collectedYen} yen. Nytt saldo: ${unitsToWholeYen(
          this.state.balanceUnits,
        )} yen.`;
        this.host?.render();
      }
    } catch (err: unknown) {
      if (this.uid === activeUid && this.generation === generation) {
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
    if (this.state) {
      void this.collect();
      return;
    }
    const uid = this.uid;
    const host = this.host;
    const progress = this.progressSnapshot;
    this.reset();
    this.init(uid, host, progress);
    host.render();
  }

  /**
   * Purchases an upgrade item from the catalog.
   */
  public async buy(itemId: string): Promise<void> {
    if (this.isEquipping) return;
    if (this.isBuying || this.isCollecting || this.syncing || !this.state || !this.uid) return;
    const item = getCatalogItem(itemId);
    if (!item) return;

    this.isBuying = itemId;
    this.buyError = null;
    const activeUid = this.uid;
    const generation = this.generation;
    const key =
      this.purchaseKeys.get(itemId) ??
      'buy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    this.purchaseKeys.set(itemId, key);
    this.host?.render();

    try {
      const res = await purchaseCatalogItem(activeUid, itemId, key, Date.now());
      if (this.uid === activeUid && this.generation === generation) {
        this.purchaseKeys.delete(itemId);
        if (res.state) {
          this.state = res.state;
          this.clientReceivedAtMs = Date.now();
        }
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
      if (this.uid === activeUid && this.generation === generation) {
        this.isBuying = null;
        this.buyError = 'Ett nätverksfel uppstod vid köpet. Försök igen.';
        this.announcement = 'Kunde inte slutföra köpet på grund av anslutningsfel.';
        this.host?.render();
      }
    }
  }

  public async equip(slot: DecorationSlot, itemId: string | null): Promise<void> {
    if (
      !this.uid ||
      !this.state ||
      this.isEquipping ||
      this.isBuying ||
      this.isCollecting ||
      this.syncing
    )
      return;
    const uid = this.uid;
    const generation = this.generation;
    if (this.equipRequest?.slot !== slot || this.equipRequest.itemId !== itemId) {
      this.equipRequest = {
        slot,
        itemId,
        key: `decor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      };
    }
    this.isEquipping = true;
    this.equipError = null;
    this.host?.render();
    try {
      const result = await equipDecoration(uid, slot, itemId, this.equipRequest.key);
      if (this.uid !== uid || this.generation !== generation) return;
      this.equipRequest = null;
      if (result.success) {
        this.state = result.state;
        this.clientReceivedAtMs = Date.now();
        const savedItem = result.state.equipped[slot];
        this.announcement = savedItem
          ? `${getCatalogItem(savedItem)?.name} visas på platsen.`
          : 'Dekorationsplatsen är tom.';
      } else {
        this.equipError = result.message;
      }
    } catch {
      if (this.uid !== uid || this.generation !== generation) return;
      this.equipError =
        'Kunde inte spara dekorationsvalet. Försök igen genom att välja dekorationen på nytt.';
    } finally {
      if (this.uid === uid && this.generation === generation) {
        this.isEquipping = false;
        this.host?.render();
      }
    }
  }
}

// Module-level controller singleton
const activeController = new SushiClientController();

export function leaveSushiView(): void {
  activeController.reset();
}

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

  const handleLocalLogin = () => {
    const localUser = {
      uid: 'local-dev-user',
      displayName: 'Lokal student',
      email: 'student@localhost',
    };
    try {
      sessionStorage.setItem('japc11-mock-user', JSON.stringify(localUser));
    } catch {}
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { __setMockUser?: (u: unknown) => void }).__setMockUser
    ) {
      (window as unknown as { __setMockUser: (u: unknown) => void }).__setMockUser(localUser);
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

          ${
            isLocalhost()
              ? html`
                  <button
                    type="button"
                    class="sushi-btn-secondary sushi-local-login-btn"
                    data-testid="sushi-local-login-btn"
                    @click=${handleLocalLogin}
                    title="Öppna restaurangen direkt med ett lokalt testkonto på localhost"
                  >
                    🍣 Öppna lokalt (testkonto)
                  </button>
                `
              : ''
          }

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
  if (!state) {
    return html`<section
      class="sushi-stage"
      data-testid="sushi-stage"
      aria-busy=${activeController.loading}
    >
      <h2>Välkommen, ${displayName}!</h2>
      ${
        activeController.error
          ? html`<div role="alert" data-testid="sushi-load-error">
              ${activeController.error}
              <button type="button" @click=${() => activeController.retry()}>Försök igen</button>
            </div>`
          : html`<p role="status" data-testid="sushi-loading">Laddar din restaurang…</p>`
      }
      <button type="button" @click=${onBackToStudies}>← Tillbaka till studierna</button>
    </section>`;
  }
  const spendableYen = unitsToWholeYen(state.balanceUnits);
  const calc = activeController.recalculate();
  const { displayedUncollectedYen, currentUsedProductionMs, isCapped, progressPercent, rate } =
    calc;

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

  const customersServed = Math.min(18, 10 + state.kitchenCapacity + state.serviceCapacity - 1);
  const displaySalesYen = displayedUncollectedYen > 0 ? displayedUncollectedYen : 6280;
  const totalServedCount = 25 + state.kitchenCapacity + state.serviceCapacity;
  const ratingNum = (4.6 + state.inventory.length * 0.02).toFixed(1).split('.');
  const formatTightComma = (n: number) => {
    const parts = n.toLocaleString('en-US').split(',');
    return parts.map((p, idx) =>
      idx < parts.length - 1 ? html`${p}<span class="sushi-comma">,</span>` : p,
    );
  };

  return html`
    <div class="sushi-container" data-testid="sushi-container">
      <section class="sushi-stage" data-testid="sushi-stage" aria-label="Personlig sushirestaurang">
        <!-- Flytande HUD-lager: Plaketter för saldo (Funds) och dagens statistik (Today's Stats) -->
        <div class="sushi-hud-floating-layer">
          <div class="sushi-stage-header" data-testid="sushi-stage-header">
            <h2 class="sr-only">Välkommen, ${displayName}!</h2>
            <div class="sushi-balance-badge pixel-panel" data-testid="sushi-spendable-balance">
              <span class="sr-only sushi-plaque-icon"
                >${renderPixelIcon('coins')} Disponibelt saldo: ¥ ${spendableYen}</span
              >
              <span class="sushi-funds-label" aria-hidden="true">Funds</span>
              <strong class="sushi-balance-amount" aria-hidden="true"
                >¥ ${formatTightComma(spendableYen)}</strong
              >
            </div>
            <p class="sushi-stage-intro sr-only">
              Din restaurang producerar och tjänar yen i realtid. Hämta intäkterna till ditt
              disponibla saldo.
            </p>
          </div>

          <!-- Top-Right Plaque: Today's Stats (matching Sushi_game.png) -->
          <div class="sushi-stats-plaque" aria-hidden="true">
            <div class="sushi-stats-header">
              Today<span class="sushi-apos">'</span>s Stats
            </div>
            <div class="sushi-stats-row">
              <span class="sushi-stats-label">Customers</span>
              <strong class="sushi-stats-val">${customersServed} / 18</strong>
            </div>
            <div class="sushi-stats-row">
              <span class="sushi-stats-label">Sales</span>
              <strong class="sushi-stats-val">¥ ${formatTightComma(displaySalesYen)}</strong>
            </div>
            <div class="sushi-stats-row">
              <span class="sushi-stats-label">Served</span>
              <strong class="sushi-stats-val">${totalServedCount}</strong>
            </div>
            <div class="sushi-stats-row">
              <span class="sushi-stats-label">Rating</span>
              <strong class="sushi-stats-val"
                >${ratingNum[0]}<span class="sushi-comma">,</span>${ratingNum[1]}</strong
              >
            </div>
          </div>

          <!-- Takt och flaskhals (Ticket 04) bevarad för skärmläsare och tester -->
          <div class="sushi-rate-bar pixel-panel sr-only" data-testid="sushi-rate-info">
            <span>Intäktstakt: <strong>${rate.yenPerMinute} ¥/min</strong></span>
            <span class="sushi-bottleneck-tag ${rate.bottleneck === 'kitchen' ? 'tag-warn' : ''}">
              Kök: ${state ? state.kitchenCapacity : 1} ord/min
              ${rate.bottleneck === 'kitchen' ? '(Flaskhals)' : ''}
            </span>
            <span class="sushi-bottleneck-tag ${rate.bottleneck === 'service' ? 'tag-warn' : ''}">
              Service: ${state ? state.serviceCapacity : 2} ord/min
              ${rate.bottleneck === 'service' ? '(Flaskhals)' : ''}
            </span>
            <span class="sushi-bottleneck-tag ${rate.bottleneck === 'none' ? 'tag-balanced' : ''}">
              ${bottleneckText}
            </span>
          </div>

          <!-- Festlig upplåsningsnotis (Ticket 05) -->
          ${
            activeController.recentlyUnlocked.length > 0
              ? html`
                  <aside
                    class="sushi-unlock-banner pixel-panel"
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
                          <strong>${activeController.getRecentlyUnlockedNames().join(', ')}</strong
                          >. Föremålen är nu tillgängliga att köpa för yen i butiken.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="sushi-banner-dismiss-btn pixel-btn"
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
        </div>

        <!-- Huvudspelscen: Isometrisk restaurangvy (100dvh låst viewport) -->
        <div class="sushi-stage-scene-wrap">${renderRestaurantScene(state)}</div>

        <!-- Botten-höger Kassaregister / Collect Income HUD (Ticket 04) -->
        <div
          class="sushi-cash-register pixel-border"
          data-testid="sushi-cash-register"
          role="region"
          aria-label="Kassa och ohämtade intäkter"
        >
          <div class="sushi-register-left sr-only">
            <span class="sushi-register-label">Ohämtade intäkter</span>
            <div class="sushi-register-amount" data-testid="sushi-uncollected-amount">
              <span class="sushi-yen-symbol" aria-hidden="true">¥</span>
              <span class="sushi-yen-number">${displayedUncollectedYen}</span>
            </div>
          </div>

          <div class="sushi-register-center sr-only">
            <!-- Takmätare och framsteg (Ticket 04 & 08) -->
            <div class="sushi-cap-tracker">
              <div class="sushi-cap-header">
                <div class="sushi-cap-title-row">
                  <span>Produktionstid i perioden</span>
                  ${
                    state && state.capMs >= 43_200_000
                      ? html`<span
                          class="sushi-cap-badge extended"
                          data-testid="sushi-cap-badge-12h"
                          >12h Tak</span
                        >`
                      : html`<span class="sushi-cap-badge standard" data-testid="sushi-cap-badge-8h"
                          >8h Tak</span
                        >`
                  }
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
              ${
                state && state.capMs >= 43_200_000
                  ? html`<div
                      class="sushi-cap-active-indicator"
                      data-testid="sushi-cap-active-badge"
                    >
                      ✨ Ny produktionstid aktiv! (12 timmar max)
                    </div>`
                  : ''
              }
              ${
                isCapped
                  ? html`
                      <div
                        class="sushi-capped-notice"
                        role="status"
                        data-testid="sushi-capped-badge"
                      >
                        ⚠️ Kassan är full (${capHoursStr} timmar) — hämta intäkterna för att
                        återuppta intjäningen.
                      </div>
                    `
                  : ''
              }
            </div>

            ${
              rate.bottleneck !== 'none'
                ? html`
                    <div
                      class="sushi-bottleneck-explainer register-banner"
                      data-testid="sushi-register-bottleneck-explainer"
                    >
                      💡 <strong>Flaskhalsguide:</strong>
                      ${
                        rate.bottleneck === 'kitchen'
                          ? `Köket begränsar intjäningen (${state ? state.kitchenCapacity : 1} ord/min mot ${state ? state.serviceCapacity : 2} ord/min service). Uppgradera kökskapaciteten för att höja takten.`
                          : `Servicen begränsar intjäningen (${state ? state.serviceCapacity : 2} ord/min mot ${state ? state.kitchenCapacity : 1} ord/min kök). Uppgradera transportband eller service för att höja takten.`
                      }
                    </div>
                  `
                : ''
            }
          </div>

          <div class="sushi-register-right">
            <!-- Primär hämtningsknapp (Ticket 04) -->
            <button
              type="button"
              class="sushi-btn-primary sushi-collect-btn pixel-btn ${isCapped ? 'pulse-attention' : ''}"
              data-testid="sushi-collect-btn"
              ?disabled=${displayedUncollectedYen <= 0 || activeController.isCollecting}
              @click=${() => void activeController.collect()}
              aria-label="Hämta ${displayedUncollectedYen} intjänade yen till ditt disponibla saldo"
            >
              ${
                activeController.isCollecting
                  ? html`<span class="sushi-btn-spinner" aria-hidden="true"></span>
                      <span class="sushi-collect-title">Hämtar...</span>`
                  : html`<span class="sr-only">Hämta intäkter ¥ ${displayedUncollectedYen}</span>
                      <span class="sushi-collect-title" aria-hidden="true">Collect Income</span>
                      <strong class="sushi-btn-yen-tag sushi-collect-yen" aria-hidden="true"
                        >¥ ${formatTightComma(displaySalesYen)}</strong
                      >`
              }
            </button>
            <svg
              class="sushi-collect-sparkles"
              viewBox="0 0 48 48"
              width="44"
              height="44"
              aria-hidden="true"
            >
              <polygon points="10,4 38,14 34,20" fill="#fde073" stroke="#9c5a18" stroke-width="2" />
              <polygon points="6,12 36,34 29,39" fill="#f7c844" stroke="#9c5a18" stroke-width="2" />
              <polygon points="2,20 18,44 11,46" fill="#fde073" stroke="#9c5a18" stroke-width="2" />
            </svg>
          </div>

          ${
            activeController.error
              ? html`
                  <div class="sushi-auth-error" role="alert" data-testid="sushi-collect-error">
                    <span>⚠️ ${activeController.error}</span>
                    <button
                      type="button"
                      class="sushi-retry-btn pixel-btn"
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

        <!-- Overlay Bakgrunds-scrim -->
        <div
          class="sushi-overlay-backdrop ${activeController.activeOverlay !== null ? 'is-active' : ''}"
          @click=${() => activeController.closeOverlay()}
          aria-hidden="true"
        ></div>

        <!-- In-Game Pop-up Overlay 1: Kursbelöningar & Upplåsningar (Butik) -->
        <section
          class="sushi-unlocks-panel sushi-overlay-window ${activeController.activeOverlay === 'shop' ? 'is-open' : 'is-closed'}"
          data-testid="sushi-unlocks-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Kursbelöningar och upplåsningar"
          ?data-open=${activeController.activeOverlay === 'shop'}
        >
          <div class="sushi-overlay-header">
            <div class="sushi-unlocks-title-group">
              <h3>Kursbelöningar & Upplåsningar</h3>
              <span class="sushi-unlocks-count-badge" data-testid="sushi-unlocks-count-badge">
                ${unlockedCount} / ${SUSHI_CATALOG.length} upplåsta
              </span>
            </div>
            <button
              type="button"
              class="sushi-overlay-close pixel-btn"
              data-testid="sushi-close-shop-btn"
              @click=${() => activeController.closeOverlay()}
              aria-label="Stäng butiksfönstret"
            >
              ${renderPixelIcon('close')}
            </button>
          </div>

          <div class="sushi-overlay-subbar">
            <!-- Kategorifilter för butikskatalog -->
            <div class="sushi-shop-filters" role="tablist" aria-label="Kategorifilter">
              ${[
                { id: 'all', label: 'Alla' },
                { id: 'kitchen', label: 'Kök' },
                { id: 'service', label: 'Service' },
                { id: 'cap', label: 'Tid' },
                { id: 'recipe', label: 'Recept' },
                { id: 'decoration', label: 'Dekoration' },
              ].map(
                (filter) => html`
                  <button
                    type="button"
                    class="sushi-filter-tab pixel-btn ${activeController.shopCategoryFilter === filter.id ? 'is-active' : ''}"
                    role="tab"
                    data-testid="sushi-filter-${filter.id}"
                    aria-selected="${activeController.shopCategoryFilter === filter.id}"
                    @click=${() => activeController.setShopFilter(filter.id)}
                  >
                    ${filter.label}
                  </button>
                `,
              )}
            </div>
            <p class="sushi-unlocks-intro">
              Dina studieresultat och kapitelmedaljer i Genki låser upp permanenta köpmöjligheter i
              butiken. Upplåsning ger inte gratis föremål, men gör dem tillgängliga att köpa för
              intjänade yen.
            </p>
          </div>

          <div class="sushi-overlay-scroll-body">
            <div class="sushi-unlocks-grid" data-testid="sushi-unlocks-grid">
              ${SUSHI_CATALOG.map((item) => {
                const isOwned = Boolean(state?.inventory && state.inventory.includes(item.id));
                const isUnlocked = Boolean(
                  state?.permanentGrants && state.permanentGrants.includes(item.id),
                );
                const isNew = activeController.recentlyUnlocked.includes(item.id);
                const canAffordItem = Boolean(state && state.balanceUnits >= item.priceUnits);
                const diffUnits = state
                  ? Math.max(0, item.priceUnits - state.balanceUnits)
                  : item.priceUnits;
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

                // Filter check: revenue matches kitchen
                const matchesFilter =
                  activeController.shopCategoryFilter === 'all' ||
                  activeController.shopCategoryFilter === item.category ||
                  (activeController.shopCategoryFilter === 'kitchen' &&
                    item.category === 'revenue');
                const filterClass = matchesFilter ? '' : 'is-filtered-out';

                const preview =
                  !isOwned && state ? previewCatalogPurchase(state, item.id) : undefined;

                return html`
                  <div
                    class="sushi-unlock-card sushi-shop-card pixel-panel ${cardStateClass} ${filterClass}"
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
                      ${
                        isNew
                          ? html`<span
                              class="sushi-pill-new"
                              data-testid="unlock-pill-new-${item.id}"
                              >Ny!</span
                            >`
                          : ''
                      }
                    </div>

                    <p class="sushi-card-desc">${item.effectDescription}</p>

                    ${
                      preview &&
                      (preview.ordersDelta !== 0 ||
                        preview.yenDelta !== 0 ||
                        preview.hasImmediateEffect)
                        ? html`
                            <div
                              class="sushi-upgrade-preview"
                              data-testid="upgrade-preview-${item.id}"
                            >
                              Takt efter köp:
                              <strong>${preview.prospectiveRate.yenPerMinute} ¥/min</strong>
                              (${preview.yenDelta >= 0 ? '+' : ''}${preview.yenDelta} ¥/min)
                            </div>
                          `
                        : ''
                    }
                    ${
                      preview?.isBottleneckLimiting
                        ? html`
                            <div
                              class="sushi-bottleneck-explainer"
                              data-testid="bottleneck-explainer-${item.id}"
                            >
                              💡 ${preview.educationalExplanation}
                            </div>
                          `
                        : ''
                    }

                    <div class="sushi-card-footer">
                      ${
                        isOwned
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
                              <div
                                class="sushi-owned-indicator"
                                data-testid="owned-indicator-${item.id}"
                              >
                                Aktiv i restaurangen
                              </div>
                              <button
                                type="button"
                                class="sushi-btn-buy pixel-btn"
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
                                    Kräver Kapitel ${item.requiredLesson} ${item.requiredTierLabel}
                                    (${item.requiredPercent}%)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  class="sushi-study-link-btn pixel-btn"
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
                                    <span class="sushi-price-hint"
                                      >Pris i butik: ¥ ${item.priceYen}</span
                                    >
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
                                    class="sushi-btn-buy pixel-btn"
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
                                    <span class="sushi-price-hint"
                                      >Pris i butik: ¥ ${item.priceYen}</span
                                    >
                                  </div>
                                  <button
                                    type="button"
                                    class="sushi-btn-buy sushi-btn-primary pixel-btn"
                                    data-testid="buy-btn-${item.id}"
                                    ?disabled=${activeController.isBuying === item.id}
                                    @click=${() => void activeController.buy(item.id)}
                                  >
                                    ${
                                      activeController.isBuying === item.id
                                        ? 'Köper...'
                                        : `Köp för ¥ ${item.priceYen}`
                                    }
                                  </button>
                                `
                      }
                    </div>
                  </div>
                `;
              })}
            </div>
          </div>
        </section>

        <!-- In-Game Pop-up Overlay 2: Meny & Inredning (Personalisering) -->
        <div
          class="sushi-scene-placeholder sushi-overlay-window ${activeController.activeOverlay === 'menu' ? 'is-open' : 'is-closed'}"
          data-testid="sushi-scene-placeholder"
          role="dialog"
          aria-modal="true"
          aria-label="Restaurangens meny och inredning"
          ?data-open=${activeController.activeOverlay === 'menu'}
        >
          <div class="sushi-overlay-header">
            <h3>Restaurangmeny & Inredning</h3>
            <button
              type="button"
              class="sushi-overlay-close pixel-btn"
              data-testid="sushi-close-menu-btn"
              @click=${() => activeController.closeOverlay()}
              aria-label="Stäng menyfönstret"
            >
              ${renderPixelIcon('close')}
            </button>
          </div>

          <div class="sushi-overlay-scroll-body">
            <div class="sushi-scene-badge">🍣 Personlig restaurang i drift</div>
            <p class="sushi-scene-desc">
              Grundrestaurang startad med kökskapacitet ${state ? state.kitchenCapacity : 1} och
              servicekapacitet ${state ? state.serviceCapacity : 2}. Restaurangen sparar automatiskt
              intäkter upp till ${capHoursStr} timmar även när du inte är inloggad.
            </p>
            <div class="sushi-scene-equipment" data-testid="sushi-scene-equipment">
              <section class="sushi-menu" aria-label="Restaurangens meny" data-testid="sushi-menu">
                <h3>På menyn</h3>
                <p>🍙 Klassisk nigiri</p>
                ${SUSHI_CATALOG.filter(
                  (item) => item.category === 'recipe' && state.inventory.includes(item.id),
                ).map(
                  (item) => html`
                    <p data-testid=${`menu-${item.id}`}>
                      <span aria-hidden="true">${item.icon}</span> ${item.name} · Köpt menyvariation
                    </p>
                  `,
                )}
                <small>Menyvariationerna är visuella och ändrar inte intäkterna.</small>
              </section>
              ${
                state?.inventory?.includes('prep_counter')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-prep-counter pixel-panel"
                      data-testid="scene-prep-counter"
                    >
                      🔪 Förbättrad beredningsbänk (+2 kök)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('conveyor_belt')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-conveyor-belt pixel-panel"
                      data-testid="scene-conveyor-belt"
                    >
                      🔄 Transportband (+2 service)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('cap_extension_12h')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-cap-extension pixel-panel"
                      data-testid="scene-cap-extension"
                    >
                      ⏰ 12h Produktionstak
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('precision_knife')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-precision-knife pixel-panel"
                      data-testid="scene-precision_knife"
                    >
                      🔪 Precisionskniv (+1 kök)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('service_counter')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-service-counter pixel-panel"
                      data-testid="scene-service_counter"
                    >
                      🍱 Utökad serveringsdisk (+2 service)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('sous_chef')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-sous-chef pixel-panel"
                      data-testid="scene-sous_chef"
                    >
                      👨‍🍳 Souschef (+2 kök)
                    </div>`
                  : ''
              }
              ${
                state?.inventory?.includes('master_license')
                  ? html`<div
                      class="sushi-scene-equipment-badge scene-master-license pixel-panel"
                      data-testid="scene-master_license"
                    >
                      📜 Mästarcertifiering (+5 ¥/order)
                    </div>`
                  : ''
              }
            </div>
            <section
              class="sushi-decorations"
              aria-label="Dekorationsplatser"
              aria-busy=${activeController.isEquipping}
            >
              <h3>Gör restaurangen personlig</h3>
              <p>
                Köp dekorationer i butiken och välj vad som ska visas här. Dekorationerna påverkar
                inte intäkterna.
              </p>
              <div class="sushi-decoration-slots">
                ${(['wallSlot', 'floorSlot'] as const).map((slot) => {
                  const label = slot === 'wallSlot' ? 'Väggplats' : 'Golvplats';
                  const selected = state.equipped[slot];
                  const item = selected ? getCatalogItem(selected) : undefined;
                  const owned = SUSHI_CATALOG.filter(
                    (entry) =>
                      entry.category === 'decoration' &&
                      entry.slotType === slot &&
                      state.inventory.includes(entry.id),
                  );
                  return html`<div
                    class="sushi-decoration-slot pixel-panel"
                    data-testid=${`decoration-${slot}`}
                  >
                    <div class="sushi-decoration-display" data-testid=${`placed-${slot}`}>
                      <span aria-hidden="true"
                        >${item?.id === 'potted_plant' ? '🌿' : (item?.icon ?? (slot === 'wallSlot' ? '🖼️' : '▫️'))}</span
                      >
                      <strong>${label}: ${item?.name ?? 'Tom plats'}</strong>
                    </div>
                    <details>
                      <summary>Ändra ${label.toLowerCase()}</summary>
                      <div class="sushi-decoration-choices">
                        ${owned.length === 0 ? html`<p>Du äger ännu ingen dekoration för denna plats.</p>` : ''}
                        ${owned.map(
                          (entry) =>
                            html`<button
                              type="button"
                              class="sushi-btn-secondary pixel-btn"
                              aria-pressed=${selected === entry.id}
                              ?disabled=${activeController.isEquipping || activeController.isBuying !== null || activeController.isCollecting}
                              @click=${() => void activeController.equip(slot, entry.id)}
                            >
                              Placera ${entry.name}
                            </button>`,
                        )}
                        <button
                          type="button"
                          class="sushi-btn-secondary pixel-btn"
                          ?disabled=${!selected || activeController.isEquipping || activeController.isBuying !== null || activeController.isCollecting}
                          @click=${() => void activeController.equip(slot, null)}
                        >
                          Ta bort från ${label.toLowerCase()}
                        </button>
                      </div>
                    </details>
                  </div>`;
                })}
              </div>
              ${activeController.isEquipping ? html`<p role="status">Sparar dekorationsval…</p>` : ''}
              ${activeController.equipError ? html`<p role="alert" data-testid="sushi-equip-error">${activeController.equipError}</p>` : ''}
            </section>
          </div>
        </div>

        <!-- Åtgärder och navigation -->
        <div class="sushi-stage-actions">
          <button
            type="button"
            class="sushi-btn-secondary pixel-btn"
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
  const displayName = user ? user.displayName || user.email || 'student' : 'student';

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
            <h1 class="sushi-title" lang="ja">
              <img
                src="/sprites/sushi/ui/topbar_sushi.png"
                alt=""
                aria-hidden="true"
                class="sushi-brand-icon"
              />
              <span class="sushi-brand-text">Sakura Sushi</span>
              <span class="sr-only">🍣 Sushirestaurang</span>
            </h1>
          </div>

          <div class="sushi-topbar-center">
            <div class="sushi-calendar-badge" aria-hidden="true">
              <span class="sushi-cal-day">Day 12</span>
              <span class="sushi-cal-season">Spring 1</span>
            </div>
            <div class="sushi-clock-badge" aria-hidden="true">
              <img src="/sprites/sushi/ui/icon_clock.png" alt="" class="sushi-clock-icon" />
              <span class="sushi-clock-time">12:30</span>
              <img src="/sprites/sushi/ui/icon_sun.png" alt="" class="sushi-sun-icon" />
            </div>
          </div>

          <div class="sushi-topbar-right">
            ${
              isAuthed
                ? html`
                    <button
                      type="button"
                      class="sushi-account-btn logged-in"
                      ?disabled=${host.authBusy}
                      @click=${host.account}
                      title="Inloggad som ${displayName} · Klicka för att logga ut"
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
                      <span class="sushi-logout-hint sr-only">(Logga ut)</span>
                    </button>
                  `
                : html`
                    <button
                      type="button"
                      class="sushi-account-btn pixel-btn"
                      ?disabled=${host.authBusy}
                      @click=${() => (host.onLogin ? host.onLogin() : host.account())}
                    >
                      Logga in
                    </button>
                  `
            }
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
              <img
                src="/sprites/sushi/ui/btn_stats.png"
                alt=""
                aria-hidden="true"
                class="sushi-top-btn-img"
              />
              <span class="sr-only">${host.theme === 'sakura' ? '🍵 Washi' : '🌸 Sakura'}</span>
            </button>
            ${
              isAuthed
                ? html`
                    <button
                      type="button"
                      class="sushi-hud-btn pixel-btn ${activeController.activeOverlay === 'menu' ? 'is-active' : ''}"
                      data-testid="sushi-toggle-menu"
                      @click=${() => activeController.toggleOverlay('menu')}
                      title="Öppna meny och inredning"
                      aria-expanded="${activeController.activeOverlay === 'menu'}"
                      aria-controls="sushi-scene-placeholder"
                    >
                      <img
                        src="/sprites/sushi/ui/btn_menu.png"
                        alt=""
                        aria-hidden="true"
                        class="sushi-top-btn-img"
                      />
                      <span class="sr-only">
                        <span class="sushi-btn-icon" aria-hidden="true"
                          >${renderPixelIcon('menu')}</span
                        >
                        <span>Meny</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      class="sushi-hud-btn pixel-btn ${activeController.activeOverlay === 'shop' ? 'is-active' : ''}"
                      data-testid="sushi-toggle-shop"
                      @click=${() => activeController.toggleOverlay('shop')}
                      title="Öppna butik och upplåsningar"
                      aria-expanded="${activeController.activeOverlay === 'shop'}"
                      aria-controls="sushi-unlocks-panel"
                    >
                      <img
                        src="/sprites/sushi/ui/btn_settings.png"
                        alt=""
                        aria-hidden="true"
                        class="sushi-top-btn-img"
                      />
                      <span class="sr-only">
                        <span class="sushi-btn-icon" aria-hidden="true"
                          >${renderPixelIcon('store')}</span
                        >
                        <span>Butik</span>
                      </span>
                    </button>
                  `
                : ''
            }
            <button
              type="button"
              class="sushi-back-btn"
              data-testid="sushi-back-to-studies"
              @click=${onBackToStudies}
              title="Tillbaka till studierna"
            >
              <img
                src="/sprites/sushi/ui/btn_book.png"
                alt=""
                aria-hidden="true"
                class="sushi-top-btn-img"
              />
              <span class="sr-only">
                <span class="sushi-btn-icon" aria-hidden="true"
                  >${renderPixelIcon('arrow-left')}</span
                >
                <span>← Tillbaka till studierna</span>
              </span>
            </button>
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
