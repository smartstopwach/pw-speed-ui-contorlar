# 🧪 Test Report — PW Speed Controller v1.2

**Date:** 2026-09-18
**Method:** Automated jsdom simulation — the REAL `content.js` runs against
mock YouTube / pw.live pages with real KeyboardEvents, ratechange events,
shadow DOM, storage, and timing control (68 assertions, 24 groups).

## ✅ Result: 68/68 PASSED — ALL FEATURES WORKING

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
