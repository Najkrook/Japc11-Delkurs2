import type { ArenaRuntime } from '../../src/course/multiplayer/arena-runtime.ts';
import type { ArenaStore } from '../../src/course/multiplayer/arena-store.ts';
import type { ArenaRoomDoc } from '../../src/course/multiplayer/arena-types.ts';

export async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Manual clock + seeded RNG adapter. Cancelled callbacks can be captured to model queued work. */
export class ManualArenaRuntime implements ArenaRuntime {
  private time = 10000;
  private seed = 12345;
  private sequence = 0;
  private tasks = new Map<number, { at: number; interval: number; callback: () => void }>();
  randomValue: number | undefined;
  now = () => this.time;
  random = () => {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.randomValue ?? this.seed / 0x100000000;
  };
  every(milliseconds: number, callback: () => void) {
    return this.schedule(milliseconds, milliseconds, callback);
  }
  after(milliseconds: number, callback: () => void) {
    return this.schedule(milliseconds, 0, callback);
  }
  private schedule(delay: number, interval: number, callback: () => void) {
    const id = this.sequence++;
    this.tasks.set(id, { at: this.time + delay, interval, callback });
    return () => {
      this.tasks.delete(id);
    };
  }
  get pendingCount() {
    return this.tasks.size;
  }
  queuedCallbacks() {
    return [...this.tasks.values()].map((task) => task.callback);
  }
  async advance(milliseconds: number): Promise<void> {
    const target = this.time + milliseconds;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      const [id, task] = next;
      this.time = task.at;
      if (task.interval) task.at += task.interval;
      else this.tasks.delete(id);
      task.callback();
      await settle();
    }
    this.time = target;
    await settle();
  }
}

/** Minimal event-driven adapter at the existing ArenaStore seam, with transaction retries. */
export class MemoryArenaStore implements ArenaStore {
  private rooms = new Map<string, ArenaRoomDoc>();
  private watchers = new Map<string, Set<(room: ArenaRoomDoc | null) => void>>();
  private openWatchers = new Set<(rooms: ArenaRoomDoc[]) => void>();
  retryTransitions = false;
  get listenerCount() {
    return (
      this.openWatchers.size + [...this.watchers.values()].reduce((sum, list) => sum + list.size, 0)
    );
  }
  async get(id: string) {
    return structuredClone(this.rooms.get(id) ?? null);
  }
  async change(id: string, update: (room: ArenaRoomDoc | null) => ArenaRoomDoc | null) {
    const before = structuredClone(this.rooms.get(id) ?? null);
    if (this.retryTransitions) update(structuredClone(before));
    const next = update(before);
    if (next) this.rooms.set(id, structuredClone(next));
    else this.rooms.delete(id);
    for (const receive of this.watchers.get(id) ?? []) {
      queueMicrotask(() => receive(structuredClone(next)));
    }
    const open = this.openRooms();
    for (const receive of this.openWatchers) queueMicrotask(() => receive(structuredClone(open)));
    return structuredClone(next);
  }
  watch(id: string, receive: (room: ArenaRoomDoc | null) => void) {
    const watchers = this.watchers.get(id) ?? new Set();
    this.watchers.set(id, watchers);
    watchers.add(receive);
    receive(structuredClone(this.rooms.get(id) ?? null));
    return () => {
      watchers.delete(receive);
    };
  }
  watchOpen(receive: (rooms: ArenaRoomDoc[]) => void) {
    this.openWatchers.add(receive);
    receive(this.openRooms());
    return () => {
      this.openWatchers.delete(receive);
    };
  }
  private openRooms() {
    return structuredClone([...this.rooms.values()].filter((room) => room.status === 'waiting'));
  }
}
