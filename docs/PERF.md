# 性能基准（PERF）

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 本文档沉淀**性能极限的实测数据、测量方法与优化取舍**——回答「这个视图能开到多大群」以及「卡的时候该改哪里」。
> 首次测量：**2026-09-13**（不计后端）。数据为单机实测，非估算。未做的优化项见 [ROADMAP.md](ROADMAP.md)。

## 1. 一句话结论

**SVG 视图的卡顿来自「交互每帧重跑一次 React 全量重渲染」，不是栅格化。**

判别实验（同场景 A/B 对照，真实 Chromium）：

| 群（DOM 节点） | A 应用滚轮缩放（走 React） | B 绕过 React 直接给 `<svg>` 设 CSS transform |
|---|---|---|
| C120（3722） | 33 fps · TBT 235 ms | **60 fps · TBT 0 ms** |
| C480（14882） | 9 fps · TBT 1198 ms | **58 fps · TBT 0 ms** |
| C960（29762） | 9 fps · TBT 1443 ms | **41 fps · TBT 77 ms** |

栅格层在近 1.5 万节点下仍有 58 fps ⇒ **它不是瓶颈**。A 组每帧的成本恰好等于「单次整树重渲染」耗时（C480 = 307 ms，C960 = 620 ms）。

推论（决定了优化方向）：**任何「减少绘制量」的努力（换 Canvas、上 WebGL、加虚拟列表）收益接近零；只有减少重渲染频次才有收益。**

## 2. 三层模型

性能不是一个数，是三个不同层级的独立量。混为一谈会得出错误结论。

| 层 | 测什么 | 怎么测 | 对应真实体验 |
|---|---|---|---|
| **L1 本地计算** | 纯 JS 计算（建群 / 边计算 / 布局 / 子群枚举），无 DOM | node 直跑核心计算管线 | 切群/切视图前的等待 |
| **L2 前端计算** | React 协调 + DOM 构建（**无排版无绘制**） | happy-dom 下 render 组件 | 一次状态变更的成本 |
| **L3 浏览器渲染** | 样式计算 + 排版 + 栅格化 + 合成；分**静态**与**交互**两种工况 | 真实 Chromium + 帧采样 | 拖拽/缩放是否跟手 |

**关键**：L3 的「静态」与「交互」是两个数量级不同的极限，必须分开测。

## 3. 各视图极限（2 秒预算，不计后端）

判定线：单次视图切换从触发到首帧布局完成 ≤ 2 秒。

### 3.1 L1 本地计算

| 视图类别 | 2 秒内可用上限 | 实测关键数据 |
|---|---|---|
| 图形类（set / cayley / table，圆环布局） | **5000+ 阶** | C10000 圆环布局 9 ms；边计算 O(n) |
| cycle（力导向） | **≈ 480 阶** | C240 = 374 ms · C720 = 5.4 s · C1440 = 22 s |
| 子群枚举类（sublattice / homomorphism / action / sylow / coset） | **≈ 144 阶** | C300 = 105 ms · D60(120) = 1.07 s · **D72(144) = 1.81 s** · D84(168) = 3.45 s · D120(240) = 19 s · D200(400) = 100 s |
| Sₙ 族 | **S₅ (120)** | S₆(720) 的 `findAllSubgroups` **> 10 分钟**；A₆ 构造即拒绝（n > 5） |
| 注册表群 16–31 阶 | **全部通过** | 最坏 order 24（15 个群）总 75 ms / 单群 21 ms |

### 3.2 L2 前端计算（React + DOM 构建，happy-dom）

| 视图 | 120 阶 | 480 阶 | S5(120) | S6(720) |
|---|---|---|---|---|
| SetView | 38.7 ms | 56.9 ms | 40.9 ms | 78.8 ms |
| CycleView | 30.7 ms | 140.7 ms | 38.8 ms | **611 ms** |
| CayleyView | 38.2 ms | 69.5 ms | 45.2 ms | — |
| TableView | 9.9 ms | 19.4 ms | 10.1 ms | — |

- **DOM 节点 ≈ 20 × 群阶**（节点 + 标签 + foreignObject）。SetView C480 = 14882 节点、C1920 = 59522 节点。
- SetView 在 >60 阶时标签被裁剪（`largeGroupThreshold`），节点数封顶在 192 个 foreignObject —— 这是它比 CycleView 便宜得多的原因（CycleView 在空选择下渲染全部标签）。

