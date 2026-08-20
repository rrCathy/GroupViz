# UI 结构与交互

本文件描述 GroupViz 的界面布局、面板组成与交互行为。数学渲染统一使用 KaTeX（见 [GROUPS.md](./GROUPS.md) 与 texify）。

## 1. 应用布局（App.tsx）

```
AppWrapper (I18nProvider → ThemeProvider)
└── App
    ├── WelcomePage（欢迎页，点击「进入」后消失）
    └── GroupProvider
        ├── header：h1 标题（点击返回欢迎页并清除 groupviz-session）+ ThemeToggle + LanguageToggle
        └── AppContent
            ├── aside.left-sidebar  → LeftPanel
            ├── main.main-canvas    → GroupCanvas / DirectProductView(懒加载) / SemidirectProductView(懒加载)
            ├── aside.right-sidebar → RightPanel
            ├── FloatingViewWindow（多视图浮动窗口）
            └── AutomorphismPreviewPopup（全局挂载，见 GROUPS.md）
```

- **键盘导航**：←/↑ 选择上一个元素，→/↓ 选择下一个元素（同态视图动画阶段亦用方向键）
- **默认群**：S₃；默认视图：set
- **会话**：自动保存/恢复到 `groupviz-session`（群符号、视图、节点位置、商群、自同构、半直积 spec）

## 2. 左侧面板（LeftPanel）

手风琴式（AccordionSection），从上到下：

| # | 面板 | 图标 | 内容 |
|---|------|------|------|
| 1 | GroupPanel（`panel.createGroup`） | ⊕ | 内部 TabBar 2 tab：`create` 群创建（GroupCreationInner：群类型/阶滑块/按阶浏览/创建）；`dp` 直积构建（DirectProductInner：三模式 cayley/table/direct、导入当前群、存储/加载直积群） |
| 2 | SemidirectProductPanel（`sd.title`） | ⋉ | 进入/退出模式、导入当前群为 N/H、计算 Aut(N)、φ 生成元映射下拉、展开 φ、创建、已保存半直积列表；下方**半直积分解区**（操作面板「半直积分解」按钮触发：分解列表 N⋊_φ H + ✓/✗ 徽标 + 点击切换 + 分裂短正合列 1→N→G→H→1） |
| 3 | ViewPanel（`panel.viewMode`，默认展开） | ⊞ | 9 个视图卡片 + 多视图勾选；下方按视图显示上下文设置（见下） |
| 4 | OperationsPanel（`panel.operations`） | ⚙ | 内部 TabBar 4 tab：general/subsets/quotient/automorphism |
| 5 | HomomorphismPanel（`homo.title`） | ⟷ | 同态构建与验证（源/目标选择、自动映射、生成元映射、验证结果、第一同构定理入口、已存同态列表） |
| 6 | GroupActionPanel（`action.title`） | ➤ | 群作用：共轭/左平移（Cayley）/陪集/自定义/Sylow p-作用五来源、陪集子群下拉（findAllSubgroups）、Sylow 素数下拉（factorizeOrder）、\|X\| 输入、自定义箭头编辑（点击/拖放绑定）、完成并验证/退出 |
| 7 | PresentationPanel（`pres.title`） | ⟨⟩ | 群展示：两种创建方式 tab（直接创建 = textarea 输入 ⟨生成元\|关系词⟩ 完整语法 + 创建群；可视化创建 = 模板逐步粘合）、「✕ 清空当前群（回到模板树）」、已保存展示列表（点击加载/× 删除）、草稿自动保存 |

> 注：直积构建入口在 GroupPanel 的 `dp` tab；BasicGroupPanel（`panel.basicGroup`）为按群类型/按阶创建（含交错群 Aₙ）。

### ViewPanel 上下文设置

- **cayley 视图**：右乘/左乘切换、2D 形状下拉（14 种）、力导向按钮（concentric/dualRing/projection3D/rewiring 时禁用）、元素作用列表（全选/清除、"(by element)" 标注）
- **3d 视图**：乘法类型、3D 形状下拉（18 种）、元素作用列表（canonical3DEdgeIds 判定典型边不标注）
- **cycle 视图**：显示极大循环子群勾选
- **symmetry 视图**：显示元素操作勾选 + 旋转速度滑块（0.2–5x）

### OperationsPanel 4 tab

