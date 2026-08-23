# Contributing to GroupViz

Thanks for considering contributing to GroupViz — an interactive web app for visualizing and exploring finite group theory. This guide covers everything from first-time setup to the review protocol. For the authoritative technical contract, see [AGENTS.md](AGENTS.md) and the documents in [`docs/`](docs/).

- [For newcomers](#for-newcomers)
- [Project map](#project-map)
- [Setup & daily commands](#setup--daily-commands)
- [Development workflow](#development-workflow)
- [Code conventions](#code-conventions)
- [Testing conventions](#testing-conventions)
- [Documentation conventions](#documentation-conventions)
- [Risk assessment & human review](#risk-assessment--human-review)
- [Release workflow: Scan → Fix → Sync → Push](#release-workflow-scan--fix--sync--push)
- [Pull request checklist](#pull-request-checklist)

---

## For newcomers

If this is your first time inside the codebase, this is the recommended path:

1. **Understand the product.** Read [README.md](README.md) (or [简体中文](README_zh-CN.md)). It describes the 13 view modes, the group families (Sₙ, Cₙ, Dₙ, Aₙ, V₄, Q₈, GL(2,p)), and the construction system (direct/semidirect products, Aut(G), quotients, presentations). If you have not used the app yet, walk through the [tutorial](docs/TUTORIAL.md) (中文教程：[TUTORIAL_zh-CN.md](docs/TUTORIAL_zh-CN.md)) first.
2. **See the math conventions.** The visual conventions (Cayley graphs, cosets, symmetry views) follow *Visual Group Theory* by Nathan Carter. Reference books live in `refer/` (kept local, git-ignored).
3. **Read the domain docs** (each is ~1 screen, in Chinese):
   - [`docs/GROUPS.md`](docs/GROUPS.md) — group implementations, families, factories
   - [`docs/CAYLEY.md`](docs/CAYLEY.md) — Cayley graph edges, 2D/3D layouts
   - [`docs/VIEWS.md`](docs/VIEWS.md) — the 13 view modes and multi-view system
   - [`docs/STATE.md`](docs/STATE.md) — the Provider layering
4. **Check what's done vs. planned.** [`docs/CHANGELOG.md`](docs/CHANGELOG.md) lists completed milestones and every development session; [`docs/ROADMAP.md`](docs/ROADMAP.md) lists only what remains (currently the mid-term **FGVE engine layer**: an in-repo UI-independent engine with stable protocols).
5. **Run the app** (see below) and click through a few views with different groups (start with D₄ or the small-group registry).

## Project map

```
src/
├── __tests__/        39 test files, 1206 tests (Vitest)
├── components/
│   ├── Canvas/       One component per view (SetView … PresentationTableView)
│   ├── Panels/       Left-panel building blocks + constants (view modes, group families)
│   ├── Tex.tsx       KaTeX rendering helper
│   └── WelcomePage.tsx
├── core/
│   ├── types.ts      Core types, palette, view-mode union (13 modes)
│   ├── groups/       Group implementations (cyclic/dihedral/symmetric/…/small-group registry)
│   ├── algebra/      Pure math: subgroups, cosets, homomorphisms, automorphisms,
│   │                 cayleyEdges, actions, layouts (force/ring/3D/…), series, presentations
│   ├── polyhedra.ts / elementRotation.ts / viewBox.ts
├── context/          State: layered Providers + actions modules, aggregated via useGroup()
├── utils/            texify, export (SVG/PNG/GIF), api, hybridCompute, groupFactory
├── backend/          FastAPI service (order > 60 computation), pytest suite
└── docs/             Technical documentation (see below)
```

## Setup & daily commands

Prerequisites: Node.js ≥ 18 (CI uses 22), npm ≥ 9. Python 3.12 only if you run the backend.

```bash
npm install            # installs deps; postinstall fetches Playwright chromium
npm run dev            # dev server → http://localhost:5173/
npm run test           # all tests (vitest run)
npm run test:coverage  # coverage (v8) with CI-enforced thresholds
npm run lint           # ESLint (typescript-eslint + react-hooks + react-refresh)
npm run build          # tsc -b && vite build
```

Backend (needed for groups of order > 60; falls back to local TS up to order 240):

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Batch view export (Playwright CLI → `exports/batch-<timestamp>/`):

```bash
npm run export
```

## Development workflow

1. **Pick a task** — usually from [`docs/ROADMAP.md`](docs/ROADMAP.md) or an issue. Small self-contained improvements are welcome on any topic; if you plan something architectural (engine refactor, new shared state layer), open an issue first.
2. **Branch** — `fix/<topic>` or `feat/<topic>`; keep `main` deployable (it auto-deploys to GitHub Pages).
3. **Develop** — follow the conventions below. Pure math must live in `core/` (algorithms) so unit tests can reach it; React components stay thin.
4. **Self-test** — every change: `npm run lint` + `npm run test` (+ `npm run build` for type errors). Write or update tests for the code you touched.
5. **Browser-verify** UI paths with Playwright: switch the affected views, exercise the new interaction, and watch `console` for warnings/errors (snapshots can be saved under the Playwright output directory).
6. **Sync docs** — documentation is a first-class artifact in this repo. Any fact change (test counts, group families, view modes, new features) must be reflected in `docs/*.md` + README + AGENTS.md (grep the whole repo for the number, e.g. `1205` → `1206`). Add a row to `docs/CHANGELOG.md` for the session.
7. **Commit** — style is `vN.N: <topic>` with bullet points for fixes/additions/verification results (see git log). One logical change per commit.
8. **Push & PR** — fill the PR template; CI runs lint/test/build + coverage thresholds + backend pytest automatically.

## Code conventions

- **Components**: functional + hooks; `PascalCase` components, `camelCase` functions/hooks, `UPPER_SNAKE_CASE` constants.
- **Math notation**: KaTeX everywhere (`texify()` + `<Tex>` / `renderTex()`), never raw Unicode superscripts for displayed math.
- **State**: follow the Provider layering in [`docs/STATE.md`](docs/STATE.md); new state belongs in the matching domain Provider and is exposed via `useGroup()`.
- **Styling**: global CSS custom properties (dark/light themes via tokens like `--accent-*`, `--btn-on-accent`); no Tailwind/CSS framework. Theme-dependent colors must use tokens, never hardcoded hex on accent buttons.
- **Performance guards**: local/backend threshold order ≤ 60; subgroup/conjugacy cutoff 60; Cayley edge throttling; automorphism enumeration bail-out (> 30000 combos).

## Testing conventions

- Framework: Vitest (`globals: true`, node environment), 39 files / 1206 tests — the count is asserted in docs, keep it in sync.
- `src/core/**` and `src/utils/**` are coverage-instrumented; **CI enforces thresholds**: statements/lines/functions ≥ 85%, branches ≥ 70% (see `vitest.config.ts`). Pure computation (algebra, groups) gets priority for new tests.
- `tableGroups.audit.test.ts` lazily audits all 66 GAP-imported table groups (279 tests) — it exists to catch silent layout fallbacks, run it for any layout change.
- `i18n.test.ts` asserts zh/en key parity — any new `t()` key needs both languages.

## Documentation conventions

| Doc | Purpose |
|-----|---------|
| `docs/GROUPS.md` `CAYLEY.md` `VIEWS.md` `STATE.md` `BACKEND.md` `UI.md` `TESTING.md` `ACTIONS.md` `PRESENTATION.md` | Technical contracts |
| `docs/CHANGELOG.md` | Completed milestones + per-session dev records (append here) |
| `docs/ROADMAP.md` | Only *unfinished* work (move finished items to CHANGELOG) |

Consistency checks before finishing any doc change:

- Test count: grep for `1206` in README/AGENTS/docs after changing test files.
- Version: `package.json` ↔ `welcome.version` in `src/i18n/translations.ts` (zh + en) must match.
- Windows tooling: PowerShell `Get/Set-Content` defaults to ANSI and corrupts UTF-8 Chinese text — use `[System.IO.File]` .NET APIs or a UTF-8 (no BOM) editor.
- New contributions shouldn't bump the version unless a release is intended.

## Risk assessment & human review

Every change is self-assessed on two levels before merge:

- 🟢 **Low risk** — UI style/text, internal-only logic, test additions, non-core bug fixes. Self-review, fix, continue.
- 🔴 **High risk** — anything touching core math (groups/algebra/layouts/presentations), auth/secrets, new external dependencies, database-like schema changes, or cross-module shared logic. In this repo the 「red lines」are: **group-theory core algorithms, new dependencies, public contract/type changes**. These pause for a human review request with: change summary, risk points, suggested review path (file + line range), and self-assessment (verified vs. doubtful).

Issue templates, the PR template, and this protocol all point back at the same rule: *explain what changed and where to look*.

## Release workflow: Scan → Fix → Sync → Push

1. **Scan** — static baseline (`lint` + `test` + `build` green), then Playwright over core paths (view switching, construction panels, session restore, exports) watching console errors; spot-check BOM, hardcoded versions, i18n key parity, doc-count grep.
2. **Fix** — repair with regression tests; red-line changes pause for human review.
3. **Sync** — update AGENTS.md / README / docs to match code facts.
4. **Push** — commit `vN.N: <topic>` and push; `main` deploys Pages, tags `v*` publish a release.

## Pull request checklist

- [ ] PR template filled in, including the risk self-assessment
- [ ] lint / test / build green; coverage above thresholds
- [ ] i18n keys zh + en
- [ ] docs & counts synced
- [ ] commit message follows repo style