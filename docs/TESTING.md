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
- **coverage**：`provider: 'v8'`、`include: ['src/core/**', 'src/utils/**']`、`reporter: ['text', 'html']`（基线 Stmts 58.74% → 现 75.83%，Lines 77.48%）
- TypeScript 测试源码（.ts），import 项目内部模块直接使用（ESM；不要用 `require()`）
- lint 忽略 `coverage/` 产物（eslint.config.js `globalIgnores(['dist', 'coverage'])`，`.gitignore` 含 `coverage`）

## 3. 测试文件清单（src/__tests__，27 文件 / 519 tests）

| 文件 | 数量 | 覆盖范围 |
|------|-----|---------|
| groups.test.ts | 154 | 群公理：createCyclicGroup/createS3/createSymmetricGroup/createDihedralGroup/createAlternatingGroup/createKleinFour/createQuaternion（单位元/逆元/闭包/结合律） |
| actions.test.ts | 25 | 群作用：置换工具（compose 方向/逆/恒等）、共轭作用（S₃/C₆/D₄/S₅ 同态+轨道=共轭类+OST 校验）、自定义作用（C₃ 循环合法、missing-target/conflict/duplicate/range 报错、无箭头生成元恒等初始化、非法阶绑定 → violation） |
| automorphisms.test.ts | 28 | findAllAutomorphisms（已知数量：Z3→2、Z4→2、Z5→4、S3→6、V4→6、Q8→24、D3→6、D4→8；Z₂⁴ 守卫返回 []）、createAutomorphismGroup 群律、Aut 群 Cayley 边连通性、标签/映射 |
| homomorphisms.test.ts | 24 | verifyHomomorphism（含 violation）、naturalProjectionMapping、getHomomorphismProperties、subgroupInclusionMapping、directProductProjectionMapping、extendFromGenerators、formatKernelLabel、isElementIdentity |
| layouts.test.ts | 30 | computeShape2DPositions（10 形状 size=order、circular→null、grid 需直积）、compute3DPositions（17 布局）、ringOrder 数字感知排序、computeElementOrder、cayleyCircleLayout（S3-perm 六边形 0 交叉、D3/D4 双环 0 交叉 + 配对断言、V4 未误入双环、直积覆盖） |
| subgroups.test.ts | 19 | findAllSubgroups/getConjugacyClasses/getGroupCenter/computeQuotientGroup/isSimpleGroup |
| directProduct.test.ts | 15 | 直积群律（C2×C2≅V4、C2×C3≅C6 等）、pipe id、逐分量乘法/逆元、紧凑符号（C3×C3→`C_{3}^{2}`、C4×C2→`C_{4} \times C_{2}`）、生成元提升 |
| cayleyEdges.test.ts | 14 | computeCayleyActionEdges：空 actions→[]、右乘/左乘、自逆→双向、单位元→自环、去重、order>60 限流 max(120, order*3)、阿贝尔群左右相同 |
| utils.test.ts | 14 | texify（Unicode→TeX 全规则、裸命令后 ASCII 字母加空格、幂等）、renderTex、createGroupFromSymbol |
| smallGroups.test.ts | 12 | 注册表 27 条完整性、getSmallGroup/getSmallGroupBySymbol/getPrecomputed、子群阶整除、isSimple 与素数一致、center/共轭类与 subgroups.ts 一致 |
| polyhedra.test.ts | 9 | 多面体顶点数（12/24/24/24/60/60）、半径缩放、computeSkeletonEdges、computeElementRotation（identity 角 0、Cₙ/Dₙ 轴、A₄/S₄/A₅ 轴类型） |
| quotientS4.test.ts | 2 | S₄/V₄ 商群创建与 Cayley 边 |
| quotientFlow.test.ts | 1 | 商群流程 |
| quotientRendering.test.ts | 1 | 商群渲染数据 |
| quotientLayout.test.ts | 1 | 商群 projection3D 布局 |
| hybridCompute.test.ts | 26 | 混合计算：order ≤60 本地 / >60 后端缓存、fetchBackendResults 合并转换、computeGroupProperties 本地/后端、后端失败本地兜底（computeLocalFallbackResults：S₅ 子群/共轭类/性质、>240 空兜底）、fetchBackendCayleyEdges/ElementOrder |
| types.test.ts | 22 | 群类型判定函数、analyzeDPFactors、isCyclicFactorKeys、getAvailableShapes3D/形状与布局默认值、getViewBoxSize 全分支 |
| api.test.ts | 14 | 后端 API 客户端：9 端点 URL/method/body、错误路径（detail 优先、否则 statusText） |
| cycleLayouts.test.ts | 14 | computeCycleSubgroups、computeMaximalCycles、forceLayout（自环/initialPositions/cycleSubgroups）、planarCycleLayout |
| ringOrder.test.ts | 17 | S3 排列/Z₂ 位向量/整数/eN 排序、parseProductFactors、matrixGridLayout、nestedFactorLayout2D |
| viewBox.test.ts | 8 | getViewBoxSize（table clamp、sublattice、force 放大）、isTooLarge 各视图阈值 |
| semidirectProduct.test.ts | 6 | createSemidirectProduct：C3⋊C2→D3、平凡φ→直接积、幂等回退、非同态φ抛错、exponent=lcm、生成元提升 |
| properties.test.ts | 13 | 群性质：S₃/A₄/S₄ 导出列可解非幂零、A₅ 完美不可解、D₈ 幂零/D₁₂ 非幂零、Q₈、Cₙ/V₄、S₃×C₂、>60 cutoff 返回 null、导出列均为子群 |
| i18n.test.ts | 3 | i18n 键完整性：zh/en 键集合相等、非空字符串、占位符参数一致 |

## 4. 测试要点与约定

- 群公理辅助函数 `assertGroupAxioms` 模式：对采样元素验证单位元/逆元/闭包/结合律
- 元素 id 格式因群而异：循环群 `e0..e(n-1)`、置换群 `'1,2,3'` 样式、直积/半直积 `aId|bId` pipe 拼接、商群 `qcoset-N`、Aut(G) `auto-N`
- 性能敏感计算（findAllAutomorphisms、大群子群）有守卫阈值，测试应验证守卫行为而非枚举
- mock 外部模块（utils/api）时 `vi.mock` factory 内不要引用顶层变量；用 `vi.mocked(imported)` 拿到 mock 实例
- fetch 类测试用 `vi.stubGlobal('fetch', ...)`（beforeEach 中 `vi.unstubAllGlobals()` 还原）
- i18n 键已在 translations.ts 中补齐，断言提示文案时直接使用 t() 键或中文/英文文案

## 5. 其他脚本

- `npm run export`：Playwright 批量导出（scripts/batch-export.mjs），9 预设群 × 7 视图 → `exports/batch-<timestamp>/`，依赖 `window.__groupVizExport__` 桥（src/utils/exportApi.ts）
- `npm run postinstall`：`npx playwright install chromium`
- 开发流程：改代码 → 写/更新测试 → `npm run test` 全绿 → `npm run lint` 无错误
