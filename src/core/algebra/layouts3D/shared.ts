export type Vec3 = [number, number, number]

export function fibonacciSphere(n: number, radius: number): Vec3[] {
  const points: Vec3[] = []
  if (n === 0) return points
  if (n === 1) {
    points.push([0, 0, 0])
    return points
  }
  const phi = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const radiusAtY = Math.sqrt(1 - y * y)
    const theta = phi * i
    points.push([
      Math.cos(theta) * radiusAtY * radius,
      y * radius,
      Math.sin(theta) * radiusAtY * radius
    ])
  }
  return points
}
