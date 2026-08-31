/**
 * Core engine unit tests: grid geometry / scorer directionality /
 * construction & optimization / hard constraints / rotation / state & undo
 */
import { describe, test, assert, assertEquals, renderResults } from './framework.js';
import { seatId, parseSeatId, activeSeats, deskEdges, frontBackEdges, frontRowCount, normalizeLayout } from '@ikoobee/seating-core';
import { createStudent } from '@ikoobee/seating-core';
import { defaultRules } from '@ikoobee/seating-core';
import { generateDemoStudents } from '@ikoobee/seating-core';
import { buildContext, isDeskPair } from '@ikoobee/seating-core';
import { evaluate } from '@ikoobee/seating-core';
import { generateSolution } from '@ikoobee/seating-core';
import { precheck } from '@ikoobee/seating-core';
import { applyRotation, buildRotationMap } from '@ikoobee/seating-core';
import { rowsToStudentInputs } from '../js/services/excel.js';
import { createStore } from '../js/store/store.js';
import { reducer, initialState } from '../js/store/reducers.js';
import { createHistory, swapCmd, toggleLockCmd } from '../js/store/history.js';

/* ---------- helpers ---------- */

const S = (i, over = {}) => createStudent({ id: i, name: `学生${i}`, ...over });

function makeCfg(students, layout, extra = {}) {
  return {
    students,
    layout: normalizeLayout(layout),
    locks: extra.locks ?? new Set(),
    assignment: extra.assignment ?? {},
    relations: extra.relations ?? { friends: [], blacklist: [] },
    rules: { ...defaultRules(), ...(extra.rules ?? {}) },
    prevAssignment: extra.prevAssignment ?? null,
  };
}


/* ---------- grid geometry ---------- */

describe('网格几何 grid');

test('seatId / parseSeatId 往返', () => {
  assertEquals(parseSeatId('12-34').row, 12);
  assertEquals(parseSeatId('12-34').col, 34);
  assertEquals(seatId(12, 34), '12-34');
});

test('activeSeats：过道不占座位列，每列都有座位', () => {
  const layout = normalizeLayout({ rows: 2, seatCols: 4, aisles: [2] });
  const seats = activeSeats(layout);
  assertEquals(seats.length, 8, '2 排 × 4 座位列 = 8 个座位');
  // each row's columns fully cover 1..seatCols
  for (let r = 1; r <= 2; r++) {
    const cols = seats.filter(s => s.row === r).map(s => s.col).sort((a, b) => a - b);
    assertEquals(cols.join(','), '1,2,3,4');
  }
});

test('normalizeLayout 兼容旧 schema（cols 含过道）', () => {
  const layout = normalizeLayout({ rows: 7, cols: 9, aisles: [5] });
  assertEquals(layout.seatCols, 8, '9 网格列 - 1 过道 = 8 座位列');
  assertEquals(layout.aisles.join(','), '4', '网格第 5 列过道 → 第 4 座位列之后');
  const large = normalizeLayout({ rows: 9, cols: 12, aisles: [4, 9] });
  assertEquals(large.seatCols, 10);
  assertEquals(large.aisles.join(','), '3,7');
});

test('同桌边不跨过道', () => {
  const layout = normalizeLayout({ rows: 1, seatCols: 4, aisles: [2] });
  const edges = deskEdges(activeSeats(layout), layout.aisles);
  // aisle after column 2: only (1,2) and (3,4) pair up
  assertEquals(edges.length, 2);
  const pairs = edges.map(e => `${e.a.col}-${e.b.col}`).sort().join(',');
  assertEquals(pairs, '1-2,3-4');
  for (const e of edges) assert(Math.abs(e.a.col - e.b.col) === 1, '同桌必须相邻列');
});

test('前后边同列相邻行', () => {
  const layout = normalizeLayout({ rows: 3, cols: 2 });
  const edges = frontBackEdges(activeSeats(layout));
  assertEquals(edges.length, 4); // 2 columns × 2 edges
  for (const e of edges) {
    assertEquals(e.front.col, e.back.col);
    assertEquals(e.back.row - e.front.row, 1);
  }
});

test('frontRowCount 按比例计算且至少 1', () => {
  assertEquals(frontRowCount({ rows: 7 }, 0.3), 2);
  assertEquals(frontRowCount({ rows: 7 }, 0.05), 1);
  assertEquals(frontRowCount({ rows: 10 }, 0.5), 5);
});

