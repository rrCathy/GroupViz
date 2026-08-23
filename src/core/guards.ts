/**
 * 引擎守卫常量单一定义点。
 *
 * 所有性能/规模守卫阈值集中在此（零依赖纯常量），各算法模块从本文件导入并
 * re-export 以保持原公共导出面不变。修改任何阈值前先确认对应测试
 * （series.test / properties.test / presentations.test 等）对阈值的引用方式。
 */

// ─── 群阶守卫：超过该阶本地枚举不再进行（返回 null / 走后端 GAP） ──────────

/** 子群列（导列/中心列/合成列）本地计算上限。 */
export const SERIES_MAX_ORDER = 240

/** 展示群 → 有限群（Todd–Coxeter 建表）的群阶上限。 */
export const PRESENTATION_MAX_ORDER = 240

/** Sylow 型分析本地计算上限。 */
export const SYLOW_MAX_ORDER = 240

/** 群性质检测（properties.ts）默认上限，allowLarge 可越过。 */
export const PROPERTIES_CUTOFF = 60

/** 半直积分解发现器（discoverPresentation）工作群阶上限。 */
export const DISCOVERER_MAX_ORDER = 120

/** 混合计算：后端不可用时的本地全量兜底上限。 */
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
