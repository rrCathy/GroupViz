import type { Group, GroupElement } from '../types'
import { findAllSubgroups, computeElementOrderInGroup } from './subgroups'

export const S3_PERM_IDS = ['1,2,3', '2,1,3', '2,3,1', '3,2,1', '3,1,2', '1,3,2']

export function detectS3PermSet(keys: string[]): boolean {
  if (keys.length !== 6) return false
  const s = new Set(keys)
  return S3_PERM_IDS.every(k => s.has(k))
}

export function ringOrder(keys: string[]): string[] {
  if (detectS3PermSet(keys)) return S3_PERM_IDS

  const vecs = keys.map(k => k.split(',').map(Number))
  const allBits = vecs.every(v => v.every(x => x === 0 || x === 1))
  if (allBits && vecs.length === 4 && vecs[0].length === 2) {
    return ['0,0', '1,0', '1,1', '0,1']
  }
  if (allBits && vecs.length === 8 && vecs[0].length === 3) {
    return ['0,0,0', '0,0,1', '0,1,1', '0,1,0', '1,1,0', '1,1,1', '1,0,1', '1,0,0']
  }

  const deduped = Array.from(new Set(keys))
  if (deduped.every(k => /^-?\d+$/.test(k))) {
    return deduped.sort((a, b) => Number(a) - Number(b))
  }
  if (deduped.every(k => /^[eg]\d+$/.test(k))) {
    return deduped.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  }
  return deduped.sort()
}

export function cayleyRingKeys(keys: string[]): string[] {
  if (detectS3PermSet(keys)) return S3_PERM_IDS
  const vecs = keys.map(k => k.split(',').map(Number))
  if (vecs.every(v => v.every(x => x === 0 || x === 1))) {
    const n = vecs.length
    const d = vecs[0].length
    if (n === 4 && d === 2) return ['0,0', '1,0', '1,1', '0,1']
    if (n === 8 && d === 3) return ['0,0,0', '0,0,1', '0,1,1', '0,1,0', '1,1,0', '1,1,1', '1,0,1', '1,0,0']
  }
  const deduped = [...new Set(keys)]
  if (deduped.every(k => /^-?\d+$/.test(k))) {
    return deduped.sort((a, b) => Number(a) - Number(b))
  }
  if (deduped.every(k => /^[eg]\d+$/.test(k))) {
    return deduped.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  }
  return deduped.sort()
}

export interface ProductFactors {
  colSize: number
  rowSize: number
  getCol: (el: GroupElement) => number
  getRow: (el: GroupElement) => number
}

export interface CompactFactorPart {
  /** 原始 part 文本，如 'C_{2}^{2}' */
  text: string
  /** 去幂后的 base，如 'C_{2}' */
  base: string
  /** pipe id 段数：幂指数或 1 */
  segments: number
}

/**
 * 将紧凑直积符号拆成因子 parts。
 * 'C_{2}^{2} \times S_{3}' → [{text:'C_{2}^{2}',base:'C_{2}',segments:2},{text:'S_{3}',base:'S_{3}',segments:1}]
 */
export function parseCompactFactors(symbol: string): CompactFactorPart[] {
  return symbol.split('\\times').map(t => {
    const trimmed = t.trim()
    if (!trimmed) return { text: trimmed, base: trimmed, segments: 0 }
    const m = trimmed.match(/^(.+)\^\{(\d+)\}$/)
    if (m) return { text: trimmed, base: m[1], segments: Number(m[2]) }
    return { text: trimmed, base: trimmed, segments: 1 }
  })
}

/**
 * 按紧凑符号因子对 pipe id 段分组。
 * 例：C_{2}^{2} \times S_{3}，元素 id '0|0|1,2,3' → [['0','0'],['1,2,3']]（2 组而非 3 段）。
 * 段数与符号因子段数不一致（或非 pipe / 符号不含 \times）时返回 null（调用方逐 token 兜底）。
 */
export function factorPipeGroups(group: Group): string[][][] | null {
  if (group.elements.length === 0) return null
  if (!group.elements[0].id.includes('|')) return null
  const parts = parseCompactFactors(group.symbol)
  const segTotal = parts.reduce((a, p) => a + p.segments, 0)
  const tokenCount = group.elements[0].id.split('|').length
  if (segTotal !== tokenCount) return null
  return group.elements.map(el => {
    const toks = el.id.split('|')
    const groups: string[][] = []
    let off = 0
    for (const p of parts) {
      groups.push(toks.slice(off, off + p.segments))
      off += p.segments
    }
    return groups
  })
}

