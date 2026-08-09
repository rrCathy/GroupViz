# 测试体系

## 1. 运行方式

| 命令 | 说明 |
|------|------|
| `npm run test` | 运行全部测试（vitest run） |
| `npm run test:watch` | 监听模式 |
| `npm run test:coverage` | 覆盖率报告（v8，include: `src/core/**`、`src/utils/**`，reporters text + html → `coverage/`） |
| `npx vitest run <file>` | 运行单个测试文件 |

## 2. 配置

- **vitest.config.ts**：`{ test: { globals: true, environment: 'node' } }` — Node 环境，无 jsdom、无 setupFiles
- **coverage**：`provider: 'v8'`、`include: ['src/core/**', 'src/utils/**']`、`reporter: ['text', 'html']`（基线 Stmts 58.74% → 现 88.64%，core 91.74% / utils 86.68%，exportApi.ts 95.41%）
- TypeScript 测试源码（.ts），import 项目内部模块直接使用（ESM；不要用 `require()`）
- lint 忽略 `coverage/` 产物（eslint.config.js `globalIgnores(['dist', 'coverage'])`，`.gitignore` 含 `coverage`）

## 3. 测试文件清单（src/__tests__，35 文件 / 706 tests）

| 文件 | 数量 | 覆盖范围 |
|------|-----|---------|
| groups.test.ts | 154 | 群公理：createCyclicGroup/createS2/createSymmetricGroup/createDihedralGroup/createAlternatingGroup/createKleinFour/createQuaternion（单位元/逆元/闭包/结合律） |
| actions.test.ts | 33 | 群作用：置换工具（compose 方向/逆/恒等）、共轭作用（S₃/C₆/D₄/S₅ 同态+轨道=共轭类+OST 校验）、自定义作用（C₃ 循环合法、missing-target/conflict/duplicate/range 报错、无箭头生成元恒等初始化、非法阶绑定 → violation、自环固定点、多生成元同节点箭头共存） |
| automorphisms.test.ts | 29 | findAllAutomorphisms（已知数量：Z2→2、Z4→2、Z5→4、S2→6、V4→6、Q8→24、D2→6、D4→8；Z₂⁴ 守卫返回 []）、createAutomorphismGroup 群律、Aut 群 Cayley 边连通性、标签/映射 |
| homomorphisms.test.ts | 25 | verifyHomomorphism（含 violation）、naturalProjectionMapping、getHomomorphismProperties、subgroupInclusionMapping、directProductProjectionMapping、extendFromGenerators、formatKernelLabel、isElementIdentity |
| layouts.test.ts | 30 | computeShape2DPositions（10 形状 size=order、circular→null、grid 需直积）、compute2DPositions（17 布局）、compute3DPositions、ringOrder 数字感知排序、computeElementOrder、cayleyCircleLayout（S2-perm 六边形 0 交叉、D2/D4 双环 0 交叉 + 配对断言、V4 未误入双环、直积覆盖） |
| subgroups.test.ts | 37 | findAllSubgroups/getConjugacyClasses/getGroupCenter/computeQuotientGroup/isSimpleGroup/getNormalizer/getCentralizer/closeUnderMultiply（含非交换闭包双向、中心出现在子群格节点）、findAllNormalSubgroups |
| directProduct.test.ts | 15 | 直积群律（C2×C2≅V4、C2×C2≅C6 等）、pipe id、逐分量乘法/逆元、紧凑符号（C2×C2→`C_{2}^{2}`、C4×C2→`C_{4} \times C_{2}`）、生成元提升 |
| cayleyEdges.test.ts | 14 | computeCayleyActionEdges：空 actions→[]、右乘/左乘、自逆→双向、单位元→自环、去重、order>60 限流 max(120, order*2)、阿贝尔群左右相同 |
| utils.test.ts | 19 | texify（Unicode→TeX 全规则、裸命令后 ASCII 字母加空格、幂等）、renderTex、createGroupFromSymbol（嵌套直积/Unicode 直积/上标幂/无效幂回退/越界拒绝/legacy Unicode 符号） |
| smallGroups.test.ts | 22 | 注册表 93 条（阶 1-31 GAP 全量）完整性/分布、每条 GAP 数据都有对应条目、符号唯一、getSmallGroup/getSmallGroupBySymbol/getPrecomputed、Dic₃、16-31 符号抽查（含冲突回退 SmallGroup(n,i)）、全量公理验证（恒等/逆元/结合律直查数据表/生成元闭包）、子群阶整除、isSimple 与素数一致、center/共轭类与 subgroups.ts 一致、createGroupFromSymbol 解析新符号、buildOrderGroupsMap（阶 1-31 + A₅ 60 + S₅ 120、阶 16 全 14 群、V₄ 保留） |
| polyhedra.test.ts | 14 | 多面体顶点数（12/24/24/24/60/60）、半径缩放、computeSkeletonEdges、computeElementRotation（identity 角 0、Cₙ/Dₙ 轴、A₄/S₄/A₅ 轴类型） |
| forceLayout.test.ts | 20 | forceLayout/planarCycleLayout/子群格布局、cosetStripLayout（空群、S₃ A₃ 两条带、topPadding）、节点位置稳定性 |
| elementRotation.test.ts | 6 | 群元素 → 几何旋转映射（Cₙ/Dₙ/A₄/S₄/A₅ 轴与角） |
| layout3D.test.ts | 4 | compute3DPositions：3D 形状模板布局（群形状映射、球面/环面投影） |
| quotientS4.test.ts | 2 | S₄/V₄ 商群创建与 Cayley 边 |
| quotientFlow.test.ts | 1 | 商群流程 |
| quotientRendering.test.ts | 1 | 商群渲染数据 |
| quotientLayout.test.ts | 1 | 商群 projection2D 布局 |
| hybridCompute.test.ts | 27 | 混合计算：order ≤60 本地 / >60 后端缓存、fetchBackendResults 合并转换、computeGroupProperties 本地/后端、后端失败本地兜底（computeLocalFallbackResults：S₅ 子群/共轭类/性质、>240 空兜底）、fetchBackendCayleyEdges/ElementOrder |
| types.test.ts | 22 | 群类型判定函数、analyzeDPFactors、isCyclicFactorKeys、getAvailableShapes2D/形状与布局默认值、getViewBoxSize 全分支 |
| api.test.ts | 14 | 后端 API 客户端：9 端点 URL/method/body、错误路径（detail 优先、否则 statusText） |
| cycleLayouts.test.ts | 15 | computeCycleSubgroups、computeMaximalCycles、forceLayout（自环/initialPositions/cycleSubgroups）、planarCycleLayout |
| ringOrder.test.ts | 17 | S2 排列/Z₂ 位向量/整数/eN 排序、parseProductFactors、matrixGridLayout、nestedFactorLayout2D |
| viewBox.test.ts | 8 | getViewBoxSize（table clamp、sublattice、force 放大）、isTooLarge 各视图阈值 |
| semidirectProduct.test.ts | 6 | createSemidirectProduct：C2⋊C2→D2、平凡φ→直接积、幂等回退、非同态φ抛错、exponent=lcm、生成元提升 |
| properties.test.ts | 13 | 群性质：S₃/A₄/S₄ 导出列可解非幂零、A₅ 完美不可解、D₈ 幂零/D₁₂ 非幂零、Q₈、Cₙ/V₄、S₃×C₂、>60 cutoff 返回 null、导出列均为子群 |
| i18n.test.ts | 3 | i18n 键完整性：zh/en 键集合相等、非空字符串、占位符参数一致 |
| sylow.test.ts | 25 | Sylow 定理：factorizeOrder、findSylowSubgroups（S₃ n₂=2/n₃=1、A₄ n₂=1/n₃=4、S₄ 2/4、D₈/Q₈/V₄/C₁₂ n_p=1、A₅ 5/10/6、S₅ 15/10/6）、子群公理、两两互共轭、sylowConjugationPerms 同态性/传递性、稳定子 = 正规化子（|G|/n_p）、findAllPSubgroups（S₃/A₄/Q₈/V₄/C₁₂ 全部 p-子群集合与阶序，Sylow 在前）、findMinimalGenerators |
| actionDraftStorage.test.ts | 6 | 自定义群作用草稿持久化：round-trip（含 unbound 箭头）、无存储/损坏 JSON/结构非法返回 null、remove、覆盖保存 |
| actionStorage.test.ts | 6 | 已完成群作用持久保存（groupviz-actions）：空返回 []、round-trip（含 unbound 箭头）、多群多条、损坏 JSON 返回 []、非法记录过滤（setSize 字符串）、覆盖保存 |
| series.test.ts | 24 | 子群列（series.ts）：导列（S₃/S₄/A₄/S₅ 阶链与 reachesTrivial/可解性）、下中心列（D₈→{e} 幂零、D₁₂ 非幂零）、上中心列（D₁₂ Z∞=⟨r³⟩ 阶 4 非幂零、S₃ 平凡中心）、合成列（S₄/S₅/V₄/Q₈/D₈ 15 条/C₆/C₁₂ 2 条链、A₅ 单因子）、因子判定（Cₙ/V₄/Q₈/D₄/D₆/A₄/A₅ 标签、简单性）、isNormalSubgroupIn、SERIES_MAX_ORDER 守卫、computeChainFactors（备选链 S₅ 唯一链/D₈ V₄ 分支/A₄ 标签） |
| presentations.test.ts | 36 | 群展示：解析器（简化/指数/括号/零指数/非法字符/长符号 + Unicode 上标 a²/a⁻¹）、parsePresentation、parseRelationEquation（f1=f2 等式）、Todd–Coxeter（finite/infinite/overflow）、buildGroupFromPresentation（C₄/D₄/V₄/S₃/A₅ 构建 + multiply/inverse 一致性 + 无限/溢出 + f1=f2 归一化 → C₂×C₃/V₄）、presentationOf 全群族回代（C₆/D₄/S₃/S₄/S₅/A₃/A₄/A₅/V₄/Q₈/Aut(Z₃)/直积/商群/S₃×S₃ 因子组合/stored 原样） |
| cayleyTree.test.ts | 25 | 树视图核心（cayleyTree.ts）：computeCayleyTree BFS 生成树（生成树边/粘合边划分，粘合边不渲染仅计数）、computeFreeTree 自由模板树、computeFoldTree（幂折叠网格：a²,b³,ab=ba → C₂×C₃ 2×3 网格 0 交叉；genElsOverride 修复 S₄ Coxeter 3 生成元不崩溃；D∞ 0.7 路径状衰减、C₂*ℤ 0.5 稠密衰减 + 0 交叉、Sierpinski 0 交叉回归）、countEdgeCrossings 严格交叉计数、parseRelationEquation |
| export.test.ts | 15 | 视图导出（export.ts）：encodeGif（GIF89a 魔数/多帧）、triggerDownload、exportView（SVG/3D canvas/无 viewport/svg/canvas 分支）、captureSvgFrame（像素解析/加载失败 reject）、exportSymmetryAsGifBlob（无 viewport null/多帧捕获 + 重启回调）、exportSymmetryAsGif（各 alert 分支） |
| exportApi.test.ts | 16 | 导出桥（exportApi.ts）：registerExportBridge 与 waitReady 时序、getSymmetryInfo（C/D/A₄/S₄/A₅/V₄ 映射）、getAvailableShapes2D/3D、getAvailableViewsForExport（大群去 table/直积去 symmetry）、hideOverlays/showOverlays、exportSVGContent（CSS 变量注入）、exportCanvasDataUrl、recordGIF（base64 解析） |

