/* ================================================================
 *  PW Speed Controller — automated feature test-suite (v1.4)
 *  Simulates real pages (YouTube / PW style) with jsdom and runs
 *  the REAL content.js against keyboard + player events.
 *  Run:  node run-tests.js
 * ================================================================ */
'use strict';

const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const CONTENT_JS = path.join(__dirname, '..', 'PW-Speed-Controller', 'content.js');
const SRC = fs.readFileSync(CONTENT_JS, 'utf8');

/* ---------- tiny assertion framework ---------- */
let passed = 0, failed = 0;
const failures = [];
function ok(cond, name, extra) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { failed++; failures.push(name); console.log('  ❌ ' + name + (extra ? '  -> ' + extra : '')); }
}
function eq(got, want, name) {
  ok(Object.is(got, want), name, 'expected ' + want + ', got ' + got);
}
function group(title) { console.log('\n━━━ ' + title + ' ━━━'); }

/* ---------- page factory: fresh jsdom "site" + extension injected ---------- */
let START_TIME = 1_000_000;

function chromeMock() {
  return {
    storage: {
      local: {
        _data: {},
        get(key, cb) { cb(this._data); },
        set(obj) { Object.assign(this._data, obj); }
      }
    }
  };
}

function createPage({ url = 'https://www.youtube.com/watch?v=test', prefillClean = false } = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const win = dom.window;
  const doc = win.document;

  win.__fakeNow = START_TIME;
  win.eval('Date.now = function(){ return window.__fakeNow; };');

  win.chrome = chromeMock();
  if (prefillClean) win.chrome.storage.local._data['psc_clean_' + win.location.host] = true;

  /* helpers */
  const page = { win, doc, dom };
  page.advance = (ms) => { win.__fakeNow += ms; };
  page.now = () => win.__fakeNow;

  page.addVideo = ({ playing = false, shadowHost = null } = {}) => {
    const v = doc.createElement('video');
    Object.defineProperty(v, 'readyState', { value: 2, configurable: true });
    if (playing) {
      Object.defineProperty(v, 'paused', { get: () => false, configurable: true });
      Object.defineProperty(v, 'currentTime', { get: () => 5, configurable: true });
    }
    (shadowHost ? shadowHost.shadowRoot : doc.body).appendChild(v);
    return v;
  };

  page.addShadowVideo = ({ playing = false } = {}) => {
    const host = doc.createElement('div');
    host.attachShadow({ mode: 'open' });
    doc.body.appendChild(host);
    return page.addVideo({ playing, shadowHost: host });
  };

  page.press = (key, { target = null, ctrlKey = false, metaKey = false, altKey = false, repeat = false } = {}) => {
    const ev = new win.KeyboardEvent('keydown', {
      key, bubbles: true, cancelable: true,
      ctrlKey, metaKey, altKey, repeat, isComposing: false
    });
    (target || win).dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  /* site forcibly changes speed (like PW player re-applying its stored 1.5x) */
  page.siteSetsSpeed = (video, rate) => {
    video.playbackRate = rate;
    video.dispatchEvent(new win.Event('ratechange'));
  };

  page.loaded = (video) => video.dispatchEvent(new win.Event('loadedmetadata'));
  page.toastText = () => { const t = doc.querySelector('#psc-toast'); return t && t.isConnected ? t.textContent : null; };
  page.isClean = () => doc.documentElement.classList.contains('psc-clean');

  win.eval(SRC);   // inject the real extension content script
  return page;
}

/* ================================================================
 *  TEST GROUPS
 * ================================================================ */

/* ---------- 1. UP arrow = 2x ---------- */
group('1. UP arrow sets & keeps 2x');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  const prevented = p.press('ArrowUp');
  eq(v.playbackRate, 2, 'ArrowUp -> playbackRate 2x');
  eq(v.defaultPlaybackRate, 2, 'defaultPlaybackRate also 2x');
  eq(prevented, true, 'default browser behaviour (scroll) prevented');
  ok(p.toastText() && p.toastText().includes('2×'), 'toast shows 2× speed', p.toastText());
}