/* ---------- demo data ---------- */

describe('演示数据 datagen');

test('生成 56 名学生：姓名唯一、字段合法', () => {
  const { students } = generateDemoStudents(56, 42);
  assertEquals(students.length, 56);
  const names = new Set(students.map(s => s.name));
  assertEquals(names.size, 56, '姓名应唯一');
  for (const s of students) {
    assert(['男', '女'].includes(s.gender), '性别合法');
    assert(['高', '中', '矮'].includes(s.height), '身高合法');
    assert(Array.isArray(s.tags), 'tags 为数组');
  }
});

test('同一种子结果可复现', () => {
  const a = generateDemoStudents(20, 7);
  const b = generateDemoStudents(20, 7);
  assertEquals(JSON.stringify(a), JSON.stringify(b), '同 seed 应产生相同数据');
});

/* ---------- scorer directionality ---------- */

describe('评分器 scorers');

test('视力保护：近视学生全在前排 → 满分', () => {
  const students = [
    S(1, { vision: '近视' }), S(2, { vision: '近视' }),
    S(3), S(4), S(5), S(6), S(7), S(8),
  ];
  const layout = { rows: 4, cols: 2 }; // frontRow = round(4*0.3)=1
  const ctx = buildContext(makeCfg(students, layout));
  const bySeat = new Map(), byStudent = new Map();
  // seat near-sighted students 1 and 2 in row 1
  bySeat.set('1-1', 1); bySeat.set('1-2', 2);
  byStudent.set(1, '1-1'); byStudent.set(2, '1-2');
  const score = evaluate(ctx, bySeat, byStudent);
  const vision = score.dimensions.find(d => d.id === 'visionProtection');
  assertEquals(vision.score, 100);
});

test('视力保护：近视学生全在最后一排 → 0 分', () => {
  const students = [S(1, { vision: '近视' }), S(2)];
  const ctx = buildContext(makeCfg(students, { rows: 4, cols: 2 }));
  const bySeat = new Map([['4-1', 1]]);
  const byStudent = new Map([[1, '4-1']]);
  const score = evaluate(ctx, bySeat, byStudent);
  assertEquals(score.dimensions.find(d => d.id === 'visionProtection').score, 0);
});

test('身高优化：前排高后排矮 → 遮挡 0 分；前排矮后排高 → 100 分', () => {
  const tall = S(1, { height: '高' }), short = S(2, { height: '矮' });
  const cfg = makeCfg([tall, short], { rows: 3, cols: 1, aisles: [] }, {
    rules: { weights: { ...defaultRules().weights, heightOptimized: 100, visionProtection: 0, behaviorManagement: 0, frontFirst: 0 } },
  });
  const ctx = buildContext(cfg);
  const mk = (a, b) => {
    const bySeat = new Map([['1-1', a.id], ['2-1', b.id]]);
    const byStudent = new Map([[a.id, '1-1'], [b.id, '2-1']]);
    return evaluate(ctx, bySeat, byStudent).dimensions.find(d => d.id === 'heightOptimized').score;
  };
  assertEquals(mk(tall, short), 0, '高前矮后应得 0 分');
  assertEquals(mk(short, tall), 100, '矮前高后应得 100 分');
});

test('frontRowRatio 真正生效：比例变化改变前排区', () => {
  const ctx1 = buildContext(makeCfg([], { rows: 10, cols: 2 }, { rules: { frontRowRatio: 0.2 } }));
  const ctx2 = buildContext(makeCfg([], { rows: 10, cols: 2 }, { rules: { frontRowRatio: 0.6 } }));
  assertEquals(ctx1.frontRow, 2);
  assertEquals(ctx2.frontRow, 6);
});

/* ---------- construction + optimization (end-to-end directionality) ---------- */

describe('排座引擎 engine');

