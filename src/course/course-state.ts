import type { CourseProgressData, CourseSubView, CourseWeek } from './types.ts';

export function courseStorageKey(uid?: string | null): string {
  return `japc11-dk2-course-v1-${uid || 'guest'}`;
}

export function createFreshCourseProgress(): CourseProgressData {
  return {
    activeWeekId: 'week-1',
    activeSubView: 'hub',
    masteredVocabIds: {},
    masteredKanjiIds: {},
    masteredDojoIds: {},
    quizBestResults: {},
    updatedAt: 0,
  };
}

export function readCourseProgress(
  storage: Pick<Storage, 'getItem'> | undefined,
  uid?: string | null,
): CourseProgressData {
  if (!storage) return createFreshCourseProgress();
  try {
    const raw =
      storage.getItem(courseStorageKey(uid)) ||
      storage.getItem(`tentaplugg-course-v1-${uid || 'guest'}`);
    if (!raw) return createFreshCourseProgress();
    const parsed = JSON.parse(raw) as Partial<CourseProgressData>;
    return {
      ...createFreshCourseProgress(),
      ...parsed,
      masteredVocabIds: { ...(parsed.masteredVocabIds || {}) },
      masteredKanjiIds: { ...(parsed.masteredKanjiIds || {}) },
      masteredDojoIds: { ...(parsed.masteredDojoIds || {}) },
      quizBestResults: { ...(parsed.quizBestResults || {}) },
    };
  } catch {
    return createFreshCourseProgress();
  }
}

export function saveCourseProgress(
  storage: Pick<Storage, 'setItem'> | undefined,
  uid: string | null | undefined,
  data: CourseProgressData,
): void {
  if (!storage) return;
  try {
    data.updatedAt = Date.now();
    storage.setItem(courseStorageKey(uid), JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export interface WeekProgressSummary {
  vocabDone: number;
  vocabTotal: number;
  kanjiDone: number;
  kanjiTotal: number;
  dojoDone: number;
  dojoTotal: number;
  quizScore: number | null;
  quizTotal: number;
  overallPercent: number;
}

export function getWeekProgressSummary(
  progress: CourseProgressData,
  week: CourseWeek,
): WeekProgressSummary {
  const vocabTotal = week.vocab.length;
  const vocabDone = week.vocab.filter((v) => progress.masteredVocabIds[v.id]).length;

  const kanjiTotal = week.kanji.length;
  const kanjiDone = week.kanji.filter((k) => progress.masteredKanjiIds[k.id]).length;

  const dojoTotal = week.conjugations.length;
  const dojoDone = week.conjugations.filter((c) => progress.masteredDojoIds[c.id]).length;

  const quizBest = progress.quizBestResults[week.id];
  const quizTotal = week.quiz.length;
  const quizScore = quizBest ? quizBest.score : null;

  const totalItems = vocabTotal + kanjiTotal + dojoTotal + quizTotal;
  const completedItems =
    vocabDone + kanjiDone + dojoDone + (quizBest ? Math.min(quizTotal, quizBest.score) : 0);

  const overallPercent =
    totalItems > 0 ? Math.min(100, Math.round((completedItems / totalItems) * 100)) : 0;

  return {
    vocabDone,
    vocabTotal,
    kanjiDone,
    kanjiTotal,
    dojoDone,
    dojoTotal,
    quizScore,
    quizTotal,
    overallPercent,
  };
}

export function setCourseActiveWeek(
  progress: CourseProgressData,
  weekId: string,
): CourseProgressData {
  progress.activeWeekId = weekId;
  progress.activeSubView = 'hub';
  return progress;
}

export function setCourseSubView(
  progress: CourseProgressData,
  subView: CourseSubView,
): CourseProgressData {
  progress.activeSubView = subView;
  return progress;
}

export function toggleVocabMastered(
  progress: CourseProgressData,
  vocabId: string,
  forceValue?: boolean,
): boolean {
  const next = forceValue !== undefined ? forceValue : !progress.masteredVocabIds[vocabId];
  if (next) {
    progress.masteredVocabIds[vocabId] = true;
  } else {
    delete progress.masteredVocabIds[vocabId];
  }
  return next;
}

export function toggleKanjiMastered(
  progress: CourseProgressData,
  kanjiId: string,
  forceValue?: boolean,
): boolean {
  const next = forceValue !== undefined ? forceValue : !progress.masteredKanjiIds[kanjiId];
  if (next) {
    progress.masteredKanjiIds[kanjiId] = true;
  } else {
    delete progress.masteredKanjiIds[kanjiId];
  }
  return next;
}

export function setDojoMastered(
  progress: CourseProgressData,
  conjId: string,
  mastered: boolean,
): void {
  if (mastered) {
    progress.masteredDojoIds[conjId] = true;
  } else {
    delete progress.masteredDojoIds[conjId];
  }
}

export function recordWeekQuizScore(
  progress: CourseProgressData,
  weekId: string,
  score: number,
  total: number,
  now = Date.now(),
): void {
  const prev = progress.quizBestResults[weekId];
  if (!prev || score >= prev.score) {
    progress.quizBestResults[weekId] = {
      score,
      total,
      completedAt: now,
    };
  }
}

// The newest complete snapshot wins, including explicit removals from its maps.
export function selectLatestCourseProgress(
  local: CourseProgressData,
  cloud: CourseProgressData,
): CourseProgressData {
  const selected = (cloud.updatedAt || 0) >= (local.updatedAt || 0) ? cloud : local;
  return structuredClone({
    ...createFreshCourseProgress(),
    ...selected,
    masteredVocabIds: selected.masteredVocabIds || {},
    masteredKanjiIds: selected.masteredKanjiIds || {},
    masteredDojoIds: selected.masteredDojoIds || {},
    quizBestResults: selected.quizBestResults || {},
  });
}
