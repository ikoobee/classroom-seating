/**
 * Relation constraint management: friends (must be deskmates) / blacklist (deskmates forbidden, optionally also front-back adjacency)
 * Student selection uses a custom dropdown (fixed downward popup + search) because the native select's popup direction can't be controlled
 */
import { h, clearEl } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';
import { setRelationsCmd } from '../../store/history.js';

/** Student picker: button + downward-popping search panel */
function createStudentPicker({ placeholder = '选择学生…', getStudents, getDisabled, onPick }) {
  let value = 0;
  let valueLabel = '';

  const label = h('span', { style: { flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'var(--text)' : 'var(--text-3)' } }, placeholder);
  const btn = h('button', {
    type: 'button',
    style: {
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7,
      background: 'var(--bg-panel)', fontSize: 13,
    },
    onclick: () => toggle(),
  }, label, h('span', { style: { color: 'var(--text-3)', fontSize: 11 } }, '▾'));

  let panel = null;

  function closePanel() {
    panel?.remove();
    panel = null;
    document.removeEventListener('mousedown', onDocDown, true);
  }

  function onDocDown(e) {
    if (panel && !panel.contains(e.target) && !btn.contains(e.target)) closePanel();
  }

  function toggle() {
    if (panel) { closePanel(); return; }
    panel = buildPanel();
    document.body.append(panel);
    document.addEventListener('mousedown', onDocDown, true);
    // Position: directly below the button (fixed downward popup)
    const r = btn.getBoundingClientRect();
    panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - panel.offsetWidth - 8)) + 'px';
    panel.style.top = (r.bottom + 6) + 'px';
    panel.querySelector('input')?.focus();
  }

  function buildPanel() {
    const search = h('input', {
      type: 'text', placeholder: '搜索姓名…',
      style: {
        width: '100%', padding: '7px 10px', marginBottom: 6,
        border: '1px solid var(--border)', borderRadius: 6,
        background: 'var(--bg-panel-2)', outline: 'none', fontSize: 12.5,
      },
    });

    const listBox = h('div', { style: { maxHeight: 240, overflowY: 'auto' } });
    const renderList = () => {
      clearEl(listBox);
      const kw = search.value.trim();
      const disabled = getDisabled();
      const students = getStudents();
      const list = kw ? students.filter(s => s.name.includes(kw)) : students;
      if (!list.length) {
        listBox.append(h('div', { style: { padding: '14px 10px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 } }, '无匹配学生'));
        return;
      }
      for (const s of list) {
        const isDisabled = disabled.has(s.id);
        const isSel = s.id === value;
        listBox.append(h('button', {
          type: 'button',
          style: {
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '7px 10px', borderRadius: 6, fontSize: 12.5, textAlign: 'left',
            background: isSel ? 'var(--primary-soft)' : 'transparent',
            color: isDisabled ? 'var(--text-3)' : 'var(--text)',
            cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? .6 : 1,
          },
          onclick: () => {
            if (isDisabled) return;
            value = s.id; valueLabel = `${s.name}（${s.gender}）`;
            label.textContent = valueLabel;
            label.style.color = 'var(--text)';
            closePanel();
            onPick?.(value);
          },
        },
          h('span', {
            style: {
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: s.gender === '男' ? 'var(--male)' : 'var(--female)',
            },
          }),
          h('span', { style: { flex: 1 } }, s.name),
          isDisabled ? h('span', { style: { fontSize: 11, color: 'var(--warning)' } }, '已同桌') : null,
        ));
      }
    };

    search.addEventListener('input', renderList);
    const p = h('div', {
      style: {
        position: 'fixed', zIndex: 900, width: '240px',
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 9, boxShadow: 'var(--shadow-lg)', padding: 8,
      },
    }, search, listBox);
    renderList();
    return p;
  }

  return {
    el: btn,
    get value() { return value; },
  };
}

export function openRelationsModal(app) {
  const { store, history, toast } = app;
  let tab = 'friends'; // friends | blacklist

  const listBox = h('div', { id: 'relListBox' });
  const modal = openModal({
    title: '🤝 关系约束管理',
    width: 600,
    content: h('div', {},
      h('div', { class: 'tabs' },
        h('button', { class: 'tab-btn tab-friends', onclick: () => switchTab('friends') }, '💖 好友（必须同桌）'),
        h('button', { class: 'tab-btn tab-blacklist', onclick: () => switchTab('blacklist') }, '🚫 黑名单（禁止相邻）')),
      h('div', { style: { fontSize: 12, color: 'var(--text-3)', margin: '14px 0 16px', lineHeight: 1.8 } },
        '好友对在排座时作为硬约束成对入座；黑名单学生之间不会成为同桌（可勾选同时禁止前后相邻）。无法满足的约束会在排座报告中明确提示。'),
      listBox,
    ),
    footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '关闭')],
  });

  function switchTab(t) {
    tab = t;
    modal.el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    modal.el.querySelector(`.tab-${t}`).classList.add('active');
    render();
  }

  function render() {
    clearEl(listBox);
    const state = store.getState();
    const byId = new Map(state.students.list.map(s => [s.id, s]));
    const isFriend = tab === 'friends';

    /* ---- Add section (card-based, custom dropdown popping downward) ---- */
    // In friends mode, already-paired students are unselectable (one seat has only one deskmate)
    const takenSet = () => new Set(tab === 'friends'
      ? store.getState().relations.friends.flatMap(p => [p.a, p.b]) : []);
    const getStudents = () => store.getState().students.list;

    const pickerA = createStudentPicker({ getStudents, getDisabled: takenSet });
    const pickerB = createStudentPicker({ getStudents, getDisabled: takenSet });
    const noFbCheck = h('input', { type: 'checkbox', style: { accentColor: 'var(--primary)', width: 14, height: 14 } });

    const addCard = h('div', {
      style: {
        border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-panel-2)',
        padding: '14px 16px 16px', marginBottom: 16,
      },
    },
      h('div', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 } },
        isFriend ? '💖 添加好友对（两人必须同桌）' : '🚫 添加黑名单（两人禁止相邻）'),
      // Dropdowns + add button on a single row
      h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
        h('div', { style: { flex: 1, minWidth: 0 } }, pickerA.el),
        h('span', { style: { fontSize: 15, flexShrink: 0 } }, isFriend ? '💗' : '⚡'),
        h('div', { style: { flex: 1, minWidth: 0 } }, pickerB.el),
        h('button', {
          class: 'btn btn-primary',
          style: { flexShrink: 0 },
          onclick: () => {
            const a = pickerA.value, b = pickerB.value;
            if (!a || !b || a === b) { toast.warning('请选择两名不同的学生'); return; }
            const rel = { ...state.relations };
            const pairExists = (list, x, y) =>
              list.some(p => (p.a === x && p.b === y) || (p.a === y && p.b === x));

            if (isFriend) {
              if (pairExists(rel.friends, a, b)) { toast.info('该好友对已存在'); return; }
              // Cross-list conflict: the same pair can't be both friends and blacklisted
              if (pairExists(rel.blacklist, a, b)) {
                toast.warning('这两名学生已在黑名单中——好友（必须同桌）与黑名单（禁止相邻）互相矛盾，请先删除对应黑名单记录', 4600);
                return;
              }
              // Seat geometry limit: a student can have only one deskmate
              const busy = [a, b].filter(id => rel.friends.some(p => p.a === id || p.b === id));
              if (busy.length) {
                const names = busy.map(id => store.getState().students.list.find(s => s.id === id)?.name ?? `#${id}`);
                toast.warning(`${names.join('、')} 已有同桌约束——一个座位只有一位同桌，如需更换请先删除原配对`, 4200);
                return;
              }
              rel.friends = [...rel.friends, { a, b }];
            } else {
              if (pairExists(rel.blacklist, a, b)) { toast.info('该黑名单对已存在'); return; }
              // Cross-list conflict
              if (pairExists(rel.friends, a, b)) {
                toast.warning('这两名学生已是好友（必须同桌）——与黑名单（禁止相邻）互相矛盾，请先删除对应好友记录', 4600);
                return;
              }
              rel.blacklist = [...rel.blacklist, { a, b, noFrontBack: noFbCheck.checked }];
            }
            history.exec(setRelationsCmd(rel, state.relations,
              isFriend ? '添加好友约束' : '添加黑名单约束'));
            render();
          },
        }, isFriend ? '添加好友' : '加入黑名单')),
      // Blacklist: extra option (compact row, right-aligned)
      isFriend ? null : h('label', {
        style: {
          display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'flex-end',
          marginTop: 10, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer',
        },
      }, noFbCheck, '同时禁止前后相邻'),
    );

    listBox.append(addCard);

    /* ---- Relations list ---- */
    const list = isFriend ? state.relations.friends : state.relations.blacklist;
    if (!list.length) {
      listBox.append(h('div', { class: 'empty-tip' },
        isFriend ? '还没有好友约束' : '还没有黑名单约束'));
      return;
    }
    for (const p of list) {
      listBox.append(pairCard(p, byId, state));
    }
  }

  /** Single relation card: gender-pill name pair + description + delete */
  function pairCard(p, byId, state) {
    const isFriend = tab === 'friends';
    const sa = byId.get(p.a), sb = byId.get(p.b);
    const pill = s => h('span', {
      style: {
        padding: '3px 10px', borderRadius: 14, fontSize: 12.5, fontWeight: 600,
        background: s?.gender === '男' ? 'var(--male-soft)' : 'var(--female-soft)',
        color: s?.gender === '男' ? '#0369a1' : '#9d174d',
      },
    }, s?.name ?? `#${p.a}`);

    return h('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', marginBottom: 10,
        border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-panel-2)',
      },
    },
      h('span', { style: { fontSize: 17, flexShrink: 0 } }, isFriend ? '💖' : '🚫'),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          pill(sa),
          h('span', { style: { color: 'var(--text-3)', fontSize: 12 } }, isFriend ? '同桌' : '✕'),
          pill(sb)),
        h('div', { style: { fontSize: 11.5, color: 'var(--text-3)', marginTop: 5 } },
          isFriend ? '排座时作为硬约束成对入座'
            : (p.noFrontBack ? '禁止同桌 + 禁止前后相邻' : '禁止同桌'))),
      h('button', {
        class: 'btn btn-sm btn-danger',
        onclick: () => {
          const rel = { ...state.relations };
          if (isFriend) {
            rel.friends = rel.friends.filter(x => !(x.a === p.a && x.b === p.b));
          } else {
            rel.blacklist = rel.blacklist.filter(x => !(x.a === p.a && x.b === p.b));
          }
          history.exec(setRelationsCmd(rel, state.relations, '删除关系约束'));
          render();
        },
      }, '删除'),
    );
  }

  switchTab('friends');
  return modal;
}
