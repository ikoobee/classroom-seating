/**
 * Arrangement logs: the index (store "logs" slice, ≤100 entries of small fields) is kept separate from details (stored per-key, LRU of 20)
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
    /** Smart arrangement */
    seat({ total, dimensions, hardViolations, meta, warnings, seedNote }) {
      return log('seat', {
        label: `智能排座 · ${total} 分`,
        score: total,
        hardCount: hardViolations.length,
        dims: dimensions.map(d => `${d.name} ${d.score}`).join('　'),
      }, { dimensions, hardViolations, meta, warnings, seedNote });
    },
    /** Rotation */
    rotate({ modeName, moved, total }) {
      return log('rotate', { label: `${modeName} · ${moved} 个座位迁移`, score: total }, {
        modeName, moved, total,
      });
    },
    /** Manual operation */
    manual(label, note) {
      return log('manual', { label }, { note });
    },
    /** Import */
    importData(label, count) {
      return log('import', { label: `${label} · ${count} 名学生` }, { label, count });
    },

    getDetail: id => storage.getLogDetail(id),

    deleteLog(id) {
      storage.deleteLogDetail(id);
      store.dispatch({ type: 'DELETE_LOG', id });
    },

    clearLogs() {
      // Also drop all stored details
      store.getState().logs.forEach(l => storage.deleteLogDetail(l.id));
      store.dispatch({ type: 'CLEAR_LOGS' });
    },

    /** Export all logs (index + any stored details) as JSON text */
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
