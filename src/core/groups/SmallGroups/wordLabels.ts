import type { GroupElement, Generator } from '../../types'

// 词项（{g, e} 生成元序号/幂）→ TeX 标签：与展示群的 wordToCanonicalString 同约定
// （a^2 / a^{10} / a b），幂按相邻同生成元合并（BFS 词可能含 a·a 这样的相邻项）。
function wordToLabel(terms: { g: number; e: number }[], genNames: string[]): string {
  const out: { g: number; e: number }[] = []
  for (const t of terms) {
    const last = out[out.length - 1]
    if (last && last.g === t.g) {
      last.e += t.e
      if (last.e === 0) out.pop()
    } else {
      out.push({ g: t.g, e: t.e })
    }
  }
  return out
    .map(t => {
      const sym = genNames[t.g] ?? `g${t.g}`
      if (t.e === 1) return sym
      if (t.e >= 2 && t.e < 10) return `${sym}^${t.e}`
      return `${sym}^{${t.e}}`
    })
    .join(' ')
}

// 生成元词标签：从单位元沿生成元做 BFS，给每个元素一个最短生成元词作为标签
// （单位元 = 'e'），使元素标签与生成元名字一一对应（a、b、a^2、a b …），
// 替换原先无意义的 g_0..g_{n-1}，也让 HomomorphismView/SemidirectProductView 等
// 按 label 查找生成元元素的逻辑对表驱动群生效。
export function assignWordLabels(
  elements: GroupElement[],
  generators: Generator[],
  mul: (x: GroupElement, y: GroupElement) => GroupElement,
  n: number
): void {
  const id = elements[0]
  id.label = 'e'
  if (generators.length === 0) return
  const genEls = generators.map(g => g.apply(id))
  const genNames = generators.map(g => g.name)
  const words = new Map<string, { g: number; e: number }[]>()
  words.set(id.id, [])
  const queue: GroupElement[] = [id]
  let head = 0
  while (head < queue.length && words.size < n) {
    const cur = queue[head++]
    const curWord = words.get(cur.id)!
    for (let gi = 0; gi < genEls.length; gi++) {
      const next = mul(cur, genEls[gi])
      if (words.has(next.id)) continue
      const nextWord = [...curWord, { g: gi, e: 1 }]
      words.set(next.id, nextWord)
      next.label = wordToLabel(nextWord, genNames)
      queue.push(next)
    }
  }
}

// 二面体群的规范词形：旋转 = a^i（按离散对数），反射 = a^i b。
// BFS 最短词对旋转元素可能给出 b a b 这类混合词（数学正确但不符合
// 《群论彩图版》的 r^i / r^i s 约定），此处按标准生成元 (a=r, b=s) 重写。
export function applyDihedralNormalForm(
  elements: GroupElement[],
  generators: Generator[],
  mul: (x: GroupElement, y: GroupElement) => GroupElement,
  n: number
): void {
  if (generators.length < 2) return
  const m = n / 2
  const r = generators[0].apply(elements[0])
  const s = generators[1].apply(elements[0])
  const log = new Map<string, number>()
  let cur = elements[0]
  for (let i = 0; i < m; i++) {
    log.set(cur.id, i)
    cur = mul(cur, r)
  }
  if (log.size !== m) return
  const powLabel = (i: number): string => {
    if (i === 0) return 'e'
    if (i === 1) return 'a'
    return i < 10 ? `a^${i}` : `a^{${i}}`
  }
  for (const el of elements) {
    const i = log.get(el.id)
    if (i !== undefined) {
      el.label = powLabel(i)
    } else {
      const j = log.get(mul(el, s).id)
      if (j !== undefined) el.label = j === 0 ? 'b' : `${powLabel(j)} b`
    }
  }
}