test('只开视力保护：优化后近视学生全部进入前排区', () => {
  const students = [];
  for (let i = 1; i <= 12; i++) students.push(S(i, { vision: i <= 5 ? '近视' : '良好' }));
  const weights = { ...defaultRules().weights };
  for (const k of Object.keys(weights)) weights[k] = 0;
  weights.visionProtection = 100;

  // front-row ratio 0.5 -> 3 front rows with 6 seats >= 5 near-sighted students
  const result = generateSolution(
    makeCfg(students, { rows: 6, cols: 2 }, { rules: { weights, frontRowRatio: 0.5 } }),
    123, { maxIter: 6000, timeMs: 400 });
  assert(result.ok, '应成功出解');
  assertEquals(result.score.hardViolations.length, 0);
  const front = frontRowCount({ rows: 6 }, 0.5); // = 3
  const byStudent = new Map(Object.entries(result.assignment).map(([seat, sid]) => [sid, seat]));
  for (const s of students.filter(s => s.vision === '近视')) {
    const seat = byStudent.get(s.id);
    assert(seat, `${s.name} 应有座位`);
    const { row } = parseSeatId(seat);
    assert(row <= front, `近视学生 ${s.name} 应在前 ${front} 排，实际第 ${row} 排`);
  }
});

test('好友对：排座后必须同桌（硬约束）', () => {
  const students = [];
  for (let i = 1; i <= 10; i++) students.push(S(i));
  const relations = { friends: [{ a: 1, b: 2 }], blacklist: [] };
  const result = generateSolution(
    makeCfg(students, { rows: 5, cols: 2 }, { relations }),
    7, { maxIter: 5000, timeMs: 400 });
  assert(result.ok);
  assertEquals(result.score.hardViolations.length, 0, '好友硬约束应满足');
  const byStudent = new Map(Object.entries(result.assignment).map(([seat, sid]) => [sid, seat]));
  const ctx = buildContext(makeCfg(students, { rows: 5, cols: 2 }, { relations }));
  assert(isDeskPair(ctx, byStudent.get(1), byStudent.get(2)), '学生1与学生2应同桌');
});

test('一人多条同桌约束：给出明确警告且全部学生仍入座', () => {
  const students = [];
  for (let i = 1; i <= 10; i++) students.push(S(i));
  // student 1 is desk-constrained to both 2 and 3 (geometrically impossible to satisfy both)
  const relations = { friends: [{ a: 1, b: 2 }, { a: 1, b: 3 }], blacklist: [] };
  const result = generateSolution(
    makeCfg(students, { rows: 5, cols: 2 }, { relations }),
    11, { maxIter: 5000, timeMs: 400 });
  assert(result.ok, '应仍能出解');
  const seated = new Set(Object.values(result.assignment));
  assertEquals(students.filter(s => !seated.has(s.id)).length, 0, '不应漏排');
  assert(result.warnings.some(w => w.includes('同桌')), '应包含同桌冲突警告: ' + result.warnings.join(';'));
  // at least one holds: 1 with 2, or 1 with 3
  const byStudent = new Map(Object.entries(result.assignment).map(([seat, sid]) => [sid, seat]));
  const ctx = buildContext(makeCfg(students, { rows: 5, cols: 2 }, { relations }));
  assert(isDeskPair(ctx, byStudent.get(1), byStudent.get(2))
    || isDeskPair(ctx, byStudent.get(1), byStudent.get(3)), '至少一对同桌约束应被满足');
});

test('黑名单：排座后不得同桌/前后相邻', () => {
  const students = [];
  for (let i = 1; i <= 10; i++) students.push(S(i));
  const relations = { friends: [], blacklist: [{ a: 1, b: 2, noFrontBack: true }] };
  const result = generateSolution(
    makeCfg(students, { rows: 5, cols: 2 }, { relations }),
    99, { maxIter: 5000, timeMs: 400 });
  assert(result.ok);
  const byStudent = new Map(Object.entries(result.assignment).map(([seat, sid]) => [sid, seat]));
  const p1 = parseSeatId(byStudent.get(1)), p2 = parseSeatId(byStudent.get(2));
  const desk = p1.row === p2.row && Math.abs(p1.col - p2.col) === 1;
  const fb = p1.col === p2.col && Math.abs(p1.row - p2.row) === 1;
  assert(!desk && !fb, `黑名单学生对不应相邻：${JSON.stringify(p1)} vs ${JSON.stringify(p2)}`);
});

test('锁定座位：排座后保持不动', () => {
  const students = [];
  for (let i = 1; i <= 10; i++) students.push(S(i));
  const result = generateSolution(
    makeCfg(students, { rows: 5, cols: 2 }, {
      locks: new Set(['1-1']),
      assignment: { '1-1': 9 },
    }),
    5, { maxIter: 5000, timeMs: 400 });
  assert(result.ok);
  assertEquals(result.assignment['1-1'], 9, '锁定座位上的学生不应被移动');
});

