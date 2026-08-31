/**
 * 邻域动作：swap（交换两座位）/ move（移到空位）/ pairSwap（两同桌对整体交换）/ pairMove（同桌对迁移到空同桌位）
 * 涉及好友对学生的单方 move 由生成阶段直接拒绝；合法性由 apply 后的 isMoveAcceptable 终审
 */

export function randomMove(ctx, bySeat, byStudent, rng) {
  const seats = ctx.seats;
  const n = seats.length;
  if (n < 2) return null;

  const friendLocked = ctx._friendLocked
    ?? (ctx._friendLocked = (() => {
      const set = new Set();
      for (const p of ctx.relations.friends) {
        if (!ctx.lockedStudentIds.has(p.a) && !ctx.lockedStudentIds.has(p.b)
          && ctx.byId.has(p.a) && ctx.byId.has(p.b)) { set.add(p.a); set.add(p.b); }
      }
      return set;
    })());

  // 25% 概率尝试同桌对整体移动（保持好友对完整）
  if (rng() < 0.25) {
    const pairMove = tryPairMove(ctx, bySeat, rng);
    if (pairMove) return pairMove;
  }

  // 个体 move / swap
  const s1 = seats[Math.floor(rng() * n)];
  const s2 = seats[Math.floor(rng() * n)];
  if (s1.id === s2.id) return null;
  const occ1 = bySeat.get(s1.id);
  const occ2 = bySeat.get(s2.id);

  if (occ1 !== undefined && occ2 !== undefined) {
    if (friendLocked.has(occ1) || friendLocked.has(occ2)) return null;
    return { type: 'swap', a: s1.id, b: s2.id };
  }
  if (occ1 !== undefined && occ2 === undefined) {
    if (friendLocked.has(occ1)) return null;
    return { type: 'move', from: s1.id, to: s2.id };
  }
  if (occ1 === undefined && occ2 !== undefined) {
    if (friendLocked.has(occ2)) return null;
    return { type: 'move', from: s2.id, to: s1.id };
  }
  return null;
}

function tryPairMove(ctx, bySeat, rng) {
  const edges = ctx.deskEdges.filter(e => !ctx.locks.has(e.a.id) && !ctx.locks.has(e.b.id));
  if (edges.length < 2) return null;
  const pick = edges[Math.floor(rng() * edges.length)];
  const oa = bySeat.get(pick.a.id), ob = bySeat.get(pick.b.id);
  if (oa === undefined || ob === undefined) return null;

  // 找另一条同桌边：必须与 pick 完全不相交（相邻边共享座位会导致 pairSwap 覆盖写、学生丢失）
  const other = edges[Math.floor(rng() * edges.length)];
  if (other === pick) return null;
  const shareSeat =
    other.a.id === pick.a.id || other.a.id === pick.b.id ||
    other.b.id === pick.a.id || other.b.id === pick.b.id;
  if (shareSeat) return null;

  const ta = bySeat.get(other.a.id), tb = bySeat.get(other.b.id);
  if (ta !== undefined && tb !== undefined) {
    // 同桌对整体交换（好友对仍保持同桌）
    return { type: 'pairSwap', e1: [pick.a.id, pick.b.id], e2: [other.a.id, other.b.id] };
  }
  if (ta === undefined && tb === undefined) {
    return { type: 'pairMove', from: [pick.a.id, pick.b.id], to: [other.a.id, other.b.id] };
  }
  return null;
}

/** 应用 move（原地修改 bySeat/byStudent） */
export function applyMove(bySeat, byStudent, move) {
  switch (move.type) {
    case 'swap': {
      const sa = bySeat.get(move.a), sb = bySeat.get(move.b);
      bySeat.set(move.a, sb); bySeat.set(move.b, sa);
      byStudent.set(sa, move.b); byStudent.set(sb, move.a);
      return;
    }
    case 'move': {
      const sid = bySeat.get(move.from);
      bySeat.delete(move.from);
      bySeat.set(move.to, sid);
      byStudent.set(sid, move.to);
      return;
    }
    case 'pairSwap': {
      const [x1, y1] = move.e1, [x2, y2] = move.e2;
      const sx = bySeat.get(x1), sy = bySeat.get(y1);
      const tx = bySeat.get(x2), ty = bySeat.get(y2);
      bySeat.set(x1, tx); bySeat.set(y1, ty); bySeat.set(x2, sx); bySeat.set(y2, sy);
      if (tx !== undefined) byStudent.set(tx, x1);
      if (ty !== undefined) byStudent.set(ty, y1);
      if (sx !== undefined) byStudent.set(sx, x2);
      if (sy !== undefined) byStudent.set(sy, y2);
      return;
    }
    case 'pairMove': {
      const [x1, y1] = move.from, [x2, y2] = move.to;
      const sx = bySeat.get(x1), sy = bySeat.get(y1);
      bySeat.delete(x1); bySeat.delete(y1);
      bySeat.set(x2, sx); bySeat.set(y2, sy);
      byStudent.set(sx, x2); byStudent.set(sy, y2);
      return;
    }
  }
}

/** 回滚 move */
export function revertMove(bySeat, byStudent, move) {
  switch (move.type) {
    case 'swap':
    case 'pairSwap':
      applyMove(bySeat, byStudent, move); // 自逆
      return;
    case 'move':
      applyMove(bySeat, byStudent, { type: 'move', from: move.to, to: move.from });
      return;
    case 'pairMove':
      applyMove(bySeat, byStudent, { type: 'pairMove', from: move.to, to: move.from });
      return;
  }
}

/** move 影响的学生（用于合法性快速检查） */
export function affectedStudents(bySeat, move) {
  switch (move.type) {
    case 'swap':
      return [bySeat.get(move.a), bySeat.get(move.b)].filter(x => x !== undefined);
    case 'move':
      return [bySeat.get(move.to)].filter(x => x !== undefined);
    case 'pairSwap':
      return move.e1.concat(move.e2).map(id => bySeat.get(id)).filter(x => x !== undefined);
    case 'pairMove':
      return move.to.map(id => bySeat.get(id)).filter(x => x !== undefined);
  }
  return [];
}
