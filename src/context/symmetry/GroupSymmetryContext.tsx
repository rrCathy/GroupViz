/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { useGroupCore } from '../core/GroupCoreContext'

interface GroupSymmetryState {
  symmetryShowAction: boolean
  symmetryRotateSpeed: number
  /** 对偶多面体形态：false=主形（cube/icosahedron），true=对偶形（octahedron/dodecahedron）；
   *  由主画布 ViewPanel 的 Shape 选项切换（对称性视图专用） */
  symmetryVariant: boolean
  /** 叠加模式演示：元素旋转左乘当前姿态持续合成（无回恒等阶段）；
   *  主画布入口限 A₄ / SL(2,3)（tetrahedron / binaryTetrahedron） */
  symmetryCompose: boolean
  /** 叠加模式应用信号：自增即把当前元素旋转左乘到当前姿态上（重复作用再合成） */
  symmetryApplyNonce: number
  /** 叠加模式复位信号：自增即动画回恒等（phase 'homing'） */
  symmetryResetNonce: number
  /** 最新落定姿态四元数 [x,y,z,w]（导出桥 getSymmetryPose 读取） */
  symmetryPose: [number, number, number, number]
  /** 2T 对称性视图累计皮带扭转 τ（弧度；Σ 2ψ，导出桥 getSymmetryBelt 读取）。
   *  q 与 −q 物体旋转相同、τ 不同——皮带是 SU(2) 记忆（双覆盖的可见载体） */
  symmetryBelt: number
  symmetryActionElementId: string | null
  selfInverseElementId: string | null
}

interface GroupSymmetryActions {
  setSymmetryShowAction: (show: boolean) => void
  setSymmetryRotateSpeed: (speed: number) => void
  setSymmetryVariant: (variant: boolean) => void
  setSymmetryCompose: (compose: boolean) => void
  bumpSymmetryApplyNonce: () => void
  bumpSymmetryResetNonce: () => void
  setSymmetryPose: (q: [number, number, number, number]) => void
  setSymmetryBelt: (tau: number) => void
  setSymmetryActionElementId: (id: string | null) => void
  setSelfInverseElementId: (id: string | null) => void
}

export type GroupSymmetryContextType = GroupSymmetryState & GroupSymmetryActions

const GroupSymmetryContext = createContext<GroupSymmetryContextType | null>(null)

export function GroupSymmetryProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { currentGroup, setHintMessage } = useGroupCore()

  const [symmetryShowAction, setSymmetryShowActionState] = useState(false)
  const [symmetryRotateSpeed, setSymmetryRotateSpeedState] = useState(1)
  const [symmetryVariant, setSymmetryVariantState] = useState(false)
  const [symmetryCompose, setSymmetryComposeState] = useState(false)
  const [symmetryApplyNonce, setSymmetryApplyNonce] = useState(0)
  const [symmetryResetNonce, setSymmetryResetNonce] = useState(0)
  const [symmetryPose, setSymmetryPoseState] = useState<[number, number, number, number]>([0, 0, 0, 1])
  const [symmetryBelt, setSymmetryBeltState] = useState(0)
  const [symmetryActionElementId, setSymmetryActionElementIdState] = useState<string | null>(null)
  const [selfInverseElementId, setSelfInverseElementIdState] = useState<string | null>(null)
  const prevGroupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (prevGroupRef.current === sym) return
    prevGroupRef.current = sym

    queueMicrotask(() => {
      setSelfInverseElementIdState(null)
      setSymmetryActionElementIdState(null)
      setSymmetryShowActionState(false)
      setSymmetryVariantState(false)
      setSymmetryComposeState(false)
      setSymmetryApplyNonce(0)
      setSymmetryResetNonce(0)
      setSymmetryPoseState([0, 0, 0, 1])
      setSymmetryBeltState(0)
    })
  }, [currentGroup])

  const setSymmetryShowAction = useCallback((show: boolean) => {
    setSymmetryShowActionState(show)
    if (!show) {
      setSymmetryActionElementIdState(null)
      setHintMessage(t('symmetry.demoOff'))
    } else {
      setHintMessage(t('symmetry.selectHint'))
    }
  }, [setHintMessage, t])

  const setSymmetryRotateSpeed = useCallback((speed: number) => {
    setSymmetryRotateSpeedState(speed)
  }, [])

  const setSymmetryVariant = useCallback((variant: boolean) => {
    setSymmetryVariantState(variant)
  }, [])

  const setSymmetryCompose = useCallback((compose: boolean) => {
    setSymmetryComposeState(compose)
  }, [])

  const bumpSymmetryApplyNonce = useCallback(() => {
    setSymmetryApplyNonce(n => n + 1)
  }, [])

  const bumpSymmetryResetNonce = useCallback(() => {
    setSymmetryResetNonce(n => n + 1)
  }, [])

  const setSymmetryPose = useCallback((q: [number, number, number, number]) => {
    setSymmetryPoseState(q)
  }, [])

  const setSymmetryBelt = useCallback((tau: number) => {
    setSymmetryBeltState(tau)
  }, [])

  const setSymmetryActionElementId = useCallback((id: string | null) => {
    setSymmetryActionElementIdState(id)
  }, [])

  const setSelfInverseElementId = useCallback((id: string | null) => {
    setSelfInverseElementIdState(id)
  }, [])

  const value: GroupSymmetryContextType = {
    symmetryShowAction, symmetryRotateSpeed, symmetryVariant, symmetryCompose,
    symmetryApplyNonce, symmetryResetNonce, symmetryPose, symmetryBelt,
    symmetryActionElementId, selfInverseElementId,
    setSymmetryShowAction, setSymmetryRotateSpeed, setSymmetryVariant, setSymmetryCompose,
    bumpSymmetryApplyNonce, bumpSymmetryResetNonce, setSymmetryPose, setSymmetryBelt,
    setSymmetryActionElementId, setSelfInverseElementId,
  }

  return (
    <GroupSymmetryContext.Provider value={value}>
      {children}
    </GroupSymmetryContext.Provider>
  )
}

export function useGroupSymmetry() {
  const context = useContext(GroupSymmetryContext)
  if (!context) {
    throw new Error('useGroupSymmetry must be used within GroupSymmetryProvider')
  }
  return context
}

export { GroupSymmetryContext }
