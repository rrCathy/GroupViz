# 视图系统 (Views)

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。

13 种视图模式（`ViewMode`：'set' | 'cayley' | 'cycle' | 'table' | '3d' | 'symmetry' | 'sublattice' | 'homomorphism' | 'cosetstrip' | 'action' | 'sylow' | 'tree' | 'prestable'），主画布 `GroupCanvas.tsx` 按 `currentView` 分发渲染。其中 ViewPanel 显示 9 个视图卡片；**tree / prestable 两个群展示专用视图的入口在左侧「群展示」面板底部按钮**（不在视图卡片中）。

## 1. 集合视图 (SetView.tsx)

- 元素按 ⌈√n⌉ 列密堆积网格排列（替代早期圆圈排列）
- 支持 2D Cayley 形状选择

## 2. 凯莱图 (GroupCanvas.tsx)

详见 [CAYLEY.md](CAYLEY.md)。支持平移、缩放（上限 8x）、选中、框选、套选、键盘导航（←→ 切换元素）、节点拖拽。

## 3. 圆圈图 (CycleView.tsx)

- `cycleGraphLayout`（精确复刻 Group Explorer CycleGraphView）：单位元 e 固定在原点（永不重放）；每个极大循环 = 「花瓣」圆弧——第 k 个非单位元 gᵏ 落在圆心 (0,R) 半径 R 的弧上 `(-R·cosθ, R(1+sinθ))`，θ=2π(k/n−0.25)；循环按共享非单位元聚成 part（并查集 uniteParts：合并时被并入 part 的每个循环经 `bestPowerRelativeTo` 重新轮换，使共享元素在同一弧索引对齐）；各 part 按循环长度之和比例分配角度弧（单 part 退化用半圆弧；若最大 part 占 >1/2 则各弧长封顶 total/2），最大 part（循环数最多）弧中心旋转正下方；part 内多循环用 `gravity=ringNum/part.length` 拉向弧中心；共享元素只由首个循环放置、后续循环引用同一位置（「蝴蝶」双花瓣例 Z₂×Z₄；SL(2,3) 7 个循环共点 −I 太阳放射）；不在任何 ≥3 阶循环里的 2 阶元素 = 从 e 出去的「叶柄」线段；**风车式改进**：所有极大循环都「只共享 e」的群（S3/Dn/A4/A5/V4/纯直积等，partition 全是单循环 part）不走最大 part 朝下旋转——每片花瓣/叶柄均匀绕 e 分一整圈（360° 等分扇区，g=0 无 gravity），且共享判定必须排除 e（含 e 恒相交会把所有 part 并成一个半圆弧）；复杂点共享（C₅×S₃ 等）为 GE 平面固有的少量边交叉（无回退）
- 极大模式画风：细实线多边形、无填充、无虚线、无 `⟨g⟩ ≅ Z_n` 标注（对齐 Nathan Carter《群论彩图版》/ Group Explorer）
- `showMaximalCycles` 默认 **true**（只画极大循环）；关掉后回退到「全部循环 + 彩色虚线标注」的诊断视图
- 2 阶极大循环（V₄ 的三条线段）以 `<line>` 呈现，≥3 阶以闭合多边形呈现
- 浮动窗口（ViewWindow view=cycle）类似凯莱图：默认不显示元素标签（showLabels=false）；点击元素→高亮显示它所在极大循环（CYCLE_COLORS 彩色填充 fillOpacity 0.18 + strokeWidth 4 + ⟨g⟩≅Z_n 标注）

## 4. 乘法表 (TableView.tsx)

