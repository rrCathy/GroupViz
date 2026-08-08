import type { Group, GroupElement } from '../types'
import { parseWord } from './presentations'

export type TreeLayoutKind = 'line' | 'grid' | 'tree' | 'tree3d'

export interface CayleyTreeNode {
  id: string
  label: string
  depth: number
  x: number
  y: number
  z: number
  dir: number
  parent: number
  rep?: number
}

export interface CayleyTreeEdge {
  from: number
  to: number
  d: number
  isTree: boolean
}

export interface CayleyTree {
  nodes: CayleyTreeNode[]
  edges: CayleyTreeEdge[]
  layout: TreeLayoutKind
  genCount: number
  isInfinite: boolean
}

const GEN_NAMES = ['a', 'b', 'c']
const STEP_BASE = 100

/** 层距衰减：默认 0.5 逐层减半（Sierpinski 十字免交叉）；折叠树仅当路径状（最大子节点 ≤ 2）时用 0.7 提升细节可见性，稠密折叠树保持 0.5 防交叉；90° 方向不变 */
function stepForDepth(depth: number, ratio = 0.5): number {
  return Math.pow(ratio, depth - 1) * STEP_BASE
}

function dirLabel(gen: number, negative: boolean): string {
  return negative ? `${GEN_NAMES[gen]}⁻¹` : GEN_NAMES[gen]
}

function indexSum(word: string, gen: number, negChar: string): number {
  let sum = 0
  let i = 0
  const pos = GEN_NAMES[gen]
  while (i < word.length) {
    if (word.startsWith(negChar, i)) {
      sum -= 1
      i += negChar.length
    } else if (word.startsWith(pos, i)) {
      sum += 1
      i += pos.length
    } else {
      i++
    }
  }
  return sum
}

function isGridCompatible(words: string[]): boolean {
  for (const w of words) {
    let sawB = false
    for (const ch of w) {
      if (ch === 'b' || ch === 'b⁻¹') sawB = true
      else if (sawB) return false
    }
  }
  return true
}

const DIR2D = [
  { dx: 1, dy: 0, dz: 0 },
  { dx: -1, dy: 0, dz: 0 },
  { dx: 0, dy: -1, dz: 0 },
  { dx: 0, dy: 1, dz: 0 },
]

const DIR3D = [
  { dx: 1, dy: 0, dz: 0 },
  { dx: -1, dy: 0, dz: 0 },
  { dx: 0, dy: 1, dz: 0 },
  { dx: 0, dy: -1, dz: 0 },
  { dx: 0, dy: 0, dz: 1 },
  { dx: 0, dy: 0, dz: -1 },
]

/**
 * 计算商群凯莱图的 BFS 生成树（退化树）：
 * - 树边（实线）：每个元素首次到达的边
 * - 粘合边（虚线）：指向已访问元素的边（"被砍掉的延申"）
 * - 布局：1 生成元直线（不衰减）；2 生成元交换格（词全部形如 a* b*）→ 正方形网格（不衰减）；
 *   其余 → 树形十字（层距逐层减半防遮挡）；3 生成元 → 3D 立方体方向
 */
