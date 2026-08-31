/**
 * 学生数据模型：创建 / 校验 / 导入归一化
 */
import {
  GENDERS, HEIGHTS, VISIONS, ACADEMICS, PERSONALITIES, ABILITIES, DUTIES,
} from './constants.js';

const ANNO_VALUES = ['red', 'orange', 'yellow', 'green', 'purple'];

export function createStudent(data = {}) {
  return {
    id: data.id ?? 0,
    name: (data.name || '').trim() || '未命名',
    gender: GENDERS.includes(data.gender) ? data.gender : '男',
    height: HEIGHTS.includes(data.height) ? data.height : '中',
    vision: VISIONS.includes(data.vision) ? data.vision : '正常',
    academic: ACADEMICS.includes(data.academic) ? data.academic : '中等',
    personality: PERSONALITIES.includes(data.personality) ? data.personality : '安静',
    ability: ABILITIES.includes(data.ability) ? data.ability : '',
    tags: Array.isArray(data.tags) ? data.tags.filter(t => DUTIES.includes(t)) : [],
    annotationColor: ANNO_VALUES.includes(data.annotationColor) ? data.annotationColor : null,
    zone: null, // 预留：指定区域硬约束 { rows: [min, max] }
  };
}

export function validateStudent(s) {
  const errors = [];
  if (!s.name || !s.name.trim()) errors.push('姓名不能为空');
  if (s.name && s.name.length > 12) errors.push('姓名过长');
  return errors;
}

function pick(list, value) {
  if (value == null) return '';
  const v = String(value).trim();
  return list.find(x => x === v) || '';
}

/** 导入归一化：任意来源（Excel/CSV/JSON）→ 合法学生对象 */
export function normalizeStudentInput(input = {}) {
  const gender = String(input.gender ?? '').trim();
  const height = String(input.height ?? '').trim();
  const vision = String(input.vision ?? '').trim();
  const anno = String(input.annotationColor ?? '').trim();

  return createStudent({
    id: Number.isInteger(input.id) ? input.id : undefined,
    name: input.name,
    gender: GENDERS.includes(gender) ? gender : (gender.startsWith('男') || /^m$/i.test(gender) ? '男' : gender.startsWith('女') || /^f$/i.test(gender) ? '女' : '男'),
    height: pick(HEIGHTS, height) || (height.includes('矮') ? '矮' : height.includes('高') ? '高' : '中'),
    vision: pick(VISIONS, vision) || (vision.includes('近') ? '近视' : vision.includes('良好') ? '良好' : '正常'),
    academic: pick(ACADEMICS, String(input.academic ?? '').trim()) || '中等',
    personality: pick(PERSONALITIES, String(input.personality ?? '').trim()),
    ability: pick(ABILITIES, String(input.ability ?? '').trim()),
    tags: Array.isArray(input.tags)
      ? input.tags
      : (input.tag && String(input.tag).trim() && input.tag !== '无' ? [String(input.tag).trim()] : []),
    annotationColor: ANNO_VALUES.includes(anno) ? anno
      : ({ '红色': 'red', '红': 'red', '重点关注': 'red', '橙色': 'orange', '需要注意': 'orange',
           '黄色': 'yellow', '一般关注': 'yellow', '绿色': 'green', '表现良好': 'green',
           '紫色': 'purple', '特殊情况': 'purple' }[anno] || null),
  });
}
