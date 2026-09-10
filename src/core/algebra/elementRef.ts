import type { Group, GroupElement } from '../types'

/**
 * 元素引用（element reference）解析 —— 面向包消费端的便利层。
 *
 * 背景：`GroupElement` 同时携带多种记号，宿主很难只靠一种就精确命中：
 *   - `id`    机器键（置换群为逗号串 `"1,3,4,2"`，循环群为 `e3`），所有受控 props 都用它；
 *   - `label` 人类记号，但**各群约定并不统一**：
 *       · Aₙ 用带括号的循环记号 `(234)` / `(12)(34)`；
 *       · Sₙ 历史上被剥掉了外层括号 —— 单环成了 `234`，多环甚至畸变成 `12)(34`；
 *       · 循环群为指数 `3`，同构群为 `\alpha_3` …
 *   - `value` 数值数组（置换群 `[1,3,4,2]`，循环群 `[3]`）。
 * 宿主拿人类记号（尤其标准循环记号 `(234)`）去填需要 `id` 的 prop
 * （`actionElementId` / `actions[].elementId` / 陪集 H 列表）时，旧实现会**静默查不到**
 * （无告警、动画不动、相机被 showAction 连带锁死）。
 *
 * 本模块让 core 侧统一接受「任一记号」，匹配优先级：
 *   1. `id` 精确（含去空白归一化）—— 保持既有传 id 的宿主零改动；
 *   2. `label` 精确（含去空白归一化）；
 *   3. `value` 归一化（`[1,3,4,2]` → `"1,3,4,2"`，兼容手写置换数组串）；
 *   4. **循环记号语义匹配** —— 把 `(234)` / `234` / `12)(34` / `(1234)` 解析成置换再比对，
 *      于是 `(234)` 与 `234` 等价、且能跨群互写（S₄ 宿主写 A₄ 风格记号也能命中）。
 * 全都不中返回 `null`，由调用方决定告警/回退，不再静默。
 */

/** 归一化引用：去首尾空白 + 去全部内部空白（`"1, 3, 4, 2"` → `"1,3,4,2"`）。 */
export function normalizeElementRef(ref: string): string {
  return ref.trim().replace(/\s+/g, '')
}

/**
 * 群是否为「置换群」：所有元素的 `value` 都恰是 `1..n` 的一个排列（`n ≥ 2`）。
 * 是则返回次数 `n`，否则返回 `null`（循环群 value 是 `[i]`、二面体是 `[r,s]`，
 * 都会在这里被排除，保证循环记号的语义档不会误伤非置换群）。
 */
function permutationDegree(group: Group): number | null {
  const els = group.elements
  if (els.length === 0) return null
  const n = els[0].value.length
  if (n < 2) return null
  const seen = new Uint8Array(n + 1)
  for (const el of els) {
    const v = el.value
    if (v.length !== n) return null
    seen.fill(0)
    for (const x of v) {
      if (!Number.isInteger(x) || x < 1 || x > n || seen[x]) return null
      seen[x] = 1
    }
  }
  return n
}

/**
 * 把「循环记号」串解析为 `1..degree` 上的置换数组（`p[i] = 点 i+1 映射到的点`）。
 * 宽容接受多种写法：
 *   - 带括号：`(234)`、`(12)(34)`、`(1 2 3)`、`(1,2)(3,4)`
 *   - 不带括号的单循环：`234`、`1234`（兼容旧 S₃/S₄ 的单环 label）
 *   - 括号残缺：`12)(34`（旧 S₄ 多环 label 的畸形输出）
 * 无分隔符的连续数字串按单点逐位拆分（`234` ≡ `(2 3 4)`）；带分隔符（空格/逗号）时
 * 每个 token 视为一个点，故多位数点（`10 12 3`）也支持。
 *
 * 不是循环记号时返回 `null`：含逗号的数组串（`1,3,4,2`，交给 value 档）、
 * 无数字的串（`e` / `\alpha_3`）、点越界或重复、解析为空 —— 一律 `null`。
 *
 * @param ref    待解析的引用串
 * @param degree 群次数（点数）
 */