| tab | 内容 |
|-----|------|
| general ⚙ | 计算逆元、清空画布、重置节点位置 |
| subsets ⊂ | 保存子集（自动检测子群/正规子群）、子集列表、显示陪集、创建商群、左/右陪集切换、显示全部陪集 |
| quotient G/N | 已保存商群列表（加载/删除/≅ 徽章） |
| automorphism Aut | 计算 Aut(G)（`automorphism.compute`）+ 已保存自同构群列表（Load/删除，≅ isoSymbol 徽章） |

## 3. 右侧面板（RightPanel）

**双模式：**

- **同态编辑模式**（editingSource 且 editingTarget 非空）：源/目标群信息、同态区（|Ker|/|Im|、|G|/|Ker|=|Im f|、单射/满射/同构 chips）、第一同构定理 4 阶段区、进入定理模式按钮
- **普通模式**：
  1. 元素属性（label/inverse/id）
  2. AutomorphismMappingPanel（当前群是 Aut(G) 且选中元素时：最多 40 行 src↦tgt 映射 + `+ {n} fixed`）
  3. 群信息（name/symbol/order/generators/阿贝尔性 + 可点击 isoSymbol 跳转同构群）
  4. 单群徽章（isSimple）
  5. 本地内联 AccordionSection（RightPanel 自有副本，非 Panels 目录组件）：
     - 子群(n)：点击选中元素 + 显示陪集 + 跳转 cosetstrip 视图；正规子群有「创建商群」按钮
     - 共轭类(n)：点击选中类
     - 元素列表 chips 网格
  6. 大群占位：`正在从后端计算群结构...`

## 4. 其他组件

- **TabBar.tsx**：面板内部组件（非顶层 tab 栏），`TabDef {key, label, icon?, content}`，`compact` 模式只显示图标
- **批量导出**：无 UI 面板，由 CLI 承担 → `npm run export`（scripts/batch-export.mjs），经 `window.__groupVizExport__` 桥渲染 9 预设群 × 7 视图
- **AutomorphismPreviewPopup.tsx**：360×360 可拖拽弹窗（zIndex 2000），展示自同构的重布线 Cayley 图、生成元像、不动点（青绿）与映射列表
- **WelcomePage.tsx**：硬核模式欢迎页——浮动数学符号动画、已开发功能/即将推出清单、GitHub 链接、赞助菜单（PayPal/Ko-fi/爱发电）

## 5. 主题与国际化

- **主题**：ThemeContext + useTheme，CSS 自定义属性驱动（--bg/--panel/--accent 等），支持深/浅色、系统偏好检测、localStorage 记忆；语义色 token：--accent-blue/green/red/orange/danger(+hover)、--btn-on-accent（深色 #0f0f1a / 浅色 #ffffff，随主题切换——accent 按钮文字必须用它而非硬编码）、--text-accent，及别名 token（--bg-elevated/--bg-muted/--bg-panel/--bg-hover/--border-color/--canvas-bg/--input-bg/--panel-bg/--panel-border/--text 别名到既有主 token）
- **国际化**：I18nContext + useTranslation，中文(zh)/English(en)，浏览器语言自动选择，localStorage 记忆
- ✅ **i18n 键已补全**：`hint.quotientCreated( Iso)`、`hint.automorphismComputed( Iso)`、`hint.layoutFailed`、`op.createQuotient`、`op.removeQuotient`、`op.computedAutomorphism`、`op.removeAutomorphism`、`right.homomorphism`、`right.homo.kernel/image/quotient/noActive`、`right.automorphismMapping`、`right.automorphismFixed`、`homo.firstIso.phase0..3(+Desc)`、`canvas.cosetStripNoSubgroup/NoCosets`、`canvas.tableSampled` 均已定义；CosetStripView/TableView 硬编码英文已改为 t() 调用（`panel.batchExport*` 键随 BatchExportPanel 移除，批量导出由 CLI 承担）；zh/en 键集合一致性由 `i18n.test.ts` 自动化断言

## 6. CSS 约定

- 全局样式：src/App.css + src/index.css，不使用任何 CSS 框架
- 深色/浅色通过 `[data-theme]` 或 `.theme-*` 类切换 CSS 自定义属性
- 数学符号：SVG 节点用 `foreignObject` + KaTeX；乘法表用 `<text>`（避免 foreignObject 开销）
