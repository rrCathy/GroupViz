# GroupViz - 群论可视化 WEB 应用开发框架

## 1. 项目概述

**GroupViz** 是一个用于可视化和探索群论的交互式 WEB 应用，通过动态图形帮助数学研究者、学生理解抽象代数概念。

### 核心特性

- **群结构可视化**：子群、陪集、正规子群、商群、中心、共轭类、子群格
- **群运算可视化**：Cayley 表、乘法表、运算律验证
- **定理可视化**：Lagrange 定理、Cayley 定理、第一同构定理（动画证明）、轨道-稳定子定理
- **Cayley 图可视化**：2D/3D 广义 Cayley 图（任意群元素作用边，非仅生成元）
- **群构建系统**：直积 G×H、半直积 N⋊_φ H、自同构群 Aut(G)、商群 G/N、同态映射
- **交互**：拖拽、缩放、动画、多视图浮动窗口、视图导出（SVG/PNG/GIF）

> **可视化方案参考**：若对可视化方案不理解（元素如何摆放、边如何连接、视图长什么样），请阅读 `refer/` 目录下的参考书籍，尤其《群论彩图版》（Visual Group Theory，Nathan Carter 著）——Cayley 图、群作用、陪集等约定均以其为准。

> **界面模式（硬核模式）**：当前 UI 定位为**硬核模式**（面向研究者/数学用户，欢迎页 + 三栏工作台）。后续计划开发**教育模式**（引导式学习欢迎页与教学视图），届时按模式切换入口与样式。欢迎页"即将推出"列表：教育模式、自由群、DLC（空间群/点群可视化）。

## 2. 文档导航

详细技术文档已拆分至 `docs/` 目录（本文件为精简索引）：

| 文档 | 内容 |
|------|------|
| [docs/TUTORIAL.md](docs/TUTORIAL.md) | 新手教程（中英双份：TUTORIAL.md / TUTORIAL_zh-CN.md）：快速上手三栏工作台、13 视图实操、群构建/同态/作用/Sylow、导出与多视图、控制速查、学习路径 |
| [docs/GROUPS.md](docs/GROUPS.md) | 群实现：核心类型、群族表、直积/半直积/自同构、小群注册表、群工厂、代数函数、数学参考 |
| [docs/CAYLEY.md](docs/CAYLEY.md) | Cayley 图系统：边计算、2D/3D 渲染、17 种 3D 形状模板、12 种 2D 形状布局 |
| [docs/VIEWS.md](docs/VIEWS.md) | 13 种视图模式（ViewPanel 9 卡片 + 同态/轨道经构建面板进入 + 群展示 2 专用视图：tree/展示乘法表）+ 多视图 |
| [docs/PRESENTATION.md](docs/PRESENTATION.md) | 群展示系统：解析器、Todd–Coxeter 陪集枚举、presentationOf 分发、通用关系发现器、创建/持久化、tree与展示乘法表视图 |
| [docs/STATE.md](docs/STATE.md) | 状态管理：12 Provider 分层、子集/陪集/同态/商群状态、持久化 key、导出、i18n/主题 |
| [docs/BACKEND.md](docs/BACKEND.md) | 后端系统：FastAPI 端点、服务端缓存、混合计算（≤60 本地 / >60 后端）、GAP 大群计算引擎 |
| [docs/UI.md](docs/UI.md) | UI 结构：三栏布局、左侧 6 面板、右侧双模式、组件清单、i18n 键缺口 |
| [docs/TESTING.md](docs/TESTING.md) | 测试体系：41 文件 1239 tests、vitest 配置、覆盖率、测试约定 |
| [docs/ACTIONS.md](docs/ACTIONS.md) | 群作用系统：共轭/正则/陪集/自定义/Sylow 五来源、同态校验、轨道/稳定化子/OST、Burnside 自检、轨道视图、几何作用暂缓记录 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 路线图：近期功能夯实期（剩余待办 E1 gappy） → 中期 FGVE 引擎化 → 远期 GVL 教学实验室（只列未做事项） |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 变更记录：已完成里程碑 + 逐次开发记录（2026-08-15 起由 ROADMAP 迁出） |

## 3. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React + TypeScript | ^19.2.5 / ~6.0.2 | UI 框架（函数式组件 + Hooks） |
| Vite | ^8.0.9 | 构建工具（含 /api → 后端代理） |
| Three.js + React Three Fiber | ^0.184.0 / ^9.6.0 | 3D 渲染 |
| Python FastAPI + Uvicorn | ^3.12 / ^0.115+ | 后端计算引擎（大群结构计算） |
| KaTeX | ^0.16+ | 数学渲染（全应用 TeX 渲染） |
| gifenc | ^1.0.3 | GIF 导出（对称性视图） |
| Vitest | ^4.1.5 | 单元测试 |

> 样式通过全局 CSS 自定义属性实现，**不依赖** Tailwind 或任何 CSS 框架。

## 4. 目录结构

