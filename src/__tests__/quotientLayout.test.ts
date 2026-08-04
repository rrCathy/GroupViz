import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { computeQuotientGroup, findAllSubgroups } from '../core/algebra/subgroups'
import { projection3DLayout } from '../core/algebra/forceLayout'
import { getDefaultShape2D, getDefaultLayout3D } from '../core/types'

describe('Quotient Group S4/V4 Layout Debug', () => {
  it('should compute projection3D layout for quotient group', () => {
    const s4 = createSymmetricGroup(4)
    const subgroups = findAllSubgroups(s4!)
    const normal4 = subgroups.find(sg => sg.isNormal && sg.order === 4)
    expect(normal4).toBeDefined()

    const qg = computeQuotientGroup(s4!, normal4!)
    expect(qg).toBeDefined()
    
    console.log('Symbol:', qg!.symbol)
    console.log('Order:', qg!.order)
    console.log('Elements:', qg!.elements.map(e => e.id))
    console.log('Default 2D shape:', getDefaultShape2D(qg!))
    console.log('Default 3D layout:', getDefaultLayout3D(qg!))

    const pos = projection3DLayout(qg!, 800, 560)
    console.log('projection3DLayout size:', pos?.size ?? 'null')
    
    if (pos) {
      for (const [id, p] of pos) {
        console.log(id, '->', p)
      }
    }
    
    expect(pos).not.toBeNull()
    expect(pos!.size).toBe(6)
  })
})
