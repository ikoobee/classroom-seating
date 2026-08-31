/**
 * 全局快捷键：Ctrl+S 保存 / Ctrl+Z 撤销 / Ctrl+Y（Ctrl+Shift+Z）重做 / Esc 关闭
 */
import { handleModalEscape } from '../components/modal.js';

export function setupShortcuts(app) {
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // 输入框内不拦截 Ctrl+Z/Y（保留文本编辑的原生撤销）
    const inEditable = /^(input|textarea|select)$/i.test(e.target?.tagName ?? '')
      || e.target?.isContentEditable;

    if (mod && key === 's') {
      e.preventDefault();
      app.persistNow();
      app.toast.success('已保存');
      return;
    }
    if (inEditable && mod && (key === 'z' || key === 'y')) return;
    if (mod && !e.shiftKey && key === 'z') {
      e.preventDefault();
      if (app.history.undo()) app.toast.info('已撤销');
      else app.toast.info('没有可撤销的操作');
      return;
    }
    if ((mod && key === 'y') || (mod && e.shiftKey && key === 'z')) {
      e.preventDefault();
      if (app.history.redo()) app.toast.info('已重做');
      else app.toast.info('没有可重做的操作');
      return;
    }
    if (e.key === 'Escape') {
      if (handleModalEscape()) return;
      app.views.classroom?.clearSelection();
    }
  });
}
