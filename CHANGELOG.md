# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Import template reworked into two sheets: demo rows only on sheet 1, field notes on a dedicated sheet 2, generated from the app's own constants (all 17 ability values now listed, matching the extended ability design)

- Initial public release: seating engine with hard constraints (locked seats, friends-as-deskmates, blacklist separation) and 10 weighted soft rules, optimized by hill climbing + simulated annealing
- Five fair-rotation modes (shift left / right, rows back / forward, serpentine) with locked-seat protection and rotation history
- Multi-candidate plans: generate N seeds, compare scores with mini previews, apply in one click
- Scoring report: total score, per-rule bars, violation details, hard conflicts and improvement suggestions
- Relation management: friends / blacklist (optional front-back extension), unsatisfiable requests reported explicitly
- Aisle support with 4 built-in classroom templates
- Excel import (CN/EN header auto-detection, column-mapping preview) and export (two sheets), print-ready PNG export, full JSON backup/restore
- Statistics dashboard: gender donut, attribute distribution bars, row × column heatmap (pure SVG)
- Undo / redo via command pattern, dark theme, FLIP animations, keyboard shortcuts, demo data generator (seeded, reproducible)
- Privacy-first storage: everything in browser `localStorage`, auto-save, backup ring, quota protection