export interface PipeFactorGrouped {
  /** 每元素 → 各归组因子的 token 组 */
  perEl: string[][][]
  /** 每归组因子是否循环（base 为循环前缀且合并段数 === 1） */
  cyclic: boolean[]
  /** 每个归组因子在原符号 part 序列中的起始偏移 */
  offsets: number[]
  count: number
}

/**
 * 2D 分类语义的 pipe 归组：相邻同底循环 part 合并（C_{2}×C_{2}→C_{2}^{2}，
 * 合并段数 > 1 → 非循环，即 C2²≅V₄ 视为非循环因子）；非循环 part 永不合并。
 * 与 types.analyzeDPFactorsGrouped2D 语义一致；段数与 token 数不符时返回 null。
 */
export function factorPipeGroupsGrouped(group: Group): PipeFactorGrouped | null {
  if (group.elements.length === 0) return null
  if (!group.elements[0].id.includes('|')) return null
  const parts = parseCompactFactors(group.symbol)
  const segTotal = parts.reduce((a, p) => a + p.segments, 0)
  const tokenCount = group.elements[0].id.split('|').length
  if (segTotal !== tokenCount) return null

  interface GroupDef {
    base: string
    segs: number
    cyclic: boolean
    offset: number
  }
  const defs: GroupDef[] = []
  let off = 0
  for (const p of parts) {
    const cyc = (p.base.startsWith('C') || p.base.startsWith('Z_')) && p.segments === 1
    const last = defs[defs.length - 1]
    if (cyc && last && last.base === p.base) {
      last.segs += p.segments
      last.cyclic = false
    } else {
      defs.push({ base: p.base, segs: p.segments, cyclic: cyc, offset: off })
    }
    off += p.segments
  }

  const perEl = group.elements.map(el => {
    const toks = el.id.split('|')
    const groups: string[][] = []
    let o = 0
    for (const d of defs) {
      groups.push(toks.slice(o, o + d.segs))
      o += d.segs
    }
    return groups
  })

  return {
    perEl,
    cyclic: defs.map(d => d.cyclic),
    offsets: defs.map(d => d.offset),
    count: defs.length
  }
}

/**
 * 注册表群（GAP SmallGroups 导入，id 无 '|'、value 单维）的因子聚类。
 * 用生成元交换性聚类：直积不同因子的生成元必交换；同一非循环因子内部生成元不交换。
 * 每簇对生成元做 BFS 幂闭包得因子元素表；簇阶乘积 ≠ 群阶 → null。
 * 返回每簇元素 id 列表（簇 0 恒含 identity）。
 */
export function clusterFactorGroups(group: Group): string[][] | null {
  const gens = group.generators
  if (gens.length < 2) return null
  const n = group.elements.length
  const mul = group.multiply
  const genElements = gens.map(g => g.apply(group.identity))
  const k = genElements.length

  const parent = genElements.map((_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const a = genElements[i]
      const b = genElements[j]
      if (mul(a, b).id !== mul(b, a).id) parent[find(i)] = find(j)
    }
  }

  const clusterMap = new Map<number, GroupElement[]>()
  for (let i = 0; i < k; i++) {
    const r = find(i)
    if (!clusterMap.has(r)) clusterMap.set(r, [])
    clusterMap.get(r)!.push(genElements[i])
  }
  const clusters = [...clusterMap.values()]
  if (clusters.length < 2) return null

  const orders: number[] = []
  const lists: GroupElement[][] = []
  for (const cluster of clusters) {
    const list: GroupElement[] = [group.identity]
    const seen = new Set([group.identity.id])
    let head = 0
    while (head < list.length) {
      const cur = list[head++]
      for (const g of cluster) {
        const next = mul(cur, g)
        if (!seen.has(next.id)) {
          seen.add(next.id)
          list.push(next)
        }
      }
    }
    orders.push(list.length)
    lists.push(list)
  }
  if (orders.reduce((a, b) => a * b, 1) !== n) return null

  return lists.map(list => list.map(e => e.id))
}