- 使用 SVG `<text>`（foreignObject 开销大）
- 陪集彩色矩形条纹高亮（同一陪集单元格）
- 缩放上限 10x
- **大群（|G| > 16）三策略**（顶部策略栏，默认子群展示）：子群展示 = 随机挑 ≤16 阶子群（优先 6-12 阶；合成/循环/`findAllSubgroups` ≤60 阶多源候选去重，无合适回落随机）；随机展示 = 随机挑 6-12 个元素；全量展示 = |G| > 30 弹确认框后进入**全屏模态**（fixed 覆盖全视口，隐藏两侧栏与工具栏），完整 n×n 表 + 右上角工具栏（−/+/⟳ 按钮 + **缩放滑块 25%-600%** + 导出 SVG + 退出全屏/ESC 重置为子群展示）；全屏内滚轮 = 纯上下滚动、拖动平移，**带视口锚定的缩放**。主视图支持画布级平移/缩放（`translate(T) scale(S) translate(offset)` 变换链，悬停光标抓取/拖拽/滚轮缩放/双击空白复位）
- 大群视图滚轮=缩放、拖拽=平移；全屏视图滚轮=滚动、滑块=缩放（两者操作约定分离）

## 5. 3D 凯莱图 (Cayley3DView.tsx)

详见 [CAYLEY.md](CAYLEY.md) 第 5 节。

## 6. 对称性视图 (SymmetryView.tsx)

将群元素映射为多面体上的几何对称变换。

**支持的多面体**：

| 群 | 几何体 | 顶点数 | 面数 |
|---|--------|-------|------|
| Cₙ | 正n边形 | n | - |
| Dₙ | 正n边形 | n | - |
| A₄ | 正四面体 | 4 | 4△ |
| S₄ | 正方体 / 正八面体(切换) | 8/6 | 6□/8△ |
| A₅ | 正二十面体 / 正十二面体(切换) | 12/20 | 20△/12⬠ |
| V₄ | 长方形 | 4 | - |

**双层映射**：`computeGeometricRotation()`（SymmetryView.tsx）调用 `computeElementRotation()`（elementRotation.ts）获取旋转类型/角度，再按实际几何数据计算轴方向：

```
computeElementRotation(group, element) → { angleRad, label }  (旋转类型)
        ↓
getElementRotationKind(symbol, cycleType) → 'vertex' | 'face' | 'edge'  (轴类型)
        ↓
getGeometryAxes(data, symmetryType) → { vertexAxes, faceAxes, edgeAxes }  (从几何数据计算轴池)
        ↓
computeGeometricRotation() → { axis, angleRad, label }  (最终结果)
```

**轴渲染**：实体圆柱体 + 锥体箭头（WebGL 线宽不可靠），红色自发光材质。

**轴-几何体交点标记**：顶点交点（黄）、棱中点交点（青）、面心交点（绿），阈值 0.25。

**动画**：`useAnimatedRotation` 三阶段——复位(t=0→0.5) → 旋转(t=0.5→1.0, slerp) → 静止(t>1.0)；OrbitControls 动画期间禁用。

**状态**：`symmetryShowAction`（显示元素操作）、`symmetryRotateSpeed`（0.2~5.0）、`symmetryActionElementId`。

**导出 GIF**：`exportSymmetryAsGif()`——清除选中 → 重设元素触发新动画 → 20fps 录制 2 秒（gifenc）。

**受控内核（v1.23.0，FGVE 阶段 2 批次七）**：`SymmetryView.tsx` 拆 `SymmetryViewScene`（纯 props：group/symmetryType?/dark（场景配色随主题解耦）/variant（dual-solid：cube↔octahedron、icosahedron↔dodecahedron）/showAction/actionElementId/rotateSpeed/showFigureTitle/locked/onHint/hintOnIdle/replaySignal）+ context 壳 `SymmetryView()`（签名不变）。场景内悬浮变体切换按钮移除——主画布改由 ViewPanel 的 Shape 选项喂 `variant`（`GroupSymmetryContext` 新增 `symmetryVariant`，换群复位）。ViewWindow 接入：渲染分支直渲 Scene（dark=窗口主题、`showFigureTitle` 缺省 false——标题栏已显群名避免重复、locked=config.locked、onHint→内容区底部 ⟳ Replay / ✕ Reset 浮条）+ 参数面板 Symmetry View 段（unsupported 群提示 / dual solid 切换（仅 cube|icosahedron 类群）/ Show element actions + Speed slider / Action element 列表点行触发、点已选行重播、✕ Reset pose / `config.actionLocked` 固定演示模式——列表与 Reset 隐藏只读 fixed 元素、只能 ⟳ Replay）；`replaySignal` 显式重放修复「动画播完无入口重看」缺口；视作自管理布局禁用窗口 ct 平移缩放（同 3d）。

