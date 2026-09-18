# ⚡ PW Speed Controller + Clean View

A tiny Chrome extension for Physics Wallah (pw.live) and YouTube lectures.

## Features

| Shortcut | Action |
|---|---|
| **↑ Up Arrow** | Video continues at **2×** speed |
| **↓ Down Arrow** | Video continues at **1×** speed |
| Manual speed change in player | Respected — nothing overrides it |
| After manual, press ↑ / ↓ | Takes over again → **2×** / **1×** |
| **T** | **Instantly hides** all clutter toggles (skip arrows, top toggle bar, gesture flashes) |
| **T** again | Toggles come back instantly |

Clean-view state is remembered per website, so your lectures stay clean next time.

## Install (1 minute)

1. Extract this folder from the zip.
2. Open `chrome://extensions` in Chrome.
3. Turn ON **Developer mode** (top-right).
4. Click **Load unpacked** → select the `PW-Speed-Controller` folder.
5. Pin it from the puzzle icon if you want the shortcut cheat-sheet popup.

## Customise

- **Speeds / key**: edit `UP_SPEED`, `DOWN_SPEED`, `CLEAN_KEY` at the top of `content.js`.
- **Any toggle still visible?** Add its class to `clean.css` where marked
  (right-click the toggle → Inspect → copy its class name).