/**
 * 生成元幂序：从 identity 沿生成元右乘 BFS 扩展的访问顺序。
 * 循环群 → e, g, g², …（正多边形，边规则无交叉）；V₄ 位向量 → 正方形环序；
 * S₃ 置换集 → 六边形序。用于半直积布局让 N/H 生成元边旋转对称。
 * generators 缺失或 BFS 覆盖不全时回退 ringOrder。
 */
export function powerRingOrder(group: Group): string[] {
  const keys = group.elements.map(e => e.id)
  if (group.order === 0) return []
  if (detectS3PermSet(keys)) return S3_PERM_IDS

  const vecs = keys.map(k => k.split(',').map(Number))
  if (vecs.every(v => v.every(x => x === 0 || x === 1))) {
    if (keys.length === 4 && vecs[0].length === 2) return ['0,0', '1,0', '1,1', '0,1']
    if (keys.length === 8 && vecs[0].length === 3) {
      return ['0,0,0', '0,0,1', '0,1,1', '0,1,0', '1,1,0', '1,1,1', '1,0,1', '1,0,0']
    }
  }

  // C_m × C_2（pipe 2 段、第二段仅 2 个值）：外圈环序 (0,0),(1,0),…,(m-1,0)
  // + 内弧 (m-1,1),…,(0,1)。第一段生成元边沿外圈弧连续、第二段生成元边为径向对，
  // 盘内不跳对角线（C4×C2 半直积盘内美观的关键）。
  if (keys.length > 0 && keys.every(k => k.includes('|')) && keys[0].split('|').length === 2) {
    const seg2 = new Set(keys.map(k => k.split('|')[1]))
    if (seg2.size === 2) {
      const seg1Vals = Array.from(new Set(keys.map(k => k.split('|')[0])))
      const seg1Key = (v: string): number => /^-?\d+$/.test(v) ? Number(v) : /^e\d+$/.test(v) ? Number(v.slice(1)) : NaN
      if (seg1Vals.every(v => !Number.isNaN(seg1Key(v)))) {
        const idTok = group.identity.id.split('|')[1]
        const [t0, t1] = [...seg2].sort((a, b) =>
          (a === idTok ? 0 : 1) - (b === idTok ? 0 : 1))
        const s1sorted = seg1Vals.slice().sort((a, b) => seg1Key(a) - seg1Key(b))
        const order: string[] = []
        for (const v of s1sorted) order.push(`${v}|${t0}`)
        for (let i = s1sorted.length - 1; i >= 0; i--) order.push(`${s1sorted[i]}|${t1}`)
        if (order.length === keys.length) return order
      }
    }
  }

  const gens = group.generators
    .map(g => g.apply(group.identity))
    .filter(g => g.id !== group.identity.id)
  if (gens.length === 0) return ringOrder(keys)

  const elById = new Map(group.elements.map(e => [e.id, e]))
  const seen = new Set<string>([group.identity.id])
  const queue: string[] = [group.identity.id]
  const order: string[] = [group.identity.id]
  while (queue.length > 0) {
    const curId = queue.shift()!
    const cur = elById.get(curId)
    if (!cur) return ringOrder(keys)
    for (const gen of gens) {
      const next = group.multiply(cur, gen).id
      if (!seen.has(next)) {
        seen.add(next)
        order.push(next)
        queue.push(next)
      }
    }
  }
  if (order.length !== group.order) return ringOrder(keys)
  return order
}

// ─── Q₁₆（广义四元数群）陪集分解 ─────────────────────────────────────────

export interface QuaternionCosetMap {
  byElement: Map<string, { j: number; i: number }>
  a: GroupElement
  b: GroupElement
}

/**
 * Q₁₆ 元素唯一分解 g = a^j · b^i（j, i ∈ 0..3）。生成元约定与 Group Explorer
 * 一致（GE 把 order 16 的广义四元数群记为 Q₈，下标 = 阶/2；本仓库
 * buildGenerators 已按 GE 重建标准 (a,b)：a 阶 8、b 阶 4、a⁴ = b²、b·a·b⁻¹ = a⁻¹）。
 * 对每个元素扫 a⁻ʲ·g ∈ {e, b, b², b³} 求唯一坐标，全部 16 个元素恰好
 * 落在 4×4 网格才成功；结构不匹配（非 Q16 或生成元顺序不同）返回 null。
 */
