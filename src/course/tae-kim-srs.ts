import type { TaeKimArc } from './data/taeKimData.ts';

export type TaeKimReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface TaeKimCardProgress {
  cardIndex: number;
  easeFactor: number; // default 2.5, min 1.3
  interval: number; // in days (can be fractional for initial learning)
  repetitions: number;
  nextReviewDate: number; // timestamp ms
  lastReviewedDate?: number;
  status: 'new' | 'learning' | 'review' | 'mastered';
  consecutiveCorrect: number;
  totalReviews: number;
  totalErrors: number;
  lapses: number;
}

export interface TaeKimSrsState {
  cardProgress: Record<number, TaeKimCardProgress>;
  arcPositions: Record<string, number>;
  arcWeakCards: Record<string, Record<number, boolean>>;
  completedChapters: Record<number, boolean>;
  bookmarks: Record<number, boolean>;
  autoPlayAudio: boolean;
  updatedAt: number;
}

const STORAGE_KEY = 'japc11_taekim_srs_v1';

function createFreshState(): TaeKimSrsState {
  return {
    cardProgress: {},
    arcPositions: {},
    arcWeakCards: {},
    completedChapters: {},
    bookmarks: {},
    autoPlayAudio: true,
    updatedAt: 0,
  };
}

class TaeKimSrsService {
  private state: TaeKimSrsState;

  constructor() {
    this.state = this.loadFromStorage();
  }