/* ---------- 2. DOWN arrow = 1x ---------- */
group('2. DOWN arrow sets 1x');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  v.playbackRate = 2;
  p.press('ArrowDown');
  eq(v.playbackRate, 1, 'ArrowDown -> playbackRate 1x');
  ok(p.toastText() && p.toastText().includes('1×'), 'toast shows 1×');
}

/* ---------- 3. Combo UP then DOWN = 1.5x ---------- */
group('3. Combo ↑ then ↓ (within 200ms) = 1.5x');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  p.advance(120);               // < 200ms gap
  p.press('ArrowDown');
  eq(v.playbackRate, 1.5, 'combo up+down -> 1.5x');
  ok(p.toastText() && p.toastText().includes('combo'), 'toast says combo', p.toastText());
}

/* ---------- 4. Combo DOWN then UP = 1.5x (order independent) ---------- */
group('4. Combo ↓ then ↑ also = 1.5x');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowDown');
  p.advance(150);
  p.press('ArrowUp');
  eq(v.playbackRate, 1.5, 'combo down+up -> 1.5x');
}

/* ---------- 5. Slow gap = NO combo (normal behaviour) ---------- */
group('5. Gap > 200ms -> no combo, second arrow acts normally');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  p.advance(400);               // > 200ms
  p.press('ArrowDown');
  eq(v.playbackRate, 1, 'slow gap -> plain 1x (no combo)');
}

/* ---------- 6. After combo, single arrow works again ---------- */
group('6. After combo, plain UP = 2x');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp'); p.advance(100); p.press('ArrowDown');   // combo -> 1.5
  p.advance(100);                                             // arrow arrives quickly after combo
  p.press('ArrowUp');
  eq(v.playbackRate, 2, 'plain UP after combo -> 2x');
}

/* ---------- 7. Holding UP (key repeat) stays 2x, no combo ---------- */
group('7. Holding UP (auto-repeat) stays 2x');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  p.advance(50); p.press('ArrowUp', { repeat: true });
  p.advance(50); p.press('ArrowUp', { repeat: true });
  eq(v.playbackRate, 2, 'repeated UP keeps 2x');
  ok(p.toastText() && !p.toastText().includes('combo'), 'no combo toast on hold');
}

/* ---------- 8. THE BUG: click/override after UP must not drop to 1.5x ---------- */
group('8. BUG FIX: ↑ + player click at same time stays 2x (no 1.5x drop)');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');                       // user presses UP (2x + lock)
  p.advance(30);                            // "click" happens -> site forces 1.5x
  p.siteSetsSpeed(v, 1.5);
  eq(v.playbackRate, 2, 'site tried 1.5x -> snapped back to 2x');
  ok(p.toastText() && p.toastText().includes('kept'), 'toast says speed kept', p.toastText());
  p.advance(200);
  p.siteSetsSpeed(v, 1.75);                 // site tries again inside lock
  eq(v.playbackRate, 2, 'second override attempt also blocked');
}

/* ---------- 9. Manual change AFTER lock expires is respected ---------- */
group('9. Manual speed change after lock window respected & adopted');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  eq(v.playbackRate, 2, 'precondition: 2x set');
  p.advance(3100);                          // lock (3s) expired
  p.siteSetsSpeed(v, 1.75);                 // user picks 1.75x in player UI
  eq(v.playbackRate, 1.75, 'manual 1.75x stays after lock expiry');
  p.siteSetsSpeed(v, 1.25);                 // another manual tweak
  eq(v.playbackRate, 1.25, 'subsequent manual tweak also stays');
}

/* ---------- 10. After manual, arrows take over again ---------- */
group('10. After manual change, UP arrow takes control again');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  p.advance(3100);
  p.siteSetsSpeed(v, 1.25);                 // manual
  p.press('ArrowUp');                       // arrows take over (gap>200ms from last arrow)
  eq(v.playbackRate, 2, 'UP after manual -> 2x again');
  p.advance(3500);
  p.siteSetsSpeed(v, 1.5);                  // manual again
  p.advance(10);
  p.press('ArrowDown');
  eq(v.playbackRate, 1, 'DOWN after manual -> 1x again');
}

