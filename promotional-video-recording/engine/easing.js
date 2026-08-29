/**
 * Easing curves. Deliberately few.
 *
 * The motion engine does not ease positions — it eases *velocity*, at the two
 * ends of a move only (see `ramp.js`). These curves are for the things that
 * genuinely are position-eased: fades, and the click scale-down.
 */

/** Clamp to [0, 1]. */
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smoothstep: 0 at 0, 1 at 1, zero slope at both ends. */
export function smoothstep(x) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/**
 * The integral of `smoothstep` over [0, x].
 *
 * `ramp.js` uses smoothstep as a *velocity* curve, so this is the distance
 * covered by a ramp. Its value at x=1 is exactly 0.5, which is why a ramp
 * covers exactly half the distance the same time at cruise speed would.
 */
export function smoothstepIntegral(x) {
  const t = clamp01(x);
  return t * t * t - (t * t * t * t) / 2;
}

/** Standard ease-out cubic, for fades. */
export function easeOutCubic(x) {
  const t = clamp01(x);
  return 1 - Math.pow(1 - t, 3);
}

/** Standard ease-in-out cubic. */
export function easeInOutCubic(x) {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