## 4. 测试要点与约定

- 群公理辅助函数 `assertGroupAxioms` 模式：对采样元素验证单位元/逆元/闭包/结合律
- 元素 id 格式因群而异：循环群 `e0..e(n-1)`、置换群 `'1,2,2'` 样式、直积/半直积 `aId|bId` pipe 拼接、商群 `qcoset-N`、Aut(G) `auto-N`、展示群 `p{coset}`
- 性能敏感计算（findAllAutomorphisms、大群子群）有守卫阈值，测试应验证守卫行为而非枚举
- mock 外部模块（utils/api）时 `vi.mock` factory 内不要引用顶层变量；用 `vi.mocked(imported)` 拿到 mock 实例
- fetch 类测试用 `vi.stubGlobal('fetch', ...)`（beforeEach 中 `vi.unstubAllGlobals()` 还原）
- i18n 键已在 translations.ts 中补齐，断言提示文案时直接使用 t() 键或中文/英文文案

## 5. 其他脚本

- `npm run export`：Playwright 批量导出（scripts/batch-export.mjs），9 预设群 × 7 视图 → `exports/batch-<timestamp>/`，依赖 `window.__groupVizExport__` 桥（src/utils/exportApi.ts）
- `npm run postinstall`：`npx playwright install chromium`
- 开发流程：改代码 → 写/更新测试 → `npm run test` 全绿 → `npm run lint` 无错误
