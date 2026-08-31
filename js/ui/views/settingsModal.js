/**
 * 设置模态框：教室布局（排数/座位列数/模板/过道位置）｜显示与保存｜存储与备份
 * 结构：布局卡片（通栏） + 显示/存储双栏，一屏呈现全部内容
 */
import { h, clearEl, appendKids, fmtTime } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';
import { confirmDialog } from '../components/toast.js';
import { TEMPLATES } from '../../core/constants.js';
import { templateLayout } from '../../core/grid.js';
import { applyFullState } from './importModal.js';

const selectStyle = {
  flex: 1, minWidth: 0, padding: '8px 10px',
  border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--bg-panel)',
};
const shortSelectStyle = {
  width: '112px', padding: '8px 10px',
  border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--bg-panel)',
};

/* ---------- 过道模式 ---------- */

/** 模式 → 过道位置数组（custom 返回 null，表示保持现状） */
export function aislesForPattern(pattern, seatCols) {
  const cols = Math.max(1, Math.min(20, seatCols));
  switch (pattern) {
    case 'none': return [];
    case 'center': {
      const c = Math.floor(cols / 2);
      return (c >= 1 && c <= cols - 1) ? [c] : [];
    }
    case 'g2': case 'g3': case 'g4': {
      const step = +pattern.slice(1);
      const out = [];
      for (let c = step; c < cols; c += step) out.push(c);
      return out;
    }
    default: return null; // custom
  }
}

/** 从过道位置反推模式（用于下拉回显） */
export function patternFromAisles(aisles, seatCols) {
  const cur = [...(aisles || [])].sort((a, b) => a - b).join(',');
  if (!cur) return 'none';
  for (const p of ['g2', 'g3', 'g4', 'center']) {
    const want = aislesForPattern(p, seatCols);
    if (want && want.join(',') === cur) return p;
  }
  return 'custom';
}

const AISLE_PATTERN_OPTIONS = [
  ['g2', '每2列一组 · 组间过道（推荐，双人同桌）'],
  ['none', '无过道'],
  ['g3', '每3列一组 · 组间过道'],
  ['g4', '每4列一组 · 组间过道'],
  ['center', '中央过道 · 左右分组'],
  ['custom', '自定义…'],
];