export function quaternionCosetMap(group: Group): QuaternionCosetMap | null {
  if (group.order !== 16) return null
  const gens = group.generators
    .map(g => g.apply(group.identity))
    .filter(el => el.id !== group.identity.id)
  if (gens.length < 2) return null
  const mul = group.multiply
  const inv = group.inverse
  const id = group.identity

  const decompose = (a: GroupElement, b: GroupElement): Map<string, { j: number; i: number }> | null => {
    const aNeg = [id, inv(a), mul(inv(a), inv(a)), mul(mul(inv(a), inv(a)), inv(a))]
    const bPows = [id, b, mul(b, b), mul(mul(b, b), b)]
    const byElement = new Map<string, { j: number; i: number }>()
    for (const el of group.elements) {
      let found = false
      for (let j = 0; j < 4 && !found; j++) {
        const t = mul(aNeg[j], el)
        for (let i = 0; i < 4; i++) {
          if (t.id === bPows[i].id) {
            byElement.set(el.id, { j, i })
            found = true
            break
          }
        }
      }
      if (!found) return null
    }
    return byElement.size === 16 ? byElement : null
  }

  const tryPair = (a: GroupElement, b: GroupElement): QuaternionCosetMap | null => {
    if (computeElementOrderInGroup(a, group) !== 8 || computeElementOrderInGroup(b, group) !== 4) return null
    const a4 = mul(mul(mul(a, a), a), a)
    if (a4.id !== mul(b, b).id) return null
    if (mul(mul(b, a), inv(b)).id !== inv(a).id) return null
    const byElement = decompose(a, b)
    if (!byElement) return null
    return { byElement, a, b }
  }

  const direct = tryPair(gens[0], gens[1])
  if (direct) return direct
  return tryPair(gens[1], gens[0])
}

/**
 * 注册表群（非 pipe）的混合进制因子分解：全群元素 → (因子 A 元素, 因子 B 元素) 分量。
 * 两簇元素逐一相乘枚举全群（直积分解唯一），aIds/bIds 为两簇元素 id（含 identity）。
 */
export function tableGroupFactorSplit(group: Group): {
  byElement: Map<string, { aId: string; bId: string }>
  aIds: string[]
  bIds: string[]
} | null {
  let idGroups = clusterFactorGroups(group)
  if (!idGroups) idGroups = tableFactorSearch(group)
  if (!idGroups || idGroups.length !== 2) return null
  const byId = new Map(group.elements.map(e => [e.id, e]))
  const mul = group.multiply
  const aList = idGroups[0].map(id => byId.get(id)!)
  const bList = idGroups[1].map(id => byId.get(id)!)
  const byElement = new Map<string, { aId: string; bId: string }>()
  for (const aEl of aList) {
    for (const bEl of bList) {
      const el = mul(aEl, bEl)
      byElement.set(el.id, { aId: aEl.id, bId: bEl.id })
    }
  }
  if (byElement.size !== group.elements.length) return null
  return { byElement, aIds: idGroups[0], bIds: idGroups[1] }
}

/**
 * 簇是否循环：存在某元素（≠e）的幂闭包恰为整个簇。
 * 阶 2 簇必循环；Dₙ/Q₈/S₃ 等非循环群的单生成闭包均小于簇阶。
 */
export function clusterIsCyclic(group: Group, ids: string[]): boolean {
  const n = ids.length
  if (n <= 2) return true
  const byId = new Map(group.elements.map(e => [e.id, e]))
  for (const id of ids) {
    if (id === group.identity.id) continue
    const el = byId.get(id)!
    let cur = el
    const seen = new Set([el.id, group.identity.id])
    for (;;) {
      cur = group.multiply(cur, el)
      if (cur.id === group.identity.id) break
      if (seen.has(cur.id)) break
      seen.add(cur.id)
    }
    if (seen.size === n) return true
  }
  return false
}

/**
 * 不依赖 value 格式的旋转/反射分类（D_m 结构，含注册表群 value=[k]）：
 * 找阶 m 元素 r（m = |G|/2）→ rotations = ⟨r⟩ 幂序 [e, r, r², …]；
 * reflections = 其余元素，反射 s_i 与旋转 r^i 同角配对（s_i = r^i · s₀）。
 * 找不到阶 m 元素、或反射数 ≠ m → null（由调用方回退）。
 */
