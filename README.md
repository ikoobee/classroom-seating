# Classroom Seating

![CI](https://github.com/ikoobee/classroom-seating/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Zero build](https://img.shields.io/badge/zero--build-pure--static-orange.svg)

English | [简体中文](README.zh-CN.md)

A zero-build, privacy-first seat planner for homeroom teachers. Pure vanilla JavaScript with ES Modules — no framework, no build step, no backend. All data stays in the browser's `localStorage`; open the page and start planning.

Import a class roster, tune the rule weights, and the engine produces a seating chart in seconds that balances eyesight, height, grades, behavior, gender and peer relations — with fair rotation, multi-candidate comparison, scoring reports and one-click export.

## Why this tool?

- **Privacy by design** — rosters never leave the browser. No account, no server, no tracking; automatic local backups included.
- **Real optimization, not random shuffling** — hard constraints (locked seats, must-sit-together pairs, blacklist separation) plus 10 weighted soft rules, solved by hill climbing × simulated annealing. Every result gets a quantified score.
- **Zero build, zero install** — static files only. Any static host (GitHub Pages, Cloudflare Pages, Vercel) serves it as-is.
- **Fair rotation built in** — five rotation modes (shift left / right, rows back / forward, serpentine) with locked-seat protection and rotation history.
- **Compare before you commit** — generate N candidates from different seeds, compare scores side by side, apply the winner.

## ✨ Features

- 🎯 **Smart arrangement** — hard constraints (locked seats / friends as deskmates / blacklisted neighbors kept apart) + 10 weighted soft rules, optimized by hill climbing × simulated annealing, with a quantified score for every result
- 🏆 **Candidate plans** — generate N plans at once (different random seeds), compare scores with mini classroom previews, apply in one click
- 📊 **Scoring report** — total score, per-dimension bars for all 10 rules, violation details, hard conflicts and improvement suggestions
- 🔄 **Five rotations** — shift left / right, rows back / forward, serpentine; locked seats are protected, rotation history is kept
- 🤝 **Relation constraints** — friends must be deskmates, blacklists keep students apart (optionally including front-back neighbors); unsatisfiable requests are reported explicitly
- 🏫 **Aisle support** — mark any column as an aisle (a natural deskmate separator); 4 built-in classroom templates
- 📥 **Excel import** — automatic Chinese/English header detection + column-mapping preview before confirming; all 9 fields supported; import template downloadable
- 📤 **Multi-format export** — Excel (two sheets), print-ready PNG seating chart, full JSON backup
- 📈 **Statistics dashboard** — gender donut, height / vision / grade / personality bars (pure SVG) + row × column heatmap
- ↩️ **Undo / redo** — command pattern covering arrange / swap / import / rotate (`Ctrl+Z` / `Ctrl+Y`)
- 🎲 **Demo data generator** — random Chinese names with realistic attribute distributions, reproducible per seed
- 🌙 Dark theme, FLIP animations, keyboard shortcuts (`Ctrl+S` save / `Esc` close dialogs), lock mode

## 🚀 Quick Start

The project is a pure static site and **must be served over HTTP** (ES Modules don't work from `file://`).

1. Clone and serve from the project root:

   ```bash
   git clone https://github.com/ikoobee/classroom-seating.git
   cd classroom-seating
   python -m http.server 8000   # or: npx serve .
   ```

2. Open <http://localhost:8000> in a browser.
3. Click **🎲 Demo Data** to generate a random class (or 📥 import an Excel roster).
4. Hit **🎯 Auto Arrange ▾**, tune the 10 rule weights (0 = off) and the front-row ratio in the left panel, re-arrange to see the effect.
5. Use **🔄 Rotate** for fair rotation and **🤝 Relations** to manage friends and blacklists.

> Deploying: push to any static host (GitHub Pages / Cloudflare Pages / Vercel) — no build configuration needed.

## 🧪 Tests

```bash
# Headless unit tests (node ≥ 18)
node tests/_node.mjs
```

Browser suites: `tests/runner.html` (unit) · `tests/e2e.html` (E2E smoke).

## 🧱 Project Structure

```
classroom-seating/
├── index.html              # single page
├── css/                    # styles (theme variables in base.css)
├── js/
│   ├── main.js / app.js    # entry wiring / app coordinator
│   ├── core/               # pure logic layer (no DOM/IO, independently testable)
│   │   ├── engine/         # seating engine: context/constraints/scorers/evaluate/
│   │   │                   #   construct/moves/optimize/precheck/engine
│   │   ├── rotation.js     # five rotations (cyclic permutation, lock-safe)
│   │   ├── grid.js         # grid geometry (aisles/deskmate edges/front-back/front zone)
│   │   └── datagen / models / constants / relations / stats / rng
│   ├── store/              # mini store + actions/reducers + command-based history
│   ├── services/           # storage (debounce + quota fallback) / logger (index/detail split) /
│   │                       #   arranger (orchestration) / excel / image / backup / vendor
│   └── ui/                 # views (topbar/classroom/studentsPanel/rulesPanel + modals),
│                           #   interactions (flip/shortcuts), components (modal/toast/charts)
├── assets/vendor/          # xlsx (local copy first, CDN fallback)
└── tests/                  # runner.html unit tests / e2e.html smoke / _node.mjs headless
```

## 🎯 How the Engine Works

- **Hard constraints** (must hold; reported separately, no score penalty): locked seats, friends as deskmates, blacklist separation (deskmate / front-back)
- **Soft rules** (weighted 0–100): eyesight protection / height ordering / behavior management / grade tiering / gender balance / ability complementarity / role diversity / personality balance / random shuffle / front-row priority
- **Optimization**: constraint-aware initial construction → hill climbing + simulated annealing (350ms budget per single plan, 220ms per candidate); the objective includes a hard-conflict penalty, so initial violations get repaired during search
- **Reproducible**: all randomness is seeded (mulberry32) — same seed, same result; the seed is recorded in the log

## 🗄 Data & Privacy

- Everything lives in the browser's `localStorage` (key prefix `sm.`) — **nothing is uploaded**, no accounts, no tracking
- Auto-save (600ms debounce) + flush on page hide + a rotating local backup ring (5 kept) + JSON file backup / restore
- Quota protection: when `localStorage` fills up, the oldest log details and backups are pruned first, with an export hint as the escape hatch

## 📄 License

[MIT](LICENSE)

## 🙏 Acknowledgments

- [SheetJS (xlsx) 0.18.5](https://sheetjs.com) — Apache-2.0. Vendored local copy (`assets/vendor/`) with CDN fallback, used for Excel import/export.
