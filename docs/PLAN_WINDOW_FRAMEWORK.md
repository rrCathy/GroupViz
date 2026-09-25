# 视图窗口框架（Window Framework）—— 融合方案

> 所属文档集：GroupViz 开发文档。入口见 [AGENTS.md](../AGENTS.md)。
> 制定：2026-09-24。状态：**方案待批（未动工）**。
> 起因（用户 2026-09-24 原话）：「真得把主画布里的悬浮多窗和 FGVE 里的窗口处理一下了，要么切割，要么融合，**我倾向于融合**，弄一个通用框架，这样两边都能调用。」
> **文档分工**：本文只讲现状事实、目标形态、语义取舍与施工分刀；已完成历史一律查 [CHANGELOG.md](CHANGELOG.md)。

---

## 1. 现状：三套壳并存（2026-09-24 侦察，带证据）

| | **老式壳** `FloatingViewWindow` | **FGVE 受控内核** `ViewWindow` | **包消费端壳** `SceneWindow` |
|---|---|---|---|
| 文件 | `floatingView/FloatingViewWindow.tsx`(229) + `lazyViews.tsx`(500) | `ViewWindow.tsx`(446) + `ViewContent.tsx`(334) + `ViewParamsPanel.tsx`(1165) + 7 hook | `Canvas/SceneWindow.tsx`(≈470) |
| 宿主 | 主应用 `Workspace.tsx:284-291`（由 `ViewPanel` 的「多视图模式」开窗） | `TestPage2.tsx`（`?test=2`，7 处）+ 9 个面板组件测试 | `AutomorphismPreviewPopup.tsx:47` + 包冒烟 `publish-smoke.mjs` |
| 状态来源 | **GroupContext**（context 壳） | **props**（受控/非受控判定见 `useViewWindowPersist.ts:64-69`） | **props + caps**，零 context/i18n/zod（`SceneWindow.tsx:12-14`） |
| 参数面板 | **无**（`grep 'input type'` = 0） | 全套 ⚙（含 VCL F/E/B 组 + DEC-2 注释 + 窗口 config 6 开关） | 只有窗口 config，无 Scene 级参数 |
| 持久化 | **无**（位置/尺寸纯内存，刷新即丢） | `gv-vw-*`（zod + 防抖 + 全局 reset 广播） | `gv-sw-*` |
| 内容分发 | `renderViewContent` 13 分支，部分**自绘**：`CayleyGraphViewLocal` / `CosetStripWindowView` / `SvgPanZoom` / `TableZoomable` | `ViewContent` 11 分支 → 包内 Scene 内核（`CayleyView`/`SetView`/…） | 宿主 children（任意 packaged Scene） |
| 独有能力 | 窗内**全鼠标 pan/zoom**（`SvgPanZoom:329-393`）、表格独立缩放（`TableZoomable:267-327`）、cosetstrip 窗口兜底文案（`:401-443`）、与主画布**共享选中与生成元** | zoom slider、hover HUD、概览引导、对称演示浮条、8 向 resize、`VIEWWINDOW_RESET_EVENT` | `shell:'none'\|'chrome'`、caps 逐项裁剪 |
| 测试 | **零直接测试**（`src/__tests__` 无 import） | 9 个 `*WindowParams.component.test.tsx` + `ViewWindowParams` | 包冒烟 + `AutomorphismScene.component.test.tsx` |

---

## 2. 分界线在哪（关键结论）

**不在"窗口长什么样"，在「状态归属 + 视图分发」。**

| 状态 | 主画布 `GroupCanvas` | 老式浮窗 | `ViewWindow` |
|------|---------------------|----------|--------------|
| 选中元素 | 全局 `selectedElements` | **共享全局**（Provider 未覆盖，`FloatingViewWindow.tsx:80-94`；`lazyViews.tsx:186`） | **窗口本地 `sel`**（`ViewWindow.tsx:111-120`） |
| 生成元 `cayleyActions` | 全局 | **共享全局**（`lazyViews.tsx:31`） | 窗口本地 `viewParams.actions` |
| `canvasTransform` | 全局 | 独立（`localTransform`） | 独立 `ct`（`useWindowViewport`） |
| `nodePositions` | 全局 | 独立（本窗局部） | 内核内部（`forceDirected` 等） |
| `viewBoxSize` | 全局 | 本窗重算 | 本窗内容区尺寸 |