```
GroupViz/
├── src/
│   ├── __tests__/              # 41 个测试文件（1239 tests），见 docs/TESTING.md
│   ├── components/
│   │   ├── Canvas/             # GroupCanvas/SetView/CycleView/TableView/Cayley3DView/
│   │   │                       # SymmetryView/SubgroupLatticeView/FloatingViewWindow/
│   │   │                       # DirectProductView/CosetStripView/HomomorphismView/
│   │   │                       # FirstIsomorphismAnimation/SemidirectProductView/
│   │   │                       # ActionView(轨道视图)/AutomorphismPreviewPopup
│   │   ├── Panels/             # LeftPanel/RightPanel/AccordionSection/BasicGroupPanel/
│   │   │                       # ViewPanel(视图+导出)/OperationsPanel(4 tab)/
│   │   │                       # DirectProductPanel/HomomorphismPanel/
│   │   │                       # GroupActionPanel/SemidirectProductPanel/TabBar/constants.ts
│   │   ├── Tex.tsx             # KaTeX 渲染组件
│   │   └── WelcomePage.tsx     # 欢迎页（群记号预览弹窗、赞助链接）
│   ├── core/
│   │   ├── types.ts            # 核心类型 + 群性质检测函数
│   │   ├── groups/             # SymmetricGroup/CyclicGroup/DihedralGroup/AlternatingGroup/
│   │   │                       # SpecialGroup(V4,Q8)/SmallGroups(注册表)/DirectProduct/
│   │   │                       # SemidirectProduct
│   │   ├── algebra/            # subgroups/homomorphisms/automorphisms/cayleyEdges/
│   │   │                       # actions(群作用)/forceLayout/cayleyEdges/cycleLayouts/ringOrder/
│   │   │                       # shapeLayouts/layout3D
│   │   ├── polyhedra.ts        # 多面体顶点生成（截角四面体/立方体/二十面体等）
│   │   ├── elementRotation.ts  # 群元素→几何旋转变换映射
│   │   └── viewBox.ts
│   ├── context/                # 12 个领域 Provider 分层（见 docs/STATE.md）
│   │   ├── core/ backend/ cayley/ subsets/ symmetry/ directProduct/
│   │   ├── multiview/ homomorphism/ semidirectProduct/ actions/ presentation/ series/
│   │   ├── GroupContext.tsx    # 组合容器（注册 window.__groupVizExport__ 导出桥）
│   │   ├── useGroup.ts
│   │   └── cayleyActions.ts cosetActions.ts directProductActions.ts positionUtils.ts
│   ├── utils/                  # texify(TeX转换)/export/exportApi/api/hybridCompute/groupFactory
│   ├── theme/  i18n/  types/  hooks/
│   ├── App.tsx                 # 欢迎页 + 三栏布局 + 键盘事件 + 会话保存恢复
│   └── main.tsx
├── backend/                    # FastAPI（main/group/algebra/factory/schemas/test_main）
├── docs/                       # 本文档体系（见 §2）
├── scripts/batch-export.mjs    # Playwright 批量导出 CLI（npm run export）
├── refer/                      # 可视化参考书籍（《群论彩图版》等）
└── package.json / vite.config.ts / vitest.config.ts / eslint.config.js
```

## 5. 当前状态