export function openSettingsModal(app) {
  const { store, toast } = app;
  const state = store.getState();
  const layout = { ...state.layout, aisles: [...state.layout.aisles] };

  /* ---------- 教室布局卡片：模板 / 排数·列数下拉 / 过道模式下拉 ---------- */

  const rowsSelect = h('select', { style: shortSelectStyle },
    Array.from({ length: 15 }, (_, i) => i + 1)
      .map(v => h('option', { value: v, selected: v === layout.rows }, `${v} 排`)));
  const colsSelect = h('select', { style: shortSelectStyle },
    Array.from({ length: 20 }, (_, i) => i + 1)
      .map(v => h('option', { value: v, selected: v === layout.seatCols }, `${v} 列`)));

  const curCols = () => Math.max(1, Math.min(20, +colsSelect.value || 8));
  const curRows = () => Math.max(1, Math.min(15, +rowsSelect.value || 7));
  let aislePattern = patternFromAisles(layout.aisles, layout.seatCols);

  const aisleSelect = h('select', { style: selectStyle },
    AISLE_PATTERN_OPTIONS.map(([id, label]) =>
      h('option', { value: id, selected: id === aislePattern }, label)));

  const seatCountHint = h('span', { style: { fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' } });
  const aisleBox = h('div', { class: 'chip-group', style: { display: aislePattern === 'custom' ? 'flex' : 'none' } });
  const aisleDesc = h('div', { style: { fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.6 } });

  function updateHint() {
    seatCountHint.textContent = `共 ${curRows() * curCols()} 个座位`;
    aisleDesc.textContent = aislePattern === 'custom'
      ? '自定义模式：点击按钮在对应列后插入 / 移除过道'
      : '过道不占座位列，两侧学生不计为同桌';
  }

  function syncAisleUI() {
    aisleSelect.value = aislePattern;
    aisleBox.style.display = aislePattern === 'custom' ? 'flex' : 'none';
    renderAisles();
    updateHint();
  }

  function applyPattern(pattern) {
    aislePattern = pattern;
    const next = aislesForPattern(pattern, curCols());
    if (next) layout.aisles = next; // custom 返回 null，保持现状
    syncAisleUI();
  }

  function renderAisles() {
    clearEl(aisleBox);
    const seatCols = curCols();
    if (seatCols < 2) {
      aisleBox.append(h('span', { style: { fontSize: 12, color: 'var(--text-3)' } }, '仅 1 列时无法设置过道'));
      return;
    }
    for (let c = 1; c <= seatCols - 1; c++) {
      aisleBox.append(h('button', {
        class: `chip ${layout.aisles.includes(c) ? 'on' : ''}`,
        title: `在第 ${c}、${c + 1} 列之间${layout.aisles.includes(c) ? '移除' : '插入'}过道`,
        onclick: e => {
          e.preventDefault();
          const i = layout.aisles.indexOf(c);
          i >= 0 ? layout.aisles.splice(i, 1) : layout.aisles.push(c);
          aislePattern = patternFromAisles(layout.aisles, seatCols);
          syncAisleUI();
        },
      }, `${c}列后`));
    }
  }

  aisleSelect.addEventListener('change', () => applyPattern(aisleSelect.value));
  colsSelect.addEventListener('change', () => {
    // 列数变化：按当前模式重算过道（自定义则裁剪越界）
    if (aislePattern !== 'custom') {
      applyPattern(aislePattern);
    } else {
      layout.aisles = layout.aisles.filter(n => n >= 1 && n <= curCols() - 1);
      syncAisleUI();
    }
  });
  rowsSelect.addEventListener('change', updateHint);
  syncAisleUI();

  const layoutCard = h('div', { class: 'setting-card' },
    h('div', { class: 'setting-card-title' }, '🏫 教室布局'),

    // 模板行（预设 + 自定义占位；回显当前模板）
    h('div', { class: 'setting-row' },
      h('span', { class: 'setting-label' }, '快速模板'),
      h('select', {
        style: selectStyle,
        onchange: e => {
          if (e.target.value === '__custom__') {
            toast.info('自定义模式：请在下方手动调整排数、列数与过道后点击「应用布局」', 3600);
            return;
          }
          const t = templateLayout(e.target.value);
          if (!t) return;
          layout.rows = t.rows; layout.seatCols = t.seatCols; layout.aisles = [...t.aisles]; layout.template = t.template;
          rowsSelect.value = t.rows;
          colsSelect.value = t.seatCols;
          aislePattern = patternFromAisles(layout.aisles, t.seatCols);
          syncAisleUI();
        },
      }, h('option', { value: '' }, '选择模板…'),
        TEMPLATES.map(t => h('option', {
          value: t.id,
          selected: layout.template === t.id
            && layout.rows === t.rows && layout.seatCols === t.seatCols
            && layout.aisles.join(',') === t.aisles.join(','),
        }, t.name)),
        h('option', { value: '__custom__' }, '自定义（下方手动调整）'))),

    // 尺寸行：排数 / 列数 下拉
    h('div', { class: 'setting-row' },
      h('span', { class: 'setting-label' }, '教室尺寸'),
      h('div', { style: { display: 'flex', gap: 12, alignItems: 'center', flex: 1, flexWrap: 'wrap' } },
        h('label', { class: 'field-inline' }, '排数', rowsSelect),
        h('span', { style: { color: 'var(--text-3)' } }, '×'),
        h('label', { class: 'field-inline' }, '每排座位', colsSelect),
        seatCountHint)),

    // 过道行：模式下拉（自定义时显示细位 chips）
    h('div', { class: 'setting-row', style: { alignItems: 'flex-start' } },
      h('span', { class: 'setting-label', style: { paddingTop: 6 } }, '过道位置'),
      h('div', { style: { flex: 1, minWidth: 0 } },
        aisleSelect,
        aisleBox,
        aisleDesc)),

    // 应用行
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', flexWrap: 'wrap' } },
      h('button', {
        class: 'btn btn-primary',
        onclick: () => {
          layout.rows = curRows();
          layout.seatCols = curCols();
          layout.aisles = layout.aisles.filter(n => n >= 1 && n <= layout.seatCols - 1);
          layout.template = 'custom';
          store.dispatch({ type: 'SET_LAYOUT', layout: { ...layout } });
          toast.success('教室布局已更新（越界座位已自动清理）');
        },
      }, '应用布局'),
      h('span', { style: { fontSize: 11.5, color: 'var(--warning)', lineHeight: 1.5 } }, '缩小布局会移除越界座位上的学生')),
  );

  /* ---------- 显示与保存卡片 ---------- */

  const settings = { ...state.settings };
  const switchRow = (label, key, hint) => {
    const cb = h('input', {
      type: 'checkbox', checked: settings[key], style: { width: 15, height: 15, accentColor: 'var(--primary)' },
      onchange: e => {
        settings[key] = e.target.checked;
        store.dispatch({ type: 'SET_SETTINGS', patch: { [key]: e.target.checked } });
      },
    });
    return h('label', { class: 'switch-line' },
      cb,
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { fontSize: 13, fontWeight: 500 } }, label),
        h('div', { style: { fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 } }, hint)));
  };

  const displayCard = h('div', { class: 'setting-card' },
    h('div', { class: 'setting-card-title' }, '🎨 显示与保存'),
    switchRow('显示标注颜色', 'annotationVisible', '座位左侧色条，关闭后只显示性别色'),
    switchRow('自动保存', 'autoSave', '改动后自动写入浏览器本地存储'),
    h('div', {
      style: {
        marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
        fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.8,
      },
    }, '💡 快捷键：Ctrl+S 立即保存　Ctrl+Z / Y 撤销重做　Esc 关闭弹窗'),
  );

  /* ---------- 存储与备份卡片 ---------- */

  const storageBox = h('div');
  const renderStorage = () => {
    clearEl(storageBox);
    const usage = app.storage.usage();
    const pct = Math.min(100, (usage.total / usage.quota) * 100).toFixed(1);
    const bars = usage.items.slice(0, 6).map(i =>
      h('div', { style: { background: 'var(--primary)', width: `${(i.size / usage.total) * 100}%` } }));
    const backups = app.storage.getBackups();

    appendKids(storageBox,
      h('div', { class: 'kv-grid' },
        h('span', { class: 'k' }, '已用空间'), h('span', {}, `${(usage.total / 1024).toFixed(1)} KB / 5 MB（${pct}%）`),
        h('span', { class: 'k' }, '本地备份'), h('span', {}, `${backups.length} 个`)),
      h('div', { class: 'storage-bar' }, bars),
      h('div', { style: { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' } },
        h('button', {
          class: 'btn btn-sm',
          onclick: () => {
            const ts = app.storage.createBackup(store.getState());
            toast.success(`已创建本地备份（${fmtTime(ts)}）`);
            renderStorage();
          },
        }, '💾 立即备份'),
        h('button', {
          class: 'btn btn-sm btn-danger',
          onclick: async () => {
            const ok = await confirmDialog({
              title: '清空本地数据', danger: true,
              message: '将清除全部本地数据（学生、座位、规则、日志），恢复初始状态。确定？',
            });
            if (!ok) return;
            app.storage.clearData();
            location.reload();
          },
        }, '🗑 清空')),
      backups.length ? h('div', { style: { marginTop: 14 } },
        h('div', { style: { fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 8 } }, '备份列表'),
        backups.map(b => h('div', { class: 'list-row' },
          h('div', { class: 'lr-main' },
            h('div', { class: 'lr-title' }, fmtTime(b.ts)),
            h('div', { class: 'lr-sub' }, `${b.data.students.list.length} 人 · ${Object.keys(b.data.assignment).length} 座`)),
          h('button', {
            class: 'btn btn-sm',
            onclick: async () => {
              const ok = await confirmDialog({
                title: '恢复此备份', danger: true,
                message: `将把数据回滚到 ${fmtTime(b.ts)} 的状态，覆盖当前全部数据。确定？`,
              });
              if (!ok) return;
              applyFullState(app, b.data);
              toast.success('备份已恢复');
              closeModal(modal);
            },
          }, '恢复'),
        ))) : null,
    );
  };

  const storageCard = h('div', { class: 'setting-card' },
    h('div', { class: 'setting-card-title' }, '🗄 存储与备份'),
    storageBox,
  );

  /* ---------- 组装 ---------- */

  const modal = openModal({
    title: '⚙️ 设置',
    width: 720,
    content: h('div', {},
      layoutCard,
      h('div', { style: { display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 14, marginTop: 14 } },
        displayCard, storageCard),
    ),
    footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '关闭')],
  });
  renderStorage();
  return modal;
}
