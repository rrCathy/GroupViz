import { z } from 'zod';

/**
 * Decorations v1 —— 可序列化、与具体 Scene 无关的装饰协议（VCL 规划 §4.4）。
 *
 * 定位：视图渲染层只读 `viewParams + decorations`；本文件属**纯协议**（零 React、
 * 零 DOM），落 `core` 以便随包分发并被 `FigurePreset` 复用。
 *
 * 锚点一律是**相对位置**（用户 2026-09-24 定）：
 * - `node`   —— 相对某个群元素节点；渲染端取该节点的**实时**坐标 ⇒ 拖拽 / 力导向重排都跟随。
 * - `edge`   —— 相对某条作用边（`ref` 起点元素 + `actionRef` 作用元素共同定位）；渲染端取两端中点。
 * - `figure` —— 相对整个图案（视图坐标系）；缩放平移跟着图走，不与任何元素绑定。
 * - `inset` / `callout` —— **预留**（v1 不实现、渲染端不消费），避免将来 schema 破坏性升级。
 *
 * 元素引用（`ref` / `actionRef`）统一走 `core/algebra/elementRef.ts` 的 `resolveElement`
 * 解析（接受 `id` / `label` / `value` / 循环记号），**禁止自造解析**——Sₙ 的元素 id 含逗号
 * （如 `2,1,3,4`），用 `[\s,]+` 分词会把引用拆碎（`pathHighlight` 曾因此解析出 0 条边）。
 */

/** v1 实现的锚点类型 */
export const DECORATION_ANCHOR_TYPES = ['node', 'edge', 'figure'] as const;
/** v1 预留（schema 接受、渲染端忽略） */
export const DECORATION_ANCHOR_TYPES_RESERVED = ['inset', 'callout'] as const;

export type DecorationAnchorType = (typeof DECORATION_ANCHOR_TYPES)[number];

export const decorationAnchorSchema = z.object({
  type: z.enum([...DECORATION_ANCHOR_TYPES, ...DECORATION_ANCHOR_TYPES_RESERVED]),
  /** `node` / `edge`：元素引用；`figure`：忽略 */
  ref: z.string().optional(),
  /** 仅 `edge`：该边对应的作用元素引用 */
  actionRef: z.string().optional(),
  /** 文本相对锚点的位置偏移（视图坐标 px）；缺省由渲染端给自动位置 */
  offset: z.object({ dx: z.number(), dy: z.number() }).optional(),
});

export const annotationSchema = z.object({
  /** 稳定 id（新增时由调用方生成；用于 React key 与删除） */
  id: z.string(),
  anchor: decorationAnchorSchema,
  /** TeX 源文本；渲染走 `texify → renderTex`（与节点标签同一条路） */
  text: z.string(),
  /** 从锚点画引导线到文本；缺省 false */
  leader: z.boolean().optional(),
  /** 文本颜色；缺省跟随主题 */
  color: z.string().optional(),
});

export const decorationsSchemaV1 = z.object({
  schemaVersion: z.literal('1'),
  annotations: z.array(annotationSchema),
  /**
   * **预留**：多路径高亮（VCL 规划 §4.3）。
   * 单路径需求已由 `CayleyViewParams.pathHighlight` / `Cayley3DViewParams.pathHighlight`
   * 承担（共用 `core.resolveCayleyPath`），v1 不在此实现，避免两份真源。
   */
  paths: z.array(z.unknown()).optional(),
});

export type DecorationAnchor = z.infer<typeof decorationAnchorSchema>;
export type Annotation = z.infer<typeof annotationSchema>;
export type Decorations = z.infer<typeof decorationsSchemaV1>;

/** 空装饰集（新建窗口 / 换群重置用；不含未定义字段，序列化后即合法 v1） */
export function emptyDecorations(): Decorations {
  return { schemaVersion: '1', annotations: [] };
}

/**
 * 归一化 + 校验为合法 `Decorations`（写入端用）。
 * 缺省 `schemaVersion` 补 `'1'`、缺省 `annotations` 补 `[]`；非法 input 抛 zod 错误。
 */
export function serializeDecorations(
  input?: { schemaVersion?: '1'; annotations?: Annotation[]; paths?: unknown[] } | null
): Decorations {
  return decorationsSchemaV1.parse({
    schemaVersion: input?.schemaVersion ?? '1',
    annotations: input?.annotations ?? [],
    paths: input?.paths,
  });
}

/** 反序列化（读入端用：localStorage / 预设 JSON）；幂等。 */
export function deserializeDecorations(raw: unknown): Decorations {
  return decorationsSchemaV1.parse(raw);
}

/** 宽松读取：坏数据不抛错，退化到空集（localStorage 容错口径，同 `storage.test.ts` 既有做法） */
export function readDecorations(raw: unknown): Decorations {
  const res = decorationsSchemaV1.safeParse(raw);
  return res.success ? res.data : emptyDecorations();
}