test('学生多于座位：返回 fatal', () => {
  const students = [];
  for (let i = 1; i <= 20; i++) students.push(S(i));
  const result = generateSolution(makeCfg(students, { rows: 2, cols: 2 }), 1);
  assert(!result.ok, '应报 fatal');
  assert(result.fatal.length >= 1, '应有 fatal 信息');
});

/* ---------- zone precheck ---------- */

test('zone 预检：区域容量不足返回 fatal', () => {
  // Row 1 has only 2 seats but 3 students must sit there
  const students = [S(1, { zone: { rows: [1, 1] } }), S(2, { zone: { rows: [1, 1] } }), S(3, { zone: { rows: [1, 1] } })];
  const ctx = buildContext(makeCfg(students, { rows: 4, cols: 2 }));
  const pre = precheck(ctx);
  assert(pre.fatal.length === 1, `应有 1 条 fatal，实际 ${pre.fatal.length}`);
  assert(pre.fatal[0].includes('区域'), 'fatal 应说明区域容量问题');
});

test('zone 预检：区间越界教室排数时警告并收敛', () => {
  const students = [S(1, { zone: { rows: [2, 9] } })]; // classroom has 4 rows
  const ctx = buildContext(makeCfg(students, { rows: 4, cols: 2 }));
  const pre = precheck(ctx);
  assertEquals(pre.fatal.length, 0, '越界但容量足够，不应 fatal');
  assert(pre.warnings.some(w => w.includes('超出教室范围')), '应有越界警告');
});

test('zone 预检：锁定座位与区域冲突时警告', () => {
  const students = [S(1, { zone: { rows: [1, 1] } }), S(2)];
  const ctx = buildContext(makeCfg(students, { rows: 4, cols: 2 }, { locks: new Set(['4-1']), assignment: { '4-1': 1 } }));
  const pre = precheck(ctx);
  assert(pre.warnings.some(w => w.includes('冲突')), '应有锁定与区域冲突的警告');
});

test('zone 引擎：满足区域约束的排座零硬违规', () => {
  const students = [
    S(1, { zone: { rows: [1, 1] } }), S(2, { zone: { rows: [1, 1] } }),
    S(3, { zone: { rows: [3, 4] } }), S(4, { zone: { rows: [3, 4] } }),
    S(5), S(6),
  ];
  const weights = { ...defaultRules().weights };
  for (const k of Object.keys(weights)) weights[k] = 0;
  const result = generateSolution(
    makeCfg(students, { rows: 4, cols: 2 }, { rules: { weights, frontRowRatio: 0 } }),
    7, { maxIter: 4000, timeMs: 300 });
  assert(result.ok, '应成功出解');
  assertEquals(result.score.hardViolations.filter(v => v.type === 'zone').length, 0, '不应有 zone 违规');
  const rowOf = sid => {
    const seat = Object.entries(result.assignment).find(([, s]) => s === sid)[0];
    return Number(seat.split('-')[0]);
  };
  assertEquals(rowOf(1), 1, '学生1 应在第 1 排');
  assertEquals(rowOf(2), 1, '学生2 应在第 1 排');
  assert(rowOf(3) >= 3 && rowOf(4) >= 3, '学生3/4 应在第 3-4 排');
});

/* ---------- rotation ---------- */

describe('轮换 rotation');

const lockSet = ids => new Set(ids);

test('整体右移：学生向右移动一格，排尾绕回排首', () => {
  // 1 row × 3 columns, no locks
  const seats = activeSeats(normalizeLayout({ rows: 1, cols: 3 }));
  const assignment = { '1-1': 11, '1-2': 22, '1-3': 33 };
  const { assignment: next } = applyRotation(seats, lockSet([]), assignment, 'shiftRight');
  assertEquals(next['1-2'], 11, '1-1 的学生应移到 1-2');
  assertEquals(next['1-3'], 22);
  assertEquals(next['1-1'], 33, '排尾绕回排首');
});

test('整体左移：方向相反', () => {
  const seats = activeSeats(normalizeLayout({ rows: 1, cols: 3 }));
  const assignment = { '1-1': 11, '1-2': 22, '1-3': 33 };
  const { assignment: next } = applyRotation(seats, lockSet([]), assignment, 'shiftLeft');
  assertEquals(next['1-1'], 22);
  assertEquals(next['1-2'], 33);
  assertEquals(next['1-3'], 11);
});

