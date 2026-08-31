/**
 * Initial solution construction: pin locked seats → seat friend pairs together
 * → heuristic ordered fill → fallback
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
  return -u; // smaller = more urgent
}

/**
 * @returns {bySeat, byStudent, warnings[], overflow}
 */
export function constructInitial(ctx, rng) {
  const bySeat = new Map();
  const byStudent = new Map();
  const set = (seatId, studentId) => { bySeat.set(seatId, studentId); byStudent.set(studentId, seatId); };
  const warnings = [];

  // 1. Pin locked seats
  for (const [seat, sid] of Object.entries(ctx.lockedAssignment)) set(seat, sid);
  const usedSeats = new Set(Object.keys(ctx.lockedAssignment));
  const usedStudents = new Set(Object.values(ctx.lockedAssignment));

  // 2. Seat friend pairs together (only when both sides are movable; one/both locked is warned in precheck)
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
      best = candidates.reduce((m, e) => e.a.row < m.a.row ? e : m); // urgent pairs go as far forward as possible
    } else {
      const avgH = ((HEIGHT_ORDER[a.height] ?? 1) + (HEIGHT_ORDER[b.height] ?? 1)) / 2;
      const targetRow = Math.max(1, Math.min(ctx.rows, Math.round((avgH / 2) * ctx.rows)));
      best = candidates.reduce((m, e) => Math.abs(e.a.row - targetRow) < Math.abs(m.a.row - targetRow) ? e : m);
    }
    set(best.a.id, p.a); set(best.b.id, p.b);
    usedSeats.add(best.a.id); usedSeats.add(best.b.id);
    usedStudents.add(p.a); usedStudents.add(p.b);
  }

  // 3. Fill the remaining students by priority (nearsighted / naughty / short up front) + random jitter, row-major
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

  /** Whether the seat creates a blacklist conflict with its already-seated left/front neighbors */
  const conflictsPlaced = (seat, s) => {
    const blacks = ctx.relationIndex.blackOf.get(s.id);
    if (!blacks) return false;
    const left = ctx.seatById.get(`${seat.row}-${seat.col - 1}`);
    const front = ctx.seatById.get(`${seat.row - 1}-${seat.col}`);
    for (const { partner, noFrontBack } of blacks) {
      const lOcc = left ? bySeat.get(left.id) : undefined;
      const fOcc = front ? bySeat.get(front.id) : undefined;
      if (lOcc === partner) return true; // deskmate conflict
      if (noFrontBack && fOcc === partner) return true;
    }
    return false;
  };

  let idx = 0;
  let overflow = 0;
  for (const s of rest) {
    if (idx >= freeSeats.length) { overflow++; continue; }
    // Find the next seat that satisfies the zone and has no blacklist conflict with seated neighbors
    let j = idx;
    while (j < freeSeats.length) {
      const cand = freeSeats[j];
      const zoneMiss = s.zone && (cand.row < s.zone.rows[0] || cand.row > s.zone.rows[1]);
      if (!zoneMiss && !conflictsPlaced(cand, s)) break;
      j++;
    }
    if (j >= freeSeats.length) j = idx; // fallback: keep the current position (the optimizer will repair)
    const seat = freeSeats[j];
    [freeSeats[idx], freeSeats[j]] = [freeSeats[j], freeSeats[idx]];
    set(seat.id, s.id);
    idx++;
  }
  if (overflow > 0) warnings.push(`${overflow} 名学生超出座位容量，未能入座`);

  return { bySeat, byStudent, warnings, overflow };
}