## 7. 子群格视图 (SubgroupLatticeView.tsx)

- Hasse 图：节点按层级排列，边表示包含关系
- 正规子群高亮
- 大群（order>60）：显示后端 `backendCache.lattice` 结果
- **子群列（series）**：ViewPanel 子群格分支的「子群列」选择器（关/导列/上中心列/下中心列/合成列，`GroupSeriesContext` 提供状态）：
  - 系列项节点彩色描边（导列金 / 中心列青 / 合成列紫）+ 左下角圆形序数角标；系列路径边加粗同色；不在系列中的节点调暗（opacity 0.22）
  - 底部系列面板：TeX 链式 `G ⊵ N₁ ⊵ … ⊵ ⟨e⟩`、各级阶 `|Nᵢ| = n`、因子 `Nᵢ/Nᵢ₊₁ ≅ …`（导列/中心列共用 `computeSubgroupSeries`；合成列用枚举链 `computeChainFactors`）
  - 判语徽标：可解（绿）/幂零（蓝）chip；合成列显示合成因子多重集 + Jordan–Hölder 说明
  - 合成列多链切换：小群枚举全部合成列（≤20 条守卫），面板出现链选择器（`i / n`）+ 链数文案；截断时黄色警示
  - 大群守卫：`SERIES_MAX_ORDER = 240`，超限显示提示文案（后端二期）

### 7.1 受控内核与小窗口可读性（v1.19.0，FGVE 阶段 2 批次三）

`SubgroupLatticeView.tsx` 拆为三块：**`SublatticeScene`**（受控内核，全 props 可选、缺省在渲染层 `??` 解析）、**`SeriesPanel`**（纯呈现）、尾部同名组装壳 `SubgroupLatticeView()`（吃 `useGroup()`，GroupCanvas 与旧浮动窗零改动）。内核可只给 `group` 自算格（order ≤ 60），或由宿主传 `lattice`（大群后端通路）。

小窗口里"名片糊成一团"靠四层解决（布局/LOD 纯函数在 `src/core/algebra/latticeLayout.ts`）：

| 层 | 做法 | 关键点 |
|----|------|--------|
| fit | 世界坐标紧贴内容（旧实现有 1000×600 下限，连 6 节点的 S₃ 格塞进 520px 窗口都只剩 7px 文字）；每层按 slotW 均分槽位并整体居中 | `computeLatticeLayout`；同层顺序走 `orderLevelsByBarycenter`（交替自上/下扫描降交叉，`countLatticeCrossings` 可诊断） |
| LOD 三档 | 按**槽位屏幕宽+高双指标**自动定档：`full`（≥150×66，完整名片）→ `compact`（≥56×26，胶囊只留一行，顶层群符号走 KaTeX）→ `dots`（圆点 + 类别色编码） | 双指标必需：合并后的轨道格窄高，单看宽度会误降；compact/dots 几何按 `1/eff` 反算并以槽位封顶 → 屏幕恒定大小且永不重叠；`labelDetail` 参数可手动定档 |
| 共轭合并 | `mergeConjugates`：gHg⁻¹ 同一轨道的子群合成一个节点 + `×n` 角标（n = 轨道长 = `\|G : N_G(H)\|`），S₃ 6→4、A₄ 10→5 | `subgroupConjugacyOrbits` 闭包**只用生成元**（⟨S⟩=G ⇒ 与全元素共轭同果，代价 O(Σ\|orbit\|·\|S\|·\|H\|)，S₆ 也可用）；边 = Hasse 边的像 → 去重 → `transitiveReduce` → `levelsByOrderRank`；`MERGE_MAX_NODES = 2000` 守卫超限回退并提示 |
| 信息外置 | 底部 `lattice-caption` 一行按 hover ?? 选中给出完整名片：`\|H\|=3 ≅ C₃ · [G:H]=4 · 4 个共轭子群 · \|N_G(H)\|=3 · ⟨(234)⟩ · N₁·导列` | 结构符号 = `subgroupStructureSymbol`（在母群上就地算子集阶分布 + 交换性，O(\|H\|²) 只在悬停节点跑）；series 面板在窗口里默认收起（`showSeriesPanel=false`）以免吃掉 1/4~1/3 绘图区 |

