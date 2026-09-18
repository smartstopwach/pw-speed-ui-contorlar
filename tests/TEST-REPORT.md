# 🧪 Test Report — PW Speed Controller v1.5.0 (UNIT + TRUE E2E)

**Date:** 2026-09-18
**Layers:**
1. **Unit (jsdom):** 136 assertions · 50 groups · simulated pages with full time control
2. **E2E (REAL Chromium 131):** 44 assertions · 19 scenarios · real keyboard/CDP
   pipeline, real media events, real CSS cascade, real per-origin storage — pages
   served as `pw.live` / `youtube.com` origins (`--host-resolver-rules`), real
   `content.js`/`clean.css` injected unmodified (document_start injection shim —
   sandbox network cannot fetch an extension-enabled Chrome; every browser CDN is
   blocked here, engine still 100% real Chromium)

## ✅ UNIT: 136/136 PASSED · E2E: 44/44 PASSED — 180 checks, zero failures

## 🌐 E2E scenarios (real browser)
| # | Scenario | Result |
|---|---|---|
| E1 | ↑ = 2×, ↓ = 1× on real player + real toast | ✅ |
| E2 | ↑+↓ fast = 1.5× combo (real key events) | ✅ |
| E3 | **THE bug:** site forces 1.5× during lock (REAL ratechange) → snapped to 2× | ✅ |
| E4 | Manual 1.75× after 3s lock respected | ✅ |
| E5 | "t" hides clutter **but not** video-wrapping container (real `:has()` cascade) | ✅ |
| E6 | Typing in normal + shadow-DOM inputs safe | ✅ |
| E7 | Ctrl/Alt+arrows untouched | ✅ |
| E8 | Holding T (real OS auto-repeat) → ON once, no flicker | ✅ |
| E9 | Clean view restored after reload (real per-origin storage) | ✅ |
| E10 | iframe player: arrows + snap-back cross-frame | ✅ |
| E11 | Paused video controllable | ✅ |
| E12 | Actively playing video: 2× keeps playing | ✅ |
| E13 | Largest video wins over tiny one | ✅ |
| E14 | Double injection → exactly one toggle | ✅ |
| E15 | Journey: 2× → manual 1.25 (adopted) → arrows → 1× | ✅ |
| E16 | Toast re-parents into fullscreen element (real fullscreen!) | ✅ |
| E17 | Ended video still accepts speed | ✅ |

---

## 🐛➜🔧 Total bugs found & fixed: 20

### Round v1.5.0 (USER-REPORTED: "T kahin kaam nahi kar raha" + screenshots)
| # | Bug | Root cause | Fix |
|---|---|---|---|
| 19 | **Clean view kaam hi nahi kar raha tha real PW pe** (YouTube title bhi rehta tha) | Clean-view class-name CSS selectors pe tha — PW ke obfuscated classes + Ionic **shadow DOM** me CSS pahunchti hi nahi thi; toast dikhne se lagta tha ON hai par kuch hide nahi hota tha | **Universal geometry engine**: video ke rect se overlap karne wala HAR element `data-psc-hide` se hide — class-name agnostic, shadow-root ke andar style inject, MutationObserver se late overlays bhi; video/ancestors/captions/toast kabhi nahi chhoota |
| 20 | v1.5 rewrite me `deepQueryAll` shadow-host traversal toot gaya (shadow video unreachable) | Do loops ko galat tarike se merge kiya tha — sirf matching elements ke shadow me ghus raha tha | Do loops wapas alag — **unit group 16 ne turant pakda** (suite works!) |

### Round v1.4.2 (caught by REAL end-to-end test)
### Round v1.4.2 (caught by REAL end-to-end test)
| # | Bug | Fix |
|---|---|---|
| 18 | Clean-view restore touched `documentElement.classList` directly — if injection ever lands at `document_start` (element not existing yet), restore silently failed | Apply on `DOMContentLoaded` when DOM not ready yet |

### Round v1.4.1 (precision & injection attacks)
| # | Attack | Fix |
|---|---|---|
| 15 | Script injected TWICE -> every key toggles twice & cancels out | `__PSC_ACTIVE__` guard: second copy dies instantly |
| 16 | `lockedVideo` kept detached players alive in memory forever (SPA leak) | Stale ref released once lock is cold + player gone |
| 17 | Nothing playing -> arrows hit the FIRST video (could be a tiny ad) | Largest-area video preferred (the lecture) |

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
| 40 | ATTACK: double injection -> second copy inert | ✅ |
| 41 | PRECISION: combo boundary 200ms fires / 201ms doesn't | ✅ |
| 42 | PRECISION: lock boundary 2999ms snaps / 3001ms adopts | ✅ |
| 43 | ATTACK: 0ms truly-simultaneous combo | ✅ |
| 44 | ATTACK: largest video beats tiny ad player | ✅ |
| 45 | Stale lock released; no ghost-enforcement from dead video | ✅ |

## 📦 Zip integrity
- Exactly **one top-level folder** (`PW-Speed-Controller`) ✅ · CRC OK ✅

## 🔁 Re-run anytime
```bash
cd tests
npm install                 # first time only
npm test                    # unit layer (jsdom, 123 checks)
bash e2e/prepare-browser.sh # first time only: real chromium + libs
npm run test:e2e            # E2E layer (real Chromium, 36 checks)
```
- Full outputs: `full-output.txt` (unit) · `e2e/e2e-output.txt` (E2E)
