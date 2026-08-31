/**
 * Candidate comparison modal: table of N candidates + mini classroom preview + apply
 */
import { h, clearEl, appendKids } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';
import { dimBar } from '../components/charts.js';

export function openCandidatesModal(app, result, prevBaseline, onApply) {
  const { candidates, warnings } = result;
  const studentsById = new Map(app.store.getState().students.list.map(s => [s.id, s]));
  let selected = candidates[0];

  const previewBox = h('div', { id: 'candPreview' });
  const detailBox = h('div', { id: 'candDetail' });

  const table = h('table', { class: 'data-table' },
    h('thead', {}, h('tr', {},
      h('th', {}, '#'), h('th', {}, '总分'), h('th', {}, '维度表现'), h('th', {}, '耗时'))),
    h('tbody', {}, candidates.map((c, i) => {
      const tr = h('tr', {
        class: `clickable ${i === 0 ? 'row-active' : ''}`,
        dataset: { idx: String(i) },
        onclick: () => {
          selected = c;
          table.querySelectorAll('tr').forEach(r => r.classList.remove('row-active'));
          tr.classList.add('row-active');
          renderPreview();
        },
      },
        h('td', {}, i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1)),
        h('td', {}, h('b', {
          style: { color: c.score.total >= 80 ? 'var(--success)' : c.score.total >= 50 ? 'var(--warning)' : 'var(--danger)', fontSize: 15 },
        }, String(c.score.total))),
        h('td', {}, c.score.dimensions.slice(0, 5).map(d => `${d.name} ${d.score}`).join('　') +
          (c.score.dimensions.length > 5 ? ' …' : '')),
        h('td', {}, `${c.meta.elapsedMs}ms`),
      );
      return tr;
    })));

  function renderPreview() {
    clearEl(previewBox);
    clearEl(detailBox);

    // Mini classroom (seat columns + aisle gaps)
    const state = app.store.getState();
    const layout = state.layout;
    const gridCols = [];
    for (let c = 1; c <= layout.seatCols; c++) {
      gridCols.push('1fr');
      if (layout.aisles.includes(c)) gridCols.push('10px');
    }
    const mini = h('div', { class: 'mini-grid', style: { gridTemplateColumns: gridCols.join(' ') } });
    for (let r = 1; r <= layout.rows; r++) {
      for (let c = 1; c <= layout.seatCols; c++) {
        const sid = selected.assignment[`${r}-${c}`];
        const s = sid !== undefined ? studentsById.get(sid) : null;
        mini.append(h('div', {
          class: `mini-seat ${s ? (s.gender === '男' ? 'ms-m' : 'ms-f') : ''}`,
          title: s ? `${s.name} · ${s.academic} · ${s.personality}` : '空座位',
        }, s ? s.name.slice(0, 3) : ''));
        if (layout.aisles.includes(c)) mini.append(h('div', {}));
      }
    }
    previewBox.append(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 4px', fontWeight: 600, fontSize: 13 } },
        `方案预览（种子 ${selected.seed}）`,
        h('span', { style: { fontWeight: 400, color: 'var(--text-3)', fontSize: 11.5 } }, '蓝=男生，粉=女生，悬停查看详情')),
      mini,
    );

    // Dimension comparison
    appendKids(detailBox,
      h('div', { style: { fontWeight: 600, fontSize: 13, margin: '18px 0 10px' } }, '维度得分'),
      selected.score.dimensions.map(d => dimBar(d.name, d.score, d.weight)),
      selected.score.hardViolations.length ? h('div', { class: 'hard-block', style: { marginTop: 12 } },
        h('div', { style: { fontWeight: 600 } }, `⛔ ${selected.score.hardViolations.length} 项硬约束未满足`),
        selected.score.hardViolations.map(v => h('div', {}, '• ' + v.msg)),
      ) : null,
    );
  }

  const modal = openModal({
    title: `🏆 候选方案对比（共 ${candidates.length} 个，按总分排序）`,
    width: 860,
    className: 'modal-lg',
    content: h('div', {},
      warnings.length ? h('div', { class: 'warn-block' },
        h('div', { style: { fontWeight: 600, marginBottom: 4 } }, '⚠️ 生成提示'),
        warnings.map(w => h('div', {}, '• ' + w)),
      ) : null,
      table,
      previewBox,
      detailBox,
    ),
    footer: [
      h('button', { class: 'btn', onclick: () => closeModal(modal) }, '取消'),
      h('button', {
        class: 'btn btn-primary',
        onclick: () => { closeModal(modal); onApply(selected); },
      }, `应用此方案（${selected.score.total} 分）`),
    ],
  });
  renderPreview();
  return modal;
}