**ViewWindow 接入**（`view === 'sublattice'`）：参数面板四控件 = Label detail 下拉（auto/full/compact/dots）、Merge conjugates 复选、Card size 滑杆（0.6–1.6）、Series panel 复选；持久化键 `gv-vw-{symbol}|{order}|sublattice`（`__gvVersion` 信封 + `sublatticeViewParamsSchema` 校验回退）。

**两个坑**：① svg 必须**绝对定位**在 `flex:1 / minHeight:0` 宿主内——否则其 viewBox 宽高比会以 min-content 高度撑破定高窗口（Chrome 行为）；② 内核用 ResizeObserver 自测绘图区像素（`getBoundingClientRect`），不吃宿主 `viewBoxSize`——因为 ViewWindow 传的是**像素**而 GroupCanvas 传的是**世界 viewBox**，语义冲突；测得 0（首帧/happy-dom）→ fit=1 落 full 档。

**主画布行为**：窗口增高时槽位屏幕宽度上升，档位自动从 compact 升回 full（实测 S₃ 在 1500×1250 视口下恢复完整名片，Sylow/正规/Z(G) 角标齐全）；`fit ≤ 1` 保证名片不会被放大到失真。

## 8. 同态视图 (HomomorphismView.tsx)

- 源/目标群两个圆形 Cayley 图 + 弯曲彩色映射边
- 悬停/固定源元素 → 高亮像；悬停目标 → 高亮原像
- 核（红）/像（青）着色 + 单射/满射/同构 chips
- `theoremMode` 时全屏渲染 `FirstIsomorphismAnimation`（4 阶段动画证明 G/ker ≅ im：核 → 商群纤维簇 → 同构），步进按钮 + 方向键
- **受控内核（v1.21.0，FGVE 阶段 2 批次五）**：`HomomorphismScene`（纯 props：source/target/mapping/result/name/theoremMode/onTheoremModeChange/theoremAnimation/showLabels/onHover，`result` 缺省内部 `verifyHomomorphism` 推导）+ context 壳 `HomomorphismView()`；`FirstIsomorphismAnimationScene`（纯 props + `onPhaseChange` 回写替代 `setTheoremPhase`）+ context 壳。ViewWindow 经 `homomorphism?: Homomorphism` 单 prop 打包双群接入（view==='homomorphism' 时 group 可为 null）；`HomomorphismViewParams{showLabels?}` 窗口缺省隐藏节点标签靠悬停就地气泡（源/目标节点 `<g data-homo-source-node>/<g data-homo-target-node>` 钩子）；视作自管理布局禁用窗口 ct 平移缩放（同 3d/symmetry）。

## 9. 陪集条带视图 (CosetStripView.tsx)

- `cosetStripLayout()` 带标签的彩色列（条带）
- 子群列实线粗标签，其余虚线；节点按陪集着色，点击/ctrl 选中
- 底部 `|G|=n = |H|·[G:H]` Lagrange 定理验证
- **子群凯莱图（圆形）**：子群条带上方展示 ⟨H⟩ 的圆形凯莱图（`cayleyCircleLayout` + 子群最小生成元作用边，箭头按生成元着色，自逆无向；|H| ∈ [2,12] 时显示，布局自动加顶部留白 `topPadding`）
- 空态提示目前为硬编码英文

