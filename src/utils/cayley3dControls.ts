import type * as THREE from 'three'

// 3D 凯莱图视图的轨道控制注册桥：导出 GIF 时按「帧序号 × 帧延时」精确驱动相机旋转。
// Cayley3DView 挂载时注册（仅主视口 .canvas-viewport 内的实例），导出完成后恢复原视角。
// GIF 相机在独立离屏渲染器上工作：不触碰实时轨道/相机，导出期间展示区照常旋转。

export interface Cayley3DOrbitSnapshot {
  theta: number
  phi: number
  radius: number
  target: THREE.Vector3
}

export interface Cayley3DControlAPI {
  isReady: () => boolean
  snapshotOrbit: () => Cayley3DOrbitSnapshot
  beginRotation: (radPerSec: number) => void
  endRotation: (snapshot?: Cayley3DOrbitSnapshot | null) => void
  // 展示区当前的自动旋转角速度（与 ▶ 自动旋转/拖拽后同公式）：GIF 按此速度导出，
  // 保证导出动图与展示区转速一致（rad/s，与群阶数无关）
  displayAngVel: () => number
  // 导出第 index 帧：将离屏相机设到「基准角 + radPerSec × index × frameDelayMs」并渲染，
  // 返回渲染好的离屏 canvas（导出循环直接 drawImage 采集，不动实时画面）
  frameAt: (index: number, frameDelayMs: number) => HTMLCanvasElement | null
}

let registered: Cayley3DControlAPI | null = null

export function registerCayley3DControls(api: Cayley3DControlAPI) {
  registered = api
}

export function unregisterCayley3DControls(api: Cayley3DControlAPI) {
  if (registered === api) registered = null
}

export function getCayley3DControls(): Cayley3DControlAPI | null {
  return registered
}