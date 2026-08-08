import { describe, it, expect } from 'vitest'
import { computeCayleyTree, computeFreeTree, computeFoldTree } from '../core/algebra/cayleyTree'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { buildGroupFromPresentation, parseRelationEquation } from '../core/algebra/presentations'

describe('computeCayleyTree', () => {
  it('⟨a | a³⟩ 退化树：直线 e-a-a⁻¹，a 的 a 边粘合回 a⁻¹', () => {
    const tree = computeCayleyTree(createCyclicGroup(3), 999)
    expect(tree.layout).toBe('line')
    expect(tree.isInfinite).toBe(false)
    expect(tree.nodes.map(n => n.label).sort()).toEqual(['a', 'a⁻¹', 'e'])
    const treeEdges = tree.edges.filter(e => e.isTree)
    const glueEdges = tree.edges.filter(e => !e.isTree)
    expect(treeEdges).toHaveLength(2)
    expect(glueEdges).toHaveLength(1)
    const e = tree.nodes.find(n => n.label === 'e')!
    const a = tree.nodes.find(n => n.label === 'a')!
    const ai = tree.nodes.find(n => n.label === 'a⁻¹')!
    expect([e.x, a.x, ai.x].sort((p, q) => p - q)).toEqual([-100, 0, 100])
    const glue = glueEdges[0]
    expect([tree.nodes[glue.from].label, tree.nodes[glue.to].label].sort()).toEqual(['a', 'a⁻¹'])
  })

  it('⟨a | a⁶⟩ maxDepth=1 截断 → 无限标记', () => {
    const tree = computeCayleyTree(createCyclicGroup(6), 1)
    expect(tree.isInfinite).toBe(true)
    expect(tree.nodes.length).toBe(3)
  })

  it('V₄ = ⟨a,b | a²,b²,abab⟩：交换格 → 正方形网格布局', () => {
    const res = buildGroupFromPresentation({ generators: ['a', 'b'], relators: ['a^2', 'b^2', 'abab'] })
    expect(res.ok).toBe(true)
    const tree = computeCayleyTree(res.group!, 999)
    expect(tree.layout).toBe('grid')
    expect(tree.isInfinite).toBe(false)
    expect(tree.nodes).toHaveLength(4)
    const labels = tree.nodes.map(n => n.label).sort()
    expect(labels).toEqual(['a', 'ab', 'b', 'e'])
    const gridPts = tree.nodes.map(n => [n.x, n.y])
    expect(gridPts).toContainEqual([0, 0])
    expect(gridPts).toContainEqual([100, 0])
    expect(gridPts).toContainEqual([0, 100])
    expect(gridPts).toContainEqual([100, 100])
    const treeEdges = tree.edges.filter(e => e.isTree)
    const glueEdges = tree.edges.filter(e => !e.isTree)
    expect(treeEdges).toHaveLength(3)
    expect(glueEdges.length).toBeGreaterThanOrEqual(1)
    expect(tree.edges).toHaveLength(4)
  })

  it('D₃ = ⟨a,b | a²,b²,(ab)³⟩：非交换 → 树形十字布局，6 节点 5 树边', () => {
    const res = buildGroupFromPresentation({ generators: ['a', 'b'], relators: ['a^2', 'b^2', '(ab)^3'] })
    expect(res.ok).toBe(true)
    const tree = computeCayleyTree(res.group!, 999)
    expect(tree.layout).toBe('tree')
    expect(tree.isInfinite).toBe(false)
    expect(tree.nodes).toHaveLength(6)
    expect(tree.edges.filter(e => e.isTree)).toHaveLength(5)
    expect(tree.edges.some(e => !e.isTree)).toBe(true)
  })

  it('D₃ 与标准 D₃ 群一致', () => {
    const res = buildGroupFromPresentation({ generators: ['a', 'b'], relators: ['a^2', 'b^2', '(ab)^3'] })
    const d3 = createDihedralGroup(3)
    expect(res.group!.order).toBe(d3.order)
    expect(res.group!.order).toBe(6)
  })

  it('⟨a,b | a²⟩ 类型的自由积不可构建（无限）', () => {
    const res = buildGroupFromPresentation({ generators: ['a', 'b'], relators: ['a^2'] })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('infinite')
  })
})

describe('parseRelationEquation', () => {
  const gens = ['a', 'b']

  it('接受 f=e 与 f1=f2', () => {
    expect(parseRelationEquation('a^3 = e', gens).ok).toBe(true)
    expect(parseRelationEquation('ab = ba', gens).ok).toBe(true)
    expect(parseRelationEquation('a^2 = b', gens).ok).toBe(true)
    expect(parseRelationEquation(' a^{-1}b = e ', gens).ok).toBe(true)
  })

  it('拒绝裸词（无 =）与非法格式', () => {
    expect(parseRelationEquation('a^3', gens).ok).toBe(false)
    expect(parseRelationEquation('ab ba', gens).ok).toBe(false)
    expect(parseRelationEquation('a = b = e', gens).ok).toBe(false)
    expect(parseRelationEquation('= e', gens).ok).toBe(false)
  })

  it('拒绝非生成元字符', () => {
    expect(parseRelationEquation('c = e', gens).ok).toBe(false)
    expect(parseRelationEquation('a = x', gens).ok).toBe(false)
    expect(parseRelationEquation('a+b = e', gens).ok).toBe(false)
  })

  it('归一化：去空格保留 = 形式', () => {
    const res = parseRelationEquation('  ab  =  ba  ', gens)
    expect(res.ok && res.relation).toBe('ab = ba')
  })
})

