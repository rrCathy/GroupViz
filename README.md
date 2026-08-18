# GroupViz — Interactive Group Theory Visualization

[![CI](https://github.com/rrCathy/GroupViz/actions/workflows/ci.yml/badge.svg)](https://github.com/rrCathy/GroupViz/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/rrCathy/GroupViz/actions/workflows/pages.yml/badge.svg)](https://github.com/rrCathy/GroupViz/actions/workflows/pages.yml)

<p align="center">
  <strong>English</strong> | <a href="./README_zh-CN.md">简体中文</a>
</p>

**GroupViz** is an interactive web application for visualizing and exploring finite group theory. It provides 13 visualization modes, supports multiple classical group families plus a group construction system (direct/semidirect products, automorphism groups, quotient groups, homomorphisms), and renders all mathematical notation with KaTeX.

New to GroupViz? Walk through the step-by-step [tutorial](docs/TUTORIAL.md) (简体中文教程：[TUTORIAL_zh-CN.md](docs/TUTORIAL_zh-CN.md)).

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-blue" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6.0-blue" alt="TS 6">
  <img src="https://img.shields.io/badge/Three.js-0.184-orange" alt="Three.js">
  <img src="https://img.shields.io/badge/KaTeX-0.16-green" alt="KaTeX">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="MIT">
</p>

---

## Use online

`https://rrcathy.github.io/GroupViz/`

## ✨ Features

### Group Structure Visualization
- **Subgroups** — compute, list, and highlight all cyclic subgroups
- **Conjugacy classes** — automatic partition analysis
- **Center** — identify central elements; highlighted in the subgroup lattice (gold + Z(G) badge), in the subgroup list, and in the group info panel
- **Generate subgroup ⟨E⟩** — one-click closure of any subset E ⊂ G, jumps to the coset strip view showing `|G| = |H|·[G:H]`
- **Normalizer / Centralizer** — one-click `N_G(E) = {g | gEg⁻¹ = E}` and `C_G(E) = {g | gx = xg, ∀x ∈ E}` for any subset E, both subgroups, jumps to the coset strip view
- **Subgroup lattice (Hasse diagram)** — nodes arranged by layer with normal subgroups highlighted
- **Subgroup series** — derived / upper & lower central / composition series overlaid on the lattice (colored term strokes + ordinal badges, non-series nodes dimmed, bold series edges); bottom panel with TeX chain `G ⊵ N₁ ⊵ … ⊵ ⟨e⟩`, orders, factors `Nᵢ/Nᵢ₊₁ ≅ …`, solvable/nilpotent badges, composition-factor multiset + Jordan–Hölder note; all composition series enumerated for small groups (≤20 chains, chain switcher); `SERIES_MAX_ORDER = 240` guard
- **Coset decomposition** — left/right cosets, color-coded, Lagrange's theorem verification in the coset strip view
- **Simple group detection** — automatic property checking

### 13 View Modes
The view panel offers 9 cards; the homomorphism and orbit views open from their respective construction panels, and the two presentation views — tree & presentation table — open from the Group Presentation panel (not in the cards).
| View | Description |
|------|-------------|
| **Set View** | Grid layout of all group elements |
| **Cayley Graph (2D)** | SVG-based, 12 shape layouts, draggable nodes, configurable edges |
| **Cycle Graph** | Cyclic subgroup visualization with maximal cycle filtering |
| **Cayley Table** | Interactive multiplication table with row/column highlighting and coset striping; for |G| > 16 offers three strategies (subgroup / random sample / full table with fullscreen mode, zoom slider, SVG export) |
| **Cayley Graph (3D)** | Three.js rendering, 17 shape templates, orbit controls |
| **Symmetry View** | Polyhedra geometry + element rotation animations + rotation axis markers |
| **Subgroup Lattice** | Hasse diagram with layer-based layout |
| **Homomorphism View** | Source/target dual Cayley graphs + mapping edges, kernel/image highlighting, first isomorphism theorem animation |
| **Coset Strip** | Cosets as colored columns with `|G| = |H|·[G:H]` Lagrange verification, plus the circular Cayley graph of ⟨H⟩ above the subgroup strip |
| **Orbit View** | Group action orbits as clusters (fixed points ★ leftmost), generator edges, hover shows full action, orbit-stabilizer verification |
| **Sylow View** | p-elements & all p-subgroups (p selectable among \|G\| prime factors), Cayley-graph layout (click a subgroup → edges switch to its generators), single select → coset strips (Lagrange), Ctrl/⌘ or ⊕ two subgroups → conjugation view (Sylow II, vertical arrows + P cyan/Q purple internal generator edges) |
| **Tree View** | Degenerate tree = BFS spanning tree of the quotient Cayley graph: solid spanning-tree edges (colored by generator), glued edges not drawn (counted in a bar), regularized layouts (line/grid/cross/3D) — "relators = tree-cutting" |
| **Presentation Table View** | Multiplication-table style browsing (columns × rows) with a static relator bar on top; auto-sampled for order > 36 |

### Group Action System
| Source | Description |
|------|-------------|
| Conjugation | Action of G on itself by conjugation; orbits = conjugacy classes, fixed points = center Z(G) |
| Custom | Draw arrows between set elements, bind generators (click or drag & drop), auto-completion + homomorphism verification Φ: G → Sym(X) with violation pinpointing; **draft auto-saved** to localStorage and restored per group symbol (refresh or switch away and back); **finished actions persist** in a panel list (visible per group, click to reactivate, deletable) |
| Sylow | Sylow-type view: p-elements & p-subgroups (p selectable among \|G\| prime factors), Cayley-graph layout (click a subgroup → edges switch to its generators), single select → coset strips (Lagrange), Ctrl/⌘ or ⊕ two subgroups → conjugation view (Sylow II, vertical arrows + P/Q internal edges); G acts on Syl_p(G) with orbit size = n_p and stabilizer = normalizer (verified in the orbit view) |

### Group Construction System
| Construction | Description |
|------|-------------|
| Direct product G×H | Build any pair interactively (max 144), 3 modes (cayley/table/direct), compact symbols (C₃×C₃→C₃²) |
| Semidirect product N⋊_φ H | φ-mapping UI, automatic Aut(N), 5 presets (Z₃⋊Z₂≅S₃, Z₄⋊Z₂≅D₄, Z₅⋊Z₂≅D₅, Z₇⋊Z₂ Frobenius, V₄⋊Z₃≅A₄), 4-step construction animation, rewiring layout |
| Automorphism group Aut(G) | Full enumeration, group laws, rewired Cayley preview & mapping for selected automorphism |
| Quotient group G/N | Built from a normal subgroup, coset elements, ≅ isomorphism badge |
| Homomorphism | source→target mapping verification, kernel/image/injective/surjective/isomorphism analysis, first isomorphism theorem animation |

### Supported Groups
| Group | Symbol | Order | Implemented |
|-------|--------|-------|-------------|
| Cyclic | Zₙ (n=1..120) | n | ✅ |
| Dihedral | Dₙ (n=3..12) | 2n | ✅ |
| Symmetric | S₃, S₄, S₅ | 6, 24, 120 | ✅ |
| Alternating | A₃, A₄, A₅ | 3, 12, 60 | ✅ |
| Klein Four | V₄ | 4 | ✅ |
| Quaternion | Q₈ | 8 | ✅ |
| General Linear | GL(2,p): GL(2,2) ≅ S₃, GL(2,3) | 6 / 48 | ✅ |
| Direct Products | Z₄×Z₂, Z₂³, Z₃×Z₄, Z₆×Z₂, and any G×H | ≤144 | ✅ |
| Semidirect products | N⋊_φ H (e.g. Z₃⋊Z₂ ≅ S₃) | ≤144 | ✅ |
| Automorphism groups | Aut(G) (e.g. Aut(Z₈) ≅ C₂) | — | ✅ |
| Quotient groups | G/N | \|G\|/\|N\| | ✅ |
| Presentation-defined | ⟨S \| R⟩ (Todd–Coxeter, e.g. A₅, V₄, Q₈) | ≤240 | ✅ |

### Key Features
- **Cayley graph by element action** — edges defined by any group element (generalized Cayley graph), right/left multiply switchable
- **17 3D shape templates** — auto-assigned by group properties (truncated polyhedra for S₄, A₄, A₅); smart direct-product shapes (lattice/cylinder/torus)
- **13 2D Cayley layout shapes** — circular/grid/spherical/concentric/dualRing/archimedean/spiral/coil/projection3D/rewiring (semidirect-specific)/cylinder (interleaved concentric circles; direct product, one cyclic factor)/torus (direct product, no cyclic factor)/ringGrid (ring × 2×2 grid; ≥3 cyclic factors), intelligent default by group type
- **Multi-view floating windows** — open multiple views simultaneously for comparative analysis
- **Subset analysis** — save element selections; auto-detect subgroup / normal subgroup via closure tests
- **Self-inverse element detection** — highlights elements where g⁻¹ = g
- **Session save/restore** — auto-save to localStorage, resume after refresh (quotient/automorphism/semidirect reconstruction)
- **Dark/light theme** — CSS custom properties, system preference detection
- **View export** — SVG (2D views), PNG (3D views), GIF (symmetry animation + 3D Cayley rotation) + batch export CLI (`npm run export`)
- **i18n** — Chinese / English UI with localStorage persistence
- **Hybrid computation** — local TypeScript for small groups (≤60), FastAPI backend for large ones (>60)
- **Group presentations** — create any finite group from ⟨S|R⟩ (Todd–Coxeter enumeration), auto-detect standard presentations (Cₙ/Dₙ/Sₙ/Aₙ/V₄/Q₈) for the info bar; tree view (BFS spanning tree, click a node to see its word, glued-edge count in a bar) + presentation table view with a static relator bar; draft autosave
- **Small group registry** — all 93 groups of order 1–31 (GAP SmallGroups import) with precomputed subgroup/conjugacy class/center data
- **Import by notation** — type a group symbol (S₅ / PSL(2,7) / C₃×D₄ / SmallGroup(16,13) / Aut(S₄) …) for live TeX preview; built locally when possible, otherwise imported through the backend GAP engine (full structure pipeline afterwards)
- **Performance guards** — subgroup/conjugacy cutoff 60; Cayley edge throttling; automorphism enumeration bail-out (>30000 combos)
- **Test suite** — 43 test files, 1263 tests (Vitest)

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
git clone https://github.com/rrCathy/GroupViz.git
cd groupviz
npm install
npm run dev
```

Then open `http://localhost:5173/` in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📖 Usage

1. **Select a group** from the left panel (Cyclic, Dihedral, Symmetric, Alternating, or Special groups), or use the construction system (direct/semidirect product, Aut(G), quotient)
2. **Switch views** in the view panel (9 cards; the homomorphism & orbit views open from their respective panels, and the two presentation views — tree & presentation table — open from the Group Presentation panel)
3. **Interact with the canvas** — pan (drag background), zoom (scroll), select elements (click), lasso-select (Ctrl+drag)
4. **Explore Cayley graphs** — enable/disable element actions, switch right/left multiplication, pick 2D/3D shapes, run force layout
5. **Explore group theory** — save subsets to detect subgroups, show cosets, build quotient groups; construct homomorphisms and run the first isomorphism animation
6. **Use keyboard navigation** — ←/→ arrow keys to cycle through elements
7. **Open floating views** — toggle multi-view mode to compare representations side by side

> Backend: For very large groups (order > 60), GroupViz offloads structure computation to a FastAPI service (see [docs/BACKEND.md](docs/BACKEND.md)). Detailed technical docs live in `docs/`: groups (GROUPS.md), Cayley system (CAYLEY.md), views (VIEWS.md), state (STATE.md), UI (UI.md), testing (TESTING.md).

---

## 🤝 Contributing

GroupViz welcomes contributions — from math-layout fixes to new group families and construction workflows. Start here:

- [CONTRIBUTING.md](CONTRIBUTING.md) — newcomer guide, conventions, dev workflow, and the risk-review protocol
- [docs/ROADMAP.md](docs/ROADMAP.md) — what is *not* done yet (only open items live here)
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — completed milestones and per-session dev records
- [Issue templates](.github/ISSUE_TEMPLATE/) for bug reports and feature requests

CI (`.github/workflows/ci.yml`) runs lint, tests, coverage thresholds, production build, and backend pytest on every push/PR; `main` auto-deploys to GitHub Pages and `v*` tags publish releases.

---

## 🛠 Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | CSS Custom Properties + App.css |
| 3D Rendering | Three.js + React Three Fiber |
| Math Rendering | KaTeX |
| State Management | Modular React Context (12 domain providers) |
| Backend | Python FastAPI (hybrid computation) |
| i18n | Custom React Context |
| Testing | Vitest |

---

## 📂 Project Structure

```
.github/                # CI workflows (ci / pages / release) + issue & PR templates
CONTRIBUTING.md         # Contribution guide (includes newcomer onboarding)
src/
├── __tests__/            # 43 test files (1263 tests)
├── components/
│   ├── Canvas/           # Views (Set/Cayley/Cycle/Table/3D/Symmetry/SubgroupLattice/
│   │                    #   Homomorphism/CosetStrip/DirectProduct/SemidirectProduct/
│   │                    #   Relators/PresentationTable/floating windows)
│   ├── Panels/           # Left panels (BasicGroup/View/Operations/DirectProduct/
│   │                    #   Homomorphism/SemidirectProduct/Presentation) + RightPanel + TabBar + constants
│   ├── Tex.tsx           # KaTeX React component
│   └── WelcomePage.tsx   # Hardcore-mode splash (features list, coming soon, sponsors)
├── core/
│   ├── types.ts          # Types, color palette, shape detection
│   ├── groups/           # Group implementations (cyclic/dihedral/symmetric/alternating/
│   │                    #   special/direct/semidirect/small-group registry)
│   ├── algebra/          # Subgroups, cosets, homomorphisms, automorphisms, Cayley edges, layouts
│   ├── polyhedra.ts      # Polyhedron vertex generation
│   ├── elementRotation.ts # Group element → 3D geometric rotation
│   └── viewBox.ts        # SVG viewport sizing
├── context/              # Modular state (12 domain providers + GroupContext composite)
├── utils/                # Unicode→TeX converter, export, export bridge, group factory, hybrid compute
├── backend/              # FastAPI backend (large-group computation)
└── docs/                 # Technical documentation
```

---

## ⌨️ Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and produce production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Watch mode |
| `npm run preview` | Preview production build locally |
| `npm run export` | Playwright batch export (→ exports/batch-<timestamp>/) |

Backend (needed for large groups):

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## 📚 Mathematical Background

GroupViz visualizes concepts from abstract algebra and finite group theory:

- **Lagrange's Theorem** — order of any subgroup divides the order of the group
- **Cayley's Theorem** — every finite group is isomorphic to a subgroup of a symmetric group
- **Class Equation** — |G| = sum of conjugacy class sizes
- **First Isomorphism Theorem** — G/ker(φ) ≅ im(φ)
- **Semidirect products** — N⋊_φ H with multiplication (n₁,h₁)·(n₂,h₂) = (n₁·φ(h₁)(n₂), h₁·h₂)

### Cayley Graph Terminology

GroupViz implements a **generalized Cayley graph** where edges can be defined by any group element, not just generators:

- **Standard Cayley graph**: edges labeled by a generating set S ⊆ G
- **Generalized Cayley graph** (used here): edges labeled by arbitrary elements of G

Edge semantics:
- **Right multiplication**: edge from a to b if a·c = b
- **Left multiplication**: edge from a to b if c·a = b
- **Bidirectional edges** (no arrow) when the action is involutive (a·c = b and b·c = a)

---

## 🔮 Roadmap

- [x] 13 visualization modes (incl. homomorphism view, coset strip, orbit & Sylow views)
- [x] Multi-view floating windows
- [x] Subgroup lattice (Hasse diagram)
- [x] Symmetry view with polyhedra rotation animations
- [x] Small group precomputed registry (orders 1–15)
- [x] i18n (Chinese / English)
- [x] Coset decomposition UI + Lagrange verification
- [x] Direct product construction system (any G×H)
- [x] Semidirect product construction (5 presets + φ UI + animation)
- [x] Automorphism group Aut(G)
- [x] Homomorphism mapping + first isomorphism theorem animation
- [x] Group action system (conjugation / custom, orbit view, OST verification)
- [x] 2D Cayley multi-shape layouts (12, incl. rewiring/cylinder/torus)
- [x] Dark/light theme
- [x] Session save/restore
- [x] View export (SVG/PNG/GIF) + batch export CLI
- [x] Hybrid computation (local TS + FastAPI, local fallback + progress bar)
- [x] Test suite (43 files, 1263 tests)
- [ ] Group operation law verification animations
- [x] Custom finite group input (⟨S|R⟩ presentation system)
- [ ] Tutorial mode

---

## 📄 License

MIT © 2026

---

*Built with passion for mathematical visualization.*