test('整排后移：第一排学生到第二排', () => {
  const seats = activeSeats(normalizeLayout({ rows: 3, cols: 2 }));
  const assignment = { '1-1': 11, '2-1': 21 };
  const { assignment: next } = applyRotation(seats, lockSet([]), assignment, 'rowBackward');
  // column-1 cycle: 1-1 -> 2-1 -> 3-1 -> 1-1 (each student advances one step along the cycle)
  assertEquals(next['2-1'], 11, '1-1 的学生应到 2-1');
  assertEquals(next['3-1'], 21, '2-1 的学生应到 3-1（3-1 空位也参与循环）');
});

test('锁定座位轮换时纹丝不动（不迁出、不被迁入）', () => {
  const seats = activeSeats(normalizeLayout({ rows: 2, cols: 3 }));
  const locks = lockSet(['1-2']);
  const assignment = { '1-1': 11, '1-2': 22, '1-3': 33, '2-2': 44 };
  const { assignment: next } = applyRotation(seats, locks, assignment, 'shiftRight');
  assertEquals(next['1-2'], 22, '锁定座位上的学生不动');
  assertEquals(next['1-3'], 11, '1-1 → 1-2？不，1-2 锁定，应滑过到 1-3');
  // with 1-2 locked, 1-1's move target shifts past it
  assertEquals(next['1-1'], 33, '1-3 → 1-1 绕回');
});

test('轮换映射是双射（无碰撞）', () => {
  const seats = activeSeats(normalizeLayout({ rows: 4, seatCols: 4, aisles: [2] }));
  for (const mode of ['shiftLeft', 'shiftRight', 'rowBackward', 'rowForward', 'snake']) {
    const map = buildRotationMap(seats, lockSet(['2-2', '3-4']), mode);
    const targets = [...map.values()];
    assertEquals(new Set(targets).size, targets.length, `${mode} 目标座位不应重复`);
    for (const t of targets) assert(!['2-2', '3-4'].includes(t), `${mode} 不应迁入锁定座位`);
  }
});

test('蛇形轮换：队尾绕回队首', () => {
  const seats = activeSeats(normalizeLayout({ rows: 2, cols: 2 }));
  const assignment = { '1-1': 11, '1-2': 22, '2-2': 33, '2-1': 44 };
  // snake order: 1-1 -> 1-2 -> 2-2 -> 2-1 -> back to 1-1
  const { assignment: next } = applyRotation(seats, lockSet([]), assignment, 'snake');
  assertEquals(next['1-2'], 11);
  assertEquals(next['2-2'], 22);
  assertEquals(next['2-1'], 33);
  assertEquals(next['1-1'], 44);
});

/* ---------- Store / Reducer / History ---------- */

describe('状态管理 store & history');

test('ASSIGN 顶掉原占用者且学生不重复出现', () => {
  const store = createStore(reducer, initialState());
  store.dispatch({ type: 'ASSIGN', studentId: 1, seatId: '1-1' });
  store.dispatch({ type: 'ASSIGN', studentId: 1, seatId: '2-2' });
  const a = store.getState().assignment;
  assert(!('1-1' in a), '旧座位应被清空');
  assertEquals(a['2-2'], 1);
  assertEquals(Object.values(a).filter(v => v === 1).length, 1, '学生只出现一次');
});

test('SET_LAYOUT 清理越界座位与锁定', () => {
  const store = createStore(reducer, initialState());
  store.dispatch({ type: 'ASSIGN', studentId: 1, seatId: '7-8' });
  store.dispatch({ type: 'TOGGLE_LOCK', seatId: '7-8' });
  store.dispatch({ type: 'SET_LAYOUT', layout: { rows: 4, cols: 4 } });
  const s = store.getState();
  assert(!('7-8' in s.assignment), '越界座位应清除');
  assertEquals(s.locks.length, 0, '越界锁定应清除');
});

test('DELETE_STUDENT 连带清理座位与关系', () => {
  const store = createStore(reducer, initialState());
  store.dispatch({ type: 'ADD_STUDENT', student: S(1) });
  store.dispatch({ type: 'ADD_STUDENT', student: S(2) });
  store.dispatch({ type: 'SET_RELATIONS', relations: { friends: [{ a: 1, b: 2 }], blacklist: [] } });
  store.dispatch({ type: 'ASSIGN', studentId: 1, seatId: '1-1' });
  store.dispatch({ type: 'DELETE_STUDENT', id: 1 });
  const s = store.getState();
  assert(!('1-1' in s.assignment));
  assertEquals(s.relations.friends.length, 0, '关系应被清理');
});

