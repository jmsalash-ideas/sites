/**
 * The synthetic cursor — spec §5, plan phase 1.
 *
 * Tab capture does not record the OS pointer, so the cursor in the video is
 * entirely ours. That is the point, twice over: it moves at a constant px/s and
 * never jitters, and the real mouse can sit untouched for the whole run.
 *
 * Everything here is viewport coordinates. Nothing here reads the pace profile
 * for anything other than its own five constants.
 */

import { animate, delay, displayClock } from './clock.js';
import { rampPlan, distanceAt } from './ramp.js';
import { arcPath } from './path.js';
import { easeOutCubic, smoothstep } from './easing.js';
import { DEFAULT_PACE } from './pace.js';

// A plain arrow, drawn once as an inline SVG so no network fetch can stall a
// run and no page CSS can restyle it. The hotspot is the tip, at (0,0).
const CURSOR_SVG = `
<svg width="28" height="30" viewBox="0 0 28 30" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 1.6 L2 25.2 L8.1 19.4 L12.1 28.2 L16.4 26.2 L12.4 17.6 L20.8 17.2 Z"
        fill="#ffffff" stroke="#12161c" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

const CURSOR_CSS = `
  position: absolute;
  top: 0;
  left: 0;
  width: 28px;
  height: 30px;
  transform-origin: 3px 3px;
  will-change: transform, opacity;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
  opacity: 0;
`;

export class Cursor {
  /**
   * @param {import('./overlay.js').Overlay} overlay
   * @param {object} [options]
   * @param {typeof DEFAULT_PACE} [options.pace]
   * @param {import('./clock.js').Clock} [options.clock]
   */
  constructor(overlay, { pace = DEFAULT_PACE, clock = displayClock } = {}) {
    this.overlay = overlay;
    this.pace = pace;
    this.clock = clock;

    const doc = overlay.host.ownerDocument;
    this.el = doc.createElement('div');
    this.el.style.cssText = CURSOR_CSS;
    this.el.innerHTML = CURSOR_SVG;
    overlay.cursorLayer.append(this.el);

    const { width, height } = overlay.viewport();
    /** @type {{x: number, y: number}} */
    this.position = { x: width / 2, y: height * 0.6 };
    this.scale = 1;
    this.opacity = 0;
    this.visible = false;
    this.#paint();
  }

  /** Where the cursor is, in viewport coordinates. */
  get at() {
    return { ...this.position };
  }

  /** Put the cursor somewhere with no animation. Used to set up a run. */
  placeAt(x, y) {
    this.position = { x, y };
    this.#paint();
  }

  /**
   * Move to a point at the profile's constant speed, easing only at the ends.
   *
   * @param {number} x viewport px
   * @param {number} y viewport px
   * @param {{signal?: AbortSignal, onSample?: (s: {t: number, x: number, y: number}) => void}} [options]
   */
  async moveTo(x, y, { signal, onSample } = {}) {
    const from = this.at;
    const to = { x, y };
    const path = arcPath(from, to, {
      arc: this.pace.cursor.arc,
      arcMaxPx: this.pace.cursor.arcMaxPx,
    });
    const plan = rampPlan(path.length, this.pace.cursor.speed, this.pace.cursor.rampMs);

    await animate({
      durationMs: plan.durationMs,
      clock: this.clock,
      signal,
      onFrame: (t) => {
        const point = path.at(distanceAt(plan, t));
        this.position = point;
        this.#paint();
        onSample?.({ t, x: point.x, y: point.y });
      },
    });
    // Land exactly on the target: the path LUT is an approximation, the
    // destination is not.
    this.position = to;
    this.#paint();
  }

  /**
   * The click gesture: a fixed scale-down and back up. Fixed, not
   * distance-dependent — every click in every video is the same length.
   *
   * This draws the click. It does not dispatch it; that is the executor's job
   * in phase 2, so that the visual and the event can be sequenced against each
   * other rather than tangled together.
   *
   * @param {{signal?: AbortSignal, onPress?: () => void}} [options]
   */
  async press({ signal, onPress } = {}) {
    const { clickMs, clickScale } = this.pace.cursor;
    await this.#scaleTo(clickScale, clickMs, signal);
    onPress?.();
    await this.#scaleTo(1, clickMs, signal);
  }

  /** Fade in over the profile's fade time. */
  async show({ signal } = {}) {
    this.visible = true;
    await this.#fadeTo(1, signal);
  }

  /**
   * Fade out. Takeover (spec §6) hides the cursor while Josema drives, so the
   * video does not show two pointers at once.
   */
  async hide({ signal } = {}) {
    this.visible = false;
    await this.#fadeTo(0, signal);
  }

  /** Dwell — the fixed pause after an action, so the viewer registers it. */
  dwell({ signal } = {}) {
    return delay(this.pace.dwellMs, { signal, clock: this.clock });
  }

  destroy() {
    this.el.remove();
  }

  async #fadeTo(target, signal) {
    const from = this.opacity;
    if (from === target) return;
    await animate({
      durationMs: this.pace.fadeMs,
      clock: this.clock,
      signal,
      onFrame: (t) => {
        const u = easeOutCubic(t / this.pace.fadeMs);
        this.opacity = from + (target - from) * u;
        this.#paint();
      },
    });
    this.opacity = target;
    this.#paint();
  }

  async #scaleTo(target, durationMs, signal) {
    const from = this.scale;
    await animate({
      durationMs,
      clock: this.clock,
      signal,
      onFrame: (t) => {
        const u = smoothstep(t / durationMs);
        this.scale = from + (target - from) * u;
        this.#paint();
      },
    });
    this.scale = target;
    this.#paint();
  }

  #paint() {
    const { x, y } = this.position;
    this.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${this.scale.toFixed(3)})`;
    this.el.style.opacity = String(this.opacity);
  }
}