**推论（决定了施工顺序）**：老式壳的自绘/包装件**完全不消费 `viewParams`**（`CayleyGraphViewLocal` 自算圆形布局、恒用 `curvature=35`，不读 `cayleyShape2D`/`edgeCurvature`/`nodeColorMode`/`pathHighlight`）。⇒ **只把 ⚙ 面板挂上去 = 一排死控件**。融合必须「内容分发 + 面板」同时迁。

---

## 3. 目标形态：`WindowFrame` + 两种宿主适配器

```
WindowFrame（唯一壳）
├─ WindowChrome   几何：8 向 resize / clamp / z 序 / viewportFixed      ← useWindowDragResize + geometry.ts
├─ 窗口能力      zoom slider · hover HUD · 概览引导 · 对称演示浮条
├─ ContentHost   ViewContent（受控 props → 包内 Scene 内核）
├─ ControlHost   ViewParamsPanel（含 Decorations；将来含 FigurePreset）
└─ 持久化        useViewWindowPersist（gv-vw-*，单一键空间与全局 reset）

宿主适配器（两种）
├─ AppWindowAdapter  主应用：GroupContext → props（group / sel / ct / vbSize / viewParams / decorations）
└─ ControlledAdapter 测试页与包消费端：宿主直接给 props（= 今天 ViewWindow 的用法，语义不变）
```

- **对外符号**：`ViewWindow`（受控内核）语义**不变**；`FloatingViewWindow` 由"老式壳"降级为**适配器**（保持同名导出 ⇒ 16 处消费零改动，沿用 2026-09-22 重构口径）。
- **包边界不动**：`SceneWindow` 仍是包侧壳（零 context/i18n/zod）；`ViewWindow` **继续保持不导出**（一导出就会牵出 i18n/zod/context 依赖，撞包纪律）。

---

## 4. 必须先拍板的三个语义取舍（用户可感知）

1. **选中元素**：融合后应用浮窗的选中是「**共享主画布**」还是「**窗口本地**」？
   - 现状两套不同，且共享行为是**用户能看见的**（浮窗点节点 → 主画布同时高亮）。
   - 建议：内核保持窗口本地；主应用适配器**默认沿用共享**（现状不变），并暴露 `selectionSync?: boolean` 供将来按窗口切。
2. **生成元 actions**：同上。今天主画布改生成元会改变浮窗凯莱图；改窗口本地后不再联动。
   - 建议：与 1 同口径（适配器默认可配置，主应用保持共享）。
3. **老式壳三件独有能力**是否并入统一壳（而不是丢弃）：
   - 窗内全鼠标 pan/zoom（`SvgPanZoom`）→ 并入 `useWindowViewport`，加 `wheelZoom: 'ctrl' | 'any'`（内核今天只认 Ctrl/Cmd，见 `useWindowViewport.ts:32-56`）；
   - 表格独立缩放（`TableZoomable`）→ 并入同一 hook 的表格档；
   - cosetstrip 窗口兜底文案 → 并入 `useCosetStripWindowData`（其逻辑已同源）。
   - 建议：全并（否则融合等于砍功能）。

---

## 5. 分刀顺序（每刀都要有可见验收物）

