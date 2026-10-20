import type { CourseProgressData, CourseSubView } from './types.ts';
import {
  recordWeekQuizScore,
  selectLatestCourseProgress,
  setCourseActiveWeek,
  setCourseSubView,
  setDojoMastered,
  toggleDojoMistake,
  toggleKanjiMastered,
  toggleVocabMastered,
  toggleVocabMistake,
} from './course-state.ts';

export interface CourseProgressPersistence {
  readLocal(uid: string | null): CourseProgressData;
  writeLocal(uid: string | null, data: CourseProgressData): void;
  // null means an absent document; failed reads must reject.
  readCloud(uid: string): Promise<CourseProgressData | null>;
  writeCloud(uid: string, data: CourseProgressData): Promise<void>;
}

export type CourseProgressCommand =
  | { type: 'week'; weekId: string }
  | { type: 'subview'; subView: CourseSubView }
  | {
      type: 'mastery';
      kind: 'vocab' | 'kanji' | 'dojo';
      id: string;
      mastered: boolean;
      mistake?: boolean;
    }
  | { type: 'mistake'; kind: 'vocab' | 'dojo'; id: string; mistake: boolean }
  | { type: 'quiz'; weekId: string; score: number; total: number };

export type UpdateCourseProgress = (command: CourseProgressCommand) => void;

function apply(data: CourseProgressData, command: CourseProgressCommand, now: number): void {
  switch (command.type) {
    case 'week':
      setCourseActiveWeek(data, command.weekId);
      break;
    case 'subview':
      setCourseSubView(data, command.subView);
      break;
    case 'mastery':
      if (command.kind === 'vocab') {
        toggleVocabMastered(data, command.id, command.mastered);
        if (command.mistake !== undefined) {
          toggleVocabMistake(data, command.id, command.mistake);
        }
      } else if (command.kind === 'kanji') {
        toggleKanjiMastered(data, command.id, command.mastered);
      } else {
        setDojoMastered(data, command.id, command.mastered);
        if (command.mistake !== undefined) {
          toggleDojoMistake(data, command.id, command.mistake);
        }
      }
      break;
    case 'mistake':
      if (command.kind === 'vocab') {
        toggleVocabMistake(data, command.id, command.mistake);
      } else {
        toggleDojoMistake(data, command.id, command.mistake);
      }
      break;
    case 'quiz':
      recordWeekQuizScore(data, command.weekId, command.score, command.total, now);
      break;
  }
}

/** Owns transitions and persistence ordering. Views only read snapshots and issue commands. */
export function createCourseProgress(
  persistence: CourseProgressPersistence,
  resetStudyViews: (weekId?: string) => void,
  now: () => number = Date.now,
) {
  let uid: string | null = null;
  let data = persistence.readLocal(uid);
  let sessionBaseline = structuredClone(data);
  let generation = 0;
  let hydrated = true;
  let loading: Promise<void> | undefined;
  let pending: { command: CourseProgressCommand; at: number }[] = [];
  const listeners = new Set<() => void>();
  const writes = new Map<string, Promise<void>>();
  const notify = () => listeners.forEach((listener) => listener());
  const saveLocal = () => persistence.writeLocal(uid, structuredClone(data));

  function saveCloud(userId: string): void {
    const snapshot = structuredClone(data);
    // Serialize immutable snapshots, including when the user leaves and returns.
    const write = (writes.get(userId) ?? Promise.resolve())
      .then(() => persistence.writeCloud(userId, snapshot))
      .catch(() => {
        /* Local progress remains available on the next login. */
      });
    writes.set(userId, write);
  }

  function useUser(userId?: string | null): Promise<void> {
    const nextUid = userId || null;
    if (nextUid !== uid) {
      uid = nextUid;
      generation++;
      const currentActiveWeekId = data.activeWeekId;
      const currentActiveSubView = data.activeSubView;
      data = persistence.readLocal(uid);
      if (currentActiveSubView && currentActiveSubView !== 'hub') {
        data.activeSubView = currentActiveSubView;
      }
      if (currentActiveWeekId && currentActiveWeekId !== 'week-1') {
        data.activeWeekId = currentActiveWeekId;
      }
      sessionBaseline = structuredClone(data);
      pending = [];
      loading = undefined;
      hydrated = !uid;
      resetStudyViews();
      notify();
    }
    if (hydrated || !uid) return Promise.resolve();
    if (loading) return loading;
    const userToLoad = uid;
    const startedGeneration = generation;
    const baseline = structuredClone(sessionBaseline);
    loading = (async () => {
      try {
        await writes.get(userToLoad);
        const cloud = await persistence.readCloud(userToLoad);
        if (generation !== startedGeneration) return;
        const before = data;
        data = cloud ? selectLatestCourseProgress(baseline, cloud) : baseline;
        for (const edit of pending) apply(data, edit.command, edit.at);
        if (pending.length) data.updatedAt = Math.max(now(), data.updatedAt + 1, before.updatedAt);
        hydrated = true;
        sessionBaseline = structuredClone(data);
        if (
          before.activeWeekId !== data.activeWeekId ||
          before.activeSubView !== data.activeSubView
        ) {
          resetStudyViews(data.activeWeekId);
        }
        saveLocal();
        if (pending.length || !cloud || baseline.updatedAt > cloud.updatedAt) saveCloud(userToLoad);
        pending = [];
        notify();
      } catch {
        // Do not mistake an unavailable cloud profile for an empty one and overwrite it.
        // Keep local edits; another useUser call can retry this session.
      } finally {
        if (generation === startedGeneration) loading = undefined;
      }
    })();
    return loading;
  }

  return {
    snapshot: (): CourseProgressData => structuredClone(data),
    useUser,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(command: CourseProgressCommand): void {
      const at = Math.max(now(), data.updatedAt + 1);
      apply(data, command, at);
      data.updatedAt = at;
      if (command.type === 'week') resetStudyViews(command.weekId);
      if (!hydrated) pending.push({ command: structuredClone(command), at });
      saveLocal();
      if (uid && hydrated) saveCloud(uid);
      else if (uid) void useUser(uid);
      notify();
    },
  };
}