export function computeCayleyTree(group: Group, maxDepth: number): CayleyTree {
  const m = group.generators.length
  const genEls = group.generators.map(g => g.apply(group.identity))
  const dirEls: GroupElement[] = []
  const dirLabels: string[] = []
  for (let i = 0; i < m; i++) {
    dirEls.push(genEls[i])
    dirLabels.push(GEN_NAMES[i])
    dirEls.push(group.inverse(genEls[i]))
    dirLabels.push(dirLabel(i, true))
  }
  const dirCount = 2 * m

  const nodes: CayleyTreeNode[] = [
    { id: group.identity.id, label: 'e', depth: 0, x: 0, y: 0, z: 0, dir: -1, parent: -1 },
  ]
  const idxById = new Map<string, number>([[group.identity.id, 0]])
  const edges: CayleyTreeEdge[] = []
  const edgePairs = new Set<string>()
  const elemIdx = new Map<string, number>(group.elements.map((el, i) => [el.id, i]))

  let head = 0
  while (head < nodes.length) {
    const u = nodes[head]
    head++
    if (u.depth >= maxDepth) continue
    const uEl = group.elements[elemIdx.get(u.id) ?? 0]
    for (let d = 0; d < dirCount; d++) {
      const v = group.multiply(uEl, dirEls[d])
      const vi = idxById.get(v.id)
      if (vi === undefined) {
        const ni = nodes.length
        nodes.push({
          id: v.id,
          label: u.label === 'e' ? dirLabels[d] : u.label + dirLabels[d],
          depth: u.depth + 1,
          x: 0,
          y: 0,
          z: 0,
          dir: d,
          parent: head - 1,
        })
        idxById.set(v.id, ni)
        edges.push({ from: head - 1, to: ni, d, isTree: true })
        edgePairs.add(`${Math.min(head - 1, ni)},${Math.max(head - 1, ni)}`)
      } else if (vi !== head - 1) {
        const pairKey = `${Math.min(head - 1, vi)},${Math.max(head - 1, vi)}`
        if (!edgePairs.has(pairKey)) {
          edges.push({ from: head - 1, to: vi, d, isTree: false })
          edgePairs.add(pairKey)
        }
      }
    }
  }

  const complete = nodes.length >= group.elements.length

  let layout: TreeLayoutKind = 'tree'
  if (m === 1) layout = 'line'
  else if (m === 2 && isGridCompatible(nodes.map(n => n.label))) layout = 'grid'
  else if (m >= 3) layout = 'tree3d'

  if (layout === 'line' || layout === 'grid') {
    for (const n of nodes) {
      n.x = indexSum(n.label, 0, 'a⁻¹') * STEP_BASE
      n.y = layout === 'grid' ? indexSum(n.label, 1, 'b⁻¹') * STEP_BASE : 0
    }
  } else {
    const dirs = layout === 'tree' ? DIR2D : DIR3D
    for (const n of nodes) {
      if (n.depth === 0) continue
      const dir = dirs[n.dir]
      const step = stepForDepth(n.depth)
      const p = nodes[n.parent]
      n.x = p.x + dir.dx * step
      n.y = p.y + dir.dy * step
      n.z = p.z + dir.dz * step
    }
  }

  return { nodes, edges, layout, genCount: m, isInfinite: !complete }
}

/**
 * 自由模板树（无群时的无限树预览）：纯词 BFS，按最大深度截断。
 * 1 生成元 → 直线；2 生成元 → 谢尔宾斯基十字（层距减半）；3 生成元 → 3D 立方体方向。
 */
export function computeFreeTree(genCount: number, maxDepth: number): CayleyTree {
  const dirLabels: string[] = []
  for (let i = 0; i < genCount; i++) {
    dirLabels.push(GEN_NAMES[i])
    dirLabels.push(dirLabel(i, true))
  }
  const dirCount = 2 * genCount
  const dirs = genCount <= 2 ? DIR2D : DIR3D

  const nodes: CayleyTreeNode[] = [
    { id: 'e', label: 'e', depth: 0, x: 0, y: 0, z: 0, dir: -1, parent: -1 },
  ]
  const edges: CayleyTreeEdge[] = []
  const visited = new Set<string>(['0,0,0'])
  let head = 0
  while (head < nodes.length) {
    const u = nodes[head]
    head++
    if (u.depth >= maxDepth) continue
    for (let d = 0; d < dirCount; d++) {
      if (u.dir !== -1 && d === (u.dir % 2 === 0 ? u.dir + 1 : u.dir - 1)) continue
      const step = stepForDepth(u.depth + 1)
      const x = u.x + dirs[d].dx * step
      const y = u.y + dirs[d].dy * step
      const z = u.z + dirs[d].dz * step
      const key = `${x},${y},${z}`
      if (visited.has(key)) continue
      visited.add(key)
      const ni = nodes.length
      nodes.push({
        id: `w${ni}`,
        label: u.label === 'e' ? dirLabels[d] : u.label + dirLabels[d],
        depth: u.depth + 1,
        x,
        y,
        z,
        dir: d,
        parent: head - 1,
      })
      edges.push({ from: head - 1, to: ni, d, isTree: true })
    }
  }

  const layout: TreeLayoutKind = genCount === 1 ? 'line' : genCount === 3 ? 'tree3d' : 'tree'
  if (layout === 'line') {
    for (const n of nodes) {
      n.x = indexSum(n.label, 0, 'a⁻¹') * STEP_BASE
      n.y = 0
      n.z = 0
    }
  }
  return { nodes, edges, layout, genCount, isInfinite: true }
}

