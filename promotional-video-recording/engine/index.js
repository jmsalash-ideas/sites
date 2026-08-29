/**
 * The motion engine — plan phase 1.
 *
 * Assembles the overlay, the cursor, the scroller and the highlight against one
 * pace profile, and exposes the handful of motions everything above it is built
 * from. It knows nothing about walks, commands, targeting by text or recording:
 * phase 2's executor is what turns `walk.json` into calls on this.
 *
 * The one composite it does provide is `pointAt`, because "scroll it into view
 * at pace, then move the cursor to it at pace" is a motion decision rather than
 * an executor decision, and every action in phase 2 starts with it.
 */

import { mountOverlay } from './overlay.js';
import { Cursor } from './cursor.js';
import { Scroller } from './scroller.js';
import { Highlight } from './highlight.js';
import { delay, displayClock } from './clock.js';
import { paceProfile, DEFAULT_PACE } from './pace.js';

export { paceProfile, DEFAULT_PACE } from './pace.js';
export { mountOverlay, currentOverlay, OVERLAY_HOST_ID } from './overlay.js';
export { rampPlan, distanceAt, speedAt, durationFor } from './ramp.js';
export { arcPath } from './path.js';
export { Cursor } from './cursor.js';
export { Scroller } from './scroller.js';
export { Highlight, dimRects } from './highlight.js';
export { animate, delay, fakeClock, displayClock, AbortedError } from './clock.js';

export class MotionEngine {
  /**
   * @param {object} [options]
   * @param {typeof DEFAULT_PACE} [options.pace]
   * @param {Document} [options.doc]
   * @param {Window|HTMLElement} [options.scrollContainer]
   * @param {import('./clock.js').Clock} [options.clock]
   */
  constructor({ pace = DEFAULT_PACE, doc = document, scrollContainer, clock = displayClock } = {}) {
    this.pace = pace;
    this.clock = clock;
    this.overlay = mountOverlay(doc);
    this.cursor = new Cursor(this.overlay, { pace, clock });
    this.scroller = new Scroller(scrollContainer ?? doc.defaultView, { pace, clock });
    this.highlight = new Highlight(this.overlay, { pace, clock });

    /** Aborting this stops every motion in flight. Takeover uses it in phase 5. */
    this.controller = new AbortController();
  }

  get signal() {
    return this.controller.signal;
  }

  /**
   * Swap the pace profile on a live engine. This is phase 1's "done when":
   * change one number and everything after this point is re-timed, with no
   * re-record and no reload.
   *
   * @param {typeof DEFAULT_PACE} pace
   */
  setPace(pace) {
    this.pace = pace;
    this.cursor.pace = pace;
    this.scroller.pace = pace;
    this.highlight.pace = pace;
    this.highlight.applyPace(pace);
  }

  /** Bring the cursor on screen at the start of a run. */
  async begin({ x, y } = {}) {
    const viewport = this.overlay.viewport();
    this.cursor.placeAt(x ?? viewport.width / 2, y ?? viewport.height * 0.62);
    await this.cursor.show({ signal: this.signal });
  }

  /** Take the cursor off screen. Takeover and end-of-run both use it. */
  async end() {
    await this.cursor.hide({ signal: this.signal });
  }

  /**
   * Scroll the element into view if it is not comfortably there already, then
   * move the cursor onto it. The `point` command, and the opening move of every
   * other command.
   *
   * @param {Element} el
   * @param {{signal?: AbortSignal, onSample?: Function, offset?: {x: number, y: number}}} [options]
   */
  async pointAt(el, { signal = this.signal, onSample, offset } = {}) {
    if (!this.scroller.isRestingInView(el)) {
      await this.scroller.toElement(el, { signal, onSample });
      // The highlight, if one is up, is now pointing at the wrong place.
      if (this.highlight.visible) this.highlight.reposition();
    }
    const rect = el.getBoundingClientRect();
    const target = {
      x: rect.left + rect.width / 2 + (offset?.x ?? 0),
      y: rect.top + rect.height / 2 + (offset?.y ?? 0),
    };
    await this.cursor.moveTo(target.x, target.y, { signal, onSample });
    return target;
  }

  /**
   * Point at an element and play the click gesture. Phase 1 draws the click;
   * `onPress` is where phase 2 will dispatch the actual event, at the bottom of
   * the press where a real click would land.
   *
   * @param {Element} el
   * @param {{signal?: AbortSignal, onPress?: () => void, onSample?: Function}} [options]
   */
  async clickAt(el, { signal = this.signal, onPress, onSample } = {}) {
    await this.pointAt(el, { signal, onSample });
    await this.cursor.press({ signal, onPress });
  }

  /** The fixed pause after an action. */
  dwell({ signal = this.signal } = {}) {
    return delay(this.pace.dwellMs, { signal, clock: this.clock });
  }

  /** Stop everything in flight. */
  abort() {
    this.controller.abort();
    this.controller = new AbortController();
  }

  destroy() {
    this.controller.abort();
    this.cursor.destroy();
    this.highlight.destroy();
    this.overlay.destroy();
  }
}

/**
 * @param {ConstructorParameters<typeof MotionEngine>[0]} [options]
 * @returns {MotionEngine}
 */
export function createEngine(options) {
  return new MotionEngine({ ...options, pace: options?.pace ?? paceProfile() });
}
