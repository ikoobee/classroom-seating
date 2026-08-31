/**
 * Classroom view: grid structure (rebuilt on layout change) + incremental seat-card rendering
 * (elements reused by studentId — the prerequisite for FLIP)
 */
import { h, qs, qsa, clearEl, bindTooltip } from '../dom.js';
import { withFlip } from '../interactions/flip.js';
import { swapCmd, toggleLockCmd, assignCmd } from '../../store/history.js';
import { parseSeatId } from '@ikoobee/seating-core';
import { classroomSummary } from '@ikoobee/seating-core';

export function createClassroomView(app) {
  const { store, history, toast, logger } = app;
  const grid = document.getElementById('seatGrid');
  const statusBar = document.getElementById('statusBar');
  const wrap = qs('.classroom-wrap');

  let layoutSig = '';
  let selectedSeat = null;

  /* ---------- Structure ---------- */

  function buildStructure(layout) {
    clearEl(grid);
    // Grid columns: seat columns + aisle gap columns (a gap is inserted after column N when an aisle follows it)
    const cols = [];
    for (let c = 1; c <= layout.seatCols; c++) {
      cols.push('var(--seat-size)');
      if (layout.aisles.includes(c)) cols.push('20px');
    }
    grid.style.gridTemplateColumns = cols.join(' ');

    for (let r = 1; r <= layout.rows; r++) {
      for (let c = 1; c <= layout.seatCols; c++) {
        grid.append(h('div', {
          class: 'seat',
          dataset: { seatId: `${r}-${c}` },
        }, h('span', { class: 'seat-no' }, `${r}排${c}列`)));
        if (layout.aisles.includes(c)) {
          grid.append(h('div', { class: 'grid-cell aisle', dataset: { afterCol: c } }));
        }
      }
    }
    fitSeatSize(layout);
  }

  function fitSeatSize(layout) {
    const gap = 8, aisleTotal = 20 + gap;
    const avail = wrap.clientWidth - 36 - aisleTotal * layout.aisles.length;
    const size = Math.max(52, Math.min(118,
      Math.floor((avail - gap * (layout.seatCols - 1)) / Math.max(1, layout.seatCols))));
    grid.style.setProperty('--seat-size', size + 'px');
  }

  /* ---------- Seat card rendering ---------- */

  function makeCard(student) {
    const card = h('div', {
      class: 'student-card',
      draggable: 'true',
      dataset: { studentId: String(student.id) },
    });
    card.addEventListener('dragstart', e => {
      const seatEl = card.closest('.seat');
      e.dataTransfer.setData('text/plain', `seat:${seatEl?.dataset.seatId ?? ''}`);
      e.dataTransfer.effectAllowed = 'move';
    });
    // Tooltip is bound once; its content is resolved dynamically on hover (avoids piling up listeners on every render)
    bindTooltip(card, () => {
      const s = store.getState().students.list.find(x => x.id === +card.dataset.studentId);
      return s ? tooltipText(s) : '';
    });
    return card;
  }

  const ANNO_CLASSES = ['gender-m', 'gender-f', 'anno-red', 'anno-orange', 'anno-yellow', 'anno-green', 'anno-purple'];

  function updateCardContent(card, student, state) {
    for (const c of ANNO_CLASSES) card.classList.remove(c);
    card.classList.add(student.gender === '男' ? 'gender-m' : 'gender-f');
    if (student.annotationColor && state.settings.annotationVisible) {
      card.classList.add(`anno-${student.annotationColor}`);
    }
    clearEl(card);

    // Class duty: small badge at the top-right (shows the first one; hover to see all duties)
    if (student.tags.length) {
      card.append(h('span', { class: 'sc-badge', title: `职务：${student.tags.join('、')}` },
        student.tags[0]));
    }

    // Name (absolutely centered — the icon row and duty badge are overlay layers that don't affect its position)
    card.append(h('span', { class: 'sc-name' }, student.name));

    // Icon row (floating at the card bottom; meanings documented in the students panel "?" legend; hover an icon for its tooltip)
    // The lock indicator stays out of the icon row: .seat.locked shows it at the card's top-left / seat number,
    // so 4 icons never wrap and squeeze the name
    const icons = [];
    if (student.vision === '近视') icons.push(['👓', '近视：排座时优先前排']);
    if (student.height === '矮') icons.push(['🔻', '矮个：优先前排，避免被遮挡']);
    if (student.height === '高') icons.push(['🔺', '高个：安排后排，避免遮挡他人']);
    if (student.personality === '调皮') icons.push(['🌀', '调皮：靠前就座便于监督']);

    card.append(h('span', { class: 'sc-meta' },
      icons.map(([text, tip]) => h('span', { class: 'sc-ic', title: tip }, text))));
  }

  function tooltipText(s) {
    const anno = { red: '重点关注', orange: '需要注意', yellow: '一般关注', green: '表现良好', purple: '特殊情况' }[s.annotationColor] ?? '';
    return [
      `${s.name}（${s.gender}）`,
      `身高：${s.height}　视力：${s.vision}`,
      `成绩：${s.academic}　性格：${s.personality}`,
      s.ability ? `特长：${s.ability}` : '',
      s.tags.length ? `职务：${s.tags.join('、')}` : '',
      anno ? `标注：${anno}` : '',
    ].filter(Boolean).join('\n');
  }

  function updateAllSeats() {
    const state = store.getState();
    const byId = new Map(state.students.list.map(s => [s.id, s]));
    const seatEls = qsa('.seat', grid);

    // Index of existing cards (studentId -> card), for reuse across seats (needed by FLIP)
    const cardsByStudent = new Map();
    for (const el of seatEls) {
      const card = el.querySelector('.student-card');
      if (card) cardsByStudent.set(card.dataset.studentId, card);
    }

    for (const el of seatEls) {
      const seatId = el.dataset.seatId;
      const sid = state.assignment[seatId];
      const student = sid !== undefined ? byId.get(sid) : null;
      el.classList.toggle('locked', state.locks.includes(seatId));

      let card = el.querySelector('.student-card');
      if (!student) { if (card) card.remove(); continue; }
      if (card && card.dataset.studentId === String(student.id)) {
        updateCardContent(card, student, state);
        continue;
      }
      const existing = cardsByStudent.get(String(student.id));
      if (card) card.remove();
      const nextCard = existing ?? makeCard(student);
      el.append(nextCard);
      updateCardContent(nextCard, student, state);
    }
    if (selectedSeat && !(selectedSeat in state.assignment) && !qsa('.seat', grid).some(el => el.dataset.seatId === selectedSeat)) {
      clearSelection();
    }
  }

  /* ---------- Selection & interaction ---------- */

  function clearSelection() {
    selectedSeat = null;
    qsa('.seat.selected', grid).forEach(el => el.classList.remove('selected'));
  }

  grid.addEventListener('click', e => {
    const seatEl = e.target.closest('.seat');
    if (!seatEl || !grid.contains(seatEl)) return;
    const seatId = seatEl.dataset.seatId;
    const state = store.getState();

    // Lock mode: clicking toggles the lock
    if (state.ui.lockMode) {
      history.exec(toggleLockCmd(seatId));
      toast.info(state.locks.includes(seatId)
        ? `已解锁 ${seatName(seatId)}`
        : `已锁定 ${seatName(seatId)}（智能排座时保持不动）`);
      return;
    }

    const occupied = seatId in state.assignment;
    if (!occupied) { clearSelection(); return; }

    if (!selectedSeat) {
      selectedSeat = seatId;
      seatEl.classList.add('selected');
      return;
    }
    if (selectedSeat === seatId) { clearSelection(); return; }

    // Swap: validate locks on both the source and target seats
    if (state.locks.includes(seatId)) { toast.warning(`目标座位 ${seatName(seatId)} 已锁定，无法交换`); return; }
    if (state.locks.includes(selectedSeat)) { toast.warning(`选中座位 ${seatName(selectedSeat)} 已锁定，请先解锁`); clearSelection(); return; }

    const a = selectedSeat, b = seatId;
    withFlip(grid, () => history.exec(swapCmd(a, b)));
    logger.manual(`交换座位 ${seatName(a)} ⇄ ${seatName(b)}`);
    clearSelection();
  });

  grid.addEventListener('dblclick', e => {
    const seatEl = e.target.closest('.seat');
    if (!seatEl) return;
    const sid = store.getState().assignment[seatEl.dataset.seatId];
    if (sid === undefined) return;
    app.views.studentsPanel.editStudent(sid);
  });

  /* ---------- Drag & drop ---------- */

  grid.addEventListener('dragover', e => {
    const seatEl = e.target.closest('.seat');
    if (!seatEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    seatEl.classList.add('drag-over');
  });
  grid.addEventListener('dragleave', e => {
    const seatEl = e.target.closest('.seat');
    if (seatEl) seatEl.classList.remove('drag-over');
  });
  grid.addEventListener('drop', e => {
    const seatEl = e.target.closest('.seat');
    if (!seatEl) return;
    e.preventDefault();
    seatEl.classList.remove('drag-over');
    const seatId = seatEl.dataset.seatId;
    const data = e.dataTransfer.getData('text/plain');
    const state = store.getState();

    if (data.startsWith('student:')) {
      const studentId = +data.slice(8);
      if (state.locks.includes(seatId)) {
        toast.warning(`座位 ${seatName(seatId)} 已锁定`); return;
      }
      withFlip(grid, () => history.exec(assignCmd(store.getState, studentId, seatId)));
      const s = state.students.list.find(x => x.id === studentId);
      logger.manual(`${s?.name ?? studentId} 入座 ${seatName(seatId)}`);
      clearSelection();
    } else if (data.startsWith('seat:')) {
      const fromSeat = data.slice(5);
      if (!fromSeat || fromSeat === seatId) return;
      if (state.locks.includes(fromSeat)) { toast.warning(`座位 ${seatName(fromSeat)} 已锁定`); return; }
      if (state.locks.includes(seatId)) { toast.warning(`座位 ${seatName(seatId)} 已锁定`); return; }
      withFlip(grid, () => history.exec(swapCmd(fromSeat, seatId)));
      logger.manual(`交换座位 ${seatName(fromSeat)} ⇄ ${seatName(seatId)}`);
      clearSelection();
    }
  });

  /* ---------- Status bar ---------- */

  function renderStatus() {
    const state = store.getState();
    const sum = classroomSummary(state);
    clearEl(statusBar);
    statusBar.append(...[
      h('span', { class: 'sb-item' }, h('span', { class: 'sb-dot', style: { background: 'var(--primary)' } }),
        `座位 ${sum.seated}/${sum.totalSeats}`),
      h('span', { class: 'sb-item' }, `学生 ${sum.students}`),
      h('span', { class: 'sb-item' }, h('span', { class: 'sb-dot', style: { background: 'var(--male)' } }), `${sum.male}`,
        h('span', { class: 'sb-dot', style: { background: 'var(--female)', marginLeft: '4px' } }), `${sum.female}`),
      sum.nearsighted ? h('span', { class: 'sb-item' }, `👓 近视 ${sum.nearsighted}`) : null,
      sum.locked ? h('span', { class: 'sb-item' }, `🔒 锁定 ${sum.locked}`) : null,
      sum.unseated > 0 ? h('span', { class: 'sb-item', style: { color: 'var(--warning)' } }, `未安排 ${sum.unseated}`) : null,
      h('span', { class: 'sb-item sb-save', id: 'saveState' }, '💾 已自动保存'),
    ].filter(Boolean)); // Element.append would render null as a string
  }

  /* ---------- Subscriptions ---------- */

  store.subscribe('layout', () => { layoutSig = ''; render(); });
  store.subscribe('assignment', render);
  store.subscribe('students', render);
  store.subscribe('locks', render);
  store.subscribe('ui', () => {
    const lockMode = store.getState().ui.lockMode;
    document.body.classList.toggle('lock-mode', lockMode);
  });

  window.addEventListener('resize', () => {
    const layout = store.getState().layout;
    fitSeatSize(layout);
  });

  // Refit seat size when the container resizes (sidebar collapse / window resize)
  if (typeof ResizeObserver !== 'undefined') {
    let roTimer = null;
    new ResizeObserver(() => {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => fitSeatSize(store.getState().layout), 60);
    }).observe(wrap);
  }

  function seatName(id) {
    const { row, col } = parseSeatId(id);
    return `${row}排${col}列`;
  }

  function render() {
    const state = store.getState();
    const sig = `${state.layout.rows}|${state.layout.seatCols}|${state.layout.aisles.join(',')}`;
    if (sig !== layoutSig) { layoutSig = sig; buildStructure(state.layout); }
    updateAllSeats();
    renderStatus();
  }

  return {
    render,
    clearSelection,
    seatName,
    getSelectedSeat: () => selectedSeat,
  };
}
