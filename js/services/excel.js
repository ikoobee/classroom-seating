/**
 * Excel import/export: Chinese/English header detection + column mapping preview + two-sheet export + two-sheet template download
 * All 9 fields are mapped on import
 */
import { loadXlsx } from './vendor.js';
import { normalizeStudentInput } from '@ikoobee/seating-core';
import { activeSeats } from '@ikoobee/seating-core';
import {
  GENDERS, HEIGHTS, VISIONS, ACADEMICS, PERSONALITIES, ABILITIES, DUTIES, ANNOTATION_COLORS,
} from '@ikoobee/seating-core';

/** field -> Chinese/English header aliases */
const COLUMN_ALIASES = {
  name: ['姓名', '名字', '学生姓名', 'name'],
  gender: ['性别', 'gender', 'sex'],
  height: ['身高', '身高等级', 'height'],
  vision: ['视力', '视力情况', '视力状况', 'vision'],
  academic: ['成绩', '学习成绩', '成绩等级', 'academic'],
  personality: ['性格', '性格特点', 'personality'],
  ability: ['特长', '特长能力', '能力', 'ability'],
  tags: ['职务', '职务标注', '班级职务', '担任职务', 'tags', 'tag'],
  annotationColor: ['标注', '标注颜色', '颜色', 'color'],
};

export const FIELD_LABELS = {
  name: '姓名', gender: '性别', height: '身高', vision: '视力',
  academic: '成绩', personality: '性格', ability: '特长',
  tags: '职务', annotationColor: '标注颜色',
};

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

/**
 * Parse an Excel/CSV file → { headers, rows (2D array), suggested (field -> column index) }
 */
export async function parseTableFile(file) {
  const XLSX = await loadXlsx();
  const buf = await readAsArrayBuffer(file);
  const wb = XLSX.read(buf, { type: 'array', codepage: 936 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

  if (!matrix.length) throw new Error('文件内容为空');

  // Find the header row within the first 5 rows: the one containing 姓名 or name
  let headerRow = -1;
  for (let i = 0; i < Math.min(5, matrix.length); i++) {
    const cells = (matrix[i] || []).map(c => String(c).trim().toLowerCase());
    if (cells.some(c => ['姓名', '名字', 'name', '学生姓名'].includes(c))) { headerRow = i; break; }
  }
  if (headerRow < 0) throw new Error('未找到表头行（需包含「姓名」列）');

  const headers = (matrix[headerRow] || []).map(c => String(c).trim());
  const rows = matrix.slice(headerRow + 1)
    .map(r => headers.map((_, i) => String(r[i] ?? '').trim()))
    .filter(r => r.some(c => c !== ''));

  // Suggested field-to-column mapping
  const suggested = {};
  headers.forEach((h, i) => {
    const hl = h.toLowerCase();
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (suggested[field] === undefined && aliases.includes(hl)) suggested[field] = i;
    }
  });
  if (suggested.name === undefined) throw new Error('未识别到「姓名」列，请在映射中手动指定');

  return { headers, rows, suggested };
}

/** Convert rows into student input objects using the mapping */
export function rowsToStudentInputs(rows, mapping) {
  const out = [];
  for (const row of rows) {
    const get = f => mapping[f] !== undefined && mapping[f] >= 0 ? (row[mapping[f]] ?? '') : '';
    if (!String(get('name')).trim()) continue;
    out.push({
      name: get('name'),
      gender: get('gender'),
      height: get('height'),
      vision: get('vision'),
      academic: get('academic'),
      personality: get('personality'),
      ability: get('ability'),
      tags: get('tags') ? String(get('tags')).split(/[,，、;；\s]+/).filter(Boolean) : [],
      annotationColor: get('annotationColor'),
    });
  }
  return out.map(normalizeStudentInput);
}

/** Export two sheets: student info + seating arrangement */
export async function exportExcel(state) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();

  // Sheet 1: student info
  const annoLabel = Object.fromEntries(ANNOTATION_COLORS.map(c => [c.value, c.label]));
  const stuRows = state.students.list.map(s => ({
    '姓名': s.name, '性别': s.gender, '身高': s.height, '视力': s.vision,
    '成绩': s.academic, '性格': s.personality, '特长': s.ability,
    '职务': s.tags.join('、'), '标注颜色': annoLabel[s.annotationColor] ?? '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stuRows), '学生信息');

  // Sheet 2: seating arrangement (matrix: seat columns + aisle gap columns)
  const seats = activeSeats(state.layout);
  const seatMap = new Map(seats.map(s => [s.id, s]));
  const byId = new Map(state.students.list.map(s => [s.id, s]));
  const header = ['（讲台在前）'];
  for (let c = 1; c <= state.layout.seatCols; c++) {
    header.push(`第${c}列`);
    if (state.layout.aisles.includes(c)) header.push('（过道）');
  }
  const arr = [header];
  for (let r = 1; r <= state.layout.rows; r++) {
    const row = [`第${r}排`];
    for (let c = 1; c <= state.layout.seatCols; c++) {
      const seat = seatMap.get(`${r}-${c}`);
      const sid = seat ? state.assignment[seat.id] : undefined;
      row.push(sid !== undefined ? (byId.get(sid)?.name ?? '') : '');
      if (state.layout.aisles.includes(c)) row.push('');
    }
    arr.push(row);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(arr), '座位安排');

  XLSX.writeFile(wb, `排座数据_${dateStr()}.xlsx`);
}

/**
 * Download the import template — two sheets:
 *   1. 导入模板: header + demo rows only (ready to fill in)
 *   2. 字段说明: field notes generated from the same constants the app
 *      validates against, so the notes can never drift from the real rules
 */
export async function downloadTemplate() {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();

  const demo = [
    ['姓名', '性别', '身高', '视力', '成绩', '性格', '特长', '职务', '标注颜色'],
    ['张三', '男', '矮', '近视', '优秀', '活跃', '体育', '体育委员', '重点关注'],
    ['李四', '女', '中', '正常', '良好', '安静', '舞蹈', '', ''],
    ['王五', '男', '高', '良好', '待提高', '调皮', '信息技术', '', '需要注意'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(demo), '导入模板');

  const notes = [
    ['字段', '可选值', '必填', '说明'],
    ['姓名', '—', '是', '学生姓名，唯一必填字段'],
    ['性别', GENDERS.join(' / '), '否', '留空默认「男」；也接受 m/f'],
    ['身高', HEIGHTS.join(' / '), '否', '留空默认「中」；用于身高优化'],
    ['视力', VISIONS.join(' / '), '否', '留空默认「正常」；近视优先安排前排'],
    ['成绩', ACADEMICS.join(' / '), '否', '留空默认「中等」；用于成绩分层'],
    ['性格', PERSONALITIES.join(' / '), '否', '留空默认「安静」；用于性格平衡'],
    ['特长', ABILITIES.join(' / '), '否', '单选，留空表示暂无；用于能力互补'],
    ['职务', DUTIES.join(' / '), '否', '可多个，用顿号分隔；用于避免同职务相邻'],
    ['标注颜色', ANNOTATION_COLORS.map(c => c.label).join(' / '), '否', '学生关注类型标注，留空表示无'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notes), '字段说明');

  XLSX.writeFile(wb, '学生导入模板.xlsx');
}

function dateStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
