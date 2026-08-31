/**
 * 初始解构造：锁定固定 → 好友对成对落座 → 启发式排序填充 → 兜底
 */
import { HEIGHT_ORDER } from '../constants.js';

const zoneOk = (student, seat) =>
  !student.zone || (seat.row >= student.zone.rows[0] && seat.row <= student.zone.rows[1]);

function pairUrgency(ctx, p) {
  const a = ctx.byId.get(p.a), b = ctx.byId.get(p.b);
  let u = 0;
  if (a.vision === '近视' || b.vision === '近视') u += 2;
  if (a.personality === '调皮' || b.personality === '调皮') u += 2;
  if (a.height === '矮' || b.height === '矮') u += 1;
  return -u; // 越小越紧急
}

/**
 * @returns {bySeat, byStudent, warnings[], overflow}
 */
export function constructInitial(ctx, rng) {
  const bySeat = new Map();
  const byStudent = new Map();
  const set = (seatId, studentId) => { bySeat.set(seatId, studentId); byStudent.set(studentId, seatId); };
  const warnings = [];

  // 1. 锁定座位固定
  for (const [seat, sid] of Object.entries(ctx.lockedAssignment)) set(seat, sid);
  const usedSeats = new Set(Object.keys(ctx.lockedAssignment));
  const usedStudents = new Set(Object.values(ctx.lockedAssignment));

  // 2. 好友对成对落座（双方均可动才处理；单方/双方锁定在 precheck 中给警告）
  const nameOf = id => ctx.byId.get(id)?.name ?? `#${id}`;
  const friendPairs = ctx.relations.friends
    .filter(p => ctx.byId.has(p.a) && ctx.byId.has(p.b)
      && !ctx.lockedStudentIds.has(p.a) && !ctx.lockedStudentIds.has(p.b))
    .sort((x, y) => pairUrgency(ctx, x) - pairUrgency(ctx, y));

  for (const p of friendPairs) {
    if (usedStudents.has(p.a) || usedStudents.has(p.b)) {
      warnings.push(`好友 ${nameOf(p.a)} 与 ${nameOf(p.b)} 中有人已被其他同桌约束占用，本对拆散（一人只能与一位同桌）`);
      continue;
    }
    const a = ctx.byId.get(p.a), b = ctx.byId.get(p.b);
    const candidates = ctx.deskEdges.filter(e =>
      !usedSeats.has(e.a.id) && !usedSeats.has(e.b.id)
      && !ctx.locks.has(e.a.id) && !ctx.locks.has(e.b.id)
      && zoneOk(a, e.a) && zoneOk(a, e.b) && zoneOk(b, e.a) && zoneOk(b, e.b));
    if (!candidates.length) {
      warnings.push(`好友 ${nameOf(p.a)} 与 ${nameOf(p.b)} 无可用同桌座位，本方案将其拆散`);
      continue;
    }
    let best;
    if (pairUrgency(ctx, p) < 0) {
      best = candidates.reduce((m, e) => e.a.row < m.a.row ? e : m); // 紧急对尽量靠前
    } else {
      const avgH = ((HEIGHT_ORDER[a.height] ?? 1) + (HEIGHT_ORDER[b.height] ?? 1)) / 2;
      const targetRow = Math.max(1, Math.min(ctx.rows, Math.round((avgH / 2) * ctx.rows)));
      best = candidates.reduce((m, e) => Math.abs(e.a.row - targetRow) < Math.abs(m.a.row - targetRow) ? e : m);
    }
    set(best.a.id, p.a); set(best.b.id, p.b);
    usedSeats.add(best.a.id); usedSeats.add(best.b.id);
    usedStudents.add(p.a); usedStudents.add(p.b);
  }

  // 3. 其余学生按优先级（近视/调皮/矮个靠前）+ 随机抖动排序，行优先填充
  const rest = ctx.students.filter(s => !usedStudents.has(s.id));
  const priority = s =>
    (s.vision === '近视' ? 30 : 0)
    + (s.personality === '调皮' ? 24 : 0)
    + (s.height === '矮' ? 18 : 0)
    + (s.annotationColor === 'red' ? 8 : 0)
    + rng() * 14;
  rest.sort((x, y) => priority(y) - priority(x));

  const freeSeats = ctx.seats.filter(s => !usedSeats.has(s.id))
    .sort((x, y) => x.row - y.row || x.col - y.col);

  /** 座位与已落座的左/前邻居是否构成黑名单冲突 */
  const conflictsPlaced = (seat, s) => {
    const blacks = ctx.relationIndex.blackOf.get(s.id);
    if (!blacks) return false;
    const left = ctx.seatById.get(`${seat.row}-${seat.col - 1}`);
    const front = ctx.seatById.get(`${seat.row - 1}-${seat.col}`);
    for (const { partner, noFrontBack } of blacks) {
      const lOcc = left ? bySeat.get(left.id) : undefined;
      const fOcc = front ? bySeat.get(front.id) : undefined;
      if (lOcc === partner) return true; // 同桌冲突
      if (noFrontBack && fOcc === partner) return true;
    }
    return false;
  };

  let idx = 0;
  let overflow = 0;
  for (const s of rest) {
    if (idx >= freeSeats.length) { overflow++; continue; }
    // 找下一个满足 zone 且不与已落座邻居黑名单冲突的座位
    let j = idx;
    while (j < freeSeats.length) {
      const cand = freeSeats[j];
      const zoneMiss = s.zone && (cand.row < s.zone.rows[0] || cand.row > s.zone.rows[1]);
      if (!zoneMiss && !conflictsPlaced(cand, s)) break;
      j++;
    }
    if (j >= freeSeats.length) j = idx; // 找不到则兜底用当前位置（交给优化阶段修复）
    const seat = freeSeats[j];
    [freeSeats[idx], freeSeats[j]] = [freeSeats[j], freeSeats[idx]];
    set(seat.id, s.id);
    idx++;
  }
  if (overflow > 0) warnings.push(`${overflow} 名学生超出座位容量，未能入座`);

  return { bySeat, byStudent, warnings, overflow };
}
