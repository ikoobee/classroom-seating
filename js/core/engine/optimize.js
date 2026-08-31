/**
 * 局部搜索优化：爬山 + 模拟退火混合
 * 优化目标 = 软规则总分 − 硬冲突罚分（驱动初始解中的硬冲突被主动修复）
 */
import { evaluate } from './evaluate.js';
import { randomMove, applyMove, revertMove, affectedStudents } from './moves.js';
import { isMoveAcceptable } from './constraints.js';

const HARD_PENALTY = 25; // 每项硬冲突罚 25 分

const objective = (ctx, bySeat, byStudent) => {
  const s = evaluate(ctx, bySeat, byStudent);
  return s.total - s.hardViolations.length * HARD_PENALTY;
};

/**
 * @param budget {{maxIter?: number, timeMs?: number}}
 * @returns {{bySeat, byStudent, score, iterations, elapsedMs}}
 */
export function optimize(ctx, init, budget = {}, rng) {
  const { bySeat, byStudent } = init;
  const maxIter = budget.maxIter ?? 8000;
  const timeMs = budget.timeMs ?? 300;

  let curObj = objective(ctx, bySeat, byStudent);
  const best = { bySeat: new Map(bySeat), byStudent: new Map(byStudent) };
  let bestObj = curObj;

  const T0 = 4, ALPHA = 0.999, T_MIN = 0.12, idleLimit = 700;
  const t0 = Date.now();
  let idle = 0, iter = 0;

  while (iter < maxIter && Date.now() - t0 < timeMs) {
    iter++;
    const move = randomMove(ctx, bySeat, byStudent, rng);
    if (!move) continue;

    applyMove(bySeat, byStudent, move);
    const affected = affectedStudents(bySeat, move);

    if (!isMoveAcceptable(ctx, bySeat, byStudent, affected)) {
      revertMove(bySeat, byStudent, move);
      continue;
    }

    const obj = objective(ctx, bySeat, byStudent);
    const d = obj - curObj;
    const T = Math.max(T_MIN, T0 * Math.pow(ALPHA, iter));

    if (d >= 0 || rng() < Math.exp(d / T)) {
      curObj = obj;
      if (obj > bestObj) {
        best.bySeat = new Map(bySeat);
        best.byStudent = new Map(byStudent);
        bestObj = obj;
        idle = 0;
      } else idle++;
    } else {
      revertMove(bySeat, byStudent, move);
    }
    if (idle > idleLimit) break;
  }

  return {
    bySeat: best.bySeat,
    byStudent: best.byStudent,
    score: evaluate(ctx, best.bySeat, best.byStudent),
    iterations: iter,
    elapsedMs: Date.now() - t0,
  };
}
