/**
 * Import modal: Excel (column-mapping preview with confirmation, all fields importable) / JSON restore / template download
 */
import { h, clearEl } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';
import { confirmDialog } from '../components/toast.js';
import { parseTableFile, rowsToStudentInputs, downloadTemplate, FIELD_LABELS } from '../../services/excel.js';
import { parseCompleteData } from '../../services/backup.js';
import { replaceAllCmd } from '../../store/history.js';

const FIELDS = Object.keys(FIELD_LABELS);

export function openImportModal(app) {
  const { store, history, toast: t, logger } = app;
  const stepBox = h('div', {});
  const fileInput = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', style: { display: 'none' } });
  const jsonInput = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });

  const modal = openModal({
    title: '📥 导入数据',
    width: 640,
    content: h('div', {},
      h('div', { class: 'panel-section' },
        h('h4', {}, '① Excel / CSV 导入（支持中英文表头，前 5 行自动识别表头）'),
        h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
          h('button', {
            class: 'btn btn-primary',
            onclick: () => fileInput.click(),
          }, '📄 选择文件'),
          h('button', { class: 'btn', onclick: () => downloadTemplate().catch(() => t.error('模板下载失败')) }, '⬇️ 下载模板'),
        ),
      ),
      h('div', { class: 'panel-section' },
        h('h4', {}, '② JSON 备份恢复（完整数据：学生 + 座位 + 规则 + 关系）'),
        h('div', {},
          h('button', { class: 'btn', onclick: () => jsonInput.click() }, '🗃 选择 JSON 备份')),
      ),
      stepBox,
      fileInput, jsonInput,
    ),
    footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '关闭')],
  });

  /* ---------- Excel flow: parse → column-mapping preview → confirm import ---------- */

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = ''; // Allow re-selecting the same file (this is the only listener, so it can't double-fire)
    if (!file) return;
    try {
      const { headers, rows, suggested } = await parseTableFile(file);
      renderMapping(headers, rows, suggested);
    } catch (e) {
      t.error(e.message);
    }
  });

  function renderMapping(headers, rows, suggested) {
    clearEl(stepBox);
    const mapping = { ...suggested };
    const selFields = {};

    const table = h('table', { class: 'data-table' },
      h('thead', {}, h('tr', {}, h('th', {}, '系统字段'), h('th', {}, 'Excel 列'), h('th', {}, '首行示例'))),
      h('tbody', {}, FIELDS.map(f => {
        const sel = h('select', { style: { padding: '4px 6px' } },
          h('option', { value: -1 }, '（不导入）'),
          headers.map((hd, i) => h('option', { value: i, selected: mapping[f] === i }, hd)),
        );
        sel.addEventListener('change', () => mapping[f] = +sel.value);
        selFields[f] = sel;
        return h('tr', {},
          h('td', {}, FIELD_LABELS[f] + (f === 'name' ? ' *' : '')),
          h('td', {}, sel),
          h('td', { style: { color: 'var(--text-3)' } },
            mapping[f] >= 0 ? String(rows[0]?.[mapping[f]] ?? '') : '—'),
        );
      })));

    stepBox.append(
      h('div', { class: 'panel-section', style: { marginTop: 16 } },
        h('h4', {}, `列映射预览（识别到 ${rows.length} 行数据）`),
        h('div', { style: { fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.6 } },
          '确认「Excel 列 → 系统字段」映射后导入。所有 9 个字段均支持导入。'),
        table,
        h('div', { style: { display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' } },
          h('button', { class: 'btn', onclick: () => clearEl(stepBox) }, '取消'),
          h('button', {
            class: 'btn btn-primary',
            onclick: async () => {
              if (mapping.name === undefined || mapping.name < 0) { t.warning('必须指定姓名列'); return; }
              const students = rowsToStudentInputs(rows, mapping);
              if (!students.length) { t.warning('没有解析到有效学生'); return; }
              const ok = await confirmDialog({
                title: '确认导入',
                message: `将导入 ${students.length} 名学生并覆盖现有名单（现有 ${store.getState().students.list.length} 名，可通过撤销恢复）。`,
              });
              if (!ok) return;
              const state = store.getState();
              students.forEach((s, i) => { s.id = i + 1; });
              history.exec(replaceAllCmd(
                { list: students, nextId: students.length + 1, assignment: {} },
                { list: state.students.list, nextId: state.students.nextId, assignment: state.assignment },
                `Excel 导入（${students.length} 人）`));
              logger.importData('Excel 导入', students.length);
              t.success(`成功导入 ${students.length} 名学生（全部字段已保留）`);
              closeModal(modal);
            },
          }, `导入 ${rows.length} 行`),
        ),
      ),
    );
  }

  /* ---------- JSON restore ---------- */

  jsonInput.addEventListener('change', async () => {
    const file = jsonInput.files[0];
    jsonInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const state = parseCompleteData(text);
      const ok = await confirmDialog({
        title: '恢复 JSON 备份', danger: true,
        message: `备份包含 ${state.students.list.length} 名学生，将覆盖当前全部数据（会先自动创建本地备份）。`,
      });
      if (!ok) return;
      app.storage.createBackup(app.store.getState());
      applyFullState(app, state);
      logger.importData('JSON 备份恢复', state.students.list.length);
      t.success('备份已恢复');
      closeModal(modal);
    } catch (e) {
      t.error('恢复失败：' + e.message);
    }
  });

  return modal;
}

/** Apply a complete state in one shot (migration / restore) */
export function applyFullState(app, data) {
  const cur = app.store.getState();
  app.store.dispatch({ type: 'HYDRATE', state: { ...cur, ...data } });
  app.arranger.resetBaseline();
  app.arranger.refreshScore();
}