export function splitDihedralElements(group: Group): {
  rotations: GroupElement[]
  reflectPair: Map<string, number>
} | null {
  const n = group.order
  const m = n / 2
  if (n % 2 !== 0 || m < 2) return null
  const id = group.identity

  for (const el of group.elements) {
    if (el.id === id.id) continue
    const powers: GroupElement[] = [id, el]
    const seen = new Set([id.id, el.id])
    let cur = el
    let closed = false
    for (;;) {
      cur = group.multiply(cur, el)
      if (cur.id === id.id) { closed = true; break }
      if (seen.has(cur.id)) break
      seen.add(cur.id)
      powers.push(cur)
    }
    if (!closed || powers.length !== m) continue
    const rotIds = new Set(powers.map(e => e.id))
    const refs = group.elements.filter(e => !rotIds.has(e.id))
    if (refs.length !== m) continue
    const s0 = refs[0]
    const reflectPair = new Map<string, number>()
    let pairOk = true
    for (let i = 0; i < m; i++) {
      const s_i = group.multiply(powers[i], s0)
      if (rotIds.has(s_i.id) || reflectPair.has(s_i.id)) { pairOk = false; break }
      reflectPair.set(s_i.id, i)
    }
    if (pairOk && reflectPair.size === m) {
      return { rotations: powers, reflectPair }
    }
  }
  return null
}

