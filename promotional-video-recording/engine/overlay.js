/**
 * The overlay host — plan phase 1.
 *
 * One shadow root at the top of the page holds both things the extension is
 * allowed to draw into the video: the synthetic cursor and the highlight. Spec
 * §6 is strict about this — no control, badge or status line may render inside
 * the captured tab, because it would land in the recording. Only these two.
 *
 * Shadow DOM because the page's CSS must not be able to reach the cursor. A
 * stray `* { transition: ... }` or a z-index war on versaroom would otherwise
 * change how the video looks, which is the one thing that has to stay constant
 * between runs.
 *
 * Everything here is in viewport coordinates: the host is `position: fixed`, so
 * scrolling the page does not drag the cursor with it.
 */

const HOST_ID = 'pvr-overlay-host';
const MAX_Z = 2147483647;

const HOST_STYLE = `
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  pointer-events: none;
  z-index: ${MAX_Z};
  contain: strict;
  color-scheme: normal;
`;

const SHADOW_CSS = `
  :host { all: initial; }
  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transform: translateZ(0);
  }
  /* The highlight sits under the cursor: the cursor is never dimmed. */
  .highlight { z-index: 1; }
  .cursor { z-index: 2; }
`;

/**
 * @typedef {object} Overlay
 * @property {HTMLElement} host
 * @property {ShadowRoot} root
 * @property {HTMLElement} cursorLayer
 * @property {HTMLElement} highlightLayer
 * @property {() => {width: number, height: number}} viewport
 * @property {() => void} destroy
 */

/**
 * Mount the overlay, or return the one already mounted. Idempotent, because the
 * content script is re-injectable mid-run (plan §0) and must not end up with
 * two cursors on screen.
 *
 * @param {Document} [doc]
 * @returns {Overlay}
 */
export function mountOverlay(doc = document) {
  const existing = doc.getElementById(HOST_ID);
  if (existing?.__pvrOverlay) return existing.__pvrOverlay;

  const host = doc.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = HOST_STYLE;

  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = SHADOW_CSS;
  root.append(style);

  const highlightLayer = doc.createElement('div');
  highlightLayer.className = 'layer highlight';
  const cursorLayer = doc.createElement('div');
  cursorLayer.className = 'layer cursor';
  root.append(highlightLayer, cursorLayer);

  // documentElement rather than body: a page that replaces its body mid-run
  // (a SPA route change) does not take the overlay with it.
  doc.documentElement.append(host);

  /** @type {Overlay} */
  const overlay = {
    host,
    root,
    cursorLayer,
    highlightLayer,
    viewport: () => ({
      width: doc.documentElement.clientWidth || 0,
      height: doc.documentElement.clientHeight || 0,
    }),
    destroy() {
      delete host.__pvrOverlay;
      host.remove();
    },
  };

  host.__pvrOverlay = overlay;
  return overlay;
}

/** The mounted overlay, if there is one. */
export function currentOverlay(doc = document) {
  return doc.getElementById(HOST_ID)?.__pvrOverlay ?? null;
}

export const OVERLAY_HOST_ID = HOST_ID;
