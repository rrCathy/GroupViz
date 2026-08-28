import { z } from 'zod';

// GroupDescriptor v1 — 纯序列化协议，零 UI 依赖
export const GroupDescriptorSchemaV1 = z.object({
  schemaVersion: z.literal('1'),
  symbol: z.string(),
  name: z.string().optional(),
  order: z.number().int().positive(),
  elements: z.array(
    z.object({
      id: z.string(),
      label: z.string().optional(),
      order: z.number().int().positive().optional(),
    })
  ),
  multiply: z.array(z.array(z.number())), // 行序隐式索引乘法表 [row][col]=elementIndex
  properties: z.record(z.string(), z.unknown()).optional(),
  construction: z
    .object({ type: z.string(), params: z.record(z.string(), z.unknown()).optional() })
    .optional(),
  source: z.enum(['local', 'import', 'gap', 'product']).optional(),
});

export type GroupDescriptorV1 = z.infer<typeof GroupDescriptorSchemaV1>;

// 仍需由宿主提供 group 对象以执行序列化；核心仅提供协议
export function serializeDescriptor(group: {
  symbol: string;
  name?: string;
  order: number;
  elements: Array<{ id: string; label?: string; order?: number }>;
  multiplyTable?: number[][]; // 只有表群有完整乘法表
  properties?: Record<string, unknown>;
  construction?: { type: string; params?: Record<string, unknown> };
  source?: 'local' | 'import' | 'gap' | 'product';
}): GroupDescriptorV1 {
  const descriptor: GroupDescriptorV1 = {
    schemaVersion: '1',
    symbol: group.symbol,
    name: group.name,
    order: group.order,
    elements: group.elements.map((e) => ({
      id: e.id,
      label: e.label,
      order: e.order,
    })),
    multiply: group.multiplyTable ?? [],
    properties: group.properties,
    construction: group.construction,
    source: group.source ?? 'local',
  };
  const parsed = GroupDescriptorSchemaV1.parse(descriptor);
  return parsed;
}

export function deserializeDescriptor(
  raw: unknown
): GroupDescriptorV1 {
  return GroupDescriptorSchemaV1.parse(raw);
}

export function descriptorToSymbol(d: GroupDescriptorV1): string {
  return d.symbol;
}
