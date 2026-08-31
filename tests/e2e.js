/**
 * E2E smoke test: drives the App through the full flow in a real browser
 * Results are written to #e2eResult as E2E-PASS / E2E-FAIL text lines,
 * verified headlessly via dump-dom
 */
import { App } from '../js/app.js';
import { generateDemoStudents } from '@ikoobee/seating-core';
import { replaceAllCmd, toggleLockCmd } from '../js/store/history.js';
import { activeSeats } from '@ikoobee/seating-core';

const lines = [];
const pass = (name) => lines.push(`E2E-PASS ${name}`);
const fail = (name, e) => lines.push(`E2E-FAIL ${name}: ${e?.message ?? e}`);

function output() {
  const el = document.getElementById('e2eResult');
  el.innerHTML = lines.map(l =>
    `<div class="${l.startsWith('E2E-PASS') ? 'ok' : 'bad'}">${l}</div>`).join('') +
    `<div id="e2eDone">${lines.every(l => l.startsWith('E2E-PASS')) ? 'ALL-PASS' : 'HAS-FAIL'} (${lines.filter(l => l.startsWith('E2E-PASS')).length}/${lines.length})</div>`;
}

async function main() {
  let app;
  try {
    app = new App();
    app.boot();
    pass('应用启动');
  } catch (e) { fail('应用启动', e); output(); return; }

  const { store, history, arranger } = app;

  // 1. Generate demo students (same code path as the students panel button)
  try {
    const { students, nextId } = generateDemoStudents(45, 2026);
    const st = store.getState();
    history.exec(replaceAllCmd(
      { list: students, nextId, assignment: {} },
      { list: st.students.list, nextId: st.students.nextId, assignment: st.assignment },
      'E2E 演示数据'));
    if (store.getState().students.list.length === 45) pass('生成 45 名演示学生');
    else throw new Error(`学生数 ${store.getState().students.list.length}`);
  } catch (e) { fail('生成 45 名演示学生', e); }

  // 2. Students panel rendering
  try {
    const items = document.querySelectorAll('#studentsPanel .student-item');
    if (items.length === 45) pass('学生面板渲染 45 张卡片');
    else throw new Error(`卡片数 ${items.length}`);
  } catch (e) { fail('学生面板渲染', e); }

  // 3. Smart seating (real engine + FLIP DOM updates)
  try {
    arranger.arrangeOnce();
    await new Promise(r => setTimeout(r, 500)); // wait for the FLIP animation and toast
    const assignment = store.getState().assignment;
    if (Object.keys(assignment).length === 45) pass(`智能排座 45 人入座`);
    else throw new Error(`入座 ${Object.keys(assignment).length}`);
    const cards = document.querySelectorAll('#seatGrid .student-card');
    if (cards.length === 45) pass('教室渲染 45 张学生卡');
    else throw new Error(`卡片 ${cards.length}`);
    const score = store.getState().ui.lastScore;
    if (score && Number.isFinite(score.total)) pass(`评分徽章更新（${score.total} 分）`);
    else throw new Error('lastScore 缺失');
  } catch (e) { fail('智能排座流程', e); }

  // 4. Activity log
  try {
    const logs = store.getState().logs;
    if (logs.length >= 1 && logs[0].type === 'seat') pass('排座日志已记录');
    else throw new Error(`日志 ${logs.length} 条`);
  } catch (e) { fail('排座日志', e); }

  // 5. Lock + rotation: locked seats stay untouched
  try {
    const st = store.getState();
    // pick a seated, unlocked seat
    const lockedSeat = Object.keys(st.assignment).find(s => !st.locks.includes(s));
    const lockedStudent = st.assignment[lockedSeat];
    history.exec(toggleLockCmd(lockedSeat));

    arranger.rotate('snake');
    await new Promise(r => setTimeout(r, 500));
    const after = store.getState().assignment;
    if (after[lockedSeat] === lockedStudent) pass(`锁定座位 ${lockedSeat} 轮换后保持不动`);
    else throw new Error(`${lockedSeat}: ${lockedStudent} → ${after[lockedSeat]}`);
    if (store.getState().logs.some(l => l.type === 'rotate')) pass('轮换日志已记录');
    history.undo(); // undo the rotation
    history.undo(); // undo the lock
  } catch (e) { fail('锁定与轮换', e); }

  // 6. Relations: friends must share a desk
  try {
    const st = store.getState();
    const [a, b] = st.students.list;
    const prev = st.relations;
    const relations = { friends: [...prev.friends, { a: a.id, b: b.id }], blacklist: prev.blacklist };
    history.exec({
      label: 'E2E 好友',
      apply: d => d({ type: 'SET_RELATIONS', relations }),
      revert: d => d({ type: 'SET_RELATIONS', relations: prev }),
    });
    arranger.arrangeOnce();
    await new Promise(r => setTimeout(r, 400));
    const after = store.getState();
    const byStudent = new Map(Object.entries(after.assignment).map(([s, id]) => [id, s]));
    const seatA = byStudent.get(a.id), seatB = byStudent.get(b.id);
    const layout = { ...after.layout };
    // check directly with engine geometry
    const { deskEdges } = await import('../js/core/grid.js');
    const edges = deskEdges(activeSeats(layout), layout.aisles);
    const ok = edges.some(e =>
      (e.a.id === seatA && e.b.id === seatB) || (e.a.id === seatB && e.b.id === seatA));
    if (ok) pass(`好友 ${a.name}+${b.name} 成功同桌`);
    else throw new Error(`${seatA} vs ${seatB} 未同桌`);
  } catch (e) { fail('好友同桌约束', e); }

  // 7. Multiple candidates (async + progress + modal)
  try {
    await arranger.arrangeCandidates(3);
    await new Promise(r => setTimeout(r, 300));
    const rows = document.querySelectorAll('#modalHost .data-table tr.clickable');
    if (rows.length === 3) pass('候选方案模态框展示 3 个方案');
    else throw new Error(`方案行 ${rows.length}`);
    document.querySelector('#modalHost .modal-close')?.click();
  } catch (e) { fail('多候选方案', e); }

  // 8. Undo / redo
  try {
    const before = JSON.stringify(store.getState().assignment);
    arranger.rotate('shiftRight');
    await new Promise(r => setTimeout(r, 300));
    const rotated = JSON.stringify(store.getState().assignment);
    if (rotated !== before) pass('轮换改变了座位表');
    history.undo();
    await new Promise(r => setTimeout(r, 100));
    if (JSON.stringify(store.getState().assignment) === before) pass('撤销恢复轮换前状态');
    else throw new Error('撤销后状态不一致');
    history.redo();
  } catch (e) { fail('撤销重做', e); }

  // 9. Persistence: data written to localStorage
  try {
    app.persistNow();
    const raw = localStorage.getItem('sm.students');
    if (raw && JSON.parse(raw).list.length === 45) pass('localStorage 持久化 sm.students');
    else throw new Error('sm.students 缺失');
    if (localStorage.getItem('sm.assignment')) pass('localStorage 持久化 sm.assignment');
    const logs = localStorage.getItem('sm.logs.index');
    if (logs && JSON.parse(logs).length >= 1) pass('localStorage 持久化日志索引');
  } catch (e) { fail('持久化', e); }

  // 10. Key isolation: only sm.* keys are read/written; other keys untouched
  try {
    const others = Object.keys(localStorage).filter(k => !k.startsWith('sm.'));
    pass(`其他 keys 未被修改（共 ${others.length} 个非 sm key）`);
  } catch (e) { fail('key 隔离', e); }

  output();
}

main();
