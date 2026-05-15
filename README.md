# GroupViz — Interactive Group Theory Visualization

<p align="center">
  <strong>English</strong> | <a href="./README_zh-CN.md">简体中文</a>
</p>

**GroupViz** is an interactive web application for visualizing and exploring finite group theory. It provides 7 visualization modes, supports multiple classical group families, and renders all mathematical notation with KaTeX.

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-blue" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6.0-blue" alt="TS 6">
  <img src="https://img.shields.io/badge/Three.js-0.184-orange" alt="Three.js">
  <img src="https://img.shields.io/badge/KaTeX-0.16-green" alt="KaTeX">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="MIT">
</p>

---

## Use onlne

`https://rrcathy.github.io/GroupViz/`



## ✨ Features

### Group Structure Visualization
- **Subgroups** — compute, list, and highlight all cyclic subgroups
- **Conjugacy classes** — automatic partition analysis
- **Center** — identify central elements
- **Subgroup lattice (Hasse diagram)** — nodes arranged by layer with normal subgroups highlighted
- **Coset decomposition** — left/right coset, color-coded, Lagrange's theorem verification in Cayley table
- **Simple group detection** — automatic property checking

### 7 View Modes
| View | Description |
|------|-------------|
| **Set View** | Circular layout of all group elements |
| **Cayley Graph (2D)** | SVG-based, force-directed layout, draggable nodes, configurable edges |
| **Cycle Graph** | Cyclic subgroup visualization with maximal cycle filtering |
| **Cayley Table** | Interactive multiplication table with row/column highlighting |
| **Cayley Graph (3D)** | Three.js rendering, 15 shape templates, orbit controls |
| **Symmetry View** | Polyhedra geometry + element rotation animations + rotation axis markers |
| **Subgroup Lattice** | Hasse diagram with layer-based layout |

### Supported Groups
| Group | Symbol | Order | Implemented |
|-------|--------|-------|-------------|
| Cyclic | Zₙ (n=1..20) | n | ✅ |
| Dihedral | Dₙ (n=3..8) | 2n | ✅ |
| Symmetric | S₃, S₄, S₅ | 6, 24, 120 | ✅ |
| Alternating | A₃, A₄, A₅ | 3, 12, 60 | ✅ |
| Klein Four | V₄ | 4 | ✅ |
| Quaternion | Q₈ | 8 | ✅ |
| Direct Products | Z₄×Z₂, Z₂³, Z₃×Z₃, Z₆×Z₂ | 8, 8, 9, 12 | ✅ |
| Any G×H | arbitrary pair (max 144) | \|G\|·\|H\| | ✅ |

### Key Features
- **Cayley graph by element action** — edges defined by any group element (generalized Cayley graph), right/left multiply switchable
- **16 selectable 3D shape templates** (17 defined) — auto-assigned by group properties (truncated polyhedra for S₄/A₄/A₅); smart DP shape selection (lattice/cylinder/torus)
- **Multi-view floating windows** — open multiple views simultaneously for comparative analysis
- **Direct product construction** — build any G×H interactively (3 modes: cayley/table/direct), localStorage persistence
- **Subset analysis** — save element selections; auto-detect subgroup / normal subgroup via closure tests
- **Self-inverse element detection** — highlights elements where g⁻¹ = g
- **Session save/restore** — auto-save to localStorage, resume after refresh
- **Dark/light theme** — CSS custom properties, system preference detection
- **View export** — SVG (2D views), PNG (3D views), GIF (symmetry animation)
- **i18n** — Chinese / English UI with localStorage persistence
- **Small group registry** — all 19 groups of order < 12 with precomputed subgroup/conjugacy class data
- **Performance guards** — subgroup/conjugacy class calculation cutoff at order 60; DP multiply/inverse cache

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

Then open  `http://localhost:5173/` in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📖 Usage

