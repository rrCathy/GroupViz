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
import { useTheme } from '../theme/useTheme';

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
  const { viewWindowTheme, toggleViewWindowTheme } = useTheme();
  const [lockCfg, setLockCfg] = useState<{ locked?: boolean; zoomLocked?: boolean }>({ locked: true, zoomLocked: true });
  const [ctlParams, setCtlParams] = useState<ViewParams>({});
  const [ctl3d, setCtl3d] = useState<ViewParams>({ autoRotate: true, multiplyType: 'left' });

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

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 720 }}>
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
        热力图窗口覆盖：纯色块无文字、无最小尺寸（可缩到很小）、strategy 抽样。
      </p>
    </div>
  );
}