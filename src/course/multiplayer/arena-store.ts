import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  where,
  FieldPath,
  deleteField,
  type Firestore,
} from 'firebase/firestore';
import { db } from '../../cloud.ts';
import type { ArenaRoomDoc } from './arena-types.ts';

export interface ArenaStore {
  get(id: string): Promise<ArenaRoomDoc | null>;
  change(
    id: string,
    update: (room: ArenaRoomDoc | null) => ArenaRoomDoc | null,
  ): Promise<ArenaRoomDoc | null>;
  watch(id: string, receive: (room: ArenaRoomDoc | null) => void, error: () => void): () => void;
  watchOpen(receive: (rooms: ArenaRoomDoc[]) => void, error: () => void): () => void;
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  path: string[] = [],
): Array<{ field: FieldPath; value: unknown }> {
  const result: Array<{ field: FieldPath; value: unknown }> = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const previous = before[key];
    const next = after[key];
    const child = [...path, key];
    if (!(key in after)) {
      result.push({ field: new FieldPath(...child), value: deleteField() });
    } else if (
      next &&
      typeof next === 'object' &&
      !Array.isArray(next) &&
      ((previous && typeof previous === 'object' && !Array.isArray(previous)) ||
        (path.length === 0 && (key === 'players' || key === 'roundAnswers')) ||
        (path.length === 1 && path[0] === 'roundAnswers'))
    ) {
      result.push(
        ...changedFields(
          (previous && typeof previous === 'object' && !Array.isArray(previous)
            ? previous
            : {}) as Record<string, unknown>,
          next as Record<string, unknown>,
          child,
        ),
      );
    } else if (JSON.stringify(previous) !== JSON.stringify(next)) {
      result.push({ field: new FieldPath(...child), value: next });
    }
  }
  return result;
}

export function createCloudArenaStore(database: Firestore): ArenaStore {
  return {
    async get(id) {
      const snap = await getDoc(doc(database, 'courseRooms', id));
      return snap.exists() ? (snap.data() as ArenaRoomDoc) : null;
    },
    async change(id, update) {
      const ref = doc(database, 'courseRooms', id);
      return runTransaction(database, async (tx) => {
        const snap = await tx.get(ref);
        const previous = snap.exists() ? snap.data() : null;
        const next = update(previous ? (structuredClone(previous) as ArenaRoomDoc) : null);
        if (next && previous) {
          // Patch only changed fields. A stale whole-document write can be denied by
          // ownership rules before Firestore gets a chance to retry the transaction.
          const fields = changedFields(previous, next as unknown as Record<string, unknown>);
          if (fields.length)
            tx.update(
              ref,
              fields[0].field,
              fields[0].value,
              ...fields.slice(1).flatMap((entry) => [entry.field, entry.value]),
            );
        } else if (next) tx.set(ref, next);
        else if (snap.exists()) tx.delete(ref);
        return next;
      });
    },
    watch(id, receive, error) {
      return onSnapshot(
        doc(database, 'courseRooms', id),
        (snap) => receive(snap.exists() ? (snap.data() as ArenaRoomDoc) : null),
        error,
      );
    },
    watchOpen(receive, error) {
      return onSnapshot(
        query(collection(database, 'courseRooms'), where('status', '==', 'waiting'), limit(12)),
        (snap) => receive(snap.docs.map((d) => d.data() as ArenaRoomDoc)),
        error,
      );
    },
  };
}
export const cloudArenaStore = createCloudArenaStore(db);

// Guest rooms never share the cloud cache. All tabs lock the same map before writing.
const LOCAL_KEY = 'japc11-course-arena-local-v2';
function readRooms(): Record<string, ArenaRoomDoc> {
  if (typeof localStorage === 'undefined') return {};
  return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
}

export const localArenaStore: ArenaStore = {
  async get(id) {
    return readRooms()[id] || null;
  },
  async change(id, update) {
    const apply = () => {
      const rooms = readRooms();
      const next = update(rooms[id] || null);
      if (next) rooms[id] = next;
      else delete rooms[id];
      if (typeof localStorage !== 'undefined')
        localStorage.setItem(LOCAL_KEY, JSON.stringify(rooms));
      return next;
    };
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(LOCAL_KEY, apply);
    }
    // Node tests run synchronously here; browsers need cross-tab locking.
    if (typeof window !== 'undefined') throw new Error('Web Locks saknas i denna webbläsare.');
    return apply();
  },
  watch(id, receive, error) {
    // Polling includes same-tab changes and deletions, unlike the storage event.
    let previous = '';
    const tick = () => {
      try {
        const room = readRooms()[id] || null;
        const encoded = JSON.stringify(room);
        if (encoded === previous) return;
        previous = encoded;
        receive(room);
      } catch {
        error();
      }
    };
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  },
  watchOpen(receive, error) {
    let previous = '';
    const tick = () => {
      try {
        const rooms = Object.values(readRooms()).filter((r) => r.status === 'waiting');
        const encoded = JSON.stringify(rooms);
        if (encoded === previous) return;
        previous = encoded;
        receive(rooms);
      } catch {
        error();
      }
    };
    queueMicrotask(tick);
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  },
};
