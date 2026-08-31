/**
 * 图片导出验证：生成数据 → 排座 → renderSeatingChart → 画布挂载到页面供截图目视
 */
import { App } from '../js/app.js';
import { generateDemoStudents } from '../js/core/datagen.js';
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
    // 锁一个座位（验证锁定样式）+ 好友（验证标注多样性已有）
    app.history.exec(toggleLockCmd('2-3'));
    say(`IMGTEST 排座完成 score=${store.getState().ui.lastScore?.total}`);

    const { renderSeatingChart } = await import('../js/services/image.js');
    const canvas = renderSeatingChart(store.getState());
    say(`IMGTEST 渲染成功 ${canvas.width}x${canvas.height}`);
    const url = canvas.toDataURL('image/png');
    say(`IMGTEST toDataURL 长度=${url.length}（>50000 为正常）`);

    // exportSeatImage 含浏览器下载行为，无头环境会阻塞——仅验证其渲染部分已由上方覆盖
    say('IMGTEST exportSeatImage 渲染路径已覆盖（下载行为跳过）');

    // 挂载成品图供截图目视
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
