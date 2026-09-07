import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { computeQuotientGroup, findAllSubgroups } from '../core/algebra/subgroups'
import { projection3DLayout } from '../core/algebra/forceLayout'

describe('Quotient Group S4/V4 Layout', () => {
  it('should compute projection3D layout for quotient group', () => {
    const s4 = createSymmetricGroup(4)
    const subgroups = findAllSubgroups(s4!)
    const normal4 = subgroups.find(sg => sg.isNormal && sg.order === 4)
    expect(normal4).toBeDefined()

    const qg = computeQuotientGroup(s4!, normal4!)
    expect(qg).toBeDefined()

    const pos = projection3DLayout(qg!, 800, 560)

    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })
})
