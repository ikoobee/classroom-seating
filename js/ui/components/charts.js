/**
 * 纯 SVG 图表：环形图 / 条形图（无需图表库）
 */
import { h } from '../dom.js';

export const PALETTE = ['#2563eb', '#f472b6', '#16a34a', '#d97706', '#a855f7', '#0891b2', '#dc2626', '#64748b'];

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG 元素工厂（必须用 createElementNS，否则浏览器不渲染） */
function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, String(v));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** 环形图。data: [[label, value, color?], ...] */
export function donut(data, { size = 120, thickness = 20 } = {}) {
  const total = data.reduce((s, [, v]) => s + v, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const segs = total === 0
    ? [svgEl('circle', { cx: c, cy: c, r, fill: 'none', stroke: 'var(--seat-empty-bg)', 'stroke-width': thickness })]
    : data.map(([label, value, color], i) => {
      const frac = value / total;
      const el = svgEl('circle', {
        cx: c, cy: c, r,
        fill: 'none',
        stroke: color ?? PALETTE[i % PALETTE.length],
        'stroke-width': thickness,
        'stroke-dasharray': `${circ * frac} ${circ * (1 - frac)}`,
        'stroke-dashoffset': -circ * offset,
        transform: `rotate(-90 ${c} ${c})`,
      }, svgEl('title', {}, `${label}: ${value}`));
      offset += frac;
      return el;
    });

  const svg = svgEl('svg', {
    class: 'chart-svg', viewBox: `0 0 ${size} ${size}`, width: size, height: size,
  }, ...segs);
  const num = h('div', {
    style: {
      position: 'absolute', inset: 0, display: 'flex', 'align-items': 'center',
      'justify-content': 'center', 'flex-direction': 'column', 'font-weight': 700, 'font-size': 20,
    },
  }, total);
  return h('div', { style: { position: 'relative', width: size, height: size, margin: '0 auto' } }, svg, num);
}

/** 水平条形图（HTML 实现）。data: [[label, value, color?], ...]，max 最大刻度 */
export function barList(data, { max } = {}) {
  const m = max ?? Math.max(1, ...data.map(([, v]) => v));
  return h('div', {}, data.map(([label, value, color], i) => h('div', { class: 'bar-row' },
    h('span', { class: 'bl' }, label),
    h('div', { class: 'btrack' },
      h('div', { class: 'bfill', style: { width: `${(value / m) * 100}%`, background: color ?? PALETTE[i % PALETTE.length] } })),
    h('span', { class: 'bv' }, value),
  )));
}

/** 维度评分条（带权重标识） */
export function dimBar(name, score, weight) {
  const color = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  return h('div', { class: 'dim-bar' },
    h('span', { class: 'dl' }, name),
    h('div', { class: 'dtrack' },
      h('div', { class: 'dfill', style: { width: `${score}%`, background: color } })),
    h('span', { class: 'dv' }, `${score} · 权重${weight}`),
  );
}
