# GroupViz

<p align="center">
  <strong>Interactive Group Theory Visualization</strong>
</p>

<p align="center">
  <a href="https://rrcathy.github.io/GroupViz/"><strong>Live Demo</strong></a> ·
  <a href="https://github.com/rrCathy/GroupViz">GitHub</a> ·
  <a href="https://github.com/rrCathy/GroupViz/issues">Get Help</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-blue" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6.0-blue" alt="TS 6">
  <img src="https://img.shields.io/badge/Three.js-0.184-orange" alt="Three.js">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="MIT">
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> | <a href="./README_zh-CN.md">简体中文</a>
</p>

---

## 🎯 See Abstract Algebra Come Alive

**GroupViz** is an interactive web application that turns abstract group theory into visual, explorable 3D and 2D scenes. Whether you are a researcher probing subgroup structure, a teacher illustrating Cayley graphs, or a student meeting Lagrange's theorem for the first time — GroupViz turns mathematics into something you can see, touch, and play with.

**What makes it special:**
- ✨ 13 visualization modes: Cayley graphs (2D/3D), multiplication tables, subgroup lattices, symmetry views, coset strips, orbit & Sylow views, and more
- 🎨 18 3D shape templates & 14 2D layouts, auto-assigned from group properties
- 🏗️ A full group construction system: direct & semidirect products, automorphism groups, quotient groups, homomorphisms, and presentations (⟨S|R⟩)
- 🔄 Multi-view floating windows, dark/light themes, and 2D/3D **animated GIF** export
- 🌍 Bilingual (English / 中文) interface, with session save & restore

<br>

<div align="center">

![Cayley graph of D₄ — 2D dual-ring layout](docs/images/hero-cayley-2d-D4.png)

*Cayley graph of the dihedral group D₄ (2D dual-ring layout)*

</div>

## 📸 Gallery

<div align="center">

### Cayley Graphs

| 2D — dual-ring layouts | 3D — polyhedral shapes |
|:---:|:---:|
| ![D4 cayley 2d](docs/images/hero-cayley-2d-D4.png) | ![A5 cayley 3d](docs/images/cayley-3d-A5.png) |

### Structure & Theorems

| Subgroup lattice (S₄) | Symmetry view (S₄) |
|:---:|:---:|
| ![S4 lattice](docs/images/lattice-S4.png) | ![S4 symmetry](docs/images/symmetry-S4.png) |

### Animations

| 3D Cayley rotation (A₅) | Symmetry action (S₄) |
|:---:|:---:|
| ![A5 3D animation](docs/images/cayley-3d-A5.gif) | ![S4 symmetry animation](docs/images/symmetry-S4.gif) |

### Tables & Cycles

| Cayley table (S₃) | Cycle graph (C₁₂) | Element set (C₂₀) |
|:---:|:---:|:---:|
| ![S3 table](docs/images/table-S3.png) | ![C12 cycle](docs/images/cycle-C12.png) | ![C20 set](docs/images/set-C20.png) |

</div>

## ✨ Highlights

- **Group structure at a glance** — subgroups, conjugacy classes, center Z(G), normalizer/centralizer, and a Hasse-diagram subgroup lattice with derived/central/composition series overlaid.
- **Generalized Cayley graphs** — edges defined by *any* group element (right/left multiplication switchable), not just generators.
- **Visual theorem verification** — Lagrange (coset strips `|G| = |H|·[G:H]`), Cayley (regular actions), Orbit–Stabilizer, the First Isomorphism Theorem animation, and Sylow's theorems.
- **Group construction lab** — build G×H, N⋊_φ H, Aut(G), G/N and homomorphisms interactively.
- **Presentation system** — define any finite group from a presentation ⟨S|R⟩ via Todd–Coxeter enumeration.
- **Import by notation** — type `S₅`, `PSL(2,7)`, `C₃×D₄`, `Aut(S₄)` … and get the group, its Cayley graphs and full structure pipeline.
- **Hybrid computation** — small groups computed locally in TypeScript, large ones (order > 60) offloaded to a FastAPI + GAP backend with automatic fallback.

## 🚀 Quick Start

Explore it live: <https://rrcathy.github.io/GroupViz/>

Or run locally (Node.js ≥ 18, npm ≥ 9):

```bash
git clone https://github.com/rrCathy/GroupViz.git
cd GroupViz
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser. For large groups (order > 60), start the backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

New to the app? The [tutorial](docs/TUTORIAL.md) walks you through the workspace, the 13 views, and the construction systems (简体中文教程：[TUTORIAL_zh-CN.md](docs/TUTORIAL_zh-CN.md)).

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| 3D Rendering | Three.js + React Three Fiber |
| Math Rendering | KaTeX (every expression typeset properly) |
| Backend | Python FastAPI (hybrid large-group computation, optional GAP engine) |
| Testing | Vitest (node + dom dual projects) + Playwright E2E |
| Export | SVG · PNG · GIF · batch CLI (`npm run export`) |

## 🤝 Community & Contributing

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — newcomer guide, conventions, and the dev workflow
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — what is not done yet
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** — completed milestones
- **[Issue templates](.github/ISSUE_TEMPLATE/)** — bug reports & feature requests

Further technical documentation lives in `docs/`: [GROUPS](docs/GROUPS.md), [CAYLEY](docs/CAYLEY.md), [VIEWS](docs/VIEWS.md), [STATE](docs/STATE.md), [BACKEND](docs/BACKEND.md), [UI](docs/UI.md), [TESTING](docs/TESTING.md).

## 📄 License

MIT © 2026 — built with passion for mathematical visualization.