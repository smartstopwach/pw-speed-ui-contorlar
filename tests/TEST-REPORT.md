# 🧪 Test Report — PW Speed Controller v1.4 (HARDCORE EDITION)

**Date:** 2026-09-18
**Method:** Automated jsdom adversarial simulation — the REAL `content.js` runs
against mock YouTube / pw.live pages with real KeyboardEvents, ratechange/loadedmetadata
events, shadow DOM, same-origin iframes, fullscreen state, storage, and full
time control (clock jumps, auto-repeat, lock expiry).
**108 assertions · 39 groups · 0 failures**

## ✅ Result: 108/108 PASSED — ALL FEATURES + ALL ATTACKS SURVIVED

---

## 🐛➜🔧 Total bugs found & fixed across rounds: 14

### Round v1.3 (deep review)
| # | Bug | Fix |
|---|---|---|
| 1 | Whole-DOM walk every keypress (~20k nodes) → jank; unloaded videos ignored | Fast lookup + fallbacks |
| 2 | Toast invisible in fullscreen | Toast lives in fullscreen element |
| 3 | Clean view could blank whole player (ancestor with "toggle" class) | `:not(:has(video, iframe))` guard |
| 4 | Strict float compare misfired on jitter | EPS 0.001 tolerance |
| 5 | Iframe-embedded videos uncontrollable | Same-origin iframe scan |
| 6 | Duplicate toast leak on fullscreen enter/exit | Node moved, never re-created |

### Round v1.4 (adversarial attacks)
| # | Attack | Fix |
|---|---|---|
| 7 | System clock jumps BACK → negative gap passed combo check → phantom 1.5× | Combo requires `gap >= 0` |
| 8 | Ctrl/Alt/Meta+arrows hijacked (browser/OS shortcuts) | Arrows ignored with modifiers; modifiers never seed combo |
| 9 | Lock fought EVERY video (bg previews force-snapped) | Lock scoped to ONE `lockedVideo` only |
| 10 | Typing in SHADOW-DOM input → arrows/T hijacked (event retargeting bypass) | Guard uses `composedPath()[0]` (true target) |
| 11 | CSS guard missed iframe-wrapped players | Guard extended to `:has(video, iframe)` |
| 12 | Lock snap-back did NOT work for iframe videos (events don't cross frames) | Element-level `ratechange` listener on each locked video |
| 13 | Holding **T** flickered clean view ON/OFF (auto-repeat) | Repeat keydown ignored for T |
| 14 | Bg video autoplaying mid-lock stole arrow targeting | Arrows stick to `lockedVideo` while lock is hot |

### Test-mistakes caught by the suite itself (extension was correct)
- Combo tests firing at 0ms gap = valid combo (test needed a time advance)

---

## 🧪 All 39 test groups

| Groups | Area | Status |
|---|---|---|
| 1–2 | ↑ = 2×, ↓ = 1× (rate, defaultRate, toasts, scroll block) | ✅ |
| 3–7 | Combo 1.5× both orders, no false combo on slow gap/hold/repeat | ✅ |
| 8–11 | Lock 🔒: site override snapped, manual-after-3s respected, arrows retake | ✅ |
| 12–14 | Typing guards (input/textarea/contenteditable), other keys, no-video page | ✅ |
| 15–16 | Multi-video target = playing one; shadow-DOM video controlled | ✅ |
| 17–19 | T toggle both ways, Ctrl+T safe, per-site restore | ✅ |
| 20 | SPA player swap: speed follows NEW player only, bg videos ignored | ✅ |
| 21–24 | Site key-handler blocking, no-op ratechange, pw.live flow, packaging | ✅ |
| 25–30 | v1.3 regressions: unloaded video, iframe, fullscreen toast, EPS, CSS guard, fast path | ✅ |
| 31 | ATTACK: clock jumps backwards → no phantom combo | ✅ |
| 32 | ATTACK: modifier+arrows untouched | ✅ |
| 33 | ATTACK: lock protects only our video | ✅ |
| 34 | ATTACK: arrow mashing → always sane rate | ✅ |
| 35 | ATTACK: shadow-DOM input typing safe | ✅ |
| 36 | ATTACK: iframe video snap-back works | ✅ |
| 37 | ATTACK: garbage events never crash | ✅ |
| 38 | ATTACK: holding T no flicker | ✅ |
| 39 | ATTACK: bg autoplay can't steal arrows mid-lock | ✅ |

## 📦 Zip integrity
- Exactly **one top-level folder** (`PW-Speed-Controller`) ✅ · CRC OK ✅

## 🔁 Re-run anytime
```bash
cd tests && npm install && npm test
```
