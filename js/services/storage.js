/**
 * localStorage 持久化：sm. 前缀、防抖写入、配额降级、备份环、日志详情 LRU
 */

const PREFIX = 'sm.';
const K = {
  meta: 'meta',
  students: 'students',
  layout: 'layout',
  assignment: 'assignment',
  locks: 'locks',
  relations: 'relations',
  rules: 'rules',
  settings: 'settings',
  logsIndex: 'logs.index',
};

export function createStorage(onQuotaExceeded) {
  const key = k => PREFIX + k;
  const detailKey = id => `${PREFIX}logs.detail.${id}`;
  const backupPattern = new RegExp(`^${PREFIX}backups\\.(\\d+)$`);

  function safeSet(k, value) {
    try {
      localStorage.setItem(k, JSON.stringify(value));
      return true;
    } catch {
      // 配额降级：先清日志详情，再清最旧备份，最后重试一次
      trimLogDetails(0);
      const backups = listBackupKeys();
      for (let i = 0; i < backups.length - 1 && i < 3; i++) localStorage.removeItem(backups[i]);
      try {
        localStorage.setItem(k, JSON.stringify(value));
        onQuotaExceeded?.();
        return true;
      } catch {
        onQuotaExceeded?.(true);
        return false;
      }
    }
  }

  function safeGet(k) {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /* ---------- 状态读写 ---------- */

  function loadAll() {
    const state = {};
    const map = [
      ['students', K.students], ['layout', K.layout], ['assignment', K.assignment],
      ['locks', K.locks], ['relations', K.relations], ['rules', K.rules],
      ['settings', K.settings], ['logs', K.logsIndex],
    ];
    let any = false;
    for (const [slice, k] of map) {
      const v = safeGet(key(k));
      if (v != null) { state[slice] = v; any = true; }
    }
    return any ? state : null;
  }

  function persist(state) {
    safeSet(key(K.meta), { version: 1, schema: 1, updatedAt: Date.now() });
    safeSet(key(K.students), state.students);
    safeSet(key(K.layout), state.layout);
    safeSet(key(K.assignment), state.assignment);
    safeSet(key(K.locks), state.locks);
    safeSet(key(K.relations), state.relations);
    safeSet(key(K.rules), state.rules);
    safeSet(key(K.settings), state.settings);
    safeSet(key(K.logsIndex), state.logs);
  }

  /* ---------- 日志详情（LRU 20 条） ---------- */

  function setLogDetail(id, detail) {
    safeSet(detailKey(id), detail);
    trimLogDetails(20);
  }

  function getLogDetail(id) { return safeGet(detailKey(id)); }

  function deleteLogDetail(id) { localStorage.removeItem(detailKey(id)); }

  function detailIds() {
    const ids = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${PREFIX}logs.detail.`)) ids.push(k);
    }
    return ids;
  }

  function trimLogDetails(keep) {
    const ids = detailIds();
    if (ids.length <= keep) return;
    // detail id 内含时间戳，按字典序即时间序
    ids.sort();
    for (let i = 0; i < ids.length - keep; i++) localStorage.removeItem(ids[i]);
  }

  /* ---------- 备份环（保留 5 个） ---------- */

  function listBackupKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && backupPattern.test(k)) keys.push(k);
    }
    return keys.sort();
  }

  function createBackup(state) {
    const ts = Date.now();
    safeSet(`${PREFIX}backups.${ts}`, {
      students: state.students, layout: state.layout, assignment: state.assignment,
      locks: state.locks, relations: state.relations, rules: state.rules,
      settings: state.settings, logs: state.logs, ts,
    });
    // 只保留最近 5 个
    const keys = listBackupKeys();
    for (let i = 0; i < keys.length - 5; i++) localStorage.removeItem(keys[i]);
    return ts;
  }

  function getBackups() {
    return listBackupKeys().reverse().map(k => safeGet(k)).filter(Boolean)
      .map(b => ({ ts: b.ts, data: b }));
  }

  function hasAnyData() {
    return safeGet(key(K.meta)) != null || loadAll() != null;
  }

  function clearData() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  function usage() {
    const items = [];
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const size = (localStorage.getItem(k) || '').length * 2; // UTF-16 近似
      items.push({ key: k.slice(PREFIX.length), size });
      total += size;
    }
    return { items: items.sort((a, b) => b.size - a.size), total, quota: 5 * 1024 * 1024 };
  }

  return {
    loadAll, persist,
    setLogDetail, getLogDetail, deleteLogDetail,
    createBackup, getBackups, hasAnyData, clearData, usage,
  };
}
