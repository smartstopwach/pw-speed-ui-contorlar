/* ============================================================
 * PW Speed Controller + Clean View  —  content script (v1.3)
 * ------------------------------------------------------------
 *  UP ARROW    -> lecture/video continues at 2x
 *  DOWN ARROW  -> lecture/video continues at 1x
 *  UP+DOWN together (almost same time) -> 1.5x combo
 *  After an arrow press the speed is LOCKED for 3 seconds:
 *  if the site (e.g. a click on the player re-applying its own
 *  stored speed, like 1.5x) tries to change it in that window,
 *  it is snapped back to your chosen speed instantly.
 *  A manual speed change made AFTER the lock window is
 *  respected — and adopted as the new desired speed.
 *  "T" key     -> instantly hide ALL clutter toggles/overlays
 *  "T" again   -> bring them back
 * ========================================================== */
(() => {
  'use strict';

  /* ------------------ USER CONFIG (edit freely) ------------------ */
  const UP_SPEED    = 2.0;   // speed when UP arrow is pressed
  const DOWN_SPEED  = 1.0;   // speed when DOWN arrow is pressed
  const COMBO_SPEED = 1.5;   // speed when UP+DOWN pressed almost together
  const COMBO_MS    = 200;   // max gap (ms) between the two arrows for combo
  const CLEAN_KEY   = 't';   // key that toggles clean view
  const LOCK_MS     = 3000;  // snap-back window after each arrow press

  /* --------------------------------------------------------------- */

  const CLEAN_CLASS = 'psc-clean';
  const STORE_KEY   = 'psc_clean_' + location.host;
  const EPS         = 0.001;   // float tolerance when comparing speeds

  /* speed-lock state */
  let desiredSpeed = null;   // last speed chosen via arrows (or adopted manually)
  let lockUntil    = 0;      // timestamp until which we fight site interference
  let lastSnapToast = 0;
  let lastArrow    = { key: null, time: 0 };  // for the ↑+↓ combo = 1.5x

  /* ---- find every <video>, even inside shadow roots ---- */
  function deepQueryAll(selector, root) {
    const out = [];
    const seen = new Set();
    (function walk(node) {
      if (!node || seen.has(node)) return;
      seen.add(node);
      try {
        node.querySelectorAll(selector).forEach(el => out.push(el));
        node.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) walk(el.shadowRoot);
        });
      } catch (e) { /* cross-origin guards */ }
    })(root || document);
    return out;
  }

  /* ---- collect candidate <video> elements, cheap paths first ----
   * 1) fast native search in this document (no full-tree walk)
   * 2) shadow-DOM deep walk only if nothing found
   * 3) same-origin iframes (embedded lecture players) as last resort */
  function findVideos() {
    let vids = Array.from(document.querySelectorAll('video'));
    if (vids.length) return vids;                       // fast path
    vids = deepQueryAll('video');
    if (vids.length) return vids;
    try {
      document.querySelectorAll('iframe').forEach(f => {
        try {
          if (f.contentDocument) vids.push(...f.contentDocument.querySelectorAll('video'));
        } catch (e) { /* cross-origin iframe -> skip */ }
      });
    } catch (e) {}
    return vids;
  }

  /* ---- pick the playing video; fall back to ANY video present ----
   * (a just-inserted video with readyState 0 must still be controllable) */
  function getActiveVideo() {
    const vids = findVideos();
    if (!vids.length) return null;
    const usable = vids.filter(v => v.readyState > 0 || !v.paused || v.videoWidth > 0);
    const pool = usable.length ? usable : vids;
    return pool.find(v => !v.paused && !v.ended) || pool[0];
  }

  /* ---- don't steal keys while the user is typing ---- */
  function isTypingTarget(t) {
    return !!t && (
      t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable === true
    );
  }

  /* ---------------- tiny on-screen toast ---------------- */
  let toast = null, toastTimer = null;
  function showToast(msg) {
    /* In fullscreen the page <body> is not rendered — the toast must live
     * inside the fullscreen element instead (unless that element IS the
     * raw <video>, whose children never render). Re-parenting MOVES the
     * same node, so no orphan/duplicate toasts are ever left behind. */
    const fsEl = document.fullscreenElement;
    const parent = (fsEl && fsEl.tagName !== 'VIDEO') ? fsEl
                 : (document.body || document.documentElement);
    if (!toast || !toast.isConnected) {
      toast = document.createElement('div');
      toast.id = 'psc-toast';
    }
    if (toast.parentNode !== parent) parent.appendChild(toast);
    toast.textContent = msg;
    toast.classList.add('psc-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('psc-show'), 900);
  }

  /* ---------------- clean view (hide toggles) ---------------- */
  function toggleClean() {
    const on = document.documentElement.classList.toggle(CLEAN_CLASS);
    showToast(on ? '🧹 Clean view ON — toggles hidden' : '👁 Toggles visible again');
    try { chrome.storage && chrome.storage.local && chrome.storage.local.set({ [STORE_KEY]: on }); } catch (e) {}
  }

  /* restore clean view per site so lectures stay clean */
  try {
    chrome.storage && chrome.storage.local && chrome.storage.local.get(STORE_KEY, (r) => {
      if (r && r[STORE_KEY]) document.documentElement.classList.add(CLEAN_CLASS);
    });
  } catch (e) {}

  /* ---------------- speed application + lock ---------------- */
  function lockInSpeed(v, rate, combo) {
    desiredSpeed = rate;
    lockUntil = Date.now() + LOCK_MS;
    v.playbackRate = rate;
    v.defaultPlaybackRate = rate;
    showToast(combo ? ('⚡ ' + rate + '× combo 🔒')
                    : ((rate > 1 ? '⏩ ' : '▶ ') + rate + '× speed 🔒'));
  }

  /* Watch every speed change (capture: works even though media events
   * don't bubble). Decides: site interference -> snap back, or genuine
   * manual change -> respect & adopt it. */
  window.addEventListener('ratechange', (e) => {
    const v = e.target;
    if (!v || v.tagName !== 'VIDEO') return;
    if (desiredSpeed === null) return;

    const now = Date.now();
    if (Math.abs(v.playbackRate - desiredSpeed) < EPS) return;   // nothing to fix

    if (now < lockUntil) {
      /* The site (e.g. player click re-applying its stored 1.5x) tried
       * to override our speed right after the key press -> snap back. */
      v.playbackRate = desiredSpeed;
      v.defaultPlaybackRate = desiredSpeed;
      if (now - lastSnapToast > 1500) {
        lastSnapToast = now;
        showToast('🔒 ' + desiredSpeed + '× kept');
      }
    } else {
      /* Lock window over -> user changed speed deliberately.
       * Respect it AND adopt it so we never fight them again. */
      desiredSpeed = v.playbackRate;
    }
  }, true);

  /* If a fresh video loads/resets speed while the lock is still hot,
   * push our speed back onto it. */
  window.addEventListener('loadedmetadata', (e) => {
    const v = e.target;
    if (!v || v.tagName !== 'VIDEO') return;
    if (desiredSpeed !== null && Date.now() < lockUntil) {
      v.playbackRate = desiredSpeed;
      v.defaultPlaybackRate = desiredSpeed;
    }
  }, true);

  /* ---------------- keyboard control ---------------- */
  window.addEventListener('keydown', (e) => {
    if (e.isComposing || isTypingTarget(e.target)) return;

    /* ---- UP / DOWN arrows = SPEED ---- */
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const v = getActiveVideo();
      if (!v) return;                      // no video -> leave default behaviour

      e.preventDefault();
      e.stopImmediatePropagation();        // block page scroll / YT volume / site's own key handlers

      const now = Date.now();
      const other = (e.key === 'ArrowUp') ? 'ArrowDown' : 'ArrowUp';

      /* ↑ and ↓ pressed almost together -> combo speed 1.5x */
      if (!e.repeat && lastArrow.key === other && now - lastArrow.time <= COMBO_MS) {
        lastArrow = { key: null, time: 0 };
        lockInSpeed(v, COMBO_SPEED, true);
        return;
      }

      if (!e.repeat) lastArrow = { key: e.key, time: now };
      const rate = (e.key === 'ArrowUp') ? UP_SPEED : DOWN_SPEED;
      lockInSpeed(v, rate, false);
      return;
    }

    /* ---- T = clean view toggle ---- */
    if ((e.key === CLEAN_KEY || e.key === CLEAN_KEY.toUpperCase()) &&
        !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleClean();
    }
  }, true);   // capture phase -> we win over the site's own handlers
})();