### 3.3 L3 浏览器渲染（真实 Chromium，生产构建，1600×1200）

静态空闲（内容不动、只跑 rAF）：

| 群阶 | 120 | 240 | 480 | 960 | 1920 |
|---|---|---|---|---|---|
| idle fps | 60 | 60 | 59 | 55–56 | 48 |

**静态几乎是平的** —— 59522 节点仍 48 fps。

交互（连续滚轮缩放 2 s，强制重栅格 + 重渲染）：

| 群阶 | set | cycle | cayley | table |
|---|---|---|---|---|
| 120 | 44 fps · TBT 43 ms | 50 fps · TBT 1 ms | 52 fps · TBT 0 ms | 60 fps · TBT 0 ms |
| 240 | 26 fps · TBT 478 ms | 32 fps · TBT 282 ms | — | 45 fps · TBT 30 ms |
| 480 | 14 fps · TBT 1120 ms | 17 fps · TBT 856 ms | 9 fps · TBT 1391 ms | 26 fps · TBT 494 ms |
| 960 | 8 fps · TBT 1583 ms | 8 fps · TBT 1378 ms | 3 fps · TBT 1733 ms | — |

真实群：

| 目标 | idle | 缩放 | DOM 节点 |
|---|---|---|---|
| S4(24) set | 60 | 60 | 395 |
| S5(120) set | 60 | **49** | 2152 |
| S6(720) set | 57 | **13** | 13992 |
| S5(120) cycle | 60 | **53** | 2214 |
| S6(720) cycle | 59 | **25** | 14484 |

### 3.4 3D 视图（WebGL）

| 目标 | idle | 缩放 | DOM 节点 |
|---|---|---|---|
| S4(24) 字长球 | 51 | 36 | 85 |
| S5(120) 字长球 | 36 | 29 | 71 |
| S6(720) 字长球 | 43 | 20 | 71 |
| S5(120) cone | 41 | 31 | 71 |

**DOM 恒定 71–85 节点**（就 1 个 canvas），与群阶无关。S6(720) 缩放 TBT 仅 458 ms，而同样 720 阶的 2D set 视图 TBT 1223 ms。

> **测量偏差警告**：headless Chromium 的 WebGL 后端是 **SwiftShader（纯 CPU 软件光栅化）**，上表 3D 数字是**悲观下界**，真 GPU 上显著更好。2D 的 A/B 结论不受影响（与 GPU 无关）。

**3D 为什么流畅**：相机变化走 `useFrame` **命令式**改 three.js 对象，**全程不触发 React 重渲染**。这是架构差异，不是「用了 GPU」。参数化相机操作时若走 React state，3D 也会同样退化。

## 4. 两条天花板

```
图形类视图（set/cycle/cayley/table）
  24 ─────── 120 ──── 240 ────────────────────── 5000+
              交互60fps │ 26–45fps │ 仅静态可看

子群类视图（sublattice/homomorphism/action/sylow/coset）
  24 ─────────── 144 ─────────────────────────── 
              2s内算完 │ 超预算（需后端）
```

- **交互流畅线 ≈ 120 阶**（= L2 成本 ÷ 16.7 ms 帧预算）
- **子群枚举线 ≈ 144 阶**（纯算法复杂度，与渲染无关）
- **本地计算上限 5000+ 阶**（图形类）

两者都比本地计算上限低一个数量级以上，但**它们是两条独立的线**，不要混在同一个排期里。

### 用途分界（重要）

2 秒预算对应**一次性视图切换**，比 60 fps 的交互线宽约 40 倍。因此：

- **需要持续交互**（拖拽、缩放、力导向）→ 收在 120–240 阶以内。
- **只需静态展示 / 出图 / 导出 / 博客配图** → 可以放开到 2000 阶以上，不必跟工作台阈值走。

## 5. 已确认的性能瓶颈清单

