/**
 * TestPage2 — 群 A₄（交错群）可视化入门博客
 * 一篇图文交织的现代前端博客：每个概念小节用文字讲解 + 一个锁定（不可拖拽）的 ViewWindow 插图，
 * 让初学者能直观理解 A₄ 的结构。
 * 用法：URL 加 ?test=2 或 ?page=test2（见 src/main.tsx）
 */
import { useMemo } from 'react';
import { ViewWindow } from './Canvas/FloatingViewWindow'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup';
import { useTheme } from '../theme/useTheme';

/* ===== 排版样式常量（深色现代博客） ===== */
const page: React.CSSProperties = {
  background: 'linear-gradient(180deg, #0b1120 0%, #0f172a 40%, #0f172a 100%)',
  minHeight: '100vh', color: '#cbd5e1', fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
};
const container: React.CSSProperties = { maxWidth: 1060, margin: '0 auto', padding: '48px 28px 80px' };

const heroTitle: React.CSSProperties = {
  margin: 0, fontSize: 42, fontWeight: 800, color: '#f8fafc', lineHeight: 1.15,
  letterSpacing: '-0.5px',
};
const heroSub: React.CSSProperties = {
  margin: '14px 0 0', fontSize: 17, color: '#94a3b8', lineHeight: 1.7, maxWidth: 720,
};
const statsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26 };
const statChip: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
  padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2,
};
const statNum: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: '#4ecdc4' };
const statLabel: React.CSSProperties = { fontSize: 12, color: '#94a3b8' };

const section: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start',
  marginTop: 64, paddingTop: 32, borderTop: '1px solid #1e293b',
};
const sectionIndex: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, color: '#4ecdc4', letterSpacing: 1, marginBottom: 6,
};
const h2: React.CSSProperties = { margin: 0, fontSize: 26, fontWeight: 750, color: '#f1f5f9', lineHeight: 1.3 };
const prose: React.CSSProperties = { flex: '1 1 340px', minWidth: 300, fontSize: 15, lineHeight: 1.85, color: '#cbd5e1' };
const lead: React.CSSProperties = { fontSize: 16.5, color: '#e2e8f0', fontWeight: 500, margin: '10px 0 12px' };
const em: React.CSSProperties = { color: '#4ecdc4', fontWeight: 650 };
const strong: React.CSSProperties = { color: '#f1f5f9', fontWeight: 650 };
const ul: React.CSSProperties = { margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 };
const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  background: '#1e293b', border: '1px solid #334155', borderRadius: 5,
  padding: '1px 6px', fontSize: 13.5, color: '#fbbf24',
};

const figure: React.CSSProperties = {
  position: 'relative', flex: '0 0 auto', width: 480, minHeight: 400,
  background: 'rgba(30,41,59,0.4)', borderRadius: 14, padding: 12,
  border: '1px solid #1e293b',
};
const caption: React.CSSProperties = {
  margin: 0, fontSize: 12.5, color: '#64748b', textAlign: 'center', lineHeight: 1.6,
  position: 'absolute', bottom: 0, left: 12, right: 12, padding: '4px 0',
};
const wideFigure: React.CSSProperties = {
  ...figure, width: '100%', minHeight: 720, display: 'flex', justifyContent: 'center',
};

const closing: React.CSSProperties = {
  marginTop: 72, padding: '28px 32px', borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(78,205,196,0.12), rgba(56,189,248,0.08))',
  border: '1px solid #1e293b',
};

/* ===== 锁定配置 ===== */
// FIGURE：专注阅读的静态插图——锁定位移、隐藏窗口控件与缩放滑杆，
//         凯莱图只显示节点和边（不显示节点标签），悬停节点亮起高亮环、就地浮出元素名与阶。
// LOCKED：保留完整控件的交互式窗口（对照示例，供博客作者按需选择）。
const FIGURE = { locked: true, resizable: false, showInfo: true, showControls: false, showZoomSlider: false };
const LOCKED = { locked: true, resizable: false, showInfo: true };

