/**
 * Action types and creators (plain objects)
 */

export const A = {
  HYDRATE: 'HYDRATE',                       // full state replacement (migration / backup restore)
  SET_STUDENTS: 'SET_STUDENTS',             // {list, nextId} (import / demo data / clear)
  ADD_STUDENT: 'ADD_STUDENT',               // {student}
  UPDATE_STUDENT: 'UPDATE_STUDENT',         // {student}
  DELETE_STUDENT: 'DELETE_STUDENT',         // {id}
  SET_LAYOUT: 'SET_LAYOUT',                 // {layout}
  SET_ASSIGNMENT: 'SET_ASSIGNMENT',         // {assignment} (full replacement)
  ASSIGN: 'ASSIGN',                         // {studentId, seatId} (seat/move a single student)
  UNASSIGN: 'UNASSIGN',                     // {seatId}
  SWAP_SEATS: 'SWAP_SEATS',                 // {seatA, seatB}
  CLEAR_SEATS: 'CLEAR_SEATS',
  TOGGLE_LOCK: 'TOGGLE_LOCK',               // {seatId}
  SET_LOCKS: 'SET_LOCKS',                   // {ids}
  SET_RELATIONS: 'SET_RELATIONS',           // {relations}
  SET_RULES: 'SET_RULES',                   // {rules} (migration)
  SET_RULE_WEIGHT: 'SET_RULE_WEIGHT',       // {id, weight}
  REORDER_RULES: 'REORDER_RULES',           // {order}
  SET_FRONT_RATIO: 'SET_FRONT_RATIO',       // {value}
  SET_SETTINGS: 'SET_SETTINGS',             // {patch}
  ADD_LOG: 'ADD_LOG',                       // {entry}
  DELETE_LOG: 'DELETE_LOG',                 // {id}
  CLEAR_LOGS: 'CLEAR_LOGS',
  SET_LOGS: 'SET_LOGS',
  PATCH_UI: 'PATCH_UI',                     // {patch}
};

export const actions = {
  hydrate: state => ({ type: A.HYDRATE, state }),
  setStudents: (list, nextId) => ({ type: A.SET_STUDENTS, list, nextId }),
  addStudent: student => ({ type: A.ADD_STUDENT, student }),
  updateStudent: student => ({ type: A.UPDATE_STUDENT, student }),
  deleteStudent: id => ({ type: A.DELETE_STUDENT, id }),
  setLayout: layout => ({ type: A.SET_LAYOUT, layout }),
  setAssignment: assignment => ({ type: A.SET_ASSIGNMENT, assignment }),
  assign: (studentId, seatId) => ({ type: A.ASSIGN, studentId, seatId }),
  unassign: seatId => ({ type: A.UNASSIGN, seatId }),
  swapSeats: (seatA, seatB) => ({ type: A.SWAP_SEATS, seatA, seatB }),
  clearSeats: () => ({ type: A.CLEAR_SEATS }),
  toggleLock: seatId => ({ type: A.TOGGLE_LOCK, seatId }),
  setLocks: ids => ({ type: A.SET_LOCKS, ids }),
  setRelations: relations => ({ type: A.SET_RELATIONS, relations }),
  setRules: rules => ({ type: A.SET_RULES, rules }),
  setRuleWeight: (id, weight) => ({ type: A.SET_RULE_WEIGHT, id, weight }),
  reorderRules: order => ({ type: A.REORDER_RULES, order }),
  setFrontRatio: value => ({ type: A.SET_FRONT_RATIO, value }),
  setSettings: patch => ({ type: A.SET_SETTINGS, patch }),
  addLog: entry => ({ type: A.ADD_LOG, entry }),
  deleteLog: id => ({ type: A.DELETE_LOG, id }),
  clearLogs: () => ({ type: A.CLEAR_LOGS }),
  setLogs: logs => ({ type: A.SET_LOGS, logs }),
  patchUi: patch => ({ type: A.PATCH_UI, patch }),
};
