/**
 * Distribution statistics and heatmap data aggregation
 * (shared by the UI dashboard and Excel export)
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

/** Student attribute distributions (for donut/bar charts) */
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

/** Per-dimension distribution across rows/columns (heatmap). Returns a rows×seatCols matrix (with an {aisle:true} gap cell inserted after each aisle column); cells are {value} or null (empty seat) */
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

/** Classroom summary statistics */
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
