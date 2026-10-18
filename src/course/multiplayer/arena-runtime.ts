/** Internal seam for the Arena Match clock, scheduling and randomness. */
export interface ArenaRuntime {
  now(): number;
  random(): number;
  every(milliseconds: number, callback: () => void): () => void;
  after(milliseconds: number, callback: () => void): () => void;
}

export const systemArenaRuntime: ArenaRuntime = {
  now: () => Date.now(),
  random: () => Math.random(),
  every(milliseconds, callback) {
    const timer = setInterval(callback, milliseconds);
    return () => clearInterval(timer);
  },
  after(milliseconds, callback) {
    const timer = setTimeout(callback, milliseconds);
    return () => clearTimeout(timer);
  },
};