/* ---------- 11. Full lock lifecycle on DOWN ---------- */
group('11. Lock lifecycle for 1x');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  v.playbackRate = 2;
  p.press('ArrowDown');
  p.siteSetsSpeed(v, 2);                    // site tries to push back 2x inside lock
  eq(v.playbackRate, 1, 'lock keeps 1x against site override');
  p.advance(3100);
  p.siteSetsSpeed(v, 1.5);                  // manual after expiry
  eq(v.playbackRate, 1.5, 'after expiry manual wins');
}

/* ---------- 12. Typing guard ---------- */
group('12. Shortcuts ignored while typing');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  v.playbackRate = 1.5;
  const input = p.doc.createElement('input');
  p.doc.body.appendChild(input);
  const preventedUp = p.press('ArrowUp', { target: input });
  const preventedT  = p.press('t',       { target: input });
  eq(v.playbackRate, 1.5, 'ArrowUp inside <input> does NOT change speed');
  eq(preventedUp, false, 'ArrowUp not prevented while typing');
  eq(preventedT, false, 'T not prevented while typing');
  eq(p.isClean(), false, 'clean view not toggled while typing');

  const ta = p.doc.createElement('textarea');
  p.doc.body.appendChild(ta);
  p.press('ArrowDown', { target: ta });
  eq(v.playbackRate, 1.5, 'ArrowDown inside <textarea> also ignored');

  const editable = p.doc.createElement('div');
  Object.defineProperty(editable, 'isContentEditable', { value: true });
  p.doc.body.appendChild(editable);
  p.press('ArrowUp', { target: editable });
  eq(v.playbackRate, 1.5, 'contenteditable also ignored');
}

/* ---------- 13. Other keys untouched ---------- */
group('13. Unrelated keys pass through');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  eq(p.press('ArrowLeft'), false, 'ArrowLeft not intercepted');
  eq(p.press('ArrowRight'), false, 'ArrowRight not intercepted');
  eq(p.press(' '), false, 'Space not intercepted');
  eq(v.playbackRate, 1, 'speed untouched by other keys');
}

/* ---------- 14. No video on page -> arrows ignored ---------- */
group('14. No video present -> arrows not intercepted');
{
  const p = createPage();
  eq(p.press('ArrowUp'), false, 'ArrowUp not prevented when no video');
  eq(p.press('ArrowDown'), false, 'ArrowDown not prevented when no video');
}

/* ---------- 15. Multiple videos -> playing one controlled ---------- */
group('15. Multiple videos -> the playing one is controlled');
{
  const p = createPage();
  const paused  = p.addVideo({ playing: false });
  const playing = p.addVideo({ playing: true });
  p.press('ArrowUp');
  eq(playing.playbackRate, 2, 'playing video gets 2x');
  eq(paused.playbackRate, 1, 'paused video untouched');
}

/* ---------- 16. Video inside Shadow DOM ---------- */
group('16. Video inside shadow root still controlled');
{
  const p = createPage();
  const v = p.addShadowVideo({ playing: true });
  p.press('ArrowUp');
  eq(v.playbackRate, 2, 'shadow-DOM video gets 2x');
}

/* ---------- 17. Clean view toggle ---------- */
group('17. "t" hides toggles, "t" again brings them back');
{
  const p = createPage();
  const clutter = p.doc.createElement('div');
  clutter.className = 'player-toggle-bar';
  p.doc.body.appendChild(clutter);

  eq(p.isClean(), false, 'starts not-clean');
  const prevented = p.press('t');
  eq(p.isClean(), true, 'first T -> clean mode ON');
  eq(prevented, true, 'T key default prevented');
  ok(p.toastText() && p.toastText().includes('Clean view ON'), 'toast: clean ON', p.toastText());

  p.press('t');
  eq(p.isClean(), false, 'second T -> toggles back');
  ok(p.toastText() && p.toastText().includes('visible again'), 'toast: visible again');

  p.press('T');                             // capital T also works
  eq(p.isClean(), true, 'capital T also toggles clean view');
}

