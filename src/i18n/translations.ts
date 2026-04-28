export type Lang = 'zh' | 'en'

type TranslationMap = Record<string, string>

const zh: TranslationMap = {
  /* App */
  'app.title': 'GroupViz - 群论可视化',
  'app.header': 'GroupViz - 群论可视化',

  /* Welcome Page */
  'welcome.subtitle': '群论可视化平台',
  'welcome.version': 'v1.0',
  'welcome.tagline': '探索抽象代数的对称之美 — 交互式群论可视化与学习工具',
  'welcome.enter': '进入应用',
  'welcome.feature.subgroups': '子群与陪集',
  'welcome.feature.cayley': 'Cayley图',
  'welcome.feature.multigroup': '多群支持',
  'welcome.feature.table': '乘法表',
  'welcome.feature.3d': '3D可视化',
  'welcome.feature.symmetry': '对称性视图',

  /* Left Panel — Accordion Titles */
  'panel.createGroup': '创建群',
  'panel.viewMode': '视图模式',
  'panel.cayleySettings': '凯莱图设置',
  'panel.operations': '操作与子集',

  /* Left Panel — Group Types */
  'group.cyclic': '循环群',
  'group.cyclic.full': '循环群 Zₙ',
  'group.symmetric': '对称群',
  'group.symmetric.full': '对称群 Sₙ',
  'group.dihedral': '二面体群',
  'group.dihedral.full': '二面体群 Dₙ',
  'group.alternating': '交错群',
  'group.alternating.full': '交错群 Aₙ',
  'group.special': '特殊群',
  'group.klein': 'Klein四元群',
  'group.quaternion': '四元数群',
  'group.direct.z4z2': '直积群',
  'group.direct.z2cubed': '初等阿贝尔群',
  'group.direct.z3z3': '直积群',

  /* Left Panel — View Modes */
  'view.set': '集合视图',
  'view.set.desc': '元素列表',
  'view.cayley': '凯莱图',
  'view.cayley.desc': '2D图',
  'view.cycle': '循环图',
  'view.cycle.desc': '循环结构',
  'view.table': '乘法表',
  'view.table.desc': 'Cayley表',
  'view.3d': '3D凯莱图',
  'view.3d.desc': '三维图',
  'view.symmetry': '对称性视图',
  'view.symmetry.desc': '多面体',
  'view.sublattice': '子群格',
  'view.sublattice.desc': '子群层次',

  /* Left Panel — Buttons & Labels */
  'panel.create': '创建 {label}',
  'panel.multiView': '多视图模式',
  'panel.floatView': '+ {label}',
  'panel.showMaximalCycles': '仅显示极大循环',
  'panel.showAction': '显示元素操作',
  'panel.speed': '速度',
  'panel.multiplyType': '乘法类型',
  'panel.multiplyRight': '右乘 a·c',
  'panel.multiplyLeft': '左乘 c·a',
  'panel.shape': '图形状',
  'panel.forceLayout': '力导向布局',
  'panel.elementActions': '群元素作用 ({n}/{m})',
  'panel.selectAll': '全选',
  'panel.clear': '清除',
  'panel.resetPositions': '重置位置',
  'panel.subsetManagement': '子集管理',
  'panel.saveAsSubset': '存为子集 ({n})',
  'panel.clearAllSubsets': '清除所有子集',
  'panel.inverse': '求逆元',
  'panel.clearCanvas': '清空画布',

  /* Left Panel — Badges */
  'badge.normal': '正规',
  'badge.subgroup': '子群',

  /* Right Panel */
  'right.elementProps': '元素属性',
  'right.currentElement': '当前元素',
  'right.inverse': '逆元',
  'right.id': 'ID',
  'right.selectHint': '在画布上选择元素查看属性',
  'right.groupInfo': '群信息',
  'right.groupName': '群名',
  'right.symbol': '符号',
  'right.order': '阶',
  'right.generators': '生成元',
  'right.abelian': '阿贝尔',
  'right.yes': '是',
  'right.no': '否',
  'right.noGroup': '请先选择一个群',
  'right.simpleGroup': '单群 Simple Group',
  'right.subgroups': '子群 ({n})',
  'right.noSubgroups': '无子群',
  'right.conjugacyClasses': '共轭类 ({n})',
  'right.noClasses': '无共轭类',
  'right.elementList': '元素列表 ({n})',

  /* Subgroup Lattice */
  'lattice.trivial': '平凡群',
  'lattice.subgroup': '子群',

  /* Cayley 3D Legend */
  'cayley3d.multiplyRight': '右乘',
  'cayley3d.multiplyLeft': '左乘',

  /* Symmetry View */
  'symmetry.reset': '复位中...',
  'symmetry.rotating': '旋转中...',
  'symmetry.clickHint': '点击元素查看其在几何体上的对称作用',
  'symmetry.selectHint': '在画布上选中元素以查看其在几何体上的作用',
  'symmetry.demoOff': '元素操作演示已关闭',
  'symmetry.unsupported': '此群类型暂不支持对称性视图',
  'symmetry.supported': '支持的群：循环群 Cₙ · 二面体群 Dₙ · A₄ · S₄ · A₅ · V₄',
  'symmetry.toCube': '→ 正方体',
  'symmetry.toOctahedron': '→ 正八面体',
  'symmetry.toIcosahedron': '→ 正二十面体',
  'symmetry.toDodecahedron': '→ 正十二面体',

  /* Symmetry Geometry Descriptions */
  'symmetry.geo.cyclic': 'Cₙ · {n}阶旋转对称',
  'symmetry.geo.dihedral': 'Dₙ · 正{n}边形',
  'symmetry.geo.tetrahedron': 'A₄ · 正四面体',
  'symmetry.geo.cube': 'S₄ · 正方体',
  'symmetry.geo.octahedron': 'S₄ · 正八面体',
  'symmetry.geo.icosahedron': 'A₅ · 正二十面体',
  'symmetry.geo.dodecahedron': 'A₅ · 正十二面体',
  'symmetry.geo.rectangle': 'V₄ · 长方形',

  /* Canvas Common */
  'canvas.noGroup': '请先选择一个群',
  'canvas.noGroupCreate': '请先创建或选择一个群',
  'canvas.orderTooLarge': '群阶数太大 (|G| = {n})',
  'canvas.show': '显示',
  'canvas.hintBox': '提示信息',
  'canvas.history': '操作历史',

  /* TableView */
  'table.footer1': '列 × 行 = 结果',
  'table.footer2': '颜色对应结果元素',

  /* Hint Messages */
  'hint.groupSelected': '已选择群 {name}（阶 = {order}）',
  'hint.cayley': '凯莱图 — 拖拽节点可移动 | {count} 个边作用元素 | {type}',
  'hint.cayley3d': '3D凯莱图 — 拖拽旋转，滚轮缩放 | {count} 个边 | 形状: {shape}',
  'hint.symmetry': '对称性视图 — 展示群的几何对称对象 | 拖拽旋转，滚轮缩放',
  'hint.sublattice': '子群格 — 点击子群节点选中对应元素 | 拖拽平移，滚轮缩放',
  'hint.cycle': '循环图 — 每个多边形是一个循环子群 ⟨g⟩ ≅ Z<sub>n</sub>',
  'hint.switchedTo': '已切换到 {viewLabel}',
  'hint.elementSelected': '已选择: {label}',
  'hint.layoutDone': '布局优化完成',
  'hint.cayleyMultiply': 'Cayley图乘法类型: {label}',
  'hint.cayleyCleared': 'Cayley图已清除所有边',
  'hint.cayleyShape': '3D凯莱图形状: {shape}',
  'hint.subsetSaved': '已存储子集: {label}（{n} 个元素）',
  'hint.symmetryAction': '显示元素操作: {label}',
  'hint.multiViewOn': '视图多开已开启 — 点击视图按钮打开悬浮窗',
  'hint.multiViewOff': '视图多开已关闭 — 所有悬浮视图已关闭',

  /* Operation History */
  'op.loadGroup': '加载群 {name} (阶={order})',
  'op.switchView': '切换视图: {view}',
  'op.layout': '布局优化: {view}',
  'op.checkSubset': '检验子集: {label}',
  'op.inverseRequest': '请选择一个元素求逆元',
  'op.inverseDone': '求逆元: ({label})⁻¹ = {result}',
  'op.clearCanvas': '清空画布',
  'op.generateSubgroup': '生成子群 (待实现)',
  'op.setCayleyMultiply': '设置Cayley乘法: {label}',
  'op.clearCayley': '清除Cayley图边',
  'op.setShape': '设置3D形状: {shape}',
  'op.saveSubset': '存为子集: {label} ({n} 个元素)',
  'op.removeSubset': '删除子集',
  'op.clearSubsets': '清除所有子集',
  'op.multiViewOn': '开启视图多开',
  'op.multiViewOff': '关闭视图多开',
  'op.openFloatView': '打开悬浮视图: {viewLabel}',

  /* Subset Results */
  'subset.normal': '普通子集',
  'subset.subgroup': '子群',
  'subset.normalSubgroup': '正规子群',

  /* Language Toggle */
  'lang.zh': '简体中文',
  'lang.en': 'English',
}

