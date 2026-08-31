/**
 * Topbar: arrange entry / candidates / rotation / undo & redo / lock mode / score badge / entries to feature modals
 */
import { h, popupMenu, fmtTime } from '../dom.js';
import { ROTATION_MODES } from '@ikoobee/seating-core';
import { openModal, closeModal } from '../components/modal.js';
import { openReportModal } from './reportModal.js';
import { openRelationsModal } from './relationsModal.js';
import { openDashboardModal } from './dashboardModal.js';
import { openLogModal } from './logModal.js';
import { openSettingsModal } from './settingsModal.js';
import { openImportModal } from './importModal.js';
import { openExportModal } from './exportModal.js';

export function createTopbar(app) {
  const { store, history, toast, arranger } = app;
  const root = document.getElementById('topbar');

  const undoBtn = h('button', {
    class: 'btn', title: '撤销 (Ctrl+Z)',
    onclick: () => {
      if (history.undo()) toast.info('已撤销'); else toast.info('没有可撤销的操作');
    },
  }, '↶ 撤销');
  const redoBtn = h('button', {
    class: 'btn', title: '重做 (Ctrl+Y)',
    onclick: () => {
      if (history.redo()) toast.info('已重做'); else toast.info('没有可重做的操作');
    },
  }, '↷ 重做');

  const scoreBadge = h('button', {
    class: 'score-badge', id: 'scoreBadge',
    title: '点击查看评分报告',
    onclick: () => {
      const score = store.getState().ui.lastScore;
      if (!score) { toast.info('还没有座位表，先排一次座吧'); return; }
      openReportModal(app, score, []);
    },
  }, '📊 评分', h('span', { class: 'sb-num' }, '—'));

  const lockBtn = h('button', {
    class: 'btn', title: '锁定模式下点击座位即锁定/解锁，锁定的座位不参与智能排座与轮换',
    onclick: () => {
      const v = !store.getState().ui.lockMode;
      store.dispatch({ type: 'PATCH_UI', patch: { lockMode: v } });
      toast.info(v ? '已进入锁定模式：点击座位锁定/解锁' : '已退出锁定模式');
    },
  }, '🔓 锁定模式');

  const themeBtn = h('button', {
    class: 'btn btn-ghost', title: '切换明暗主题',
    onclick: () => {
      const cur = store.getState().settings.theme;
      store.dispatch({ type: 'SET_SETTINGS', patch: { theme: cur === 'dark' ? 'light' : 'dark' } });
    },
  }, '🌙');

  root.append(
    h('div', { class: 'tb-logo' },
      h('span', { class: 'logo-ico' }, '🪑'), '智能排座',
    ),
    h('div', { class: 'dropdown' },
      h('button', {
        class: 'btn btn-primary',
        onclick: e => popupMenu(e.currentTarget, [
          { ico: '⚡', label: '一键智能排座', hint: '单方案', onClick: () => arranger.arrangeOnce() },
          { ico: '🏆', label: '生成候选方案…', hint: '多方案对比', onClick: () => arranger.arrangeCandidates(5) },
        ]),
      }, '🎯 智能排座 ▾')),
    h('div', { class: 'dropdown' },
      h('button', {
        class: 'btn',
        onclick: e => popupMenu(e.currentTarget, [
          { title: '轮换方式（锁定座位自动保护）' },
          ...ROTATION_MODES.map(m => ({
            ico: m.ico, label: m.name, hint: m.desc, onClick: () => arranger.rotate(m.id),
          })),
          '-',
          { ico: '🕓', label: '轮换历史…', onClick: () => openRotationHistory(app) },
        ]),
      }, '🔄 轮换 ▾')),
    undoBtn, redoBtn,
    lockBtn,
    h('span', { class: 'tb-sep' }),
    scoreBadge,
    h('span', { class: 'tb-spacer' }),
    h('button', { class: 'btn', onclick: () => openDashboardModal(app) }, '📈 仪表盘'),
    h('button', { class: 'btn', onclick: () => openRelationsModal(app) }, '🤝 关系'),
    h('button', { class: 'btn', onclick: () => openLogModal(app) }, '📋 日志'),
    h('button', { class: 'btn', onclick: () => openImportModal(app) }, '📥 导入'),
    h('button', { class: 'btn', onclick: () => openExportModal(app) }, '📤 导出'),
    h('button', { class: 'btn', onclick: () => openSettingsModal(app) }, '⚙️ 设置'),
    themeBtn,
    h('button', {
      class: 'btn', title: '保存 (Ctrl+S)',
      onclick: () => { app.persistNow(); toast.success('已保存到浏览器本地存储'); },
    }, '💾'),
  );

  /* ---------- State sync ---------- */

  function renderHistoryBtns() {
    undoBtn.disabled = !history.canUndo();
    redoBtn.disabled = !history.canRedo();
  }

  function renderScore() {
    const score = store.getState().ui.lastScore;
    const badge = document.getElementById('scoreBadge');
    if (!badge) return;
    badge.className = 'score-badge ' + (score
      ? (score.total >= 80 ? 'score-lv-good' : score.total >= 50 ? 'score-lv-mid' : 'score-lv-bad')
      : '');
    badge.querySelector('.sb-num').textContent = score ? String(score.total) : '—';
  }

  function renderLockMode() {
    const on = store.getState().ui.lockMode;
    lockBtn.classList.toggle('btn-active', on);
    lockBtn.textContent = on ? '🔒 锁定模式已开启' : '🔓 锁定模式';
  }

  store.subscribe('ui', () => { renderScore(); renderLockMode(); });
  app.onHistoryChange = renderHistoryBtns;
  renderHistoryBtns();

  return { renderScore };
}

/* ---------- Rotation history ---------- */

function openRotationHistory(app) {
  const { store } = app;
  const logs = store.getState().logs.filter(l => l.type === 'rotate');
  const content = logs.length
    ? h('div', {}, logs.map(l => h('div', { class: 'list-row' },
        h('span', { class: 'type-tag type-rotate' }, '轮换'),
        h('div', { class: 'lr-main' },
          h('div', { class: 'lr-title' }, l.label),
          h('div', { class: 'lr-sub' }, fmtTime(l.ts))),
        h('button', {
          class: 'btn btn-sm',
          onclick: () => {
            if (app.history.undo()) app.toast.info('已撤销最近一次操作（含轮换）');
            else app.toast.info('没有可撤销的操作');
          },
        }, '撤销上一步'),
      )))
    : h('div', { class: 'empty-tip' }, '还没有轮换记录<br>使用顶栏「轮换」菜单开始公平轮换');

  const modal = openModal({
    title: '🕓 轮换历史',
    width: 480,
    content,
    footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '关闭')],
  });
  return modal;
}