/* ---------- 18. T with modifiers NOT hijacked ---------- */
group('18. Ctrl/Cmd+T not hijacked');
{
  const p = createPage();
  const prevented = p.press('t', { ctrlKey: true });
  eq(p.isClean(), false, 'Ctrl+T does not toggle clean view');
  eq(prevented, false, 'Ctrl+T not prevented (browser new-tab safe)');
}

/* ---------- 19. Clean mode remembered per site ---------- */
group('19. Clean view restored per site on next visit');
{
  const p = createPage();
  p.press('t');                                  // enable clean
  const saved = p.win.chrome.storage.local._data['psc_clean_' + p.win.location.host];
  eq(saved, true, 'clean state saved to storage');

  const p2 = createPage({ prefillClean: true }); // new page load, storage prefilled
  eq(p2.isClean(), true, 'clean auto-reapplied on new page visit');
}

/* ---------- 20. SPA swap: speed follows the FRESH player, bg videos ignored ---------- */
group('20. SPA swap during lock: follows new player only');
{
  const p = createPage();
  const v1 = p.addVideo({ playing: true });
  p.press('ArrowUp');
  p.advance(500);                                  // still inside lock

  v1.remove();                                     // SPA swaps the player out
  const v2 = p.addVideo({ playing: true });
  p.loaded(v2);
  eq(v2.playbackRate, 2, 'fresh swapped-in player inherits 2x during lock');
  p.siteSetsSpeed(v2, 1.5);                        // site fights the NEW player
  eq(v2.playbackRate, 2, 'lock now protects the NEW video');

  const v3 = p.addVideo();                         // unrelated background video loads
  p.loaded(v3);
  eq(v3.playbackRate, 1, 'unrelated background video NOT forced');

  p.advance(3000);                                 // lock expired now
  const v4 = p.addVideo();
  p.loaded(v4);
  eq(v4.playbackRate, 1, 'after lock, fresh video NOT speed-forced');
}

/* ---------- 21. stopImmediatePropagation beats site handlers ---------- */
group('21. Site key handlers blocked for arrows');
{
  const p = createPage();
  p.addVideo({ playing: true });
  let siteSawArrow = 0, siteSawOther = 0;
  p.win.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') siteSawArrow++;
    if (e.key === 'ArrowLeft') siteSawOther++;
  }, true);
  p.press('ArrowUp');
  p.press('ArrowLeft');
  eq(siteSawArrow, 0, "site's own ArrowUp handler never runs");
  eq(siteSawOther, 1, 'unrelated keys still reach the site');
}

/* ---------- 22. Ratechange with same value = no-op (no crash loops) ---------- */
group('22. ratechange with same speed = harmless no-op');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  v.dispatchEvent(new p.win.Event('ratechange'));  // no actual change
  eq(v.playbackRate, 2, 'still 2x, no misbehaviour');
}

/* ---------- 23. pw.live page works too ---------- */
group('23. Works on pw.live lectures');
{
  const p = createPage({ url: 'https://www.pw.live/study/batches/batch-123/video' });
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  eq(v.playbackRate, 2, '2x on pw.live');
  p.advance(500);                                // gap > COMBO_MS so next pair is a fresh combo
  p.press('ArrowDown'); p.advance(50); p.press('ArrowUp');
  eq(v.playbackRate, 1.5, 'combo 1.5x on pw.live');
  p.press('t');
  eq(p.isClean(), true, 'clean view on pw.live');
}

/* ---------- 24. Static / packaging checks ---------- */
group('24. Static & packaging checks');
{
  const root = path.join(__dirname, '..', 'PW-Speed-Controller');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  eq(manifest.manifest_version, 3, 'manifest v3');
  ok(manifest.content_scripts[0].matches.some(m => m.includes('youtube.com')), 'YouTube match declared');
  ok(manifest.content_scripts[0].matches.some(m => m.includes('pw.live')), 'pw.live match declared');
  for (const f of [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css]) {
    ok(fs.existsSync(path.join(root, f)), 'content file exists: ' + f);
  }
  for (const size of ['16', '48', '128']) {
    ok(fs.existsSync(path.join(root, 'icons', 'icon' + size + '.png')), 'icon' + size + '.png exists');
  }
  const css = fs.readFileSync(path.join(root, 'clean.css'), 'utf8');
  ok(css.includes('.psc-clean'), 'clean.css hides under .psc-clean');
  ok(css.includes('!important'), 'clean.css uses !important for instant vanish');
  ok(css.includes('#psc-toast'), 'toast styled in css');
}

