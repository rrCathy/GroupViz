import type { Group, GroupElement } from '../types'

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
  if (deduped.every(k => /^e\d+$/.test(k))) {
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
  if (deduped.every(k => /^e\d+$/.test(k))) {
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

export function parseProductFactors(group: Group): ProductFactors | null {
  const n = group.elements.length
  if (n === 0) return null

  const isPipeProduct = group.elements[0].id.includes('|')

  if (isPipeProduct) {
    const prefixSet = new Set<string>()
    const suffixSet = new Set<string>()
    for (const el of group.elements) {
      const pipeIdx = el.id.indexOf('|')
      if (pipeIdx === -1) continue
      prefixSet.add(el.id.substring(0, pipeIdx))
      suffixSet.add(el.id.substring(pipeIdx + 1))
    }
    const colKeys = ringOrder(Array.from(prefixSet))
    const rowKeys = ringOrder(Array.from(suffixSet))
    const colMap = new Map(colKeys.map((k, i) => [k, i]))
    const rowMap = new Map(rowKeys.map((k, i) => [k, i]))
    return {
      colSize: colKeys.length,
      rowSize: rowKeys.length,
      getCol: (el) => { const p = el.id.indexOf('|'); return colMap.get(el.id.substring(0, p)) ?? 0 },
      getRow: (el) => { const p = el.id.indexOf('|'); return rowMap.get(el.id.substring(p + 1)) ?? 0 }
    }
  }

  const vals = group.elements.map(el => el.value)
  const dim = vals[0]?.length || 0
  if (dim < 2) return null

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

export function nestedFactorLayout2D(
  group: Group,
  width: number,
  height: number
): Map<string, { x: number; y: number }> | null {
  if (group.elements.length === 0) return null
  if (!group.elements[0].id.includes('|')) return null

  const prefixGroups = new Map<string, GroupElement[]>()
  const suffixSet = new Set<string>()
  for (const el of group.elements) {
    const p = el.id.indexOf('|')
    if (p === -1) continue
    const pref = el.id.substring(0, p)
    const suf = el.id.substring(p + 1)
    if (!prefixGroups.has(pref)) prefixGroups.set(pref, [])
    prefixGroups.get(pref)!.push(el)
    suffixSet.add(suf)
  }

  const prefixKeys = cayleyRingKeys([...prefixGroups.keys()])
  const suffixKeys = cayleyRingKeys([...suffixSet])

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

    for (let ii = 0; ii < innerCount; ii++) {
      const sKey = suffixKeys[ii]
      const sAngle = (ii * 2 * Math.PI) / innerCount - Math.PI / 2
      result.set(`${pKey}|${sKey}`, {
        x: oX + innerR * Math.cos(sAngle),
        y: oY + innerR * Math.sin(sAngle)
      })
    }
  }

  return result
}
