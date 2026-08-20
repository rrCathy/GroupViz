/**
 * LR 平面性测试（de Fraysseix–Rosenstiehl 算法）TypeScript 移植。
 * 参考 networkx 的 lr_planarity（递归版）实现。
 * 输入：n 顶点、无向边列表（自动去自环/去重）。
 * 输出：平面性判定；若平面，同时给出每个顶点的顺时针（cw）邻居循环序
 * （组合嵌入），可进一步用于确定性 0 交叉球面布局。
 */

export interface PlanarityResult {
  planar: boolean
  /** 顶点 → cw 邻居循环序（任意起点）；非平面时为 null */
  embedding: Map<number, number[]> | null
}

interface Interval {
  low: number | null
  high: number | null
}

interface ConflictPair {
  left: Interval
  right: Interval
}

function intervalEmpty(iv: Interval): boolean {
  return iv.low === null && iv.high === null
}

function intervalCopy(iv: Interval): Interval {
  return { low: iv.low, high: iv.high }
}

function topOfStack(S: ConflictPair[]): ConflictPair | null {
  return S.length > 0 ? S[S.length - 1] : null
}

/**
 * 在顶点的 cw 循环序数组中插入/移动一条半边。
 * 数组 = cw 循环序（起点任意）。
 * cw=ref：新边插在 ref 之前（ref 的 ccw 侧）；ccw=ref：插在 ref 之后（ref 的 cw 侧）。
 * 对应 networkx add_half_edge：重复添加半边 = 先从旧位置移除再插入。
 */
function addHalfEdge(list: number[], end: number, cw: number | null, ccw: number | null): void {
  const existing = list.indexOf(end)
  if (existing >= 0) list.splice(existing, 1)
  if (list.length === 0) {
    list.push(end)
    return
  }
  if (cw !== null) {
    const i = list.indexOf(cw)
    if (i < 0) list.push(end)
    else list.splice(i, 0, end)
  } else {
    const i = ccw === null ? -1 : list.indexOf(ccw)
    if (i < 0) list.push(end)
    else list.splice(i + 1, 0, end)
  }
}

/** 新边成为顶点 cw 序的起点（networkx add_half_edge_first） */
function addHalfEdgeFirst(list: number[], end: number): void {
  const existing = list.indexOf(end)
  if (existing >= 0) list.splice(existing, 1)
  list.push(end)
}

class LRPlanarity {
  readonly n: number
  private adj: number[][]
  private roots: number[] = []
  private height: number[]
  private lowpt = new Map<number, number>()
  private lowpt2 = new Map<number, number>()
  private nestingDepth = new Map<number, number>()
  private parentEdge: (number | undefined)[]
  private outAdj: number[][]
  private orderedAdjs: number[][]
  private ref = new Map<number, number | null>()
  private side = new Map<number, number>()
  private S: ConflictPair[] = []
  private stackBottom = new Map<number, ConflictPair | null>()
  private lowptEdge = new Map<number, number>()
  private leftRef = new Map<number, number>()
  private rightRef = new Map<number, number>()
  private embed = new Map<number, number[]>()
  private edgeSet = new Set<number>()

  constructor(n: number, edges: Array<[number, number]>) {
    this.n = n
    this.height = new Array(n).fill(-1)
    this.parentEdge = new Array(n).fill(undefined)
    this.adj = Array.from({ length: n }, () => [])
    this.outAdj = Array.from({ length: n }, () => [])
    this.orderedAdjs = Array.from({ length: n }, () => [])
    for (const [u, v] of edges) {
      if (u === v || u < 0 || v < 0 || u >= n || v >= n) continue
      if (this.adj[u].includes(v)) continue
      this.adj[u].push(v)
      this.adj[v].push(u)
    }
  }

  private eid(u: number, v: number): number {
    return u * this.n + v
  }

  private lowptOf(e: number): number {
    return this.lowpt.get(e) ?? 0
  }

  private nestingOf(e: number): number {
    return this.nestingDepth.get(e) ?? 0
  }