- ✅ 13 种视图模式：set / cayley / cycle / table / 3d / symmetry / sublattice / homomorphism / cosetstrip / action / sylow / tree / prestable（其中 tree / prestable 两个群展示专用视图的入口在左侧「群展示」面板底部，不在视图面板卡片中）
- ✅ 群族：Sₙ(2-5)、Cₙ(2-120)、Dₙ(3-8)、Aₙ(3-5)、V₄、Q₈、**GL(2,2) ≅ S₃ / GL(2,3)（48 阶，矩阵群）**、直积 G×H、**半直积 N⋊_φ H**、**自同构群 Aut(G)**、商群 G/N（UI 上限出于性能：S₅=120 在本地兜底 FALLBACK_CUTOFF=240 内，S₆=720 超限故不提供）
- ✅ 广义 Cayley 图：右乘/左乘切换、任意元素作用边、12 种 2D 形状（含 rewiring、直积 cylinder/torus）、17 种 3D 形状模板（按群性质自动分配）
- ✅ 2D 凯莱图布局策略：**循环群默认 circular**（cayleyCircleLayout 兜底，注册表/基本群数字感知环序，spiral 仅作手动可选）、**注册表 Dₙ 双环**（splitDihedralElements 元素阶分类：m=|G|/2 找阶 m 元素 r → 旋转=⟨r⟩ 幂闭包、反射=其余、配对 sᵢ=rⁱ·s₀，dualRingLayout/cayleyCircleLayout 的 value 分类失败自动回退，覆盖按阶创建 16-30 阶二面体；对 C₂ₘ/Cₘ×C₂/Q₈/C₈:C₂ 也匹配，A₄/C₂³ 返回 null 走原 fallback）、**注册表生成元标准化**（createTableGroup 的 buildGenerators：D_m 结构按乘法表重建标准 (r,s) 生成对——r=阶 m 元素、s=阶 2 反射，⟨r,s⟩ 闭包=全群验证，替代 GAP 任意生成对如两个反射；其他结构保持 rec.gens）、**半直积盘内蛇形环序**（dihedralSnakeOrder：rotations 幂序正排 + reflections 配对角反排摊平单环，C₄×C₂ 盘内 a 边外环相邻 b 边径向；失败回退 powerRingOrder）、**cylinder 各层同相位**（循环因子生成元边成径向直线母线，俯视圆柱感；Cₘ×C₂ 盘内环序 powerRingOrder 特判：外圈 t0 行升序 + 内圈 t1 行降序）
- ✅ 直积 2D 形状分类（`classifyDirectProduct2D`）：全循环因子→grid 网格、恰一个循环因子→**cylinder 圆柱**（循环因子沿径向同心多层环，每层=非循环因子副本，Dₙ 因子保留双环内外层）、全非循环因子→**torus 甜甜圈**（嵌套环：主轴环 + 每点挂剩余因子乘积副本，**任意因子数**）；紧凑符号因子识别（`factorPipeGroupsOrTokens`：C₂²×S₃ = 2 因子分组、S₃² 幂合并自动按 pipe 段拆分为 2 因子），`buildFactorSubgroup` 因子临时群重建 + `factorCopyRingLayout` 副本环（Dₙ 双环 r=1/0.55）；**相邻同底循环因子归组**（`analyzeDPFactorsGrouped2D`/`factorPipeGroupsGrouped`：C₂×C₂×S₃ → [C₂², S₃]，C₂×C₂×C₂ 三连合并 C₂³ 单因子退回网格）；相邻层 stagger 错位防遮挡；形状下拉自动可用（cylinder/torus + grid）；**注册表群（16-31 阶非 pipe 直积）网格兜底**：`tableGroupGridFactors` union-find 聚类（生成元不可交换聚类→因子划分 + 混合进制枚举），C₄×C₄/Z₄×Z₂×Z₂/C₂⁴ 等 4×4 满网格；**注册表非 pipe 直积 cylinder 聚类支持（多因子）**：`clusterFactorGroups`/`tableGroupFactorSplit`/`clusterIsCyclic` 按生成元交换性聚类因子 + 循环性判定（Z₂×D₄/Z₂×Q₈ 显示 2 层同心环；C₂×C₂×S₃ 注册表聚类 3 簇 → 3 环嵌套甜甜圈）；**半直积不误判直积**：`hasTopLevelTimes` 顶层 \\times 检测——'(Z₄×Z₂):Z₂' 不误判直积（走半直积重布线）；**环网格 ringGrid**（C₄×C₂×C₂ 类直积，仅 ≥3 个循环因子）：`isRingGridGroup`/`findRingGridDecomposition` 纯群论探测（阶≤2 元素生成 V₄ 网格 + 环生成元 x 幂覆盖全群唯一分解 + 交换性检查拒绝 C₂×D₄ 伪分解）+ `ringGridLayout2D` n 边形环 × 2×2 网格每格挂完整环（C₁₀×C₂ 等 2 因子直积排除，回 grid）；**cylinder 更名「交错同心圆」**：相邻层半格交错（offset = layerIdx·π/copyN，Cₙ 生成元边为层间斜线）；**注册表 C₃×S₃ 生成元标准化**（18,3 GAP gens [g3,g4] 缺 2 阶反射 → (c,r,s) 标准三元 [2,3,4]，层内呈现完整 S₃ 凯莱图而非两个 C₃ 三角）
- ✅ 对称性视图：多面体几何 + 元素操作动画 + 旋转轴/交点标记（运行时从几何数据计算）
- ✅ 同态映射系统：创建/验证/性质分析 + 第一同构定理动画
- ✅ 半直积构建：φ 映射 UI、4 步构建动画、rewiring 布局与不动点高亮；**注册表 ':' 记号半直积群默认重布线**（`getSemidirectProductMeta` 经 `findSemidirectDecompositions` 规范分解恢复 N/H/φ + `semidirectFactorMap` 每元素唯一分解 g=n·h + `semidirectFixedPoints` 固定点高亮）；**QD16 命名半直积走重布线**（`isNamedRewiringGroup` 命名特判——符号无 ':' 但结构为半直积：`getSemidirectProductMeta` 经 `namedSemidirectOrderPair` 恢复 C₈⋊C₂（φ(b)(a)=a³，generators.length===1 锁定循环 C₈ 而非 Q₈），默认形状 rewiring、可用 [rewiring,circular,spherical,concentric]）；**QD16 生成元标准化 (a,b)**（buildGenerators 特判：按元素阶定位阶 8 元素 a + 阶 2 元素 b 满足 bab=a³ 且 ⟨a,b⟩=全群，代替 GAP rec.gens=[g1(阶4)=a², g2]，重布线双盘各显 8 元环）；**QD16/(16,13) 3D 走 semidirectCylinder**（`isNamedRewiringGroup` 引入 `getAvailableShapes3D`（可用 [spherical,semidirectCylinder,lattice,torus,circular]）与 `getDefaultLayout3D`（默认 semidirectCylinder）：layout3D.ts 的 semidirectCylinder 内部已用 getSemidirectProductMeta+semidirectFactorMap 支持命名特判，圆柱分层真实呈现，浏览器实测默认 semidirectCylinder）；**Q₁₆ 生成元标准化 (a,b) 对齐 Group Explorer**（buildGenerators 特判 rec.structure==='Q16'：a=阶 8 元素、b=阶 4 元素满足 b²=a⁴ 且 aba=b 且 ⟨a,b⟩=全群，代替 GAP gens [2,3] 两个阶 4 元素，凯莱图 8 元环 + b 边 16 条）；**Q₁₆ 凯莱图专用布局对齐 GE 圆柱**（`quaternionCosetMap`（ringOrder.ts，g=a^j·b^i 唯一分解校验：order=16 + a 阶 8 / b 阶 4 / a⁴=b² / bab⁻¹=a⁻¹，失败 null 回退）→ 2D `quaternionRingLayout2D`（forceLayout.ts cayleyCircleLayout 分支：4 个 ⟨b⟩-陪集同心环（j=0 最内含 e，r_j=R(0.34+0.66j/3)），b 边=环内 90° 弧、a 边=12 条纯径向辐条 + 4 条中心直径 wrap——数值扫描最优 4 交叉（集中圆心），教科书式画法）+ 3D `quaternionCylinder3D`（layout3D.ts semidirectCylinder fallback：4 层 y 环 × 4 节点对齐，GE 圆柱原貌）；`getDefaultLayout3D(Q16)='semidirectCylinder'`、可用 3D 形状 [spherical,semidirectCylinder]；**修复预置位置覆盖**（positionUtils.ts initializeNodePositions：cayley+circular 且 computeShape2DPositions=null 时改用 cayleyCircleLayout 生成预置位置，与 GroupCanvas 兜底一致——此前 Q16 专用 4 环永远被 ringOrder 单环预置覆盖））；**SmallGroup(16,13)=(C₄×C₂):C₂ 命名半直积走重布线**（isNamedRewiringGroup 命名特判扩展：符号冲突回退的 'SmallGroup(16,13)' 无 ':' 且 startsWith('S') 误判 projection3D——getDefaultShape2D/getAvailableShapesForView 的 isSA 前缀判定排除 'SmallGroup('；getSemidirectProductMeta byNamed 改用 normal.isAbelian 锁定交换 N=C₄×C₂（同阶排除 Q₈）恢复 N/H/φ，φ(c)(b)=b·a²）、**生成元标准化 (a,b,c) 对齐 Group Explorer**（buildGenerators 按 rec.n===16&&rec.i===13 特判：a=阶4、b=阶2∉⟨a⟩ 与 a 交换（C₄×C₂=⟨a,b⟩ 8 元素 nSet）、c=阶2∉nSet 与 a 交换且 cbc=ba² 且 ⟨a,b,c⟩=全群，GAP gens [2,3,4] 阶 2,2,4 → 标准 (a,b,c)，重布线双盘各显 C₄ 环）；**幂序摆放**（`powerRingOrder` BFS 生成元幂序：循环群正多边形 / V₄ 方形环序 / bit 向量特判，生成元边旋转对称）+ **rN/rH 自适应**（rN = max(minRN·1.6, R·0.14)、rH = max(minRH·1.6, (rN+28+copyGap/2)/sin(π/m))、copyGap = max(90, rN·1.35)、minRN/minRH = 阶·56/2π、R = minDim·0.32）防节点重叠 + 副本盘缘间隙充足
- ✅ 半直积分解（M4）：任意群一键枚举全部半直积分解 G ≅ N⋊_φ H（N ⊴ G 正规子群 + 互补 H，φ(h) = 共轭 h·n·h⁻¹，order≤60 守卫）；createSemidirectProduct 重建闭环验证（isoSymbol 相等 + 不变量回退），面板分解列表（✓/✗ 徽标、点击切换载入）、分裂短正合列 1 → N → G → H → 1 展示；S₄ 双型（A₄⋊C₂ / V₄⋊S₃）、Q₈ 无分解
- ✅ 混合计算：小群本地 TS（≤60），大群 FastAPI 后端（>60）+ 缓存；**后端不可用时前端本地兜底**（FALLBACK_CUTOFF=240 内全量重算，S₅ 约 2.6s），大群计算 >3s 显示顶部进度条（TopProgressBar）
- ✅ GAP 大群计算引擎（v1.13.0）：后端集成 GAP 4.16（`backend/gap_service.py`，direct/cygwin 双模式探测 gap.exe，`GV_ser` 序列化 + 15s 超时 + 进程串行锁）；**subgroups/normal-subgroups/conjugacy-classes/center/lattice/properties 六端点 >120 阶自动切 GAP**（S₆：1455 子群 / 6469 格边 / 11 共轭类，首算 ≈13s，进程内 `_gap_cache` 后毫秒级）；非置换群/不支持表达式自动降级纯 Python；**子群列（Series）后端通路**：`/api/compute/series`（derived/upperCentral/lowerCentral/composition，terms+factors 含 is_simple），前端 `fetchBackendSeries`（src/utils/hybridCompute.ts）在大群（>SERIES_MAX_ORDER=240，如 S₆）时自动切后端，GroupSeriesContext gapSeries 状态 + SubgroupLatticeView 底部链式面板显示（加 `series.loading` i18n）；**任意 GAP 表达式导入**：`/api/compute/import-group`（SymmetricGroup(3)→S3、SmallGroup(16,8)→QD16，≤4096 阶，非法表达式 422，返回乘法表/生成元/元素记号）；health 端点暴露 gap 可用性（available/mode/executable）；后端测试：test_health_reports_gap/test_series_api/test_import_group_api 等 7 个新增（needs_gap 跳过标记）
- ✅ **记号导入群**（`src/core/algebra/notationParser.ts`）：左侧「⇥ 记号导入群」面板——输入群记号（S_5/A_4/C_12/D_6/Q_8/V_4/GL(2,3)/SL(2,3)/PGL(2,7)/PSL(2,7)/C_3×D_4/C_4^2/SmallGroup(16,13)/Aut(S_4) 等）实时 TeX 预览 + 阶 + 路径徽标（本地直接创建/后端 GAP 导入；半直积记号 `:` 提示改用 SmallGroup(n,i)）；`parseNotation`：normalize 链（trim→去空白→normalizeSuperscripts→⋊→':'→\times→'×'→Z_→C_→裸下标 `_{n}`）+ 递归解析（SmallGroup(n,i)/Aut(X)/顶层幂 `(A×B)^k`/顶层 × 因子展开/GL·SL·PGL·PSL(n,q) 阶公式/原子 C·D·S·A·Q_n/V_4）→ gapExpr（CyclicGroup(n)/DihedralGroup(2n)/QuaternionGroup(n)/SymmetricGroup(n)/DirectProduct(...)/GeneralLinearGroup 等）或 localSymbol（createGroupFromSymbol 本地命中离线可建）；导入管线：`/api/compute/import-group` → `createGroupFromImport`（src/core/groups/importGroup.ts，乘法表→Group：词标签 assignWordLabels + D_m 正规形 applyDihedralNormalForm 复用，元素标签=GAP idents，symbol=StructureDescription）；**后端导入群注册**（main.py `_imported_groups` + `_build_group_from_import`，get_group 回退查注册表，导入后 subgroups/lattice/classes/center/properties/series 全链路可用）；**symbol_to_expr 补 GL/SL/PGL/PSL(n,q) 族映射**（PSL(2,7) 导入 → structure PSL(3,2) → GAP 全量计算 179 子群 source=gap 实测通）；psl 等非置换表示群经 IsomorphismPermGroup 注入转置换表示（gap_service 两脚本开头）；后端测试 +1（test_imported_group_subgroups_use_gap，needs_gap）；前端测试 +22（notationParser/importGroup）；**导入群数据处理修复（2026-08-17）**：统一元素身份=表行序 g{k}（后端 `_build_group_from_import` id=g{k} + python 镜像 assignWordLabels 单词标签 `_import_word_labels`/`_word_label`，未达 g_{k} 兜底，Generator dataclass；前端 createGroupFromImport 本就 g{k}）→ 幻影元素（矩阵构造串/`<identity> of ...`/无法选中）根除；**GAP 计算对导入群重跑原始 gap_expr**（`_imported_exprs` 注册表 + `_gap_expr_for`，结构名重建枚举序会漂移）；**gap_service `_GV_COMPUTE_ALL`/`_GV_COMPUTE_SERIES` 重写**：keys=ListPerm(Image(IsomorphismPermGroup(G),x)) 按 Elements(原始群) 枚举序对齐导入表行序（载荷 8→9 项含 id_pos，series 4 项），compute_all_expr/compute_series_expr 新入口；**main.py `_gap_elements` 位置映射**（先 id 精确匹配、失配→`_gap_positional_map` 三条件校验：len(keys)==order、id_pos==1、抽样子群封闭性→返回后端元素，失败落纯 python，不再生成幻影），subgroups/normal/classes/center/lattice/series 六端点接线；**前端生成元瘦身** `findTwoGeneratorPair`（src/core/groups/importGroup.ts，gens>2 时按元素阶贪心找 (最大阶 a, b) 两生成对、闭包=全群——Q64 的 6 个 GAP 生成元收敛为 (a 阶32, b) 标准对，词标签自然标准；C₂ᵏ 无 2 生成对保留原 gens）；**结构探测**：`detectStructureFromSymbol`（semidirectDecompositions.ts）order>60 按符号解析（':'/⋊→semidirect、'×'/' x '→direct、否则 indecomposable，S₅ 正确判不可分解）；后端测试 +3（36 passed）、前端 41 文件 1239 tests 全绿；curl 实测 SL(2,3) 24 元素全单词标签 0 矩阵串、Q64 37 子群 0 幻影、PSL(3,2) 179 子群/6 共轭类全 g{k}；**注（2026-08-17 定案）**：Cygwin 版 GAP 在 detached/后台进程曾必挂 120s（exit 124 → 422）——根因 = `-b -q -c 'Read(...)'` 执行完回到 REPL 死等 stdin EOF（stdin=PIPE 永不开），无控制台句柄上下文更顽固；已修复：`_run_gap_raw` 加 `stdin=subprocess.DEVNULL` + `CREATE_NEW_CONSOLE|CREATE_NO_WINDOW`，detached 下实测 3.3s 成功；另新增 `npm run backend`（scripts/start-backend.mjs node 托管 uvicorn）
- ✅ 小群预计算注册表（阶 1-31 全部 93 个群，GAP 4.16 SmallGroups 库导入：smallGroupData.ts 乘法表数据 + structureToSymbol 符号化 + createTableGroup 构建；阶 16-31 65 条 + Dic₃(12,4)，符号冲突回退 SmallGroup(n,i)；「按阶创建」面板除阶 1-31 外含 A₅(60)/S₅(120)，符号中 ":" 表示半直积有提示；**循环群符号统一 C**（structureToSymbol 不再做 C→Z 替换，legacy 硬编码符号全改 C_{...}，getSmallGroupBySymbol 做 Z_→C_ 归一化兼容旧查询，isGroupCyclic 精确化：纯循环符号直判 / 复合符号按存在 n 阶元素判定）
- ✅ 表群元素词标签（GAP 导入群不再裸 g_n）：createTableGroup 建群后 `assignWordLabels` BFS 沿标准化生成元求最短词标签（恒等元 `e`、词 `a`/`a b`/`a^{2} b`），D_m 结构再套 `applyDihedralNormalForm` 正规形（旋转 `a^{i}` 幂链 + 反射 `a^{j} b`），与展示群标签约定一致；生成元元素标签 = 生成元名，凯莱图作用勾选/同态/陪集/循环布局的 label 匹配（`find(e => e.label === gen.name)`、`label === 'e'` 恒等元检测）全部对齐；元素 id g₀..gₙ₋₁ 不变
- ✅ GAP 表群布局兜底（聚类失败不再静默回退坏图）：`tableFactorSearch` 按群符号从 findAllSubgroups 搜索因子（`tablePartOrder`/`tableGroupedParts` 分组 + 阶/循环性匹配 + 有序乘积覆盖验证），cylinder/torus/网格全部接上——C₃×S₃/C₂×A₄/C₅×S₃（GAP 生成元横跨因子）→ 同心多层环，C₄×C₂×C₂/C₆×C₂×C₂（全交换无非循环簇）→ cylinder；圆形兜底升级：gN 表群 id → `powerRingOrder` 生成元幂序（C₁₆ 恢复正多边形，生成元边不乱穿）
- ✅ 凯莱图形状分配修正（11 项审计）：**projection3D 收窄为精确群族**（`isProjection3DGroup`：仅 S₃/S₄/S₅/A₄/A₅，删除 startsWith('S'/'A') 泛化误配）、**archimedean/concentric 从所有可用形状列表移除**（不再对非循环群/半直积群提供，布局函数与 i18n 键保留）、**ringGrid 推广到任意素数网格**（`findRingGridDecomposition` p∈{2,3}：C₃³=(27,5)/幂式 'C_{3}^{3}' 3×3 三角环网格；C₂⁴ 无 4 阶环生成元数学上不命中保持 4×4 grid）、**SmallGroup(n,i) 符号冲突类群走重布线**（`isNamedRewiringGroup` 类级放宽 order≤60 && startsWith('SmallGroup(')，SmallGroup(20,3)≅C₅⋊C₄ 恢复 N/H/φ + `getSemidirectProductMeta` 门禁放行结构恢复）、**半直积 3D 可用形状收窄**为 [spherical,semidirectCylinder,circular]（删除依赖直积因子结构、失败静默球化的 lattice/torus）、**重布线 φ(h) 扭转**（N 环元素按 φ(h)(n) 索引摆放，QD16(k=3)/C₈:C₂(k=5)/D16(k=7) 辐条连接模式互异）、**C₂⁴ 3D 超立方体**（`isC2Tesseract` 探测 + `hypercube` 布局：外立方体×内立方体(r=0.55)同心投影 16 顶点，默认 3D 布局 hypercube）、**3D 轨道控制换成自定义球坐标**（删除 drei OrbitControls——其每帧 makeSafe 把 phi 钳回 [EPS, π-EPS]，是旧版『上下有角度限制』的根因；orbit ref 存 theta/phi/radius/target，phi 无界可无限翻越上下两极点：手动拖拽（左键 theta-=dx·0.006/phi-=dy·0.006、右键平移 target、滚轮缩放 radius 钳 [minRadius, maxRadius]——方向修正 dY>0 拉近）与 ▶ 自动旋转（沿用最后一次拖拽方向与速率约定）共用同一套状态；每帧 position = target + r·sinφ·(sinθ, cotφ 隐式, cosθ)，**up=sign(sinφ)** 在两极点翻转保持画面正立；**3D 相机外接球适配**（节点云质心 center + 最大距离+1.4 外接球半径 R，`fitOrbit` 视角 = 球的直径占视口高 2/3（d=1.5R/tan(fov/2)），minRadius=max(1.5, R+0.8)（不可进入外接球）、maxRadius=max(30, 适配距×3)；初始视角/双击复位 = 外接球适配视角，**切群/切 3D 形状自动回正**（groupKey = symbol|order）；`latestFit` ref 防对象身份波动、camera far=400；节点标签/工具条全部主题 token（--node-text/--bg-tooltip 等））
- ✅ 多视图浮动窗口、子集保存与分析、陪集分解（Lagrange 验证，子群条带上方展示 ⟨H⟩ 圆形凯莱图）、自逆元素检测、**乘法表大群三策略**（|G|>16 顶部策略栏，默认**子群展示**：随机挑 ≤16 阶子群优先 6-12 阶——合成/循环/`findAllSubgroups`（≤60 阶）多源候选去重，无合适回落随机挑 6-12 元素的**随机展示**；**全量展示**：|G|>30 弹确认框 → 全屏模态（fixed 全视口覆盖两侧栏/工具栏）完整 n×n 表，右上角工具栏 −/+/⟳ + **缩放滑块 25%-600%**（带视口锚定）+ 导出 SVG + 退出（ESC 重置为子群展示）；全屏内**滚轮=纯上下滚动**、拖动平移；主视图画布级平移/缩放 `translate(T) scale(S) translate(offset)` 变换链，滚轮=缩放双击空白复位；行表头标签修复）
- ✅ KaTeX 全应用渲染、i18n 中英文、深/浅主题、会话保存与恢复
- ✅ 视图导出：SVG/PNG/GIF + 批量导出 CLI（`npm run export`）；**3D 凯莱图 GIF 导出**（`exportCayley3DGif`，时长可选「约 3 秒」或「5 个旋转周期」——**离屏渲染**：`beginRotation` 记录基准 theta/phi/radius/target 并创建独立离屏 WebGLRenderer + 相机，`frameAt(i, frameDelayMs)` 按帧序号精确求角 = 基准 + radPerSec×帧延时×帧序号（与实时渲染耗时无关，大群渲染变慢 GIF 不加速），渲染到离屏 canvas；**速度对齐展示区**：`displayAngVel()` 返回 ▶ 自动旋转当前角速度，帧数 = cycles×2π ÷ 展示速度重新推导（>=2），保证导出动图转速与展示区一致且总转角恒为整圈（无缝循环）；导出期间展示区照常旋转，结束后仅释放离屏渲染器（无需恢复相机）；gifenc 逐帧 quantize，i18n 「约 3 秒」/「~3 seconds」）
- ✅ 群作用系统：共轭/自定义/正则（左平移）/陪集（G↷G/H）/Sylow 五来源、同态校验（violation 定位）、轨道/稳定化子/轨道-稳定化子定理验证、轨道视图（簇布局 + 生成元作用边 + hover 全箭头 + 固定点 ★）、**正则作用 = Cayley 定理可视化（G ≅ Sym(G) 嵌入，轨道唯一且自由 Stab(x)={e}）**、**陪集作用 G ↷ G/H 传递（面板内 findAllSubgroups 下拉选 H，节点标注 xH，右侧 Stab(xH)=xHx⁻¹ ≅ H 标注）**、**Sylow 作用面板入口（p 素数下拉 + Sylow p-作用按钮）**、**Burnside 引理自检（|X/G| = (1/|G|)·Σ|Fix(g)| 右侧通用行）**、**共轭作用固定点 = 中心 Z(G) 自检标注**、自定义作用交互式箭头编辑（点击/拖放绑定 + 退出编辑）、自定义作用草稿自动保存（localStorage，刷新/切群按群符号自动恢复，清除时删除）、**已完成作用持久保存（groupviz-actions，面板列表可见/切群保留/点击激活恢复，同同态模式）**（见 docs/ACTIONS.md）
- ✅ Sylow 型视图：以群元素为最小节点（节点 = 元素），p 可选素数（|G| 素因子）；展示 p-元素、全部 p-子群（p-元素 → 循环 p-子群 → pair-join 闭合，专用算法本地算到 S₅=120，SYLOW_MAX_ORDER=240 守卫）、Sylow p-子群（★ 标记，n_p 计数 + `n_p ≡ 1 (mod p)` / `n_p | m` 验证 + 正规化子阶 `|N_G(P)| = |G|/n_p`）；默认凯莱图布局（边 = 群生成元作用，点击子群切换为该子群生成元作用，颜色对应）；单选子群 → 陪集条带布局（Lagrange `|G| = |H|·[G:H]`）；Ctrl/⌘ 或 ⊕ 复选两个子群 → 上下布局 + 竖直共轭箭头（Sylow 第二定理，自动求共轭元 g 满足 gPg⁻¹ = Q）+ 两子群内部生成元边（P 青 / Q 紫）；其他 p-子群默认收起；右侧子群列表可收起；G 共轭作用在 Syl_p(G) 上（轨道大小 = n_p，稳定子 = 正规化子）经轨道视图验证
- ✅ 群中心 Z(G) 集成：子群格高亮中心节点（金色 + 右上角 Z(G) 角标）、右侧子群列表中心突出（金色边框 + 中心徽章）、群信息面板「中心 Z(G)」行（元素 TeX 展示）
- ✅ 群结构识别：群信息面板新增「结构」行（detectStructureType：直积/半直积/不可分解/未知——fast path 读 _semidirectProduct/isGroupDirectProduct，order≤60 本地搜索 N×M 分解与半直积分解，>60 显示未知）
- ✅ 由子集生成子群：任意子集 E ⊂ G 一键生成 ⟨E⟩（closeUnderMultiply 闭包），跳转陪集条带展示 Lagrange `|G| = |H|·[G:H]`
- ✅ 正规化子/中心化子：任意子集 E ⊂ G 一键求 `N_G(E) = {g | gEg⁻¹ = E}` 与 `C_G(E) = {g | gx = xg, ∀x ∈ E}`（getNormalizer/getCentralizer 纯函数），两者均为子群，跳转陪集条带展示 Lagrange
- ✅ 凯莱图圆形布局无交叉：cayleyCircleLayout 对 S₃（六边形）/二面体结构（双环）自动免交叉布局（同态/同构动画/Aut 弹窗/主视图共用）
- ✅ 子群列（Series）：子群格视图集成四种子群列——**导列**（derived series）、**上/下中心列**（upper/lower central series）、**合成列**（composition series，Jordan–Hölder）；系列项节点彩色描边（金/青/紫）+ 序数角标，非系列节点调暗（opacity 0.22），系列路径边加粗；底部系列面板 TeX 链式展示 `G ⊵ N₁ ⊵ … ⊵ ⟨e⟩` + 各级阶 + 因子 `Nᵢ/Nᵢ₊₁ ≅ …` + 可解/幂零徽标；合成列额外显示合成因子多重集 + Jordan–Hölder 说明；小群枚举全部合成列（≤20 条守卫，面板链选择器切换）；核心算法 `src/core/algebra/series.ts`（SERIES_MAX_ORDER=240 守卫，大群二期后端）；状态在 `context/series/GroupSeriesContext`（随群切换自动重置）
- ✅ 群展示（Presentation）系统：任意展示 ⟨a,b | f(a,b), …⟩ 输入创建有限群（Todd–Coxeter 陪集枚举，TC_MAX_COSETS=3000 守卫判有限/无限/溢出），乘法表构建 + `presentationOf` 自动识别标准展示（Cₙ/Dₙ/Sₙ Coxeter/Aₙ/V₄/Q₈，直积/半直积/商群/Aut 走通用关系发现器，PRESENTATION_MAX_ORDER=240）；**发现器极小化展示**（发现器词枚举先 `simplifyWord` + `isRedundantRelator` 前缀过滤，再 `canonicalCyclicForm` 循环旋转/逆折叠（关系 w=e 蕴含任意循环旋转与逆也是关系，QD16 的 868 条共轭冗余词折叠为少数规范词）+ 贪心移除（保护 K 条最短关系即生成元阶关系如 a⁴/b²，其余长词逐个 TC 验证移除，1.5s 预算守卫）；**`presentationOf` 对 QD16 特判返回标准展示 ⟨a⁸, b², bab=a³⟩**（按元素阶定位阶 8 生成元 a——GAP 生成元 g1 阶 4 只能导出非标准 ⟨a⁴, b², (ba)⁴⟩）+ **发现器结果缓存**（symbol|order|生成元数键，群信息栏/树视图反复调用不再重算约 1.6s）；关系支持 **Unicode 上标（a²、a⁻¹，`normalizeSuperscripts`）与 f1=f2 等式（`ab=ba` → `aba⁻¹b⁻¹`，e=f 取另一侧）**；群信息栏展示 TeX 行；左侧「群展示」面板（**两种创建方式**：直接创建 = 完整展示文本 + 持久保存/草稿自动保存 localStorage；**可视化创建** = 1/2/3 生成元模板 ⟨a|⟩/⟨a,b|⟩/⟨a,b,c|⟩ + 逐步输入单条关系（严格 f=e 或 f1=f2 校验，`parseRelationEquation`）+ 已添加关系列表实时构建校验（|G|、≅、无限判定）+ 「结束并创建群」；创建成功设置 **`activePresentationGroup` 独立状态**（不替换左侧当前群，`?? currentGroup` 回退）+ 自动切树视图；「✕ 清空当前群（回到模板树）」）；**tree视图**（退化树 = 商群凯莱图的 BFS 生成树：实线=首次到达边（按生成元着色）；粘合边不绘制，仅顶部 bar 金色「粘合边 ×N」计数，直观呈现「关系 = 砍树」；布局按群结构规则化——1 生成元直线、2 生成元交换格 → 正方形网格（不衰减，幂关系下指数按 mod 折叠，a²,b³,ab=ba → 2×3 网格）、非交换/自由积 → 谢尔宾斯基十字（层距减半防遮挡）、3 生成元 → **3D**（Three.js 立方体方向）；路径状树 0.7/稠密树 0.5 层距衰减 `stepForDepth(depth, ratio)`；展示生成元 ≠ 群生成元时用 `pres.generatorElements` 求值（`genElsOverride`，修复 S₄ Coxeter 3 生成元）；点击节点显示词、缩放/平移/双击复位；无群时展示自由模板树）、**展示乘法表视图**（行/列=群元素，顶部静态展示式 bar，order>36 自动采样）；核心算法 `src/core/algebra/presentations.ts` + `src/core/algebra/cayleyTree.ts`（见 docs/PRESENTATION.md）
- ✅ 测试体系：41 文件 1239 tests 全绿（`npm run test`），总覆盖率 88.56% stmts / 77.78% branches / 92.08% funcs / 91.49% lines（CI 阈值：stmts/lines/funcs ≥ 85、branches ≥ 70）；**GAP 表群惰性审计**（tableGroups.audit.test.ts，279 tests 扫全部 66 表群：默认形状/全部可用形状/圆形布局/生成元边端点半直积 meta，杜绝布局静默回退回归）（`npm run test:coverage`）

