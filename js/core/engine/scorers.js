/**
 * 10 条软规则 → 10 个评分维度
 * 统一签名：(ctx, bySeat, byStudent) => { score: 0..1, violations: [], details: string }
 * 1 为最优；总分 = 各维度按权重加权平均 × 100
 */
import { HEIGHT_ORDER, PERSONALITY_HARMONY } from '../constants.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const cap = (arr, n = 30) => arr.length > n ? arr.slice(0, n) : arr;

/** 视力保护：近视学生坐在前排区的比例 */
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

/** 身高优化：前后边「高在前矮在后」逆序对比例 */
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

/** 成绩分层：同桌 + 前后边「成绩相同」对越少越好 */
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

/** 行为管理：调皮学生前排比例 + 调皮扎堆惩罚 */
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

  // 调皮-调皮邻接（同桌或前后）
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
  // 全部配对扎堆时 adjacent ≈ ceil(n/2)，归一化到 0
  const adjacencyPart = clamp01(1 - adjacent / Math.max(1, Math.ceil(naughty.length / 2)));
  return {
    score: 0.5 * frontPart + 0.5 * adjacencyPart,
    violations: cap(violations),
    details: `调皮前排 ${frontOk}/${naughty.length}，相邻扎堆 ${adjacent} 对`,
  };
}

/** 性别平衡：同桌边异性比例趋近 0.5 */
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

/** 能力互补：同桌边特长不同的比例（双方未填不计入） */
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

/** 避免同职务：同桌 tags 无交集 */
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

/** 性格平衡：互补矩阵在同桌边上的均值得分 */
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

/** 随机打散：与上一次座位表差异最大化 */
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

/** 前排优先：学生平均行靠前 + 空座位集中后排 */
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