  run(): Map<number, number[]> | null {
    const n = this.n
    let m = 0
    for (const list of this.adj) m += list.length
    m /= 2
    if (n > 2 && m > 3 * n - 6) return null

    for (let v = 0; v < n; v++) {
      if (this.height[v] === -1) {
        this.height[v] = 0
        this.roots.push(v)
        this.dfsOrientation(v)
      }
    }

    for (let v = 0; v < n; v++) {
      this.orderedAdjs[v] = this.sortByNesting(v)
    }

    for (const v of this.roots) {
      if (!this.dfsTesting(v)) return null
    }

    for (let u = 0; u < n; u++) {
      for (const w of this.outAdj[u]) {
        const ei = this.eid(u, w)
        this.nestingDepth.set(ei, this.sign(ei) * this.nestingOf(ei))
      }
    }

    for (let v = 0; v < n; v++) {
      this.orderedAdjs[v] = this.sortByNesting(v)
      this.embed.set(v, [])
      let prev: number | null = null
      for (const w of this.orderedAdjs[v]) {
        addHalfEdge(this.embed.get(v)!, w, null, prev)
        prev = w
      }
    }

    for (const v of this.roots) {
      this.dfsEmbedding(v)
    }

    return this.embed
  }

  private sortByNesting(v: number): number[] {
    return this.outAdj[v].slice().sort((a, b) => {
      return this.nestingOf(this.eid(v, a)) - this.nestingOf(this.eid(v, b))
    })
  }

  private dfsOrientation(v: number): void {
    const e = this.parentEdge[v]
    for (const w of this.adj[v]) {
      if (this.edgeSet.has(this.eid(v, w)) || this.edgeSet.has(this.eid(w, v))) continue
      const vw = this.eid(v, w)
      this.edgeSet.add(vw)
      this.outAdj[v].push(w)
      this.lowpt.set(vw, this.height[v])
      this.lowpt2.set(vw, this.height[v])
      if (this.height[w] === -1) {
        this.parentEdge[w] = vw
        this.height[w] = this.height[v] + 1
        this.dfsOrientation(w)
      } else {
        this.lowpt.set(vw, this.height[w])
      }
      let nd = 2 * this.lowptOf(vw)
      if ((this.lowpt2.get(vw) ?? 0) < this.height[v]) nd += 1
      this.nestingDepth.set(vw, nd)
      if (e !== undefined) {
        const le = this.lowptOf(e)
        const l2e = this.lowpt2.get(e) ?? 0
        const l = this.lowptOf(vw)
        const l2 = this.lowpt2.get(vw) ?? 0
        if (l < le) {
          this.lowpt2.set(e, Math.min(le, l2))
          this.lowpt.set(e, l)
        } else if (l > le) {
          this.lowpt2.set(e, Math.min(l2e, l))
        } else {
          this.lowpt2.set(e, Math.min(l2e, l2))
        }
      }
    }
  }

  private dfsTesting(v: number): boolean {
    const e = this.parentEdge[v]
    const order = this.orderedAdjs[v]
    for (let i = 0; i < order.length; i++) {
      const w = order[i]
      const ei = this.eid(v, w)
      this.stackBottom.set(ei, topOfStack(this.S))
      if (ei === this.parentEdge[w]) {
        if (!this.dfsTesting(w)) return false
      } else {
        this.lowptEdge.set(ei, ei)
        this.S.push({ left: { low: null, high: null }, right: { low: ei, high: ei } })
      }
      if (this.lowptOf(ei) < this.height[v]) {
        if (w === order[0]) {
          if (e !== undefined) this.lowptEdge.set(e, this.lowptEdge.get(ei) ?? ei)
        } else {
          if (e === undefined) return false
          if (!this.addConstraints(ei, e)) return false
        }
      }
    }
    if (e !== undefined) this.removeBackEdges(e)
    return true
  }

