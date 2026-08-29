/**
 * The bench — plan phase 1's "done when".
 *
 * Two jobs.
 *
 * 1. Run a hand-written sequence of moves, scrolls and highlights on a static
 *    page, so the motion can be judged by eye. Twiddle one number in the pace
 *    profile and the whole sequence re-times, with no reload.
 *
 * 2. Measure it. "Visibly even" is a judgement; px/s is a number. The meter
 *    samples the engine every frame and reports what speed the constant stretch
 *    of each move actually ran at, so the claim the whole project rests on —
 *    long moves take longer, they do not go faster — is checked rather than
 *    admired.
 *
 * Targets here are found by `data-target`, not by visible text. Text targeting
 * is phase 2's job and deliberately absent: phase 1 is about motion only.
 */

import { createEngine, paceProfile, DEFAULT_PACE } from './engine/index.js';

const el = (id) => document.getElementById(id);
const target = (name) => document.querySelector(`[data-target="${name}"]`);

// ---------------------------------------------------------------- the profile

const KNOBS = [
  { id: 'cursor', path: ['cursor', 'speed'], fixed: 0 },
  { id: 'scroll', path: ['scroll', 'speed'], fixed: 0 },
  { id: 'ramp', path: ['cursor', 'rampMs'], fixed: 0, also: [['scroll', 'rampMs']] },
  { id: 'dwell', path: ['dwellMs'], fixed: 0 },
  { id: 'fade', path: ['fadeMs'], fixed: 0 },
  { id: 'arc', path: ['cursor', 'arc'], fixed: 3 },
];

let overrides = {};
let engine = createEngine({ pace: paceProfile() });

function readKnobs() {
  overrides = {};
  for (const knob of KNOBS) {
    const value = Number(el(`k-${knob.id}`).value);
    el(`out-${knob.id}`).textContent = value.toFixed(knob.fixed);
    for (const path of [knob.path, ...(knob.also ?? [])]) set(overrides, path, value);
  }
  // Live re-time: this is the phase 1 acceptance criterion, so it had better be
  // one assignment and no reload.
  engine.setPace(paceProfile(overrides));
}

function set(object, path, value) {
  let node = object;
  for (const key of path.slice(0, -1)) node = node[key] ??= {};
  node[path.at(-1)] = value;
}

function get(object, path) {
  return path.reduce((node, key) => node?.[key], object);
}

function resetKnobs() {
  for (const knob of KNOBS) el(`k-${knob.id}`).value = String(get(DEFAULT_PACE, knob.path));
  readKnobs();
}

// ------------------------------------------------------------------ the meter

/**
 * Collects per-frame samples and reports the speed of the constant stretch.
 *
 * The ramps are excluded — they are supposed to vary, that is what a ramp is.
 * What must not vary is the middle, and it must not vary between a short move
 * and a long one.
 */
function meter(kind) {
  const samples = [];
  return {
    kind,
    onSample: (s) => samples.push(s),
    /** @param {number} rampMs */
    summary(rampMs) {
      if (samples.length < 3) return null;
      const duration = samples.at(-1).t;
      const speeds = [];
      let worstGap = 0;
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1];
        const b = samples[i];
        const dt = b.t - a.t;
        if (dt <= 0) continue;
        worstGap = Math.max(worstGap, dt);
        // Only the cruise. A margin of one extra frame each side keeps the
        // sample that straddles the ramp boundary out of the numbers.
        if (a.t < rampMs + 20 || b.t > duration - rampMs - 20) continue;
        const distance =
          kind === 'scroll' ? Math.abs(b.top - a.top) : Math.hypot(b.x - a.x, b.y - a.y);
        speeds.push((distance / dt) * 1000);
      }
      if (!speeds.length) return { duration, frames: samples.length, worstGap, tooShort: true };
      const min = Math.min(...speeds);
      const max = Math.max(...speeds);
      const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      return {
        duration,
        frames: samples.length,
        worstGap,
        mean,
        min,
        max,
        spread: max - min,
        spreadPct: (100 * (max - min)) / mean,
      };
    },
  };
}

const lines = [];
function say(text) {
  lines.push(text);
  el('readout').textContent = lines.slice(-40).join('\n');
  el('readout').scrollTop = el('readout').scrollHeight;
}
function clearReadout() {
  lines.length = 0;
  el('readout').textContent = '';
}

function report(label, summary) {
  if (!summary) return say(`${label}: too short to measure`);
  if (summary.tooShort) {
    return say(`${label}: ${Math.round(summary.duration)}ms, all ramp, no cruise`);
  }
  say(
    `${label}: ${summary.mean.toFixed(0)} px/s cruise` +
      ` (±${summary.spread.toFixed(1)}, ${summary.spreadPct.toFixed(2)}%)` +
      `  ${Math.round(summary.duration)}ms, ${summary.frames} frames` +
      (summary.worstGap > 40 ? `, worst frame gap ${summary.worstGap.toFixed(0)}ms` : '')
  );
}

// ------------------------------------------------------------------- the walk

/**
 * A hand-written sequence. This is what `walk.json` will hold in phase 4; here
 * it is code, because phase 1 has no file format yet and inventing one early
 * would be inventing it without the executor to answer to.
 */
