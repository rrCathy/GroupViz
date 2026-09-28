import * as THREE from 'three'

/**
 * 3D 凯莱图相机轨道姿态（世界系四元数）——本文件是姿态运算的**唯一真源**。
 *
 * 设计要点（替换原 theta/phi 标量轨道）：
 * - 姿态只有一个真源 = 四元数（相机局部 → 世界）。滚转由旋转本身携带，**没有"极点翻转"特例**：
 *   越过上下极点时画面连续（原实现用 `up = sign(sinφ)`，极点附近画面会滚 180°）。
 * - 手动拖拽两个分量都在**相机局部系**里转（水平 = 屏幕上方轴、竖直 = 屏幕右方轴）⇒ 手势方向与相机
 *   当前姿态无关，任何朝向（含上下颠倒、滚转 90°）都"跟手"；旧实现水平分量钉在世界 Y 上，
 *   相机一翻转就左右反向。
 * - 松手（flick）时把释放瞬间的角速度**冻结成一根世界系固定轴**，此后恒速绕它旋转：
 *   单轴旋转 ⇒ 转轴不漂移、可见旋向不反转、整数圈后姿态精确复位（GIF 无缝回接）。
 *   原实现把 flick 拆成 thetȧ/φ̇ 两个恒定速率分别积分，二者合成不是单轴旋转——竖直分量让俯仰角
 *   无界漂移，相机反复翻过极点（实测：拖 (240,60) 后 6 秒内越过极点 3 次、可见旋向反转 2 次；
 *   对角拖拽 9 次 / 8 次），这正是"给了初速度却在来回转"的成因。
 */

const _dir = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _qa = new THREE.Quaternion()
const _qb = new THREE.Quaternion()
const ORIGIN = new THREE.Vector3(0, 0, 0)
const Y_UP = new THREE.Vector3(0, 1, 0)
const LOCAL_X = new THREE.Vector3(1, 0, 0)
const LOCAL_Y = new THREE.Vector3(0, 1, 0)

/** 未拖拽释放时的默认自旋轴：与旧实现 `theta -= angVel·dt`（绕世界竖轴）同向 */
export const DEFAULT_SPIN_AXIS = new THREE.Vector3(0, -1, 0)

/** 释放判定阈值：拖拽位移 < 8px 视为点击（不改惯性方向，与旧实现一致） */
export const FLICK_MIN_PIXELS = 8

/** 球坐标 (theta, phi) → 相机姿态；屏幕上方 = 世界 +Y 在视平面上的投影（与旧初始视角同族） */
export function quatFromOrbit(theta: number, phi: number, out = new THREE.Quaternion()): THREE.Quaternion {
  const sinP = Math.sin(phi)
  _dir.set(sinP * Math.sin(theta), Math.cos(phi), sinP * Math.cos(theta))
  _m.lookAt(_dir, ORIGIN, Y_UP)
  return out.setFromRotationMatrix(_m)
}

/** 姿态 → 球坐标（仅描述相机位置方向；滚转不可逆，供导出桥的旧字段兼容） */
export function orbitFromQuat(q: THREE.Quaternion): { theta: number; phi: number } {
  cameraDir(q, _dir)
  return {
    theta: Math.atan2(_dir.x, _dir.z),
    phi: Math.acos(Math.max(-1, Math.min(1, _dir.y))),
  }
}

/** 由目标指向相机的单位方向（相机局部 +Z 在世界系的像） */
export function cameraDir(q: THREE.Quaternion, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(0, 0, 1).applyQuaternion(q)
}

/** 相机右轴（相机局部 +X 在世界系的像 = 屏幕右方向） */
export function cameraRight(q: THREE.Quaternion, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(1, 0, 0).applyQuaternion(q)
}

/** 相机上轴（相机局部 +Y 在世界系的像 = 屏幕上方向） */
export function cameraUp(q: THREE.Quaternion, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(0, 1, 0).applyQuaternion(q)
}

/**
 * 拖拽增量 → 姿态：**两个分量都在相机局部系里转**——水平绕屏幕上方轴、竖直绕屏幕右方轴。
 *
 * 为什么必须用局部轴（2026-09-27 用户报「物体上下翻转后手势与运动完全反向」）：水平分量原先钉在
 * **世界 Y** 上，而世界 Y 在屏幕上的方向取决于相机姿态——相机一滚转/翻到下半球，手的左右就被映射成
 * 世界的反方向（滚转 90° 时甚至把"拖右"映射成竖直位移）。局部轴 ⇒ 手势与可见表面运动方向无关朝向恒定，
 * 即"一直跟手"。代价：水平拖拽绕屏幕竖轴而非世界竖轴，物体本身倾斜时地平线会随拖拽轻微摆动（整圈复位）。
 *
 * 与旧实现在**正立视角下的屏幕手感**一致（竖直分量仍与旧 φ 逐帧等价；水平分量屏幕位移同号、幅度差 ~8%）。
 */
export function dragRotate(
  q: THREE.Quaternion,
  dx: number,
  dy: number,
  sensitivity: number,
): THREE.Quaternion {
  if (dx) q.multiply(_qa.setFromAxisAngle(LOCAL_Y, -dx * sensitivity))
  if (dy) q.multiply(_qb.setFromAxisAngle(LOCAL_X, -dy * sensitivity))
  return q.normalize()
}

/**
 * 释放瞬间的固定自旋轴（世界系单位向量）= 释放瞬间相机角速度方向：水平分量 → 屏幕上方轴，
 * 竖直分量 → 屏幕右方轴（都由当时的姿态冻结成一根世界系固定轴，惯性延续手势方向且不反向）。
 * 位移 < FLICK_MIN_PIXELS 时回落默认轴（绕世界竖轴的自展示旋转），与旧实现的点击分支一致。
 */
export function flickAxis(
  q: THREE.Quaternion,
  dx: number,
  dy: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const len = Math.hypot(dx, dy)
  if (len < FLICK_MIN_PIXELS) return out.copy(DEFAULT_SPIN_AXIS)
  out.set(0, 0, 0)
    .addScaledVector(cameraUp(q, _up), -dx / len)
    .addScaledVector(cameraRight(q, _right), -dy / len)
  return out.lengthSq() < 1e-12 ? out.copy(DEFAULT_SPIN_AXIS) : out.normalize()
}

/** 绕世界系固定轴自旋 angle（世界系左乘 = 相对固定的轴旋转，就地修改并返回 q） */
export function spinWorld(q: THREE.Quaternion, axis: THREE.Vector3, angle: number): THREE.Quaternion {
  return q.premultiply(_qa.setFromAxisAngle(axis, angle)).normalize()
}