/* ================= BUG-HUNT REGRESSIONS (v1.3) ================= */

/* ---------- 25. BUG: fresh not-yet-loaded video was uncontrollable ---------- */
group('25. REGRESSION: fresh video (readyState 0) still controlled');
{
  const p = createPage();
  const v = p.doc.createElement('video');      // no readyState patch -> 0, paused
  p.doc.body.appendChild(v);
  p.press('ArrowUp');
  eq(v.playbackRate, 2, 'unloaded video still gets 2x (fallback to any video)');
  p.advance(500);                              // gap so this is NOT a combo
  const preventedDown = p.press('ArrowDown');
  eq(v.playbackRate, 1, 'unloaded video gets 1x too');
  eq(preventedDown, true, 'arrow still intercepted when a video exists');
}

/* ---------- 26. BUG: video inside same-origin iframe was unreachable ---------- */
group('26. REGRESSION: same-origin iframe video controlled');
{
  const p = createPage();
  const iframe = p.doc.createElement('iframe');
  p.doc.body.appendChild(iframe);
  const idoc = iframe.contentDocument;
  ok(!!idoc, 'iframe document accessible in test');
  const v = idoc.createElement('video');
  Object.defineProperty(v, 'readyState', { value: 2, configurable: true });
  idoc.body.appendChild(v);
  p.press('ArrowUp');                          // key pressed on TOP page
  eq(v.playbackRate, 2, 'iframe video gets 2x from top-page arrow');
}

/* ---------- 27. BUG: toast invisible in fullscreen ---------- */
group('27. REGRESSION: toast visible in fullscreen');
{
  const p = createPage();
  const wrapper = p.doc.createElement('div');
  const v = p.addVideo({ playing: true });
  wrapper.appendChild(v);
  p.doc.body.appendChild(wrapper);

  p.press('ArrowUp');
  ok(p.toastText() && p.doc.body.contains(p.doc.querySelector('#psc-toast')),
     'normal mode: toast lives in body');

  /* enter fullscreen on the player wrapper */
  Object.defineProperty(p.doc, 'fullscreenElement',
    { get: () => wrapper, configurable: true });
  p.advance(500);
  p.press('ArrowDown');
  eq(p.doc.querySelector('#psc-toast').parentNode, wrapper,
     'fullscreen: toast moved INSIDE fullscreen element (body not rendered)');
  eq(p.doc.querySelectorAll('#psc-toast').length, 1,
     'no orphan/duplicate toasts leaked');

  /* exit fullscreen */
  Object.defineProperty(p.doc, 'fullscreenElement',
    { get: () => null, configurable: true });
  p.advance(500);
  p.press('ArrowUp');
  eq(p.doc.querySelector('#psc-toast').parentNode, p.doc.body,
     'after exiting fullscreen: toast back in body');
  eq(p.doc.querySelectorAll('#psc-toast').length, 1,
     'still exactly one toast element');
}

/* ---------- 28. BUG: float jitter caused false snap/adopt ---------- */
group('28. REGRESSION: float-tolerant speed comparison');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');                              // desired 2x
  p.siteSetsSpeed(v, 2.00005);                     // tiny browser jitter within lock
  eq(v.playbackRate, 2.00005, 'jitter within EPS not treated as override (no snap)');
  p.siteSetsSpeed(v, 1.98);                        // real override within lock
  eq(v.playbackRate, 2, 'real override still snapped back to 2x');
}

/* ---------- 29. BUG: clean view could blank the whole player ---------- */
group('29. REGRESSION: clean view protects video-wrapping containers');
{
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'PW-Speed-Controller', 'clean.css'), 'utf8');
  const generic = css.match(/\[class\*="toggle"\][^\n]*/g) || [];
  ok(generic.length > 0 && generic.every(s => s.includes(':not(:has(video, iframe))')),
     'generic toggle selectors guard video/iframe-wrapping ancestors');
  ok((css.match(/:not\(:has\(video, iframe\)\)/g) || []).length >= 10,
     'all clutter selector groups carry the wrapper guard');
}

