import type { Group, GroupElement, Generator } from '../types'
import { COLOR_PALETTE } from '../types'
import type { ApiImportGroup } from '../../utils/api'
import { assignWordLabels, applyDihedralNormalForm } from './SmallGroups'

/**
 * 由 GAP 导入结果（乘法表 + 生成元位置 + 元素记号）构造 Group。
 * 后端 /api/compute/import-group 的响应即 ApiImportGroup。
 */
export function createGroupFromImport(imp: ApiImportGroup): Group {
  const n = imp.order
  const elements: GroupElement[] = []
  for (let k = 0; k < n; k++) {
    elements.push({
      id: `g${k}`,
      label: imp.idents[k] ?? `g_{${k}}`,
      value: [k],
    })
  }
  const table = imp.table

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    return elements[table[x.value[0]][y.value[0]] - 1]
  }

  function inv(el: GroupElement): GroupElement {
    const row = table[el.value[0]]
    for (let k = 0; k < n; k++) {
      if (row[k] === 1) return elements[k]
    }
    return elements[0]
  }

  let genEls = imp.gens.map((pos) => elements[pos - 1])
  if (genEls.length > 2) {
    const pair = findTwoGeneratorPair(elements, mul, elements[0].id)
    if (pair) genEls = [pair.a, pair.b]
  }
  const generators: Generator[] = genEls.map((genEl, idx) => {
    const name = String.fromCharCode(97 + idx)
    const gen: Generator = {
      name,
      symbol: name,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      apply: (el: GroupElement) => mul(el, genEl),
      inverse: null as unknown as Generator,
    }
    gen.inverse = {
      name: `${name}^{-1}`,
      symbol: `${name}^{-1}`,
      color: gen.color,
      apply: (el: GroupElement) => mul(el, inv(genEl)),
      inverse: gen,
    }
    return gen
  })

  assignWordLabels(elements, generators, mul, n)
  if (/^D\d+$/.test(imp.structure)) {
    applyDihedralNormalForm(elements, generators, mul, n)
  }

  let isAbelian = true
  outer: for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (table[i][j] !== table[j][i]) {
        isAbelian = false
        break outer
      }
    }
  }

  const symbol = imp.structure && imp.structure !== '?' ? imp.structure : `Import(${n})`

  return {
    name: symbol,
    symbol,
    order: n,
    elements,
    generators,
    multiply: mul,
    inverse: inv,
    identity: elements[0],
    isAbelian,
  }
}

function elementOrder(el: GroupElement, mul: (a: GroupElement, b: GroupElement) => GroupElement, identityId: string): number {
  let cur = el
  let k = 1
  while (cur.id !== identityId) {
    cur = mul(cur, el)
    k++
  }
  return k
}

function closureSize(
  a: GroupElement,
  b: GroupElement,
  mul: (a: GroupElement, b: GroupElement) => GroupElement,
): number {
  const seen = new Set<string>([a.id, b.id])
  const queue = [a, b]
  while (queue.length > 0) {
    const x = queue.pop()!
    for (const g of [a, b]) {
      const y = mul(x, g)
      if (!seen.has(y.id)) {
        seen.add(y.id)
        queue.push(y)
      }
    }
  }
  return seen.size
}

/**
 * 导入群生成元瘦身：当 GAP 给出 >2 个生成元（如 Q64 的 6 个）时，
 * 尝试找到 (a=最大阶元素, b) 二元生成对，使 ⟨a,b⟩ = G。
 * 失败（如 C2^k 需要更多生成元）返回 null，调用方保留原始生成元。
 */
export function findTwoGeneratorPair(
  elements: GroupElement[],
  mul: (a: GroupElement, b: GroupElement) => GroupElement,
  identityId: string,
): { a: GroupElement; b: GroupElement } | null {
  const n = elements.length
  if (n < 2) return null
  const orders = elements.map((el) => elementOrder(el, mul, identityId))
  const orderIdx = elements
    .map((_, i) => i)
    .sort((i, j) => orders[j] - orders[i] || i - j)
  const a = elements[orderIdx[0]]
  if (a.id === identityId) return null

  const powSet = new Set<string>()
  let cur = a
  do {
    powSet.add(cur.id)
    cur = mul(cur, a)
  } while (cur.id !== a.id)

  let tried = 0
  for (const i of orderIdx) {
    if (i === orderIdx[0]) continue
    const b = elements[i]
    if (b.id === identityId) continue
    if (powSet.has(b.id)) continue
    if (tried++ >= 200) break
    if (closureSize(a, b, mul) === n) return { a, b }
  }
  return null
}