export default function TestPage2() {
  const a4 = useMemo(() => createAlternatingGroup(4), []);
  const { viewWindowTheme, toggleViewWindowTheme } = useTheme();

  return (
    <div style={page}>
      <div style={container}>
        {/* ============ Hero ============ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={toggleViewWindowTheme}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #334155', background: viewWindowTheme === 'dark' ? '#4ecdc4' : '#ffd93d', color: '#0f172a', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
          >{viewWindowTheme === 'dark' ? '■ 深色窗口' : '□ 浅色窗口'}</button>
        </div>

        <h1 style={heroTitle}>群 A₄：正四面体的对称群</h1>
        <p style={heroSub}>
          交错群 A₄ 是 4 个对象上的全部<span style={strong}>偶置换</span>，一共 12 个元素。
          它既是一类经典的有限群，也是<span style={strong}>正四面体的旋转对称群</span>——下面用五个可交互的可视化窗口，
          一步步把它看清楚。
        </p>
        <div style={statsRow}>
          <div style={statChip}><span style={statNum}>12</span><span style={statLabel}>阶 |A₄| = 4!/2</span></div>
          <div style={statChip}><span style={statNum}>2</span><span style={statLabel}>生成元 a、b</span></div>
          <div style={statChip}><span style={statNum}>V₄</span><span style={statLabel}>唯一非平凡正规子群</span></div>
          <div style={statChip}><span style={statNum}>V₄ ⋊ C₃</span><span style={statLabel}>半直积分解</span></div>
          <div style={statChip}><span style={statNum}>4</span><span style={statLabel}>共轭类</span></div>
        </div>

        {/* ============ 第 1 节：什么是 A₄ ============ */}
        <section style={section}>
          <div style={prose}>
            <div style={sectionIndex}>01 · 什么是 A₄</div>
            <h2 style={h2}>12 个偶置换</h2>
            <p style={lead}>
              把 4 个位置（1、2、3、4）重新排列，共有 4! = 24 种方式。其中一半是<span style={em}>偶置换</span>，
              另一半是奇置换。偶置换构成了一个群——它就是<span style={strong}>交错群 A₄</span>。
            </p>
            <p>
              这 12 个元素可以分成三类：
            </p>
            <ul style={ul}>
              <li><span style={mono}>e</span> —— 恒等（什么都不动）；</li>
              <li><span style={strong}>8 个 3-循环</span>，如 <span style={mono}>(123)</span>（1→2→3→1，4 不动）；</li>
              <li><span style={strong}>3 个双对换</span>，如 <span style={mono}>(12)(34)</span>（同时交换 1↔2 和 3↔4）。</li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              右侧的集合视图把 12 个元素摊开：悬停可读元素名与阶，点击可选中观察，Ctrl+滚轮缩放。
            </p>
          </div>
          <figure style={figure}>
            <ViewWindow view="set" group={a4} title="图 1 · 集合视图" storageKey="a4-blog-set"
              defaultPosition={{ x: 0, y: 0 }} defaultSize={{ width: 456, height: 348 }}
              config={FIGURE} />
            <figcaption style={caption}>图 1 A₄ 的 12 个元素：1 个恒等 + 8 个 3-循环 + 3 个双对换（悬停可读元素名）</figcaption>
          </figure>
        </section>

        {/* ============ 第 2 节：生成元 ============ */}
        <section style={section}>
          <div style={prose}>
            <div style={sectionIndex}>02 · 生成元</div>
            <h2 style={h2}>两个元素就能生成整个群</h2>
            <p style={lead}>
              不用记 12 个元素，只要两个「生成元」，反复相乘就能走遍整个 A₄：
            </p>
            <ul style={ul}>
              <li><span style={mono}>a = (12)(34)</span>，交换两次回到原样，<span style={em}>阶 2</span>；</li>
              <li><span style={mono}>b = (234)</span>，连做 3 次回到原样，<span style={em}>阶 3</span>。</li>
            </ul>
            <p>
              右侧凯莱图中，<span style={{ color: '#ff6b6b', fontWeight: 650 }}>红色边</span>代表乘 a、
              <span style={{ color: '#4ecdc4', fontWeight: 650 }}>青色边</span>代表乘 b。整张图是一个
              <span style={strong}>截角四面体</span>：12 个顶点、18 条边——正四面体削去 4 个角后正是这个形状，
              这也暗示了 A₄ 与正四面体的联系。窗口默认只显示节点和边：悬停任意顶点，节点会亮起高亮环，
              右下角浮出它的元素名与阶。
            </p>
          </div>
          <figure style={figure}>
            <ViewWindow view="cayley" group={a4} title="图 2 · 凯莱图" storageKey="a4-blog-cayley"
              defaultPosition={{ x: 0, y: 0 }} defaultSize={{ width: 456, height: 388 }}
              config={FIGURE} />
            <figcaption style={caption}>图 2 A₄ 的凯莱图 = 截角四面体骨架（红 = 乘 a，青 = 乘 b）；悬停顶点查看元素</figcaption>
          </figure>
        </section>

        {/* ============ 第 3 节：循环结构 ============ */}
        <section style={section}>
          <div style={prose}>
            <div style={sectionIndex}>03 · 循环结构</div>
            <h2 style={h2}>元素按「阶」分门别类</h2>
            <p style={lead}>
              每个元素连乘自己若干次会回到恒等，这个次数叫「阶」。
            </p>
            <ul style={ul}>
              <li>8 个 3-循环的阶是 <span style={em}>3</span>，每个生成一个循环群 C₃；</li>
              <li>3 个双对换的阶是 <span style={em}>2</span>，每个生成 C₂。</li>
            </ul>
            <p>
              右侧循环图把这些循环子群画成一个个环：3-循环是三角形，双对换是两点一线。
              注意图中 4 个三角形彼此<span style={strong}>共轭</span>——它们地位相同，对应 4 个共轭的 C₃ 子群。
            </p>
          </div>
          <figure style={figure}>
            <ViewWindow view="cycle" group={a4} title="图 3 · 循环图" storageKey="a4-blog-cycle"
              defaultPosition={{ x: 0, y: 0 }} defaultSize={{ width: 456, height: 388 }}
              config={FIGURE} />
            <figcaption style={caption}>图 3 循环图：4 个 C₃ 三角形 + 3 个 C₂ 线段，共享恒等 e</figcaption>
          </figure>
        </section>

        {/* ============ 第 4 节：乘法表 ============ */}
        <section style={{ ...section, flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ ...prose, maxWidth: 760, width: '100%' }}>
            <div style={sectionIndex}>04 · 乘法表</div>
            <h2 style={h2}>逐格验证群结构</h2>
            <p style={lead}>
              乘法表把「任意两个元素相乘得到谁」完整列出，行 × 列 = 结果。
              这是最严谨的方式，但也最费空间——12×12 一共 144 格。
            </p>
            <p>
              放大观察左上角的 <span style={em}>4×4 块</span>：它正是由 e 和 3 个双对换组成的
              <span style={strong}>正规子群 V₄</span>（Klein 四元群）。这一块自身封闭、自成一体，
              是 A₄ 里唯一非平凡的正规子群，而商群 A₄/V₄ ≅ C₃。
            </p>
          </div>
          <figure style={wideFigure}>
            <ViewWindow view="table" group={a4} title="图 4 · 乘法表" storageKey="a4-blog-table"
              defaultPosition={{ x: 0, y: 0 }} defaultSize={{ width: 664, height: 690 }}
              config={LOCKED} />
            <figcaption style={caption}>图 4 12×12 乘法表：左上 4×4 块即正规子群 V₄（本图保留完整控件，供交互式阅读）</figcaption>
          </figure>
        </section>

        {/* ============ 第 5 节：热力图 ============ */}
        <section style={section}>
          <div style={prose}>
            <div style={sectionIndex}>05 · 热力图</div>
            <h2 style={h2}>一眼看穿对称性</h2>
            <p style={lead}>
              把乘法表里每个结果换成一种<span style={em}>颜色</span>、去掉所有文字，就得到热力图。
              颜色 = 结果元素，因此相同的颜色分布就是相同的结构规律。
            </p>
            <p>
              热力图的价值在于<span style={strong}>用颜色密度呈现宏观结构</span>——不需要读任何一格，
              就能看出左上角 V₄ 子群的整齐色块，以及 3-循环陪集带来的周期性花纹。
              它也是唯一「缩得再小也看得清」的视图，适合快速比对不同群的对称性。
            </p>
          </div>
          <figure style={{ ...figure, width: 420 }}>
            <ViewWindow view="heatmap" group={a4} title="图 5 · 热力图" storageKey="a4-blog-heatmap"
              defaultPosition={{ x: 0, y: 0 }} defaultSize={{ width: 396, height: 368 }}
              config={FIGURE} />
            <figcaption style={caption}>图 5 12×12 热力图：颜色 = 结果元素，V₄ 块清晰可见</figcaption>
          </figure>
        </section>

        {/* ============ 结尾 ============ */}
        <div style={closing}>
          <h2 style={{ ...h2, fontSize: 20, marginBottom: 10 }}>小结与延伸</h2>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.85 }}>
            一句话记住 A₄：<span style={strong}>12 阶、非阿贝尔、可解但非幂零，是正四面体的旋转群，结构为 V₄ ⋊ C₃</span>。
            它往上加一个 5-循环就得到 60 阶的 A₅（最小的非可解群，正二十面体的旋转群）；再套进 S₄ 里，
            A₄ 正是对称群 S₄ 的导群。理解 A₄，是理解置换群与几何对称之间桥梁的第一步。
          </p>
        </div>
      </div>
    </div>
  );
}
