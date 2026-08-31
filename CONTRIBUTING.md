# Contributing to Classroom Seating

Thanks for your interest in improving this project!

## Getting Started

Prerequisites: Node.js ≥ 18 (for tests and lint only — the app itself is pure static files with zero runtime dependencies).

```bash
git clone https://github.com/ikoobee/classroom-seating.git
cd classroom-seating
npm ci                        # dev-only tooling (eslint); no runtime dependencies
python -m http.server 8000    # or: npx serve .
```

Open <http://localhost:8000>. ES Modules require HTTP — opening `index.html` via `file://` will not work.

## Testing & Lint

```bash
npm test        # headless unit tests (node tests/_node.mjs)
npm run lint    # eslint over js/ and tests/
```

Optional manual browser suites: `tests/runner.html` (unit), `tests/e2e.html` (E2E smoke).

## Making Changes

- **Respect the layer boundaries**: `js/core/` is pure logic with no DOM or I/O dependencies — keep it that way so it stays independently testable.
- **Language**: code identifiers and comments in English. UI strings are Chinese by design (the tool targets homeroom teachers in Chinese schools) — don't translate them.
- **Zero-build rule**: no runtime dependencies, no build step. `package.json` is for dev tooling only.
- **Commits**: follow [Conventional Commits](https://www.conventionalcommits.org/) — `feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:` / `ci:`.
- Run `npm test` and `npm run lint` before committing; CI must stay green.

## Pull Requests

1. Fork and branch from `main`.
2. Make your change; add unit tests for anything touching `js/core/`.
3. Open a PR against `main` describing what and why; link the related issue if one exists.

## Reporting Issues

Use the bug / feature issue templates. Please write in English where possible.

## License / Inbound = Outbound

By submitting a contribution, you agree that it will be licensed under the **MIT License**, the same license as this project ("inbound = outbound"). You retain the copyright to your own work; no extra paperwork (CLA) is required.
