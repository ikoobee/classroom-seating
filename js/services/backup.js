/**
 * 完整数据备份/恢复（JSON 文件）
 */
import { initialState } from '../store/reducers.js';
import { normalizeRelations } from '../core/relations.js';
import { normalizeLayout } from '../core/grid.js';
import { defaultRules } from '../core/constants.js';

export function exportCompleteData(state) {
  return JSON.stringify({
    app: 'classroom-seating',
    schema: 1,
    exportedAt: new Date().toISOString(),
    data: {
      students: state.students,
      layout: state.layout,
      assignment: state.assignment,
      locks: state.locks,
      relations: state.relations,
      rules: state.rules,
      settings: state.settings,
      logs: state.logs,
    },
  }, null, 2);
}

/** 校验并归一化导入的 JSON，失败抛错 */
export function parseCompleteData(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('不是有效的 JSON 文件'); }
  const d = obj?.data ?? obj;
  if (!d || !Array.isArray(d.students?.list ?? d.students)) {
    throw new Error('文件格式不符：缺少 students 数据');
  }
  // 兼容 list 数组或 {list} 两种形态
  const list = Array.isArray(d.students) ? d.students : (d.students.list ?? []);
  let nextId = 1;
  if (d.students && !Array.isArray(d.students) && Number.isInteger(d.students.nextId)) {
    nextId = d.students.nextId;
  } else if (list.length) {
    nextId = Math.max(...list.map(s => +s.id || 0)) + 1;
  }

  const base = initialState();
  return {
    students: { list, nextId },
    layout: normalizeLayout(d.layout ?? {}),
    assignment: d.assignment ?? {},
    locks: Array.isArray(d.locks) ? d.locks : [],
    relations: normalizeRelations(d.relations ?? {}),
    rules: { ...defaultRules(), ...(d.rules ?? {}) },
    settings: { ...base.settings, ...(d.settings ?? {}) },
    logs: Array.isArray(d.logs) ? d.logs.slice(0, 100) : [],
    ui: base.ui,
  };
}