export function parseCycleNotation(ref: string, degree: number): number[] | null {
  if (!Number.isInteger(degree) || degree < 1) return null
  const s = String(ref).trim()
  if (!s || !/\d/.test(s)) return null
  // 逗号数组记号（value 档）不当作循环记号
  if (!s.includes('(') && s.includes(',')) return null

  // 以任意括号序列切段：`(12)(34)` → ['12','34']；`12)(34` → ['12','34']；`234` → ['234']
  const segs = s.split(/[()]+/).map(t => t.trim()).filter(t => t.length > 0)
  if (segs.length === 0) return null

  const perm = Array.from({ length: degree }, (_, i) => i + 1)
  const used = new Set<number>()
  let hadCycle = false
  for (const seg of segs) {
    const tokens = seg.split(/[^\d]+/).filter(t => t.length > 0)
    if (tokens.length === 0) return null
    // 无分隔符的连续数字串按「单点逐位」拆（`234` → 2,3,4；`1234` → 1,2,3,4）；
    // 有分隔符时每个 token 即一个点（`10 12 3` → 10,12,3），兼容多位数点。
    const pts = tokens.length === 1
      ? [...tokens[0]].map(Number)
      : tokens.map(Number)
    for (const p of pts) {
      if (!Number.isInteger(p) || p < 1 || p > degree || used.has(p)) return null
      used.add(p)
    }
    if (pts.length <= 1) continue // 单点/空段 = 不动点，忽略
    hadCycle = true
    for (let i = 0; i < pts.length; i++) {
      perm[pts[i] - 1] = pts[(i + 1) % pts.length]
    }
  }
  // 全是不动点（如裸 `1` / `(1)`）不构成循环记号，不认，避免误命中恒等元
  return hadCycle ? perm : null
}

/**
 * 把元素引用解析为群元素；接受 `id` / `label` / `value` / 循环记号任一种。
 *
 * @param group 目标群（`null`/`undefined` 时直接返回 `null`，便于宿主传可空群）
 * @param ref   元素引用字符串
 * @returns 命中元素；未命中返回 `null`
 */
export function resolveElement(
  group: Group | null | undefined,
  ref: string | null | undefined,
): GroupElement | null {
  if (!group || ref == null) return null
  const raw = String(ref)
  const key = normalizeElementRef(raw)
  if (!key) return null

  for (const el of group.elements) {
    if (el.id === raw || el.id === key) return el
  }
  for (const el of group.elements) {
    if (el.label === raw || el.label === key) return el
  }
  for (const el of group.elements) {
    if (el.value.length > 0 && normalizeElementRef(el.value.join(',')) === key) return el
  }

  // 语义档：把循环记号解析成置换再比对（`(234)` ≡ `234`，跨群通用）
  const degree = permutationDegree(group)
  if (degree != null) {
    const parsed = parseCycleNotation(key, degree)
    if (parsed) {
      for (const el of group.elements) {
        if (el.value.length === degree && el.value.every((v, i) => v === parsed[i])) return el
      }
    }
  }
  return null
}

/**
 * `resolveElement` 的别名 —— 提供反馈中期望的 `findElement(group, ref)` 命名，
 * 便于按名检索（grep）发现该能力。语义与 `resolveElement` 完全一致。
 */
export const findElement = resolveElement

/**
 * 批量解析 + 未命中回收。保持输入顺序，去掉重复项。
 *
 * 用途：`subsets[].elementIds` / 陪集 H 列表 / `actions[]` 这类数组入参一次解析完，
 * 同时拿到「哪些引用没解析到」以便宿主统一 `console.warn`。
 */
export function resolveElementRefs(
  group: Group | null | undefined,
  refs: readonly string[] | null | undefined,
): { elements: GroupElement[]; ids: string[]; unresolved: string[] } {
  const elements: GroupElement[] = []
  const ids: string[] = []
  const unresolved: string[] = []
  const seen = new Set<string>()
  if (!group || !refs) return { elements, ids, unresolved }

  for (const ref of refs) {
    const el = resolveElement(group, ref)
    if (!el) {
      unresolved.push(ref)
      continue
    }
    if (seen.has(el.id)) continue
    seen.add(el.id)
    elements.push(el)
    ids.push(el.id)
  }
  return { elements, ids, unresolved }
}

/**
 * 一次性解析任意元素引用数组为规范 id 数组（丢弃未命中项，重复项去重）。
 * 需要区分未命中时用 `resolveElementRefs`。
 */
export function resolveElementIds(
  group: Group | null | undefined,
  refs: readonly string[] | null | undefined,
): string[] {
  return resolveElementRefs(group, refs).ids
}

/** 反向：取元素的规范 id（已就绪时直接给 `el.id`，此处仅为对称入口）。 */
export function elementRefId(el: GroupElement): string {
  return el.id
}