| # | 位置 | 复杂度 | 表现 | 性质 |
|---|---|---|---|---|
| 1 | `SetView.tsx:288` / `CycleView.tsx:316` 的 `group.elements.map(...)` 内联、无 memo；`canvasTransform` 是 prop | 每帧 O(节点数) React 协调 | 480 阶缩放 9 fps | 架构 |
| 2 | `SymmetricGroup.ts:35` `findPermIndex` = O(order) 线性扫描，`multiply` 每次调用它 | Sₙ 单次乘法 **O(n!)** | S₆ 子群枚举 > 10 min | 算法 |
| 3 | `subgroups/enumerate.ts:99` `findAllSubgroups` pair-join 闭包（每轮重扫全部对） | O(S²·n) | D200(400 阶) = 100 s | 算法 |
| 4 | `cycleLayouts.ts:116` `forceLayout` `iterations = max(150, min(500, n×5))`，每轮 O(n²) 斥力 | O(n² × 500) | C1440 = 22 s | 参数+算法 |

第 1 条是 L3 交互上限的唯一起因；第 2–4 条各自独立，与渲染无关。

## 6. 测量方法（可复现）

### 6.1 L1（node 纯算）

vitest node 项目（include 仅 `src/__tests__/**/*.test.ts`）。临时探针放该目录，**用完必删**（否则挡住 `tsc -b`）。

- **vitest stdout 会被截断**：探针结果必须 `appendFileSync` 落盘再从文件读，不要靠 console 输出判断。
- 各步单独计时（建群 / 边 / 布局 / 子群 / 格 / 共轭类），否则无法定位卡在哪一步。

### 6.2 L2（React + DOM 构建）

vitest dom 项目（include 仅 `*.component.test.tsx` / `*.integration.test.tsx`）。直接 render 目标视图，计 `render()` 耗时 + `container.querySelectorAll('*').length`。happy-dom 不做排版与绘制，因此该数字**只含 React 与 DOM 构建**——这正是它作为独立一层的价值。

### 6.3 L3（真实浏览器）

Playwright + `window.__groupVizExport__` 桥接驱动真实 Chromium，`PerformanceObserver({entryTypes:['longtask']})` + rAF 帧间隔采样。

脚本骨架（关键片段，可直接粘贴使用）：

```js
// ① 合成任意阶循环群：createGroupFromSymbol 的 C_n 上限只有 30 阶，
//    大阶循环群必须在 page 内构造结构等价的 Group 对象
await page.evaluate(() => {
  window.__mkCyclic = (n) => {
    const elements = []
    for (let k = 0; k < n; k++) elements.push({ id: 'g' + k, label: 'g_{' + k + '}', value: [k] })
    const multiply = (x, y) => elements[(x.value[0] + y.value[0]) % n]
    const inverse = (x) => elements[(n - x.value[0]) % n]
    const gen = { name: 'a', symbol: 'a', color: '#ff6b6b', apply: (el) => multiply(el, elements[1]), inverse: null }
    gen.inverse = { name: 'a^{-1}', symbol: 'a^{-1}', color: '#ff6b6b', apply: (el) => multiply(el, elements[n - 1]), inverse: gen }
    return { name: 'C_{' + n + '}', symbol: 'C_{' + n + '}', order: n, elements, generators: [gen], multiply, inverse, identity: elements[0], isAbelian: true, exponent: n }
  }
})

// ② 帧 + 长任务记录器（进 app 后装一次）
await page.evaluate(() => {
  const b = { frames: [], lt: [] }
  window.__bench = b
  const loop = (t) => { b.frames.push(t); requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
  new PerformanceObserver(l => { for (const e of l.getEntries()) b.lt.push(e.duration) })
    .observe({ entryTypes: ['longtask'] })
})

// ③ 切群 → 切视图 → 解大群警告 → 采样
await page.evaluate((n) => window.__groupVizExport__._setGroup(window.__mkCyclic(n)), 480)
await page.evaluate(() => window.__groupVizExport__._setView('set'))
// 大群警告替换 canvas，必须点掉；且它按「视图」记忆 → 每次 _setView 之后都要点
for (let i = 0; i < 5; i++) {
  const btn = page.locator('.large-group-warning .panel-btn')
  if (!(await btn.isVisible().catch(() => false))) break
  await btn.click().catch(() => {}); await sleep(350)
}
// 空闲 2s 采样 → 滚轮缩放 2s 采样（mouse.wheel 交替方向）
```

### 6.4 三个必须知道的坑