## 10. 轨道视图 / 群作用 (ActionView.tsx)

详见 [ACTIONS.md](ACTIONS.md)。轨道簇布局（大小升序左→右，固定点 ★ 最左）、生成元作用边、hover 群元素显示全部箭头、点击元素 → 右侧面板 OST/Stab 详情；自定义作用编辑模式（元素围圈 + 生成元 chips + 虚线未绑定箭头）。isTooLarge 阈值 120。

## 11. Sylow 视图 (SylowView.tsx)

以群元素为最小节点（节点 = 元素）的 p-子群浏览器：p 可选素数（|G| 素因子），工具栏统计 p-元素数 / p-子群数 / n_p / `|G| = p^k·m`。

- **默认凯莱图布局**：圆环排列（`cayleyCircleLayout`），边 = 群生成元作用（右乘，颜色对应）；点击子群 → 边切换为该子群生成元作用
- **单选子群 → 陪集条带布局**：`cosetStripLayout` + 底部 Lagrange 验证 `|G| = |H|·[G:H]`
- **Ctrl/⌘ 或 ⊕ 复选两个子群 → 共轭视图（Sylow 第二定理）**：上下两行布局（公共元素 P∩Q 中间拉链交错列），自动求共轭元 g 满足 gPg⁻¹ = Q，竖直双向金色共轭箭头 + 图上标注 `共轭: g = …`；两子群内部生成元边（P 青 / Q 紫）
- **子群列表**：Sylow p-子群（★ + ◁ 正规标记，|H|=p^i + ⟨生成元⟩ TeX）+ 其他 p-子群（默认收起）；⊕ 复选按钮；列表可整体收起（▶/◀）
- 节点配色：选中金色 → P∩Q 金色 → P 青 → Q 紫 → p-元素青描边 → 其他灰化（opacity 0.3）；legend 随模式切换
- 数据：`findAllPSubgroups`（专用 p-子群枚举算法，SYLOW_MAX_ORDER=240 守卫，isTooLarge 阈值 240）

## 12. 树视图 / 退化树 (FreeGroupTreeView.tsx)

展示当前群（或模板）的**退化树**：商群凯莱图的 BFS 生成树（`computeCayleyTree`）——从 e 出发按生成元 BFS，每个元素只保留首次到达的边；**实线 = 生成树边**（首次到达，按生成元 a/b/c 着色）；**粘合边不绘制**（指向已访问元素的边被省略，顶部 bar 以金色「粘合边 ×N」计数呈现——计数越大树「塌缩」越明显，直观体现「关系 = 砍树」）。

**布局按群结构规则化**（`cayleyTree.ts`）：
- **1 生成元 → 直线**（不衰减）：如 ⟨a|a³⟩ = 直线 e-a-a⁻¹（a³ 的边被粘合不绘制，粘合边计数 1）
- **2 生成元交换格**（全部元素词形如 a* b*，如 V₄、Z×Z、⟨a,b|ab⟩）→ **正方形网格**（不衰减，无遮挡）
- **2 生成元非交换/自由积**（D₃、⟨a,b|a²⟩=C₂*ℤ）→ 谢尔宾斯基十字（层距逐层减半防遮挡）
- **3 生成元 → 3D**（R3F Canvas，立方体方向 ±x/±y/±z 层距减半；OrbitControls 旋转/缩放，点击节点显示词）

有限群全部元素一次展示（`computeBaseZoom` 自动 fit）；无群时展示自由模板树（`computeFreeTree`，深度随缩放自适应 0–8）。交互：滚轮缩放、拖拽平移、双击复位、点击节点显示词（金色高亮 + 顶部 bar）。顶部 `.relator-bar` 显示 ⟨S|R⟩ TeX + |G| 或 ∞ + 粘合边计数。

## 13. 展示乘法表视图 (PresentationTableView.tsx)

