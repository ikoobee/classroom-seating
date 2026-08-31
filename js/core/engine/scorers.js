/**
 * 10 soft rules → 10 scoring dimensions
 * Uniform signature: (ctx, bySeat, byStudent) => { score: 0..1, violations: [], details: string }
 * 1 is optimal; total = weight-weighted average of dimensions × 100
 */
import { HEIGHT_ORDER, PERSONALITY_HARMONY } from '../constants.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const cap = (arr, n = 30) => arr.length > n ? arr.slice(0, n) : arr;

/** Vision protection: share of nearsighted students seated in the front zone */
function visionProtection(ctx, bySeat, byStudent) {
  const front = ctx.frontRow;
  let ok = 0;
  const violations = [];
  for (const s of ctx.nearsighted) {
    const seat = byStudent.get(s.id);
    if (seat === undefined) continue;
    const row = ctx.seatById.get(seat)?.row ?? 99;
    if (row <= front) ok++;
    else violations.push(`${s.name}（近视）在第 ${row} 排，前 ${front} 排为优先区`);
  }
  return {
    score: ctx.nearsighted.length ? ok / ctx.nearsighted.length : 1,
    violations: cap(violations),
    details: `${ok}/${ctx.nearsighted.length} 名近视学生在前 ${front} 排`,
  };
}

/** Height optimization: share of front-back edges that invert "tall in front, short behind" */
function heightOptimized(ctx, bySeat) {
  let bad = 0, total = 0;
  const violations = [];
  for (const e of ctx.frontBackEdges) {
    const fa = bySeat.get(e.front.id), fb = bySeat.get(e.back.id);
    if (fa === undefined || fb === undefined) continue;
    const sa = ctx.byId.get(fa), sb = ctx.byId.get(fb);
    const ha = HEIGHT_ORDER[sa.height], hb = HEIGHT_ORDER[sb.height];
    if (ha === undefined || hb === undefined) continue;
    total++;
    if (ha > hb) {
      bad++;
      violations.push(`${sa.name}（${sa.height}个子）遮挡后排 ${sb.name}（${sb.height}个子）`);
    }
  }
  return {
    score: total ? 1 - bad / total : 1,
    violations: cap(violations),
    details: total ? `${bad}/${total} 条前后邻接存在遮挡` : '无前后邻接对',
  };
}

/** Academic balance: fewer deskmate/front-back pairs with identical academic levels is better */
function academicBalance(ctx, bySeat) {
  let same = 0, total = 0;
  const violations = [];
  const pairs = [];
  for (const e of ctx.deskEdges) pairs.push([e.a, e.b, '同桌']);
  for (const e of ctx.frontBackEdges) pairs.push([e.front, e.back, '前后']);
  for (const [sa, sb] of pairs) {
    const fa = bySeat.get(sa.id), fb = bySeat.get(sb.id);
    if (fa === undefined || fb === undefined) continue;
    const a = ctx.byId.get(fa), b = ctx.byId.get(fb);
    if (!a.academic || !b.academic) continue;
    total++;
    if (a.academic === b.academic) {
      same++;
      violations.push(`${a.name} 与 ${b.name} 成绩同为「${a.academic}」`);
    }
  }
  return {
    score: total ? 1 - same / total : 1,
    violations: cap(violations),
    details: total ? `${same}/${total} 对相邻学生成绩相同` : '无相邻对',
  };
}

/** Behavior management: front-row share of naughty students + penalty for naughty clustering */
function behaviorManagement(ctx, bySeat, byStudent) {
  const naughty = ctx.naughty;
  if (!naughty.length) return { score: 1, violations: [], details: '无调皮学生' };

  const front = ctx.frontRow;
  let frontOk = 0;
  for (const s of naughty) {
    const seat = byStudent.get(s.id);
    if (seat === undefined) continue;
    if ((ctx.seatById.get(seat)?.row ?? 99) <= front) frontOk++;
  }

  // Naughty-naughty adjacency (deskmates or front-back)
  let adjacent = 0;
  const violations = [];
  const countAdj = (sa, sb) => {
    const fa = bySeat.get(sa.id), fb = bySeat.get(sb.id);
    if (fa === undefined || fb === undefined) return;
    const a = ctx.byId.get(fa), b = ctx.byId.get(fb);
    if (a.personality === '调皮' && b.personality === '调皮') {
      adjacent++;
      violations.push(`${a.name} 与 ${b.name} 两个调皮学生相邻`);
    }
  };
  for (const e of ctx.deskEdges) countAdj(e.a, e.b);
  for (const e of ctx.frontBackEdges) countAdj(e.front, e.back);

  const frontPart = frontOk / naughty.length;
  // If everyone pairs up, adjacent ≈ ceil(n/2); normalize that worst case to 0
  const adjacencyPart = clamp01(1 - adjacent / Math.max(1, Math.ceil(naughty.length / 2)));
  return {
    score: 0.5 * frontPart + 0.5 * adjacencyPart,
    violations: cap(violations),
    details: `调皮前排 ${frontOk}/${naughty.length}，相邻扎堆 ${adjacent} 对`,
  };
}

/** Gender balance: mixed-gender ratio on deskmate edges approaching 0.5 */
function genderBalance(ctx, bySeat) {
  let hetero = 0, total = 0;
  for (const e of ctx.deskEdges) {
    const fa = bySeat.get(e.a.id), fb = bySeat.get(e.b.id);
    if (fa === undefined || fb === undefined) continue;
    const a = ctx.byId.get(fa), b = ctx.byId.get(fb);
    total++;
    if (a.gender !== b.gender) hetero++;
  }
  const ratio = total ? hetero / total : 0.5;
  return {
    score: clamp01(1 - Math.abs(ratio - 0.5) * 2),
    violations: [],
    details: `同桌异性比例 ${Math.round(ratio * 100)}%（目标 50%）`,
  };
}

