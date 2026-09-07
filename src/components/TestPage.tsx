/**
 * FGVE 测试页面 — ViewWindow 参数 API 全覆盖测试
 * 测试所有可通过代码传入的参数组合（包括 UI 控件范围外的边界值）
 * 用法：src/main.tsx 临时改为挂载 <TestPage />
 */
import { useMemo, useState } from 'react';
import { ViewWindow } from './Canvas/FloatingViewWindow'
import type { ViewParams } from './Canvas/FloatingViewWindow'
import { resetAllViewWindows } from '../utils/resetViewWindows';
import { createCyclicGroup } from '../core/groups/CyclicGroup';
import { createDihedralGroup } from '../core/groups/DihedralGroup';
import { createSymmetricGroup } from '../core/groups/SymmetricGroup';
import { createAlternatingGroup } from '../core/groups/AlternatingGroup';
import { createQuaternion } from '../core/groups/SpecialGroup';
import { createKleinFour } from '../core/groups/SpecialGroup';
import { useTheme } from '../theme/useTheme';
import { naturalProjectionMapping, verifyHomomorphism, extendFromGenerators } from '../core/algebra/homomorphisms';
import type { Homomorphism } from '../core/types';

const row = { display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 12 };
const card: React.CSSProperties = { background: '#1e293b', borderRadius: 8, padding: 8, fontSize: 12, color: '#94a3b8', flex: 1, minWidth: 140, maxWidth: 200 };
const label: React.CSSProperties = { fontWeight: 600, color: '#e2e8f0', marginBottom: 4, fontSize: 13 };

