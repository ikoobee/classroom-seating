/**
 * Engine context: materializes app state (students / layout / locks /
 * relations / rules) into index structures friendly to the algorithms
 */
import { activeSeats, deskEdges, frontBackEdges, frontRowCount } from '../grid.js';
import { buildRelationIndex } from '../relations.js';
import { RULE_BY_ID } from '../constants.js';

/**
 * @param cfg {{
 *   students: object[],            // all students
 *   layout: {rows, seatCols, aisles},
 *   locks: Set<string>,            // locked seatIds
 *   assignment: object,            // current seatId -> studentId (students on locked seats stay put)
 *   relations: {friends, blacklist},
 *   rules: {weights, order, frontRowRatio},
 *   prevAssignment: object|null,   // previous seating chart (used by the randomShuffle dimension; null if none)
 * }}
 */
export function buildContext(cfg) {
  const allSeats = activeSeats(cfg.layout);
  const seatById = new Map(allSeats.map(s => [s.id, s]));
  const byId = new Map(cfg.students.map(s => [s.id, s]));
  const locks = cfg.locks instanceof Set ? cfg.locks : new Set(cfg.locks || []);

  // Locked seats and their students (kept as-is)
  const lockedAssignment = {};
  const lockedStudentIds = new Set();
  for (const seatId of locks) {
    const sid = cfg.assignment?.[seatId];
    if (sid !== undefined && byId.has(sid)) {
      lockedAssignment[seatId] = sid;
      lockedStudentIds.add(sid);
    }
  }
  const lockedByStudent = new Map(Object.entries(lockedAssignment).map(([seat, sid]) => [sid, seat]));

  // Movable seats = all seats - locked seats
  const seats = allSeats.filter(s => !locks.has(s.id));
  // Movable students = all students - students on locked seats
  const students = cfg.students.filter(s => !lockedStudentIds.has(s.id));

  // Rules (sorted by order; only weight > 0 takes part)
  const { weights = {}, order = [], frontRowRatio = 0.3 } = cfg.rules || {};
  const ruleOrder = order.length ? order : Object.keys(weights);
  const rules = ruleOrder
    .map(id => RULE_BY_ID[id] ? { id, name: RULE_BY_ID[id].name, weight: weights[id] || 0 } : null)
    .filter(Boolean);

  const ctx = {
    allSeats, seatById, byId, locks,
    lockedAssignment, lockedStudentIds, lockedByStudent,
    students, seats,
    rules, frontRowRatio,
    frontRow: frontRowCount(cfg.layout, frontRowRatio),
    rows: cfg.layout.rows,
    deskEdges: deskEdges(allSeats, cfg.layout.aisles),
    frontBackEdges: frontBackEdges(allSeats),
    relationIndex: buildRelationIndex(cfg.relations || { friends: [], blacklist: [] }),
    relations: cfg.relations || { friends: [], blacklist: [] },
    prevAssignment: cfg.prevAssignment || null,

    // Pre-filtered groups
    nearsighted: students.filter(s => s.vision === '近视'),
    naughty: students.filter(s => s.personality === '调皮'),
  };

  // Deskmate edge index (seatId pair -> edge); includes edges on locked seats (needed for friend/blacklist checks)
  ctx.deskEdgeKey = new Set(ctx.deskEdges.map(e => `${e.a.id}|${e.b.id}`));
  return ctx;
}

/** Whether seatId1 and seatId2 form a deskmate edge */
export function isDeskPair(ctx, seatId1, seatId2) {
  return ctx.deskEdgeKey.has(`${seatId1}|${seatId2}`) || ctx.deskEdgeKey.has(`${seatId2}|${seatId1}`);
}

/** Find the deskmate seat id of seatId */
export function deskmateOf(ctx, seatId) {
  for (const e of ctx.deskEdges) {
    if (e.a.id === seatId) return e.b.id;
    if (e.b.id === seatId) return e.a.id;
  }
  return null;
}