const en: TranslationMap = {
  /* App */
  'app.title': 'GroupViz - Group Theory Visualization',
  'app.header': 'GroupViz - Group Theory Visualization',

  /* Welcome Page */
  'welcome.subtitle': 'Group Theory Visualization Platform',
  'welcome.version': 'v1.0',
  'welcome.tagline': 'Explore the beauty of symmetry in abstract algebra — Interactive group theory visualization & learning tool',
  'welcome.enter': 'Enter',
  'welcome.feature.subgroups': 'Subgroups & Cosets',
  'welcome.feature.cayley': 'Cayley Graph',
  'welcome.feature.multigroup': 'Multi-Group Support',
  'welcome.feature.table': 'Multiplication Table',
  'welcome.feature.3d': '3D Visualization',
  'welcome.feature.symmetry': 'Symmetry View',

  /* Left Panel — Accordion Titles */
  'panel.createGroup': 'Create Group',
  'panel.viewMode': 'View Mode',
  'panel.cayleySettings': 'Cayley Settings',
  'panel.operations': 'Operations & Subsets',

  /* Left Panel — Group Types */
  'group.cyclic': 'Cyclic',
  'group.cyclic.full': 'Cyclic Group Zₙ',
  'group.symmetric': 'Symmetric',
  'group.symmetric.full': 'Symmetric Group Sₙ',
  'group.dihedral': 'Dihedral',
  'group.dihedral.full': 'Dihedral Group Dₙ',
  'group.alternating': 'Alternating',
  'group.alternating.full': 'Alternating Group Aₙ',
  'group.special': 'Special',
  'group.klein': 'Klein Four-Group',
  'group.quaternion': 'Quaternion Group',
  'group.direct.z4z2': 'Direct Product',
  'group.direct.z2cubed': 'Elementary Abelian Group',
  'group.direct.z3z3': 'Direct Product',

  /* Left Panel — View Modes */
  'view.set': 'Set View',
  'view.set.desc': 'Element List',
  'view.cayley': 'Cayley Graph',
  'view.cayley.desc': '2D Graph',
  'view.cycle': 'Cycle Graph',
  'view.cycle.desc': 'Cycle Structure',
  'view.table': 'Multiplication Table',
  'view.table.desc': 'Cayley Table',
  'view.3d': '3D Cayley Graph',
  'view.3d.desc': '3D Graph',
  'view.symmetry': 'Symmetry View',
  'view.symmetry.desc': 'Polyhedra',
  'view.sublattice': 'Subgroup Lattice',
  'view.sublattice.desc': 'Subgroup Hierarchy',

  /* Left Panel — Buttons & Labels */
  'panel.create': 'Create {label}',
  'panel.multiView': 'Multi-View Mode',
  'panel.floatView': '+ {label}',
  'panel.showMaximalCycles': 'Show Maximal Cycles Only',
  'panel.showAction': 'Show Element Action',
  'panel.speed': 'Speed',
  'panel.multiplyType': 'Multiply Type',
  'panel.multiplyRight': 'Right a·c',
  'panel.multiplyLeft': 'Left c·a',
  'panel.shape': 'Shape',
  'panel.forceLayout': 'Force-Directed Layout',
  'panel.elementActions': 'Group Actions ({n}/{m})',
  'panel.selectAll': 'Select All',
  'panel.clear': 'Clear',
  'panel.resetPositions': 'Reset Positions',
  'panel.subsetManagement': 'Subset Management',
  'panel.saveAsSubset': 'Save as Subset ({n})',
  'panel.clearAllSubsets': 'Clear All Subsets',
  'panel.inverse': 'Inverse',
  'panel.clearCanvas': 'Clear Canvas',

  /* Left Panel — Badges */
  'badge.normal': 'Normal',
  'badge.subgroup': 'Subgroup',

  /* Right Panel */
  'right.elementProps': 'Element Properties',
  'right.currentElement': 'Current Element',
  'right.inverse': 'Inverse',
  'right.id': 'ID',
  'right.selectHint': 'Select an element on the canvas to view properties',
  'right.groupInfo': 'Group Info',
  'right.groupName': 'Name',
  'right.symbol': 'Symbol',
  'right.order': 'Order',
  'right.generators': 'Generators',
  'right.abelian': 'Abelian',
  'right.yes': 'Yes',
  'right.no': 'No',
  'right.noGroup': 'Please select a group first',
  'right.simpleGroup': 'Simple Group',
  'right.subgroups': 'Subgroups ({n})',
  'right.noSubgroups': 'No subgroups',
  'right.conjugacyClasses': 'Conjugacy Classes ({n})',
  'right.noClasses': 'No classes',
  'right.elementList': 'Element List ({n})',

  /* Subgroup Lattice */
  'lattice.trivial': 'Trivial',
  'lattice.subgroup': 'Subgroup',

  /* Cayley 3D Legend */
  'cayley3d.multiplyRight': 'Right Multiply',
  'cayley3d.multiplyLeft': 'Left Multiply',

  /* Symmetry View */
  'symmetry.reset': 'Resetting...',
  'symmetry.rotating': 'Rotating...',
  'symmetry.clickHint': 'Click an element to see its symmetry action on the polyhedron',
  'symmetry.selectHint': 'Select an element on canvas to see its effect on the geometry',
  'symmetry.demoOff': 'Element action demo turned off',
  'symmetry.unsupported': 'This group type does not support symmetry view yet',
  'symmetry.supported': 'Supported groups: Cyclic Cₙ · Dihedral Dₙ · A₄ · S₄ · A₅ · V₄',
  'symmetry.toCube': '→ Cube',
  'symmetry.toOctahedron': '→ Octahedron',
  'symmetry.toIcosahedron': '→ Icosahedron',
  'symmetry.toDodecahedron': '→ Dodecahedron',

  /* Symmetry Geometry Descriptions */
  'symmetry.geo.cyclic': 'Cₙ · {n}-fold rotational symmetry',
  'symmetry.geo.dihedral': 'Dₙ · Regular {n}-gon',
  'symmetry.geo.tetrahedron': 'A₄ · Regular Tetrahedron',
  'symmetry.geo.cube': 'S₄ · Cube',
  'symmetry.geo.octahedron': 'S₄ · Regular Octahedron',
  'symmetry.geo.icosahedron': 'A₅ · Regular Icosahedron',
  'symmetry.geo.dodecahedron': 'A₅ · Regular Dodecahedron',
  'symmetry.geo.rectangle': 'V₄ · Rectangle',

  /* Canvas Common */
  'canvas.noGroup': 'Please select a group first',
  'canvas.noGroupCreate': 'Please create or select a group first',
  'canvas.orderTooLarge': 'Group order is too large (|G| = {n})',
  'canvas.show': 'Show',
  'canvas.hintBox': 'Hints',
  'canvas.history': 'History',

  /* TableView */
  'table.footer1': 'Column × Row = Result',
  'table.footer2': 'Color corresponds to the result element',

  /* Hint Messages */
  'hint.groupSelected': 'Selected {name} (order = {order})',
  'hint.cayley': 'Cayley Graph — Drag nodes to move | {count} active actions | {type}',
  'hint.cayley3d': '3D Cayley Graph — Drag to rotate, scroll to zoom | {count} edges | Shape: {shape}',
  'hint.symmetry': 'Symmetry View — Displays geometric symmetry objects | Drag to rotate, scroll to zoom',
  'hint.sublattice': 'Subgroup Lattice — Click node to select elements | Drag to pan, scroll to zoom',
  'hint.cycle': 'Cycle Graph — Each polygon is a cyclic subgroup ⟨g⟩ ≅ Z<sub>n</sub>',
  'hint.switchedTo': 'Switched to {viewLabel}',
  'hint.elementSelected': 'Selected: {label}',
  'hint.layoutDone': 'Layout optimization complete',
  'hint.cayleyMultiply': 'Cayley multiply type: {label}',
  'hint.cayleyCleared': 'Cayley graph edges cleared',
  'hint.cayleyShape': '3D Cayley shape: {shape}',
  'hint.subsetSaved': 'Subset saved: {label} ({n} elements)',
  'hint.symmetryAction': 'Show element action: {label}',
  'hint.multiViewOn': 'Multi-view enabled — Click view buttons to open floating windows',
  'hint.multiViewOff': 'Multi-view disabled — All floating windows closed',

  /* Operation History */
  'op.loadGroup': 'Load {name} (|G|={order})',
  'op.switchView': 'Switch view: {view}',
  'op.layout': 'Layout: {view}',
  'op.checkSubset': 'Check subset: {label}',
  'op.inverseRequest': 'Select an element to compute inverse',
  'op.inverseDone': 'Inverse: ({label})⁻¹ = {result}',
  'op.clearCanvas': 'Clear Canvas',
  'op.generateSubgroup': 'Generate subgroup (TBD)',
  'op.setCayleyMultiply': 'Set Cayley multiply: {label}',
  'op.clearCayley': 'Clear Cayley edges',
  'op.setShape': 'Set 3D shape: {shape}',
  'op.saveSubset': 'Save subset: {label} ({n} items)',
  'op.removeSubset': 'Remove subset',
  'op.clearSubsets': 'Clear all subsets',
  'op.multiViewOn': 'Enable multi-view',
  'op.multiViewOff': 'Disable multi-view',
  'op.openFloatView': 'Open floating view: {viewLabel}',

  /* Subset Results */
  'subset.normal': 'Normal Subset',
  'subset.subgroup': 'Subgroup',
  'subset.normalSubgroup': 'Normal Subgroup',

  /* Language Toggle */
  'lang.zh': '简体中文',
  'lang.en': 'English',
}

export const translations: Record<Lang, TranslationMap> = { zh, en }

export function getDefaultLang(): Lang {
  if (typeof window === 'undefined') return 'zh'
  const stored = localStorage.getItem('groupviz-lang')
  if (stored === 'en' || stored === 'zh') return stored
  const nav = navigator.language || ''
  if (nav.startsWith('zh')) return 'zh'
  return 'zh'
}