describe('computeFoldTree', () => {
  it('⟨a,b | a²⟩：a 结尾词折叠不生成（无 aa/baa 节点），a 系正次幂', () => {
    const tree = computeFoldTree(2, ['a^2 = e'], 3)
    expect(tree.isInfinite).toBe(true)
    const shown = tree.nodes.filter(n => n.rep === undefined).map(n => n.label)
    expect(shown.every(w => !w.includes('a⁻¹'))).toBe(true)
    expect(shown).not.toContain('aa')
    expect(shown).not.toContain('baa')
    expect(tree.edges.every(e => e.isTree)).toBe(true)
    expect(shown).toContain('e')
    expect(shown).toContain('a')
  })

  it('⟨a,b | ab=ba⟩：ba 折叠到 ab（等长取字典序小为标准形）', () => {
    const tree = computeFoldTree(2, ['ab = ba'], 3)
    const byLabel = new Map(tree.nodes.map((n, i) => [n.label, i]))
    const baIdx = byLabel.get('ba')
    if (baIdx !== undefined) {
      expect(tree.nodes[baIdx].rep).toBeDefined()
      expect(tree.nodes[tree.nodes[baIdx].rep!].label).toBe('ab')
    }
  })

  it('⟨a | a³⟩：显示仅 e, a, aa（正次幂、无 a⁻¹ 词、aaa 不生成）', () => {
    const tree = computeFoldTree(1, ['a^3 = e'], 6)
    const shown = tree.nodes.filter(n => n.rep === undefined).map(n => n.label)
    expect(shown.every(w => !w.includes('⁻¹'))).toBe(true)
    expect(shown).toHaveLength(3)
    expect(shown.sort()).toEqual(['a', 'aa', 'e'])
    expect(tree.edges.every(e => e.isTree)).toBe(true)
  })

  it('⟨a | a³⟩ 幂归一：逆词被规范化合并（显示 3 节点）', () => {
    const tree = computeFoldTree(1, ['a^3 = e'], 4)
    const shown = tree.nodes.filter(n => n.rep === undefined).map(n => n.label)
    expect(shown).toHaveLength(3)
  })
  it('⟨a,b | ab=ba⟩：交换群 → 正方形网格布局，节点指数坐标', () => {
    const tree = computeFoldTree(2, ['ab = ba'], 3)
    expect(tree.layout).toBe('grid')
    expect(tree.isInfinite).toBe(true)
    const shown = tree.nodes.filter(n => n.rep === undefined).map(n => n.label)
    expect(shown).toContain('e')
    expect(shown).toContain('a')
    expect(shown).toContain('b')
    const pts = tree.nodes.filter(n => n.rep === undefined).map(n => [n.x, n.y])
    const set = new Set(pts.map(p => `${p[0]},${p[1]}`))
    expect(set.has('0,0')).toBe(true)
    expect(set.has('100,0')).toBe(true)
    expect(set.has('0,100')).toBe(true)
    expect(set.has('100,100')).toBe(true)
    const eNode = tree.nodes.find(n => n.label === 'e')!
    const eIdx = tree.nodes.indexOf(eNode)
    const aDir = tree.nodes.filter((_, i) => tree.edges.some(ed => ed.from === eIdx && ed.to === i)).length
    expect(aDir).toBeGreaterThanOrEqual(2)
  })

  it('有限群精确折叠：⟨a,b|a³,b²,(ab)²⟩ ≅ S₃ → 6 个代表，无负次幂词', () => {
    const res = buildGroupFromPresentation({ generators: ['a', 'b'], relators: ['a^3', 'b^2', '(ab)^2'] })
    expect(res.ok).toBe(true)
    const tree = computeFoldTree(2, ['a^3 = e', 'b^2 = e', '(ab)^2 = e'], 6, res.group!)
    const shown = tree.nodes.filter(n => n.rep === undefined).map(n => n.label)
    expect(shown).toHaveLength(6)
    expect(shown.every(w => !w.includes('⁻¹'))).toBe(true)
    expect(shown).toContain('e')
    expect(shown).toContain('a')
    expect(shown).toContain('aa')
  })

  it('有限群精确折叠：⟨a|a³⟩ → e, a, aa（a⁻¹ 折叠到 aa，a⁻² 折叠到 a）', () => {
    const res = buildGroupFromPresentation({ generators: ['a'], relators: ['a^3'] })
    expect(res.ok).toBe(true)
    const tree = computeFoldTree(1, ['a^3 = e'], 5, res.group!)
    const shown = tree.nodes.filter(n => n.rep === undefined).map(n => n.label)
    expect(shown.sort()).toEqual(['a', 'aa', 'e'])
  })
})

describe('computeFreeTree', () => {
  it('2 生成元：D=4 → 161 节点 160 树边，十字布局', () => {
    const tree = computeFreeTree(2, 4)
    expect(tree.layout).toBe('tree')
    expect(tree.nodes).toHaveLength(161)
    expect(tree.edges).toHaveLength(160)
    expect(tree.isInfinite).toBe(true)
  })

  it('1 生成元：D=4 → 直线布局 9 节点', () => {
    const tree = computeFreeTree(1, 4)
    expect(tree.layout).toBe('line')
    expect(tree.nodes).toHaveLength(9)
    const xs = tree.nodes.map(n => n.x).sort((a, b) => a - b)
    expect(xs[0]).toBe(-400)
    expect(xs[xs.length - 1]).toBe(400)
  })

  it('3 生成元：D=3 → 3D 布局 187 节点', () => {
    const tree = computeFreeTree(3, 3)
    expect(tree.layout).toBe('tree3d')
    expect(tree.nodes).toHaveLength(187)
  })
})
