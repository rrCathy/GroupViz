import { describe, it, expect } from 'vitest';
import {
  serializeDescriptor,
  deserializeDescriptor,
  descriptorToSymbol,
} from '../../core/descriptor';

describe('GroupDescriptor v1 protocol', () => {
  const mockGroup = {
    symbol: 'S_3',
    name: 'Symmetric group S3',
    order: 6,
    elements: [
      { id: 'e', label: 'e', order: 1 },
      { id: 'a', label: 'a', order: 2 },
      { id: 'b', label: 'b', order: 3 },
      { id: 'c', label: 'c', order: 2 },
      { id: 'd', label: 'd', order: 3 },
      { id: 'f', label: 'f', order: 2 },
    ],
    multiplyTable: [
      [0, 1, 2, 3, 4, 5],
      [1, 0, 3, 4, 5, 2],
      [2, 5, 0, 1, 3, 4],
      [3, 2, 5, 0, 1, 4],
      [4, 3, 1, 2, 5, 0],
      [5, 4, 2, 3, 0, 1],
    ],
    properties: { isAbelian: false, isSimple: false },
    construction: { type: 'symmetric', params: { n: 3 } },
    source: 'local' as const,
  };

  it('serializes a minimal group to GroupDescriptor v1', () => {
    const d = serializeDescriptor(mockGroup);
    expect(d.schemaVersion).toBe('1');
    expect(d.symbol).toBe('S_3');
    expect(d.order).toBe(6);
    expect(d.elements.length).toBe(6);
    expect(d.source).toBe('local');
  });

  it('deserializes and validates with zod', () => {
    const d = serializeDescriptor(mockGroup);
    const parsed = deserializeDescriptor(d);
    expect(parsed.schemaVersion).toBe('1');
    expect(parsed.multiply[0][0]).toBe(0);
  });

  it('rejects invalid descriptor (missing schemaVersion)', () => {
    expect(() => deserializeDescriptor({ symbol: 'X' })).toThrow();
  });

  it('descriptorToSymbol returns symbol', () => {
    const d = serializeDescriptor(mockGroup);
    expect(descriptorToSymbol(d)).toBe('S_3');
  });

  it('round-trip identity for basic fields', () => {
    const d1 = serializeDescriptor(mockGroup);
    const d2 = deserializeDescriptor(d1);
    expect(d2.symbol).toBe(d1.symbol);
    expect(d2.order).toBe(d1.order);
    expect(d2.elements).toEqual(d1.elements);
  });
});
