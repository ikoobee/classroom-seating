/**
 * 硬约束：好友必须同桌、黑名单禁止同桌/前后相邻、指定区域
 * 解的内部表示：{ bySeat: Map<seatId, studentId>, byStudent: Map<studentId, seatId> }
 */
import { isDeskPair } from './context.js';

/**
 * 全量硬约束检查（用于评分报告与 move 合法性终审）
 * @returns [{type, msg, a?, b?}] 违规列表（空 = 全部满足）
 */
export function checkHard(ctx, bySeat, byStudent) {
  const violations = [];
  const nameOf = id => ctx.byId.get(id)?.name ?? `#${id}`;

  // 好友必须同桌
  for (const p of ctx.relations.friends) {
    const sa = byStudent.get(p.a), sb = byStudent.get(p.b);
    if (sa === undefined || sb === undefined) continue;
    if (sa === sb) continue; // 不可能
    if (!isDeskPair(ctx, sa, sb)) {
      violations.push({
        type: 'friend', a: p.a, b: p.b,
        msg: `好友 ${nameOf(p.a)} 与 ${nameOf(p.b)} 未能同桌`,
      });
    }
  }

  // 黑名单
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

  // 指定区域
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

/** 好友对内学生（成对不可拆） */
export function friendLockedIds(ctx) {
  const set = new Set();
  for (const p of ctx.relations.friends) {
    // 锁定座位上的好友由构造阶段处理为 warning；可动的好友学生不可被单方 move
    if (!ctx.lockedStudentIds.has(p.a) && !ctx.lockedStudentIds.has(p.b)) {
      set.add(p.a); set.add(p.b);
    }
  }
  return set;
}

/** move 后的快速合法性检查（只查受影响学生 + 好友/黑名单/区域） */
export function isMoveAcceptable(ctx, bySeat, byStudent, affectedStudentIds) {
  // 逐个受影响学生：好友仍同桌？黑名单未邻接？区域未越界？
  for (const sid of affectedStudentIds) {
    const seat = byStudent.get(sid);
    if (seat === undefined) continue;
    const seatObj = ctx.seatById.get(seat);

    // 好友
    const friends = ctx.relationIndex.friendOf.get(sid);
    if (friends) {
      for (const f of friends) {
        const fSeat = byStudent.get(f);
        if (fSeat === undefined) continue;
        if (!isDeskPair(ctx, seat, fSeat)) return false;
      }
    }
    // 黑名单
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
    // 区域
    const student = ctx.byId.get(sid);
    if (student?.zone && seatObj) {
      if (seatObj.row < student.zone.rows[0] || seatObj.row > student.zone.rows[1]) return false;
    }
  }
  return true;
}
