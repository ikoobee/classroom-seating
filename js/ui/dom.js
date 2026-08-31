/**
 * DOM 工具：元素工厂、事件委托、转义、下载
 */

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function clearEl(el) { while (el.firstChild) el.removeChild(el.firstChild); }

/**
 * 安全 append：展平数组、剔除 null/undefined。
 * 原生 Element.append 会把数组渲染为 "[object HTMLDivElement]"、把 null 渲染为 "null"。
 */
export function appendKids(el, ...children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function download(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** 下拉菜单：点击按钮弹出，点击外部关闭 */
export function popupMenu(anchorBtn, items) {
  // 关闭已有菜单
  document.querySelector('.menu')?.remove();
  const menu = h('div', { class: 'menu' });
  for (const item of items) {
    if (item === '-') { menu.append(h('div', { style: { height: '1px', background: 'var(--border)', margin: '4px 6px' } })); continue; }
    if (item.title) { menu.append(h('div', { class: 'menu-title' }, item.title)); continue; }
    menu.append(h('button', {
      class: 'menu-item',
      onclick: () => { menu.remove(); item.onClick?.(); },
    },
      h('span', { class: 'mi-ico' }, item.ico ?? ''),
      h('span', {}, item.label),
      item.hint ? h('span', { style: { marginLeft: 'auto', color: 'var(--text-3)', fontSize: '11px' } }, item.hint) : null,
    ));
  }
  const rect = anchorBtn.getBoundingClientRect();
  document.body.append(menu);
  // 定位：默认在按钮下方，超出视口右缘时右对齐
  const mw = menu.offsetWidth;
  menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - mw - 8)) + 'px';
  const mh = menu.offsetHeight;
  const top = rect.bottom + 5 + mh > window.innerHeight ? rect.top - mh - 5 : rect.bottom + 5;
  menu.style.top = top + 'px';

  const close = e => {
    if (!menu.contains(e.target) && e.target !== anchorBtn) { menu.remove(); document.removeEventListener('mousedown', close); }
  };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
  return menu;
}

/* ---------- 共享 tooltip ---------- */

let tipEl = null;

export function bindTooltip(el, getText) {
  el.addEventListener('mouseenter', e => {
    const text = typeof getText === 'function' ? getText() : getText;
    if (!text) return;
    if (!tipEl) tipEl = document.getElementById('tooltip');
    tipEl.textContent = text;
    tipEl.hidden = false;
    const move = ev => {
      const pad = 14;
      let x = ev.clientX + pad, y = ev.clientY + pad;
      const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
      if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
      if (y + hh > window.innerHeight - 8) y = ev.clientY - hh - pad;
      tipEl.style.left = x + 'px';
      tipEl.style.top = y + 'px';
    };
    move(e);
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', () => {
      tipEl.hidden = true;
      el.removeEventListener('mousemove', move);
    }, { once: true });
  });
}

export function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
