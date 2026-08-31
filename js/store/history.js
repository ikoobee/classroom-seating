/**
 * Undo/Redo：命令模式
 * cmd = { label, apply(dispatch), revert(dispatch) }
 * 交换类命令自逆；整体替换类（排座/导入/清空）用快照式命令
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

/* ---------- 常用命令工厂（需要读取当前状态时由调用方传入 getter） ---------- */

/** 单人入座/换座（快照式：被顶出的学生也能通过撤销恢复） */
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

/** 交换两座位（自逆） */
export function swapCmd(seatA, seatB) {
  return {
    label: '交换座位',
    apply: d => d({ type: 'SWAP_SEATS', seatA, seatB }),
    revert: d => d({ type: 'SWAP_SEATS', seatA, seatB }),
  };
}

/** 整体替换座位表（排座应用/轮换/清空/撤销载体） */
export function setAssignmentCmd(next, prev, label) {
  return {
    label: label || '更新座位表',
    apply: d => d({ type: 'SET_ASSIGNMENT', assignment: next }),
    revert: d => d({ type: 'SET_ASSIGNMENT', assignment: prev }),
  };
}

/** 锁定/解锁（自逆） */
export function toggleLockCmd(seatId) {
  return {
    label: '锁定座位',
    apply: d => d({ type: 'TOGGLE_LOCK', seatId }),
    revert: d => d({ type: 'TOGGLE_LOCK', seatId }),
  };
}

/** 学生集合 + 座位表整体替换（导入/演示数据/清空，快照式，可完整撤销） */
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

/** 单个学生增删改 */
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

/** 关系替换（快照式） */
export function setRelationsCmd(next, prev, label) {
  return {
    label: label || '更新关系约束',
    apply: d => d({ type: 'SET_RELATIONS', relations: next }),
    revert: d => d({ type: 'SET_RELATIONS', relations: prev }),
  };
}