/* ---------- 30. Fast-path sanity: top-level video wins, no deep walk needed ---------- */
group('30. Fast path: top-level video controlled instantly');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });        // plain top-level video
  p.press('ArrowUp');
  eq(v.playbackRate, 2, 'top-level video 2x via fast path');
  p.press('t');
  eq(p.isClean(), true, 'clean toggle unaffected by video lookup changes');
}

/* ================= HARDCORE ATTACK TESTS (v1.4) ================= */

/* ---------- 31. ATTACK: system clock jumps backwards -> phantom combo ---------- */
group('31. ATTACK: clock jumps backwards -> NO phantom combo');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');                              // lastArrow = Up @ T0
  p.win.__fakeNow = p.now() - 60000;               // user/system clock jumps BACK 60s
  p.press('ArrowDown');                            // negative gap must NOT combo
  eq(v.playbackRate, 1, 'plain 1x — no phantom 1.5x from time travel');
}

/* ---------- 32. ATTACK: modifier+arrow hijack of browser/OS shortcuts ---------- */
group('32. ATTACK: Ctrl/Alt/Meta + arrows NOT hijacked');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  v.playbackRate = 2;
  const prevented = p.press('ArrowUp', { ctrlKey: true });
  eq(prevented, false, 'Ctrl+ArrowUp not prevented');
  eq(v.playbackRate, 2, 'Ctrl+ArrowUp does not change speed');
  eq(p.press('ArrowDown', { altKey: true }), false, 'Alt+ArrowDown passes through');
  eq(v.playbackRate, 2, 'Alt+ArrowDown no speed change');
  /* modifier arrow must also not seed the combo tracker */
  p.press('ArrowUp', { ctrlKey: true });
  p.advance(50);
  p.press('ArrowDown');
  eq(v.playbackRate, 1, 'Ctrl+Up then Down = plain 1x (modifier press not combo-seeded)');
}

/* ---------- 33. ATTACK: background video fights during lock ---------- */
group('33. ATTACK: lock protects ONLY our video, not background ones');
{
  const p = createPage();
  const v1 = p.addVideo({ playing: true });
  const v2 = p.addVideo({ playing: false });       // background/preview video
  p.press('ArrowUp');                              // locks v1 @ 2x
  p.siteSetsSpeed(v2, 0.5);                        // bg video changes inside lock
  eq(v2.playbackRate, 0.5, 'background video left alone during lock');
  p.siteSetsSpeed(v1, 1.5);                        // our video attacked
  eq(v1.playbackRate, 2, 'locked video still snapped back to 2x');
}

/* ---------- 34. ATTACK: rapid alternation stress (mashing) ---------- */
group('34. ATTACK: arrow mashing stays sane');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  /* alternate arrows every 100ms -> every second press is inside combo window */
  for (let i = 0; i < 10; i++) {
    p.press(i % 2 ? 'ArrowDown' : 'ArrowUp');
    p.advance(100);
  }
  ok([1, 1.5, 2].includes(v.playbackRate),
     'final speed is always a valid value, never NaN/garbage', String(v.playbackRate));
  ok(typeof v.playbackRate === 'number' && v.playbackRate > 0, 'rate stays a sane number');
}

/* ---------- 35. ATTACK: typing inside SHADOW DOM input (PW/Ionic style) ---------- */
group('35. ATTACK: typing in shadow-DOM input must not hijack arrows');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  v.playbackRate = 1.5;
  const host = p.doc.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const innerInput = p.doc.createElement('input');
  shadow.appendChild(innerInput);
  p.doc.body.appendChild(host);

  const ev = new p.win.KeyboardEvent('keydown',
    { key: 'ArrowUp', bubbles: true, cancelable: true, composed: true });
  innerInput.dispatchEvent(ev);                    // e.target retargets to host!
  eq(v.playbackRate, 1.5, 'shadow input typing: speed untouched');
  eq(ev.defaultPrevented, false, 'shadow input typing: event not prevented');

  const ev2 = new p.win.KeyboardEvent('keydown',
    { key: 't', bubbles: true, cancelable: true, composed: true });
  innerInput.dispatchEvent(ev2);
  eq(p.isClean(), false, 'shadow input typing: clean view not toggled');
}

