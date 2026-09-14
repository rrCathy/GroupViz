/**
 * 引擎守卫常量单一定义点。
 *
 * 所有性能/规模守卫阈值集中在此（零依赖纯常量），各算法模块从本文件导入并
 * re-export 以保持原公共导出面不变。修改任何阈值前先确认对应测试
 * （series.test / properties.test / presentations.test 等）对阈值的引用方式。
 *
 * ## 阶阈值的口径（2026-09-14 重定，依据 docs/PERF.md 的实测三条线）
 *
 * 旧版把「60 / 100 / 120 / 240」混用，没有一条对得上实测：子群枚举实测到
 * 144 阶仍 1.81s（< 2s）却被 60 拦下；3D 视图 DOM 恒定、S₆(720) 仍可交互
 * 却被 100 拦下；而 sylow 的 240 会让枚举跑 19s。现在全部对齐三条实测线：
 *
 * | 线 | 值 | 实测依据（docs/PERF.md） |
 * |---|---|---|
 * | `INTERACTIVE_LIMIT` | 120 | 交互线：L2 成本 ÷ 16.7ms 帧预算。120 阶缩放 44–60 fps |
 * | `ENUMERATION_LIMIT` | 144 | 子群枚举 2 秒线：D72(144)=1.81s，168 阶 3.45s 超预算 |
 * | `STATIC_LIMIT` | 480 | 仅静态展示/出图（cycle 的 L1 上限；图形类静态 5.9 万节点仍 48 fps） |
 * | `RENDER_3D_LIMIT` | 720 | 3D 是 canvas、DOM 恒定 71–85 节点，S₆(720) 缩放 20–43 fps |
 *
 * 「交互会卡」与「静态可看」是两条独立的线（docs/PERF.md §4），不要混用。
 */

// ─── 三条实测线（新代码一律引用这些，不要再写魔数）─────────────────────────

/** 需要持续交互（拖拽/缩放/力导向）的视图与操作的流畅线。 */
export const INTERACTIVE_LIMIT = 120

/** 子群枚举类（findAllSubgroups / 共轭类 / 正规子群 / 半直积分解 / 性质检测）的 2 秒线。 */
export const ENUMERATION_LIMIT = 144

/** 仅静态展示 / 出图 / 导出可接受的上限（图形类视图）。 */
export const STATIC_LIMIT = 480

/** 3D 视图上限：DOM 恒定（1 个 canvas），与群阶基本无关。 */
export const RENDER_3D_LIMIT = 720

// ─── 群阶守卫：超过该阶本地枚举不再进行（返回 null / 走后端 GAP） ──────────

/** 子群列（导列/中心列/合成列）本地计算上限。 */
export const SERIES_MAX_ORDER = ENUMERATION_LIMIT

/** 展示群 → 有限群（Todd–Coxeter 建表）的群阶上限。TC 有独立的陪集数守卫。 */
export const PRESENTATION_MAX_ORDER = 240

/** Sylow 型分析本地计算上限。 */
export const SYLOW_MAX_ORDER = ENUMERATION_LIMIT

/** 群性质检测（properties.ts）默认上限，allowLarge 可越过。 */
export const PROPERTIES_CUTOFF = ENUMERATION_LIMIT

/** 半直积分解发现器（discoverPresentation）工作群阶上限。 */
export const DISCOVERER_MAX_ORDER = ENUMERATION_LIMIT

/** 混合计算：后端不可用时的本地全量兜底上限（慢但正确，勿与枚举线混淆）。 */
export const FALLBACK_CUTOFF = 240

// ─── Todd–Coxeter 陪集枚举守卫 ─────────────────────────────────────────────

/** 陪集数上限：达到即判溢出（overflow）。 */
export const TC_MAX_COSETS = 3000

/** 枚举步数上限：防止无限关系死循环。 */
export const TC_MAX_STEPS = 5_000_000

// ─── 关系发现器预算 ────────────────────────────────────────────────────────

/** 候选关系词数量上限。 */
export const DISCOVERER_RELATOR_CAP = 2000

/** 词长度×数量组合的枚举预算。 */
export const DISCOVERER_WORD_BUDGET = 70_000

// ─── 自同构枚举守卫 ────────────────────────────────────────────────────────

/** findAllAutomorphisms 生成元映射组合数上限，超过直接返回 []。 */
export const AUTOMORPHISM_MAX_COMBINATIONS = 30000
