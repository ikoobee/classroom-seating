/**
 * 引擎上下文：把应用状态（学生/布局/锁定/关系/规则）物化为算法友好的索引结构
 */
import { activeSeats, deskEdges, frontBackEdges, frontRowCount } from '../grid.js';
import { buildRelationIndex } from '../relations.js';
import { RULE_BY_ID } from '../constants.js';

/**
 * @param cfg {{
 *   students: object[],            // 全部学生
 *   layout: {rows, seatCols, aisles},
 *   locks: Set<string>,            // 锁定的 seatId
 *   assignment: object,            // 当前 seatId -> studentId（锁定座位上的学生保持不动）
 *   relations: {friends, blacklist},
 *   rules: {weights, order, frontRowRatio},
 *   prevAssignment: object|null,   // 上一次座位表（randomShuffle 维度用；无则 null）
 * }}
 */
export function buildContext(cfg) {
  const allSeats = activeSeats(cfg.layout);
  const seatById = new Map(allSeats.map(s => [s.id, s]));
  const byId = new Map(cfg.students.map(s => [s.id, s]));
  const locks = cfg.locks instanceof Set ? cfg.locks : new Set(cfg.locks || []);

  // 锁定座位及其学生（保持不动）
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

  // 可动座位 = 全部座位 - 锁定座位
  const seats = allSeats.filter(s => !locks.has(s.id));
  // 可动学生 = 全部学生 - 锁定座位上的学生
  const students = cfg.students.filter(s => !lockedStudentIds.has(s.id));

  // 规则（按 order 排序，权重 > 0 才参与）
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

    // 预筛选群体
    nearsighted: students.filter(s => s.vision === '近视'),
    naughty: students.filter(s => s.personality === '调皮'),
  };

  // 同桌边索引（seatId 对 -> 边）；含锁定座位上的边（用于好友/黑名单判定）
  ctx.deskEdgeKey = new Set(ctx.deskEdges.map(e => `${e.a.id}|${e.b.id}`));
  return ctx;
}

/** seatId 是否与 seatId2 构成同桌边 */
export function isDeskPair(ctx, seatId1, seatId2) {
  return ctx.deskEdgeKey.has(`${seatId1}|${seatId2}`) || ctx.deskEdgeKey.has(`${seatId2}|${seatId1}`);
}

/** 找 seatId 的同桌座位 id */
export function deskmateOf(ctx, seatId) {
  for (const e of ctx.deskEdges) {
    if (e.a.id === seatId) return e.b.id;
    if (e.b.id === seatId) return e.a.id;
  }
  return null;
}
