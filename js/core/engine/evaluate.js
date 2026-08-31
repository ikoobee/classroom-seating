/**
 * 评分汇总：总分 + 各维度子分 + 硬冲突清单
 */
import { SCORERS } from './scorers.js';
import { checkHard } from './constraints.js';

/**
 * @returns {{
 *   total: number,                 // 0..100
 *   dimensions: [{id, name, weight, score, violations, details}],
 *   hardViolations: [{type, msg, a?, b?}],
 * }}
 */
export function evaluate(ctx, bySeat, byStudent) {
  const dimensions = [];
  let acc = 0, wSum = 0;
  for (const rule of ctx.rules) {
    if (rule.weight <= 0) continue;
    const fn = SCORERS[rule.id];
    if (!fn) continue;
    const r = fn(ctx, bySeat, byStudent);
    const w = rule.weight / 100;
    acc += w * r.score;
    wSum += w;
    dimensions.push({
      id: rule.id, name: rule.name, weight: rule.weight,
      score: Math.round(r.score * 100),
      violations: r.violations,
      details: r.details,
    });
  }
  return {
    total: Math.round((wSum ? acc / wSum : 0) * 100),
    dimensions,
    hardViolations: checkHard(ctx, bySeat, byStudent),
  };
}
