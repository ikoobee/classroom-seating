/**
 * Right students panel: search / filter / list (drag to seat, double-click to edit) / add / demo data / clear
 */
import { h, clearEl } from '../dom.js';
import { createStudent, validateStudent } from '../../core/models.js';
import { generateDemoStudents } from '../../core/datagen.js';
import { addStudentCmd, updateStudentCmd, deleteStudentCmd, replaceAllCmd } from '../../store/history.js';
import { openModal, closeModal } from '../components/modal.js';
import { confirmDialog } from '../components/toast.js';
import { GENDERS, HEIGHTS, VISIONS, ACADEMICS, PERSONALITIES, ABILITIES, DUTIES, ANNOTATION_COLORS } from '../../core/constants.js';

export function createStudentsPanel(app) {
  const { store, history, toast, logger } = app;
  const root = document.getElementById('studentsPanel');

  root.append(
    h('div', { class: 'panel-head' },
      h('h3', {}, '👥 学生管理',
        h('button', {
          class: 'btn btn-ghost btn-sm',
          title: '座位卡图标与标注图例说明',
          style: { marginLeft: 2, fontWeight: 400 },
          onclick: openIconLegend,
        }, '❓')),
      h('span', { id: 'stuCount', style: { fontSize: 12, color: 'var(--text-3)' } }, '0 人')),
    h('div', { class: 'panel-body', id: 'stuBody' }),
    h('div', { class: 'panel-foot' },
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => editStudent() }, '➕ 添加'),
      h('button', { class: 'btn btn-sm', onclick: demoDialog }, '🎲 演示数据'),
      h('button', { class: 'btn btn-sm btn-danger', onclick: clearStudents }, '🗑 清空'),
    ),
  );
  const body = root.querySelector('#stuBody');

  /* ---------- Icon legend ---------- */

  function openIconLegend() {
    /** Legend row: icon chip (mimicking seat-card colors) + title + small-print description */
    const row = (chipContent, chipStyle, label, desc) => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' },
    },
      h('span', {
        style: Object.assign({
          width: 38, height: 38, flexShrink: 0, borderRadius: 9,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, border: '1.5px solid var(--border)',
          background: 'var(--bg-panel-2)',
        }, chipStyle || {}),
      }, chipContent),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { fontSize: 14, fontWeight: 600, lineHeight: 1.4 } }, label),
        h('div', { style: { fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.6 } }, desc)));

    const sectionTitle = text => h('div', {
      style: { fontWeight: 600, fontSize: '12px', color: 'var(--text-3)', margin: '16px 0 4px', letterSpacing: .5 },
    }, text);

    const annoChip = color => h('span', {
      style: { display: 'inline-block', width: 9, height: 16, borderRadius: 2, background: color },
    });

    const modal = openModal({
      title: '📖 座位卡图例说明',
      width: 460,
      content: h('div', {},
        sectionTitle('学生属性图标（卡片底部）'),
        row('👓', {}, '近视', '排座时优先安排在前排区'),
        row('🔻 🔺', {}, '矮个 / 高个', '矮个优先前排、高个安排后排，避免遮挡'),
        row('🌀', {}, '调皮', '靠前就座便于监督，且避免调皮学生相邻'),
        row('🔒', {}, '座位已锁定', '卡片左上角显示 🔒 且座位边框变橙色，排座与轮换时保持不动'),

        sectionTitle('卡片其他元素'),
        row('组长', { fontSize: 10.5, fontWeight: 600, background: 'rgba(255,255,255,.75)', borderColor: 'var(--border-strong)' },
          '职务（右上角标签）', '班干部等职务，悬停查看该生全部职务'),
        row(annoChip('var(--anno-red)'), { border: 'none', background: 'transparent' },
          '标注色条（卡片左侧）',
          '红=重点关注　橙=需要注意　黄=一般关注　绿=表现良好　紫=特殊情况'),

        sectionTitle('卡片边框 / 底色'),
        row('男', { background: 'var(--male-soft)', borderColor: 'var(--male)', color: 'var(--text)', fontSize: 13, fontWeight: 700 },
          '男生', '蓝框淡蓝底'),
        row('女', { background: 'var(--female-soft)', borderColor: 'var(--female)', color: 'var(--text)', fontSize: 13, fontWeight: 700 },
          '女生', '粉框淡粉底；悬停座位卡可查看学生完整信息'),
      ),
      footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '知道了')],
    });
    return modal;
  }

  /* ---------- Rendering ---------- */

  function render() {
    const state = store.getState();
    root.querySelector('#stuCount').textContent = `${state.students.list.length} 人`;
    clearEl(body);

    const searchBox = h('div', { class: 'search-box' },
      h('input', {
        type: 'text', placeholder: '搜索姓名 / 职务…', value: state.ui.search,
        oninput: e => app.store.dispatch({ type: 'PATCH_UI', patch: { search: e.target.value } }),
      }));
    // Filter tabs: to avoid losing input focus, the search box would ideally be created once and reused —
    // for simplicity it is rebuilt on every render, and the PATCH_UI-triggered rerender interrupts focus
    // (handled: capture document.activeElement while it is inside the search box, then restore focus below)

    const filters = [
      ['all', '全部'], ['unseated', '未安排'], ['special', '特殊'],
    ];
    const tabs = h('div', { class: 'filter-tabs' }, filters.map(([k, label]) =>
      h('button', {
        class: `filter-tab ${state.ui.filter === k ? 'active' : ''}`,
        onclick: () => store.dispatch({ type: 'PATCH_UI', patch: { filter: k } }),
      }, label)));

    const seatOf = new Map(Object.entries(state.assignment).map(([seat, sid]) => [sid, seat]));
    const kw = state.ui.search.trim();
    let list = state.students.list;
    if (state.ui.filter === 'unseated') list = list.filter(s => !seatOf.has(s.id));
    if (state.ui.filter === 'special') list = list.filter(s => s.annotationColor || s.tags.length);
    if (kw) list = list.filter(s => s.name.includes(kw) || s.tags.some(t => t.includes(kw)));

    const countLine = h('div', { style: { fontSize: 11.5, color: 'var(--text-3)', margin: '4px 2px 8px' } },
      `显示 ${list.length} / ${state.students.list.length} 人`);

    const listBox = h('div', {}, list.length ? list.map(s => studentItem(s, seatOf.get(s.id))) : null);

    const keepFocus = document.activeElement?.closest('.search-box');
    body.append(searchBox, tabs, countLine, listBox);
    if (keepFocus) {
      const input = body.querySelector('.search-box input');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function studentItem(s, seat) {
    const state = store.getState();
    const anno = s.annotationColor && state.settings.annotationVisible ? `anno-${s.annotationColor}` : '';
    const el = h('div', {
      class: `student-item si-${s.gender === '男' ? 'm' : 'f'} ${anno} ${seat ? 'seated' : ''}`,
      draggable: 'true',
      dataset: { studentId: String(s.id) },
      ondblclick: () => editStudent(s.id),
    });
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', `student:${s.id}`);
      e.dataTransfer.effectAllowed = 'move';
    });
    el.append(
      h('span', { class: `si-avatar a-${s.gender === '男' ? 'm' : 'f'}` }, s.name.slice(-1)),
      h('div', { class: 'si-main' },
        // First line: name + full duty + seat number (rendered on a single line; nowrap prevents wrapping)
        h('div', { class: 'si-name' },
          h('span', { class: 'si-nm' }, s.name),
          s.tags.length ? h('span', { class: 'si-tag', title: s.tags.join('、') }, s.tags[0]) : null,
          seat ? h('span', { class: 'si-seat' }, app.views.classroom.seatName(seat)) : null,
        ),
        h('div', { class: 'si-attrs' }, [
          s.gender, s.height, s.academic, s.personality, s.ability, s.vision,
        ].filter(Boolean).join(' · ')),
      ),
      h('button', {
        class: 'si-del', title: '删除',
        onclick: async e => {
          e.stopPropagation();
          const ok = await confirmDialog({
            title: '删除学生', danger: true,
            message: `确定删除「${s.name}」？其座位与关系约束将一并移除。`,
          });
          if (ok) { history.exec(deleteStudentCmd(s)); toast.success(`已删除 ${s.name}`); }
        },
      }, '✕'),
    );
    return el;
  }

  /* ---------- Edit dialog ---------- */

  function editStudent(studentId) {
    const state = store.getState();
    const prev = studentId !== undefined ? state.students.list.find(s => s.id === studentId) : null;
    const isNew = !prev;
    const draft = prev ? { ...prev, tags: [...prev.tags] } : createStudent({ name: '' });

    const form = {};
    const field = (label, key, options, { allowEmpty = false } = {}) =>
      h('div', { class: 'form-item' },
        h('label', {}, label),
        form[key] = h('select', {},
          (allowEmpty ? [''] : []).concat(options).map(v =>
            h('option', { value: v, selected: draft[key] === v }, v || '（不填）')),
        ));

    const dutyChips = h('div', { class: 'chip-group' }, DUTIES.map(d =>
      h('button', {
        class: `chip ${draft.tags.includes(d) ? 'on' : ''}`,
        onclick: e => {
          e.preventDefault();
          const i = draft.tags.indexOf(d);
          i >= 0 ? draft.tags.splice(i, 1) : draft.tags.push(d);
          e.currentTarget.classList.toggle('on');
        },
      }, d)));

    const colorGroup = h('div', { class: 'color-radio' },
      h('label', { class: 'cr-item' },
        h('input', { type: 'radio', name: 'anno', checked: !draft.annotationColor, onchange: () => draft.annotationColor = null }),
        h('span', { class: 'cr-dot', style: { background: 'var(--border-strong)' } }), '无'),
      ANNOTATION_COLORS.map(c => h('label', { class: `cr-item cr-${c.value}` },
        h('input', {
          type: 'radio', name: 'anno', checked: draft.annotationColor === c.value,
          onchange: () => draft.annotationColor = c.value,
        }),
        h('span', { class: 'cr-dot' }), c.label)));

    const nameInput = h('input', { type: 'text', value: draft.name, maxlength: 12, placeholder: '学生姓名' });

    const modal = openModal({
      title: isNew ? '➕ 添加学生' : `✏️ 编辑 ${prev.name}`,
      width: 560,
      content: h('div', { class: 'form-grid' },
        h('div', { class: 'form-item full' }, h('label', {}, '姓名 *'), nameInput),
        h('div', { class: 'form-item' }, h('label', {}, '性别'),
          form.gender = h('select', {}, GENDERS.map(g => h('option', { value: g, selected: draft.gender === g }, g)))),
        field('身高', 'height', HEIGHTS),
        field('视力', 'vision', VISIONS),
        field('成绩', 'academic', ACADEMICS),
        field('性格', 'personality', PERSONALITIES),
        h('div', { class: 'form-item' }, h('label', {}, '特长'),
          form.ability = h('select', {}, [''].concat(ABILITIES).map(v =>
            h('option', { value: v, selected: draft.ability === v }, v || '（不填）')))),
        h('div', { class: 'form-item full' }, h('label', {}, `职务（可多选，已选 ${draft.tags.length}）`), dutyChips),
        h('div', { class: 'form-item full' }, h('label', {}, '标注颜色'), colorGroup),
      ),
      footer: [
        h('button', { class: 'btn', onclick: () => closeModal(modal) }, '取消'),
        h('button', {
          class: 'btn btn-primary',
          onclick: () => {
            draft.name = nameInput.value.trim();
            const errors = validateStudent(draft);
            if (errors.length) { toast.warning(errors[0]); return; }
            draft.gender = form.gender.value;
            draft.height = form.height.value;
            draft.vision = form.vision.value;
            draft.academic = form.academic.value;
            draft.personality = form.personality.value;
            draft.ability = form.ability.value;
            if (isNew) {
              draft.id = state.students.nextId;
              history.exec(addStudentCmd(draft));
              toast.success(`已添加 ${draft.name}`);
            } else {
              history.exec(updateStudentCmd(prev, draft));
              toast.success(`已更新 ${draft.name}`);
            }
            closeModal(modal);
          },
        }, '保存'),
      ],
    });
  }

  /* ---------- Demo data ---------- */

  function demoDialog() {
    const nInput = h('input', { type: 'number', min: 1, max: 80, value: 45, style: { width: '70px', padding: '6px 8px' } });
    const modal = openModal({
      title: '🎲 生成随机演示数据',
      width: 430,
      content: h('div', { style: { lineHeight: 1.9, color: 'var(--text-2)', fontSize: 13 } },
        h('p', {}, '随机生成中文姓名与合理属性分布的学生（性别、身高、视力、成绩、性格、特长、职务、标注）。'),
        h('p', { style: { color: 'var(--warning)' } }, '⚠️ 将覆盖现有学生名单与座位表（可通过撤销恢复）。'),
        h('div', { style: { marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 } },
          '生成人数：', nInput, ' 人（1-80）')),
      footer: [
        h('button', { class: 'btn', onclick: () => closeModal(modal) }, '取消'),
        h('button', {
          class: 'btn btn-primary',
          onclick: () => {
            const n = Math.max(1, Math.min(80, +nInput.value || 45));
            const state = store.getState();
            const { students, nextId } = generateDemoStudents(n);
            history.exec(replaceAllCmd(
              { list: students, nextId, assignment: {} },
              { list: state.students.list, nextId: state.students.nextId, assignment: state.assignment },
              `生成演示数据（${n} 人）`));
            logger.importData('生成演示数据', n);
            toast.success(`已生成 ${n} 名演示学生`);
            closeModal(modal);
          },
        }, '生成'),
      ],
    });
  }

  async function clearStudents() {
    const state = store.getState();
    if (!state.students.list.length) { toast.info('名单已为空'); return; }
    const ok = await confirmDialog({
      title: '清空学生名单', danger: true,
      message: `将删除全部 ${state.students.list.length} 名学生及其座位安排、关系约束，确定继续？`,
    });
    if (!ok) return;
    history.exec(replaceAllCmd(
      { list: [], nextId: 1, assignment: {} },
      { list: state.students.list, nextId: state.students.nextId, assignment: state.assignment },
      '清空学生名单'));
    toast.success('名单已清空');
  }

  /* ---------- Subscriptions ---------- */

  store.subscribe('students', render);
  store.subscribe('assignment', render);
  // The ui slice contains the frequently-changing lastScore; only redraw when filter/search actually change
  let lastUiKey = `${store.getState().ui.filter}|${store.getState().ui.search}`;
  store.subscribe('ui', ui => {
    const key = `${ui.filter}|${ui.search}`;
    if (key !== lastUiKey) { lastUiKey = key; render(); }
  });

  return { render, editStudent };
}
