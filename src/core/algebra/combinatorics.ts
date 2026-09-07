/**
 * 组合数取模原语（Wielandt Sylow 证明的计数段需要 C(n,k) mod p）。
 *
 * 用 Lucas 定理：C(n,k) mod p = ∏ C(n_i, k_i) mod p，其中 n_i、k_i 是
 * n、k 的 p 进制位。每个 C(n_i, k_i) 经模 p 阶乘/逆阶乘表计算（n_i < p，
 * 故 n_i! 与 p 互素，可用费马小定理求逆）。任一 k_i > n_i 时整体为 0。
 *
 * 约束：p 必须为素数（Lucas 定理前提）；n 可达 2000 量级，全程模 p 运算
 * 避免整数溢出。k < 0 或 k > n 时返回 0。
 */
export function binomialMod(n: number, k: number, p: number): number {
  if (n < 0 || k < 0 || k > n) return 0
  if (p <= 1) return 0

  // 阶乘/逆阶乘表上界：p 进制位取值 < p 且 ≤ n，故只需到 min(p-1, n)。
  const maxDigit = Math.min(p - 1, n)
  const fact = new Array<number>(maxDigit + 1)
  const invFact = new Array<number>(maxDigit + 1)
  fact[0] = 1
  for (let i = 1; i <= maxDigit; i++) fact[i] = (fact[i - 1] * i) % p
  invFact[maxDigit] = modPow(fact[maxDigit], p - 2, p)
  for (let i = maxDigit; i >= 1; i--) invFact[i - 1] = (invFact[i] * i) % p

  let result = 1
  let a = n
  let b = k
  while (a > 0 || b > 0) {
    const ai = a % p
    const bi = b % p
    if (bi > ai) return 0
    // C(ai, bi) mod p = fact[ai] * invFact[bi] * invFact[ai - bi] mod p
    result = (((result * fact[ai]) % p) * invFact[bi]) % p
    result = (result * invFact[ai - bi]) % p
    a = Math.floor(a / p)
    b = Math.floor(b / p)
  }
  return result
}

/** 模幂 base^exp mod m（平方求幂）。 */
function modPow(base: number, exp: number, mod: number): number {
  let result = 1
  base %= mod
  while (exp > 0) {
    if (exp % 2 === 1) result = (result * base) % mod
    base = (base * base) % mod
    exp = Math.floor(exp / 2)
  }
  return result
}