乘法表式展示浏览：行/列 = 群元素（列×行，同 TableView），顶部 `.relator-bar` 静态展示 `⟨生成元|关系词⟩` TeX。order > 36 自动采样（identity + 选中 + 等距，cap 20 格），显示大群警告。行/列头点击可加选元素，单元格点击/悬停选中结果元素。

## 14. 多视图模式

`toggleMultiViewMode()` 开启后可通过 `openFloatingView(view)` 打开浮动窗口（`FloatingViewWindow.tsx`）：

- 可拖拽、调整大小；所有窗口共享同一 `currentGroup`
- 主画布与浮动窗口可同时对比不同视图
- 缩放上限 8x（乘法表 10x）

## 15. 直积/半直积构建视图- `DirectProductView.tsx`：直积群构建画布（isDirectProductMode 时替换主画布）
- `SemidirectProductView.tsx`：半直积设置 + 4 步教学动画（详见 [GROUPS.md](GROUPS.md) 第 4 节）

## 16. 大群视图守卫

`forceShowLargeGroupViews`：order > 60 的群对计算密集视图（cycle/sublattice/symmetry/homomorphism/cosetstrip）提供守卫与后端降级。

**阈值可覆盖（v2.1.0，FGVE 消费端优化）**：`core/viewBox.ts` 新增 `sizeLimitFor(view)`（可读默认值表）并给 `isTooLarge(order, view, limitOverride?)` 增加第三参；各 Scene 对应 prop——`largeGroupThreshold`（Set/Cycle/Cayley，默认 60）、`maxTableOrder`/`maxHeatmapOrder`（Table）、`maxEnumerateOrder`（Sublattice，默认 60）。宿主可据此放宽/收紧守卫，`tree` 阈值 = `Infinity`（树视图不设限）。

## 17. 嵌入式消费约定（FGVE 双包，v2.1.0）

外部宿主把 Scene 嵌入自有页面（如博客）时的统一约定，详见包内 `docs/API.md`：

- **元素引用类 props 一律接受 label / id / value**（`actionElementId`、`actions[].elementId`、`CosetStripScene.subgroup`、`SymmetryViewScene.actionElementId`…），内部经 `core/algebra/elementRef.ts` 的 `resolveElement` 按 **id → label → value** 归一化解析；未命中 `console.warn` 一次并忽略（不抛错）——不再要求宿主先查机器 id。
- **主题统一 `theme?: 'dark' | 'light'`**：7 个 2D Scene + SymmetryViewScene 均支持，经 `SceneThemeRoot` 注入 `data-theme` 作用域（复用 `theme.css` 变量块）；**未传时零额外 DOM、行为与旧版完全一致**。`SymmetryViewScene.dark` 保留为别名，`theme` 优先。
- **相机门控**：`SymmetryViewScene.lockCameraOnAction` 默认 **false**——演示动画播放时相机保持可旋转（旧行为恒锁死，是实测卡点）。
- **受控状态便利层**：`useSceneState(group?, options?)` 一次给出 `viewBoxSize`/`canvasTransform`/选中/hover 气泡/节点位置与可 spread 的 `sceneProps`、`hostProps`（内含回调 ref + 内置平移、光标锚定缩放、ResizeObserver），免去宿主手写 ~80 行胶水；新 `SceneHoverBubble` 提供默认悬停气泡。注意 `hostProps` 要一次 spread 到容器上，别再自己写 `ref`（会顶掉内建 ref）；需要 DOM 节点用 `getHostElement()`。
- **i18n 免 Provider**：`useTranslation().t` 默认按 `zh → en → key` 三级兜底，不包 `I18nProvider` 也不会回落成裸 key（仍建议包 Provider 以支持 `lang` 切换）。
- **陪集一键数据**：`buildCosetViewData(group, subgroupRefs, { side, highlightAll, selected })` 直接产出 `cosetElementMap`/`cosetColors`/`cosetHighlightSet`，或直接用 `CosetStripScene` 的 `subgroup?: string[]` 便捷入口。