## 6. 运行命令

```bash
npm run dev            # 开发启动
npm run build          # 生产构建（tsc -b && vite build）
npm run preview        # 预览构建
npm run lint           # ESLint 检查
npm run test           # 全部测试（vitest run）
npm run test:watch     # 测试监听
npm run test:coverage  # 覆盖率（v8 → coverage/）
npm run export         # Playwright 批量导出 → exports/batch-<timestamp>/
# 后端（大群计算需要）：
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# 或 npm run backend（node 托管 uvicorn，--no-reload 可选）
```

## 7. 开发规范

- 组件：函数式 + Hooks；命名 PascalCase 组件 / camelCase 函数与 Hook / UPPER_SNAKE_CASE 常量
- 数学符号：统一 KaTeX（`texify()` + `<Tex>` / `renderTex()`），不用 Unicode 上下标显示
- 状态：遵循 10 Provider 分层架构，新状态按领域放入对应子 Provider，经 `useGroup()` 聚合暴露
- 测试：改代码必写/更新测试并跑 `npm run test` + `npm run lint`；纯计算逻辑（core/algebra、core/groups）优先补测试
- 风险分级：鉴权/数据库/资金/核心架构改动需人工审查；常规改动（UI、内部逻辑、测试）自测自审后直接推进
- ESLint + TypeScript 严格检查，提交前保证 `npm run lint` 无错误

