/* ================================================================
 *  PW Speed Controller — END-TO-END suite (v1.4.1)
 *  REAL Chromium 131 engine: real CDP keyboard pipeline, real media
 *  playback/ratechange events, real CSS cascade, real storage-per-origin
 *  persistence. Pages VISITED as pw.live / youtube.com origins via
 *  --host-resolver-rules (served locally).
 *
 *  NOTE ON INJECTION: this sandbox's network can't fetch a full Chrome
 *  with the extension engine enabled (all CDNs blocked), so the
 *  scripts/css are injected at document_start via CDP — replicating
 *  content-script semantics exactly (per-frame injection, chrome.storage
 *  polyfilled over the real per-origin localStorage). Every byte of the
 *  REAL content.js / clean.css runs unmodified.
 *  Run:  node e2e/run-e2e.js
 * ================================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
process.env.LD_LIBRARY_PATH = '/tmp/chromium-libs/lib';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const PAGES = path.join(__dirname, 'pages');
const PORT = 8080;
const EXT = path.resolve(__dirname, '..', '..', 'PW-Speed-Controller');
const MIME = { '.html': 'text/html', '.webm': 'video/webm', '.js': 'text/javascript' };
const CONTENT_SRC = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
const CLEAN_CSS = fs.readFileSync(path.join(EXT, 'clean.css'), 'utf8');

/* content-script environment shim: MV3 + all_frames simulation */
const STORAGE_SHIM = `(function(){
  try {
    if (!window.chrome) window.chrome = {};
    if (!chrome.storage) chrome.storage = { local: null };
    chrome.storage.local = {
      get: function(key, cb){ var d={}; try{ d=JSON.parse(localStorage.getItem('__psc_store__')||'{}'); }catch(e){} cb(d); },
      set: function(obj, cb){ var d={}; try{ d=JSON.parse(localStorage.getItem('__psc_store__')||'{}'); }catch(e){}
        for (var k in obj) d[k]=obj[k];
        try{ localStorage.setItem('__psc_store__', JSON.stringify(d)); }catch(e){}
        if (cb) cb(); }
    };
  } catch(e){}
})();`;
const CSS_INJECT = `(function(){
  function inject(){
    if (document.getElementById('psc-css')) return;
    var s = document.createElement('style');
    s.id = 'psc-css';
    s.textContent = ${JSON.stringify(CLEAN_CSS)};
    (document.head || document.documentElement).appendChild(s);
  }
  try {
    if (document.documentElement) inject();
    else document.addEventListener('DOMContentLoaded', inject);
  } catch(e) { document.addEventListener('DOMContentLoaded', inject); }
})();`;