async function runWalk(signal) {
  const step = async (label, kind, body) => {
    const m = meter(kind);
    await body(m.onSample);
    const rampMs = kind === 'scroll' ? engine.pace.scroll.rampMs : engine.pace.cursor.rampMs;
    report(label, m.summary(rampMs));
  };

  await engine.scroller.to(0, { signal });
  await engine.begin();

  await step('point at "Start practice"', 'cursor', (onSample) =>
    engine.pointAt(target('start'), { signal, onSample })
  );
  await engine.cursor.press({ signal });
  await engine.dwell();

  await step('short hop to "Sign in"', 'cursor', (onSample) =>
    engine.pointAt(target('sign-in'), { signal, onSample })
  );
  await engine.dwell();

  await step('scroll to the features', 'scroll', (onSample) =>
    engine.scroller.toElement(document.getElementById('features'), { signal, onSample })
  );

  await step('long move to the third card', 'cursor', (onSample) =>
    engine.pointAt(target('card-remembers'), { signal, onSample })
  );
  await engine.highlight.flash(target('card-remembers'), { signal });
  await engine.dwell();

  await step('scroll to the transcript', 'scroll', (onSample) =>
    engine.scroller.toElement(document.getElementById('practice'), { signal, onSample })
  );

  await step('point at the correction', 'cursor', (onSample) =>
    engine.pointAt(target('line-note'), { signal, onSample })
  );
  await engine.highlight.flash(target('line-note'), { signal });
  await engine.dwell();

  await step('long scroll to pricing', 'scroll', (onSample) =>
    engine.scroller.toElement(document.getElementById('pricing'), { signal, onSample })
  );

  await step('point at the featured plan', 'cursor', (onSample) =>
    engine.pointAt(target('plan-daily'), { signal, onSample })
  );
  await engine.cursor.press({ signal });
  await engine.dwell();

  await step('scroll all the way back up', 'scroll', (onSample) =>
    engine.scroller.to(0, { signal, onSample })
  );

  await engine.end();
}

/**
 * The claim, on its own, with nothing else moving: a short move and a long move
 * cruise at the same px/s, and the long one is simply longer.
 */
async function prove(signal) {
  const viewport = engine.overlay.viewport();
  const y = viewport.height * 0.5;
  const left = Math.max(60, viewport.width * 0.1);

  await engine.scroller.to(0, { signal });
  engine.cursor.placeAt(left, y);
  await engine.cursor.show({ signal });

  const distances = [
    ['short move', Math.min(300, viewport.width * 0.25)],
    ['long move ', Math.min(1200, viewport.width * 0.78)],
  ];

  const results = [];
  for (const [label, distance] of distances) {
    engine.cursor.placeAt(left, y);
    const m = meter('cursor');
    await engine.cursor.moveTo(left + distance, y, { signal, onSample: m.onSample });
    const summary = m.summary(engine.pace.cursor.rampMs);
    results.push({ label, distance, summary });
    report(`${label} (${Math.round(distance)}px)`, summary);
    await engine.dwell();
  }

  const [short, long] = results;
  if (short.summary?.mean && long.summary?.mean) {
    const ratio = long.summary.mean / short.summary.mean;
    const timeRatio = long.summary.duration / short.summary.duration;
    say(
      `\ndistance ×${(long.distance / short.distance).toFixed(2)}` +
        ` → duration ×${timeRatio.toFixed(2)}, speed ×${ratio.toFixed(3)}`
    );
    say(
      Math.abs(ratio - 1) < 0.02
        ? 'the longer move took longer at the same speed. that is the deliverable.'
        : 'speeds differ by more than 2% — something is wrong.'
    );
  }
  await engine.end();
}

// -------------------------------------------------------------------- driving

let running = null;

async function drive(name, body) {
  if (running) return;
  clearReadout();
  say(`${name} — pace: cursor ${engine.pace.cursor.speed}px/s, scroll ${engine.pace.scroll.speed}px/s, ramp ${engine.pace.cursor.rampMs}ms\n`);
  el('run').disabled = true;
  el('prove').disabled = true;
  const controller = new AbortController();
  running = controller;
  try {
    await body(controller.signal);
    say('\ndone.');
  } catch (error) {
    if (error?.name === 'AbortError') say('\nstopped.');
    else {
      say(`\nfailed: ${error?.message ?? error}`);
      throw error;
    }
  } finally {
    running = null;
    el('run').disabled = false;
    el('prove').disabled = false;
    engine.cursor.hide().catch(() => {});
  }
}

el('run').addEventListener('click', () => drive('walk', runWalk));
el('prove').addEventListener('click', () => drive('proof', prove));
el('stop').addEventListener('click', () => {
  running?.abort();
  engine.abort();
});
el('reset-pace').addEventListener('click', resetKnobs);

for (const knob of KNOBS) {
  el(`k-${knob.id}`).addEventListener('input', readKnobs);
}

el('hide-panel').addEventListener('click', () => togglePanel(false));
el('show-panel').addEventListener('click', () => togglePanel(true));
document.addEventListener('keydown', (event) => {
  if (event.key === 'h' || event.key === 'H') togglePanel(el('panel').hidden);
});

function togglePanel(show) {
  el('panel').hidden = !show;
  el('show-panel').hidden = show;
}

// Keep a visible highlight glued to its target when the page moves under it.
addEventListener('resize', () => {
  if (engine.highlight.visible) engine.highlight.reposition();
});

resetKnobs();
say('ready. "Run the walk" for the sequence, "Prove" for the one claim on its own.');
