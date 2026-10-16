import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { cameraDir, dragRotate } from './cayley3dOrbit'
import { reportSymmetryCamera } from '../../utils/symmetryCameraState'

/**
 * 对称性视图相机轨道（四元数版，**无经纬极**）——2026-10-15 替换 drei OrbitControls。
 *
 * 为什么换（用户反馈「视角旋转有限制，不能越过南北极」）：OrbitControls 的球坐标
 * phi ∈ [0, π] 是硬钳，相机到达下极点就停住，继续竖直拖拽只会转方位角——永远
 * 翻不过去看皮带/四面体底面。本控制器姿态唯一真源 = 四元数（与 Cayley3DView 的
 * cayley3dOrbit 同一套数学）：
 * - 拖拽两个分量都取**相机局部系**（水平 = 屏幕上方轴、竖直 = 屏幕右方轴）⇒ 任何
 *   朝向（含上下颠倒）都跟手，且越过极点画面连续（没有 up 翻转特例）；
 * - 滚轮缩放 / 右键平移 / 双击复位；演示动画期间按 locked/rotateDisabled 门控
 *   （与旧 OrbitControls 的 enableRotate/enablePan/enableZoom 语义一致）。
 *
 * 不做惯性自旋：对称性视图旧配置就是 enableDamping={false}，保持直给手感，
 * 也避开「节流 + 松手提交丢最后一帧」的老坑。
 */

const DRAG_SENSITIVITY = 0.006
const MIN_RADIUS = 2.5
const MAX_RADIUS = 20
const ORIGIN = new THREE.Vector3()
const Y_UP = new THREE.Vector3(0, 1, 0)
/** 默认初始视角 = Canvas camera prop [0,4.5,15]（姿态在 ref 初值里就算好——
 *  不能等 effect：R3F 的相机 prop 在异步 configure 里应用，慢加载时首帧可能
 *  早于 init effect 跑，用恒等四元数把相机钉在赤道（实测偶发复现）。
 *  [0,4.5,15] 与旧 [0,3,10] **同向**（归一化都是 (0,0.287,0.958)），只是更远：
 *  容纳锚距 6.0 的长皮带（可见段 ≈3.7）与复原公转轨道） */
const INIT_DIR = new THREE.Vector3(0, 4.5, 15)
const INIT_QUAT = (() => {
  const m = new THREE.Matrix4().lookAt(INIT_DIR, ORIGIN, Y_UP)
  return new THREE.Quaternion().setFromRotationMatrix(m)
})()

const _camDir = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _dir = new THREE.Vector3()

export function SymmetryOrbitControls({ locked, rotateDisabled }: {
  /** 锁定全部交互（窗口 config.locked） */
  locked: boolean
  /** 演示动画期间禁用旋转/平移（showAction && lockCameraOnAction；缩放仍可用） */
  rotateDisabled: boolean
}) {
  const { gl, camera } = useThree()
  const orbit = useRef({ q: INIT_QUAT.clone(), radius: INIT_DIR.length(), target: new THREE.Vector3() })
  const initial = useRef({ q: INIT_QUAT.clone(), radius: INIT_DIR.length(), target: new THREE.Vector3() })

  // 初始姿态：相机已就位则从实际位置同步（宿主可传别的 camera prop）；未就位
  // （位置退化）则保留 ref 里的默认姿态——useFrame 会立刻把相机纠正过去
  useEffect(() => {
    const o = orbit.current
    _dir.copy(camera.position).sub(o.target)
    if (_dir.lengthSq() < 1e-6) return
    _m.lookAt(_dir, ORIGIN, Y_UP)
    o.q.setFromRotationMatrix(_m)
    o.radius = _dir.length()
    initial.current.q.copy(o.q)
    initial.current.radius = o.radius
    initial.current.target.copy(o.target)
  }, [camera])

  useEffect(() => {
    if (locked) return
    const el = gl.domElement
    const drag = { active: false, lastX: 0, lastY: 0, button: 0 }
    const onDown = (e: PointerEvent) => {
      drag.active = true
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      drag.button = e.button
      el.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!drag.active) return
      const dx = e.clientX - drag.lastX
      const dy = e.clientY - drag.lastY
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      const o = orbit.current
      if (drag.button === 2) {
        // 右键平移 target：沿相机局部 right/up 平面移动，尺度随 radius
        if (rotateDisabled) return
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1)
        o.target.addScaledVector(right, -dx * o.radius * 0.0012).addScaledVector(up, dy * o.radius * 0.0012)
      } else if (!rotateDisabled) {
        // 左键旋转：水平绕屏幕上方轴、竖直绕屏幕右方轴（都取相机局部系）⇒ 跟手且过极点连续
        dragRotate(o.q, dx, dy, DRAG_SENSITIVITY)
      }
    }
    const onUp = (e: PointerEvent) => {
      drag.active = false
      el.releasePointerCapture?.(e.pointerId)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const o = orbit.current
      o.radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, o.radius * Math.pow(0.95, -e.deltaY / 100)))
    }
    const onDblClick = () => {
      const o = orbit.current
      o.q.copy(initial.current.q)
      o.radius = initial.current.radius
      o.target.copy(initial.current.target)
    }
    const onContextMenu = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('dblclick', onDblClick)
    el.addEventListener('contextmenu', onContextMenu)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('dblclick', onDblClick)
      el.removeEventListener('contextmenu', onContextMenu)
    }
  }, [gl, camera, locked, rotateDisabled])

  useFrame(() => {
    const o = orbit.current
    camera.position.copy(o.target).addScaledVector(cameraDir(o.q, _camDir), o.radius)
    camera.quaternion.copy(o.q)
    // 上报供导出桥读取（e2e 断言越过极点：direction.y > 0 即相机位于目标下方）
    reportSymmetryCamera(
      camera.position.x, camera.position.y, camera.position.z,
      _camDir.x, _camDir.y, _camDir.z,
    )
  })

  return null
}
