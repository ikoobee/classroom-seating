/**
 * 左栏规则面板：10 条规则开关 + 0-100 权重滑块 + 手柄拖拽排序 + 前排比例
 * 排序仅影响列表显示顺序（便于整理常用规则），排座影响完全由权重决定；
 * 拖拽只允许从左侧 ⠿ 手柄发起，避免与权重滑块的手势冲突。
 */
import { h, clearEl } from '../dom.js';
import { RULE_BY_ID } from '../../core/constants.js';

export function createRulesPanel(app) {
  const { store, toast } = app;
  const root = document.getElementById('rulesPanel');

  const toggleBtn = h('button', {
    class: 'btn btn-ghost btn-sm rules-toggle',
    title: '折叠 / 展开规则面板（折叠后教室区域更宽）',
    onclick: () => {
      const cur = store.getState().settings.rulesCollapsed;
      store.dispatch({ type: 'SET_SETTINGS', patch: { rulesCollapsed: !cur } });
    },
  }, '«');

  root.append(
    h('div', { class: 'panel-head' }, h('h3', {}, '⚖️ 排座规则'),
      h('div', { style: { display: 'flex', gap: 4 } },
        h('button', {
          class: 'btn btn-ghost btn-sm', title: '权重越大，该规则在排座评分中的影响越强；0 为停用',
          onclick: () => toast.info('拖动滑块调整权重（0 即停用）。排座时所有启用规则按权重共同参与评分优化；拖动 ⠿ 仅调整显示顺序。', 5000),
        }, '❓'),
        h('button', {
          class: 'btn btn-ghost btn-sm', title: '按权重从高到低整理显示顺序',
          onclick: () => {
            const { order, weights } = store.getState().rules;
            const sorted = [...order].sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
            store.dispatch({ type: 'REORDER_RULES', order: sorted });
            toast.success('已按权重排序');
          },
        }, '⇅'),
        toggleBtn)),
    h('div', { class: 'panel-body', id: 'rulesBody' }),
  );
  const body = root.querySelector('#rulesBody');

  // 折叠状态联动（持久化于 settings）
  function applyCollapsed() {
    const collapsed = !!store.getState().settings.rulesCollapsed;
    root.classList.toggle('collapsed', collapsed);
    toggleBtn.textContent = collapsed ? '»' : '«';
    toggleBtn.title = collapsed ? '展开规则面板' : '折叠规则面板（折叠后教室区域更宽）';
  }
  store.subscribe('settings', applyCollapsed);
  applyCollapsed();

  function render() {
    const { rules } = store.getState();
    clearEl(body);
    body.append(h('div', { class: 'panel-section' },
      h('h4', {}, '规则权重（0 = 停用）'),
      h('div', { id: 'ruleList' }, rules.order.map(id => ruleItem(RULE_BY_ID[id], rules.weights[id] ?? 0))),
    ));

    const ratio = rules.frontRowRatio;
    body.append(h('div', { class: 'panel-section' },
      h('h4', {}, '前排区比例'),
      h('div', { class: 'slider-row' },
        h('div', { class: 'slider-line' },
          h('input', {
            type: 'range', min: 10, max: 80, value: Math.round(ratio * 100),
            oninput: e => {
              store.dispatch({ type: 'SET_FRONT_RATIO', value: +e.target.value / 100 });
              e.target.closest('.slider-row').querySelector('.sv').textContent = `${e.target.value}%`;
            },
          }),
          h('span', { class: 'sv' }, `${Math.round(ratio * 100)}%`)),
        h('div', { style: { fontSize: 11, color: 'var(--text-3)' } },
          `前 ${frontRows()} 排为「前排优先区」，供视力保护 / 行为管理 / 前排优先规则使用`),
      ),
    ));
  }

  function frontRows() {
    const { layout, rules } = store.getState();
    return Math.max(1, Math.round(layout.rows * rules.frontRowRatio));
  }

  function ruleItem(rule, weight) {
    const on = weight > 0;
    const item = h('div', {
      class: `rule-item ${on ? '' : 'rule-off'}`,
      dataset: { ruleId: rule.id },
    });

    // 仅手柄可拖拽（setDragImage 让整条规则作为拖拽影像）
    const handle = h('span', { class: 'rule-drag', title: '拖动调整显示顺序', draggable: 'true' }, '⠿');
    handle.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setDragImage(item, 14, 14); } catch { /* 忽略旧浏览器 */ }
      startDrag(item);
    });

    const slider = h('input', {
      type: 'range', min: 0, max: 100, value: weight,
      title: '拖动调整权重（0 = 停用）',
      oninput: e => {
        const v = +e.target.value;
        store.dispatch({ type: 'SET_RULE_WEIGHT', id: rule.id, weight: v });
        e.target.closest('.rule-item').querySelector('.rv').textContent = v;
        e.target.closest('.rule-item').classList.toggle('rule-off', v === 0);
        e.target.closest('.rule-item').querySelector('.switch input').checked = v > 0;
      },
    });
    const toggle = h('label', { class: 'switch' },
      h('input', {
        type: 'checkbox', checked: on,
        onchange: e => {
          const v = e.target.checked ? (rule.defaultWeight || 50) : 0;
          store.dispatch({ type: 'SET_RULE_WEIGHT', id: rule.id, weight: v });
          render();
        },
      }),
      h('span', { class: 'sl' }));

    item.append(
      handle,
      h('div', { class: 'rule-main' },
        h('div', { class: 'rule-name' }, rule.name,
          h('span', { class: 'r-w' }, `${weight}`)),
        h('div', { class: 'rule-desc' }, rule.desc),
        h('div', { class: 'rule-slider' }, slider, h('span', { class: 'rv' }, `${weight}`)),
      ),
      toggle,
    );
    return item;
  }

  /* ---------- 拖拽排序（仅显示顺序） ---------- */

  const list = () => body.querySelector('#ruleList');
  let dragEl = null;

  function startDrag(item) {
    dragEl = item;
    item.classList.add('dragging');
    const onEnd = () => {
      item.classList.remove('dragging');
      qsaRuleItems().forEach(el => el.classList.remove('drag-target'));
      // 依据当前 DOM 顺序持久化
      const order = qsaRuleItems().map(el => el.dataset.ruleId);
      if (order.length && order.every(id => id)) store.dispatch({ type: 'REORDER_RULES', order });
      dragEl = null;
      document.removeEventListener('dragend', onEnd);
    };
    document.addEventListener('dragend', onEnd);
  }

  root.addEventListener('dragover', e => {
    if (!dragEl) return;
    e.preventDefault();
    const after = getAfterElement(e.clientY);
    qsaRuleItems().forEach(el => el.classList.remove('drag-target'));
    if (after == null) {
      list()?.append(dragEl);
      dragEl.classList.add('drag-target');
    } else {
      list()?.insertBefore(dragEl, after);
      after.classList.add('drag-target');
    }
  });

  function qsaRuleItems() { return [...(list()?.querySelectorAll('.rule-item') ?? [])]; }

  function getAfterElement(y) {
    const els = qsaRuleItems().filter(el => el !== dragEl);
    return els.reduce((closest, el) => {
      const box = el.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, el };
      return closest;
    }, { offset: -Infinity, el: null }).el;
  }

  store.subscribe('rules', render);
  store.subscribe('layout', render); // 前排区行数提示随布局变化

  return { render };
}