export default function TestPage() {
  const c4 = useMemo(() => createCyclicGroup(4), []);
  const c8 = useMemo(() => createCyclicGroup(8), []);
  const c12 = useMemo(() => createCyclicGroup(12), []);
  const d6 = useMemo(() => createDihedralGroup(6), []);
  const d4 = useMemo(() => createDihedralGroup(4), []);
  const s3 = useMemo(() => createSymmetricGroup(3), []);
  const s4 = useMemo(() => createSymmetricGroup(4), []);
  const a4 = useMemo(() => createAlternatingGroup(4), []);
  const a5 = useMemo(() => createAlternatingGroup(5), []);
  const v4 = useMemo(() => createKleinFour(), []);
  const q8 = useMemo(() => createQuaternion(), []);
  const c6 = useMemo(() => createCyclicGroup(6), []);
  const c2 = useMemo(() => createCyclicGroup(2), []);
  const homoProj = useMemo<Homomorphism>(() => {
    const mapping = naturalProjectionMapping(c6, c2)!;
    return { id: 'test-homo-proj', source: c6, target: c2, mapping, result: verifyHomomorphism(c6, c2, mapping), name: 'C₆ → C₂' };
  }, [c6, c2]);
  const homoId = useMemo<Homomorphism>(() => {
    const mapping = new Map<string, string>(s3.elements.map(e => [e.id, e.id]));
    return { id: 'test-homo-id', source: s3, target: s3, mapping, result: verifyHomomorphism(s3, s3, mapping), name: 'S₃ → S₃' };
  }, [s3]);
  const homo4to3 = useMemo<Homomorphism>(() => {
    // S₄→S₃ 满同态（教科书 S₄/V₄ ≅ S₃ 第一同构定理例）：S₄ 作用在三条 2-2 划分
    // P1={12|34} P2={13|24} P3={14|23} 上，诱导划分集合的置换 → 满射 S₄→S₃，核 = V₄
    // （四个双对换）。生成元像自算并经 extendFromGenerators 全展开 + verifyHomomorphism
    // 机器验证（src/__tests__/s4toS3.test.ts）：φ((12))=(23)、φ((1234))=(13)。
    const srcById = new Map(s4.elements.map(e => [e.id, e]));
    const genByName = new Map(s4.generators.map(g => [g.name, srcById.get(g.apply(s4.identity).id)]));
    const findTgt = (v: number[]) => s3.elements.find(e => e.value.every((x, i) => x === v[i]))!;
    const gm = new Map<string, string>();
    gm.set(genByName.get('s12')!.id, findTgt([1, 3, 2]).id); // (12) ↦ (23)（交换 P2↔P3）
    gm.set(genByName.get('c')!.id, findTgt([3, 2, 1]).id);   // (1234) ↦ (13)（交换 P1↔P3）
    const mapping = extendFromGenerators(s4, s3, gm)!;
    return { id: 'test-homo-4to3', source: s4, target: s3, mapping, result: verifyHomomorphism(s4, s3, mapping), name: 'S₄ → S₃' };
  }, [s4, s3]);
  const { viewWindowTheme, toggleViewWindowTheme } = useTheme();
  const [lockCfg, setLockCfg] = useState<{ locked?: boolean; zoomLocked?: boolean }>({ locked: true, zoomLocked: true });
  const [ctlParams, setCtlParams] = useState<ViewParams>({});
  const [ctl3d, setCtl3d] = useState<ViewParams>({ autoRotate: true, multiplyType: 'left' });
  const [ctlLat, setCtlLat] = useState<ViewParams>({ labelDetail: 'compact', nodeScale: 0.7 });
  const [ctlCs, setCtlCs] = useState<ViewParams>({ showSubgroupCayley: true });
  const [ctlSym, setCtlSym] = useState<ViewParams>({ showAction: true, rotateSpeed: 1.5 });
  const [ctlAct, setCtlAct] = useState<ViewParams>({ actionKind: 'conjugation' });
  // S₃ 自定义作用预注入（X=3，合法同态）：S₃ 的定义置换本身——
  // Φ(σ₁₂)=(0 1)、Φ(σ₂₃)=(1 2)，不动点用自环箭头显式编码（部分箭头的生成元
  // 要求每个 from 都有去向）。σ₁₂²=σ₂₃²=(σ₁₂σ₂₃)³=e 全保持（(σ₁₂σ₂₃) 像 =
  // (0 1 2) 3-cycle），自然传递作用，Stab(1)={e,(23)} 阶 2，OST 3·2=6；
  // 博客场景可直接注入已验证 arrows
  const customS3Arrows = useMemo(() => [
    { generatorId: s3.generators[0].symbol, from: 0, to: 1 },
    { generatorId: s3.generators[0].symbol, from: 1, to: 0 },
    { generatorId: s3.generators[0].symbol, from: 2, to: 2 },
    { generatorId: s3.generators[1].symbol, from: 0, to: 0 },
    { generatorId: s3.generators[1].symbol, from: 1, to: 2 },
    { generatorId: s3.generators[1].symbol, from: 2, to: 1 },
  ], [s3]);

  const handleResetAll = () => {
    setLockCfg({});
    resetAllViewWindows();
  };

  return (
    <div style={{ padding: 24, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>FGVE ViewWindow 参数 API 测试矩阵</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            title={viewWindowTheme === 'dark' ? '视图窗口切换为浅色' : '视图窗口切换为深色'}
            onClick={toggleViewWindowTheme}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #475569', background: viewWindowTheme === 'dark' ? '#4ecdc4' : '#ffd93d', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
          >{viewWindowTheme === 'dark' ? '■ 视图窗口：深色' : '□ 视图窗口：浅色'}</button>
          <button
            title="Reset ALL windows to defaults (clears gv-vw-* persistence)"
            onClick={handleResetAll}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #475569', background: '#f97316', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
          >↺ 一键重置所有窗口</button>
        </div>
      </div>

      <div style={row}>
        <div style={card}><div style={label}>C₄ 默认</div>无自定义参数，纯默认布局</div>
        <div style={card}><div style={label}>C₄ 紧致</div>nodeRadius=10, gap=2</div>
        <div style={card}><div style={label}>C₄ 稀疏</div>nodeRadius=60, gap=30</div>
        <div style={card}><div style={label}>C₄ 单列</div>columns=1, nodeRadius=30</div>
        <div style={card}><div style={label}>C₄ 无标签</div>showLabels=false</div>
      </div>

      <ViewWindow view="set" group={c4} title="C₄ · 默认" storageKey="test-c4-def"
        defaultPosition={{ x: 20, y: 140 }} defaultSize={{ width: 340, height: 280 }} />
      <ViewWindow view="set" group={c4} title="C₄ · 紧致" storageKey="test-c4-tight"
        defaultPosition={{ x: 380, y: 140 }} defaultSize={{ width: 340, height: 280 }}
        viewParams={{ nodeRadius: 10, gap: 2 }} />
      <ViewWindow view="set" group={c4} title="C₄ · 稀疏" storageKey="test-c4-sparse"
        defaultPosition={{ x: 740, y: 140 }} defaultSize={{ width: 340, height: 280 }}
        viewParams={{ nodeRadius: 60, gap: 30 }} />
      <ViewWindow view="set" group={c4} title="C₄ · 单列" storageKey="test-c4-cols1"
        defaultPosition={{ x: 20, y: 460 }} defaultSize={{ width: 340, height: 350 }}
        viewParams={{ columns: 1, nodeRadius: 30 }} />
      <ViewWindow view="set" group={c4} title="C₄ · 无标签" storageKey="test-c4-nolabel"
        defaultPosition={{ x: 380, y: 460 }} defaultSize={{ width: 340, height: 280 }}
        viewParams={{ showLabels: false }} />

      <div style={{ ...row, marginTop: 380 }}>
        <div style={card}><div style={label}>C₄ 锁定</div>locked=true, zoomLocked=true</div>
        <div style={card}><div style={label}>C₄ 隐藏信息</div>showInfo=false</div>
        <div style={card}><div style={label}>C₈ 默认</div>8阶循环群默认布局</div>
        <div style={card}><div style={label}>C₈ 3列</div>columns=3, 3×3缺1</div>
        <div style={card}><div style={label}>D₆ 默认</div>12阶二面体</div>
        <div style={card}><div style={label}>C₄ 不可调尺寸</div>resizable=false，隐藏 resize 手柄</div>
      </div>

      <ViewWindow view="set" group={c4} title="C₄ · 锁定" storageKey="test-c4-lock"
        defaultPosition={{ x: 740, y: 460 }} defaultSize={{ width: 340, height: 280 }}
        config={lockCfg} onConfigChange={setLockCfg} />
      <ViewWindow view="set" group={c4} title="C₄ · 隐藏信息" storageKey="test-c4-noinfo"
        defaultPosition={{ x: 20, y: 770 }} defaultSize={{ width: 340, height: 280 }}
        config={{ showInfo: false }} />
      <ViewWindow view="set" group={c8} title="C₈ · 默认" storageKey="test-c8-def"
        defaultPosition={{ x: 380, y: 770 }} defaultSize={{ width: 340, height: 280 }} />
      <ViewWindow view="set" group={c8} title="C₈ · 3列" storageKey="test-c8-cols3"
        defaultPosition={{ x: 740, y: 770 }} defaultSize={{ width: 340, height: 320 }}
        viewParams={{ columns: 3 }} />
      <ViewWindow view="set" group={d6} title="D₆ · 默认" storageKey="test-d6-def"
        defaultPosition={{ x: 20, y: 1090 }} defaultSize={{ width: 360, height: 320 }} />
      <ViewWindow view="set" group={c4} title="C₄ · 不可调尺寸" storageKey="test-c4-noresize"
        defaultPosition={{ x: 380, y: 1090 }} defaultSize={{ width: 340, height: 280 }}
        config={{ resizable: false }} />

      <div style={{ ...row, marginTop: 380 }}>
        <div style={card}><div style={label}>C₄ 凯莱默认</div>circular + 生成元 a 边（有向箭头）</div>
        <div style={card}><div style={label}>D₄ 凯莱默认</div>dualRing 双环（内旋转外反射）</div>
        <div style={card}><div style={label}>S₃ 凯莱左乘</div>multiplyType=left，边集不同于右乘</div>
        <div style={card}><div style={label}>C₁₂ 凯莱螺旋</div>shape2D=spiral</div>
        <div style={card}><div style={label}>C₄ 凯莱受控</div>viewParams/onViewParamsChange 受控模式</div>
      </div>

      <ViewWindow view="cayley" group={c4} title="C₄ · 凯莱默认" storageKey="test-cay-c4-def"
        defaultPosition={{ x: 20, y: 1470 }} defaultSize={{ width: 360, height: 320 }} />
      <ViewWindow view="cayley" group={d4} title="D₄ · 凯莱双环" storageKey="test-cay-d4-def"
        defaultPosition={{ x: 400, y: 1470 }} defaultSize={{ width: 380, height: 320 }} />
      <ViewWindow view="cayley" group={s3} title="S₃ · 凯莱左乘" storageKey="test-cay-s3-left"
        defaultPosition={{ x: 800, y: 1470 }} defaultSize={{ width: 360, height: 320 }}
        viewParams={{ multiplyType: 'left' }} />
      <ViewWindow view="cayley" group={c12} title="C₁₂ · 凯莱螺旋" storageKey="test-cay-c12-spiral"
        defaultPosition={{ x: 20, y: 1830 }} defaultSize={{ width: 380, height: 340 }}
        viewParams={{ shape2D: 'spiral' }} />
      <ViewWindow view="cayley" group={c4} title="C₄ · 凯莱受控" storageKey="test-cay-c4-ctl"
        defaultPosition={{ x: 420, y: 1830 }} defaultSize={{ width: 360, height: 320 }}
        viewParams={ctlParams} onViewParamsChange={setCtlParams} />

      <div style={{ ...row, marginTop: 380 }}>
        <div style={card}><div style={label}>C₄ 循环图默认</div>全部循环子群，节点可拖拽</div>
        <div style={card}><div style={label}>D₆ 循环图极大</div>showMaximalCycles=true，planar 布局</div>
        <div style={card}><div style={label}>C₄ 乘法表</div>4×4 全表，单元格选中</div>
        <div style={card}><div style={label}>C₁₂ 乘法表子群策略</div>strategy=subgroup，大群抽样</div>
        <div style={card}><div style={label}>C₄ 热力图</div>纯色块无文字，无最小尺寸</div>
        <div style={card}><div style={label}>C₁₂ 热力图</div>大群抽样热力图</div>
      </div>

      <ViewWindow view="cycle" group={c4} title="C₄ · 循环图默认" storageKey="test-cyc-c4-def"
        defaultPosition={{ x: 20, y: 2220 }} defaultSize={{ width: 380, height: 320 }} />
      <ViewWindow view="cycle" group={d6} title="D₆ · 循环图极大" storageKey="test-cyc-d6-max"
        defaultPosition={{ x: 420, y: 2220 }} defaultSize={{ width: 380, height: 320 }}
        viewParams={{ showMaximalCycles: true }} />
      <ViewWindow view="table" group={c4} title="C₄ · 乘法表" storageKey="test-tbl-c4-def"
        defaultPosition={{ x: 820, y: 2220 }} defaultSize={{ width: 360, height: 360 }} />
      <ViewWindow view="table" group={c12} title="C₁₂ · 乘法表子群" storageKey="test-tbl-c12-sub"
        defaultPosition={{ x: 20, y: 2580 }} defaultSize={{ width: 380, height: 380 }}
        viewParams={{ strategy: 'subgroup' }} />
      <ViewWindow view="heatmap" group={c4} title="C₄ · 热力图" storageKey="test-heat-c4-def"
        defaultPosition={{ x: 420, y: 2580 }} defaultSize={{ width: 300, height: 300 }} />
      <ViewWindow view="heatmap" group={c12} title="C₁₂ · 热力图抽样" storageKey="test-heat-c12-sub"
        defaultPosition={{ x: 820, y: 2580 }} defaultSize={{ width: 300, height: 300 }}
        viewParams={{ strategy: 'subgroup' }} />

      <div style={{ ...row, marginTop: 380 }}>
        <div style={card}><div style={label}>C₄ 3D 默认</div>cone 布局 + 生成元边（轨道相机）</div>
        <div style={card}><div style={label}>S₃ 3D 六边形</div>layout3D=hexagon，切形状相机回正</div>
        <div style={card}><div style={label}>D₄ 3D 受控</div>autoRotate+左乘，viewParams 受控模式</div>
        <div style={card}><div style={label}>C₄ 3D 锁定插图</div>locked 禁相机交互，无标签</div>
      </div>

      <ViewWindow view="3d" group={c4} title="C₄ · 3D 默认" storageKey="test-3d-c4-def"
        defaultPosition={{ x: 20, y: 2960 }} defaultSize={{ width: 380, height: 320 }} />
      <ViewWindow view="3d" group={s3} title="S₃ · 3D 六边形" storageKey="test-3d-s3-hex"
        defaultPosition={{ x: 420, y: 2960 }} defaultSize={{ width: 380, height: 320 }}
        viewParams={{ layout3D: 'hexagon' }} />
      <ViewWindow view="3d" group={d4} title="D₄ · 3D 受控" storageKey="test-3d-d4-ctl"
        defaultPosition={{ x: 820, y: 2960 }} defaultSize={{ width: 380, height: 320 }}
        viewParams={ctl3d} onViewParamsChange={setCtl3d} />
      <ViewWindow view="3d" group={c4} title="C₄ · 3D 锁定" storageKey="test-3d-c4-lock"
        defaultPosition={{ x: 20, y: 3320 }} defaultSize={{ width: 380, height: 320 }}
        config={{ locked: true, resizable: false, showInfo: true }}
        viewParams={{ showLabels: false }} />

      <div style={{ ...row, marginTop: 380 }}>
        <div style={card}><div style={label}>S₃ 子群格自动</div>auto：4 节点格按窗口宽度定档</div>
        <div style={card}><div style={label}>S₄ 子群格自动</div>30 子群挤在小窗里 → 自动降到 dots</div>
        <div style={card}><div style={label}>A₄ 子群格合并</div>mergeConjugates，×n = |G:N_G(H)|</div>
        <div style={card}><div style={label}>Q₈ 子群格强制名片</div>labelDetail=full（对照：拥挤时不可读）</div>
        <div style={card}><div style={label}>D₄ 子群格受控</div>viewParams 受控 + 名片大小 0.7</div>
      </div>

      <ViewWindow view="sublattice" group={s3} title="S₃ · 子群格自动" storageKey="test-lat-s3-auto"
        defaultPosition={{ x: 20, y: 3700 }} defaultSize={{ width: 400, height: 320 }} />
      <ViewWindow view="sublattice" group={s4} title="S₄ · 子群格自动" storageKey="test-lat-s4-auto"
        defaultPosition={{ x: 440, y: 3700 }} defaultSize={{ width: 400, height: 320 }} />
      <ViewWindow view="sublattice" group={a4} title="A₄ · 子群格合并" storageKey="test-lat-a4-merge"
        defaultPosition={{ x: 860, y: 3700 }} defaultSize={{ width: 400, height: 320 }}
        viewParams={{ mergeConjugates: true }} />
      <ViewWindow view="sublattice" group={q8} title="Q₈ · 子群格强制名片" storageKey="test-lat-q8-full"
        defaultPosition={{ x: 20, y: 4060 }} defaultSize={{ width: 420, height: 320 }}
        viewParams={{ labelDetail: 'full' }} />
      <ViewWindow view="sublattice" group={d4} title="D₄ · 子群格受控" storageKey="test-lat-d4-ctl"
        defaultPosition={{ x: 440, y: 4060 }} defaultSize={{ width: 400, height: 320 }}
        viewParams={ctlLat} onViewParamsChange={setCtlLat} />

      <div style={{ ...row, marginTop: 380 }}>
        <div style={card}><div style={label}>S₃ 陪集条带默认</div>首候选 C₃（正规）→ [G:H]=2 两条带</div>
        <div style={card}><div style={label}>Q₈ 陪集右陪集</div>cosetType=right，首候选 C₄ → 两条带</div>
        <div style={card}><div style={label}>C₄ 全开对照</div>showLabels+Subgroup Cayley 开（对照窗口缺省隐藏）</div>
        <div style={card}><div style={label}>A₄ 陪集受控</div>首候选 V₄ → 3 条带 ×4，viewParams 受控模式</div>
      </div>

      <ViewWindow view="cosetstrip" group={s3} title="S₃ · 陪集条带" storageKey="test-cs-s3-def"
        defaultPosition={{ x: 20, y: 4500 }} defaultSize={{ width: 400, height: 300 }} />
      <ViewWindow view="cosetstrip" group={q8} title="Q₈ · 陪集条带" storageKey="test-cs-q8-right"
        defaultPosition={{ x: 440, y: 4500 }} defaultSize={{ width: 400, height: 300 }}
        viewParams={{ cosetType: 'right' }} />
      <ViewWindow view="cosetstrip" group={c4} title="C₄ · 陪集条带" storageKey="test-cs-c4-full"
        defaultPosition={{ x: 860, y: 4500 }} defaultSize={{ width: 400, height: 340 }}
        viewParams={{ showLabels: true, showSubgroupCayley: true }} />
      <ViewWindow view="cosetstrip" group={a4} title="A₄ · 陪集条带受控" storageKey="test-cs-a4-ctl"
        defaultPosition={{ x: 20, y: 4900 }} defaultSize={{ width: 420, height: 320 }}
        viewParams={ctlCs} onViewParamsChange={setCtlCs} />

      <div style={{ ...row, marginTop: 380 }}>
        <div style={card}><div style={label}>A₄ 四面体默认</div>正四面体：群元素映射为几何旋转</div>
        <div style={card}><div style={label}>A₄ 四面体演示</div>showAction 开，预置 3-cycle 演示；⚙ 面板列出全部元素，点行触发旋转、点已选行重播，浮条自带 ⟳ Replay / ✕ Reset 可反复观看</div>
        <div style={card}><div style={label}>D₆ 固定演示</div>actionLocked=true：演示元素「钉」住（60° 旋转），⚙ 列表只读、无 Reset，只能 ⟳ Replay —— 与 A₄ 窗的「可切换」成对照</div>
        <div style={card}><div style={label}>S₄ 对偶八面体</div>variant=true → 正方体对偶正八面体（可互切）</div>
        <div style={card}><div style={label}>D₆ 六边形</div>12 阶二面体 → 正六边形旋转对称</div>
        <div style={card}><div style={label}>C₈ 八边形</div>8 阶循环群 → 有向正八边形</div>
        <div style={card}><div style={label}>V₄ 长方形</div>Klein 四元群 → 长方形 180° 对称</div>
        <div style={card}><div style={label}>A₅ 正二十面体</div>60 阶 → 二十面体/十二面体对偶</div>
      </div>

      <ViewWindow view="symmetry" group={a4} title="A₄ · 正四面体" storageKey="test-sym-a4-def"
        defaultPosition={{ x: 20, y: 5320 }} defaultSize={{ width: 380, height: 320 }} />
      <ViewWindow view="symmetry" group={a4} title="A₄ · 演示动画" storageKey="test-sym-a4-demo"
        defaultPosition={{ x: 420, y: 5320 }} defaultSize={{ width: 380, height: 320 }}
        viewParams={{ showAction: true, actionElementId: a4.elements.find(el => el.id !== a4.identity.id)?.id }} />
      <ViewWindow view="symmetry" group={s4} title="S₄ · 八面体(对偶)" storageKey="test-sym-s4-dual"
        defaultPosition={{ x: 820, y: 5320 }} defaultSize={{ width: 380, height: 320 }}
        viewParams={{ variant: true }} />
      <ViewWindow view="symmetry" group={d6} title="D₆ · 六边形" storageKey="test-sym-d6-def"
        defaultPosition={{ x: 20, y: 5720 }} defaultSize={{ width: 380, height: 320 }} />
      <ViewWindow view="symmetry" group={c8} title="C₈ · 八边形" storageKey="test-sym-c8-def"
        defaultPosition={{ x: 420, y: 5720 }} defaultSize={{ width: 380, height: 320 }} />
      <ViewWindow view="symmetry" group={v4} title="V₄ · 长方形" storageKey="test-sym-v4-def"
        defaultPosition={{ x: 820, y: 5720 }} defaultSize={{ width: 380, height: 320 }} />
      <ViewWindow view="symmetry" group={a5} title="A₅ · 二十面体" storageKey="test-sym-a5-def"
        defaultPosition={{ x: 20, y: 6120 }} defaultSize={{ width: 400, height: 340 }} />
      <ViewWindow view="symmetry" group={q8} title="Q₈ · 不支持" storageKey="test-sym-q8-unsupported"
        defaultPosition={{ x: 440, y: 6120 }} defaultSize={{ width: 380, height: 280 }} />
      <ViewWindow view="symmetry" group={c8} title="C₈ · 受控参数" storageKey="test-sym-c8-ctl"
        defaultPosition={{ x: 840, y: 6120 }} defaultSize={{ width: 380, height: 320 }}
        viewParams={ctlSym} onViewParamsChange={setCtlSym} />
      {/* 固定演示模式：actionLocked=true → ⚙ Action element 只读显示固定元素、无 Reset，
          浮条只剩 ⟳ Replay（对照上方 A₄ 演示窗的可切换模式） */}
      <ViewWindow view="symmetry" group={d6} title="D₆ · 固定演示" storageKey="test-sym-d6-locked"
        defaultPosition={{ x: 20, y: 6520 }} defaultSize={{ width: 400, height: 320 }}
        config={{ actionLocked: true }}
        viewParams={{ showAction: true, actionElementId: d6.elements.find(el => el.id !== d6.identity.id)?.id }} />

      <div style={{ ...row, marginTop: 380 }}>
        <div style={card}><div style={label}>C₆ → C₂ 投影</div>自然投影 mod 2：Ker=C₃（红）、Im=C₂（青），满射非单射</div>
        <div style={card}><div style={label}>S₃ → S₃ 恒等</div>恒等同构：核为单位元、满射单射、isomorphism 标注</div>
        <div style={card}><div style={label}>S₄ → S₃ 满射</div>划分作用 φ：核=V₄ 双对换（红）、满射 S₃，G/Ker=24/4=6≅Im</div>
      </div>

      <ViewWindow view="homomorphism" homomorphism={homoProj} title="C₆ → C₂ · 自然投影" storageKey="test-homo-proj"
        defaultPosition={{ x: 20, y: 6900 }} defaultSize={{ width: 560, height: 420 }} />
      <ViewWindow view="homomorphism" homomorphism={homoId} title="S₃ → S₃ · 恒等" storageKey="test-homo-id"
        defaultPosition={{ x: 620, y: 6900 }} defaultSize={{ width: 560, height: 420 }} />
      <ViewWindow view="homomorphism" homomorphism={homo4to3} title="S₄ → S₃ · 划分作用满同态" storageKey="test-homo-4to3"
        defaultPosition={{ x: 20, y: 7420 }} defaultSize={{ width: 560, height: 420 }} />

      <div style={{ ...row, marginTop: 80 }}>
        <div style={card}><div style={label}>S₃ 共轭</div>conjugation 缺省 · 轨道 1+2+3 · ★=Z(S₃) · 悬停读元素</div>
        <div style={card}><div style={label}>C₄ 平移</div>regular · 传递单轨道 · Stab=e</div>
        <div style={card}><div style={label}>S₃ 自定义预注入</div>custom 预注入 X=3 · 直显已验证</div>
        <div style={card}><div style={label}>A₄ 共轭受控</div>受控回传 kind / 编辑 / Show labels</div>
      </div>

      <ViewWindow view="action" group={s3} title="S₃ · 共轭作用" storageKey="test-act-s3-conj"
        defaultPosition={{ x: 20, y: 7900 }} defaultSize={{ width: 520, height: 400 }} />
      <ViewWindow view="action" group={c4} title="C₄ · 左平移（Cayley）" storageKey="test-act-c4-reg"
        defaultPosition={{ x: 580, y: 7900 }} defaultSize={{ width: 460, height: 380 }}
        viewParams={{ actionKind: 'regular' }} />
      <ViewWindow view="action" group={s3} title="S₃ · 自定义作用（预注入）" storageKey="test-act-s3-custom"
        defaultPosition={{ x: 20, y: 8340 }} defaultSize={{ width: 520, height: 400 }}
        viewParams={{ actionKind: 'custom', setSize: 3, arrows: customS3Arrows }} />
      <ViewWindow view="action" group={a4} title="A₄ · 共轭受控" storageKey="test-act-a4-ctl"
        defaultPosition={{ x: 580, y: 8340 }} defaultSize={{ width: 520, height: 400 }}
        viewParams={ctlAct} onViewParamsChange={setCtlAct} />

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2400 }}>
        每个窗口独立持久化（key: gv-vw-test-*），位置/尺寸/参数刷新恢复。
        覆盖：nodeRadius 极值(10/60)、gap 极值(2/30)、columns 强制(1/3)、
        showLabels 关闭、locked/zoomLocked 锁定、showInfo 隐藏；
        凯莱窗口覆盖：形状切换（circular/dualRing/spiral）、左/右乘、
        作用边元素勾选（All/None）、节点拖拽、选中高亮、受控参数模式；
        3D 窗口覆盖：Layout 形状切换（cone/hexagon，相机自动回正）、左/右乘、
        Node size 滑杆、Auto rotate、Show labels、Edge actions 勾选（All/None）、
        轨道相机（拖拽旋转/滚轮缩放/右键平移/双击复位）、locked 禁相机交互、
        窗口 Ctrl+滚轮不产生 ct 缩放、受控参数模式、持久化 key 含 |3d；
        循环图窗口覆盖：showMaximalCycles 切换、节点半径、标签开关；
        乘法表窗口覆盖：strategy（subgroup/random/full）、单元格尺寸、全屏导出；
        热力图窗口覆盖：纯色块无文字、无最小尺寸（可缩到很小）、strategy 抽样；
        子群格窗口覆盖：LOD 三档自动降级（full/compact/dots）与手动定档、
        mergeConjugates 共轭轨道合并（×n = |G:N_G(H)|）、名片大小滑杆、
        底部 caption 细节行（悬停/点击给出结构符号·指数·正规化子）、受控参数模式；
        陪集条带窗口覆盖：子群 H 下拉（共轭轨道合并、默认首候选）、左/右陪集
        （gH/Hg）、节点标签开关（窗口缺省隐藏，悬停气泡读元素）、顶部 H 凯莱圈开关、
        换群失效回退默认 H、受控参数模式；
        对称性窗口覆盖：几何体映射（Cₙ 有向 n 边形 / Dₙ / A₄ 四面体 / S₄ 立方体 / A₅ 二十面体 / V₄ 长方形）、
        Solid shape 形状选项（立方体↔八面体、二十面体↔十二面体，按形状区分不悬浮切换按钮）、
        Show action 演示（⚙ 面板 Action element 全元素列表，点行触发几何旋转、点已选行重播；
        演示浮条自带 ⟳ Replay 可无限重看当前作用、✕ Reset 回恒等姿态；说明只在浮条单处出现）、
        actionLocked 固定模式（D₆ 窗对照：元素列表只读 + 无 Reset，仅 ⟳ Replay 重看同一作用；
        教学插图用固定窗、可切换窗留给交互探索）、
        Speed 滑杆（0.2–5×）、
        Figure title 标注开关、unsupported 群（Q₈）提示 overlay、无节点悬停引导、
        Ctrl+滚轮不产生 ct 缩放、3D 相机自管理（无 zoom slider）、受控参数模式；
        同态窗口覆盖：双群映射（G→H 映射线 + kernel 红 / image 青着色）、
        Show labels 标签开关（窗口缺省隐藏、悬停就地气泡读元素）、
        homomorphism 单 prop 打包 source/target/mapping、无 group 也可渲染、持久化 key 含 |homomorphism。
        S₄→S₃ 例（划分作用满同态）：非交换群满射展示——核 V₄（4 双对换）红、Im=S₃ 青、
        G/Ker=24/4=6≅Im，第一同构定理可视化。
        群作用窗口覆盖：conjugation / regular / custom 三分段切换、共轭轨道+★ / 平移单轨道、
        custom 编辑流（校验通过写回）、Show labels、OST、受控回传。
      </p>
    </div>
  );
}