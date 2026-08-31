/**
 * 引擎编排：单方案生成 / 多候选方案生成 / 当前方案评分
 */
import { buildContext } from './context.js';
import { precheck } from './precheck.js';
import { constructInitial } from './construct.js';
import { optimize } from './optimize.js';
import { evaluate } from './evaluate.js';
import { mulberry32 } from '../rng.js';

const nextTick = () => new Promise(r => setTimeout(r, 0));

function mapsToAssignment(ctx, bySeat) {
  const out = { ...ctx.lockedAssignment };
  for (const [seat, sid] of bySeat) out[seat] = sid;
  return out;
}

/**
 * 生成单个排座方案
 * @returns {{
 *   ok: boolean, fatal?: string[], warnings?: string[],
 *   assignment?: object, score?: object, meta?: object
 * }}
 */
export function generateSolution(cfg, seed, budget) {
  const ctx = buildContext(cfg);
  const pre = precheck(ctx);
  if (pre.fatal.length) return { ok: false, fatal: pre.fatal, warnings: pre.warnings };

  const rng = mulberry32(seed);
  const init = constructInitial(ctx, rng);
  const opt = optimize(ctx, init, budget, rng);
  const score = evaluate(ctx, opt.bySeat, opt.byStudent);

  return {
    ok: true,
    warnings: [...pre.warnings, ...init.warnings],
    assignment: mapsToAssignment(ctx, opt.bySeat),
    score,
    meta: { seed, iterations: opt.iterations, elapsedMs: opt.elapsedMs },
  };
}

/**
 * 生成 N 个候选方案（不同随机种子），按总分降序
 * @param onProgress (done, total) => void
 */
export async function generateCandidates(cfg, N, seedBase, onProgress, budget) {
  const count = Math.min(12, Math.max(1, Math.round(N)));
  const ctx = buildContext(cfg);
  const pre = precheck(ctx);
  if (pre.fatal.length) return { ok: false, fatal: pre.fatal, warnings: pre.warnings };

  const candidates = [];
  const sharedWarnings = new Set(pre.warnings);
  for (let k = 0; k < count; k++) {
    const seed = (seedBase + k * 7919) >>> 0;
    const rng = mulberry32(seed);
    const init = constructInitial(ctx, rng);
    const opt = optimize(ctx, init, budget, rng);
    const score = evaluate(ctx, opt.bySeat, opt.byStudent);
    init.warnings.forEach(w => sharedWarnings.add(w));
    candidates.push({
      seed,
      assignment: mapsToAssignment(ctx, opt.bySeat),
      score,
      meta: { iterations: opt.iterations, elapsedMs: opt.elapsedMs },
    });
    onProgress?.(k + 1, count);
    await nextTick(); // 让出主线程刷新进度
  }
  candidates.sort((a, b) => b.score.total - a.score.total);
  return { ok: true, candidates, warnings: [...sharedWarnings] };
}

/**
 * 评分任意一个座位表（评分徽章 / 报告用）
 * @param assignment seatId -> studentId（完整表，含锁定）
 */
export function scoreAssignment(cfg, assignment) {
  const ctx = buildContext(cfg);
  const bySeat = new Map(), byStudent = new Map();
  for (const [seat, sid] of Object.entries(assignment || {})) {
    if (!ctx.seatById.has(seat) || !ctx.byId.has(sid)) continue;
    bySeat.set(seat, sid);
    byStudent.set(sid, seat);
  }
  return { ctx, bySeat, byStudent, score: evaluate(ctx, bySeat, byStudent) };
}