| 刀 | 内容 | 可见验收物 |
|----|------|-----------|
| **W-0** ✅ 2026-09-24 | **窗口内导出**：`ViewWindow` 标题栏加 ⤓ 按钮（2D → SVG，复用 `utils/exportSvg.ts` 全量样式内联 + KaTeX 字体改写 CDN；3D/对称性 → canvas PNG）。序列化逻辑抽零依赖模块，`export.ts` 改为 re-export（单一真源） | **已真机验收**：`图-2-凯莱图.svg`（85 KB）导出成功，含 `<style>`、KaTeX CDN 改写、**注释图层**；导出文件独立渲染时 `g²=e` 正常显示（`.tmp-vcl/exported-render.png`） |
| **W-1** ✅ 2026-09-25 | 几何/chrome 收敛：老式壳改用 `useWindowDragResize` + `clampResize`（**统一 z 计数器**，删掉自带那份），`legacyTableMin` 改 `useMemo`（避免每渲染重挂监听） | **已真机验收**（应用内 `多视图模式 → + 凯莱图`）：窗口出现 **8 个 `[data-resize-dir]` 手柄**（此前只有右下 1 个）；拖标题栏 Δ=120/80 精确跟手；拖左上角 Δwh=80/60 **且** Δxy=-80/-60（旧实现结构上做不到）；拖东边只改宽 70/0；极限拖拽钳到 **280×180**（= `MIN_W`/`MIN_H`）；0 JS 错误。另：**顺手修掉共享 hook 的真 bug**（见 §6.6） |
| **W-2** ✅ 2026-09-25 | 老式壳几何接入**共享持久化** `useViewWindowPersist`（`gv-vw-*` 同一键空间与版本化信封）；键 = **`fv-${view}`**（不能用窗口 `id`：它是 `fv-${Date.now()}` 每次开窗都变；也不按群分键：应用浮窗是"跟着主画布走"的，换群时内容跟着变）；落点级联改挂载时快照；接 `VIEWWINDOW_RESET_EVENT` 广播（清本窗存档 + 回默认几何，与内核 `resetAll` 同口径） | **已真机验收**：拖到 (350,240) 且缩到 590×460 → 存档 `gv-vw-fv-cayley` 为 `{__gvVersion:1, data:{position:{x:350,y:240}, size:{width:590,height:460}}}` → **刷新页面重开浮窗，位置尺寸逐位还原**（restored = true/true）；0 JS 错误。单测另覆盖"重置广播 → 位置回默认" |
| **W-2b** ✅ 2026-09-25 | **补 `resetAllViewWindows()` 的应用入口**（用户：「补个入口吧」）：`ViewPanel` 多视图区新增「重置窗口位置」按钮（`data-testid="reset-window-positions"`，无浮窗时禁用）；i18n 补 `panel.resetWindowPos`（zh/en） | **已真机验收**：按钮存在 → 无浮窗时 **disabled** → 开窗后 enabled → 拖到 (360,250) → 点重置 → 窗口回 **(140,110)** 默认位；存档 `gv-vw-fv-cayley` 被清；标签不是 i18n key；0 JS 错误。单测 +2（未开多视图不存在该按钮 / 开后禁用→启用→只清 `gv-vw-` 前缀不动别的键） |
| **W-3** ✅ 2026-09-25 | 内容分发统一（**先迁 `set` + `cayley`**）：老式壳按 `KERNEL_VIEWS` 前置分发 —— 已迁视图走 `<ViewContent>`（内核同一套 Scene 算子，**消费 viewParams/decorations**），其余 11 视图仍走 `lazyViews.renderViewContent`；同时挂 `<ViewParamsPanel>`（窗口**外**兄弟节点，与内核同一分量/翻边规则）+ 标题栏 ⚙ 入口（`data-testid="float-params-toggle"`）；面板数据复用内核同批 hook（`useCosetStripWindowData` / `useActionWindowData` / `useViewParamsPanelData`）；`ViewContent` 新增 `appWindowLabels`（缺省 false = 内核/博客口径；应用浮窗开常驻标签，与迁移前的自绘件一致，避免"标签突然消失"的回归）；**选中与生成元仍共享主画布**（`handleSelect → ctx.selectElement(id, additive)`） | **已真机验收**（应用内 `多视图模式 → + 凯莱图`，A₄）：⚙ 打开即 `Cayley View` 面板；**调节点半径 28 → 40 画面真的变**；开阶徽标 → 节点上多出 **12** 段 order 文本；**应用浮窗里加注释成功**（DEC-2 首次在应用侧可用，注释叠层 1 条）；与 `?test=2` 的 `ViewWindow` 同群同视图比对：**节点 12 / 边 20 完全一致**，**归一化节点布局指纹逐字符相同**；0 JS 错误 |
| **W-4** ✅ 2026-09-25 | 余下视图迁到内核内容分发：`KERNEL_VIEWS` 扩到 **8 个**（set / cayley / cycle / table / 3d / symmetry / sublattice / cosetstrip）；`ViewContent` 的 cycle 分支改吃 `appWindowLabels`、cosetstrip 的 `showLabels` 默认接 `appWindowLabels`（否则应用浮窗会突然丢标签）；**顺带修一个真机抓到的交互 bug**（见 §6.9） | **已真机扫场**（S₄ 逐个开窗）：8 个已迁视图全部渲染正常且 ⚙ 出现、面板段头正确（Set/Cayley/Cycle/Table/Cayley 3D/Symmetry/Lattice/Coset Strip，控件数 r0–5 / c6–17）；`sylow` **无 ⚙**（门控符合预期）内容 24 圆/42 边；**9 个视图 0 JS 错误**。单测 61 条跨 6 个面板测试文件全绿 |
| **W-5** ✅ 2026-09-25 | 收口：删掉 `lazyViews` 里已死的 8 个分支与三件自绘/包装件（`CayleyGraphViewLocal` 236 行 / `TableZoomable` 61 行 / `CosetStripWindowView` 43 行）与 3D 的 lazy 入口，只留 `sylow`/`tree`/`prestable`/`action`/`homomorphism` 五条；`default` 不再兜底到自绘件（返回 null，13 个 ViewMode 已全覆盖）；同步删掉随之无引用的 import；shim 头注释更新为模块现状 | **文件 505 → 136 行（-369）**；`tsc -b` / eslint 干净；**真机 9 视图扫场与 W-4 结果逐项相同**（内容计数、⚙ 门控、面板段头与控件数、0 JS 错误）⇒ 删的是死代码；`git status` 证明**对外消费方零改动**（只有 `floatingView/` 内部与测试被改，`Workspace`/`ViewPanel`/`TestPage2` 等未动） |
| **W-5** | 收口：删 `renderViewContent` / 自绘件 / 重复 z 计数器；`FloatingViewWindow` 退化为适配器 | 16 处对外消费**零改动**；全量测试绿；`grep` 证明自绘件已消失 |
| *W-6（可选）* | 包侧 `SceneWindow` 能力补齐，作为包消费端唯一壳。**实际缺口只有"视口"这一条**：包内缩放/平移已由 `useSceneState` 提供给宿主，而 `SceneWindow` 自身没有任何 ct/zoom（只有窗口 config 与几何）⇒ 要补的是"把视口状态 + 缩放缓杆接进壳"（受控 `ct` prop 或内部 `useSceneState`）。**`decorations` 不在这一刀里**：它是 Scene 级 prop（如 `CayleyView.decorations`），按 `SceneWindow` 既有约定「Scene props 由宿主控制」，宿主本来就能直接传——不需要改壳 | 包冒烟（`publish-smoke.mjs` / `consume-types.mjs`）通过；`?test=1`（TestPagePkgConsume）可切 `shell:'chrome'` 看到缩放缓杆受控生效；应用内 `AutomorphismPreviewPopup`（也是 SceneWindow 消费者）同享。**约束**：全程保持零 context/i18n/zod 依赖，并注意这会动包门面导出面（`SceneWindowProps` 增字段 = 包 API 变更） |

