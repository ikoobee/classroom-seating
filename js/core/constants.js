/**
 * 枚举字典与规则定义（纯数据，无依赖）
 */

export const GENDERS = ['男', '女'];
export const HEIGHTS = ['高', '中', '矮'];
export const VISIONS = ['近视', '正常', '良好'];
export const ACADEMICS = ['优秀', '良好', '中等', '待提高'];
export const PERSONALITIES = ['活跃', '安静', '调皮', '文静', '领导', '助人'];
export const ABILITIES = [
  // 基础（兼容既有数据）
  '学习', '体育', '艺术', '组织', '帮助', '需要',
  // 扩展特长
  '音乐', '美术', '书法', '演讲', '朗诵', '舞蹈', '棋类',
  '英语口语', '科学实验', '信息技术', '劳动实践',
];

/**
 * 维度取值 → 统一配色（仪表盘图表与热力图共用，保证同一维度同一颜色）
 */
export const DIMENSION_COLORS = {
  gender: { '男': 'var(--male)', '女': 'var(--female)' },
  height: { '矮': '#22c55e', '中': '#eab308', '高': '#ef4444' },
  vision: { '近视': '#ef4444', '正常': '#eab308', '良好': '#22c55e' },
  academic: { '优秀': '#16a34a', '良好': '#2563eb', '中等': '#d97706', '待提高': '#dc2626' },
  // 性格使用 PALETTE 固定顺序，图表与热力图一致
  personality: {}, // 由调用方按 PERSONALITIES 索引取 PALETTE
  annotation: { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', purple: '#a855f7' },
};

/** 职务列表 */
export const DUTIES = [
  '班长', '副班长', '学习委员', '纪律委员', '体育委员', '文艺委员',
  '劳动委员', '宣传委员', '组织委员', '生活委员', '课代表', '组长',
  '图书管理员', '电教管理员', '心理委员', '安全员',
];

/** 标注色语义 */
export const ANNOTATION_COLORS = [
  { value: 'red',    label: '重点关注', hex: 'var(--anno-red)' },
  { value: 'orange', label: '需要注意', hex: 'var(--anno-orange)' },
  { value: 'yellow', label: '一般关注', hex: 'var(--anno-yellow)' },
  { value: 'green',  label: '表现良好', hex: 'var(--anno-green)' },
  { value: 'purple', label: '特殊情况', hex: 'var(--anno-purple)' },
];

/** 身高数值化（有序） */
export const HEIGHT_ORDER = { '矮': 0, '中': 1, '高': 2 };

/** 成绩数值化（有序） */
export const ACADEMIC_ORDER = { '待提高': 0, '中等': 1, '良好': 2, '优秀': 3 };

/** 性格互补矩阵（同桌和谐度 0~1，对称） */
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

/** 10 条排座规则定义 */
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
 * 教室模板。seatCols 为座位列数（过道不占列），aisles 为过道位置（第 N 列之后）。
 * 默认「每 2 列一组」：同桌两人一组，组间过道（如 8 座 → 2+2+2+2）。
 */
export const TEMPLATES = [
  { id: 'standard', name: '标准教室（7排×8座 · 每2列一组）', rows: 7, seatCols: 8,  aisles: [2, 4, 6] },
  { id: 'small',    name: '小班教室（5排×6座 · 每2列一组）', rows: 5, seatCols: 6,  aisles: [2, 4] },
  { id: 'large',    name: '大班教室（9排×10座 · 每2列一组）', rows: 9, seatCols: 10, aisles: [2, 4, 6, 8] },
];