1. **`createGroupFromSymbol` 的 Cₙ 上限 30 阶（已于 2026-09-14 放宽到 120）**。更大阶循环群仍需在 page 内合成 Group 对象后 `_setGroup`（见上方片段）。
2. **大群警告 `.large-group-warning` 是按视图替换 canvas 的**，必须在 `_setView` **之后**点掉，否则测到的是警告占位而非视图。
3. **headless 的 WebGL = SwiftShader（纯 CPU）**，3D 数字偏悲观。

### 6.5 一个快速判据：dev ≈ prod ⇒ 瓶颈不在 JS

同一场景分别对 `vite dev`（5173）与 `vite build && vite preview`（4173）测量：2D SVG 视图的帧率与 TBT **几乎一致**（如 C480 set 缩放：dev 952 ms / prod 1120 ms，均在噪声内）。说明成本在渲染/协调而非构建模式。

## 7. 优化取舍（本项目不走高尖精路线）

### 7.1 值得做（低成本、收益可见、无新依赖）

| 优先级 | 改动 | 预期收益 | 规模 |
|---|---|---|---|
| 1 | **交互期冻结节点树**：拖拽/滚轮期间用 ref 直接写 `<g transform>`，`canvasTransform` 只在手势结束（或节流）才回 React state | 480 阶缩放 9 fps → 接近 58 fps | 数十行，改 3 个视图 |
| 2 | **`findPermIndex` 改 `Map`**：`elements` 的 `id` 本就是 `perm.join(',')`，建 `Map<id, idx>` 即可，每次乘法 O(order) → O(1) | S₆ 建乘法表预期百倍量级提速 | 约 5 行 |
| 3 | ✅ **已完成（2026-09-14）**——大群警告阈值改成本模型文案：视图阈值对齐三条实测线（图形类 240 / 子群枚举类 144 / 3d 720，常量在 `guards.ts`），警告文案改为「静态浏览与出图通常没问题，拖拽/缩放会卡顿」；子群枚举类魔数 60 全部换成 `ENUMERATION_LIMIT`（144） | 少挡掉本来能用的群（120 阶不再警告；61–144 阶子群枚举本地可算） | 已改常量与文案 |
| 4 | **`forceLayout` 大群切异步渐进**：复用已有的 `forceLayoutAsync` + RAF 分块（`cycleLayouts.ts:254`，目前基本未用） | cycle 视图大群从「转圈数秒」变成「先出粗图再细化」 | 中 |
| 5 | **子群枚举改 worklist**：`enumerate.ts:99` 只把新发现的子群与已有子群求 join，而非每轮重扫全部对 | D84(168) 3.45 s 预期压到 1 s 内 | 中 |

第 1 条有一个必须拍板的副作用：`isNodeOnScreen` 裁剪依赖 `canvasTransform`，冻结后**拉远**时不会补出新节点。两种处理方式（手势期间按放大包围盒预裁留余量 / 手势结束再补）影响手感，需先定策略再动手。

### 7.2 明确不做

- ❌ **不为 2D 视图上 Canvas / WebGL 重写**：栅格层在 5.9 万节点下仍有 41–58 fps，重写纯属浪费。
- ❌ **不引入 Web Worker**：这里没有「算得慢拖住 UI」的问题——子群枚举慢是算法复杂度，修算法远便宜于搬线程。
- ❌ **不加虚拟列表 / 窗口化**：绘制量不是瓶颈，只增加状态复杂度。
- ❌ **不继续按群阶加硬编码特判**：现有特判已经很多（如 `createTableGroup` 里 `rec.n === 16 && rec.i === 13` 一类），性能阈值不应再加入这个列表。

### 7.3 可借鉴的既有架构

3D 路径（`Cayley3DScene`）的流畅**不是因为它用 GPU，而是因为它的状态更新是命令式的**。7.1 第 1 条本质就是把这条纪律搬到 2D 的交互层。

## 8. 环境与复现边界

- 单机实测：Windows / Node 22.22.2 / Playwright 自带 Chromium（headless，SwiftShader）/ 32 逻辑核 / 视口 1600×1200。
- 判定口径：「2 秒」= 单次视图切换从触发到首帧布局完成；「fps」= 2 秒窗口内 rAF 间隔均值倒数；「TBT」= 该窗口内 Σ max(0, 长任务 − 50 ms)。
- 结论中「本地计算」一律**不含后端**（后端能力见 [BACKEND.md](BACKEND.md)）。
