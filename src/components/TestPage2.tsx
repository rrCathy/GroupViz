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
// FIG_SYM：对称性演示插图——锁定位移与相机、隐藏缩放滑杆；actionLocked 把演示元素「钉」在
//           viewParams.actionElementId（⚙ 面板元素列表只读、无 Reset），读者只能点浮条 ⟳ Replay
//           反复重看同一作用——教学插图语义：固定一个对称作用、反复观看，不提供切换。
const FIGURE = { locked: true, resizable: false, showInfo: true, showControls: false, showZoomSlider: false };
const LOCKED = { locked: true, resizable: false, showInfo: true };
const FIG_SYM = { locked: true, resizable: false, showInfo: true, showZoomSlider: false, actionLocked: true };

export default function TestPage2() {
  const a4 = useMemo(() => createAlternatingGroup(4), []);
  const { viewWindowTheme, toggleViewWindowTheme } = useTheme();

  // 取一个 3-循环（阶 3 元素）作为四面体旋转演示：绕「顶点–对面心」轴转 ±120°
  const a4ThreeCycleId = useMemo(() => {
    for (const el of a4.elements) {
      if (el.id === a4.identity.id) continue
      let cur = el
      for (let i = 1; i < 3; i++) cur = a4.multiply(cur, el)
      if (cur.id === a4.identity.id) return el.id
    }
    return null
  }, [a4])

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
          它既是一类经典的有限群,也是<span style={strong}>正四面体的旋转对称群</span>——下面用六个可交互的可视化窗口,
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

        {/* ============ 第 6 节：陪集分解（V₄ 的三条带） ============ */}
        <section style={section}>
          <div style={prose}>
            <div style={sectionIndex}>06 · 陪集分解</div>
            <h2 style={h2}>一个子群把群切成等大的「条」</h2>
            <p style={lead}>
              正规子群 V₄ 在 A₄ 里把 12 个元素均匀地分成 <span style={strong}>3 条陪集</span>，
              每条恰好 4 个元素——这就是 Lagrange 定理说的 |A₄| = |V₄| · [A₄:V₄] = 4·3。
            </p>
            <ul style={ul}>
              <li>第一条 <span style={mono}>H = V₄</span> 本身：恒等 e + 3 个双对换；</li>
              <li>第二条 <span style={mono}>xH</span>：拿一个 3-循环 x 去乘 H 的每个元素，整条平移；</li>
              <li>第三条 <span style={mono}>yH</span>：用另一个 3-循环 y，得到剩下的 4 个 3-循环。</li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              右侧陪集条带把每个陪集排成一列、用同色标出。左右相邻的列都是 V₄ 的
              <span style={strong}>平移副本</span>——商群 A₄/V₄ ≅ C₃ 正是把这三条「粘回一个点」得到的。
              H 可从 ⚙ 参数里换成别的子群（如单个 C₃），条带数随即变为 [A₄:C₃] = 4。
            </p>
          </div>
          <figure style={figure}>
            <ViewWindow view="cosetstrip" group={a4} title="图 6 · 陪集条带" storageKey="a4-blog-coset"
              defaultPosition={{ x: 0, y: 0 }} defaultSize={{ width: 456, height: 436 }}
              config={LOCKED} />
            <figcaption style={caption}>图 6 A₄ 按 V₄ 分解成 3 条带（每条 4 元素）；⚙ 中可切换 H 观察 [G:H] 变化</figcaption>
          </figure>
        </section>

        {/* ============ 第 7 节：A₄ = 正四面体的旋转群 ============ */}
        <section style={section}>
          <div style={prose}>
            <div style={sectionIndex}>07 · 几何对称</div>
            <h2 style={h2}>A₄ 就是正四面体的「旋转群」</h2>
            <p style={lead}>
              正四面体有 4 个顶点、4 个三角面、6 条棱——把它拿在手里转，一共有
              <span style={strong}>12 种不同姿态</span>，恰好等于 |A₄|。
            </p>
            <ul style={ul}>
              <li><span style={strong}>8 个 3-循环</span> = 绕「顶点–对面中心」轴旋转
                <span style={em}>±120°</span>（4 条轴 × 2 个方向）；</li>
              <li><span style={strong}>3 个双对换</span> = 绕相对棱中点的轴旋转
                <span style={em}>180°</span>（3 条棱轴）；</li>
              <li><span style={strong}>恒等 e</span> = 什么都不转。</li>
            </ul>
            <p>
              这就是 A₄ 又叫<span style={strong}>四面体群</span>的原因：它的每个元素都可以看成
              对正四面体的一个真实空间旋转，乘法 = 先转再转。
            </p>
            <p style={{ marginBottom: 0 }}>
              右侧窗口默认演示一个 3-循环的 120° 旋转：几何体绕轴转动、红色轴与穿过的
              顶点/棱/面心被同时标出，窗口底部浮条说明当前演示。浮条自带
              <b> ⟳ Replay</b>（同一旋转可反复重看，不必刷新页面）与 <b>✕ Reset</b>（回到恒等姿态）；
              打开窗口 ⚙（View Config），在「Action element」列表中选择任意元素，
              可逐个查看每个对称作用（再点已选行即重播该作用）。
            </p>
          </div>
          <figure style={figure}>
            <ViewWindow view="symmetry" group={a4} title="图 7 · A₄ 在正四面体上的作用" storageKey="a4-blog-symmetry"
              defaultPosition={{ x: 0, y: 0 }} defaultSize={{ width: 456, height: 440 }}
              config={FIG_SYM}
              viewParams={{ showAction: true, actionElementId: a4ThreeCycleId }} />
            <figcaption style={caption}>图 7 A₄ = 正四面体旋转群：⚙ 面板选元素，观察 120°/180° 对称旋转与旋转轴</figcaption>
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
