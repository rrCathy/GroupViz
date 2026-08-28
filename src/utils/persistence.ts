import { z } from 'zod'

/**
 * localStorage 持久化统一入口（D 阶段加固）。
 *
 * 约定：
 * - 读取永远经过 zod schema 校验，损坏/伪造/过期数据一律返回 null（或调用方
 *   提供的兜底），绝不抛异常、绝不让脏数据进入状态层；
 * - 写入失败（隐私模式/配额）静默吞掉，返回 false 供需要处感知；
 * - 版本化条目用 { __gvVersion, data } 信封存储；读取同时接受旧版裸数据
 *   （legacy 直接过 schema），保证既有存量会话平滑迁移。
 */

/** 当前版本化信封格式版本。 */
export const STORAGE_FORMAT_VERSION = 1

/**
 * 解析并校验一段 JSON 字符串；任何失败（语法错误/类型不符）返回 null，
 * 不抛异常。适合直接包裹历史遗留的裸 JSON.parse 调用点。
 */
export function parseStoredJson<T>(raw: string, schema: z.ZodType<T>): T | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const res = schema.safeParse(parsed)
  return res.success ? res.data : null
}

/** 读取 key 并校验；key 不存在或数据损坏返回 null。 */
export function loadStoredJson<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return parseStoredJson(raw, schema)
  } catch {
    return null
  }
}

/**
 * 读取数组型条目，逐元素校验：合法元素保留、非法元素静默丢弃。
 * 这是列表类持久化的历史语义（旧实现逐条手写校验、坏条目跳过）——
 * 整体拒绝会让单条脏数据拖垮全部存量，故列表场景一律用本函数。
 */
export function loadStoredArray<T>(key: string, entrySchema: z.ZodType<T>): T[] {
  const raw = loadStoredJson(key, z.array(z.unknown()))
  if (!raw) return []
  const out: T[] = []
  for (const item of raw) {
    const r = entrySchema.safeParse(item)
    if (r.success) out.push(r.data)
  }
  return out
}

/** 写入 JSON；失败（配额/隐私模式）返回 false。 */
export function saveStoredJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStoredKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch { /* ignore */ }
}

export function removeAllStoredKeys(prefix: string): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) doomed.push(k)
    }
    doomed.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

interface VersionedEnvelope {
  __gvVersion: number
}

const ENVELOPE_SCHEMA = z.object({ __gvVersion: z.number() }).passthrough()

export interface LoadVersionedOptions<T> {
  /** 信封版本 → 当前数据的迁移钩子；未提供时旧版本直接拒绝（返回 null）。 */
  migrate?: (data: unknown, fromVersion: number) => T | null
}

/**
 * 读取版本化条目：接受 { __gvVersion, data } 信封或旧版裸数据。
 * - 信封版本 == 当前版本 → 校验 data 后返回；
 * - 旧版本 → 交给 migrate（未提供则视为损坏）；
 * - 裸数据 → 直接按 schema 校验（存量兼容）。
 */
export function loadVersionedJson<T>(key: string, schema: z.ZodType<T>, opts?: LoadVersionedOptions<T>): T | null {
  const loaded = loadStoredJson(key, z.union([ENVELOPE_SCHEMA, schema]))
  if (loaded === null) return null
  if (loaded !== null && typeof loaded === 'object' && '__gvVersion' in (loaded as object)) {
    const env = loaded as VersionedEnvelope & Record<string, unknown>
    if (env.__gvVersion === STORAGE_FORMAT_VERSION) {
      const res = schema.safeParse(env.data)
      return res.success ? res.data : null
    }
    if (opts?.migrate) return opts.migrate(env.data, env.__gvVersion)
    return null
  }
  // legacy raw value — already validated by the union above
  return loaded as T
}

/** 写入版本化信封。 */
export function saveVersionedJson<T>(key: string, data: T): boolean {
  return saveStoredJson(key, { __gvVersion: STORAGE_FORMAT_VERSION, data })
}
