/**
 * The scroller — spec §5, plan phase 1.
 *
 * Explicitly not `scrollIntoView({behavior: 'smooth'})` and not
 * `scrollTo({behavior: 'smooth'})`. The browser picks those durations itself
 * and varies them with distance and with the browser's own heuristics, which is
 * the precise defect this project exists to remove. This scrolls at the
 * profile's px/s, ramping only at the two ends, and a scroll twice as long
 * simply takes twice as long.
 *
 * Positions are computed from elapsed time and written to the container; they
 * are never read back mid-scroll. Reading back would feed the browser's own
 * rounding into the next frame's input and produce visible jitter.
 */

import { animate, displayClock } from './clock.js';
import { rampPlan, distanceAt } from './ramp.js';
import { DEFAULT_PACE } from './pace.js';

/**
 * Adapter over "the thing that scrolls", because the window and an overflowing
 * div do not share an API.
 */
function scrollTargetFor(container) {
  const isWindow = container === undefined || container === globalThis || container?.window === container;
  if (isWindow) {
    const win = container ?? globalThis;
    const doc = win.document;
    return {
      get top() {
        return win.scrollY;
      },
      set top(value) {
        win.scrollTo(win.scrollX, value);
      },
      get max() {
        const el = doc.documentElement;
        return Math.max(0, el.scrollHeight - el.clientHeight);
      },
      get viewportHeight() {
        return doc.documentElement.clientHeight;
      },
      /** An element's viewport-relative top. */
      offsetOf(el) {
        return el.getBoundingClientRect().top;
      },
    };
  }
  return {
    get top() {
      return container.scrollTop;
    },
    set top(value) {
      container.scrollTop = value;
    },
    get max() {
      return Math.max(0, container.scrollHeight - container.clientHeight);
    },
    get viewportHeight() {
      return container.clientHeight;
    },
    offsetOf(el) {
      return el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    },
  };
}

export class Scroller {
  /**
   * @param {Window|HTMLElement} [container]
   * @param {{pace?: typeof DEFAULT_PACE, clock?: import('./clock.js').Clock}} [options]
   */
  constructor(container, { pace = DEFAULT_PACE, clock = displayClock } = {}) {
    this.target = scrollTargetFor(container);
    this.pace = pace;
    this.clock = clock;
  }

  /** Current scroll offset, px from the top. */
  get position() {
    return this.target.top;
  }

  /** The furthest this container can scroll. */
  get max() {
    return this.target.max;
  }

  /**
   * Scroll by a signed delta. Positive is down, matching `scroll down 400`.
   *
   * @param {number} delta px
   * @param {{signal?: AbortSignal, onSample?: (s: {t: number, top: number}) => void}} [options]
   */
  by(delta, options) {
    return this.to(this.position + delta, options);
  }

  /**
   * Scroll to an absolute offset, clamped to what the page can actually do.
   *
   * The clamp happens before the ramp is planned, so a "scroll down 5000" on a
   * page with 300px left takes as long as 300px takes — not as long as 5000px
   * would have, spent mostly stationary at the bottom.
   *
   * @param {number} top px
   * @param {{signal?: AbortSignal, onSample?: (s: {t: number, top: number}) => void}} [options]
   */
  async to(top, { signal, onSample } = {}) {
    const from = this.position;
    const destination = clamp(top, 0, this.max);
    const delta = destination - from;
    const plan = rampPlan(Math.abs(delta), this.pace.scroll.speed, this.pace.scroll.rampMs);
    const direction = Math.sign(delta);

    await animate({
      durationMs: plan.durationMs,
      clock: this.clock,
      signal,
      onFrame: (t) => {
        const value = from + direction * distanceAt(plan, t);
        this.target.top = value;
        onSample?.({ t, top: value });
      },
    });
    this.target.top = destination;
    return { from, to: destination, durationMs: plan.durationMs };
  }

  /**
   * Bring an element to rest at `pace.scroll.restAt` down the viewport — a
   * little above centre, which reads better on video than dead centre.
   *
   * @param {Element} el
   * @param {{signal?: AbortSignal, onSample?: (s: {t: number, top: number}) => void}} [options]
   */
  toElement(el, options) {
    return this.to(this.destinationFor(el), options);
  }

  /**
   * Where `toElement` would scroll to, without scrolling. The executor needs
   * this in phase 2 to decide whether a scroll is needed at all.
   *
   * @param {Element} el
   * @returns {number} px
   */
  destinationFor(el) {
    const rest = this.target.viewportHeight * this.pace.scroll.restAt;
    return clamp(this.position + this.target.offsetOf(el) - rest, 0, this.max);
  }

  /**
   * Is the element already comfortably on screen? Used to skip pointless
   * scrolls, which on video read as a twitch.
   *
   * @param {Element} el
   * @param {number} [marginPx]
   */
  isRestingInView(el, marginPx = 80) {
    const rect = el.getBoundingClientRect();
    const height = this.target.viewportHeight;
    return rect.top >= marginPx && rect.bottom <= height - marginPx;
  }
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
