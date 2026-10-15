/**
 * 对称性视图相机姿态的模块级上报（供导出桥 `getSymmetryCamera()` 读取）。
 *
 * 存在理由：e2e 需要硬断言「拖拽能越过南北极」——旧实现用 drei OrbitControls，
 * 其 phi ∈ [0, π] 硬钳让相机停在南极点（用户反馈「视角旋转有限制，不能越过
 * 南北极」，2026-10-15）。现改用四元数轨道（cayley3dOrbit 同款）后无此钳。
 * 桥本身就是模块级单例（utils/exportApi.ts），此处同款模式，不引入 React state
 * 抖动（每帧上报只写两个数组）。
 */

// 默认值 = Canvas 初始相机 [0,3,10] 看向原位的真实方向（Scene 首帧上报前的占位）
const L0 = Math.sqrt(3 ** 2 + 10 ** 2)
let posX = 0, posY = 3, posZ = 10
let dirX = 0, dirY = 3 / L0, dirZ = 10 / L0

/** 相机位置 + 朝向（由目标指向相机的单位方向）上报 */
export function reportSymmetryCamera(
  px: number, py: number, pz: number,
  dx: number, dy: number, dz: number,
): void {
  posX = px; posY = py; posZ = pz
  dirX = dx; dirY = dy; dirZ = dz
}

/** 读最新上报（Scene 未挂载前为默认初始视角 [0,3,10] 看向原点） */
export function readSymmetryCamera(): {
  position: [number, number, number]
  direction: [number, number, number]
} {
  return {
    position: [posX, posY, posZ],
    direction: [dirX, dirY, dirZ],
  }
}
