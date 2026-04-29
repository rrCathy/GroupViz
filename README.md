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

## ✨ Features

### Group Structure Visualization
- **Subgroups** — compute, list, and highlight all cyclic subgroups
- **Conjugacy classes** — automatic partition analysis
- **Center** — identify central elements
- **Subgroup lattice (Hasse diagram)** — nodes arranged by layer with normal subgroups highlighted
- **Coset decomposition** — left/right coset computation (UI in development)
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
| Symmetric | S₃, S₄ | 6, 24 | ✅ |
| Alternating | A₃, A₄, A₅ | 3, 12, 60 | ✅ |
| Klein Four | V₄ | 4 | ✅ |
| Quaternion | Q₈ | 8 | ✅ |
| Direct Products | Z₄×Z₂, Z₂³, Z₃×Z₃ | 8, 8, 9 | ✅ |

### Key Features
- **Cayley graph by element action** — edges defined by any group element, right/left multiply switchable
- **15 3D shape templates** — auto-assigned by group properties (truncated polyhedra for S₄/A₄/A₅)
- **Multi-view floating windows** — open multiple views simultaneously for comparative analysis
- **Subset analysis** — save element selections; auto-detect subgroup / normal subgroup via closure tests
- **Self-inverse element detection** — highlights elements where g⁻¹ = g
- **i18n** — Chinese / English UI with localStorage persistence
- **Small group registry** — all 19 groups of order < 12 with precomputed subgroup/conjugacy class data

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

Then open `https://rrcathy.github.io/GroupViz/` in your browser.

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
├── components/
│   ├── Canvas/           # 7 view components + floating window
│   ├── Panels/           # Left toolbar + Right property panel
│   ├── Tex.tsx           # KaTeX React component
│   └── WelcomePage.tsx   # Animated math symbols splash screen
├── core/
│   ├── types.ts          # Types, color palette, shape detection
│   ├── groups/           # 6 group implementation files
│   ├── algebra/          # Subgroups, cosets, conjugacy, force layout
│   ├── polyhedra.ts      # Polyhedron vertex generation
│   ├── elementRotation.ts # Group element → 3D geometric rotation
│   └── viewBox.ts        # SVG viewport sizing
├── context/              # Global state (820-line provider)
├── i18n/                 # Chinese/English translations
└── utils/                # Unicode→TeX converter
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

The Cayley graph is defined by the action of any group element:
- **Right multiplication**: edge from a to b if a·c = b
- **Left multiplication**: edge from a to b if c·a = b
- Bidirectional edges (no arrow) when the action is involutive

---

## 🔮 Roadmap

- [x] 7 visualization modes
- [x] Multi-view floating windows
- [x] Subgroup lattice (Hasse diagram)
- [x] Symmetry view with polyhedra rotation animations
- [x] Small group precomputed registry (order < 12)
- [x] i18n (Chinese / English)
- [ ] Coset decomposition UI visualization
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
