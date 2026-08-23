/**
 * 引擎错误模型（双轨制约定）：
 *
 * 1. Result<T, E> —— 可预期失败的首选通道。适用于「用户输入解析」「有限性/溢出
 *    守卫」这类调用方必须处理的常规分支。判别字段 ok；成功 {ok:true,value}，
 *    失败 {ok:false,error}。
 * 2. EngineError (throw) —— 不可预期/编程错误的异常通道。参数越界、数据表缺失、
 *    不变量被破坏等「不该发生」的情形仍用 throw，但统一抛 EngineError（kind 标注
 *    错误类别），便于上层按类型而非消息文本分流。EngineError 是 Error 子类，
 *    现有 catch / toThrow 断言行为不变。
 * 3. null 回退 —— 布局层等性能敏感路径保留返回 null 表示「未放置，调用方兜底」
 *    的既有约定（见 algebra/layouts/shared.ts 头注释），不强行 Result 化。
 */

export type EngineErrorKind = 'parse' | 'guard' | 'unsupported'

/** guard 类错误的细分原因：容量溢出 / 判定无限 / 计算超时。 */
export type EngineGuardReason = 'overflow' | 'infinite' | 'timeout'

export class EngineError extends Error {
  readonly kind: EngineErrorKind
  readonly reason?: EngineGuardReason

  constructor(kind: EngineErrorKind, message: string, reason?: EngineGuardReason) {
    super(message)
    this.name = 'EngineError'
    this.kind = kind
    if (reason !== undefined) this.reason = reason
  }
}

export function parseError(message: string): EngineError {
  return new EngineError('parse', message)
}

export function guardError(message: string, reason?: EngineGuardReason): EngineError {
  return new EngineError('guard', message, reason)
}

export function unsupportedError(message: string): EngineError {
  return new EngineError('unsupported', message)
}

export type Result<T, E = EngineError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