/** 展示文本（parseWord 格式）转字符序列词（树词格式），'e' → '' */
export function wordToSeq(text: string, genNames: string[]): string {
  const trimmed = text.trim()
  if (trimmed === 'e' || trimmed === '') return ''
  const terms = parseWord(trimmed, genNames)
  let out = ''
  for (const t of terms) {
    const sym = genNames[t.g] ?? 'a'
    const neg = `${sym}⁻¹`
    for (let k = 0; k < Math.abs(t.e); k++) out += t.e > 0 ? sym : neg
  }
  return out
}

function freeReduce(w: string, genNames: string[]): string {
  const tokens: string[] = []
  let i = 0
  while (i < w.length) {
    let found = false
    for (const g of genNames) {
      if (w.startsWith(`${g}⁻¹`, i)) {
        tokens.push(`${g}⁻¹`)
        i += g.length + 2
        found = true
        break
      }
      if (w.startsWith(g, i)) {
        tokens.push(g)
        i += g.length
        found = true
        break
      }
    }
    if (!found) i++
  }
  const stack: string[] = []
  for (const t of tokens) {
    const inv = t.endsWith('⁻¹') ? t.slice(0, -2) : `${t}⁻¹`
    if (stack.length > 0 && stack[stack.length - 1] === inv) stack.pop()
    else stack.push(t)
  }
  return stack.join('')
}

function invertSeq(w: string, genNames: string[]): string {
  let out = ''
  let i = w.length - 1
  while (i >= 0) {
    const ch = w[i]
    if (ch === '¹') {
      const sym = w[i - 2]
      if (sym !== undefined) out += sym
      i -= 3
    } else {
      out += ch + '⁻¹'
      i -= 1
    }
  }
  void genNames
  return out
}

function isCommuteRel(lhs: string, rhs: string, genNames: string[]): boolean {
  if (lhs === 'e' || rhs === 'e') return false
  const toks = (w: string): string[] => {
    const out: string[] = []
    let i = 0
    while (i < w.length) {
      let found = false
      for (const g of genNames) {
        if (w.startsWith(`${g}⁻¹`, i)) { out.push(`${g}⁻¹`); i += g.length + 2; found = true; break }
        if (w.startsWith(g, i)) { out.push(g); i += g.length; found = true; break }
      }
      if (!found) i++
    }
    return out
  }
  const a = toks(wordToSeq(lhs, genNames))
  const b = toks(wordToSeq(rhs, genNames))
  if (a.length !== b.length || a.length === 0) return false
  for (let k = 0; k < a.length - 1; k++) {
    const swapped = [...a]
    ;[swapped[k], swapped[k + 1]] = [swapped[k + 1], swapped[k]]
    if (swapped.join('') === b.join('')) return true
  }
  return false
}

function parsePower(w: string, genNames: string[]): { g: number; k: number } | null {
  let g = -1
  let exp = 0
  let i = 0
  while (i < w.length) {
    let cur = -1
    let neg = false
    for (let gi = 0; gi < genNames.length; gi++) {
      if (w.startsWith(`${genNames[gi]}⁻¹`, i)) { cur = gi; neg = true; break }
      if (w.startsWith(genNames[gi], i)) { cur = gi; break }
    }
    if (cur < 0) return null
    if (g === -1) g = cur
    else if (cur !== g) return null
    exp += neg ? -1 : 1
    i += neg ? genNames[g].length + 2 : genNames[g].length
  }
  if (g < 0) return null
  return { g, k: Math.abs(exp) }
}

