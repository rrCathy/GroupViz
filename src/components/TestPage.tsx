/**
 * FGVE 双包消费测试页（/?test=1）——TestPage1 整页包消费化改写。
 *
 * 历史：本页曾是阶段 2 的「ViewWindow 参数 API 测试矩阵」（src Scene + 窗口壳，
 * 覆盖窗口参数/持久化/手势）。阶段 2 收官后该覆盖职责已由 ViewWindow 组件测试与
 * 主应用承担；阶段 3 视图全量入包（10/13，v1.26.0 批次十）后，页面改版为
 * **双包消费参数矩阵**：全部 Scene 直接吃 dist-pkg 产物（vite alias：
 * @groupviz/core → dist-pkg/@groupviz/core/index.js，@groupviz/react 同理），
 * 参数覆盖改为「按 Scene props 注入」，使日常打开 test=1 即对包做回归
 * （批次十已证明 src 绿 ≠ 包绿：core/index.ts 漏 export symmetryType 只在
 * 主应用 build 消费 dist-pkg 时才炸）。
 *
 * 改动包源码（src/core / src/components/Canvas Scene / src/package）后需先
 * `npm run build:pkg` 再刷新本页（dist-pkg 产物被 alias 直指）。
 *
 * 重内容（矩阵实现）在 TestPagePkgConsume 内，React.lazy 独立 chunk，
 * 不进主 App bundle（?test=1 之外不加载 three/R3F）。
 */
import { lazy, Suspense } from 'react'

const PkgMatrix = lazy(() => import('./TestPagePkgConsume'))

export default function TestPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, background: '#0f172a', minHeight: '100vh', color: '#94a3b8', fontFamily: 'monospace' }}>
          loading @groupviz/core + @groupviz/react 消费矩阵…
        </div>
      }
    >
      <PkgMatrix />
    </Suspense>
  )
}