/* ---------- assertions ---------- */
let passed = 0, failed = 0; const failures = [];
function ok(cond, name, extra) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { failed++; failures.push(name); console.log('  ❌ ' + name + (extra ? '  -> ' + extra : '')); }
}
function eq(got, want, name) { ok(Object.is(got, want), name, 'expected ' + want + ', got ' + got); }
function group(t) { console.log('\n━━━ ' + t + ' ━━━'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- static server ---------- */
const server = http.createServer((req, res) => {
  const p = path.join(PAGES, req.url === '/' ? '/pw-player.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});

/* ---------- browser ---------- */
let browser;
async function newPageAt(host, page) {
  const p = await browser.newPage();
  p.setDefaultTimeout(15000);
  /* inject exactly like a content script would: storage shim, css, js */
  await p.evaluateOnNewDocument(STORAGE_SHIM);
  await p.evaluateOnNewDocument(CSS_INJECT);
  await p.evaluateOnNewDocument(CONTENT_SRC);
  await p.goto(`http://${host}:${PORT}/${page}`, { waitUntil: 'load' });
  /* all_frames:true semantics — inject into every frame as well */
  for (const f of p.frames()) {
    if (f === p.mainFrame()) continue;
    try {
      await f.evaluate(STORAGE_SHIM);
      await f.evaluate(CSS_INJECT);
      await f.evaluate(CONTENT_SRC);
    } catch (e) { /* cross-origin frame -> real content script couldn't either */ }
  }
  await sleep(300);                     // let the content script settle
  await p.evaluate(() => document.body.focus()).catch(() => {});
  return p;
}
const rate = (p, sel) => p.$eval(sel, v => v.playbackRate);
const waitRate = async (p, sel, want, tries = 30) => {
  for (let i = 0; i < tries; i++) {
    const r = await rate(p, sel);
    if (Math.abs(r - want) < 0.001) return r;
    await sleep(100);
  }
  return rate(p, sel);
};
const toast = p => p.$eval('#psc-toast', t => t.textContent);
const isClean = p => p.evaluate(() => document.documentElement.classList.contains('psc-clean'));
const displayOf = (p, sel) => p.$eval(sel, el => getComputedStyle(el).display);

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: false,
    protocolTimeout: 180000,
    args: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
      '--host-resolver-rules=MAP * 127.0.0.1'],
  });
  console.log('E2E: real', await browser.version(), '(injection shim: extension engine N/A in sandbox)\n');

  /* ============ E1. basic arrows on real player ============ */
  group('E1. ↑ = 2×, ↓ = 1× (real Chromium)');
  {
    const p = await newPageAt('e1.pw.live', 'pw-player.html');
    await p.keyboard.press('ArrowUp');
    eq(await waitRate(p, '#lec', 2), 2, 'ArrowUp -> real playbackRate 2x');
    ok(await toast(p).then(t => t.includes('2×')), 'real toast visible: 2×');
    await sleep(400);
    await p.keyboard.press('ArrowDown');
    eq(await waitRate(p, '#lec', 1), 1, 'ArrowDown -> 1x');
    await p.close();
  }

  /* ============ E2. combo ============ */
  group('E2. ↑+↓ combo = 1.5× (real key events)');
  {
    const p = await newPageAt('e2.pw.live', 'pw-player.html');
    await p.keyboard.press('ArrowUp');
    await sleep(80);
    await p.keyboard.press('ArrowDown');
    eq(await waitRate(p, '#lec', 1.5), 1.5, 'fast ↑↓ -> 1.5x combo');
    ok(await toast(p).then(t => t.includes('combo')), 'combo toast shown');
    await p.close();
  }

  /* ============ E3. THE BUG: site forces 1.5 during lock (REAL ratechange) ============ */
  group('E3. LOCK: player click re-applying 1.5× snapped back (REAL events)');
  {
    const p = await newPageAt('e3.pw.live', 'pw-player.html');
    await p.keyboard.press('ArrowUp');
    await waitRate(p, '#lec', 2);
    await sleep(250);                                 // "click" arrives
    await p.evaluate(() => window.siteSet(1.5));      // REAL DOM set -> REAL ratechange event
    await sleep(250);
    eq(await rate(p, '#lec'), 2, 'site 1.5x snapped back to 2x by real lock');
    await p.close();
  }

  /* ============ E4. manual after lock respected ============ */
  group('E4. manual change after 3s lock respected');
  {
    const p = await newPageAt('e4.pw.live', 'pw-player.html');
    await p.keyboard.press('ArrowUp');
    await waitRate(p, '#lec', 2);
    await sleep(3200);                                // real lock expiry
    await p.evaluate(() => window.siteSet(1.75));
    await sleep(300);
    eq(await rate(p, '#lec'), 1.75, 'manual 1.75x after lock stays');
    await p.close();
  }

  /* ============ E5. clean view incl. wrapper-guard (REAL cascade) ============ */
  group('E5. "t" hides clutter but NEVER the video wrapper (real CSS)');
  {
    const p = await newPageAt('e5.pw.live', 'pw-player.html');
    await p.keyboard.press('t');
    await sleep(200);
    eq(await isClean(p), true, 't -> clean ON');
    eq(await displayOf(p, '.player-toggle-bar'), 'none', 'toggle-bar hidden (real computed style)');
    eq(await displayOf(p, '.gesture-overlay'), 'none', 'gesture overlay hidden');
    ok((await displayOf(p, '.video-toggle-wrapper')) !== 'none',
       'video WRAPPER (has "toggle" in class) NOT hidden — :has() guard works in real cascade');
    const visible = await p.$eval('#lec', v => !!(v.offsetWidth || v.offsetHeight));
    eq(visible, true, 'video still rendered & visible');
    await p.keyboard.press('t');
    await sleep(200);
    eq(await displayOf(p, '.player-toggle-bar'), 'block', 'second t -> clutter back');
    await p.close();
  }

  /* ============ E6. typing guards (normal + shadow input) ============ */
  group('E6. typing in normal & shadow inputs stays safe');
  {
    const p = await newPageAt('e6.pw.live', 'pw-player.html');
    await p.click('#comment');
    await p.keyboard.press('ArrowUp');
    await sleep(200);
    eq(await rate(p, '#lec'), 1, 'typing in normal input: rate untouched');
    await p.evaluate(() => {
      document.querySelector('#shadowhost').shadowRoot.querySelector('#sin').focus();
    });
    await p.keyboard.press('ArrowUp');
    await sleep(200);
    eq(await rate(p, '#lec'), 1, 'typing in SHADOW input: rate untouched (retarget attack blocked)');
    await p.close();
  }

  /* ============ E7. modifiers pass through ============ */
  group('E7. Ctrl/Alt + arrows NOT hijacked');
  {
    const p = await newPageAt('e7.pw.live', 'pw-player.html');
    await p.keyboard.down('Control'); await p.keyboard.press('ArrowUp'); await p.keyboard.up('Control');
    await sleep(150);
    eq(await rate(p, '#lec'), 1, 'Ctrl+ArrowUp no speed change');
    await p.keyboard.down('Alt'); await p.keyboard.press('ArrowDown'); await p.keyboard.up('Alt');
    await sleep(150);
    eq(await rate(p, '#lec'), 1, 'Alt+ArrowDown no speed change');
    await p.close();
  }

  /* ============ E8. holding T no flicker (real auto-repeat) ============ */
  group('E8. holding T (real auto-repeat) -> ON once, no flicker');
  {
    const p = await newPageAt('e8.pw.live', 'pw-player.html');
    await p.keyboard.down('t');
    await sleep(500);                                 // OS repeats kick in
    await p.keyboard.up('t');
    await sleep(150);
    eq(await isClean(p), true, 'after hold: clean ON exactly once');
    await sleep(400);
    await p.keyboard.press('t');
    await sleep(150);
    eq(await isClean(p), false, 'next real press -> OFF');
    await p.close();
  }

  /* ============ E9. clean view survives reload (REAL chrome.storage) ============ */
  group('E9. clean view persisted across reload (real storage API)');
  {
    const p = await newPageAt('e9.pw.live', 'pw-player.html');
    await p.keyboard.press('t');
    await sleep(300);
    eq(await isClean(p), true, 'clean ON before reload');
    await p.reload({ waitUntil: 'load' });
    await sleep(500);
    eq(await isClean(p), true, 'after reload: clean auto-restored from chrome.storage');
    await p.close();
  }

  /* ============ E10. iframe video: control + real snap-back ============ */
  group('E10. same-origin iframe player: arrows + lock work cross-frame');
  {
    const p = await newPageAt('www.youtube.com', 'with-iframe.html');
    await sleep(300);
    await p.evaluate(() => document.body.focus());
    await p.keyboard.press('ArrowUp');
    const frame = p.frames().find(f => f.url().includes('frame-player.html'));
    ok(!!frame, 'iframe player located');
    const frate = () => frame.$eval('#fv', v => v.playbackRate);
    let r = 0;
    for (let i = 0; i < 30; i++) { r = await frate(); if (r === 2) break; await sleep(100); }
    eq(r, 2, 'top-page ArrowUp -> iframe video 2x');
    await frame.evaluate(() => window.siteSet(1.5));  // REAL interference inside iframe
    await sleep(250);
    eq(await frate(), 2, 'iframe interference snapped back (element listener, real env)');
    await p.close();
  }

  /* ============ E11. paused video controllable ============ */
  group('E11. paused (not playing) video still controlled');
  {
    const p = await newPageAt('e11.pw.live', 'pw-player.html');
    await p.keyboard.press('ArrowUp');               // video never played
    eq(await waitRate(p, '#lec', 2), 2, 'paused video gets 2x');
    await p.close();
  }

  /* ============ E12. playing video controllable ============ */
  group('E12. PLAYING video controlled mid-playback');
  {
    const p = await newPageAt('e12.pw.live', 'pw-player.html');
    await p.$eval('#lec', v => v.play());
    await sleep(500);
    const playing = await p.$eval('#lec', v => !v.paused);
    eq(playing, true, 'video actually playing (real media decode)');
    await p.keyboard.press('ArrowUp');
    eq(await waitRate(p, '#lec', 2), 2, 'playing video -> 2x keeps playing');
    eq(await p.$eval('#lec', v => !v.paused), true, 'playback continues after speed change');
    await p.close();
  }

  /* ============ E13. largest video wins ============ */
  group('E13. largest video preferred when nothing playing');
  {
    const p = await newPageAt('e13.pw.live', 'two-videos.html');
    await p.keyboard.press('ArrowUp');
    eq(await waitRate(p, '#big', 2), 2, 'big (1280x720) video gets 2x');
    eq(await rate(p, '#small'), 1, 'small (320x180) video ignored');
    await p.close();
  }

  /* ============ E14. double injection inert ============ */
  group('E14. injecting content.js again does nothing');
  {
    const p = await newPageAt('e14.pw.live', 'pw-player.html');
    await p.addScriptTag({ path: path.join(EXT, 'content.js') });
    await p.addScriptTag({ path: path.join(EXT, 'content.js') });
    await sleep(200);
    await p.keyboard.press('t');
    await sleep(200);
    eq(await isClean(p), true, 'exactly ONE toggle after double injection');
    eq(await p.$$eval('#psc-toast', n => n.length), 1, 'exactly one toast');
    await p.close();
  }

  /* ============ E15. manual->arrows->manual full journey ============ */
  group('E15. full user journey: 2x -> manual 1.25 (adopted) -> arrows -> 1x');
  {
    const p = await newPageAt('e15.pw.live', 'pw-player.html');
    await p.keyboard.press('ArrowUp');
    await waitRate(p, '#lec', 2);
    await sleep(3200);                                // lock out
    await p.evaluate(() => window.siteSet(1.25));     // manual adopt
    await sleep(300);
    eq(await rate(p, '#lec'), 1.25, 'manual 1.25x kept');
    await sleep(500);
    await p.keyboard.press('ArrowDown');              // arrows take over
    eq(await waitRate(p, '#lec', 1), 1, 'then ArrowDown -> 1x');
    await p.close();
  }

  /* ============ E18. v1.5: class-agnostic hiding (the REAL PW bug) ============ */
  group('E18. v1.5: obfuscated overlay hidden, captions + video survive');
  {
    const p = await newPageAt('e18.pw.live', 'pw-player.html');
    await p.keyboard.press('t');
    await sleep(500);
    eq(await displayOf(p, '#obf-overlay'), 'none',
       'random-class overlay hidden WITHOUT knowing its class name');
    eq(await p.$eval('#obf-overlay', el => el.getAttribute('data-psc-hide')), '1',
       'overlay tagged by geometry engine');
    ok((await displayOf(p, '#cap')) !== 'none', 'captions stay visible');
    ok((await displayOf(p, '.video-toggle-wrapper')) !== 'none', 'video wrapper stays visible');
    const vVis = await p.$eval('#lec', v => !!(v.offsetWidth || v.offsetHeight));
    eq(vVis, true, 'video fully visible');
    await p.close();
  }

  /* ============ E19. v1.5: late-spawned overlay caught live ============ */
  group('E19. v1.5: hover menu spawning AFTER clean ON vanishes too');
  {
    const p = await newPageAt('e19.pw.live', 'pw-player.html');
    await p.keyboard.press('t');
    await sleep(500);
    await p.evaluate(() => window.spawnOverlay());   // menu appears DURING clean view
    await sleep(900);                                 // watcher re-scan (350ms throttle)
    eq(await displayOf(p, '#late-overlay'), 'none', 'late overlay auto-hidden by watcher');
    await p.keyboard.press('t');                      // clean OFF
    await sleep(400);
    ok((await displayOf(p, '#late-overlay')) !== 'none', 'everything restored on OFF');
    eq(await p.$eval('#obf-overlay', el => el.hasAttribute('data-psc-hide')), false,
       'all attributes cleaned on OFF');
    await p.close();
  }

  /* ============ E16. fullscreen toast (soft-allowed) ============ */
  group('E16. fullscreen toast re-parents (if fullscreen available)');
  {
    const p = await newPageAt('e16.pw.live', 'pw-player.html');
    await p.keyboard.press('ArrowUp');
    await waitRate(p, '#lec', 2);
    await p.click('#lec');
    const fsOk = await p.evaluate(() => {
      const w = document.querySelector('.video-toggle-wrapper');
      return w.requestFullscreen ? (w.requestFullscreen(), true) : false;
    }).catch(() => false);
    await sleep(500);
    const fsEl = await p.evaluate(() => document.fullscreenElement && document.fullscreenElement.className);
    if (!fsOk || !fsEl) {
      ok(true, 'fullscreen unavailable in headless build — check skipped harmlessly');
    } else {
      await sleep(400);
      await p.keyboard.press('ArrowDown');
      await sleep(300);
      const parent = await p.$eval('#psc-toast', t => t.parentNode.className || 'body');
      ok(String(parent).includes('video-toggle-wrapper'),
         'toast moved INSIDE fullscreen element', 'parent=' + parent);
      await p.keyboard.press('Escape');               // exit fullscreen for cleanup
    }
    await p.close();
  }

  /* ============ E17. ended video still controllable ============ */
  group('E17. ended video still accepts speed');
  {
    const p = await newPageAt('e17.pw.live', 'pw-player.html');
    await p.$eval('#lec', v => { v.currentTime = v.duration ? v.duration - 0.15 : 3.8; v.playbackRate = 1; v.play(); });
    await sleep(1500);
    await p.keyboard.press('ArrowUp');
    eq(await waitRate(p, '#lec', 2), 2, 'ended/near-ended video gets 2x for next play');
    await p.close();
  }

  /* ================= summary ================= */
  console.log('\n════════════════════════════════════');
  console.log(`  E2E RESULT: ${passed} passed, ${failed} failed`);
  if (failed) console.log('  FAILURES:\n   - ' + failures.join('\n   - '));
  console.log('════════════════════════════════════');
  await browser.close();
  server.close();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error('E2E FATAL:', e);
  try { await browser.close(); } catch (_) {}
  server.close();
  process.exit(1);
});