---

## 6. 风险

1. **语义变化用户可感知**（§4 的选中/生成元联动）——必须先定，否则会在"融合后发现手感变了"时返工。
2. **老式壳零测试** ⇒ ✅ **已办（W-1 同步补，W-2/W-3 续加）**：`src/__tests__/FloatingViewWindowBaseline.component.test.tsx`（**17 条**）钉住渲染与视图分发 / 拖动与边界钳制 / resize 与最小尺寸 / 关闭 / 置顶 / 8 向手柄与四边·四角差异 / 几何持久化与重置 / 面板驱动画面（半径、阶徽标）/ 注释 / 选中共享 / 未迁视图不给 ⚙。**这套基线在每一刀改造前后各跑一次，先绿后绿**，并当场抓出 §6.6 那个 hook bug。
3. **包边界**：`ViewWindow` 今天不在包门面，融合**不要顺手导出**它。
4. **i18n**：老式壳内容走 `useTranslation`；`ViewContent` 是 props 化的（文案由宿主传）。迁移时补文案透传，别把中文硬编码带进内核。
5. **回归网**：14 个窗口面板测试 + `Workspace.integration` / `PanelViewInteractions.integration` / `SvgSnapshot.integration`，一轮一轮跑，别一次大改。
6. **rAF 节流会吞掉最后一帧**（W-1 实测发现并已修）：`useWindowDragResize` 的 mousemove 走 rAF 节流，而 `onUp` 立刻清状态 ⇒ effect cleanup 里 `cancelAnimationFrame` 把**挂起的那一帧**也取消了。快速拖拽（或脚本化拖拽）时 mousemove 与 mouseup 落在同一帧，窗口就停在上一帧位置——**松手没到位**。修法：`onUp` 先用 `lastMove` 补算一次再清状态。教训：**rAF 节流 + 立即清状态 = 必然丢最后一帧**，凡"节流 + 手势结束提交"的组合都要显式 flush。
7. ~~**`resetAllViewWindows()` 在应用里没有触发点**~~ ⇒ ✅ **已解（W-2b，2026-09-25）**：`ViewPanel` 多视图区加了「重置窗口位置」按钮（无浮窗时禁用），i18n `panel.resetWindowPos`（zh/en），真机验收「拖到 (360,250) → 点重置 → 回 (140,110)」。[[教训]] 这类"函数 + 监听都齐了、就是没人调用"的死路径，靠 `grep 调用方` 一眼就能查出来——`ViewWindow` 那个监听从 2026-08-28 起就一直是死的。
8. **同一 view 的多个浮窗共用一个存档键**：`openFloatingView` 允许同一视图开多个窗（「+ 凯莱图」点两次），它们共享 `gv-vw-fv-cayley`（后写覆盖，刷新后都落在同一位置）。v1 接受；要区分需改用稳定窗口 id（如 `fv-${view}-${n}` 并把窗口列表一并持久化）。
9. **resize 角手柄会压住标题栏按钮**（W-4 真机扫场抓到，已修）：8 向手柄里 `ne`/`nw` 是 22×22 且 `zIndex:10`，而标题栏按钮没有定位 ⇒ 右上角手柄**吃掉 ×（和靠右的 ⚙）的点击**，真机上表现为"关闭按钮点不动"。修法不是缩手柄，而是给**按钮组** `position:relative; zIndex:11` 盖过手柄（两套壳同改，`ViewWindow` 一直有同样的问题，只是没人点过最右侧的 ×）。教训：**给窗口加边角手柄后，必须真机点一遍标题栏最右端的按钮**——jsdom 不做命中测试，单测永远发现不了。

---

## 7. 待拍板

1. §4 三个语义取舍（尤其 **选中元素 / 生成元是否继续联动**）。
2. 分刀顺序是否按 W-1 → W-2 → W-3 → W-4 → W-5（先给老式壳补几何与持久化，再迁内容，最后删旧件）。
3. 是否把 `SceneWindow`（W-6）纳入本轮，还是先只做应用侧两套壳的融合。
