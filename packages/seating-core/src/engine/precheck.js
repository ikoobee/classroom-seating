/**
 * Unsatisfiability precheck: fatal (no solution possible, abort with error) /
 * warning (a solution exists but the user must be told)
 */
import { isDeskPair } from './context.js';

export function precheck(ctx) {
  const fatal = [];
  const warnings = [];
  const nameOf = id => ctx.byId.get(id)?.name ?? `#${id}`;

  if (ctx.students.length > ctx.seats.length) {
    fatal.push(`可安排学生数（${ctx.students.length}）超过可用座位数（${ctx.seats.length}），请缩小班级或增加座位`);
  }
  if (ctx.students.length === 0) {
    fatal.push('没有可安排的学生');
  }

  // Geometric feasibility of friend pairs
  const availDeskEdges = ctx.deskEdges
    .filter(e => !ctx.locks.has(e.a.id) && !ctx.locks.has(e.b.id)).length;
  const movablePairs = ctx.relations.friends.filter(p =>
    ctx.byId.has(p.a) && ctx.byId.has(p.b)
    && !ctx.lockedStudentIds.has(p.a) && !ctx.lockedStudentIds.has(p.b));
  if (movablePairs.length > availDeskEdges) {
    warnings.push(`好友对（${movablePairs.length} 对）超过可用同桌位（${availDeskEdges} 组），部分好友将无法同桌`);
  }

  for (const p of ctx.relations.friends) {
    if (!ctx.byId.has(p.a) || !ctx.byId.has(p.b)) continue;
    const aLocked = ctx.lockedStudentIds.has(p.a), bLocked = ctx.lockedStudentIds.has(p.b);
    if (aLocked && bLocked) {
      const sa = ctx.lockedByStudent.get(p.a), sb = ctx.lockedByStudent.get(p.b);
      if (!isDeskPair(ctx, sa, sb)) {
        warnings.push(`好友 ${nameOf(p.a)} 与 ${nameOf(p.b)} 的座位均已锁定且不同桌，本约束无法满足`);
      }
    } else if (aLocked !== bLocked) {
      warnings.push(`好友 ${nameOf(p.a)} 与 ${nameOf(p.b)} 中一人座位已锁定，两人无法同桌`);
    }
  }

  // Seat geometry limit: one student has exactly one deskmate, so friend pairs sharing a student cannot all be satisfied
  const friendDegree = new Map();
  for (const p of ctx.relations.friends) {
    if (!ctx.byId.has(p.a) || !ctx.byId.has(p.b)) continue;
    friendDegree.set(p.a, (friendDegree.get(p.a) ?? 0) + 1);
    friendDegree.set(p.b, (friendDegree.get(p.b) ?? 0) + 1);
  }
  for (const [sid, deg] of friendDegree) {
    if (deg > 1) {
      warnings.push(`${nameOf(sid)} 同时有 ${deg} 条同桌约束——一个座位只有一位同桌，只能满足其一（其余将拆散）`);
    }
  }

  // Cross-list conflict: the same pair is both friends (must be deskmates) and blacklisted (must not be adjacent) — contradictory constraints
  for (const p of ctx.relations.friends) {
    if (!ctx.byId.has(p.a) || !ctx.byId.has(p.b)) continue;
    const clash = ctx.relations.blacklist.some(q =>
      (q.a === p.a && q.b === p.b) || (q.a === p.b && q.b === p.a));
    if (clash) {
      warnings.push(`好友 ${nameOf(p.a)} 与 ${nameOf(p.b)} 同时在黑名单中——两约束互相矛盾，请在「关系」中清理`);
    }
  }

  // Blacklist: both sides locked yet still adjacent
  for (const p of ctx.relations.blacklist) {
    if (!ctx.byId.has(p.a) || !ctx.byId.has(p.b)) continue;
    if (ctx.lockedStudentIds.has(p.a) && ctx.lockedStudentIds.has(p.b)) {
      const sa = ctx.lockedByStudent.get(p.a), sb = ctx.lockedByStudent.get(p.b);
      const seatA = ctx.seatById.get(sa), seatB = ctx.seatById.get(sb);
      if (seatA && seatB) {
        const desk = isDeskPair(ctx, sa, sb);
        const fb = p.noFrontBack && seatA.col === seatB.col && Math.abs(seatA.row - seatB.row) === 1;
        if (desk || fb) warnings.push(`黑名单 ${nameOf(p.a)} 与 ${nameOf(p.b)} 的座位均已锁定且仍然相邻，本约束无法满足`);
      }
    }
  }

  // Zone constraints: capacity per row range + range sanity + locked-seat conflicts
  // Group movable zone students by clamped row range, then check each range has enough movable seats
  const clampedZoneOf = (s) => {
    let [r0, r1] = s.zone.rows;
    if (r0 > r1) { [r0, r1] = [r1, r0]; }
    const lo = Math.max(1, Math.min(r0, ctx.rows));
    const hi = Math.max(1, Math.min(r1, ctx.rows));
    return [lo, hi, r0, r1];
  };

  const zoneGroups = new Map(); // "lo-hi" -> { lo, hi, ids: [] }
  for (const s of ctx.students) {
    if (!s.zone || !Array.isArray(s.zone.rows) || s.zone.rows.length < 2) continue;
    const [lo, hi, rawLo, rawHi] = clampedZoneOf(s);
    if (rawLo !== lo || rawHi !== hi) {
      warnings.push(`${s.name} 的指定区域（第 ${rawLo}-${rawHi} 排）超出教室范围（共 ${ctx.rows} 排），已按第 ${lo}-${hi} 排处理`);
    }
    const key = `${lo}-${hi}`;
    if (!zoneGroups.has(key)) zoneGroups.set(key, { lo, hi, ids: [] });
    zoneGroups.get(key).ids.push(s.id);
  }
  for (const g of zoneGroups.values()) {
    const seatsInRange = ctx.seats.filter(s => s.row >= g.lo && s.row <= g.hi).length;
    if (g.ids.length > seatsInRange) {
      fatal.push(`指定区域（第 ${g.lo}-${g.hi} 排）内需安排 ${g.ids.length} 名学生（${g.ids.map(nameOf).join('、')}），但该区域仅有 ${seatsInRange} 个可动座位，请扩大区域或减少区域约束`);
    }
  }

  // Locked students whose locked seat violates their zone (lock wins; zone cannot be satisfied)
  for (const sid of ctx.lockedStudentIds) {
    const s = ctx.byId.get(sid);
    if (!s?.zone || !Array.isArray(s.zone.rows)) continue;
    const seatId = ctx.lockedByStudent.get(sid);
    const row = ctx.seatById.get(seatId)?.row;
    if (row !== undefined && (row < s.zone.rows[0] || row > s.zone.rows[1])) {
      warnings.push(`${s.name} 的座位已锁定在第 ${row} 排，与其指定区域（第 ${s.zone.rows[0]}-${s.zone.rows[1]} 排）冲突，区域约束无法满足`);
    }
  }

  return { fatal, warnings };
}
