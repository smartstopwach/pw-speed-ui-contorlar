/* ============================================================
 * PW Speed Controller + Clean View  —  content script
 * ------------------------------------------------------------
 *  UP ARROW    -> lecture/video continues at 2x
 *  DOWN ARROW  -> lecture/video continues at 1x
 *  Manual speed change in the player -> left untouched (STAYS)
 *  After a manual change, UP/DOWN takes over again (2x / 1x)
 *  "T" key     -> instantly hide ALL clutter toggles/overlays
 *  "T" again   -> bring them back
 * ========================================================== */
(() => {
  'use strict';

  /* ------------------ USER CONFIG (edit freely) ------------------ */
  const UP_SPEED   = 2.0;   // speed when UP arrow is pressed
  const DOWN_SPEED = 1.0;   // speed when DOWN arrow is pressed
  const CLEAN_KEY  = 't';   // key that toggles clean view
  /* --------------------------------------------------------------- */

  const CLEAN_CLASS = 'psc-clean';
  const STORE_KEY   = 'psc_clean_' + location.host;

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

  /* ---- pick the video that is actually playing (or first usable) ---- */
  function getActiveVideo() {
    const vids = deepQueryAll('video').filter(v =>
      v.readyState > 0 || !v.paused || v.videoWidth > 0
    );
    if (!vids.length) return null;
    return vids.find(v => !v.paused && !v.ended) || vids[0];
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
    if (!toast || !toast.isConnected) {
      toast = document.createElement('div');
      toast.id = 'psc-toast';
      (document.body || document.documentElement).appendChild(toast);
    }
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

  /* ---------------- keyboard control ---------------- */
  window.addEventListener('keydown', (e) => {
    if (e.isComposing || isTypingTarget(e.target)) return;

    /* ---- UP / DOWN arrows = SPEED ---- */
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const v = getActiveVideo();
      if (!v) return;                      // no video -> leave default behaviour
      const rate = (e.key === 'ArrowUp') ? UP_SPEED : DOWN_SPEED;

      e.preventDefault();
      e.stopImmediatePropagation();        // block page scroll / YT volume

      v.playbackRate = rate;               // one-shot: manual changes later stay untouched
      v.defaultPlaybackRate = rate;
      showToast((rate > 1 ? '⏩ ' : '▶ ') + rate + '× speed');
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
