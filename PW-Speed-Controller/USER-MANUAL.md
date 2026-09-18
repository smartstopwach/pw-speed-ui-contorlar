# ⚡ PW Speed Controller — Quick User Manual

## 📦 Install kaise kare (Sirf 1 baar)

1. Zip ko **extract** karo → `PW-Speed-Controller` folder milega
2. Chrome me `chrome://extensions` kholo
3. Upar-right me **Developer mode** ON karo
4. **Load unpacked** dabao → `PW-Speed-Controller` folder select karo
5. Done! Ab pw.live aur YouTube pe kaam karega ✅

---

## 🎮 Shortcuts — Kya dabao → Kya hoga

| Aap kya karoge | Kya hoga |
|---|---|
| **↑ Up Arrow** dabao | Video **2× speed** pe chalne lagega 🔒 |
| **↓ Down Arrow** dabao | Video **1× speed** (normal) pe aa jayega 🔒 |
| **↑ + ↓ saath me** (0.2 sec ke andar, kisi bhi order me) | **1.5× combo** speed ⚡ lagegi |
| **Player me manually speed change** karo | Aapki manual speed chalti rahegi — extension interfere **nahi** karega |
| Manual ke baad **↑ / ↓ / combo** dabao | Extension wapas control le lega → 2× / 1× / 1.5× |
| **Arrow + player pe click** ek saath | Befiker raho — speed aapki hi rahegi (site ka 1.5× override fail 🔒) |
| **T** dabao | Video ke upar ka **HAR cheez gayab** 🧹 — toggles, arrows, menus, junk (kisi bhi class/shadow DOM me ho — PW samet). **Captions aur video nahi** chhootega |
| **T** phir se dabao | Sab kuch **wapas aa jayega** 👁 |

---

## 🔒 Lock ka matlab?

Arrow dabane ke **3 second** tak aapki speed "lock" rehti hai.
Agar PW/YouTube player apni purani speed (jaise 1.5×) wapas lagaane ki
koshish kare — extension use **turant wapas aapki speed** pe kar dega.
Screen pe "🔒 kept" ka message dikhega.

3 second baad aap manually jo speed chuno — wahi final. ✅

---

## 👀 Screen pe chhote messages (Toast)

- `⏩ 2× speed 🔒` — up arrow dabaya
- `▶ 1× speed 🔒` — down arrow dabaya
- `⚡ 1.5× combo 🔒` — dono arrow saath dabaye
- `🔒 2× kept` — site ne badalne ki koshish ki, extension ne rok diya
- `🧹 Clean view ON` — toggles gayab
- `👁 Toggles visible again` — toggles wapas

---

## ⚠️ Dhyan rakhna

- **Typing karte waqt** (comment/search box me) shortcuts kaam **nahi** karenge — taaki aapki likhai kharab na ho
- Sirf **pw.live** aur **youtube.com** pe chalta hai
- Clean view har site pe **yaad** rakha jata hai — ek baar ON kiya to agli baar bhi clean rahega
- Agar "T" dabaane ke baad bhi koi toggle dikhe → uspe **right-click → Inspect** → class name copy karo → `clean.css` me neeche add kar do (marked jagah hai)

---

## ⚙️ Settings badalni ho to?

`content.js` file ke sabse upar:

```js
const UP_SPEED    = 2.0;   // up arrow ki speed
const DOWN_SPEED  = 1.0;   // down arrow ki speed
const COMBO_SPEED = 1.5;   // up+down combo ki speed
const COMBO_MS    = 200;   // combo timing (ms)
const CLEAN_KEY   = 't';   // clean view ki key
const LOCK_MS     = 3000;  // lock kitne ms rahe
```

Badalne ke baad `chrome://extensions` pe **reload 🔄** dabao. Done!