1. **Select a group** from the left panel (Cyclic, Dihedral, Symmetric, Alternating, or Special groups)
2. **Switch views** using the tab bar or left panel buttons
3. **Interact with the canvas** — pan (drag background), zoom (scroll), select elements (click), lasso-select (Ctrl+drag)
4. **Explore Cayley graphs** — enable/disable element actions, switch between right/left multiplication, run force layout
5. **Use keyboard navigation** — ← → to cycle through elements
6. **Open floating views** — toggle multi-view mode to compare different representations side by side

> Backend layout service: For very large or complex direct-product groups, GroupViz can offload layout computation to an external FastAPI service. See VISUALIZATION.md → "13. 布局路由与后端 FastAPI 规范" for details on routing (precomputed / frontend / backend), API endpoints and integration points.

---

## 🛠 Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | TailwindCSS 4 |
| 3D Rendering | Three.js + React Three Fiber |
| Math Rendering | KaTeX |
| State Management | React Context + Hooks |
| i18n | Custom React Context |

---

## 📂 Project Structure

```
src/
├── __tests__/            # Unit tests (groups, subgroups)
├── components/
│   ├── Canvas/           # 8 view components + floating window
│   ├── Panels/           # 7 panel components + constants
│   ├── Tex.tsx           # KaTeX React component
│   └── WelcomePage.tsx   # Animated math symbols splash screen
├── core/
│   ├── types.ts          # Types, color palette, shape detection (278 lines)
│   ├── groups/           # 7 group implementation files
│   ├── algebra/          # Subgroups, cosets, conjugacy, force layout
│   ├── polyhedra.ts      # Polyhedron vertex generation
│   ├── elementRotation.ts # Group element → 3D geometric rotation
│   └── viewBox.ts        # SVG viewport sizing
├── context/              # Global state provider + 4 action modules
├── i18n/                 # Chinese/English translations
├── types/                # TypeScript declarations (gifenc)
├── utils/                # Unicode→TeX converter, export, group factory
└── assets/               # Static images (hero.png)
```

---

## ⌨️ Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and produce production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

---

## 📚 Mathematical Background

GroupViz visualizes concepts from abstract algebra and finite group theory:

- **Lagrange's Theorem** — order of any subgroup divides the order of the group
- **Cayley's Theorem** — every finite group is isomorphic to a subgroup of a symmetric group
- **Class Equation** — |G| = sum of conjugacy class sizes
- **Isomorphism Theorems** — G/ker(φ) ≅ im(φ)

### Cayley Graph Terminology

GroupViz implements a **generalized Cayley graph** where edges can be defined by any group element, not just generators:

- **Standard Cayley graph**: edges labeled by a generating set S ⊆ G
- **Generalized Cayley graph** (used here): edges labeled by arbitrary elements of G

This generalization allows users to explore how different subsets of group elements define connectivity patterns. When only generators are enabled, the result matches the standard Cayley graph.

Edge semantics:
- **Right multiplication**: edge from a to b if a·c = b
- **Left multiplication**: edge from a to b if c·a = b
- **Bidirectional edges** (no arrow) when the action is involutive (a·c = b and b·c = a)

---

## 🔮 Roadmap

- [x] 7 visualization modes
- [x] Multi-view floating windows
- [x] Subgroup lattice (Hasse diagram)
- [x] Symmetry view with polyhedra rotation animations
- [x] Small group precomputed registry (order < 12)
- [x] i18n (Chinese / English)
- [x] Coset decomposition UI visualization
- [x] Direct product construction system (any G×H)
- [x] 2D Cayley multi-shape layouts (circular/grid/spherical)
- [x] Dark/light theme
- [x] Session save/restore
- [x] View export (SVG/PNG/GIF)
- [ ] Lagrange's theorem verification animation
- [ ] Group operation law verification animations
- [ ] Custom finite group input
- [ ] Group isomorphism testing
- [ ] Tutorial mode

---

## 📄 License

MIT © 2026

---

*Built with passion for mathematical visualization.*
