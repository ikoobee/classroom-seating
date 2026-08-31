/**
 * Grid geometry: seat IDs, active seats, deskmate edges (split by aisles),
 * front-back edges, front zone
 *
 * Layout model: { rows, seatCols, aisles, template }
 *   rows      row count, 1-15
 *   seatCols  seat column count, 1-20 (aisles occupy no column)
 *   aisles    aisle positions: after the N-th seat column (N ∈ 1..seatCols-1)
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
 * Layout normalization.
 * Supports the legacy schema (cols is the total grid column count including
 * aisles): cols - aisleCount = seat column count, and a grid aisle column c
 * maps to the seat column on its left (c - 1 - aislesBefore).
 */
export function normalizeLayout(layout = {}) {
  let seatCols;
  let aisleInput = layout.aisles;

  if (layout.seatCols != null) {
    seatCols = layout.seatCols;
  } else if (layout.cols != null) {
    // Legacy schema: cols includes aisle columns
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

/** All active seats (aisles occupy no column, every column has seats), row-major, column ascending */
export function activeSeats(layout) {
  const seats = [];
  for (let r = 1; r <= layout.rows; r++) {
    for (let c = 1; c <= layout.seatCols; c++) {
      seats.push({ id: seatId(r, c), row: r, col: c });
    }
  }
  return seats;
}

/** Whether an aisle lies between columns c and c+1 */
export function aisleBetween(layout, c) {
  return layout.aisles.includes(c);
}

/** Front-zone row count: ratio ∈ [0.05, 0.9] */
export function frontRowCount(layout, ratio) {
  const r = Math.min(0.9, Math.max(0.05, ratio || 0.3));
  return Math.max(1, Math.round(layout.rows * r));
}

/**
 * Deskmate edges: same row, adjacent columns, and no aisle between the two columns
 * @param aisles aisle position array (after column N); e.g. [4] means columns 4 and 5 cannot be deskmates
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

/** Front-back edges: same column and adjacent rows. @returns [{front: seat, back: seat}] */
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

/** Build a layout from a template */
export function templateLayout(templateId) {
  const t = TEMPLATES.find(t => t.id === templateId);
  if (!t) return null;
  return normalizeLayout({ rows: t.rows, seatCols: t.seatCols, aisles: [...t.aisles], template: t.id });
}
