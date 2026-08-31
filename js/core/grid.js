/**
 * 网格几何：座位 ID、有效座位、同桌边（过道隔离）、前后边、前排区
 *
 * 布局模型：{ rows, seatCols, aisles, template }
 *   rows      排数 1-15
 *   seatCols  座位列数 1-20（过道不占列）
 *   aisles    过道位置：第 N 个座位列之后（N ∈ 1..seatCols-1）
 */
import { TEMPLATES } from './constants.js';

export function seatId(row, col) { return `${row}-${col}`; }

export function parseSeatId(id) {
  const i = id.indexOf('-');
  return { row: +id.slice(0, i), col: +id.slice(i + 1) };
}

const clampInt = (v, min, max, dft) => {
  const n = Math.round(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dft;
};

/**
 * 布局归一化。
 * 兼容旧 schema（cols 为含过道的网格总列数）：cols - 过道数 = 座位列数，
 * 网格过道列号 c → 其左侧座位列号（c - 1 - 前面过道数）。
 */
export function normalizeLayout(layout = {}) {
  let seatCols;
  let aisleInput = layout.aisles;

  if (layout.seatCols != null) {
    seatCols = layout.seatCols;
  } else if (layout.cols != null) {
    // 旧 schema：cols 含过道列
    const cols = clampInt(layout.cols, 1, 20, 8);
    const oldAisles = [...new Set((layout.aisles || [])
      .filter(c => Number.isInteger(c) && c >= 1 && c <= cols))].sort((a, b) => a - b);
    seatCols = cols - oldAisles.length;
    aisleInput = oldAisles.map((c, i) => c - 1 - i);
  } else {
    seatCols = 8;
    aisleInput = [];
  }

  seatCols = clampInt(seatCols, 1, 20, 8);
  const aisleSet = new Set((aisleInput || [])
    .filter(n => Number.isInteger(n) && n >= 1 && n <= seatCols - 1));

  return {
    rows: clampInt(layout.rows, 1, 15, 7),
    seatCols,
    aisles: [...aisleSet].sort((a, b) => a - b),
    template: layout.template || 'custom',
  };
}

/** 全部有效座位（过道不占列，每列都有座位），按行优先、列升序 */
export function activeSeats(layout) {
  const seats = [];
  for (let r = 1; r <= layout.rows; r++) {
    for (let c = 1; c <= layout.seatCols; c++) {
      seats.push({ id: seatId(r, c), row: r, col: c });
    }
  }
  return seats;
}

/** c 与 c+1 列之间是否有过道 */
export function aisleBetween(layout, c) {
  return layout.aisles.includes(c);
}

/** 前排区行数：ratio ∈ [0.05, 0.9] */
export function frontRowCount(layout, ratio) {
  const r = Math.min(0.9, Math.max(0.05, ratio || 0.3));
  return Math.max(1, Math.round(layout.rows * r));
}

/**
 * 同桌边：同行、列号相邻、且两列之间无过道
 * @param aisles 过道位置数组（第 N 列之后），如 [4] 表示第 4、5 列不成同桌
 * @returns [{a: seat, b: seat}]
 */
export function deskEdges(seats, aisles = []) {
  const aisleSet = new Set(aisles);
  const byRow = new Map();
  for (const s of seats) {
    if (!byRow.has(s.row)) byRow.set(s.row, []);
    byRow.get(s.row).push(s);
  }
  const edges = [];
  for (const row of byRow.values()) {
    row.sort((x, y) => x.col - y.col);
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i + 1].col - row[i].col === 1 && !aisleSet.has(row[i].col)) {
        edges.push({ a: row[i], b: row[i + 1] });
      }
    }
  }
  return edges;
}

/** 前后边：同列且行号相邻。@returns [{front: seat, back: seat}] */
export function frontBackEdges(seats) {
  const byCol = new Map();
  for (const s of seats) {
    if (!byCol.has(s.col)) byCol.set(s.col, []);
    byCol.get(s.col).push(s);
  }
  const edges = [];
  for (const col of byCol.values()) {
    col.sort((x, y) => x.row - y.row);
    for (let i = 0; i < col.length - 1; i++) {
      if (col[i + 1].row - col[i].row === 1) edges.push({ front: col[i], back: col[i + 1] });
    }
  }
  return edges;
}

/** 应用模板 */
export function templateLayout(templateId) {
  const t = TEMPLATES.find(t => t.id === templateId);
  if (!t) return null;
  return normalizeLayout({ rows: t.rows, seatCols: t.seatCols, aisles: [...t.aisles], template: t.id });
}
