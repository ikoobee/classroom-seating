/**
 * Statistics dashboard: attribute distribution donut/bar charts + row×column heatmap (switchable dimension)
 */
import { h, clearEl } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';
import { attributeDistribution, seatHeatmap } from '../../core/stats.js';
import { donut, barList, PALETTE } from '../components/charts.js';
import { HEIGHTS, VISIONS, ACADEMICS, PERSONALITIES, ANNOTATION_COLORS, DIMENSION_COLORS } from '../../core/constants.js';

const ORDER = {
  height: HEIGHTS, vision: VISIONS, academic: ACADEMICS, personality: PERSONALITIES,
};

const HEAT_DIMS = [
  ['gender', '性别'], ['height', '身高'], ['vision', '视力'],
  ['academic', '成绩'], ['personality', '性格'], ['annotation', '标注'],
];

/** Resolve a CSS variable to an actual hex value; returns [border color, 18%-alpha background color] */
function resolveColors(color) {
  let v = color;
  if (v.startsWith('var(')) {
    v = getComputedStyle(document.documentElement)
      .getPropertyValue(v.slice(4, -1)).trim();
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return [v, v + '2e'];
  return [v, 'var(--seat-empty-bg)'];
}

export function openDashboardModal(app) {
  const { store } = app;
  let heatDim = 'gender';

  const chartsBox = h('div', {});
  const heatBox = h('div', {});
  const dimTabs = h('div', { class: 'filter-tabs' },
    HEAT_DIMS.map(([id, label]) => h('button', {
      class: `filter-tab ${id === heatDim ? 'active' : ''}`,
      dataset: { dim: id },
      onclick: e => {
        heatDim = id;
        dimTabs.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        renderHeat();
      },
    }, label)));

  const modal = openModal({
    title: '📈 统计仪表盘',
    width: 860,
    className: 'modal-lg',
    content: h('div', {},
      chartsBox,
      h('div', { style: { marginTop: 22, fontWeight: 600, fontSize: 13.5 } }, '座位热力图'),
      h('div', { style: { fontSize: 12, color: 'var(--text-3)', margin: '5px 0 10px', lineHeight: 1.6 } },
        '按所选维度给每个座位着色，直观查看各属性在教室中的分布'),
      dimTabs,
      heatBox,
    ),
    footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '关闭')],
  });

  /** Dimension value → unified color (shared by charts and the heatmap) */
  function dimColor(dim, value) {
    if (value == null) return 'var(--border-strong)';
    if (dim === 'personality') {
      const idx = PERSONALITIES.indexOf(value);
      return idx >= 0 ? PALETTE[idx % PALETTE.length] : 'var(--border-strong)';
    }
    if (dim === 'annotation') {
      return DIMENSION_COLORS.annotation[value] ?? 'var(--seat-empty-bg)';
    }
    return DIMENSION_COLORS[dim]?.[value] ?? 'var(--border-strong)';
  }

  function renderCharts() {
    const state = store.getState();
    const dist = attributeDistribution(state.students.list);
    clearEl(chartsBox);

    // Bar charts and the heatmap share the same dimColor to keep colors consistent
    const barCard = (title, map, order, dim) => {
      const data = (order ?? [...map.keys()])
        .map(k => [k, map.get(k) ?? 0, dimColor(dim, k)]);
      return h('div', { class: 'chart-card' }, h('h5', {}, title), barList(data));
    };

    chartsBox.append(h('div', { class: 'chart-grid' },
      h('div', { class: 'chart-card' },
        h('h5', {}, `性别分布（共 ${state.students.list.length} 人）`),
        donut([['男', dist.gender.get('男') ?? 0, 'var(--male)'], ['女', dist.gender.get('女') ?? 0, 'var(--female)']]),
        h('div', { style: { display: 'flex', justifyContent: 'center', gap: 14, fontSize: 12, marginTop: 8 } },
          h('span', {}, `🔷 男 ${dist.gender.get('男') ?? 0}`),
          h('span', {}, `🔶 女 ${dist.gender.get('女') ?? 0}`)),
      ),
      barCard('身高分布', dist.height, ORDER.height, 'height'),
      barCard('视力分布', dist.vision, ORDER.vision, 'vision'),
      barCard('成绩分布', dist.academic, ORDER.academic, 'academic'),
      barCard('性格分布', dist.personality, ORDER.personality, 'personality'),
      h('div', { class: 'chart-card' }, h('h5', {}, '标注分布'),
        barList(ANNOTATION_COLORS.map(c =>
          [c.label, dist.annotation.get(c.value) ?? 0, DIMENSION_COLORS.annotation[c.value]]))),
    ));
  }

  function colorFor(dim, value) {
    return dimColor(dim, value);
  }

  function renderHeat() {
    const state = store.getState();
    const byId = new Map(state.students.list.map(s => [s.id, s]));
    const gridData = seatHeatmap(state.layout, state.assignment, byId, heatDim);
    clearEl(heatBox);

    const colCount = state.layout.seatCols + state.layout.aisles.length;
    const table = h('div', {
      style: { display: 'grid', gap: 4, gridTemplateColumns: `auto repeat(${colCount}, 1fr)` },
    });
    table.append(h('div', {})); // Top-left corner cell
    // Column headers: seat columns + aisle gaps
    for (let c = 1; c <= state.layout.seatCols; c++) {
      table.append(h('div', { style: { fontSize: 10, color: 'var(--text-3)', textAlign: 'center' } }, `列${c}`));
      if (state.layout.aisles.includes(c)) {
        table.append(h('div', { style: { fontSize: 9, color: 'var(--text-3)', textAlign: 'center' } }, '⬍'));
      }
    }
    for (let r = 0; r < state.layout.rows; r++) {
      table.append(h('div', { style: { fontSize: 10, color: 'var(--text-3)', display: 'flex', alignItems: 'center' } }, `第${r + 1}排`));
      for (const cell of gridData[r]) {
        if (cell?.aisle) { table.append(h('div', { style: { minHeight: 26 } })); continue; }
        if (!cell) {
          table.append(h('div', {
            style: { minHeight: 26, borderRadius: 4, background: 'var(--seat-empty-bg)', border: '1px dashed var(--border)' },
            title: '空座位',
          }));
          continue;
        }
        const color = colorFor(heatDim, cell.value);
        const [border, bg] = resolveColors(color);
        table.append(h('div', {
          class: 'heat-cell',
          style: {
            minHeight: 26, borderRadius: 4, border: `2px solid ${border}`,
            background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, overflow: 'hidden',
          },
          title: `${cell.student.name} · ${cell.value}`,
        }, cell.student.name.slice(0, 3)));
      }
    }
    heatBox.append(table);
  }

  renderCharts();
  renderHeat();
  return modal;
}
