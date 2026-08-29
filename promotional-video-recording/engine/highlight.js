/**
 * The highlight — spec §5, plan phase 1.
 *
 * Four dimming rectangles around the target plus an outline ring, fading on
 * fixed curves. Deliberately *not* a text selection: a selection's colour,
 * corner treatment and behaviour belong to the browser and the OS theme, so two
 * runs on two machines would not match. This is drawn, so it is ours.
 *
 * Four rects rather than one full-screen overlay with a hole punched in it,
 * because `clip-path` and `mask` both force a repaint of the whole viewport
 * every frame on some pages. Four opaque boxes composite cheaply.
 */

import { animate, delay, displayClock } from './clock.js';
import { smoothstep } from './easing.js';
import { DEFAULT_PACE } from './pace.js';

/**
 * The four rectangles that dim everything except `target`.
 *
 * Exported on its own because it is pure geometry, which means it can be
 * tested without a browser — and because getting it wrong shows up as a seam of
 * undimmed page along one edge, which is easy to miss by eye.
 *
 * @param {{top: number, left: number, right: number, bottom: number}} target viewport rect
 * @param {{width: number, height: number}} viewport
 * @returns {Array<{top: number, left: number, width: number, height: number}>}
 */
export function dimRects(target, viewport) {
  const top = clamp(target.top, 0, viewport.height);
  const bottom = clamp(target.bottom, 0, viewport.height);
  const left = clamp(target.left, 0, viewport.width);
  const right = clamp(target.right, 0, viewport.width);

  return [
    { top: 0, left: 0, width: viewport.width, height: top },
    { top: bottom, left: 0, width: viewport.width, height: viewport.height - bottom },
    { top, left: 0, width: left, height: bottom - top },
    { top, left: right, width: viewport.width - right, height: bottom - top },
  ].map((r) => ({ ...r, width: Math.max(0, r.width), height: Math.max(0, r.height) }));
}

/** Grow a DOMRect-ish by `pad` on every side. */
export function padRect(rect, pad) {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
  };
}

export class Highlight {
  /**
   * @param {import('./overlay.js').Overlay} overlay
   * @param {{pace?: typeof DEFAULT_PACE, clock?: import('./clock.js').Clock}} [options]
   */
  constructor(overlay, { pace = DEFAULT_PACE, clock = displayClock } = {}) {
    this.overlay = overlay;
    this.pace = pace;
    this.clock = clock;

    const doc = overlay.host.ownerDocument;
    this.group = doc.createElement('div');
    this.group.style.cssText = 'position:absolute;inset:0;opacity:0;will-change:opacity;';

    this.dimEls = Array.from({ length: 4 }, () => {
      const el = doc.createElement('div');
      el.style.cssText = `position:absolute;background:#000;opacity:${pace.highlight.dimOpacity};`;
      this.group.append(el);
      return el;
    });

    this.ring = doc.createElement('div');
    this.ring.style.cssText = `
      position: absolute;
      border: ${pace.highlight.ringPx}px solid rgba(255,255,255,0.95);
      border-radius: ${pace.highlight.radiusPx}px;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 0 18px rgba(0,0,0,0.35);
      box-sizing: border-box;
    `;
    this.group.append(this.ring);

    overlay.highlightLayer.append(this.group);

    this.opacity = 0;
    /** @type {Element|null} */
    this.target = null;
    this.applyPace(pace);
  }

  /**
   * Re-apply the profile to the styles that are baked in rather than read per
   * frame. Called on construction, and again whenever the profile is swapped on
   * a live engine — otherwise "change one number and everything re-times" would
   * quietly not hold for the highlight.
   *
   * @param {typeof DEFAULT_PACE} pace
   */
  applyPace(pace) {
    this.pace = pace;
    for (const el of this.dimEls) el.style.opacity = String(pace.highlight.dimOpacity);
    this.ring.style.borderWidth = `${pace.highlight.ringPx}px`;
    this.ring.style.borderRadius = `${pace.highlight.radiusPx}px`;
    if (this.target) this.reposition();
  }

  get visible() {
    return this.opacity > 0;
  }

  /**
   * Fade the highlight in around an element or a viewport rect.
   *
   * @param {Element|{top:number,left:number,right:number,bottom:number}} target
   * @param {{signal?: AbortSignal}} [options]
   */
  async show(target, { signal } = {}) {
    this.target = target;
    this.reposition();
    await this.#fadeTo(1, signal);
  }

  /** Fade out. Leaves the target remembered, so `show()` again is cheap. */
  async hide({ signal } = {}) {
    await this.#fadeTo(0, signal);
  }

  /**
   * The whole gesture: in, hold, out. Hold length is a profile constant, so
   * every highlight in every video lasts the same.
   *
   * @param {Element|object} target
   * @param {{signal?: AbortSignal, holdMs?: number}} [options]
   */
  async flash(target, { signal, holdMs = this.pace.highlightHoldMs } = {}) {
    await this.show(target, { signal });
    await delay(holdMs, { signal, clock: this.clock });
    await this.hide({ signal });
  }

  /**
   * Recompute the geometry against the current viewport. Call after anything
   * that moves the target under a visible highlight — a scroll, a resize.
   */
  reposition() {
    if (!this.target) return;
    const raw =
      typeof this.target.getBoundingClientRect === 'function'
        ? this.target.getBoundingClientRect()
        : this.target;
    const rect = padRect(raw, this.pace.highlight.padPx);
    const viewport = this.overlay.viewport();

    for (const [i, r] of dimRects(rect, viewport).entries()) {
      const el = this.dimEls[i];
      el.style.top = `${r.top}px`;
      el.style.left = `${r.left}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
    }

    this.ring.style.top = `${rect.top}px`;
    this.ring.style.left = `${rect.left}px`;
    this.ring.style.width = `${Math.max(0, rect.right - rect.left)}px`;
    this.ring.style.height = `${Math.max(0, rect.bottom - rect.top)}px`;
  }

  destroy() {
    this.group.remove();
  }

  async #fadeTo(target, signal) {
    const from = this.opacity;
    if (from === target) return;
    const durationMs = this.pace.fadeMs;
    await animate({
      durationMs,
      clock: this.clock,
      signal,
      onFrame: (t) => {
        // Symmetric curve both ways: fading out is fading in, backwards.
        const u = smoothstep(t / durationMs);
        this.opacity = from + (target - from) * u;
        this.group.style.opacity = String(this.opacity);
      },
    });
    this.opacity = target;
    this.group.style.opacity = String(target);
  }
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
