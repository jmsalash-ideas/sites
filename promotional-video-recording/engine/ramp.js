/**
 * Constant speed, eased only at the two ends — plan phase 1.
 *
 * This is the core of the whole project, so it is worth being explicit about
 * why it is not just an easing curve.
 *
 * The usual approach — ease-in-out over the whole move — makes peak speed
 * proportional to distance. A move twice as long moves twice as fast in the
 * middle. That is precisely the defect being removed: `scrollIntoView({
 * behavior: 'smooth' })` and every ease-in-out tween share it.
 *
 * Instead the *velocity* is a trapezoid: ramp up over `rampMs`, hold dead
 * constant at `speed`, ramp down over `rampMs`. Duration then grows linearly
 * with distance, and the middle of every move — long or short — travels at
 * exactly the same px/s. Long distances take longer; they do not go faster.
 *
 * Short moves, where there is not enough distance to reach cruise, shrink the
 * ramps rather than exceed `speed`. Nothing ever moves faster than `speed`.
 *
 * The ramp velocity curve is smoothstep, whose integral over [0,1] is exactly
 * 0.5 — so the two ramps together cover exactly `speed * rampMs` worth of
 * distance, which keeps the algebra below closed-form.
 */

import { smoothstepIntegral } from './easing.js';

/**
 * @typedef {object} RampPlan
 * @property {number} distance   total distance, px
 * @property {number} speedPxMs  cruise speed, px/ms
 * @property {number} rampMs     length of each ramp, ms (shrunk for short moves)
 * @property {number} cruiseMs   time at constant speed, ms (0 for short moves)
 * @property {number} durationMs total duration, ms
 * @property {number} rampPx     distance covered by ONE ramp, px
 */

/**
 * Plan a move: how long it takes and how it is split.
 *
 * @param {number} distance px, non-negative
 * @param {number} speed    px/s, positive
 * @param {number} rampMs   ms spent easing at each end, non-negative
 * @returns {RampPlan}
 */
export function rampPlan(distance, speed, rampMs) {
  const d = Math.max(0, distance);
  const speedPxMs = Math.max(1e-6, speed) / 1000;
  const wanted = Math.max(0, rampMs);

  if (d === 0) {
    return { distance: 0, speedPxMs, rampMs: 0, cruiseMs: 0, durationMs: 0, rampPx: 0 };
  }

  // Time the whole distance would take at cruise speed. If that is less than
  // the ramp we asked for, there is no room to cruise: shorten the ramps.
  const flatOut = d / speedPxMs;
  const ramp = Math.min(wanted, flatOut);

  // The two ramps together cover exactly `speedPxMs * ramp` (smoothstep's
  // integral is 0.5, twice), leaving the rest for cruise.
  const rampPx = (speedPxMs * ramp) / 2;
  const cruisePx = Math.max(0, d - 2 * rampPx);
  const cruiseMs = cruisePx / speedPxMs;

  return {
    distance: d,
    speedPxMs,
    rampMs: ramp,
    cruiseMs,
    durationMs: 2 * ramp + cruiseMs,
    rampPx,
  };
}

/**
 * Distance travelled at time `t` into the plan. Monotonic, starts at 0, ends
 * at exactly `plan.distance`.
 *
 * @param {RampPlan} plan
 * @param {number} t ms since the move started
 * @returns {number} px
 */
export function distanceAt(plan, t) {
  if (plan.durationMs <= 0) return plan.distance;
  if (t <= 0) return 0;
  if (t >= plan.durationMs) return plan.distance;

  const { rampMs, cruiseMs, speedPxMs, rampPx, distance } = plan;

  if (t < rampMs) {
    // Accelerating.
    return 2 * rampPx * smoothstepIntegral(t / rampMs);
  }
  if (t < rampMs + cruiseMs) {
    // Cruising. Dead constant — this is the stretch the video is judged on.
    return rampPx + speedPxMs * (t - rampMs);
  }
  // Decelerating: the mirror of the ramp up, measured back from the end.
  const remaining = plan.durationMs - t;
  return distance - 2 * rampPx * smoothstepIntegral(remaining / rampMs);
}

/**
 * Speed at time `t`, px/ms. Only used by the bench's speed meter and by tests —
 * the engine itself integrates positions, it does not step velocities.
 *
 * @param {RampPlan} plan
 * @param {number} t
 * @returns {number} px/ms
 */
export function speedAt(plan, t) {
  if (plan.durationMs <= 0 || t < 0 || t > plan.durationMs) return 0;
  const { rampMs, cruiseMs, speedPxMs } = plan;
  if (t < rampMs) {
    const u = t / rampMs;
    return speedPxMs * (u * u * (3 - 2 * u));
  }
  if (t <= rampMs + cruiseMs) return speedPxMs;
  const u = (plan.durationMs - t) / rampMs;
  return speedPxMs * (u * u * (3 - 2 * u));
}

/**
 * How long a move of this distance takes, without building the plan. Handy for
 * estimating a walk's runtime from `walk.json` (phase 4) without running it.
 *
 * @param {number} distance px
 * @param {number} speed    px/s
 * @param {number} rampMs   ms
 * @returns {number} ms
 */
export function durationFor(distance, speed, rampMs) {
  return rampPlan(distance, speed, rampMs).durationMs;
}
