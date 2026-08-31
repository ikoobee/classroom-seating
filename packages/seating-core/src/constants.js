/**
 * Enum dictionaries and rule definitions (pure data, no dependencies)
 */

export const GENDERS = ['男', '女'];
export const HEIGHTS = ['高', '中', '矮'];
export const VISIONS = ['近视', '正常', '良好'];
export const ACADEMICS = ['优秀', '良好', '中等', '待提高'];
export const PERSONALITIES = ['活跃', '安静', '调皮', '文静', '领导', '助人'];
/**
 * Student abilities: concrete, non-overlapping talents only.
 * Academic level lives in the grade field; helper traits in personality.
 */
export const ABILITIES = [
  '体育', '组织', '音乐', '美术', '书法', '演讲', '朗诵', '舞蹈', '棋类',
  '英语口语', '科学实验', '信息技术', '劳动实践',
];

/**
 * Dimension value → shared color mapping (used by both dashboard charts and
 * heatmaps so every dimension value keeps a consistent color)
 */
export const DIMENSION_COLORS = {
  gender: { '男': 'var(--male)', '女': 'var(--female)' },
  height: { '矮': '#22c55e', '中': '#eab308', '高': '#ef4444' },
  vision: { '近视': '#ef4444', '正常': '#eab308', '良好': '#22c55e' },
  academic: { '优秀': '#16a34a', '良好': '#2563eb', '中等': '#d97706', '待提高': '#dc2626' },
  // Personality colors come from PALETTE in fixed order, shared by charts and heatmaps
  personality: {}, // callers index PALETTE by PERSONALITIES order
  annotation: { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', purple: '#a855f7' },
};

/** Class duty list */
export const DUTIES = [
  '班长', '副班长', '学习委员', '纪律委员', '体育委员', '文艺委员',
  '劳动委员', '宣传委员', '组织委员', '生活委员', '课代表', '组长',
  '图书管理员', '电教管理员', '心理委员', '安全员',
];

/** Annotation color semantics */
export const ANNOTATION_COLORS = [
  { value: 'red',    label: '重点关注', hex: 'var(--anno-red)' },
  { value: 'orange', label: '需要注意', hex: 'var(--anno-orange)' },
  { value: 'yellow', label: '一般关注', hex: 'var(--anno-yellow)' },
  { value: 'green',  label: '表现良好', hex: 'var(--anno-green)' },
  { value: 'purple', label: '特殊情况', hex: 'var(--anno-purple)' },
];

/** Height as ordered numeric value */
export const HEIGHT_ORDER = { '矮': 0, '中': 1, '高': 2 };

/** Academic level as ordered numeric value */
export const ACADEMIC_ORDER = { '待提高': 0, '中等': 1, '良好': 2, '优秀': 3 };

/** Personality compatibility matrix (deskmate harmony 0..1, symmetric) */
export const PERSONALITY_HARMONY = (() => {
  const M = {};
  const pair = (a, b, v) => { M[`${a}|${b}`] = v; M[`${b}|${a}`] = v; };
  pair('调皮', '调皮', 0.1);
  pair('调皮', '活跃', 0.25);
  pair('调皮', '文静', 0.7);
  pair('调皮', '安静', 0.95);
  pair('调皮', '领导', 1.0);
  pair('调皮', '助人', 0.9);
  pair('活跃', '活跃', 0.45);
  pair('活跃', '文静', 0.75);
  pair('活跃', '安静', 0.95);
  pair('活跃', '领导', 0.7);
  pair('活跃', '助人', 0.8);
  pair('安静', '安静', 0.45);
  pair('安静', '文静', 0.55);
  pair('安静', '领导', 0.85);
  pair('安静', '助人', 0.85);
  pair('文静', '文静', 0.4);
  pair('文静', '领导', 0.9);
  pair('文静', '助人', 0.85);
  pair('领导', '领导', 0.5);
  pair('领导', '助人', 0.85);
  pair('助人', '助人', 0.6);
  return M;
})();

/** The 10 arrangement rule definitions */
export const RULES = [
  { id: 'visionProtection',   name: '视力保护', desc: '近视学生优先安排在前排区，比例由「前排区比例」控制', defaultWeight: 70 },
  { id: 'heightOptimized',    name: '身高优化', desc: '矮个在前高个在后，消除前后遮挡', defaultWeight: 60 },
  { id: 'behaviorManagement', name: '行为管理', desc: '调皮学生靠前便于监督，且避免调皮学生前后左右扎堆', defaultWeight: 40 },
  { id: 'academicBalance',    name: '成绩分层', desc: '同桌与前后座位成绩互补，避免同水平学生扎堆', defaultWeight: 40 },
  { id: 'genderBalance',      name: '性别平衡', desc: '同桌男女比例整体趋于均衡', defaultWeight: 30 },
  { id: 'abilityPairing',     name: '能力互补', desc: '不同特长的学生同桌，形成互补搭配', defaultWeight: 30 },
  { id: 'avoidSameTag',       name: '避免同职务', desc: '班干部等同一职务的学生不同桌', defaultWeight: 35 },
  { id: 'personalityBalance', name: '性格平衡', desc: '活跃与安静互补、调皮与领导型搭配', defaultWeight: 40 },
  { id: 'randomShuffle',      name: '随机打散', desc: '与上一次座位表的差异最大化，保证公平轮换', defaultWeight: 20 },
  { id: 'frontFirst',         name: '前排优先', desc: '学生尽量靠前就座，空座位集中到后排', defaultWeight: 30 },
];

export const RULE_BY_ID = Object.fromEntries(RULES.map(r => [r.id, r]));

export function defaultRules() {
  const weights = {};
  for (const r of RULES) weights[r.id] = r.defaultWeight;
  return {
    weights,
    order: RULES.map(r => r.id),
    frontRowRatio: 0.3,
    seedBase: 1,
  };
}

/**
 * Classroom templates. seatCols is the number of seat columns (aisles occupy no
 * column); aisles holds aisle positions (after column N). The default grouping
 * is "one group per 2 columns": two deskmates per group with an aisle between
 * groups (e.g. 8 seats → 2+2+2+2).
 */
export const TEMPLATES = [
  { id: 'standard', name: '标准教室（7排×8座 · 每2列一组）', rows: 7, seatCols: 8,  aisles: [2, 4, 6] },
  { id: 'small',    name: '小班教室（5排×6座 · 每2列一组）', rows: 5, seatCols: 6,  aisles: [2, 4] },
  { id: 'large',    name: '大班教室（9排×10座 · 每2列一组）', rows: 9, seatCols: 10, aisles: [2, 4, 6, 8] },
];