/** 纯函数：追加一条注释（返回新对象，不改原值） */
export function addAnnotation(d: Decorations, annotation: Annotation): Decorations {
  return serializeDecorations({ annotations: [...d.annotations, annotation], paths: d.paths });
}

/** 纯函数：按 id 删除（不存在的 id 原样返回） */
export function removeAnnotation(d: Decorations, id: string): Decorations {
  return serializeDecorations({
    annotations: d.annotations.filter((a) => a.id !== id),
    paths: d.paths,
  });
}

/** 纯函数：按 id 替换（不存在则追加）——编辑已有注释用 */
export function upsertAnnotation(d: Decorations, annotation: Annotation): Decorations {
  const idx = d.annotations.findIndex((a) => a.id === annotation.id);
  const next = idx >= 0
    ? d.annotations.map((a) => (a.id === annotation.id ? annotation : a))
    : [...d.annotations, annotation];
  return serializeDecorations({ annotations: next, paths: d.paths });
}

/** 渲染 key / 去重用的锚点指纹（与坐标无关，只描述"贴在谁身上"） */
export function annotationAnchorKey(anchor: DecorationAnchor): string {
  const { type, ref, actionRef } = anchor;
  if (type === 'figure') return 'figure';
  return actionRef ? `${type}:${ref ?? ''}@${actionRef}` : `${type}:${ref ?? ''}`;
}

// ── 锚点 → 坐标（纯函数，渲染端共用；避免 2D/3D 各写一份） ──

export interface AnchorPoint {
  x: number;
  y: number;
}

/** 渲染端交出的查询能力：元素引用解析、实时节点坐标、边的对端查找 */
export interface AnchorLookup {
  /** 元素引用（id/label/value/循环记号）→ 元素 id；未命中返回 null */
  resolveId?: (ref: string) => string | null;
  /** 元素 id → 该节点**当前**坐标（力导向重排 / 拖拽后即最新值） */
  positions: ReadonlyMap<string, AnchorPoint>;
  /** 给定（起点 id, 作用元素 id）返回对端 id；缺省时退化为"取起点坐标" */
  neighborOf?: (fromId: string, actionId: string) => string | null;
  /** `figure` 锚点的原点（视图坐标）；缺省 `{x: 24, y: 24}` */
  figureOrigin?: AnchorPoint;
  /** 文本相对锚点的缺省偏移（节点 / 边各一套） */
  nodeOffset?: { dx: number; dy: number };
  edgeOffset?: { dx: number; dy: number };
}

const DEFAULT_FIGURE_ORIGIN: AnchorPoint = { x: 24, y: 24 };
const DEFAULT_NODE_OFFSET = { dx: 0, dy: -22 };
const DEFAULT_EDGE_OFFSET = { dx: 0, dy: -14 };

/**
 * 解析注释文本应落的位置（视图坐标，未施加画布变换）。
 *
 * 解析不出来一律返回 `null`（引用失效 / 元素已不在群内 / 边不存在），由渲染端跳过该条，
 * **不抛错**——与 `resolveCayleyPath` 的容错口径一致（换群、群被替换时注释自然消失）。
 */
export function resolveAnnotationAnchor(
  anchor: DecorationAnchor,
  lookup: AnchorLookup
): AnchorPoint | null {
  const { offset } = anchor;

  if (anchor.type === 'figure' || anchor.type === 'inset' || anchor.type === 'callout') {
    const origin = lookup.figureOrigin ?? DEFAULT_FIGURE_ORIGIN;
    return { x: origin.x + (offset?.dx ?? 0), y: origin.y + (offset?.dy ?? 0) };
  }

  if (!anchor.ref) return null;
  const refId = lookup.resolveId ? lookup.resolveId(anchor.ref) : anchor.ref;
  if (!refId) return null;
  const base = lookup.positions.get(refId);
  if (!base) return null;

  if (anchor.type === 'node') {
    const d = lookup.nodeOffset ?? DEFAULT_NODE_OFFSET;
    return { x: base.x + d.dx + (offset?.dx ?? 0), y: base.y + d.dy + (offset?.dy ?? 0) };
  }

  // edge：取两端中点（对端找不到时退回起点）
  let other = base;
  if (anchor.actionRef && lookup.neighborOf) {
    const actionId = lookup.resolveId ? lookup.resolveId(anchor.actionRef) : anchor.actionRef;
    const otherId = actionId ? lookup.neighborOf(refId, actionId) : null;
    other = (otherId && lookup.positions.get(otherId)) || base;
  }
  const d = lookup.edgeOffset ?? DEFAULT_EDGE_OFFSET;
  return {
    x: (base.x + other.x) / 2 + d.dx + (offset?.dx ?? 0),
    y: (base.y + other.y) / 2 + d.dy + (offset?.dy ?? 0),
  };
}
