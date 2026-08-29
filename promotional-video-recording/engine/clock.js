/**
 * Frame loop and delays.
 *
 * Everything that moves goes through `animate`, so there is exactly one place
 * that decides what "a frame" means. The clock is injectable: the engine uses
 * requestAnimationFrame in a page, tests drive a fake clock, and a future
 * offscreen document can drive it from the recorder's frame callback if a run
 * ever needs to be locked to capture rather than to the display.
 *
 * Note the loop is time-driven, not frame-driven: positions are computed from
 * elapsed ms, never accumulated per frame. A dropped frame therefore costs a
 * frame of smoothness, not a shift in speed or duration.
 */

/**
 * @typedef {object} Clock
 * @property {() => number} now              monotonic ms
 * @property {(cb: (t: number) => void) => any} frame   schedule one frame
 * @property {(handle: any) => void} cancel
 */

/** @type {Clock} */
export const displayClock = {
  now: () =>
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(),
  frame: (cb) =>
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(cb)
      : setTimeout(() => cb(displayClock.now()), 16),
  cancel: (handle) =>
    typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame(handle)
      : clearTimeout(handle),
};

export class AbortedError extends Error {
  constructor(message = 'aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * Run `onFrame(elapsedMs)` every frame until `durationMs` has passed. The last
 * call is always at exactly `durationMs`, so a move always lands precisely on
 * its target rather than wherever the final frame happened to fall.
 *
 * @param {object} options
 * @param {number} options.durationMs
 * @param {(elapsedMs: number) => void} options.onFrame
 * @param {AbortSignal} [options.signal]
 * @param {Clock} [options.clock]
 * @returns {Promise<void>}
 */
export function animate({ durationMs, onFrame, signal, clock = displayClock }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortedError());

    const start = clock.now();
    let handle = null;
    let settled = false;

    const cleanup = () => {
      settled = true;
      if (handle !== null) clock.cancel(handle);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      if (settled) return;
      cleanup();
      reject(new AbortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const step = () => {
      if (settled) return;
      const elapsed = clock.now() - start;
      if (elapsed >= durationMs) {
        onFrame(durationMs);
        cleanup();
        resolve();
        return;
      }
      onFrame(elapsed);
      handle = clock.frame(step);
    };

    if (durationMs <= 0) {
      onFrame(0);
      cleanup();
      resolve();
      return;
    }
    onFrame(0);
    handle = clock.frame(step);
  });
}

/**
 * Wait. Used for dwell and for holds; goes through the same clock so a fake
 * clock can run a whole walk in no time at all.
 *
 * @param {number} ms
 * @param {{signal?: AbortSignal, clock?: Clock}} [options]
 * @returns {Promise<void>}
 */
export function delay(ms, { signal, clock = displayClock } = {}) {
  return animate({ durationMs: ms, onFrame: () => {}, signal, clock });
}

/**
 * A clock that advances only when told to. For tests, and for any future
 * headless run of a walk.
 *
 * @param {number} [startAt]
 */
export function fakeClock(startAt = 0) {
  let t = startAt;
  let nextId = 1;
  const pending = new Map();

  return {
    now: () => t,
    frame(cb) {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel(handle) {
      pending.delete(handle);
    },
    /** Advance by `ms` and run every frame callback that was waiting. */
    tick(ms) {
      t += ms;
      const due = [...pending.entries()];
      pending.clear();
      for (const [, cb] of due) cb(t);
    },
    /** Advance in `step` increments until nothing is scheduled or `limit` hit. */
    runAll({ step = 16, limitMs = 600_000 } = {}) {
      let spent = 0;
      while (pending.size > 0 && spent < limitMs) {
        this.tick(step);
        spent += step;
      }
      return spent;
    },
    get pendingCount() {
      return pending.size;
    },
  };
}
