/**
 * The pace profile — spec §5, plan phase 1.
 *
 * One object governs every timing in the system. Nothing anywhere else may
 * hardcode a duration, a speed or a delay: it reads from here. That is what
 * makes "changing one number re-times the whole video" true, and it is what
 * makes two runs of the same walk look like the same clip.
 *
 * The five headline constants the plan names are `cursor.speed`,
 * `scroll.speed`, `typing.charsPerSecond`, `dwellMs` and `fadeMs`. The rest are
 * secondary knobs for the same five behaviours; they are here rather than
 * inline so the profile stays the single place to tune.
 *
 * Speeds are px/s in CSS pixels. Durations are ms.
 */

/** @typedef {ReturnType<typeof paceProfile>} PaceProfile */

export const DEFAULT_PACE = Object.freeze({
  cursor: Object.freeze({
    /** Cruise speed. A long move takes longer; it never goes faster. */
    speed: 900,
    /**
     * Time spent accelerating into cruise, and decelerating out of it. This is
     * the whole of the easing: the middle of every move is dead constant.
     * Short moves shrink the ramp rather than exceed `speed`.
     */
    rampMs: 220,
    /**
     * Sideways bow of the path, as a fraction of the straight-line distance.
     * Purely cosmetic — the speed along the curve stays constant either way.
     * Set to 0 for dead-straight moves.
     */
    arc: 0.06,
    /** Largest sideways bow in px, so long moves do not sail across the page. */
    arcMaxPx: 90,
    /** A click is a fixed scale-down and back up. Duration of each half. */
    clickMs: 110,
    /** How far down the cursor art scales on a click. */
    clickScale: 0.8,
  }),

  scroll: Object.freeze({
    /** Cruise speed. Constant px/s — never the browser's smooth-scroll. */
    speed: 700,
    /** Acceleration/deceleration time at the two ends of a scroll. */
    rampMs: 260,
    /**
     * Where a scroll target comes to rest, as a fraction of viewport height
     * from the top. 0.35 puts it a little above centre, which reads better on
     * video than dead centre.
     */
    restAt: 0.35,
  }),

  typing: Object.freeze({
    /** Constant rate. No human rhythm, no jitter. */
    charsPerSecond: 14,
    /** Fixed extra pause after . , ! ? ; : — the only variation allowed. */
    punctuationPauseMs: 220,
  }),

  highlight: Object.freeze({
    /** Breathing room between the target's box and the ring, px. */
    padPx: 6,
    /** Corner radius of the ring, px. */
    radiusPx: 8,
    /** Thickness of the ring, px. */
    ringPx: 2,
    /** How dark the surround goes. 0 is no dimming at all. */
    dimOpacity: 0.45,
  }),

  /** Pause after every action, so the viewer registers it before the next. */
  dwellMs: 450,

  /** Fade in/out of the highlight overlay, and of the cursor itself. */
  fadeMs: 260,

  /** How long a highlight sits at full strength before the walk moves on. */
  highlightHoldMs: 900,
});

/**
 * Build a profile from the defaults plus overrides. Two levels deep, because
 * that is exactly how deep the profile goes; the result is frozen so a run
 * cannot drift from the profile it started with.
 *
 * @param {object} [overrides]
 * @returns {typeof DEFAULT_PACE}
 */
export function paceProfile(overrides = {}) {
  const merged = { ...DEFAULT_PACE };
  for (const [key, value] of Object.entries(overrides)) {
    const base = DEFAULT_PACE[key];
    if (isPlainObject(base) && isPlainObject(value)) {
      merged[key] = Object.freeze({ ...base, ...value });
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    if (isPlainObject(value)) merged[key] = Object.freeze({ ...value });
  }
  return Object.freeze(merged);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
