/**
 * 座位表图片导出：纯 Canvas 2D 直接绘制（简化版——标题 + 人数 + 讲台 + 纯姓名座位卡）
 * 不含：时间 / 近视数 / 评分 / 座位图标 / 职务 / 标注色条 / 底部图例
 */
import { activeSeats } from '../core/grid.js';

const FONT = '"PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif';

const C = {
  text: '#1e293b', text2: '#64748b', text3: '#94a3b8',
  male: '#38bdf8', maleBg: '#e0f2fe',
  female: '#f472b6', femaleBg: '#fce7f3',
  empty: '#e2e8f0',
  lock: '#d97706',
};

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

/**
 * 绘制座位表图片（简化版）
 * @returns {HTMLCanvasElement}
 */
export function renderSeatingChart(state, { scale = 2 } = {}) {
  const layout = state.layout;
  const seats = activeSeats(layout);
  if (!seats.length) throw new Error('教室没有座位');

  const byId = new Map(state.students.list.map(s => [s.id, s]));
  const locked = new Set(state.locks);

  /* ---------- 尺寸规划 ---------- */
  const W = 1600;
  const pad = 56;
  const aisleW = 34;
  const gridGap = 12;
  const seatW = Math.floor((W - pad * 2 - aisleW * layout.aisles.length
    - gridGap * (layout.seatCols - 1)) / layout.seatCols);
  const seatH = seatW; // 正方形座位卡
  const nameFont = Math.round(seatW * 0.26);

  const titleH = 76, podiumH = 64, podiumGap = 26, legendH = 64;
  const gridH = layout.rows * (seatH + gridGap) - gridGap;
  const H = pad + titleH + podiumH + podiumGap + gridH + legendH + pad - 20;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 白底（打印友好）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';

  /* ---------- 标题 ---------- */
  ctx.fillStyle = C.text;
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('教室座位表', W / 2, pad + 26);

  /* ---------- 讲台 ---------- */
  const podiumY = pad + titleH;
  const podiumW = Math.min(560, (W - pad * 2) * 0.5);
  const grad = ctx.createLinearGradient(W / 2 - podiumW / 2, podiumY, W / 2 + podiumW / 2, podiumY + podiumH);
  grad.addColorStop(0, '#2563eb');
  grad.addColorStop(1, '#1e40af');
  ctx.fillStyle = grad;
  roundRect(ctx, W / 2 - podiumW / 2, podiumY, podiumW, podiumH, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText('讲　台', W / 2, podiumY + podiumH / 2);

  /* ---------- 座位网格（仅姓名 + 性别色） ---------- */
  const gridTop = podiumY + podiumH + podiumGap;
  const gridW = layout.seatCols * seatW + (layout.seatCols - 1) * gridGap
    + layout.aisles.length * aisleW;
  const gridLeft = (W - gridW) / 2;

  const colX = c => {
    let x = gridLeft;
    for (let i = 1; i < c; i++) {
      x += seatW + gridGap;
      if (layout.aisles.includes(i)) x += aisleW;
    }
    return x;
  };

  // 座位号字号（左上角排列号）
  const noFont = Math.round(seatW * 0.145);

  for (const seat of seats) {
    const x = colX(seat.col);
    const y = gridTop + (seat.row - 1) * (seatH + gridGap);
    const sid = state.assignment[seat.id];
    const s = sid !== undefined ? byId.get(sid) : null;
    const isLocked = locked.has(seat.id);

    if (!s) {
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = C.empty;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, seatW, seatH, 10);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const m = s.gender === '男';
      ctx.fillStyle = m ? C.maleBg : C.femaleBg;
      roundRect(ctx, x, y, seatW, seatH, 10);
      ctx.fill();
      ctx.strokeStyle = isLocked ? C.lock : (m ? C.male : C.female);
      ctx.lineWidth = isLocked ? 3 : 2;
      ctx.stroke();
    }

    // 左上角排列号（下移留出呼吸空间）
    ctx.font = `400 ${noFont}px ${FONT}`;
    ctx.fillStyle = C.text3;
    ctx.textAlign = 'left';
    ctx.fillText(`${seat.row}-${seat.col}`, x + 9, y + 19);

    // 姓名（居中，自适应字号；避开角标略下移）
    if (s) {
      let fs = nameFont;
      ctx.font = `600 ${fs}px ${FONT}`;
      while (fs > nameFont * 0.6 && ctx.measureText(s.name).width > seatW - 22) {
        fs -= 2;
        ctx.font = `600 ${fs}px ${FONT}`;
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = C.text;
      ctx.fillText(ellipsize(ctx, s.name, seatW - 22), x + seatW / 2, y + seatH / 2 + noFont * 0.55);
    }
  }

  /* ---------- 底部说明：图例（蓝=男生 / 粉=女生）+ 数量统计（男女带色点） ---------- */
  const legendY = gridTop + gridH + 40;
  const seated = Object.keys(state.assignment).length;
  const male = state.students.list.filter(s => s.gender === '男').length;
  const female = state.students.list.length - male;
  const legendFont = 15;

  // 左侧图例：色块 + 文字
  ctx.font = `400 ${legendFont}px ${FONT}`;
  let lx = pad;
  const legendItem = (bg, border, label) => {
    ctx.fillStyle = bg;
    roundRect(ctx, lx, legendY - 9, 24, 18, 5);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.text2;
    ctx.textAlign = 'left';
    ctx.fillText(label, lx + 32, legendY);
    lx += 32 + ctx.measureText(label).width + 26;
  };
  legendItem(C.maleBg, C.male, '男生');
  legendItem(C.femaleBg, C.female, '女生');

  // 右侧统计：座位/学生/男/女（男女前置色点）
  const dot = (cx, cy, color, r = 6) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  const segs = [
    { t: `座位 ${seated}/${seats.length}` }, { t: '·', gap: true },
    { t: `学生 ${state.students.list.length}` }, { t: '·', gap: true },
    { t: `男 ${male}`, dot: C.male }, { t: '·', gap: true },
    { t: `女 ${female}`, dot: C.female },
  ];
  const dotSpace = 20, segGap = 14;
  const totalW = segs.reduce((w, s) =>
    w + (s.gap ? ctx.measureText(s.t).width : ctx.measureText(s.t).width + (s.dot ? dotSpace : 0)) + segGap, 0)
    - segGap;
  let sx = W - pad - totalW;
  for (const seg of segs) {
    if (seg.dot) {
      dot(sx + 6, legendY, seg.dot);
      sx += dotSpace;
    }
    ctx.fillStyle = seg.gap ? C.text3 : C.text2;
    ctx.textAlign = 'left';
    ctx.fillText(seg.t, sx, legendY);
    sx += ctx.measureText(seg.t).width + segGap;
  }

  return canvas;
}

/** 导出 PNG 图片 */
export function exportSeatImage(state) {
  const canvas = renderSeatingChart(state);
  const downloadViaDataUrl = () => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    triggerDownload(a, filename());
  };
  if (typeof canvas.toBlob !== 'function') { downloadViaDataUrl(); return; }
  canvas.toBlob(blob => {
    if (!blob) { downloadViaDataUrl(); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    triggerDownload(a, filename());
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

function triggerDownload(a, name) {
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}

function filename() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `座位表_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.png`;
}