/** 幂块归一：连续同生成元块按幂关系 mod 并转正次幂（a³=e → 'a⁻¹' → 'aa'、'aaa' → ''） */
function normalizePositivePowers(w: string, powerRel: number[], genNames: string[]): string {
  if (powerRel.length === 0) return w
  let out = ''
  let i = 0
  while (i < w.length) {
    let g = -1
    let neg = false
    for (let gi = 0; gi < genNames.length; gi++) {
      if (w.startsWith(`${genNames[gi]}⁻¹`, i)) { g = gi; neg = true; break }
      if (w.startsWith(genNames[gi], i)) { g = gi; break }
    }
    if (g < 0) { i++; continue }
    const symLen = neg ? genNames[g].length + 2 : genNames[g].length
    let exp = neg ? -1 : 1
    i += symLen
    while (i < w.length) {
      let nNeg = false
      let nG = -1
      for (let gi = 0; gi < genNames.length; gi++) {
        if (w.startsWith(`${genNames[gi]}⁻¹`, i)) { nG = gi; nNeg = true; break }
        if (w.startsWith(genNames[gi], i)) { nG = gi; break }
      }
      if (nG !== g) break
      exp += nNeg ? -1 : 1
      i += nNeg ? genNames[g].length + 2 : genNames[g].length
    }
    const n = powerRel[g]
    if (n && n > 0) {
      const r = ((exp % n) + n) % n
      if (r !== 0) out += genNames[g].repeat(r)
    } else {
      out += (neg || exp < 0) ? `${genNames[g]}⁻¹`.repeat(Math.abs(exp)) : genNames[g].repeat(exp)
    }
  }
  return out
}

/**
 * 词级折叠：在截断自由树上按关系做等价类折叠。
 * - group 可构建（有限群）→ 词沿生成元累积乘映射到元素，等价类精确；
 *   代表 = 正次幂优先（无 ⁻¹）→ 词最短 → BFS 先
 * - 否则 → 重写系统化简（幂块归一 + 子串规则，教学近似）
 * 折叠节点 rep 指向树内代表节点；边 (u, w) 若 rep(w)≠w 则断头（不画）。
 */