  private addConstraints(ei: number, e: number): boolean {
    const P: ConflictPair = { left: { low: null, high: null }, right: { low: null, high: null } }
    while (true) {
      const Q = this.S.pop()
      if (!Q) return false
      if (!intervalEmpty(Q.left)) this.swapPair(Q)
      if (!intervalEmpty(Q.left)) return false
      if (this.lowptOf(Q.right.low!) > this.lowptOf(e)) {
        if (intervalEmpty(P.right)) {
          P.right = intervalCopy(Q.right)
        } else {
          this.ref.set(P.right.low!, Q.right.high)
        }
        P.right.low = Q.right.low
      } else {
        this.ref.set(Q.right.low!, this.lowptEdge.get(e) ?? e)
      }
      if (topOfStack(this.S) === this.stackBottom.get(ei)) break
    }
    while (true) {
      const top = topOfStack(this.S)
      if (!top) break
      if (!(this.conflicts(top.left, ei) || this.conflicts(top.right, ei))) break
      const Q = this.S.pop()!
      if (this.conflicts(Q.right, ei)) this.swapPair(Q)
      if (this.conflicts(Q.right, ei)) return false
      if (P.right.low !== null) this.ref.set(P.right.low, Q.right.high)
      if (Q.right.low !== null) P.right.low = Q.right.low
      if (intervalEmpty(P.left)) {
        P.left = intervalCopy(Q.left)
      } else if (P.left.low !== null) {
        this.ref.set(P.left.low, Q.left.high)
      }
      P.left.low = Q.left.low
    }
    if (!(intervalEmpty(P.left) && intervalEmpty(P.right))) {
      this.S.push(P)
    }
    return true
  }

  private conflicts(iv: Interval, b: number): boolean {
    return !intervalEmpty(iv) && iv.high !== null && this.lowptOf(iv.high) > this.lowptOf(b)
  }

  private swapPair(P: ConflictPair): void {
    const t = P.left
    P.left = P.right
    P.right = t
  }

  private lowestOf(P: ConflictPair): number {
    if (intervalEmpty(P.left)) return this.lowptOf(P.right.low!)
    if (intervalEmpty(P.right)) return this.lowptOf(P.left.low!)
    return Math.min(this.lowptOf(P.left.low!), this.lowptOf(P.right.low!))
  }

  private removeBackEdges(e: number): void {
    const u = Math.floor(e / this.n)
    while (this.S.length > 0 && this.lowestOf(topOfStack(this.S)!) === this.height[u]) {
      const P = this.S.pop()!
      if (P.left.low !== null) this.side.set(P.left.low, -1)
    }
    if (this.S.length > 0) {
      const P = this.S.pop()!
      while (P.left.high !== null && P.left.high % this.n === u) {
        P.left.high = this.ref.get(P.left.high) ?? null
      }
      if (P.left.high === null && P.left.low !== null) {
        this.ref.set(P.left.low, P.right.low)
        this.side.set(P.left.low, -1)
        P.left.low = null
      }
      while (P.right.high !== null && P.right.high % this.n === u) {
        P.right.high = this.ref.get(P.right.high) ?? null
      }
      if (P.right.high === null && P.right.low !== null) {
        this.ref.set(P.right.low, P.left.low)
        this.side.set(P.right.low, -1)
        P.right.low = null
      }
      this.S.push(P)
    }
    if (this.lowptOf(e) < this.height[u]) {
      const top = topOfStack(this.S)
      if (top) {
        const hl = top.left.high
        const hr = top.right.high
        if (hl !== null && (hr === null || this.lowptOf(hl) > this.lowptOf(hr))) {
          this.ref.set(e, hl)
        } else {
          this.ref.set(e, hr)
        }
      }
    }
  }

  private sign(e: number): number {
    const r = this.ref.get(e) ?? null
    if (r !== null) {
      this.side.set(e, (this.side.get(e) ?? 1) * this.sign(r))
      this.ref.set(e, null)
    }
    return this.side.get(e) ?? 1
  }

  private dfsEmbedding(v: number): void {
    const order = this.orderedAdjs[v]
    for (const w of order) {
      const ei = this.eid(v, w)
      if (ei === this.parentEdge[w]) {
        addHalfEdgeFirst(this.embed.get(w)!, v)
        this.leftRef.set(v, w)
        this.rightRef.set(v, w)
        this.dfsEmbedding(w)
      } else {
        if ((this.side.get(ei) ?? 1) === 1) {
          const ref = this.rightRef.get(w) ?? null
          addHalfEdge(this.embed.get(w)!, v, null, ref)
        } else {
          const ref = this.leftRef.get(w) ?? null
          addHalfEdge(this.embed.get(w)!, v, ref, null)
          this.leftRef.set(w, v)
        }
      }
    }
  }
}

export function testGraphPlanarity(n: number, edges: Array<[number, number]>): PlanarityResult {
  if (n <= 0) return { planar: true, embedding: new Map() }
  const embedding = new LRPlanarity(n, edges).run()
  return embedding === null ? { planar: false, embedding: null } : { planar: true, embedding }
}
