/**
 * 座位轮换：只移动位置、不重新分配。
 * 原理：在「非锁定座位集合」上按组（行/列/蛇形全局）构造循环置换，
 * 每个学生移向序列中的下一个座位，队尾绕回队首；锁定座位不参与（不迁出、不被迁入），因此无碰撞。
 */

export const ROTATION_MODES = [
  { id: 'shiftLeft',   name: '整体左移', ico: '⬅️', desc: '每排向左移动一格，排首绕到排尾' },
  { id: 'shiftRight',  name: '整体右移', ico: '➡️', desc: '每排向右移动一格，排尾绕到排首' },
  { id: 'rowBackward', name: '整排后移', ico: '⬇️', desc: '每排向后移动一排，末排绕回第一排' },
  { id: 'rowForward',  name: '整排前移', ico: '⬆️', desc: '每排向前移动一排，第一排绕到末排' },
  { id: 'snake',       name: '蛇形轮换', ico: '🐍', desc: '按蛇形顺序（第1排左→右、第2排右→左…）整体前进一位' },
];

/**
 * 构造轮换映射 fromSeatId -> toSeatId（学生从 from 座位迁到 to 座位）
 * @param activeSeatList 全部有效座位（含锁定，函数内剔除）
 * @param locks Set<seatId>
 * @returns {Map<string, string>} 非锁定座位上的双射
 */
export function buildRotationMap(activeSeatList, locks, mode) {
  const movable = activeSeatList.filter(s => !locks.has(s.id));
  if (movable.length < 2) return new Map();

  /** 组内循环：seq 为同组座位数组，学生从 seq[i] 迁到 seq[(i+1)%n] */
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
      if (reverse) g.reverse(); // 反转循环序列 = 反向移动
      for (const [k, v] of cycle(g)) map.set(k, v);
    }
    return map;
  };

  switch (mode) {
    case 'shiftRight':  // 行内 col 升序环 → 每人右移一格
      return cycleByGroups(s => `r${s.row}`, false);
    case 'shiftLeft':   // 行内 col 降序环 → 每人左移一格
      return cycleByGroups(s => `r${s.row}`, true);
    case 'rowBackward': // 列内 row 升序环 → 每人后移一排
      return cycleByGroups(s => `c${s.col}`, false);
    case 'rowForward':  // 列内 row 降序环 → 每人前移一排
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
 * 应用轮换：返回新的 assignment（seatId -> studentId）
 */
export function applyRotation(activeSeatList, locks, assignment, mode) {
  const map = buildRotationMap(activeSeatList, locks, mode);
  const next = { ...assignment };
  for (const from of map.keys()) delete next[from];         // 清空迁移源
  for (const [from, to] of map) {                           // 学生落到目标座位
    const sid = assignment[from];
    if (sid !== undefined) next[to] = sid;
  }
  return { assignment: next, moved: map.size };
}