  private loadFromStorage(): TaeKimSrsState {
    if (typeof localStorage === 'undefined') return createFreshState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createFreshState();
      const parsed = JSON.parse(raw);
      return {
        cardProgress: parsed.cardProgress || {},
        arcPositions: parsed.arcPositions || {},
        arcWeakCards: parsed.arcWeakCards || {},
        completedChapters: parsed.completedChapters || {},
        bookmarks: parsed.bookmarks || {},
        autoPlayAudio: parsed.autoPlayAudio !== undefined ? parsed.autoPlayAudio : true,
        updatedAt: parsed.updatedAt || 0,
      };
    } catch {
      return createFreshState();
    }
  }

  public save(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      this.state.updatedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore quota errors
    }
  }

  public getState(): TaeKimSrsState {
    return this.state;
  }

  public getCardProgress(cardIndex: number): TaeKimCardProgress | undefined {
    return this.state.cardProgress[cardIndex];
  }

  public calculateNextIntervals(
    current?: TaeKimCardProgress,
  ): Record<TaeKimReviewRating, { days: number; label: string }> {
    if (!current || current.repetitions === 0) {
      return {
        again: { days: 0, label: '< 10m' },
        hard: { days: 1, label: '1d' },
        good: { days: 1, label: '1d' },
        easy: { days: 3, label: '3d' },
      };
    }

    if (current.repetitions === 1) {
      return {
        again: { days: 0, label: '< 10m' },
        hard: { days: 2, label: '2d' },
        good: { days: 3, label: '3d' },
        easy: { days: 6, label: '6d' },
      };
    }

    const hardDays = Math.max(1, Math.round(current.interval * 1.2));
    const goodDays = Math.max(1, Math.round(current.interval * (current.easeFactor || 2.5)));
    const easyDays = Math.max(1, Math.round(current.interval * (current.easeFactor || 2.5) * 1.3));

    const formatDays = (d: number) => {
      if (d >= 30) {
        const m = Math.round(d / 30);
        return `${m}mån`;
      }
      return `${d}d`;
    };

    return {
      again: { days: 0, label: '< 10m' },
      hard: { days: hardDays, label: formatDays(hardDays) },
      good: { days: goodDays, label: formatDays(goodDays) },
      easy: { days: easyDays, label: formatDays(easyDays) },
    };
  }

  public getArcPosition(arcId: string): number {
    return this.state.arcPositions[arcId] || 0;
  }

  public setArcPosition(arcId: string, position: number): void {
    this.state.arcPositions[arcId] = Math.max(0, position);
    this.save();
  }

  public resetArcPosition(arcId: string): void {
    this.state.arcPositions[arcId] = 0;
    this.save();
  }

  public getArcWeakCardIndices(arcId: string): number[] {
    const map = this.state.arcWeakCards[arcId];
    if (!map) return [];
    return Object.keys(map)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }

  public addArcWeakCard(arcId: string, cardIndex: number): void {
    if (!this.state.arcWeakCards[arcId]) {
      this.state.arcWeakCards[arcId] = {};
    }
    this.state.arcWeakCards[arcId][cardIndex] = true;
    this.save();
  }

  public removeArcWeakCard(arcId: string, cardIndex: number): void {
    if (this.state.arcWeakCards[arcId]) {
      delete this.state.arcWeakCards[arcId][cardIndex];
      this.save();
    }
  }

  public reviewCard(
    cardIndex: number,
    rating: TaeKimReviewRating,
    arcIdOrNow?: string | number,
    maybeNow?: number,
  ): TaeKimCardProgress {
    let arcId: string | undefined;
    let now: number = Date.now();
    if (typeof arcIdOrNow === 'number') {
      now = arcIdOrNow;
    } else if (typeof arcIdOrNow === 'string') {
      arcId = arcIdOrNow;
      if (typeof maybeNow === 'number') {
        now = maybeNow;
      }
    }
    const existing = this.state.cardProgress[cardIndex];
    const base: TaeKimCardProgress = existing
      ? { ...existing }
      : {
          cardIndex,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewDate: now,
          status: 'new',
          consecutiveCorrect: 0,
          totalReviews: 0,
          totalErrors: 0,
          lapses: 0,
        };

    base.lastReviewedDate = now;
    base.totalReviews += 1;

    let quality = 4;
    switch (rating) {
      case 'again':
        quality = 1;
        break;
      case 'hard':
        quality = 3;
        break;
      case 'good':
        quality = 4;
        break;
      case 'easy':
        quality = 5;
        break;
    }

    if (quality < 3) {
      if (arcId) {
        this.addArcWeakCard(arcId, cardIndex);
      }
      if (base.status === 'review' || base.status === 'mastered') {
        base.lapses += 1;
      }
      base.consecutiveCorrect = 0;
      base.repetitions = 0;
      base.interval = 10 / 1440; // ~10 minutes
      base.nextReviewDate = now + 10 * 60 * 1000;
      base.status = 'learning';
      base.totalErrors += 1;
      base.easeFactor = Math.max(1.3, base.easeFactor - 0.2);
    } else {
      if (arcId) {
        this.removeArcWeakCard(arcId, cardIndex);
      }
      base.consecutiveCorrect += 1;

      if (base.repetitions === 0) {
        base.interval = rating === 'easy' ? 3 : 1;
      } else if (base.repetitions === 1) {
        base.interval = rating === 'easy' ? 6 : rating === 'hard' ? 2 : 3;
      } else {
        if (rating === 'hard') {
          base.interval = Math.max(1, Math.round(base.interval * 1.2));
        } else if (rating === 'good') {
          base.interval = Math.max(1, Math.round(base.interval * base.easeFactor));
        } else {
          base.interval = Math.max(1, Math.round(base.interval * base.easeFactor * 1.3));
        }
      }

      base.repetitions += 1;
      base.nextReviewDate = now + Math.round(base.interval * 24 * 60 * 60 * 1000);
      base.status = base.interval >= 21 ? 'mastered' : 'review';

      // SuperMemo-2 ease factor delta
      const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
      base.easeFactor = Math.max(1.3, base.easeFactor + delta);
    }

    this.state.cardProgress[cardIndex] = base;
    this.save();
    return base;
  }

  public toggleBookmark(cardIndex: number): boolean {
    const isSaved = Boolean(this.state.bookmarks[cardIndex]);
    if (isSaved) {
      delete this.state.bookmarks[cardIndex];
    } else {
      this.state.bookmarks[cardIndex] = true;
    }
    this.save();
    return !isSaved;
  }

  public isBookmarked(cardIndex: number): boolean {
    return Boolean(this.state.bookmarks[cardIndex]);
  }

  public markChapterCompleted(chapterIndex: number, completed: boolean = true): void {
    if (completed) {
      this.state.completedChapters[chapterIndex] = true;
    } else {
      delete this.state.completedChapters[chapterIndex];
    }
    this.save();
  }

  public isChapterCompleted(chapterIndex: number): boolean {
    return Boolean(this.state.completedChapters[chapterIndex]);
  }

  public toggleAutoPlay(): boolean {
    this.state.autoPlayAudio = !this.state.autoPlayAudio;
    this.save();
    return this.state.autoPlayAudio;
  }

  public getDueCardIndices(): number[] {
    const now = Date.now();
    return Object.values(this.state.cardProgress)
      .filter((p) => p.nextReviewDate <= now)
      .map((p) => p.cardIndex)
      .sort((a, b) => a - b);
  }

  public getWeakCardIndices(): number[] {
    return Object.values(this.state.cardProgress)
      .filter((p) => p.totalErrors > 0 || p.lapses > 0)
      .sort((a, b) => b.totalErrors + b.lapses - (a.totalErrors + a.lapses))
      .map((p) => p.cardIndex);
  }

  public getArcStats(arc: TaeKimArc): {
    currentPosition: number;
    totalCards: number;
    weakCount: number;
    masteredCards: number;
    learningCards: number;
    progressPercent: number;
  } {
    const currentPosition = this.getArcPosition(arc.id);
    const weakCount = this.getArcWeakCardIndices(arc.id).length;
    const startCard = arc.startChapterIndex * 10;
    const endCard = (arc.endChapterIndex + 1) * 10;
    let masteredCards = 0;
    let learningCards = 0;

    for (let i = startCard; i < endCard; i++) {
      const p = this.state.cardProgress[i];
      if (p) {
        if (p.status === 'mastered') masteredCards++;
        else if (p.status === 'review' || p.status === 'learning') learningCards++;
      }
    }

    const progressPercent = Math.min(
      100,
      Math.round((currentPosition / Math.max(1, arc.totalCards)) * 100),
    );

    return {
      currentPosition,
      totalCards: arc.totalCards,
      weakCount,
      masteredCards,
      learningCards,
      progressPercent,
    };
  }

  public getOverallStats(): {
    totalReviewed: number;
    totalMastered: number;
    totalCompletedChapters: number;
    dueToday: number;
    bookmarkedCount: number;
  } {
    const cards = Object.values(this.state.cardProgress);
    const now = Date.now();
    let totalMastered = 0;
    let dueToday = 0;

    for (const c of cards) {
      if (c.status === 'mastered') totalMastered++;
      if (c.nextReviewDate <= now) dueToday++;
    }

    return {
      totalReviewed: cards.length,
      totalMastered,
      totalCompletedChapters: Object.keys(this.state.completedChapters).length,
      dueToday,
      bookmarkedCount: Object.keys(this.state.bookmarks).length,
    };
  }
}

export const taeKimSrs = new TaeKimSrsService();
