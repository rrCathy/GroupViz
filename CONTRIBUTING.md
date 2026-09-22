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
├── __tests__/        ~95 test files / ~2000 tests (Vitest, node + dom projects)
├── components/
│   ├── Canvas/       One component per view (SetView … PresentationTableView) + floatingView/ (window internals)
│   ├── Panels/       Left-panel building blocks + constants (view modes, group families)
│   ├── Tex.tsx       KaTeX rendering helper
│   └── WelcomePage.tsx
├── core/
│   ├── types.ts      Core types, palette, view-mode union (13 modes)
│   ├── groups/       Group implementations (cyclic/dihedral/symmetric/…/small-group registry)
│   ├── algebra/      Pure math: subgroups, cosets, homomorphisms, automorphisms,
│   │                 cayleyEdges, actions, layouts (force/ring/3D/…), series, presentations, notation
│   ├── polyhedra.ts / elementRotation.ts / viewBox.ts / guards.ts
├── context/          State: 12 layered domain Providers + actions modules, aggregated via useGroup()
├── utils/            texify, export (SVG/PNG/GIF), api, hybridCompute, groupFactory
├── i18n/ theme/ hooks/ types/ package/  translations, theme tokens, shared hooks, engine-consume page
├── backend/          FastAPI service (order > 144 computation), pytest suite
└── docs/             Technical documentation (see below)
```

## Setup & daily commands

Prerequisites: Node.js ≥ 18 (CI uses 22), npm ≥ 9. Python 3.12 only if you run the backend.

```bash
npm install            # deps + Playwright chromium + pre-commit hook (prepare → core.hooksPath)
npm run dev            # dev server → http://localhost:5173/
npm run test           # all tests (node + dom projects)
npm run test:e2e       # Playwright e2e (chromium)
npm run test:coverage  # coverage (v8) with per-glob layered thresholds
npm run lint           # ESLint (typescript-eslint + react-hooks + react-refresh)
npm run typecheck      # tsc -b
npm run build          # tsc -b && vite build
```

Backend (needed for groups of order > 144; falls back to local TS up to order 240):

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
6. **Sync docs** — documentation is a first-class artifact in this repo. Any fact change (group families, view modes, shape templates, new features) must be reflected in the owning `docs/*.md` file + README + AGENTS.md. **Counts are written as magnitudes** (`~95 files / ~2000 tests`) — never as exact numbers; the authoritative value is `npm run test` output at run time. Add a row to `docs/CHANGELOG.md` for the session.
   *Tip*: the same fact must not be maintained in two files — the owning doc is authoritative, everything else links to it (`TECHNICAL.md` §7 maps them).
7. **Commit** — use Conventional Commits: `<type>(<scope>): <topic>` (type: `feat` / `fix` / `chore` / `docs` / `test`; scope: `core` / `canvas` / `pkg` / `feedback` / `docs`, optional when repo-wide), with bullet points for fixes/additions/verification results. One logical change per commit.
8. **Push & PR** — fill the PR template; CI runs lint/test/build + coverage thresholds + backend pytest automatically.

## Code conventions

- **Components**: functional + hooks; `PascalCase` components, `camelCase` functions/hooks, `UPPER_SNAKE_CASE` constants.
- **Math notation**: KaTeX everywhere (`texify()` + `<Tex>` / `renderTex()`), never raw Unicode superscripts for displayed math.
- **State**: follow the Provider layering in [`docs/STATE.md`](docs/STATE.md); new state belongs in the matching domain Provider and is exposed via `useGroup()`.
- **Styling**: global CSS custom properties (dark/light themes via tokens like `--accent-*`, `--btn-on-accent`); no Tailwind/CSS framework. Theme-dependent colors must use tokens, never hardcoded hex on accent buttons.
- **Performance guards**: thresholds follow the measured lines in `docs/PERF.md` (constants in `src/core/guards.ts`): `INTERACTIVE_LIMIT` 120 / `ENUMERATION_LIMIT` 144 / `STATIC_LIMIT` 240 / `RENDER_3D_LIMIT` 720. Never write bare magic numbers in new code. Backend prefetch cache triggers at order > 60; Cayley edge throttling; automorphism enumeration bail-out (> 30000 combos).

## Testing conventions

- Framework: Vitest, two projects (node + happy-dom), ~95 files / ~2000 tests. **Counts are magnitudes and never asserted exactly** — the live number comes from `npm run test`.
- Coverage is instrumented across all four layers (`core` / `utils` / `context` / `components`) with **per-glob layered thresholds** in `vitest.config.ts`: `core`/`utils` are hard lines (≥ 85/70), `context`/`components` are anti-regression floors — raise them as tests are added. Pure computation (algebra, groups) gets priority for new tests.
- `tableGroups.audit.test.ts` lazily audits all 66 GAP-imported table groups — it exists to catch silent layout fallbacks, run it for any layout change.
- `i18n.test.ts` asserts zh/en key parity — any new `t()` key needs both languages.

## Documentation conventions

| Doc | Purpose |
|-----|---------|
| `docs/GROUPS.md` `CAYLEY.md` `VIEWS.md` `STATE.md` `BACKEND.md` `UI.md` `TESTING.md` `ACTIONS.md` `PRESENTATION.md` | Technical contracts |
| `docs/CHANGELOG.md` | Completed milestones + per-session dev records (append here) |
| `docs/ROADMAP.md` | Only *unfinished* work (move finished items to CHANGELOG) |

Consistency checks before finishing any doc change:

- Counts: keep them as magnitudes everywhere (never exact); the authoritative value is `npm run test`.
- Version: `package.json` ↔ `welcome.version` in `src/i18n/translations.ts` (zh + en) must match. A real release additionally syncs `package-lock.json` (3 spots), `docs/PLAN_EXTENSION_PACKS.md` peerDeps and derived numbers — see `TECHNICAL.md` §6 / skill `gv-release-gates`.
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
4. **Push** — commit with a Conventional Commits message and push; `main` deploys Pages.
5. **Publish (engine packages, when a release is intended)** — `npm run build:pkg` → `npm run publish:smoke` (9 gates) → `npm publish` (**core first** — react's peerDeps depend on it) → post-publish acceptance: `consume:compare` / `consume:registry` / `consume:types` / `consume:browser`. Run `npm whoami` first — the local `_authToken` can go stale.

## Pull request checklist

- [ ] PR template filled in, including the risk self-assessment
- [ ] lint / test / build green; coverage above thresholds
- [ ] pre-commit hook passed (staged TS eslint + `tsc -b`, wired by `npm install`)
- [ ] i18n keys zh + en
- [ ] docs & counts synced
- [ ] commit message follows repo style