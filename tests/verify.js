/**
 * Computed verification (replaces eyeballing screenshots):
 *   #vlegend  legend modal: chip size + title/description font hierarchy
 *   #vdash    dashboard: bar chart colors vs heatmap border colors, per dimension
 *   #vrel     relations modal: dropdown + button on one line; panel opens downward
 *   #vchart   exported chart: distance from the seat card top to the first dark pixel of the seat number (breathing room)
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
    // Find the first seat card with a student name: scanning the whole image for the
    // top-left solid non-white/non-gray card region is unreliable, so approximate
    // with the leftmost first-row seats below the podium: scan y in [0, canvas.height)
    // for the first "dark text pixel" (alpha>0 and all RGB < 120) within
    // x in [left start, +60]
    // The title is large dark text, so skip the title area (start at y > 150)
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
    // this dark pixel is the first seat number (the first dark element at each card's top-left)
    // find the card's top border (scan up for the first row of light border/background difference) — just report y relative to the content start below the title
    log(`画布 ${canvas.width}x${canvas.height}`);
    log(`首个座位号深色像素 at (${firstDarkX}, ${firstDarkY})`);
    // seat card top edge: from (firstDarkX, firstDarkY) scan up for the border color (dark stroke) or card background (non-pure-white)
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

    // 1) each bar chart card: title + (label -> fill color)
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

    // 2) per heatmap dimension, take first-row student cell border colors and compare against the bar charts
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
    // all cards: at most 3 icons, single line (no wrapping), no overlap with the name rect; locked seats show a lock via ::after
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
