/**
 * Export modal: Excel / JPG image / JSON backup
 */
import { h } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { exportExcel } from '../../services/excel.js';
import { exportSeatImage } from '../../services/image.js';
import { exportCompleteData } from '../../services/backup.js';
import { download } from '../dom.js';

export function openExportModal(app) {
  const state = app.store.getState();
  const seated = Object.keys(state.assignment).length;

  const card = (ico, title, desc, onClick, primary = false) =>
    h('button', {
      class: `btn ${primary ? 'btn-primary' : ''}`,
      style: {
        flexDirection: 'column', gap: 8, padding: '18px 14px', flex: 1, minWidth: 130,
        alignItems: 'center', justifyContent: 'center',
      },
      onclick: onClick,
    },
      h('span', { style: { fontSize: 26 } }, ico),
      h('span', { style: { fontSize: 13.5, fontWeight: 600 } }, title),
      h('span', {
        style: {
          fontSize: 11.5, color: primary ? 'rgba(255,255,255,.85)' : 'var(--text-3)',
          fontWeight: 400, whiteSpace: 'pre-line',
        },
      }, desc),
    );

  const modal = openModal({
    title: '📤 导出数据',
    width: 560,
    content: h('div', { style: { display: 'flex', gap: 12, flexWrap: 'wrap' } },
      card('📊', 'Excel', '学生信息 + 座位表\n两个工作表', async () => {
        try { await exportExcel(app.store.getState()); toast.success('Excel 已导出'); }
        catch (e) { toast.error('导出失败：' + e.message); }
      }, true),
      card('🖼', 'PNG 图片', seated ? '成品座位表（含标题/图例）\n可直接打印或发家长群' : '（座位表为空）', async () => {
        if (!seated) { toast.warning('座位表为空，先排座'); return; }
        try { exportSeatImage(app.store.getState()); toast.success('图片已导出'); }
        catch (e) {
          console.error('[export] 图片导出失败', e);
          toast.error('导出失败：' + (e?.message ?? e));
        }
      }),
      card('🗃', 'JSON 备份', '完整数据备份\n换电脑/换浏览器恢复', () => {
        download(`排座备份_${new Date().toISOString().slice(0, 10)}.json`,
          exportCompleteData(app.store.getState()), 'application/json');
        toast.success('JSON 备份已导出');
      }),
    ),
    footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '关闭')],
  });
  return modal;
}