/* ---------- 36. ATTACK: iframe video enforcement (snap-back inside iframe) ---------- */
group('36. ATTACK: iframe-video lock actually snaps back');
{
  const p = createPage();
  const iframe = p.doc.createElement('iframe');
  p.doc.body.appendChild(iframe);
  const v = iframe.contentDocument.createElement('video');
  Object.defineProperty(v, 'readyState', { value: 2, configurable: true });
  iframe.contentDocument.body.appendChild(v);

  p.press('ArrowUp');                              // lock iframe video @ 2x
  p.siteSetsSpeed(v, 1.5);                         // site fights inside iframe
  eq(v.playbackRate, 2, 'iframe video snapped back to 2x (element-level listener)');
}

/* ---------- 37. ATTACK: hostile page (events thrown at weird targets) ---------- */
group('37. ATTACK: malformed/weird events never crash extension');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  /* manually constructed ratechange with non-video target */
  const div = p.doc.createElement('div');
  div.dispatchEvent(new p.win.Event('ratechange'));
  /* loadedmetadata on a div */
  div.dispatchEvent(new p.win.Event('loadedmetadata'));
  /* keydown with garbage key */
  p.win.dispatchEvent(new p.win.KeyboardEvent('keydown', { key: undefined, bubbles: true }));
  eq(v.playbackRate, 2, 'speed unaffected by garbage events');
  eq(p.isClean(), false, 'clean view unaffected by garbage events');
}

/* ---------- 38. ATTACK: holding T (auto-repeat) must not flicker ---------- */
group('38. ATTACK: holding T does not flicker clean view');
{
  const p = createPage();
  p.press('t');                                    // first press -> ON
  eq(p.isClean(), true, 'T press -> clean ON');
  p.advance(60); p.press('t', { repeat: true });   // held key auto-repeats
  p.advance(60); p.press('t', { repeat: true });
  p.advance(60); p.press('t', { repeat: true });
  eq(p.isClean(), true, 'repeat events ignored — stays ON, no flicker');
  p.advance(60); p.press('t');                     // genuine second press
  eq(p.isClean(), false, 'real second press -> OFF');
}

/* ---------- 39. ATTACK: background autoplay must not steal arrows during lock ---------- */
group('39. ATTACK: background autoplay video cannot steal arrows mid-lock');
{
  const p = createPage();
  const v1 = p.addVideo({ playing: true });
  p.press('ArrowUp');                              // lock v1 @ 2x
  /* v1 pauses (buffering), bg preview v2 starts playing mid-lock */
  Object.defineProperty(v1, 'paused', { get: () => true, configurable: true });
  const v2 = p.addVideo({ playing: true });
  v2.playbackRate = 3;
  p.advance(500);                                  // beat combo window, still inside lock
  p.press('ArrowDown');                            // must still target locked v1
  eq(v1.playbackRate, 1, 'during lock: arrows hit LOCKED video (v1 -> 1x)');
  eq(v2.playbackRate, 3, 'background video untouched by arrows during lock');
  p.advance(3100);                                 // lock expires
  p.press('ArrowUp');                              // now normal detection resumes
  eq(v2.playbackRate, 2, 'after lock: arrows follow current playing video again');
}

/* ================= ROUND 3: PRECISION & INJECTION ATTACKS ================= */

/* ---------- 40. ATTACK: double injection of the extension ---------- */
group('40. ATTACK: script injected twice -> second copy is inert');
{
  const p = createPage();                 // first injection already inside
  p.win.eval(SRC);                        // ATTACK: inject again
  p.win.eval(SRC);                        // ...and again for good measure
  const v = p.addVideo({ playing: true });

  p.press('t');
  eq(p.isClean(), true, 'single T press = exactly ONE toggle (no cancel-out)');
  p.press('t');
  eq(p.isClean(), false, 'second T = back to normal');

  p.press('ArrowUp');
  eq(v.playbackRate, 2, 'arrows still work after duplicate injection');
  eq(p.doc.querySelectorAll('#psc-toast').length, 1, 'still exactly ONE toast element');
}

