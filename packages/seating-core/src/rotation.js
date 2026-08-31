/**
 * Seat rotation: moves students between seats without reassigning.
 * Approach: build a cyclic permutation over the set of unlocked seats, grouped
 * by row / column / global snake order. Every student moves to the next seat
 * in the sequence, with the tail wrapping around to the head. Locked seats
 * take no part (nothing moves out of or into them), so there are no collisions.
 */

export const ROTATION_MODES = [
  { id: 'shiftLeft',   name: '整体左移', ico: '⬅️', desc: '每排向左移动一格，排首绕到排尾' },
  { id: 'shiftRight',  name: '整体右移', ico: '➡️', desc: '每排向右移动一格，排尾绕到排首' },
  { id: 'rowBackward', name: '整排后移', ico: '⬇️', desc: '每排向后移动一排，末排绕回第一排' },
  { id: 'rowForward',  name: '整排前移', ico: '⬆️', desc: '每排向前移动一排，第一排绕到末排' },
  { id: 'snake',       name: '蛇形轮换', ico: '🐍', desc: '按蛇形顺序（第1排左→右、第2排右→左…）整体前进一位' },
];

/**
 * Build the rotation map fromSeatId -> toSeatId (each student moves from seat "from" to seat "to")
 * @param activeSeatList all active seats (locked seats are filtered out inside)
 * @param locks Set<seatId>
 * @returns {Map<string, string>} a bijection over the unlocked seats
 */
export function buildRotationMap(activeSeatList, locks, mode) {
  const movable = activeSeatList.filter(s => !locks.has(s.id));
  if (movable.length < 2) return new Map();

  /** Cycle within one group: seq is the group's seat array; each student moves from seq[i] to seq[(i+1)%n] */
  const cycle = (seq) => {
    const m = new Map();
    for (let i = 0; i < seq.length; i++) m.set(seq[i].id, seq[(i + 1) % seq.length].id);
    return m;
  };
  const cycleByGroups = (keyOf, reverse) => {
    const groups = new Map();
    for (const s of movable) {
      const k = keyOf(s);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
    }
    const map = new Map();
    for (let g of groups.values()) {
      g.sort((a, b) => a.col - b.col || a.row - b.row);
      if (reverse) g.reverse(); // reversing the cycle sequence = moving the other way
      for (const [k, v] of cycle(g)) map.set(k, v);
    }
    return map;
  };

  switch (mode) {
    case 'shiftRight':  // col-ascending cycle within each row → everyone shifts one seat right
      return cycleByGroups(s => `r${s.row}`, false);
    case 'shiftLeft':   // col-descending cycle within each row → everyone shifts one seat left
      return cycleByGroups(s => `r${s.row}`, true);
    case 'rowBackward': // row-ascending cycle within each column → everyone moves one row back
      return cycleByGroups(s => `c${s.col}`, false);
    case 'rowForward':  // row-descending cycle within each column → everyone moves one row forward
      return cycleByGroups(s => `c${s.col}`, true);
    case 'snake': {
      const byRow = new Map();
      for (const s of movable) {
        if (!byRow.has(s.row)) byRow.set(s.row, []);
        byRow.get(s.row).push(s);
      }
      const order = [];
      [...byRow.keys()].sort((a, b) => a - b).forEach((r, i) => {
        const row = byRow.get(r).sort((a, b) => a.col - b.col);
        if (i % 2 === 1) row.reverse();
        order.push(...row);
      });
      return cycle(order);
    }
    default:
      return new Map();
  }
}

/**
 * Apply the rotation: returns the new assignment (seatId -> studentId)
 */
export function applyRotation(activeSeatList, locks, assignment, mode) {
  const map = buildRotationMap(activeSeatList, locks, mode);
  const next = { ...assignment };
  for (const from of map.keys()) delete next[from];         // clear the source seats
  for (const [from, to] of map) {                           // drop students onto their target seats
    const sid = assignment[from];
    if (sid !== undefined) next[to] = sid;
  }
  return { assignment: next, moved: map.size };
}
