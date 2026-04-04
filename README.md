# HIRT — Household Inventory & Replenishment Tracker

A React web app to manage household stock levels across multiple vendors (Amazon.de, Luxcaddy, efarmz.be, Naturata, Biobus.de, Cactus) with predictive replenishment logic.

---

## Quick Start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploy to GitHub Pages (free)

1. Push this repo to GitHub.
2. Install the deploy helper:
   ```bash
   npm install --save-dev gh-pages
   ```
3. Add to `package.json`:
   ```json
   "homepage": "https://<your-username>.github.io/hirt",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```
4. Run:
   ```bash
   npm run deploy
   ```
5. In GitHub → Settings → Pages, set source to `gh-pages` branch.

### iOS "Add to Home Screen" (PWA)
1. Open the deployed URL in Safari on iPhone.
2. Tap the Share icon → **Add to Home Screen**.
3. The app will behave like a native app with a standalone UI.

---

## Architecture

```
src/
├── constants.js          # Vendors, categories, seed data
├── utils.js              # getStatus, daysLeft, stockPct, needsOrder
├── hooks/
│   └── useLocalStorage.js  # Persistent state (swap for Supabase in production)
└── components/
    ├── App.jsx / App.module.css
    ├── Dashboard.jsx
    ├── Inventory.jsx
    ├── Alerts.jsx
    ├── Vendors.jsx
    ├── ProductModal.jsx
    ├── QuickModals.jsx   # ConsumeModal + RestockModal
    ├── Modal.jsx
    └── Toast.jsx
```

---

## Replenishment Formula

```
t_exhaustion = currentQty / burnRate (units/day)

Alert triggers when:
  t_exhaustion < vendor.leadDays + 2 (buffer days)
```

---

## Roadmap

| Phase | Feature |
|---|---|
| P0 ✅ | Inventory CRUD, status badges, vendor grouping, alerts, localStorage |
| P1 | Receipt OCR via GPT-4o-mini, unit conversion AI |
| P2 | Burn rate analytics, batch order optimizer, Supabase backend |
| P3 | Native mobile app (React Native), Pushover push alerts |

---

## Migrating to Supabase (Production)

Replace `src/hooks/useLocalStorage.js` with a Supabase client hook:

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

The rest of the app is storage-agnostic — no other files need to change.
