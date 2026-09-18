# ⚡ PW Speed Controller + Clean View

A tiny Chrome extension for Physics Wallah (pw.live) and YouTube lectures.

## Features

| Shortcut | Action |
|---|---|
| **↑ Up Arrow** | Video continues at **2×** speed (locked 🔒 for 3s) |
| **↓ Down Arrow** | Video continues at **1×** speed (locked 🔒 for 3s) |
| **↑ + ↓ almost together** | **1.5× combo** speed (within 200ms of each other) |
| ↑/↓ + clicking the player | Speed stays at your choice — the player's own stored speed (e.g. 1.5×) can't override you |
| Manual speed change in player | Respected — after the 3s lock, your manual speed is adopted, nothing overrides it |
| After manual, press ↑ / ↓ | Takes over again → **2×** / **1×** |
| **T** | **Clean view**: EVERY element floating over the video is hidden — class-agnostic, works inside shadow DOM too. Captions & video stay |
| **T** again | Everything comes back instantly |

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