/* ---------- 41. PRECISION: combo window boundary 200ms / 201ms ---------- */
group('41. PRECISION: combo boundary at exactly 200/201ms');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  p.advance(200);                          // EXACTLY at the window edge
  p.press('ArrowDown');
  eq(v.playbackRate, 1.5, 'gap == 200ms -> combo fires');

  p.advance(1000);
  p.press('ArrowUp');
  p.advance(201);                          // ONE ms past the window
  p.press('ArrowDown');
  eq(v.playbackRate, 1, 'gap == 201ms -> plain 1x, no combo');
}

/* ---------- 42. PRECISION: lock boundary at 2999ms / 3000ms ---------- */
group('42. PRECISION: lock expiry boundary');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');                      // lock = now + 3000ms
  p.advance(2999);                         // last millisecond of the lock
  p.siteSetsSpeed(v, 1.5);
  eq(v.playbackRate, 2, 'override at 2999ms -> still snapped back');
  p.advance(2);                            // now exactly past expiry
  p.siteSetsSpeed(v, 1.5);
  eq(v.playbackRate, 1.5, 'override at 3001ms -> adopted as manual');
}

/* ---------- 43. ATTACK: truly simultaneous arrows (0ms gap) ---------- */
group('43. ATTACK: 0ms simultaneous ↑+↓ combo');
{
  const p = createPage();
  const v = p.addVideo({ playing: true });
  p.press('ArrowUp');
  p.press('ArrowDown');                    // same millisecond
  eq(v.playbackRate, 1.5, '0ms gap -> combo still fires');
}

/* ---------- 44. ATTACK: tiny ad video vs big lecture player ---------- */
group('44. ATTACK: largest video wins when nothing is playing');
{
  const p = createPage();
  const ad = p.doc.createElement('video');
  Object.defineProperty(ad, 'videoWidth',  { value: 320, configurable: true });
  Object.defineProperty(ad, 'videoHeight', { value: 180, configurable: true });
  p.doc.body.appendChild(ad);              // FIRST in DOM (old code would pick this!)

  const lecture = p.doc.createElement('video');
  Object.defineProperty(lecture, 'videoWidth',  { value: 1280, configurable: true });
  Object.defineProperty(lecture, 'videoHeight', { value: 720,  configurable: true });
  p.doc.body.appendChild(lecture);

  p.press('ArrowUp');
  eq(lecture.playbackRate, 2, 'big lecture player gets 2x');
  eq(ad.playbackRate, 1, 'tiny ad video ignored');
}

/* ---------- 45. stale lockedVideo released after SPA teardown ---------- */
group('45. Stale lock released after player removed + lock expired');
{
  const p = createPage();
  const v1 = p.addVideo({ playing: true });
  p.press('ArrowUp');                      // lock v1
  v1.remove();                             // player torn down
  p.advance(3500);                         // lock expires
  const v2 = p.addVideo({ playing: true });
  v2.playbackRate = 1;
  p.press('ArrowDown');                    // cleanly retargets v2 (creates fresh 1x lock)
  eq(v2.playbackRate, 1, 'arrows cleanly target the live player (no crash, no stale ref)');
  p.advance(3100);                         // let THAT fresh lock expire too
  p.siteSetsSpeed(v2, 1.5);
  eq(v2.playbackRate, 1.5, 'after all locks expire, manual change on v2 persists');
  p.siteSetsSpeed(v1, 0.25);               // dead video's ghost must never act
  eq(v1.playbackRate, 0.25, 'no ghost-enforcement from the dead video');
  eq(v2.playbackRate, 1.5, '...and it never touches the live video either');
}

/* ================= summary ================= */
console.log('\n════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
if (failed) { console.log('  FAILURES:\n   - ' + failures.join('\n   - ')); process.exit(1); }
console.log('  ALL FEATURES WORKING ✅');
console.log('════════════════════════════════════');
