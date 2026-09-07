import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { verifyHomomorphism } from '../../core/algebra/homomorphisms'
import { FirstIsomorphismAnimation } from './FirstIsomorphismAnimation'
import { HomomorphismScene } from './HomomorphismScene'

/** 主画布适配器：从全局 Provider 组装 HomomorphismScene 所需 props（保留原行为不变）。 */
export function HomomorphismView() {
  const {
    editingSource,
    editingTarget,
    editingMapping,
    activeHomomorphismId,
    homomorphisms,
    theoremMode,
    setTheoremMode,
  } = useGroup()

  const activeHomo = homomorphisms.find(h => h.id === activeHomomorphismId)

  const source = editingSource || activeHomo?.source || null
  const target = editingTarget || activeHomo?.target || null
  const mapping = activeHomo?.mapping || editingMapping

  const result = useMemo(() => {
    if (!source || !target || mapping.size === 0) return null
    return activeHomo?.result || verifyHomomorphism(source, target, mapping)
  }, [source, target, mapping, activeHomo])

  return (
    <HomomorphismScene
      source={source}
      target={target}
      mapping={mapping}
      result={result}
      name={activeHomo?.name}
      theoremMode={theoremMode}
      onTheoremModeChange={setTheoremMode}
      theoremAnimation={<FirstIsomorphismAnimation key={`${source?.symbol}-${target?.symbol}`} />}
    />
  )
}
