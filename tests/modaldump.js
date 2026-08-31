/**
 * 视觉验证：导出图（排列号位置）+ 可选打开指定弹窗（#legend / #dashboard / #relations）
 */
import { App } from '../js/app.js';
import { generateDemoStudents } from '../js/core/datagen.js';
import { replaceAllCmd, toggleLockCmd } from '../js/store/history.js';

async function main() {
  const app = new App();
  app.boot();
  const { store, arranger } = app;

  const { students, nextId } = generateDemoStudents(45, 2026);
  const st = store.getState();
  app.history.exec(replaceAllCmd(
    { list: students, nextId, assignment: {} },
    { list: st.students.list, nextId: st.students.nextId, assignment: st.assignment }, '测试数据'));
  arranger.arrangeOnce();
  app.history.exec(toggleLockCmd('2-3'));
  await new Promise(r => setTimeout(r, 500));

  const mode = location.hash.replace('#', '') || 'chart';

  if (mode === 'chart') {
    const { renderSeatingChart } = await import('../js/services/image.js');
    const canvas = renderSeatingChart(store.getState());
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.padding = '60px 16px 16px';
    document.body.append(canvas);
    document.getElementById('dumpResult').textContent = `MODE chart ${canvas.width}x${canvas.height}`;
    return;
  }
  if (mode === 'legend') {
    document.querySelector('#studentsPanel .panel-head .btn-ghost')?.click();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('dumpResult').textContent = 'MODE legend 图例弹窗已打开';
    return;
  }
  if (mode === 'dashboard') {
    const { openDashboardModal } = await import('../js/ui/views/dashboardModal.js');
    openDashboardModal(app);
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('dumpResult').textContent = 'MODE dashboard 仪表盘已打开';
    return;
  }
  if (mode === 'relations') {
    const { openRelationsModal } = await import('../js/ui/views/relationsModal.js');
    openRelationsModal(app);
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('dumpResult').textContent = 'MODE relations 关系弹窗已打开';
  }
}
main();
