/**
 * The shape a cursor move follows, separated from the speed it follows it at.
 *
 * A dead-straight move between two points reads as mechanical on video, so the
 * path bows slightly. But bowing must not disturb the pace: if you drive a
 * curve by interpolating the bezier parameter `t`, speed varies along the
 * curve, which would reintroduce exactly the unevenness this project removes.
 *
 * So the curve is arc-length parameterised — a lookup table maps *distance
 * travelled* to a point. `ramp.js` decides the distance, this decides where
 * that distance lands. Speed stays constant whatever the shape.
 *
 * The bow is always to the same side, so the same walk traces the same path on
 * every run (spec §9: two runs should be frame-comparable).
 */

/** @typedef {{x: number, y: number}} Point */

const SAMPLES = 64;

/**
 * @param {Point} from
 * @param {Point} to
 * @param {{arc?: number, arcMaxPx?: number}} [options]
 * @returns {{length: number, at: (distance: number) => Point}}
 */
export function arcPath(from, to, { arc = 0, arcMaxPx = Infinity } = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const straight = Math.hypot(dx, dy);

  const bow = Math.min(straight * arc, arcMaxPx);
  if (straight === 0 || bow < 0.5) {
    return {
      length: straight,
      at(distance) {
        const u = straight === 0 ? 1 : clamp(distance / straight, 0, 1);
        return { x: from.x + dx * u, y: from.y + dy * u };
      },
    };
  }

  // Control point: the midpoint, pushed out along the perpendicular. Doubled
  // because a quadratic bezier only reaches half way to its control point.
  const nx = -dy / straight;
  const ny = dx / straight;
  const control = {
    x: from.x + dx / 2 + nx * bow * 2,
    y: from.y + dy / 2 + ny * bow * 2,
  };

  // Cumulative arc length over a fixed number of samples. The curve is shallow,
  // so straight-line segments between samples are accurate to well under a pixel.
  const points = [];
  const cumulative = [];
  let total = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const p = quadratic(from, control, to, i / SAMPLES);
    if (i > 0) total += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    points.push(p);
    cumulative.push(total);
  }

  return {
    length: total,
    at(distance) {
      const d = clamp(distance, 0, total);
      // Binary search for the segment this distance falls in.
      let lo = 0;
      let hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] < d) lo = mid + 1;
        else hi = mid;
      }
      if (lo === 0) return { ...points[0] };
      const segment = cumulative[lo] - cumulative[lo - 1];
      const u = segment === 0 ? 0 : (d - cumulative[lo - 1]) / segment;
      const a = points[lo - 1];
      const b = points[lo];
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    },
  };
}

function quadratic(p0, p1, p2, t) {
  const s = 1 - t;
  return {
    x: s * s * p0.x + 2 * s * t * p1.x + t * t * p2.x,
    y: s * s * p0.y + 2 * s * t * p1.y + t * t * p2.y,
  };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
