/**
 * Arrangement log modal: list (summary index) / lazy-loaded details / filters / delete / export
 */
import { h, clearEl, appendKids, fmtTime, download } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';
import { dimBar } from '../components/charts.js';
import { confirmDialog } from '../components/toast.js';

const TYPE_META = {
  seat: { label: '排座', cls: 'type-seat', ico: '🎯' },
  rotate: { label: '轮换', cls: 'type-rotate', ico: '🔄' },
  manual: { label: '手动', cls: 'type-manual', ico: '✋' },
  import: { label: '导入', cls: 'type-import', ico: '📥' },
};

export function openLogModal(app) {
  const { store, logger, toast } = app;
  let filter = 'all';
  const listBox = h('div', {});
  const statsLine = h('div', { style: { fontSize: 12, color: 'var(--text-3)', margin: '10px 2px 12px' } });

  const filters = [['all', '全部'], ['seat', '排座'], ['rotate', '轮换'], ['manual', '手动'], ['import', '导入']];
  const tabs = h('div', { class: 'filter-tabs' }, filters.map(([k, label]) =>
    h('button', {
      class: `filter-tab ${k === 'all' ? 'active' : ''}`,
      dataset: { f: k },
      onclick: e => {
        filter = k;
        tabs.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        render();
      },
    }, label)));

  const modal = openModal({
    title: '📋 排座日志',
    width: 720,
    className: 'modal-lg',
    content: h('div', {}, tabs, statsLine, listBox),
    footer: [
      h('button', {
        class: 'btn btn-danger',
        onclick: async () => {
          if (!store.getState().logs.length) { toast.info('日志已为空'); return; }
          const ok = await confirmDialog({ title: '清空日志', danger: true, message: '确定删除全部排座日志？' });
          if (ok) { logger.clearLogs(); render(); toast.success('日志已清空'); }
        },
      }, '🗑 清空'),
      h('button', {
        class: 'btn',
        onclick: () => {
          download('排座日志.json', logger.exportLogs(), 'application/json');
          toast.success('日志已导出');
        },
      }, '📤 导出'),
      h('button', { class: 'btn', onclick: () => closeModal(modal) }, '关闭'),
    ],
  });

  function render() {
    clearEl(listBox);
    const logs = store.getState().logs
      .filter(l => filter === 'all' || l.type === filter);
    statsLine.textContent = `共 ${logs.length} 条（最多保留 100 条，详情懒加载、超量自动清理，不会撑爆存储）`;

    if (!logs.length) {
      listBox.append(h('div', { class: 'empty-tip' }, '暂无日志<br>每次智能排座 / 轮换 / 手动调整都会记录在这里'));
      return;
    }
    logs.forEach(l => {
      const meta = TYPE_META[l.type] ?? TYPE_META.manual;
      const detailBox = h('div', {});
      const row = h('div', { class: 'list-row', style: { cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' } },
          h('span', { class: `type-tag ${meta.cls}` }, meta.ico + ' ' + meta.label),
          h('div', { class: 'lr-main' },
            h('div', { class: 'lr-title' }, l.label ?? '—'),
            h('div', { class: 'lr-sub' }, fmtTime(l.ts) + (l.score !== undefined ? ` · 评分 ${l.score}` : ''))),
          h('button', {
            class: 'btn btn-sm btn-danger', title: '删除',
            onclick: e => { e.stopPropagation(); logger.deleteLog(l.id); render(); },
          }, '✕'),
        ),
        detailBox,
      );
      let loaded = false;
      row.addEventListener('click', async () => {
        if (loaded) { detailBox.hidden = !detailBox.hidden; return; }
        loaded = true;
        const d = logger.getDetail(l.id);
        detailBox.hidden = false;
        detailBox.append(renderDetail(d));
      });
      listBox.append(row);
    });
  }

  function renderDetail(d) {
    if (!d) {
      return h('div', { style: { fontSize: 12, color: 'var(--text-3)', padding: '8px 2px 2px' } },
        '（详情已随存储优化自动清理，仅保留摘要）');
    }
    const box = h('div', { style: { padding: '12px 2px 2px', borderTop: '1px dashed var(--border)', marginTop: 10 } });

    if (d.dimensions?.length) {
      appendKids(box,
        h('div', { style: { fontWeight: 600, fontSize: 12.5, marginBottom: 10 } }, '维度得分'),
        d.dimensions.map(dim => dimBar(dim.name, dim.score, dim.weight)));
    }
    if (d.hardViolations?.length) {
      box.append(h('div', { class: 'hard-block', style: { marginTop: 8 } },
        d.hardViolations.map(v => h('div', {}, '• ' + v.msg))));
    }
    if (d.warnings?.length) {
      box.append(h('div', { class: 'warn-block' }, d.warnings.map(w => h('div', {}, '• ' + w))));
    }
    const note = d.seedNote ?? d.note ?? (d.modeName ? `方式：${d.modeName}，迁移 ${d.moved} 个座位` : null);
    if (note) box.append(h('div', { class: 'kv-grid', style: { marginTop: 6 } },
      h('span', { class: 'k' }, '说明'), h('span', {}, note)));
    if (d.meta) {
      box.append(h('div', { class: 'kv-grid', style: { marginTop: 6 } },
        h('span', { class: 'k' }, '算法'), h('span', {},
          `迭代 ${d.meta.iterations ?? '-'} 次 · 耗时 ${d.meta.elapsedMs ?? '-'}ms`)));
    }
    return box;
  }

  render();
  return modal;
}
