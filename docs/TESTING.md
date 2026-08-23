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
- **coverage**：`provider: 'v8'`、`include: ['src/core/**', 'src/utils/**']`、`reporter: ['text', 'html']`、`thresholds: { statements: 85, branches: 70, functions: 85, lines: 85 }`（基线 Stmts 58.74% → 现 88.91%，lines 91.90%，branches 78.22%、funcs 92.32%）
- TypeScript 测试源码（.ts），import 项目内部模块直接使用（ESM；不要用 `require()`）
- lint 忽略 `coverage/` 产物（eslint.config.js `globalIgnores(['dist', 'coverage'])`，`.gitignore` 含 `coverage`）

## 3. 测试文件清单（src/__tests__，47 文件 / 1398 tests）

| 文件 | 数量 | 覆盖范围 |
|------|-----|---------|
| groups.test.ts | 154 | 群公理：createCyclicGroup/createS2/createSymmetricGroup/createDihedralGroup/createAlternatingGroup/createKleinFour/createQuaternion（单位元/逆元/闭包/结合律） |
| actions.test.ts | 51 | 群作用：置换工具（compose 方向/逆/恒等）、共轭作用（S₃/C₆/D₄/S₅ 同态+轨道=共轭类+OST 校验）、自定义作用（C₃ 循环合法、missing-target/conflict/duplicate/range 报错、无箭头生成元恒等初始化、非法阶绑定 → violation、自环固定点、多生成元同节点箭头共存）、正则作用（左平移=Cayley 嵌入单射、Stab(x)={e} 自由、C₄ 与群乘一致）、陪集作用（G↷G/H 传递、Stab(xH)=xHx⁻¹、中心子群全陪集 Stab=H、{e} 退化=正则、空子群 range 报错）、Burnside 引理（S₃/D₄ 共轭 (1/|G|)Σ|Fix| = 轨道数、正则单轨道、空 perms）、共轭固定点 = 中心 Z(G)（S₃/D₄/C₆） |
| automorphisms.test.ts | 30 | findAllAutomorphisms（已知数量：Z2→2、Z4→2、Z5→4、S2→6、V4→6、Q8→24、D2→6、D4→8；Z₂⁴ 守卫返回 []；**C₇² 全量 2016 = |GL(2,7)| = 48·42，无截断回归**）、createAutomorphismGroup 群律、Aut 群 Cayley 边连通性、标签/映射 |
| homomorphisms.test.ts | 25 | verifyHomomorphism（含 violation）、naturalProjectionMapping、getHomomorphismProperties、subgroupInclusionMapping、directProductProjectionMapping、extendFromGenerators、formatKernelLabel、isElementIdentity |
| layouts.test.ts | 30 | computeShape2DPositions（13 形状 size=order、circular→null、grid 需直积）、compute2DPositions（17 布局）、compute3DPositions（含 cone 圆锥：恒等元顶点 + 按阶分圈）、ringOrder 数字感知排序、computeElementOrder、cayleyCircleLayout（S2-perm 六边形 0 交叉、D2/D4 双环 0 交叉 + 配对断言、V4 未误入双环、直积覆盖） |
| subgroups.test.ts | 37 | findAllSubgroups/getConjugacyClasses/getGroupCenter/computeQuotientGroup/isSimpleGroup/getNormalizer/getCentralizer/closeUnderMultiply（含非交换闭包双向、中心出现在子群格节点）、findAllNormalSubgroups |
| directProduct.test.ts | 15 | 直积群律（C2×C2≅V4、C2×C2≅C6 等）、pipe id、逐分量乘法/逆元、紧凑符号（C2×C2→`C_{2}^{2}`、C4×C2→`C_{4} \times C_{2}`）、生成元提升 |
| cayleyEdges.test.ts | 14 | computeCayleyActionEdges：空 actions→[]、右乘/左乘、自逆→双向、单位元→自环、去重、order>60 限流 max(120, order*2)、阿贝尔群左右相同 |
| utils.test.ts | 20 | texify（Unicode→TeX 全规则、裸命令后 ASCII 字母加空格、幂等）、renderTex、createGroupFromSymbol（嵌套直积/Unicode 直积/上标幂/无效幂回退/越界拒绝/legacy Unicode 符号） |
| smallGroups.test.ts | 34 | 注册表 93 条（阶 1-31 GAP 全量）完整性/分布、每条 GAP 数据都有对应条目、符号唯一、getSmallGroup/getSmallGroupBySymbol/getPrecomputed、Dic₃、16-31 符号抽查（含冲突回退 SmallGroup(n,i)）、全量公理验证（恒等/逆元/结合律直查数据表/生成元闭包）、子群阶整除、isSimple 与素数一致、center/共轭类与 subgroups.ts 一致、createGroupFromSymbol 解析新符号、buildOrderGroupsMap（阶 1-31 + A₅ 60 + S₅ 120、阶 16 全 14 群、V₄ 保留）、表驱动群元素词标签（全群 label 无 g_ 前缀且为生成元词、C₁₆ 幂链、C₄×C₂:C₂ 词标签、D₈ 正规形 rⁱ/rⁱs、id 映射不变）、QD16 生成元标准化 (a,b)（阶 8/2、bab=a³、闭包 16）、(16,13) 生成元标准化 (a,b,c)（a 阶4/b 阶2/c 阶2、ab=ba、ac=ca、cbc=ba²、闭包 16，对齐 Group Explorer）、Q₁₆ (16,9) 生成元标准化 (a,b) 对齐 GE Q_8.group（a 阶8/b 阶4、b²=a⁴、aba=b、闭包 16） |
| generalLinearGroup.test.ts | 16 | GL(2,p)：矩阵乘/逆/det 模 p 手算样例、GL(2,2)（阶 6、生成元阶 2/ab 阶 3、闭包 6 元素、≅ S₃）、GL(2,3)（阶 48、det 同态核=SL(2,3) 阶 24、中心 {±I}、生成元阶 3/2、全量逆、结合律抽样）、p 非素数 throw |
| polyhedra.test.ts | 17 | 多面体顶点数（12/24/24/24/60/60）、半径缩放、computeSkeletonEdges（**回归：截角十二面体 90 棱 + 全部等距（原坐标错误 120 伪棱）、菱形立方八面体 48 棱（4-正则，原硬编码 3n/2 退化为 24 伪棱）、全 solid 顶点度数 [3,3,4,3,3,3]**）、computeElementRotation（identity 角 0、Cₙ/Dₙ 轴、A₄/S₄/A₅ 轴类型） |
| forceLayout.test.ts | 64 | forceLayout/planarCycleLayout/子群格布局、cosetStripLayout（空群、S₃ A₃ 两条带、topPadding）、节点位置稳定性、直积因子工具（factorPipeGroups/parseCompactFactors 紧凑符号分组 C₂²×S₃=2 组、buildFactorSubgroup 因子临时群提取）、cylinderLayout2D（C₄×D₄ 32 点同心多环 distinct 半径 ≥8、C₂×S₃ 12 点、C₂×C₃×S₃ 36 点、注册表 Z₂×D₄/Z₂×Q₈ 2 层同心 16 点 distinct 半径=2、D₈ null、C₃×S₃ 各层半格交错 π/6、注册表 C₃×S₃ 18,2 三层 S₃ 环含反射/旋转边层内）、torusLayout2D（S₃×D₄ 48 点 maxR≤400、C₂²×S₃ 24 点、3 因子嵌套 96 点、注册表 (24,13) 24 点）、classifyDirectProduct2D 归组分类（C₂²×S₃→torus、C₂×C₃×S₃→cylinder、C₂³→grid、3 非循环因子→torus、注册表 (24,13)→torus）、semidirectProductLayout（注册表 (16,2) 16 点全有限、S₃ null、C3⋊C2 6 点）、splitDihedralElements（注册表 D₈/D₉ 双环分类、基本 D₄、C₂³/A₄ null）、dualRingLayout 注册表 D₈/D₉ 双环（外环 0.38·min + 内环 0.55 配对）、ringGridLayout2D（pipe C₄×C₂×C₂ 16 点 4 环 2×2 网格：簇质心环半径一致/弦长 2r·sin(π/n)/格距>2r、注册表 16,9 16 点、C₄×C₄ null）、normalizeLayout2D（单位化）、directProductGridLayout2D（注册表群 C₄×C₄ 4×4 满网格 unique=16、(Z₄×Z₂):Z₂ 半直积 null、S₃×C₂ 6×2 grid） |
| elementRotation.test.ts | 6 | 群元素 → 几何旋转映射（Cₙ/Dₙ/A₄/S₄/A₅ 轴与角） |
| layout3D.test.ts | 3 | compute3DPositions：3D 形状模板布局（群形状映射、环面投影） |
| quotientS4.test.ts | 2 | S₄/V₄ 商群创建与 Cayley 边 |
| quotientFlow.test.ts | 1 | 商群流程 |
| quotientRendering.test.ts | 1 | 商群渲染数据 |
| quotientLayout.test.ts | 1 | 商群 projection2D 布局 |
| hybridCompute.test.ts | 27 | 混合计算：order ≤60 本地 / >60 后端缓存、fetchBackendResults 合并转换、computeGroupProperties 本地/后端、后端失败本地兜底（computeLocalFallbackResults：S₅ 子群/共轭类/性质、>240 空兜底）、fetchBackendCayleyEdges/ElementOrder |
| types.test.ts | 45 | 群类型判定函数、analyzeDPFactors、analyzeDPFactorsGrouped2D（相邻同底循环因子归组：C₂×C₂×S₃→[C₂²,S₃]、C₂×C₂×C₂ 合并 C₂³、S₃×S₃ 不合并、非 DP null）、isCyclicFactorKeys、isGroupSemidirectProduct（顶层 ':' 检测）、isRingGridGroup（C₄×C₂×C₂ pipe+注册表 16,9、C₆×C₂² true；C₁₀×C₂ 仅两因子/C₁₂×C₂/C₂³/C₄×C₄/C₄×C₂/C₂×D₄/S₃ false）、getAvailableShapes2D/形状与布局默认值（循环群默认 circular、classifyDirectProduct2D 直积 2D 分类与注册表群分类：C₂²×S₃→torus、(24,13)→torus、半直积→rewiring、hasTopLevelTimes 顶层 \\times 检测、注册表群直积判定、C₄×C₂×C₂ 默认 ringGrid）、getViewBoxSize 全分支 |
| api.test.ts | 14 | 后端 API 客户端：9 端点 URL/method/body、错误路径（detail 优先、否则 statusText） |
| cycleLayouts.test.ts | 15 | computeCycleSubgroups、computeMaximalCycles、forceLayout（自环/initialPositions/cycleSubgroups）、planarCycleLayout |
| ringOrder.test.ts | 33 | S2 排列/Z₂ 位向量/整数/eN 排序、parseProductFactors、matrixGridLayout、nestedFactorLayout2D、factorPipeGroups/parseCompactFactors、factorPipeGroupsGrouped（相邻同底循环归组：C₂²×S₃→2 组、C₂×C₂×C₃→[C₂²,C₃]、段数不符 null）、powerRingOrder（C₆ 幂序、V₄ bit 向量方形环序、C₄×C₂ pipe 特判（外圈 t0 升序 + 内圈 t1 降序）、直积 4 覆盖、S₃ 置换序、无生成元回退字典序）、tableGroupGridFactors（注册表群 C₄×C₄ 4×4、C₄×C₂×C₂ 4×4、C₂⁴ 4×4、C₂×D₄ 2×8、D₈ null）、clusterFactorGroups/tableGroupFactorSplit/clusterIsCyclic（Z₂×D₄ 聚类 2+8、D₈ null） |
| viewBox.test.ts | 8 | getViewBoxSize（table clamp、sublattice、force 放大）、isTooLarge 各视图阈值 |
| semidirectProduct.test.ts | 15 | createSemidirectProduct：C2⋊C2→D2、平凡φ→直接积、幂等回退、非同态φ抛错、exponent=lcm、生成元提升；getSemidirectProductMeta（pipe 元数据直返、注册表 (16,2) findSemidirectDecompositions 恢复 N/H/φ 且 normal.order·acting.order=16、S₃/C5 null、**QD16 命名半直积恢复 C₈⋊C₂ 且 φ(b)(a)=a³**）、semidirectFactorMap（pipe id 拆分、注册表 n=g·h⁻¹ 代数分解）、semidirectFixedPoints（identity φ 空 map、inversion φ 仅单位元固定） |
| semidirectDecompositions.test.ts | 29 | 半直积分解（semidirectDecompositions.ts）：findAutoByMap（命中/不命中/空）、verifyPhiHomomorphism（C4⋊C2 反转≅D4、C2⋊C2 平凡 φ、错阶 auto 拒绝、缺失回退 identity）、buildPhiFromGroup（round-trip/非半直积 null）、minimalGenerators（V4⊂A4 2 生成元、{e}→[]、全群）、buildSubgroupGroup（S3 换位 order2、C6 偶数子群 order3）、findSemidirectDecompositions（S3 3 候选全 verified、D4 8 候选、A4 4 候选 Frobenius、S4 ≥9 双型、C6 2 候选、Q8 []、D12 19 候选全 verified、S5 守卫 []、C7 []） |
| properties.test.ts | 13 | 群性质：S₃/A₄/S₄ 导出列可解非幂零、A₅ 完美不可解、D₈ 幂零/D₁₂ 非幂零、Q₈、Cₙ/V₄、S₃×C₂、>60 cutoff 返回 null、导出列均为子群 |
| i18n.test.ts | 3 | i18n 键完整性：zh/en 键集合相等、非空字符串、占位符参数一致 |
| sylow.test.ts | 25 | Sylow 定理：factorizeOrder、findSylowSubgroups（S₃ n₂=2/n₃=1、A₄ n₂=1/n₃=4、S₄ 2/4、D₈/Q₈/V₄/C₁₂ n_p=1、A₅ 5/10/6、S₅ 15/10/6）、子群公理、两两互共轭、sylowConjugationPerms 同态性/传递性、稳定子 = 正规化子（|G|/n_p）、findAllPSubgroups（S₃/A₄/Q₈/V₄/C₁₂ 全部 p-子群集合与阶序，Sylow 在前）、findMinimalGenerators |
| actionDraftStorage.test.ts | 6 | 自定义群作用草稿持久化：round-trip（含 unbound 箭头）、无存储/损坏 JSON/结构非法返回 null、remove、覆盖保存 |
| actionStorage.test.ts | 6 | 已完成群作用持久保存（groupviz-actions）：空返回 []、round-trip（含 unbound 箭头）、多群多条、损坏 JSON 返回 []、非法记录过滤（setSize 字符串）、覆盖保存 |
| series.test.ts | 27 | 子群列（series.ts）：导列（S₃/S₄/A₄/S₅ 阶链与 reachesTrivial/可解性）、下中心列（D₈→{e} 幂零、D₁₂ 非幂零）、上中心列（D₁₂ Z∞=⟨r³⟩ 阶 4 非幂零、S₃ 平凡中心）、合成列（S₄/S₅/V₄/Q₈/D₈ 15 条/C₆/C₁₂ 2 条链、A₅ 单因子）、因子判定（Cₙ/V₄/Q₈/D₄/D₆/A₄/A₅ 标签、简单性）、**交换因子精确标签（秩≥3：C₂⁴ 四链 C₂×C₂×C₂×C₂（原错标 C₂×C₈）、C₄×C₂² 三链 C₂×C₂×C₄、循环商保持 Cₙ）**、isNormalSubgroupIn、SERIES_MAX_ORDER 守卫、computeChainFactors（备选链 S₅ 唯一链/D₈ V₄ 分支/A₄ 标签） |
| tableGroups.audit.test.ts | 279 | GAP 表群可视化惰性审计（66 群全扫）：默认形状可布局（circular 走 cayleyCircleLayout）、全部可用非圆形形状布局（位置有限 + 无重复）、环形布局 distinct+finite、生成元 Cayley 边端点合法、顶层 ':' 半直积 getSemidirectProductMeta 非 null——防布局静默回退回归（曾捕获 C₃×S₃/C₂×A₄/C₅×S₃/C₄×C₂×C₂ 等 10 群 cylinder/torus 失效） |
| presentations.test.ts | 37 | 群展示：解析器（简化/指数/括号/零指数/非法字符/长符号 + Unicode 上标 a²/a⁻¹）、parsePresentation、parseRelationEquation（f1=f2 等式）、Todd–Coxeter（finite/infinite/overflow）、buildGroupFromPresentation（C₄/D₄/V₄/S₃/A₅ 构建 + multiply/inverse 一致性 + 无限/溢出 + f1=f2 归一化 → C₂×C₃/V₄）、presentationOf 全群族回代（C₆/D₄/S₃/S₄/S₅/A₃/A₄/A₅/V₄/Q₈/Aut(Z₃)/直积/商群/S₃×S₃ 因子组合/stored 原样）、**≥3 因子直积全对交换子**（C₂×C₃×C₅：a²/b³/c⁵ + [a,b]/[a,c]/[b,c] + TC round-trip 阶 30） |
| cayleyTree.test.ts | 25 | 树视图核心（cayleyTree.ts）：computeCayleyTree BFS 生成树（生成树边/粘合边划分，粘合边不渲染仅计数）、computeFreeTree 自由模板树、computeFoldTree（幂折叠网格：a²,b³,ab=ba → C₂×C₃ 2×3 网格 0 交叉；genElsOverride 修复 S₄ Coxeter 3 生成元不崩溃；D∞ 0.7 路径状衰减、C₂*ℤ 0.5 稠密衰减 + 0 交叉、Sierpinski 0 交叉回归）、countEdgeCrossings 严格交叉计数、parseRelationEquation |
| export.test.ts | 26 | 视图导出（export.ts）：encodeGif（GIF89a 魔数/多帧）、triggerDownload、exportView（SVG/3D canvas/无 viewport/svg/canvas 分支）、captureSvgFrame（像素解析/加载失败 reject）、exportSymmetryAsGifBlob（无 viewport null/多帧捕获 + 重启回调）、exportSymmetryAsGif（各 alert 分支）、cayley3DExportPlan（3s/2 圈 60 帧、5 圈 7.5s 150 帧、自定义参数）、cayley3dControls 注册（register/get/unregister/后注册胜出）、exportCayley3DGif（无 viewport/未注册 alert 分支、正常流程 GIF89a + beginRotation 用 displayAngVel() 实测角速度 + endRotation 恢复、失败路径 reject、**displayAngVel 驱动帧数重推导**（总转角 cycles×2π）、**frameAt 按帧序号×帧延时精确驱动**（逐帧断言 (i, frameDelay) 参数）） |
| exportApi.test.ts | 16 | 导出桥（exportApi.ts）：registerExportBridge 与 waitReady 时序、getSymmetryInfo（C/D/A₄/S₄/A₅/V₄ 映射）、getAvailableShapes2D/3D、getAvailableViewsForExport（大群去 table/直积去 symmetry）、hideOverlays/showOverlays、exportSVGContent（CSS 变量注入）、exportCanvasDataUrl、recordGIF（base64 解析） |
| symmetryView.test.ts | 6 | 对称性分类（SymmetryView.getSymmetryType）：C/D 前缀 → cyclic/dihedral、A₄/S₄/A₅/V₄ → tetrahedron/cube/icosahedron/rectangle、**直积/幂符号优先判定**（C₄×C₂/C₂×S₃/C₂³/C₃² → unsupported，修复原 C/D startsWith 顺序 bug）、C₂²/C₂×C₂ → rectangle、S₃/Q₈/GL(2,3) → unsupported |
| storage.test.ts | 7 | localStorage 容错：semidirectProductStorage（空/round-trip/损坏 JSON/null/{}/42/字符串 → []，H1 白屏修复回归）、homomorphismStorage（round-trip、缺 mapping 字段坏条跳过、mapping:null 坏条跳过，L4 整批容错回归） |
| coreBoundary.test.ts | 105 | P0 阶段 A 边界回归：core 纯净性扫描（import.meta.glob ?raw 读源码 + stripComments 后正则——零 react import/localStorage/document/window/require）、core/index.ts 门面 ~100 关键符号存在性（全部 typeof function）+ 导出总数 >180、COLOR_PALETTE/SUBSET_COLORS/COSET_COLORS 调色板断言 |
| resultGuards.test.ts | 10 | P0 阶段 C 错误模型：Result/ok/err 语义（ok:true 值透传、ok:false error 透传）、guards.ts 11 守卫常量值断言、原定义点 re-export 与 guards 同一性（series/sylow/toddCoxeter/minimizer）、EngineError 类型化 throw（wordParser parseError kind='parse'、工厂 guardError kind='guard' 消息保留 toThrow 兼容） |
| persistenceFuzz.test.ts | 11 | P0 阶段 D 输入加固：persistence.ts（vi.stubGlobal Map 版 localStorage）坏 JSON 返回 null/schema 不符 null/loadStoredArray 逐条容错丢坏保好/版本化信封 round-trip/未来版本无 migrate 拒绝/坏信封拒绝；HOSTILE_STRINGS 25 条 fuzz 四解析器（parseWord/parsePresentation/parseRelationEquation 不抛且 ok 或错误码合法、parseNotation 不抛且 input 回显）；storage loader 吞脏数据不抛 |

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
