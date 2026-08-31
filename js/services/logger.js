/**
 * 排座日志：索引（store/logs 切片，≤100 条小字段）与详情（分键存储，LRU 20 条）分离
 */

export function createLogger(store, storage) {
  const mkId = () => `log_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;

  function log(type, summary, detail) {
    const entry = {
      id: mkId(),
      ts: Date.now(),
      type, // 'seat' | 'rotate' | 'manual' | 'import'
      ...summary,
    };
    store.dispatch({ type: 'ADD_LOG', entry });
    if (detail) storage.setLogDetail(entry.id, detail);
    return entry;
  }

  return {
    /** 智能排座 */
    seat({ total, dimensions, hardViolations, meta, warnings, seedNote }) {
      return log('seat', {
        label: `智能排座 · ${total} 分`,
        score: total,
        hardCount: hardViolations.length,
        dims: dimensions.map(d => `${d.name} ${d.score}`).join('　'),
      }, { dimensions, hardViolations, meta, warnings, seedNote });
    },
    /** 轮换 */
    rotate({ modeName, moved, total }) {
      return log('rotate', { label: `${modeName} · ${moved} 个座位迁移`, score: total }, {
        modeName, moved, total,
      });
    },
    /** 手动操作 */
    manual(label, note) {
      return log('manual', { label }, { note });
    },
    /** 导入 */
    importData(label, count) {
      return log('import', { label: `${label} · ${count} 名学生` }, { label, count });
    },

    getDetail: id => storage.getLogDetail(id),

    deleteLog(id) {
      storage.deleteLogDetail(id);
      store.dispatch({ type: 'DELETE_LOG', id });
    },

    clearLogs() {
      // 同时清掉全部详情
      store.getState().logs.forEach(l => storage.deleteLogDetail(l.id));
      store.dispatch({ type: 'CLEAR_LOGS' });
    },

    /** 导出全部日志（索引 + 已有详情）为 JSON 文本 */
    exportLogs() {
      const logs = store.getState().logs;
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        count: logs.length,
        logs: logs.map(l => ({ ...l, detail: storage.getLogDetail(l.id) ?? null })),
      }, null, 2);
    },
  };
}
