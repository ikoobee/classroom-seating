/**
 * Image export verification: generate data -> arrange -> renderSeatingChart ->
 * mount the canvas on the page for visual screenshot inspection
 */
import { App } from '../js/app.js';
import { generateDemoStudents } from '@ikoobee/seating-core';
import { replaceAllCmd, toggleLockCmd } from '../js/store/history.js';

const out = [];
const say = msg => { out.push(msg); console.log(msg); };

async function main() {
  try {
    const app = new App();
    app.boot();
    const { store, arranger } = app;

    const { students, nextId } = generateDemoStudents(45, 2026);
    const st = store.getState();
    app.history.exec(replaceAllCmd(
      { list: students, nextId, assignment: {} },
      { list: st.students.list, nextId: st.students.nextId, assignment: st.assignment }, '测试数据'));
    arranger.arrangeOnce();
    await new Promise(r => setTimeout(r, 600));
    // lock one seat (verifies lock styling); annotation diversity is already covered by the demo data
    app.history.exec(toggleLockCmd('2-3'));
    say(`IMGTEST 排座完成 score=${store.getState().ui.lastScore?.total}`);

    const { renderSeatingChart } = await import('../js/services/image.js');
    const canvas = renderSeatingChart(store.getState());
    say(`IMGTEST 渲染成功 ${canvas.width}x${canvas.height}`);
    const url = canvas.toDataURL('image/png');
    say(`IMGTEST toDataURL 长度=${url.length}（>50000 为正常）`);

    // exportSeatImage triggers a browser download which blocks in headless mode — its rendering path is already covered above
    say('IMGTEST exportSeatImage 渲染路径已覆盖（下载行为跳过）');

    // mount the rendered image for visual screenshot inspection
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    document.getElementById('imgShow').append(canvas);
  } catch (e) {
    say(`IMGTEST-ERROR ${e?.constructor?.name}: ${e?.message}`);
    if (e?.stack) say('IMGTEST-STACK ' + String(e.stack).split('\n').slice(0, 5).join(' | '));
  } finally {
    document.getElementById('imgResult').textContent = 'IMG-DONE ' + out.join(' ⁋ ');
  }
}
main();