// 二面体蛇形环序：rotations 幂序正排 + reflections 按配对角反排，
// 摊平为单环（外圈旋转升序 → 内圈反射降序），使生成元边外环相邻、反射边径向。
// 用于半直积布局的 N 盘内环序（注册表群 N 无 pipe id，powerRingOrder 不特判）。
export function dihedralSnakeOrder(group: Group): string[] | null {
  const split = splitDihedralElements(group)
  if (!split) return null
  const refsDesc = Array.from(split.reflectPair.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
  return [...split.rotations.map(e => e.id), ...refsDesc]
}

/**
 * 解析符号因子的阶：C_{n}→n、S_{n}→n!、A_{n}→n!/2、D_{m}→2m、
 * Q_{8}→8、QD_{16}/Q_{16}→16、SmallGroup(n,i)→n、
 * 半直积记号 (N:H) 或 N:H → |N|·|H|。无法解析返回 null。
 */
export function tablePartOrder(part: string): number | null {
  let t = part.trim()
  if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim()
  let m = t.match(/^C_\{\s*(\d+)\s*\}$/)
  if (m) return Number(m[1])
  m = t.match(/^S_\{\s*(\d+)\s*\}$/)
  if (m) {
    const k = Number(m[1])
    let f = 1
    for (let i = 2; i <= k; i++) f *= i
    return f
  }
  m = t.match(/^A_\{\s*(\d+)\s*\}$/)
  if (m) {
    const k = Number(m[1])
    let f = 1
    for (let i = 2; i <= k; i++) f *= i
    return f / 2
  }
  m = t.match(/^D_\{\s*(\d+)\s*\}$/)
  if (m) return 2 * Number(m[1])
  if (t === 'Q_{8}') return 8
  if (t === 'QD_{16}') return 16
  if (t === 'Q_{16}') return 16
  m = t.match(/^SmallGroup\((\d+),(\d+)\)$/)
  if (m) return Number(m[1])
  if (t.includes(':')) {
    const halves = t.split(':').map(s => s.trim()).filter(Boolean)
    if (halves.length === 2) {
      const a = tablePartOrder(halves[0])
      const b = tablePartOrder(halves[1])
      if (a !== null && b !== null) return a * b
    }
  }
  return null
}

/**
 * 按归组语义解析直积符号因子（同 types.analyzeDPFactorsGrouped2D：
 * 相邻同底循环 part 合并，C_{2}×C_{2} → C_{2}^{2} 视为非循环因子）。
 * 返回每归组因子的 base / 段数 / 阶；解析失败返回 null。
 */
export function tableGroupedParts(symbol: string): { base: string; segs: number; order: number }[] | null {
  if (!symbol.includes('\\times')) return null
  const parts = symbol.split('\\times').map(s => s.trim()).filter(Boolean)
  const grouped: { base: string; segs: number }[] = []
  for (const p of parts) {
    const pm = p.match(/^(.+)\^\{(\d+)\}$/)
    const base = pm ? pm[1] : p
    const segs = pm ? Number(pm[2]) : 1
    const cycBase = /^C_\{\s*\d+\s*\}$/.test(base)
    const last = grouped[grouped.length - 1]
    if (cycBase && segs === 1 && last && last.base === base) last.segs += segs
    else grouped.push({ base, segs })
  }
  const out: { base: string; segs: number; order: number }[] = []
  for (const g of grouped) {
    const baseOrder = tablePartOrder(g.base)
    if (baseOrder === null) return null
    out.push({ base: g.base, segs: g.segs, order: Math.pow(baseOrder, g.segs) })
  }
  return out
}

/**
 * 符号引导的注册表群因子分解（clusterFactorGroups 生成元交换性聚类失败时的兜底）：
 * 生成元跨越多个因子（如 C₃×S₃ 的 2 个混合生成元）或全部生成元可交换
 * （如 C₄×C₂×C₂ 全循环簇）时，按符号归组因子（C₃×S₃ → [C₃, S₃]；
 * C₄×C₂×C₂ → [C₄, C₂²]）从全部真子群中搜索满足内部直积
 * G = H₁×H₂×…（乘积唯一覆盖全群）的因子组合。
 * 返回每因子元素 id 列表（含 identity）或 null。
 */
export function tableFactorSearch(group: Group): string[][] | null {
  const n = group.order
  if (n === 0 || n > 60) return null
  if (group.elements[0]?.id.includes('|')) return null
  const grouped = tableGroupedParts(group.symbol)
  if (!grouped || grouped.length < 2) return null
  if (grouped.reduce((a, g) => a * g.order, 1) !== n) return null

  const byId = new Map(group.elements.map(e => [e.id, e]))
  const subgroups: { ids: string[]; cyclic: boolean; order: number }[] = []
  for (const sub of findAllSubgroups(group)) {
    if (sub.order === 1) continue
    const ids = sub.elements.map(e => e.id)
    subgroups.push({ ids, cyclic: clusterIsCyclic(group, ids), order: sub.order })
  }

  const candidates = grouped.map(g => {
    const wantCyclic = /^C_\{\s*\d+\s*\}$/.test(g.base) && g.segs === 1
    return subgroups.filter(s => s.order === g.order && s.cyclic === wantCyclic)
  })
  if (candidates.some(c => c.length === 0)) return null

  const pick: string[][] = []
  const solve = (fi: number): boolean => {
    if (fi === candidates.length) {
      let covered = new Set<string>([group.identity.id])
      for (const ids of pick) {
        const next = new Set<string>()
        const els = ids.map(id => byId.get(id)!)
        for (const c of covered) {
          const cEl = byId.get(c)!
          for (const e of els) next.add(group.multiply(cEl, e).id)
        }
        covered = next
      }
      return covered.size === n
    }
    for (const cand of candidates[fi]) {
      pick.push(cand.ids)
      if (solve(fi + 1)) return true
      pick.pop()
    }
    return false
  }
  if (!solve(0)) return null
  return pick
}

/**
 * 注册表群（GAP SmallGroups 导入，id 无 '|'、value 单维）的网格因子分解。
 * 聚类 + 混合进制组合为行/列坐标。
 */
export function tableGroupGridFactors(group: Group): ProductFactors | null {
  let idGroups = clusterFactorGroups(group)
  if (!idGroups) idGroups = tableFactorSearch(group)
  if (!idGroups) return null
  const byId = new Map(group.elements.map(e => [e.id, e]))
  const lists = idGroups.map(ids => ids.map(id => byId.get(id)!))
  const n = group.elements.length
  const mul = group.multiply

  const orders = lists.map(l => l.length)
  const m = Math.floor(lists.length / 2)
  const colOrders = orders.slice(0, m)
  const rowOrders = orders.slice(m)
  const colLists = lists.slice(0, m)
  const rowLists = lists.slice(m)
  const colSize = colOrders.reduce((a, b) => a * b, 1)
  const rowSize = rowOrders.reduce((a, b) => a * b, 1)

  const pick = (idx: number, ords: number[], l: GroupElement[][]): GroupElement[] => {
    const res: GroupElement[] = []
    let rem = idx
    for (let c = 0; c < ords.length; c++) {
      res.push(l[c][rem % ords[c]])
      rem = Math.floor(rem / ords[c])
    }
    return res
  }
  const productOf = (parts: GroupElement[]): GroupElement => {
    let acc = parts[0]
    for (let c = 1; c < parts.length; c++) acc = mul(acc, parts[c])
    return acc
  }

  const colMap = new Map<string, number>()
  const rowMap = new Map<string, number>()
  for (let ic = 0; ic < colSize; ic++) {
    const colEl = productOf(pick(ic, colOrders, colLists))
    for (let ir = 0; ir < rowSize; ir++) {
      const rowEl = productOf(pick(ir, rowOrders, rowLists))
      const el = mul(colEl, rowEl)
      colMap.set(el.id, ic)
      rowMap.set(el.id, ir)
    }
  }
  if (colMap.size !== n || rowMap.size !== n) return null

  return {
    colSize,
    rowSize,
    getCol: (el) => colMap.get(el.id) ?? 0,
    getRow: (el) => rowMap.get(el.id) ?? 0,
  }
}

export function parseProductFactors(group: Group): ProductFactors | null {
  const n = group.elements.length
  if (n === 0) return null

  const isPipeProduct = group.elements[0].id.includes('|')

  if (isPipeProduct) {
    const perEl = factorPipeGroupsOrTokens(group)
    const groupCount = perEl[0].length
    if (groupCount < 2) return null
    const m = Math.floor(groupCount / 2)
    const colKey = (g: string[][]) => g.slice(0, m).map(x => x.join('|')).join('~')
    const rowKey = (g: string[][]) => g.slice(m).map(x => x.join('|')).join('~')
    const colSet = new Set<string>()
    const rowSet = new Set<string>()
    for (const g of perEl) {
      colSet.add(colKey(g))
      rowSet.add(rowKey(g))
    }
    const colKeys = ringOrder([...colSet])
    const rowKeys = ringOrder([...rowSet])
    const colMap = new Map(colKeys.map((k, i) => [k, i]))
    const rowMap = new Map(rowKeys.map((k, i) => [k, i]))
    const idToGroups = new Map<string, string[][]>()
    for (let i = 0; i < group.elements.length; i++) idToGroups.set(group.elements[i].id, perEl[i])
    return {
      colSize: colKeys.length,
      rowSize: rowKeys.length,
      getCol: (el) => {
        const g = idToGroups.get(el.id)
        return g ? colMap.get(colKey(g)) ?? 0 : 0
      },
      getRow: (el) => {
        const g = idToGroups.get(el.id)
        return g ? rowMap.get(rowKey(g)) ?? 0 : 0
      }
    }
  }

  const vals = group.elements.map(el => el.value)
  const dim = vals[0]?.length || 0
  if (dim < 2) return tableGroupGridFactors(group)

  if (dim === 2) {
    const colSize = new Set(vals.map(v => v[0])).size
    const rowSize = new Set(vals.map(v => v[1])).size
    if (colSize * rowSize !== n) return null
    return { colSize, rowSize, getCol: (el) => el.value[0], getRow: (el) => el.value[1] }
  }

  const rowKeys = Array.from(new Set(vals.map(v => v.slice(0, dim - 1).join(','))))
  const rowVecs = rowKeys.map(k => k.split(',').map(Number))
  const allBits = rowVecs.every(v => v.every(x => x === 0 || x === 1))
  let orderedRows: string[]
  if (allBits && rowVecs.length === 4 && rowVecs[0].length === 2) orderedRows = ['0,0', '1,0', '1,1', '0,1']
  else if (allBits && rowVecs.length === 8 && rowVecs[0].length === 3) orderedRows = ['0,0,0', '0,0,1', '0,1,1', '0,1,0', '1,1,0', '1,1,1', '1,0,1', '1,0,0']
  else {
    const allNumeric = rowKeys.every(k => /^-?\d+$/.test(k))
    orderedRows = rowKeys.slice().sort(allNumeric ? (a, b) => Number(a) - Number(b) : undefined)
  }
  const rowMap = new Map(orderedRows.map((k, i) => [k, i]))

  const colVals = Array.from(new Set(vals.map(v => v[dim - 1]))).sort((a, b) => a - b)
  const colMap = new Map(colVals.map((v, i) => [v, i]))

  return {
    colSize: colVals.length,
    rowSize: orderedRows.length,
    getCol: (el) => colMap.get(el.value[dim - 1]) ?? 0,
    getRow: (el) => rowMap.get(el.value.slice(0, dim - 1).join(',')) ?? 0
  }
}

export function matrixGridLayout(
  colSize: number, rowSize: number,
  getCol: (el: GroupElement) => number, getRow: (el: GroupElement) => number,
  group: Group, width: number, height: number
): Map<string, { x: number; y: number }> {
  const margin = 60
  let [c, r] = [colSize, rowSize]
  let [fnC, fnR] = [getCol, getRow]
  let swapped = false
  if (r > c) { [c, r] = [r, c]; [fnC, fnR] = [fnR, fnC]; swapped = true }

  const usableW = width - 2 * margin
  const usableH = height - 2 * margin
  const cellSize = Math.max(80, Math.min(usableW / c, usableH / r, 160))
  const gridW = c * cellSize
  const gridH = r * cellSize
  const offX = (width - gridW) / 2 + cellSize / 2
  const offY = (height - gridH) / 2 + cellSize / 2

  const result = new Map<string, { x: number; y: number }>()
  for (const el of group.elements) {
    const ci = swapped ? fnR(el) : fnC(el)
    const ri = swapped ? fnC(el) : fnR(el)
    result.set(el.id, { x: offX + ci * cellSize, y: offY + ri * cellSize })
  }
  return result
}

/**
 * factorPipeGroups 的分组，符号不匹配（段数与符号因子不一致）时逐 token 兜底分组。
 * 单组（紧凑幂合并如 C_{2}^{2}）时按 pipe 段拆分为多组，保证网格/嵌套布局可展开。
 */
export function factorPipeGroupsOrTokens(group: Group): string[][][] {
  const compact = factorPipeGroups(group)
  if (compact) {
    if (compact[0].length >= 2) return compact
    return group.elements.map(el => el.id.split('|').map(t => [t]))
  }
  return group.elements.map(el => el.id.split('|').map(t => [t]))
}

export function nestedFactorLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, { x: number; y: number }> | null {
  if (group.elements.length === 0) return null
  if (!group.elements[0].id.includes('|')) return null

  const perEl = factorPipeGroupsOrTokens(group)
  if (perEl[0].length < 2) return null

  const outerKey = (g: string[][]) => g[0].join('|')
  const innerKey = (g: string[][]) => g.slice(1).map(x => x.join('|')).join('~')

  const byKey = new Map<string, Map<string, GroupElement>>()
  for (let i = 0; i < group.elements.length; i++) {
    const el = group.elements[i]
    const o = outerKey(perEl[i])
    const s = innerKey(perEl[i])
    if (!byKey.has(o)) byKey.set(o, new Map())
    byKey.get(o)!.set(s, el)
  }

  const prefixKeys = cayleyRingKeys([...byKey.keys()])
  const suffixKeys = cayleyRingKeys([...byKey.values().next().value!.keys()])

  const outerCount = prefixKeys.length
  const innerCount = suffixKeys.length
  const cx = width / 2
  const cy = height / 2

  const outerR = outerCount <= 2
    ? Math.min(width * 0.22, height * 0.35, 400)
    : Math.min(Math.min(width, height) * 0.30, 50 + outerCount * 60)

  const adjacentArc = outerCount > 2
    ? 2 * outerR * Math.sin(Math.PI / outerCount)
    : outerR * 2
  const maxInnerByCopyGap = adjacentArc * 0.42
  const maxInnerByOuterScale = outerR * 0.38
  const innerR = Math.max(30, Math.min(maxInnerByCopyGap, maxInnerByOuterScale, 180))

  const result = new Map<string, { x: number; y: number }>()

  for (let oi = 0; oi < outerCount; oi++) {
    const pKey = prefixKeys[oi]
    const pAngle = (oi * 2 * Math.PI) / outerCount - Math.PI / 2
    const oX = cx + outerR * Math.cos(pAngle)
    const oY = cy + outerR * Math.sin(pAngle)

    const innerMap = byKey.get(pKey)!
    for (let ii = 0; ii < innerCount; ii++) {
      const sKey = suffixKeys[ii]
      const sAngle = (ii * 2 * Math.PI) / innerCount - Math.PI / 2
      const el = innerMap.get(sKey)
      if (!el) continue
      result.set(el.id, {
        x: oX + innerR * Math.cos(sAngle),
        y: oY + innerR * Math.sin(sAngle)
      })
    }
  }

  return result
}
