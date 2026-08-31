/**
 * 不可满足预检：fatal（无法出解，直接报错）/ warning（可出解但需明示）
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

  // 好友对几何可行性
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

  // 座位几何限制：一人只有一位同桌，共享学生的好友对不可能同时满足
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

  // 跨列表冲突：同一对学生既是好友（必须同桌）又在黑名单（禁止相邻），两约束矛盾
  for (const p of ctx.relations.friends) {
    if (!ctx.byId.has(p.a) || !ctx.byId.has(p.b)) continue;
    const clash = ctx.relations.blacklist.some(q =>
      (q.a === p.a && q.b === p.b) || (q.a === p.b && q.b === p.a));
    if (clash) {
      warnings.push(`好友 ${nameOf(p.a)} 与 ${nameOf(p.b)} 同时在黑名单中——两约束互相矛盾，请在「关系」中清理`);
    }
  }

  // 黑名单：双方锁定且仍相邻
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

  return { fatal, warnings };
}
