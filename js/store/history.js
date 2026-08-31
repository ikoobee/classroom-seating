/**
 * Undo/Redo: command pattern
 * cmd = { label, apply(dispatch), revert(dispatch) }
 * Swap-style commands are self-inverse; full-replacement commands (arrangement / import / clear) are snapshot-based
 */

export function createHistory(store, { limit = 50, onChange } = {}) {
  const undoStack = [];
  const redoStack = [];

  const notify = () => onChange?.({
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    lastLabel: undoStack[undoStack.length - 1]?.label ?? '',
  });

  const history = {
    exec(cmd) {
      cmd.apply(store.dispatch);
      undoStack.push(cmd);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
      notify();
    },
    undo() {
      const cmd = undoStack.pop();
      if (!cmd) return false;
      cmd.revert(store.dispatch);
      redoStack.push(cmd);
      notify();
      return true;
    },
    redo() {
      const cmd = redoStack.pop();
      if (!cmd) return false;
      cmd.apply(store.dispatch);
      undoStack.push(cmd);
      notify();
      return true;
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      notify();
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
  return history;
}

/* ---------- Common command factories (callers pass in a getter when current state is needed) ---------- */

/** Seat/move a single student (snapshot-based: the displaced student is also restored on undo) */
export function assignCmd(getState, studentId, seatId) {
  let prev = null;
  return {
    label: '安排学生',
    apply(d) {
      prev = { ...getState().assignment };
      d({ type: 'ASSIGN', studentId, seatId });
    },
    revert(d) {
      d({ type: 'SET_ASSIGNMENT', assignment: prev });
    },
  };
}

/** Swap two seats (self-inverse) */
export function swapCmd(seatA, seatB) {
  return {
    label: '交换座位',
    apply: d => d({ type: 'SWAP_SEATS', seatA, seatB }),
    revert: d => d({ type: 'SWAP_SEATS', seatA, seatB }),
  };
}

/** Replace the whole seating chart (arrangement apply / rotation / clear; also serves as the undo vehicle) */
export function setAssignmentCmd(next, prev, label) {
  return {
    label: label || '更新座位表',
    apply: d => d({ type: 'SET_ASSIGNMENT', assignment: next }),
    revert: d => d({ type: 'SET_ASSIGNMENT', assignment: prev }),
  };
}

/** Lock/unlock a seat (self-inverse) */
export function toggleLockCmd(seatId) {
  return {
    label: '锁定座位',
    apply: d => d({ type: 'TOGGLE_LOCK', seatId }),
    revert: d => d({ type: 'TOGGLE_LOCK', seatId }),
  };
}

/** Replace the student roster + seating chart together (import / demo data / clear; snapshot-based, fully undoable) */
export function replaceAllCmd(next, prev, label) {
  // next/prev: { list, nextId, assignment }
  return {
    label: label || '更新学生名单',
    apply(d) {
      d({ type: 'SET_STUDENTS', list: next.list, nextId: next.nextId });
      d({ type: 'SET_ASSIGNMENT', assignment: next.assignment });
    },
    revert(d) {
      d({ type: 'SET_STUDENTS', list: prev.list, nextId: prev.nextId });
      d({ type: 'SET_ASSIGNMENT', assignment: prev.assignment });
    },
  };
}

/** Single student add/delete/edit */
export function addStudentCmd(student) {
  return {
    label: '添加学生',
    apply: d => d({ type: 'ADD_STUDENT', student }),
    revert: d => d({ type: 'DELETE_STUDENT', id: student.id }),
  };
}

export function deleteStudentCmd(student) {
  return {
    label: '删除学生',
    apply: d => d({ type: 'DELETE_STUDENT', id: student.id }),
    revert: d => d({ type: 'ADD_STUDENT', student }),
  };
}

export function updateStudentCmd(prev, next) {
  return {
    label: '编辑学生',
    apply: d => d({ type: 'UPDATE_STUDENT', student: next }),
    revert: d => d({ type: 'UPDATE_STUDENT', student: prev }),
  };
}

/** Replace relations (snapshot-based) */
export function setRelationsCmd(next, prev, label) {
  return {
    label: label || '更新关系约束',
    apply: d => d({ type: 'SET_RELATIONS', relations: next }),
    revert: d => d({ type: 'SET_RELATIONS', relations: prev }),
  };
}
