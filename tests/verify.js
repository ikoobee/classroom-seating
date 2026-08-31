/**
 * 计算式验证（替代截图目测）：
 *   #vlegend  图例弹窗：芯片尺寸 + 标题/说明字体层级
 *   #vdash    仪表盘：条形图颜色 vs 热力图边框颜色逐维度一致性
 *   #vrel     关系弹窗：下拉+按钮同行；面板向下弹出
 *   #vchart   导出图：座位号首个深色像素距座位顶部的距离（呼吸空间）
 */
import { App } from '../js/app.js';
import { generateDemoStudents } from '../js/core/datagen.js';
import { replaceAllCmd, toggleLockCmd } from '../js/store/history.js';

const out = [];
const log = s => out.push(s);

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
  await new Promise(r => setTimeout(r, 400));

  const mode = location.hash.replace('#', '') || 'vchart';
  const done = () => { document.getElementById('dumpResult').textContent = `MODE ${mode} ✓\n` + out.join('\n'); };

  if (mode === 'vchart') {
    const { renderSeatingChart } = await import('../js/services/image.js');
    const canvas = renderSeatingChart(store.getState());
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // 找第一个有学生名的座位卡：扫描全图最左上角非白非灰的实心卡区域起点不可靠，
    // 改用画布左侧讲台下方第一排座位近似：直接扫描 y∈[0, canvas.height) 中
    // x∈[左侧起始, +60] 内第一处「深色文字像素」（alpha>0 且 RGB 均 < 120）
    // 由于标题是深色大字，先跳过标题区（y > 150 之后开始）
    const isDark = (x, y) => {
      const i = (y * canvas.width + x) * 4;
      return img[i + 3] > 40 && img[i] < 120 && img[i + 1] < 120 && img[i + 2] < 120;
    };
    let firstDarkY = -1, firstDarkX = -1;
    outer: for (let y = 150; y < canvas.height; y++) {
      for (let x = 60; x < 260; x++) {
        if (isDark(x, y)) { firstDarkY = y; firstDarkX = x; break outer; }
      }
    }
    // 该深色像素即第一个座位号（每卡左上角第一个深色元素）
    // 找该座位卡的上边框（向上找第一行连续浅色边框/背景差异）——直接输出 y 与标题后内容起点差值即可
    log(`画布 ${canvas.width}x${canvas.height}`);
    log(`首个座位号深色像素 at (${firstDarkX}, ${firstDarkY})`);
    // 座位卡上边缘：从 (firstDarkX, firstDarkY) 向上找边框色（深色描边）或卡片背景（非纯白）
    let cardTop = firstDarkY;
    for (let y = firstDarkY; y > 150; y--) {
      const i = (y * canvas.width + firstDarkX) * 4;
      const nonWhite = img[i + 3] > 10 && !(img[i] > 245 && img[i + 1] > 245 && img[i + 2] > 245);
      if (!nonWhite) { cardTop = y + 1; break; }
      cardTop = y;
    }
    log(`座位卡顶边约 y=${cardTop}，号顶距卡顶 ${(firstDarkY - cardTop)}px`);
    done(); return;
  }

  if (mode === 'vlegend') {
    document.querySelector('#studentsPanel .panel-head .btn-ghost')?.click();
    await new Promise(r => setTimeout(r, 200));
    const rows = [...document.querySelectorAll('.modal .modal-body > div')].filter(d => d.style.display === 'flex');
    for (const r of rows.slice(0, 8)) {
      const chip = r.querySelector('span');
      const [label, desc] = [...r.querySelectorAll(':scope > div > div')];
      const cs = getComputedStyle(chip);
      const ls = getComputedStyle(label), ds = getComputedStyle(desc);
      log(`chip ${parseFloat(cs.width)}x${parseFloat(cs.height)} | 「${label.textContent}」${ls.fontSize}/${ls.fontWeight} | desc ${ds.fontSize}`);
    }
    done(); return;
  }

  if (mode === 'vdash') {
    const { openDashboardModal } = await import('../js/ui/views/dashboardModal.js');
    const modal = openDashboardModal(app);
    await new Promise(r => setTimeout(r, 200));

    // 1) 每个条形图卡：标题 + (标签→填充色)
    const cards = [...modal.el.querySelectorAll('.chart-card')];
    const chartMap = new Map(); // label -> hex
    for (const c of cards) {
      const title = c.querySelector('h5')?.textContent ?? '';
      if (title.includes('环形') || !c.querySelector('.bar-row')) continue;
      for (const row of c.querySelectorAll('.bar-row')) {
        const lbl = row.querySelector('.bl')?.textContent;
        const bg = row.querySelector('.bfill')?.style.background;
        if (lbl && bg) chartMap.set(lbl, bg);
      }
    }
    log('条形图颜色：');
    for (const [k, v] of chartMap) log(`  ${k}: ${v}`);

    // 2) 逐个热力维度，取第一排学生单元格边框色，与条形图对照
    const tabs = [...modal.el.querySelectorAll('.filter-tab')];
    for (const t of tabs) {
      t.click();
      await new Promise(r => setTimeout(r, 60));
      const cells = [...modal.el.querySelectorAll('.heat-cell')];
      if (!cells.length) { log(`【${t.textContent}】无热力单元格`); continue; }
      const samples = cells.slice(0, 6).map(c => getComputedStyle(c).borderTopColor);
      log(`【${t.textContent}】热力边框样例: ${[...new Set(samples)].join(' ')}`);
    }
    done(); return;
  }

  if (mode === 'vlock') {
    // 所有卡片：图标 ≤3、单行（无换行）、与姓名矩形不相交；锁定座位 ::after 显示 🔒
    let maxIcons = 0, wrapped = 0, overlapped = 0;
    for (const card of document.querySelectorAll('.student-card')) {
      const meta = card.querySelector('.sc-meta');
      const name = card.querySelector('.sc-name');
      if (!meta || !name) continue;
      const n = meta.querySelectorAll('.sc-ic').length;
      maxIcons = Math.max(maxIcons, n);
      const lineH = parseFloat(getComputedStyle(meta).fontSize) * 1.4;
      if (meta.clientHeight > lineH) wrapped++;
      const mr = meta.getBoundingClientRect(), nr = name.getBoundingClientRect();
      if (mr.top < nr.bottom - 1 && nr.top < mr.bottom - 1) overlapped++;
    }
    log(`卡片数 ${document.querySelectorAll('.student-card').length} | 最多图标数 ${maxIcons}（应 ≤3）`);
    log(`图标行换行卡片数 ${wrapped}（应 0）| 图标行与姓名重叠卡片数 ${overlapped}（应 0）`);
    const lockedSeats = document.querySelectorAll('.seat.locked');
    let lockShown = 0;
    for (const seat of lockedSeats) {
      const card = seat.querySelector('.student-card');
      const cs = card ? getComputedStyle(card, '::after') : null;
      if (cs && cs.content.includes('🔒')) lockShown++;
      if (card) {
        const badge = card.querySelector('.sc-badge');
        log(`锁定 ${seat.dataset.seatId} 卡片${card.className.includes('anno-') ? '（带标注条）' : ''}: 🔒 top=${cs.top} left=${cs.left} pad=${cs.padding} | 职务标签${badge ? ` top=${getComputedStyle(badge).top} right=${getComputedStyle(badge).right} pad=${getComputedStyle(badge).padding}` : ' 无'}`);
      }
      const noAfter = getComputedStyle(seat.querySelector('.seat-no'), '::after').content;
      log(`  seat-no::after=${noAfter}`);
    }
    log(`锁定座位 ${lockedSeats.length} 个，其中卡片左上角显示 🔒 的 ${lockShown} 个`);
    done(); return;
  }

  if (mode === 'vrel') {
    const { openRelationsModal } = await import('../js/ui/views/relationsModal.js');
    const modal = openRelationsModal(app);
    await new Promise(r => setTimeout(r, 200));
    const addRow = modal.el.querySelector('#relListBox > div > div:nth-child(2)');
    const btns = [...addRow.querySelectorAll(':scope > button')];
    const addBtn = btns.find(b => b.classList.contains('btn-primary'));
    const picker = addRow.querySelector(':scope > div > button');
    const pr = picker.getBoundingClientRect(), ar = addBtn.getBoundingClientRect();
    log(`同行检查: picker top=${pr.top.toFixed(1)} bottom=${pr.bottom.toFixed(1)} | addBtn top=${ar.top.toFixed(1)} bottom=${ar.bottom.toFixed(1)} | 垂直重叠=${pr.top < ar.bottom && ar.top < pr.bottom}`);

    picker.click();
    await new Promise(r => setTimeout(r, 150));
    const panel = [...document.querySelectorAll('body > div')].find(d => d.style.position === 'fixed' && d.querySelector('input[type=text]'));
    if (panel) {
      const fr = panel.getBoundingClientRect();
      log(`下拉面板: top=${fr.top.toFixed(1)} (按钮 bottom=${pr.bottom.toFixed(1)}) 向下弹出=${fr.top >= pr.bottom - 2}`);
      const items = panel.querySelectorAll('button').length;
      panel.querySelector('input').value = '王';
      panel.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
      const filtered = panel.querySelectorAll('button').length;
      log(`搜索: 列表 ${items} 项 → 输入「王」后 ${filtered} 项`);
    } else log('未找到下拉面板');
    done(); return;
  }
  done();
}
main();