## 8. 发布工作流（扫 → 修 → 更 → 推）

开发完成到推送之间的标准闭环流程。四个阶段依次执行，任何阶段失败都回退修正后重跑。

### 阶段 1：扫（Scan）— 找 bug 与体验问题

1. **静态基线**：`npm run lint` + `npm run test` + `npm run build` 必须全绿，作为出发点。
2. **动态扫描**：dev server + Playwright 实测核心路径——11 视图切换、操作面板 4 tab、直积/半直积/同态创建流程、会话恢复、导出（SVG/PNG/GIF）、多视图浮动窗口；全程观察 console error/warning（快照含属性计数，如 `[marker-end]` 计数无向边会误判为 0）。
3. **专项扫描**（本项目反复踩坑的检查项）：
   - **BOM 检查**：Windows 下 write 工具可能写入 UTF-8 BOM，使 vite/postcss（JSON.parse package.json）崩溃。改动文件首字节应为 `7B`（`{`），package.json 必须无 BOM。
   - **硬编码版本**：欢迎页 `welcome.version`（translations.ts zh/en 两处）须与 package.json 版本一致。
   - **i18n 缺失键**：`i18n.test.ts` 自动断言 zh/en 键集合一致；新增 `t()` 调用必须 zh/en 成对补键。
   - **文档一致性**：grep 全仓 `.md` 的测试计数（560）、群族范围（Sₙ 2-5 / Cₙ 2-120 / Dₙ 3-8 / Aₙ 3-5）、版本号，与代码事实对齐。