test('undo/redo：交换与锁定均可撤销重做', () => {
  const store = createStore(reducer, initialState());
  const history = createHistory(store);
  store.dispatch({ type: 'ADD_STUDENT', student: S(1) });
  store.dispatch({ type: 'ADD_STUDENT', student: S(2) });
  store.dispatch({ type: 'ASSIGN', studentId: 1, seatId: '1-1' });
  store.dispatch({ type: 'ASSIGN', studentId: 2, seatId: '2-2' });
  history.clear();

  history.exec(swapCmd('1-1', '2-2'));
  assertEquals(store.getState().assignment['2-2'], 1);
  history.undo();
  assertEquals(store.getState().assignment['1-1'], 1, '撤销交换应还原');
  history.redo();
  assertEquals(store.getState().assignment['2-2'], 1, '重做应再次交换');

  history.exec(toggleLockCmd('3-3'));
  assert(store.getState().locks.includes('3-3'));
  history.undo();
  assert(!store.getState().locks.includes('3-3'));
});

test('规则权重越界被钳制', () => {
  const store = createStore(reducer, initialState());
  store.dispatch({ type: 'SET_RULE_WEIGHT', id: 'visionProtection', weight: 300 });
  assertEquals(store.getState().rules.weights.visionProtection, 100);
  store.dispatch({ type: 'SET_FRONT_RATIO', value: 5 });
  assertEquals(store.getState().rules.frontRowRatio, 0.9);
});

/* ---------- Excel import ---------- */

describe('Excel 导入 excel');

test('行数据 → 学生：9 个字段全部保留', () => {
  const rows = [[
    '张三', '男', '矮', '近视', '优秀', '活跃', '体育', '体育委员、组长', '重点关注',
  ]];
  const mapping = {
    name: 0, gender: 1, height: 2, vision: 3, academic: 4,
    personality: 5, ability: 6, tags: 7, annotationColor: 8,
  };
  const [s] = rowsToStudentInputs(rows, mapping);
  assertEquals(s.name, '张三');
  assertEquals(s.gender, '男');
  assertEquals(s.height, '矮');
  assertEquals(s.vision, '近视');
  assertEquals(s.academic, '优秀');
  assertEquals(s.personality, '活跃');
  assertEquals(s.ability, '体育');
  assertEquals(s.tags.length, 2, '多职务应拆分为数组');
  assertEquals(s.tags[1], '组长');
  assertEquals(s.annotationColor, 'red', '「重点关注」应映射为 red');
});

test('异常值容错：未知枚举回落默认值', () => {
  const mapping = { name: 0 };
  const [s] = rowsToStudentInputs([['李四']], mapping);
  assertEquals(s.name, '李四');
  assertEquals(s.gender, '男', '未知性别默认男');
  assert(Array.isArray(s.tags) && s.tags.length === 0);
});

/* ---------- engine robustness regression (covers the pairSwap adjacent-edges-shared-seat bug) ---------- */

describe('引擎健壮性回归');

test('多种子运行：任何配置下都不漏排学生（双射不变量）', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const { students } = generateDemoStudents(45, 2026);
    const relations = seed % 2 === 0
      ? { friends: [{ a: students[0].id, b: students[1].id }], blacklist: [] }
      : { friends: [], blacklist: [] };
    const result = generateSolution(
      makeCfg(students, { rows: 7, seatCols: 8, aisles: [4] }, { relations }),
      seed * 7919, { maxIter: 9000, timeMs: 300 });
    assert(result.ok, `seed ${seed} 应出解`);
    const seatedIds = new Set(Object.values(result.assignment));
    const missing = students.filter(s => !seatedIds.has(s.id));
    assertEquals(missing.length, 0,
      `seed ${seed} 漏排 ${missing.length} 人（${missing.slice(0, 3).map(m => m.name).join(',')}）——pairSwap 邻边共享座位回归`);
    // no duplicate seat assignments
    assertEquals(seatedIds.size, Object.values(result.assignment).length, `seed ${seed} 学生重复入座`);
  }
});

renderResults();
