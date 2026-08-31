/**
 * Hard constraints: friends must be deskmates, blacklist forbids deskmate /
 * front-back adjacency, zone assignment
 * Internal solution representation: { bySeat: Map<seatId, studentId>, byStudent: Map<studentId, seatId> }
 */
import { isDeskPair } from './context.js';

/**
 * Full hard-constraint check (used by the score report and as the final
 * legality gate for moves)
 * @returns [{type, msg, a?, b?}] violation list (empty = all satisfied)
 */
export function checkHard(ctx, bySeat, byStudent) {
  const violations = [];
  const nameOf = id => ctx.byId.get(id)?.name ?? `#${id}`;

  // Friends must be deskmates
  for (const p of ctx.relations.friends) {
    const sa = byStudent.get(p.a), sb = byStudent.get(p.b);
    if (sa === undefined || sb === undefined) continue;
    if (sa === sb) continue; // impossible
    if (!isDeskPair(ctx, sa, sb)) {
      violations.push({
        type: 'friend', a: p.a, b: p.b,
        msg: `好友 ${nameOf(p.a)} 与 ${nameOf(p.b)} 未能同桌`,
      });
    }
  }

  // Blacklist
  for (const p of ctx.relations.blacklist) {
    const sa = byStudent.get(p.a), sb = byStudent.get(p.b);
    if (sa === undefined || sb === undefined) continue;
    const seatA = ctx.seatById.get(sa), seatB = ctx.seatById.get(sb);
    if (!seatA || !seatB) continue;
    const deskTogether = isDeskPair(ctx, sa, sb);
    const fbTogether = p.noFrontBack &&
      seatA.col === seatB.col && Math.abs(seatA.row - seatB.row) === 1;
    if (deskTogether) {
      violations.push({
        type: 'blacklist-desk', a: p.a, b: p.b,
        msg: `黑名单 ${nameOf(p.a)} 与 ${nameOf(p.b)} 成了同桌`,
      });
    } else if (fbTogether) {
      violations.push({
        type: 'blacklist-frontback', a: p.a, b: p.b,
        msg: `黑名单 ${nameOf(p.a)} 与 ${nameOf(p.b)} 前后相邻`,
      });
    }
  }

  // Zone assignment
  for (const s of ctx.students) {
    if (!s.zone || !Array.isArray(s.zone.rows)) continue;
    const seat = byStudent.get(s.id);
    if (seat === undefined) continue;
    const row = ctx.seatById.get(seat)?.row;
    if (row !== undefined && (row < s.zone.rows[0] || row > s.zone.rows[1])) {
      violations.push({
        type: 'zone', a: s.id,
        msg: `${s.name} 越出指定区域（第 ${s.zone.rows[0]}-${s.zone.rows[1]} 排），现坐第 ${row} 排`,
      });
    }
  }

  return violations;
}

/** Students in friend pairs (inseparable as a pair) */
export function friendLockedIds(ctx) {
  const set = new Set();
  for (const p of ctx.relations.friends) {
    // Friends on locked seats are surfaced as warnings by the construct stage; movable friend students cannot be moved unilaterally
    if (!ctx.lockedStudentIds.has(p.a) && !ctx.lockedStudentIds.has(p.b)) {
      set.add(p.a); set.add(p.b);
    }
  }
  return set;
}

/** Fast legality check after a move (only checks affected students + friends / blacklist / zone) */
export function isMoveAcceptable(ctx, bySeat, byStudent, affectedStudentIds) {
  // For each affected student: still deskmates with friends? Not adjacent to blacklist? Within zone?
  for (const sid of affectedStudentIds) {
    const seat = byStudent.get(sid);
    if (seat === undefined) continue;
    const seatObj = ctx.seatById.get(seat);

    // Friends
    const friends = ctx.relationIndex.friendOf.get(sid);
    if (friends) {
      for (const f of friends) {
        const fSeat = byStudent.get(f);
        if (fSeat === undefined) continue;
        if (!isDeskPair(ctx, seat, fSeat)) return false;
      }
    }
    // Blacklist
    const blacks = ctx.relationIndex.blackOf.get(sid);
    if (blacks && seatObj) {
      for (const { partner, noFrontBack } of blacks) {
        const pSeat = byStudent.get(partner);
        if (pSeat === undefined) continue;
        if (isDeskPair(ctx, seat, pSeat)) return false;
        const p = ctx.seatById.get(pSeat);
        if (noFrontBack && p && p.col === seatObj.col && Math.abs(p.row - seatObj.row) === 1) return false;
      }
    }
    // Zone
    const student = ctx.byId.get(sid);
    if (student?.zone && seatObj) {
      if (seatObj.row < student.zone.rows[0] || seatObj.row > student.zone.rows[1]) return false;
    }
  }
  return true;
}