/** Ability pairing: share of deskmate edges with different talents (pairs with either side blank are skipped) */
function abilityPairing(ctx, bySeat) {
  let diff = 0, total = 0;
  const violations = [];
  for (const e of ctx.deskEdges) {
    const fa = bySeat.get(e.a.id), fb = bySeat.get(e.b.id);
    if (fa === undefined || fb === undefined) continue;
    const a = ctx.byId.get(fa), b = ctx.byId.get(fb);
    if (!a.ability || !b.ability) continue;
    total++;
    if (a.ability !== b.ability) diff++;
    else violations.push(`${a.name} 与 ${b.name} 特长同为「${a.ability}」`);
  }
  return {
    score: total ? diff / total : 1,
    violations: cap(violations),
    details: total ? `${diff}/${total} 对同桌特长互补` : '特长信息不足',
  };
}

/** Avoid same duty: deskmates' tags must not overlap */
function avoidSameTag(ctx, bySeat) {
  let conflict = 0, total = 0;
  const violations = [];
  for (const e of ctx.deskEdges) {
    const fa = bySeat.get(e.a.id), fb = bySeat.get(e.b.id);
    if (fa === undefined || fb === undefined) continue;
    const a = ctx.byId.get(fa), b = ctx.byId.get(fb);
    if (!a.tags.length || !b.tags.length) { total++; continue; }
    total++;
    if (a.tags.some(t => b.tags.includes(t))) {
      conflict++;
      violations.push(`${a.name} 与 ${b.name} 同任「${a.tags.find(t => b.tags.includes(t))}」`);
    }
  }
  return {
    score: total ? 1 - conflict / total : 1,
    violations: cap(violations),
    details: total ? `${conflict}/${total} 对同桌职务冲突` : '无同桌对',
  };
}

/** Personality balance: mean harmony-matrix score across deskmate edges */
function personalityBalance(ctx, bySeat) {
  let sum = 0, total = 0;
  const violations = [];
  for (const e of ctx.deskEdges) {
    const fa = bySeat.get(e.a.id), fb = bySeat.get(e.b.id);
    if (fa === undefined || fb === undefined) continue;
    const a = ctx.byId.get(fa), b = ctx.byId.get(fb);
    if (!a.personality || !b.personality) continue;
    const v = PERSONALITY_HARMONY[`${a.personality}|${b.personality}`] ?? 0.6;
    sum += v; total++;
    if (v <= 0.3) violations.push(`${a.name}（${a.personality}）与 ${b.name}（${b.personality}）搭配欠佳`);
  }
  return {
    score: total ? sum / total : 1,
    violations: cap(violations),
    details: total ? `同桌搭配和谐度 ${Math.round((sum / total) * 100)}%` : '无同桌对',
  };
}

/** Random shuffle: maximize the diff against the previous seating chart */
function randomShuffle(ctx, bySeat, byStudent) {
  if (!ctx.prevAssignment) {
    return { score: 0.8, violations: [], details: '首次排座，无历史可比' };
  }
  let overlap = 0, seated = 0;
  const violations = [];
  for (const s of ctx.students) {
    const seat = byStudent.get(s.id);
    if (seat === undefined) continue;
    seated++;
    if (ctx.prevAssignment[seat] === s.id) overlap++;
  }
  return {
    score: seated ? 1 - overlap / seated : 1,
    violations: cap(violations),
    details: seated ? `${overlap}/${seated} 名学生座位与上次相同` : '无学生入座',
  };
}

/** Front first: students sit as far forward as possible + empty seats cluster at the back */
function frontFirst(ctx, bySeat) {
  const seatedRows = [], emptyRows = [];
  for (const seat of ctx.seats) {
    const occ = bySeat.has(seat.id);
    (occ ? seatedRows : emptyRows).push(seat.row);
  }
  const rows = ctx.rows;
  let rowPart = 1, emptyPart = 1;
  if (seatedRows.length) {
    const avg = seatedRows.reduce((s, r) => s + r, 0) / seatedRows.length;
    rowPart = clamp01(1 - (avg - 1) / Math.max(1, rows - 1));
  }
  if (emptyRows.length) {
    const avg = emptyRows.reduce((s, r) => s + r, 0) / emptyRows.length;
    emptyPart = clamp01((avg - 1) / Math.max(1, rows - 1));
  }
  return {
    score: seatedRows.length && emptyRows.length ? 0.65 * rowPart + 0.35 * emptyPart : rowPart,
    violations: [],
    details: `平均就座第 ${seatedRows.length
      ? (seatedRows.reduce((s, r) => s + r, 0) / seatedRows.length).toFixed(1) : '-'} 排`
      + (emptyRows.length ? `，${emptyRows.length} 个空位平均在第 ${(emptyRows.reduce((s, r) => s + r, 0) / emptyRows.length).toFixed(1)} 排` : '，无空位'),
  };
}

export const SCORERS = {
  visionProtection,
  heightOptimized,
  academicBalance,
  behaviorManagement,
  genderBalance,
  abilityPairing,
  avoidSameTag,
  personalityBalance,
  randomShuffle,
  frontFirst,
};
