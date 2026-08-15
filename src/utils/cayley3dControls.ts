import type * as THREE from 'three'

// 3D 凯莱图视图的轨道控制注册桥：导出 GIF 时以固定角速度驱动相机旋转。
// Cayley3DView 挂载时注册（仅主视口 .canvas-viewport 内的实例），导出完成后恢复原视角。

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