/**
 * Vanilla DOM adapter: attach a Buddy to a <canvas> and run it.
 *
 * Handles the three things every host needs and every host gets wrong:
 * device-pixel-ratio scaling, a delta-time render loop that survives tab
 * switches, and pointer wiring.
 */
import { Buddy } from '../core/buddy.js';
import { CanvasSurface } from '../core/surface-canvas.js';
import { DESIGN } from '../core/geometry.js';

export function mount(canvas, opts = {}) {
  if (typeof canvas === 'string') canvas = document.querySelector(canvas);
  if (!canvas) throw new Error('mount(): canvas element not found');

  const buddy   = opts.buddy instanceof Buddy ? opts.buddy : new Buddy(opts);
  const ctx     = canvas.getContext('2d', { alpha: opts.alpha !== false });
  const surface = new CanvasSurface(ctx);

  let {
    size = null,          // fixed CSS size; null = follow the element's box
    interactive = true,
    dragToTurn = true,
    clickToPop = true,
    autoStart = true,
    maxDPR = 3,
    respectReducedMotion = true,
    announce = true,
    announcements = {},
  } = opts;

  /* Reduced motion, applied rather than merely documented.
     The idle oscillators and the motion trail are the parts that read as
     "movement"; expressions and pose changes are not, so they stay. */
  let mq = null, onMotion = null;
  if (respectReducedMotion && typeof matchMedia === 'function') {
    mq = matchMedia('(prefers-reduced-motion: reduce)');
    const base = { bob: buddy.s.bobAmt, breath: buddy.s.breathAmt,
                   tempo: buddy.s.tempo, trail: buddy.s.showTrail };
    onMotion = () => {
      const calm = mq.matches;
      buddy.s.bobAmt    = calm ? 0            : base.bob;
      buddy.s.breathAmt = calm ? base.breath * 0.3 : base.breath;
      buddy.s.tempo     = calm ? base.tempo * 0.8  : base.tempo;
      buddy.s.showTrail = calm ? false        : base.trail;
    };
    mq.addEventListener?.('change', onMotion);
    onMotion();
  }

  let cssSize = size || 320;
  let raf = 0, last = 0, running = false;
  let disposed = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
    if (!size) {
      const r = canvas.getBoundingClientRect();
      cssSize = Math.max(1, Math.min(r.width || 320, r.height || 320));
    } else {
      cssSize = size;
      canvas.style.width = cssSize + 'px';
      canvas.style.height = cssSize + 'px';
    }
    canvas.width  = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
  }

  function paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
    const unit = (cssSize / DESIGN) * dpr;
    surface.clear();
    ctx.setTransform(unit, 0, 0, unit, canvas.width / 2, canvas.height / 2);
    buddy.render(surface);
  }

  function frame(now) {
    if (disposed) return;
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    buddy.update(dt);
    paint();
    raf = rAF(frame);
  }

  /* Guarded rather than assumed. `dispose()` runs during teardown, which is
     exactly where the frame APIs may be gone — an SSR unmount, jsdom, a test
     harness — and throwing there leaks every listener registered after it. */
  const rAF = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
  const cAF = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null;

  function start() { if (!running && !disposed && rAF) { running = true; last = 0; raf = rAF(frame); } }
  function stop()  { running = false; if (raf && cAF) cAF(raf); raf = 0; }

  /* ------------------------------------------------------------ pointer */
  let drag = null;
  const onMove = e => {
    const r = canvas.getBoundingClientRect();
    buddy.pointer(((e.clientX - r.left) / r.width - 0.5) * 2,
                  ((e.clientY - r.top) / r.height - 0.5) * 2, true);
    if (drag && dragToTurn) {
      buddy.turnBy((e.clientX - drag.x) * 0.012, (e.clientY - drag.y) * 0.006);
      drag.x = e.clientX; drag.y = e.clientY;
    }
  };
  const onLeave = () => buddy.pointer(0, 0, false);
  const onDown  = e => {
    canvas.setPointerCapture?.(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    // a touch that lands on the character should not also select text around it
    if (e.pointerType !== 'mouse') e.preventDefault();
  };
  const onUp    = e => {
    if (!drag) return;
    const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    drag = null;
    if (clickToPop && moved < 5) buddy.react('pop');
  };

  if (interactive) {
    /* Without this a touch-drag scrolls the page instead of turning the head,
       and the pointermove stream stops the moment the browser claims the
       gesture. Set on the element rather than left to page CSS so the rig
       works wherever it is dropped. */
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  }

  /* ------------------------------------------------------------- a11y
     A canvas is a black box to assistive technology. That is fine while the
     character is decorative, and not fine the moment it becomes the lesson:
     `spell('cat')` and `trace('g')` are taught *only* here, so a screen-reader
     user gets nothing at all. Two pieces: a name for the image, and a live
     region for the moments that carry information.

     Everything below is overridable, and `announce: false` opts out — the text
     belongs to the host app, not to a rendering library. */
  const addedAttrs = [];
  const setIfAbsent = (k, v) => {
    if (canvas.hasAttribute(k)) return;
    canvas.setAttribute(k, v); addedAttrs.push(k);
  };
  setIfAbsent('role', 'img');
  if (!canvas.hasAttribute('aria-labelledby'))
    setIfAbsent('aria-label', announcements.label ?? 'Spelling buddy');

  /* Only the things nothing else in the page knows. `correct` / `wrong` are
     deliberately absent by default: virtually every host already shows its own
     status text, and announcing feedback twice is worse than not announcing it.
     Pass them in `announcements` to turn them on. */
  const SAY = {
    hold:  ch => `Letter ${ch}`,
    spell: w  => `Spelling ${[...w].join(', ')}`,
    trace: ch => `Showing how to write ${ch}`,
    correct: null,
    wrong: null,
    ...announcements,
  };

  let live = null, offAnnounce = [];
  if (announce && typeof document !== 'undefined') {
    live = announce instanceof Element ? announce : document.createElement('span');
    if (live !== announce) {
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      /* Off-screen rather than display:none — a hidden element is not
         announced at all, which defeats the point. */
      live.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;' +
                           'padding:0;overflow:hidden;clip:rect(0 0 0 0);' +
                           'clip-path:inset(50%);white-space:nowrap;border:0';
      /* `after()` returns undefined on success, so `??` would run the fallback
         every time and insert the node twice. */
      if (typeof canvas.after === 'function') canvas.after(live);
      else canvas.parentNode?.insertBefore(live, canvas.nextSibling);
    }
    const speak = t => { if (t && live.textContent !== t) live.textContent = t; };
    const on = (evt, fn) => { buddy.on(evt, fn); offAnnounce.push([evt, fn]); };

    /* The word once, not each letter. At a 0.48s cadence a per-letter
       announcement overwrites itself before a screen reader finishes the
       previous one — the user hears "t" and nothing else. */
    let spelling = false;
    on('spell:start', w  => { spelling = true; speak(SAY.spell?.(w)); });
    on('spell:done',  ()  => { spelling = false; });
    on('hold',        ch => { if (!spelling) speak(SAY.hold?.(ch)); });
    on('trace:start', ch => speak(SAY.trace?.(ch)));
    on('action:start', a => {
      if ((a === 'correct' || a === 'wrong') && SAY[a]) speak(SAY[a]());
    });
  }

  const ro = typeof ResizeObserver !== 'undefined' && !size
    ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  window.addEventListener('resize', resize);

  resize();
  paint();
  if (autoStart) start();

  return {
    buddy,
    canvas,
    start, stop, resize, paint,
    /** Change a fixed size after mount (pass null to follow the element box). */
    setSize(next) { size = next; resize(); paint(); },
    /** The live region, if one was created — so a host can read or reuse it. */
    live,
    dispose() {
      disposed = true; stop();
      for (const [evt, fn] of offAnnounce) buddy.off?.(evt, fn);
      for (const k of addedAttrs) canvas.removeAttribute(k);
      if (live && live !== announce) live.remove?.();
      ro?.disconnect();
      mq?.removeEventListener?.('change', onMotion);
      window.removeEventListener('resize', resize);
      if (interactive) {
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
      }
    },
  };
}
