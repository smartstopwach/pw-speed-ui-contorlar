# 🧪 Test Report — PW Speed Controller v1.3

**Date:** 2026-09-18
**Method:** Automated jsdom simulation — the REAL `content.js` runs against
mock YouTube / pw.live pages with real KeyboardEvents, ratechange events,
shadow DOM, storage, and timing control (84 assertions, 30 groups).

## ✅ Result: 84/84 PASSED — ALL FEATURES WORKING

## 🐛➜🔧 Bug-hunt round (v1.3): 6 bugs found & fixed

| # | Bug | Fix | Regression test |
|---|---|---|---|
| 1 | Every keypress walked the WHOLE DOM tree (~10–20k nodes) → jank; fresh not-yet-loaded videos (readyState 0) were ignored by arrows | Fast native lookup first; shadow-DOM/iframe fallbacks; "any video" fallback | Groups 25, 30 |
| 2 | Toast was invisible in fullscreen (appended to `<body>`, which isn't rendered in fullscreen) | Toast lives inside the fullscreen element; re-parenting moves the same node (no duplicate leaks) | Group 27 |
| 3 | Clean view could BLANK the whole player if a video-wrapping ancestor had "toggle/gesture" in its class | All clutter selectors now guard with `:not(:has(video))` | Group 29 |
| 4 | Strict float compare (`playbackRate === desired`) misfired on tiny browser jitter | EPS tolerance (0.001) | Group 28 |
| 5 | Videos inside same-origin iframes (embedded players) were uncontrollable from top page | Same-origin iframe scan as last resort | Group 26 |
| 6 | First toast fix could leak orphan duplicate toasts on fullscreen enter/exit | Node is moved, not re-created — exactly one toast always | Group 27 |

| # | Test group | Checks | Status |
|---|---|---|---|
| 1 | ↑ Up arrow = 2× | rate, defaultRate, scroll blocked, toast | ✅ |
| 2 | ↓ Down arrow = 1× | rate + toast | ✅ |
| 3 | Combo ↑+↓ within 200ms = 1.5× | rate + combo toast | ✅ |
| 4 | Combo ↓+↑ (reversed order) = 1.5× | rate | ✅ |
| 5 | Gap > 200ms = NO combo | second arrow acts normal | ✅ |
| 6 | After combo, single ↑ = 2× | state reset works | ✅ |
| 7 | Holding ↑ (auto-repeat) | stays 2×, no false combo | ✅ |
| 8 | **BUG: ↑ + click → 1.5× drop** | snapped back to 2×, repeat attempts blocked | ✅ |
| 9 | Manual change after lock (3s) | respected + adopted (1.75×, 1.25×) | ✅ |
| 10 | After manual, arrows take over | ↑→2×, ↓→1× again | ✅ |
| 11 | Lock lifecycle for 1× | site override blocked, manual wins later | ✅ |
| 12 | Typing guard | input / textarea / contenteditable safe | ✅ |
| 13 | Other keys untouched | ←, →, Space pass through | ✅ |
| 14 | No video on page | arrows not intercepted | ✅ |
| 15 | Multiple videos | only the PLAYING video controlled | ✅ |
| 16 | Shadow DOM video | detected + controlled | ✅ |
| 17 | "t" toggle | hide → show → capital T works, toasts | ✅ |
| 18 | Ctrl+T safe | browser new-tab shortcut not hijacked | ✅ |
| 19 | Clean view remembered | saved + auto-restored per site | ✅ |
| 20 | New video during lock | inherits 2×; after lock not forced | ✅ |
| 21 | Site key handlers blocked | stopImmediatePropagation wins for arrows only | ✅ |
| 22 | No-op ratechange | no crash loops | ✅ |
| 23 | Full pw.live flow | 2× → combo 1.5× → clean view | ✅ |
| 24 | Packaging | manifest v3, matches, icons, files, CSS rules | ✅ |
| 25 | REGRESSION: unloaded (readyState 0) video | 2×, 1×, interception all work | ✅ |
| 26 | REGRESSION: same-origin iframe video | controlled from top page | ✅ |
| 27 | REGRESSION: fullscreen toast | moves into fullscreen element, no leaks, returns to body | ✅ |
| 28 | REGRESSION: float-tolerant compare | jitter ignored, real override snapped | ✅ |
| 29 | REGRESSION: wrapper-guard in CSS | `:not(:has(video))` on all clutter groups | ✅ |
| 30 | Fast path | top-level video instant control | ✅ |

## 📦 Zip integrity
- Top-level entries: exactly **one folder** (`PW-Speed-Controller`) ✅
- CRC/integrity check: OK (11 entries) ✅

## 🔁 Re-run anytime
```bash
cd tests
npm install      # first time only
npm test         # or: node run-tests.js
```

> Note: jsdom simulates the DOM/keyboard player-side. The remaining
> real-world variable is PW's specific overlay class names for clean-view —
> if any toggle survives "T", add its class in `clean.css` (bottom section).
