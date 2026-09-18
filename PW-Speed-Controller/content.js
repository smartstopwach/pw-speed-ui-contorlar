/* ============================================================
 * PW Speed Controller + Clean View  —  content script (v1.5.2)
 * ------------------------------------------------------------
 *  UP ARROW    -> lecture/video continues at 2x
 *  DOWN ARROW  -> lecture/video continues at 1x
 *  UP+DOWN together (almost same time) -> 1.5x combo
 *  Lock: 3s after arrows, site overrides are snapped back.
 *  "T" key     -> CLEAN VIEW: every element floating on TOP of the
 *                 video is hidden (class-name agnostic, works inside
 *                 shadow DOM too). "T" again -> everything returns.
 * ========================================================== */
(() => {
  'use strict';

  /* DOUBLE-INJECTION GUARD */
  if (window.__PSC_ACTIVE__) return;
  window.__PSC_ACTIVE__ = true;

  /* ------------------ USER CONFIG (edit freely) ------------------ */
  const UP_SPEED         = 2.0;   // speed when UP arrow is pressed
  const DOWN_SPEED       = 1.0;   // speed when DOWN arrow is pressed
  const COMBO_SPEED      = 1.5;   // speed when UP+DOWN pressed almost together
  const COMBO_MS         = 200;   // max gap (ms) between the two arrows
  const CLEAN_KEY        = 't';   // key that toggles clean view
  const LOCK_MS          = 3000;  // snap-back window after each arrow press
  const KEEP_CAPTIONS    = true;  // subtitles/captions stay visible in clean view
  const CLEAN_SCAN_MS    = 350;   // re-scan throttle while clean view is ON
  const MIN_VIDEO_SIZE   = 80;    // ignore videos smaller than this (px)
  /* --------------------------------------------------------------- */

  const CLEAN_CLASS = 'psc-clean';
  const HIDE_ATTR   = 'data-psc-hide';
  const STYLE_ATTR  = 'data-psc-style';   // marker for injected <style> tags (kept separate from HIDE_ATTR)
  const STORE_KEY   = 'psc_clean_' + location.host;
  const EPS         = 0.001;
  const SKIP_TAGS   = new Set(['SCRIPT','STYLE','BR','LINK','META','TITLE','NOSCRIPT','IFRAME']);
  const KEEP_RE     = /(caption|subtitle|psc-toast)/i;

  /* speed-lock state */
  let desiredSpeed = null;
  let lockUntil    = 0;
  let lockedVideo  = null;
  let lastSnapToast = 0;
  let lastArrow    = { key: null, time: 0 };
  const enforcedVideos = new WeakSet();

  /* clean-view state */
  let cleanOn       = false;
  let cleanObservers = [];
  let cleanPassTimer = null;
  let cleanFallbackTimer = null;
  let styleRoots   = new WeakSet();   // roots that already have the hide <style>

  /* ---- deep element collection across shadow roots ---- */
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
      } catch (e) { /* guards */ }
    })(root || document);
    return out;
  }

  function findVideos() {
    let vids = Array.from(document.querySelectorAll('video'));
    if (vids.length) return vids;
    vids = deepQueryAll('video');
    if (vids.length) return vids;
    try {
      document.querySelectorAll('iframe').forEach(f => {
        try {
          if (f.contentDocument) vids.push(...f.contentDocument.querySelectorAll('video'));
        } catch (e) {}
      });
    } catch (e) {}
    return vids;
  }

  function videoArea(v) {
    return (v.videoWidth || 0) * (v.videoHeight || 0);
  }

  function isTypingTarget(t) {
    return !!t && (
      t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' || t.isContentEditable === true
    );
  }

  /* ---------------- tiny on-screen toast ---------------- */
  let toast = null, toastTimer = null;
  function showToast(msg) {
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

  /* ---------------- speed application + lock ---------------- */
  function onRateChange(e) {
    const v = e.currentTarget;
    if (desiredSpeed === null) return;
    if (v !== lockedVideo) return;

    const now = Date.now();
    if (Math.abs(v.playbackRate - desiredSpeed) < EPS) return;

    if (now < lockUntil) {
      v.playbackRate = desiredSpeed;
      v.defaultPlaybackRate = desiredSpeed;
      if (now - lastSnapToast > 1500) {
        lastSnapToast = now;
        showToast('🔒 ' + desiredSpeed + '× kept');
      }
    } else {
      desiredSpeed = v.playbackRate;
    }
  }

  function wireVideo(v) {
    if (!enforcedVideos.has(v)) {
      enforcedVideos.add(v);
      v.addEventListener('ratechange', onRateChange);
    }
  }

  function lockInSpeed(v, rate, combo) {
    desiredSpeed = rate;
    lockedVideo  = v;
    lockUntil = Date.now() + LOCK_MS;
    wireVideo(v);
    v.playbackRate = rate;
    v.defaultPlaybackRate = rate;
    showToast(combo ? ('⚡ ' + rate + '× combo 🔒')
                    : ((rate > 1 ? '⏩ ' : '▶ ') + rate + '× speed 🔒'));
  }

  window.addEventListener('loadedmetadata', (e) => {
    const v = e.target;
    if (!v || v.tagName !== 'VIDEO') return;
    if (desiredSpeed === null || Date.now() >= lockUntil) return;
    if (v === lockedVideo || !lockedVideo || !lockedVideo.isConnected) {
      wireVideo(v);
      lockedVideo = v;
      v.playbackRate = desiredSpeed;
      v.defaultPlaybackRate = desiredSpeed;
    }
  }, true);

  function getActiveVideo() {
    if (lockedVideo && lockedVideo.isConnected && Date.now() < lockUntil) {
      return lockedVideo;
    }
    if (lockedVideo && !lockedVideo.isConnected && Date.now() >= lockUntil) {
      lockedVideo = null;
    }
    const vids = findVideos();
    if (!vids.length) return null;
    const usable = vids.filter(v => v.readyState > 0 || !v.paused || v.videoWidth > 0);
    const pool = usable.length ? usable : vids;
    const playing = pool.find(v => !v.paused && !v.ended);
    if (playing) return playing;
    return pool.reduce((best, x) =>
      (!best || videoArea(x) > videoArea(best)) ? x : best, null);
  }

  /* ================================================================
   *  CLEAN VIEW ENGINE (universal — class-name agnostic, shadow-safe)
   *  Hides every element that FLOATS ON TOP of the video rectangle:
   *   - works regardless of site class names (PW obfuscated/Ionic OK)
   *   - reaches into shadow roots and styles them too
   *   - NEVER hides the video, its ancestors, captions, or our toast
   * ================================================================ */

  /* ancestors in the COMPOSED tree — crosses BOTH shadow boundaries
   * (via root.host) AND same-origin iframe boundaries (a Document's
   * frameElement). Without the iframe hop, the TOP <html> looks like
   * "not an ancestor" of an iframe video and gets hidden itself! */
  function isComposedAncestor(el, node) {
    let n = node;
    let hops = 0;
    while (n && hops++ < 150) {
      if (n === el) return true;
      if (n.nodeType === 9) {                              // Document -> hop to its frame element
        n = (n.defaultView && n.defaultView.frameElement) || null;
        continue;
      }
      const root = n.getRootNode ? n.getRootNode() : null;
      n = n.parentNode || (root && root.host) || null;
    }
    return false;
  }

  function rectsOverlap(a, b) {
    return !(a.right <= b.left || a.left >= b.right ||
             a.bottom <= b.top || a.top >= b.bottom);
  }

  /* every element in a root + every nested shadow root's elements,
   * and the list of roots (to style + observe each one) */
  function collectAllDeep(root) {
    const els = [];
    const roots = [];
    const seen = new Set();
    (function walk(r) {
      if (!r || seen.has(r)) return;
      seen.add(r);
      roots.push(r);
      try {
        r.querySelectorAll('*').forEach(el => {
          els.push(el);
          if (el.shadowRoot) walk(el.shadowRoot);
        });
      } catch (e) {}
    })(root);
    return { els, roots };
  }

  function ensureCleanStyle(root) {
    if (styleRoots.has(root)) return;
    try {
      const s = (root.ownerDocument || document).createElement('style');
      s.setAttribute(STYLE_ATTR, '');
      s.textContent = '[' + HIDE_ATTR + ']{display:none!important;visibility:hidden!important;}';
      (root.head || root.documentElement || root).appendChild(s);
      styleRoots.add(root);
    } catch (e) {}
  }

  /* core scan: tag every overlay floating on the video(s) */
  function cleanPass() {
    if (!cleanOn) return;
    const vids = findVideos().filter(v => {
      const r = v.getBoundingClientRect();
      return r.width >= MIN_VIDEO_SIZE && r.height >= MIN_VIDEO_SIZE;
    });
    if (!vids.length) return;

    /* collect candidates from the document AND the videos' own roots
     * (a video living inside a shadow root has its overlays there too) */
    const rootsToScan = new Set([document]);
    vids.forEach(v => {
      const r = v.getRootNode && v.getRootNode();
      if (r && r !== document) rootsToScan.add(r);
    });

    rootsToScan.forEach(rt => ensureCleanStyle(rt));

    vids.forEach(v => {
      const vr = v.getBoundingClientRect();
      rootsToScan.forEach(rt => {
        const { els } = collectAllDeep(rt);
        ensureCleanStyle(rt);
        els.forEach(el => {
          if (el.getAttribute(HIDE_ATTR) === '1') return;
          if (el === v || el.tagName === 'VIDEO') return;
          if (SKIP_TAGS.has(el.tagName)) return;
          if (el.id === 'psc-toast') return;
          if (isComposedAncestor(el, v)) return;             // never hide the player's box
          if (KEEP_CAPTIONS && KEEP_RE.test(String(el.className || '') + ' ' + (el.id || ''))) return;
          const er = el.getBoundingClientRect();
          if (!er || (er.width < 2 && er.height < 2)) return; // already invisible
          if (rectsOverlap(er, vr)) {
            el.setAttribute(HIDE_ATTR, '1');
            /* the hide <style> must live in THIS element's own root —
             * a document-level rule can't reach inside a shadow root */
            const elRoot = (el.getRootNode && el.getRootNode()) || document;
            ensureCleanStyle(elRoot);
          }
        });
      });
    });
  }
  /* test/debug hook */
  try { Object.defineProperty(window, '__pscPass', { value: cleanPass, configurable: true }); } catch (e) {}

  /* all documents we may have touched: top doc, shadow roots, same-origin iframes */
  function collectAllRoots() {
    const roots = [document];
    (function walk(r) {
      try {
        r.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) { roots.push(el.shadowRoot); walk(el.shadowRoot); }
        });
        r.querySelectorAll('iframe').forEach(f => {
          try { if (f.contentDocument) { roots.push(f.contentDocument); walk(f.contentDocument); } } catch (e) {}
        });
      } catch (e) {}
    })(document);
    return roots;
  }

  function untagEverything() {
    collectAllRoots().forEach(rt => {
      try {
        rt.querySelectorAll('style[' + STYLE_ATTR + ']').forEach(s => s.remove());
        rt.querySelectorAll('[' + HIDE_ATTR + ']').forEach(el => {
          el.removeAttribute(HIDE_ATTR);
        });
      } catch (e) {}
    });
    styleRoots = new WeakSet();
  }

  function schedulePass() {
    if (!cleanOn || cleanPassTimer) return;
    cleanPassTimer = setTimeout(() => {
      cleanPassTimer = null;
      cleanPass();
      startCleanWatcher();   // pick up any NEW shadow roots / iframes
    }, CLEAN_SCAN_MS);
  }

  /* observe EVERY root we care about: document, each shadow root, and
   * same-origin iframe docs — MutationObserver on document alone is blind
   * to mutations happening inside a shadow root! */
  function startCleanWatcher() {
    cleanObservers.forEach(o => o.disconnect());
    cleanObservers = [];
    collectAllRoots().forEach(rt => {
      const target = rt.body || rt.documentElement || rt;
      if (!target) return;
      try {
        const mo = new MutationObserver(schedulePass);
        mo.observe(target, { childList: true, subtree: true });
        cleanObservers.push(mo);
      } catch (e) {}
    });
    if (!cleanFallbackTimer) {
      cleanFallbackTimer = setInterval(() => { if (cleanOn) schedulePass(); }, 4000);
    }
  }

  function stopCleanWatcher() {
    cleanObservers.forEach(o => o.disconnect());
    cleanObservers = [];
    if (cleanFallbackTimer) { clearInterval(cleanFallbackTimer); cleanFallbackTimer = null; }
    if (cleanPassTimer) { clearTimeout(cleanPassTimer); cleanPassTimer = null; }
  }

  function enableClean() {
    cleanOn = true;
    document.documentElement.classList.add(CLEAN_CLASS);
    cleanPass();
    startCleanWatcher();
    /* layouts settle async — do a follow-up scan shortly after */
    setTimeout(schedulePass, 400);
    showToast('🧹 Clean view ON — toggles hidden');
    try { chrome.storage && chrome.storage.local && chrome.storage.local.set({ [STORE_KEY]: true }); } catch (e) {}
  }

  function disableClean() {
    cleanOn = false;
    document.documentElement.classList.remove(CLEAN_CLASS);
    stopCleanWatcher();
    untagEverything();
    showToast('👁 Toggles visible again');
    try { chrome.storage && chrome.storage.local && chrome.storage.local.set({ [STORE_KEY]: false }); } catch (e) {}
  }

  function toggleClean() {
    if (cleanOn) disableClean(); else enableClean();
  }

  /* restore clean view per site (robust for any injection timing) */
  try {
    chrome.storage && chrome.storage.local && chrome.storage.local.get(STORE_KEY, (r) => {
      if (!(r && r[STORE_KEY])) return;
      const apply = () => { if (!cleanOn) enableClean(); };
      if (document.documentElement && document.body) apply();
      else document.addEventListener('DOMContentLoaded', apply, { once: true });
    });
  } catch (e) {}

  /* ---------------- keyboard control ---------------- */
  window.addEventListener('keydown', (e) => {
    try {
      if (e.isComposing) return;
      const realTarget = (e.composedPath && e.composedPath()[0]) || e.target;
      if (isTypingTarget(realTarget)) return;

      /* ---- UP / DOWN arrows = SPEED ---- */
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const v = getActiveVideo();
        if (!v) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const now = Date.now();
        const other = (e.key === 'ArrowUp') ? 'ArrowDown' : 'ArrowUp';
        const gap = now - lastArrow.time;

        if (!e.repeat && lastArrow.key === other && gap >= 0 && gap <= COMBO_MS) {
          lastArrow = { key: null, time: 0 };
          lockInSpeed(v, COMBO_SPEED, true);
          return;
        }

        if (!e.repeat) lastArrow = { key: e.key, time: now };
        const rate = (e.key === 'ArrowUp') ? UP_SPEED : DOWN_SPEED;
        lockInSpeed(v, rate, false);
        return;
      }

      /* ---- T = clean view toggle (ignore key auto-repeat) ---- */
      if (!e.repeat &&
          (e.key === CLEAN_KEY || e.key === CLEAN_KEY.toUpperCase()) &&
          !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleClean();
      }
    } catch (err) { /* never break the host page */ }
  }, true);
})();