### 阶段 2：修（Fix）— 修复并验证

- 常规改动（UI、内部逻辑、测试）直接修，不中断询问；触及红线（鉴权/数据库/资金/核心架构）输出《人工审查请求单》。
- 每个 bug 修复后立即验证：相关单测 → `npm run lint` → 浏览器回归该路径。
- **Windows 编码铁律**：PowerShell 5.1 的 `Get-Content`/`Set-Content` 默认 ANSI，会破坏 UTF-8 中文文件——必须用 .NET（`[System.IO.File]::ReadAllText/WriteAllText` + `New-Object System.Text.UTF8Encoding($false)`）；普通文件编辑优先用 edit 工具（写入 UTF-8 无 BOM）。

### 阶段 3：更（Update docs）— 同步文档事实

- **AGENTS.md**：版本号、测试计数、群族范围、§5 当前状态新增项、底部 `*文档版本 / 最后更新*`。
- **README.md / README_zh-CN.md / docs/\*.md**：同步同一事实（测试数、范围、新功能）。数字用 grep 全仓核对，防止只改一处。

### 阶段 4：推（Push）— 提交与发布

- `git status` 检查未跟踪文件；工具产物（`.playwright-mcp/`、`.serena/`、`sweep-*.png`）必须忽略不提交。
- `git add -A` → 提交信息按仓库风格：`vN.N: <主题>` + 分条 bullet 列出修复/新增/验证结果。
- 提交前确认 lint/test/build 全绿；`git push origin main` 触发 Pages 部署（git stderr 被 PowerShell 报为 NativeCommandError 是误报，以远程分支更新为准）。

