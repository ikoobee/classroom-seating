/**
 * 非阻塞提示（替代 alert/confirm）
 */
import { h } from '../dom.js';

const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

export const toast = {
  show(message, type = 'info', ms = 2600) {
    const host = document.getElementById('toastHost');
    const el = h('div', { class: `toast toast-${type}` },
      h('span', { class: 'toast-ico' }, ICONS[type] ?? ICONS.info),
      h('span', {}, message),
    );
    host.append(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 260);
    }, ms);
    return el;
  },
  success(m, ms) { return this.show(m, 'success', ms); },
  error(m, ms) { return this.show(m, 'error', ms ?? 3800); },
  warning(m, ms) { return this.show(m, 'warning', ms ?? 3400); },
  info(m, ms) { return this.show(m, 'info', ms); },
};

/** 确认对话框（Promise<boolean>，替代 confirm） */
export function confirmDialog({ title = '确认操作', message, danger = false, okText = '确定', cancelText = '取消' }) {
  return new Promise(resolve => {
    // 延迟导入避免循环依赖
    import('./modal.js').then(({ openModal, closeModal }) => {
      const modal = openModal({
        title: `${danger ? '⚠️' : '❓'} ${title}`,
        width: 380,
        content: h('div', { style: { fontSize: '13.5px', lineHeight: '1.8', color: 'var(--text-2)' } }, message),
        footer: [
          h('button', { class: 'btn', onclick: () => { closeModal(modal); resolve(false); } }, cancelText),
          h('button', {
            class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
            onclick: () => { closeModal(modal); resolve(true); },
          }, okText),
        ],
      });
      modal.onClose = () => resolve(false); // Esc/遮罩关闭
    });
  });
}
