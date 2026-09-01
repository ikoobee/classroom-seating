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
import { openDonateModal } from './donateModal.js';

export function createTopbar(app) {
  const { store, history, toast, arranger } = app;
  const root = document.getElementById('topbar');

  const doUndo = () => { if (history.undo()) toast.info('已撤销'); else toast.info('没有可撤销的操作'); };
  const doRedo = () => { if (history.redo()) toast.info('已重做'); else toast.info('没有可重做的操作'); };

  const scoreBadge = h('button', {
    class: 'score-badge', id: 'scoreBadge',
    title: '点击查看评分报告',
    onclick: () => {
      const score = store.getState().ui.lastScore;
      if (!score) { toast.info('还没有座位表，先排一次座吧'); return; }
      openReportModal(app, score, []);
    },
  }, '📊 评分', h('span', { class: 'sb-num' }, '—'));

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
          '-',
          { ico: '🤝', label: '同学关系…', hint: '好友同桌 / 黑名单', onClick: () => openRelationsModal(app) },
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
    scoreBadge,
    h('span', { class: 'tb-spacer' }),
    h('button', {
      class: 'btn btn-ghost', title: '更多操作',
      onclick: e => popupMenu(e.currentTarget, [
        { ico: '↶', label: '撤销', hint: 'Ctrl+Z', onClick: doUndo },
        { ico: '↷', label: '重做', hint: 'Ctrl+Y', onClick: doRedo },
        '-',
        { ico: store.getState().ui.lockMode ? '🔒' : '🔓',
          label: store.getState().ui.lockMode ? '退出锁定模式' : '锁定模式',
          hint: '锁定座位不参与排座与轮换',
          onClick: () => {
            const v = !store.getState().ui.lockMode;
            store.dispatch({ type: 'PATCH_UI', patch: { lockMode: v } });
            toast.info(v ? '已进入锁定模式：点击座位锁定/解锁' : '已退出锁定模式');
          } },
        { ico: '📈', label: '统计仪表盘…', onClick: () => openDashboardModal(app) },
        { ico: '📋', label: '操作日志…', onClick: () => openLogModal(app) },
        '-',
        { ico: '📥', label: '导入…', onClick: () => openImportModal(app) },
        { ico: '📤', label: '导出…', onClick: () => openExportModal(app) },
        { ico: '⚙️', label: '设置…', onClick: () => openSettingsModal(app) },
        '-',
        { ico: store.getState().settings.theme === 'dark' ? '☀️' : '🌙',
          label: store.getState().settings.theme === 'dark' ? '浅色主题' : '深色主题',
          onClick: () => {
            const cur = store.getState().settings.theme;
            store.dispatch({ type: 'SET_SETTINGS', patch: { theme: cur === 'dark' ? 'light' : 'dark' } });
          } },
        { ico: '💾', label: '立即保存', hint: 'Ctrl+S',
          onClick: () => { app.persistNow(); toast.success('已保存到浏览器本地存储'); } },
        '-',
        { ico: '☕', label: '赞赏支持…', onClick: () => openDonateModal() },
      ]),
    }, '⋯'),
  );

  /* ---------- State sync ---------- */

  function renderScore() {
    const score = store.getState().ui.lastScore;
    const badge = document.getElementById('scoreBadge');
    if (!badge) return;
    badge.className = 'score-badge ' + (score
      ? (score.total >= 80 ? 'score-lv-good' : score.total >= 50 ? 'score-lv-mid' : 'score-lv-bad')
      : '');
    badge.querySelector('.sb-num').textContent = score ? String(score.total) : '—';
  }

  store.subscribe('ui', renderScore);

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
