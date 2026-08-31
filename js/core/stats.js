/**
 * 分布统计与热力图数据聚合（UI 仪表盘 / Excel 导出共用）
 */
import { activeSeats } from './grid.js';

function countBy(list, key) {
  const m = new Map();
  for (const item of list) {
    const k = key(item) || '未填写';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** 学生属性分布（供环形图/条形图） */
export function attributeDistribution(students) {
  return {
    gender: countBy(students, s => s.gender),
    height: countBy(students, s => s.height),
    vision: countBy(students, s => s.vision),
    academic: countBy(students, s => s.academic),
    personality: countBy(students, s => s.personality),
    ability: countBy(students, s => s.ability),
    annotation: countBy(students.filter(s => s.annotationColor), s => s.annotationColor),
  };
}

/** 各维度在行列上的分布（热力图）。返回 rows×seatCols 矩阵（过道后插入 {aisle:true} 间隙格），值为 {value} 或 null（空座位） */
export function seatHeatmap(layout, assignment, studentsById, dimension) {
  const byId = studentsById;
  const grid = [];
  for (let r = 1; r <= layout.rows; r++) {
    const row = [];
    for (let c = 1; c <= layout.seatCols; c++) {
      const sid = assignment[`${r}-${c}`];
      const s = sid !== undefined ? byId.get(sid) : undefined;
      if (!s) {
        row.push(null);
      } else {
        row.push({
          student: s,
          value: dimension === 'gender' ? s.gender
            : dimension === 'height' ? s.height
            : dimension === 'vision' ? s.vision
            : dimension === 'academic' ? s.academic
            : dimension === 'personality' ? s.personality
            : dimension === 'annotation' ? (s.annotationColor || '无')
            : null,
        });
      }
      if (layout.aisles.includes(c)) row.push({ aisle: true });
    }
    grid.push(row);
  }
  return grid;
}

/** 教室概况统计 */
export function classroomSummary(state) {
  const seats = activeSeats(state.layout);
  const seated = Object.keys(state.assignment).filter(seat =>
    seats.some(s => s.id === seat) && state.assignment[seat] !== undefined).length;
  const male = state.students.list.filter(s => s.gender === '男').length;
  const female = state.students.list.length - male;
  const nearsighted = state.students.list.filter(s => s.vision === '近视').length;
  return {
    totalSeats: seats.length,
    seated,
    unseated: state.students.list.length - seated,
    students: state.students.list.length,
    male, female, nearsighted,
    locked: state.locks.length,
  };
}