## 9. 数学参考速查

### 9.1 广义 Cayley 图

设 G 是群，C 是 G 的任意元素子集（不限于生成集）。顶点 = G 的元素；对 c∈C：
- **右乘**：`a·c = b` ⇒ 有向边 a→b；**左乘**：`c·a = b` ⇒ 有向边 a→b
- 若 `a·c = b` 且 `b·c = a`（c 自逆）⇒ 无向边（不画箭头）
- 当 C 是生成集时退化为标准 Cayley 图

### 9.2 颜色编码

16 色调色板 `COLOR_PALETTE`，按群元素作用添加顺序分配：
`#ff6b6b #4ecdc4 #ffd93d #a78bfa #f97316 #06b6d4 #84cc16 #f43f5e #38bdf8 #a855f7 #14b8a6 #eab308 #6366f1 #ec4899 #0ea5e9 #22c55e`

### 9.3 关键定理

| 定理 | 内容 | 可视化重点 |
|------|------|-----------|
| Lagrange | \|H\| 整除 \|G\| | 陪集划分、陪集条带 `|G|=|H|·[G:H]` |
| Cayley | G ≅ S(G) 子群 | 正则作用 |
| 第一同构 | G/ker ≅ im | 核与像、四阶段动画 |
| 轨道-稳定子 | \|G\| = \|O\|·\|S\| | 群作用 |

### 9.4 性能守卫

- 本地/后端阈值：order ≤ 60 本地，> 60 后端
- 子群/共轭类/中心 cutoff：60；Cayley 边限流：`max(120, order*3)`
- findAllAutomorphisms：生成元映射组合 > 30000 直接返回 []（如 Z₂⁴）
- 直积/半直积最大阶：144

---

*文档版本: 1.13.0*
*最后更新: 2026-08-17*
