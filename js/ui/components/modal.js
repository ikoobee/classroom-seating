/**
 * 通用模态框：栈式管理、Esc 关闭、焦点管理
 */
import { h } from '../dom.js';

const stack = [];

export function openModal({ title, content, footer, width, className, onClose }) {
  const host = document.getElementById('modalHost');
  const overlay = h('div', {
    class: 'modal-overlay',
    onclick: e => { if (e.target === overlay) close(); },
  });
  const dialog = h('div', { class: `modal ${className ?? ''} ${width > 600 ? 'modal-lg' : ''}` });
  if (width) dialog.style.width = `min(${width}px, calc(100vw - 40px))`;

  const closeBtn = h('button', { class: 'modal-close', onclick: () => close() }, '✕');
  dialog.append(
    h('div', { class: 'modal-head' }, h('h3', {}, title), closeBtn),
    h('div', { class: 'modal-body' }, content),
  );
  if (footer && footer.length) dialog.append(h('div', { class: 'modal-foot' }, ...footer));
  overlay.append(dialog);
  host.append(overlay);

  const modal = {
    el: overlay,
    onClose,
    close,
    setTitle(t) { dialog.querySelector('h3').textContent = t; },
  };
  stack.push(modal);
  return modal;

  function close() {
    const i = stack.indexOf(modal);
    if (i >= 0) stack.splice(i, 1);
    overlay.remove();
    onClose?.();
  }
}

export function closeModal(modal) { modal?.close(); }
export function topModal() { return stack[stack.length - 1] ?? null; }
export function closeAllModals() { while (stack.length) stack[stack.length - 1].close(); }

/** Esc 关闭栈顶模态框 */
export function handleModalEscape() {
  const top = topModal();
  if (top) { top.close(); return true; }
  return false;
}
