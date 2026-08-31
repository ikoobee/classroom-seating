/**
 * Engine orchestration: single solution generation / multiple candidate
 * generation / scoring of an existing seating chart
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
 * Generate a single seating arrangement
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
 * Generate N candidate solutions (distinct random seeds), sorted by total score descending
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
    await nextTick(); // yield to the main thread so progress can render
  }
  candidates.sort((a, b) => b.score.total - a.score.total);
  return { ok: true, candidates, warnings: [...sharedWarnings] };
}

/**
 * Score an arbitrary seating chart (for the score badge / report)
 * @param assignment seatId -> studentId (the full chart, including locked seats)
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