export function computeFoldTree(genCount: number, relatorTexts: string[], maxDepth: number, group?: Group | null, genElsOverride?: GroupElement[]): CayleyTree {
  const base = computeFreeTree(genCount, maxDepth)
  const genNames = GEN_NAMES.slice(0, genCount)

  const idxByLabel = new Map<string, number>()
  base.nodes.forEach((n, i) => idxByLabel.set(n.label, i))

  if (group) {
    const genEls = genElsOverride && genElsOverride.length >= genCount
      ? genElsOverride.slice(0, genCount)
      : group.generators.map(g => g.apply(group.identity))
    const idToIdx = new Map(group.elements.map((el, i) => [el.id, i]))
    const best: (number | undefined)[] = []
    const wordToElem = (label: string): number => {
      if (label === 'e') return idToIdx.get(group.identity.id) ?? 0
      let cur = group.identity
      let i = 0
      while (i < label.length) {
        let g = -1
        let neg = false
        for (let gi = 0; gi < genCount; gi++) {
          if (label.startsWith(`${genNames[gi]}⁻¹`, i)) { g = gi; neg = true; break }
          if (label.startsWith(genNames[gi], i)) { g = gi; break }
        }
        if (g < 0) { i++; continue }
        const el = neg ? group.inverse(genEls[g]) : genEls[g]
        if (!el) return idToIdx.get(group.identity.id) ?? 0
        cur = group.multiply(cur, el)
        i += neg ? genNames[g].length + 2 : genNames[g].length
      }
      return idToIdx.get(cur.id) ?? 0
    }
    for (const n of base.nodes) {
      const idx = wordToElem(n.label)
      const hasInv = n.label.includes('⁻¹')
      const cur = best[idx]
      if (cur === undefined) {
        best[idx] = idxByLabel.get(n.label)
      } else {
        const cNode = base.nodes[cur]
        const better = (!hasInv && cNode.label.includes('⁻¹')) || (hasInv === cNode.label.includes('⁻¹') && n.label.length < cNode.label.length)
        if (better) best[idx] = idxByLabel.get(n.label)
      }
    }
    const repIdx = new Map<number, number>()
    best.forEach((v, idx) => { if (v !== undefined) repIdx.set(idx, v) })
    for (const n of base.nodes) {
      const idx = wordToElem(n.label)
      const rep = repIdx.get(idx)
      if (rep !== undefined && rep !== idxByLabel.get(n.label)) n.rep = rep
    }
  } else {
    const rules: [string, string][] = []
  const powerRel: number[] = []
  let commutative = false
  const addRule = (from: string, to: string) => {
    if (from.length === 0 || from === to) return
    rules.push([from, to])
  }
  for (const rt of relatorTexts) {
    const parts = rt.split('=')
    const lhs = (parts[0] ?? '').trim()
    const rhs = (parts[1] ?? '').trim()
    if (!lhs || !rhs) continue
    if (lhs === 'e') {
      const f = wordToSeq(rhs, genNames)
      addRule(f, '')
      addRule(invertSeq(f, genNames), '')
      const pm = parsePower(f, genNames)
      if (pm) powerRel[pm.g] = Math.max(powerRel[pm.g] ?? 0, pm.k)
    } else if (rhs === 'e') {
      const f = wordToSeq(lhs, genNames)
      addRule(f, '')
      addRule(invertSeq(f, genNames), '')
      const pm = parsePower(f, genNames)
      if (pm) powerRel[pm.g] = Math.max(powerRel[pm.g] ?? 0, pm.k)
    } else {
      if (isCommuteRel(lhs, rhs, genNames)) commutative = true
      const a = wordToSeq(lhs, genNames)
      const b = wordToSeq(rhs, genNames)
      if (a.length === b.length) {
        addRule(a > b ? a : b, a > b ? b : a)
      } else {
        addRule(a.length >= b.length ? a : b, a.length >= b.length ? b : a)
      }
      const ai = invertSeq(a, genNames)
      const bi = invertSeq(b, genNames)
      if (ai.length === bi.length) {
        addRule(ai > bi ? ai : bi, ai > bi ? bi : ai)
      } else {
        addRule(ai.length >= bi.length ? ai : bi, ai.length >= bi.length ? bi : ai)
      }
    }
  }

    const reduceWord = (w: string): string => {
      let cur = w
      for (let iter = 0; iter < 200; iter++) {
        let changed = false
        for (const [from, to] of rules) {
          if (from.length === 0) continue
          const idx = cur.indexOf(from)
          if (idx >= 0) {
            cur = cur.slice(0, idx) + to + cur.slice(idx + from.length)
            changed = true
          }
        }
        const freed = freeReduce(cur, genNames)
        if (freed !== cur) {
          cur = freed
          changed = true
        }
        const normed = normalizePositivePowers(cur, powerRel, genNames)
        if (normed !== cur) {
          cur = normed
          changed = true
        }
        if (!changed) break
      }
      return cur
    }

    // BFS 规范化生成：同一规范化词（商群元素）只生成一次，深度变化只扩展不跳变
    const dirLabels2: string[] = []
    for (let i = 0; i < genCount; i++) {
      dirLabels2.push(GEN_NAMES[i])
      dirLabels2.push(`${GEN_NAMES[i]}⁻¹`)
    }
    const dirCount = 2 * genCount
    const fNodes: CayleyTreeNode[] = [{ id: 'e', label: 'e', depth: 0, x: 0, y: 0, z: 0, dir: -1, parent: -1 }]
    const fEdges: CayleyTreeEdge[] = []
    // 交换折叠键：指数按幂关系取模（a²=e → 指数 mod 2；b³=e → 指数 mod 3），
    // 使 aa/aaa、bbb/bbbb 等折叠到同一网格点，避免幂关系下出现无限网格
    const idxKeyOf = (label: string): string =>
      genNames
        .map((g, gi) => {
          const n = indexSum(label, gi, `${g}⁻¹`)
          const m = powerRel[gi]
          return m ? ((n % m) + m) % m : n
        })
        .join(',')
    const seenNorm = new Map<string, number>([['e', 0], [idxKeyOf('e'), 0]])
    let head = 0
    while (head < fNodes.length) {
      const u = fNodes[head]
      head++
      if (u.depth >= maxDepth) continue
      for (let d = 0; d < dirCount; d++) {
        if (u.dir !== -1 && d === (u.dir % 2 === 0 ? u.dir + 1 : u.dir - 1)) continue
        const w = u.label === 'e' ? dirLabels2[d] : u.label + dirLabels2[d]
        if (commutative) {
          const key = idxKeyOf(w)
          if (key === idxKeyOf(u.label)) continue
          if (seenNorm.has(key)) continue
          const ni = fNodes.length
          fNodes.push({ id: `w${ni}`, label: w, depth: u.depth + 1, x: 0, y: 0, z: 0, dir: d, parent: head - 1 })
          seenNorm.set(key, ni)
          fEdges.push({ from: head - 1, to: ni, d, isTree: true })
        } else {
          const key = reduceWord(w) === '' ? 'e' : reduceWord(w)
          if (key === u.label) continue
          if (seenNorm.has(key)) continue
          const ni = fNodes.length
          fNodes.push({ id: `w${ni}`, label: key, depth: u.depth + 1, x: 0, y: 0, z: 0, dir: d, parent: head - 1 })
          seenNorm.set(key, ni)
          fEdges.push({ from: head - 1, to: ni, d, isTree: true })
        }
      }
    }
    if (commutative && genCount === 2) {
      // 交换群：完整网格（每个节点画全部生成元边）
      base.layout = 'grid'
      const ufNodes = [...fNodes]
      for (const u of ufNodes) {
        for (let d = 0; d < dirCount; d++) {
          if (u.dir !== -1 && d === (u.dir % 2 === 0 ? u.dir + 1 : u.dir - 1)) continue
          const w = u.label === 'e' ? dirLabels2[d] : u.label + dirLabels2[d]
          const key = idxKeyOf(w)
          if (key === idxKeyOf(u.label)) continue
          const target = seenNorm.get(key)
          if (target === undefined) continue
          const uIdx = fNodes.indexOf(u)
          fEdges.push({ from: uIdx, to: target, d, isTree: true })
        }
      }
    }
    base.nodes = fNodes
    base.edges = fEdges
    base.isInfinite = true
    if (base.layout === 'line') {
      for (const n of base.nodes) {
        n.x = indexSum(n.label, 0, 'a⁻¹') * STEP_BASE
        n.y = 0
        n.z = 0
      }
    } else if (base.layout === 'grid') {
      for (const n of base.nodes) {
        n.x = indexSum(n.label, 0, 'a⁻¹') * STEP_BASE
        n.y = indexSum(n.label, 1, 'b⁻¹') * STEP_BASE
        n.z = 0
      }
    } else if (base.layout === 'tree' || base.layout === 'tree3d') {
      // 路径状折叠树（最大子节点 ≤ 2，如 a²,b² 之字）用 0.7 衰减保证细节可见；稠密树（如 a² 单关系）必须 0.5 防交叉
      const childCount = new Array<number>(fNodes.length).fill(0)
      for (const e of fEdges) childCount[e.from]++
      const ratio = Math.max(...childCount, 0) <= 2 ? 0.7 : 0.5
      const dirs2 = base.layout === 'tree' ? DIR2D : DIR3D
      for (const n of base.nodes) {
        if (n.label === 'e') {
          n.x = 0
          n.y = 0
          n.z = 0
          continue
        }
        let x = 0
        let y = 0
        let z = 0
        let i = 0
        let k = 0
        while (i < n.label.length) {
          let g = -1
          let neg = false
          for (let gi = 0; gi < genCount; gi++) {
            if (n.label.startsWith(`${genNames[gi]}⁻¹`, i)) { g = gi; neg = true; break }
            if (n.label.startsWith(genNames[gi], i)) { g = gi; break }
          }
          if (g < 0) { i++; continue }
          const d = g * 2 + (neg ? 1 : 0)
          const step = stepForDepth(k + 1, ratio)
          x += dirs2[d].dx * step
          y += dirs2[d].dy * step
          z += dirs2[d].dz * step
          i += neg ? genNames[g].length + 2 : genNames[g].length
          k++
        }
        n.x = x
        n.y = y
        n.z = z
      }
    }
  }

  for (const e of base.edges) {
    const to = base.nodes[e.to]
    if (to.rep !== undefined) e.isTree = false
  }

  return base
}
