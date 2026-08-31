/**
 * Reducer: merges by slice, returns { state, changed }
 */
import { A } from './actions.js';
import { defaultRules } from '@ikoobee/seating-core';
import { normalizeLayout, activeSeats } from '@ikoobee/seating-core';
import { normalizeRelations, pruneRelations } from '@ikoobee/seating-core';

export function initialState() {
  return {
    students: { list: [], nextId: 1 },
    layout: normalizeLayout({ rows: 7, seatCols: 8, aisles: [2, 4, 6], template: 'standard' }),
    assignment: {},
    locks: [],
    relations: normalizeRelations(),
    rules: defaultRules(),
    settings: { theme: 'light', autoSave: true, annotationVisible: true, rulesCollapsed: false },
    logs: [],
    ui: { filter: 'all', search: '', lockMode: false, selectedSeat: null, lastScore: null },
  };
}

const done = (state, patch, changed) => ({ state: { ...state, ...patch }, changed });

export function reducer(state, action) {
  switch (action.type) {
    case A.HYDRATE:
      return { state: action.state, changed: Object.keys(action.state) };

    case A.SET_STUDENTS: {
      const students = { list: action.list, nextId: action.nextId };
      // After the roster changes: prune invalid assignments and relations
      const ids = new Set(students.list.map(s => s.id));
      const assignment = {};
      for (const [seat, sid] of Object.entries(state.assignment)) {
        if (ids.has(sid)) assignment[seat] = sid;
      }
      const relations = pruneRelations(state.relations, ids);
      return done(state, { students, assignment, relations }, ['students', 'assignment', 'relations']);
    }

    case A.ADD_STUDENT: {
      const s = action.student;
      const list = [...state.students.list, s];
      return done(state,
        { students: { list, nextId: Math.max(state.students.nextId, s.id + 1) } },
        ['students']);
    }

    case A.UPDATE_STUDENT: {
      const list = state.students.list.map(s => s.id === action.student.id ? action.student : s);
      return done(state, { students: { ...state.students, list } }, ['students']);
    }

    case A.DELETE_STUDENT: {
      const list = state.students.list.filter(s => s.id !== action.id);
      const assignment = {};
      for (const [seat, sid] of Object.entries(state.assignment)) {
        if (sid !== action.id) assignment[seat] = sid;
      }
      const ids = new Set(list.map(s => s.id));
      const relations = pruneRelations(state.relations, ids);
      return done(state, { students: { ...state.students, list }, assignment, relations },
        ['students', 'assignment', 'relations']);
    }

    case A.SET_LAYOUT: {
      const layout = normalizeLayout(action.layout);
      // Layout change: drop out-of-bounds seats and locks
      const valid = new Set(activeSeats(layout).map(s => s.id));
      const assignment = {};
      for (const [seat, sid] of Object.entries(state.assignment)) {
        if (valid.has(seat)) assignment[seat] = sid;
      }
      const locks = state.locks.filter(seat => valid.has(seat));
      return done(state, { layout, assignment, locks }, ['layout', 'assignment', 'locks']);
    }

    case A.SET_ASSIGNMENT:
      return done(state, { assignment: { ...action.assignment } }, ['assignment']);

    case A.ASSIGN: {
      const assignment = { ...state.assignment };
      // If the student is already seated elsewhere, remove that entry first
      for (const [seat, sid] of Object.entries(assignment)) {
        if (sid === action.studentId) delete assignment[seat];
      }
      // If the target seat is occupied, its student becomes unassigned
      delete assignment[action.seatId];
      assignment[action.seatId] = action.studentId;
      return done(state, { assignment }, ['assignment']);
    }

    case A.UNASSIGN: {
      const assignment = { ...state.assignment };
      delete assignment[action.seatId];
      return done(state, { assignment }, ['assignment']);
    }

    case A.SWAP_SEATS: {
      const assignment = { ...state.assignment };
      const a = assignment[action.seatA];
      const b = assignment[action.seatB];
      if (a === undefined && b === undefined) return { state, changed: [] };
      if (a !== undefined) assignment[action.seatB] = a; else delete assignment[action.seatB];
      if (b !== undefined) assignment[action.seatA] = b; else delete assignment[action.seatA];
      return done(state, { assignment }, ['assignment']);
    }

    case A.CLEAR_SEATS:
      return done(state, { assignment: {}, locks: [] }, ['assignment', 'locks']);

    case A.TOGGLE_LOCK: {
      const has = state.locks.includes(action.seatId);
      const locks = has
        ? state.locks.filter(s => s !== action.seatId)
        : [...state.locks, action.seatId];
      return done(state, { locks }, ['locks']);
    }

    case A.SET_LOCKS:
      return done(state, { locks: [...action.ids] }, ['locks']);

    case A.SET_RELATIONS:
      return done(state, { relations: normalizeRelations(action.relations) }, ['relations']);

    case A.SET_RULES:
      return done(state, { rules: { ...state.rules, ...action.rules } }, ['rules']);

    case A.SET_RULE_WEIGHT: {
      const rules = {
        ...state.rules,
        weights: { ...state.rules.weights, [action.id]: Math.max(0, Math.min(100, Math.round(action.weight))) },
      };
      return done(state, { rules }, ['rules']);
    }

    case A.REORDER_RULES:
      return done(state, { rules: { ...state.rules, order: [...action.order] } }, ['rules']);

    case A.SET_FRONT_RATIO: {
      const v = Math.max(0.05, Math.min(0.9, action.value));
      return done(state, { rules: { ...state.rules, frontRowRatio: v } }, ['rules']);
    }

    case A.SET_SETTINGS:
      return done(state, { settings: { ...state.settings, ...action.patch } }, ['settings']);

    case A.ADD_LOG: {
      const logs = [action.entry, ...state.logs].slice(0, 100);
      return done(state, { logs }, ['logs']);
    }

    case A.DELETE_LOG:
      return done(state, { logs: state.logs.filter(l => l.id !== action.id) }, ['logs']);

    case A.CLEAR_LOGS:
      return done(state, { logs: [] }, ['logs']);

    case A.SET_LOGS:
      return done(state, { logs: [...action.logs].slice(0, 100) }, ['logs']);

    case A.PATCH_UI:
      return done(state, { ui: { ...state.ui, ...action.patch } }, ['ui']);

    default:
      return { state, changed: [] };
  }
}
