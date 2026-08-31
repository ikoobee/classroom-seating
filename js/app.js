/**
 * App assembly: creates the store/storage/logger/history/arranger, instantiates views, and handles persistence and theming
 */
import { createStore } from './store/store.js';
import { reducer, initialState } from './store/reducers.js';
import { createHistory } from './store/history.js';
import { createStorage } from './services/storage.js';
import { createLogger } from './services/logger.js';
import { createArranger } from './services/arranger.js';
import { createTopbar } from './ui/views/topbar.js';
import { createClassroomView } from './ui/views/classroom.js';
import { createStudentsPanel } from './ui/views/studentsPanel.js';
import { createRulesPanel } from './ui/views/rulesPanel.js';
import { setupShortcuts } from './ui/interactions/shortcuts.js';
import { toast } from './ui/components/toast.js';
import { normalizeLayout, activeSeats } from './core/grid.js';
import { normalizeRelations } from './core/relations.js';
import { defaultRules } from './core/constants.js';

const PERSIST_SLICES = ['students', 'layout', 'assignment', 'locks', 'relations', 'rules', 'settings', 'logs'];

export class App {
  constructor() {
    this.toast = toast;

    this.storage = createStorage(fatal => {
      toast.error(fatal
        ? '本地存储空间不足且自动清理失败，请立即通过「导出 → JSON 备份」保存数据'
        : '本地存储空间吃紧，已自动清理旧日志详情与备份', 5000);
    });

    // 1. Restore persisted data → initial state
    const state = this.loadInitialState();

    this.store = createStore(reducer, state);
    this.logger = createLogger(this.store, this.storage);

    const app = this;
    this.history = createHistory(this.store, {
      onChange: () => app.onHistoryChange?.(),
    });

    this.arranger = createArranger(this);
    this.views = {};

    // 2. Persistence: slice changes → debounced writes
    this.saveTimer = null;
    for (const slice of PERSIST_SLICES) {
      this.store.subscribe(slice, () => this.schedulePersist());
    }

    // 3. Keep the score badge up to date
    for (const slice of ['assignment', 'students', 'rules', 'locks', 'relations']) {
      this.store.subscribe(slice, () => this.arranger.refreshScore());
    }
  }

  loadInitialState() {
    const base = initialState();
    const saved = this.storage.loadAll();
    if (!saved) return base;

    // Merge slice by slice with defensive normalization (bad data must not crash the app)
    const state = { ...base };
    if (saved.students?.list) state.students = saved.students;
    if (saved.layout) state.layout = normalizeLayout(saved.layout);
    if (saved.assignment) {
      const valid = new Set(activeSeats(state.layout).map(s => s.id));
      const ids = new Set(state.students.list.map(s => s.id));
      const assignment = {};
      for (const [seat, sid] of Object.entries(saved.assignment)) {
        if (valid.has(seat) && ids.has(sid)) assignment[seat] = sid;
      }
      state.assignment = assignment;
    }
    if (saved.locks) state.locks = saved.locks.filter(s => s in state.assignment || /^[1-9]\d*-[1-9]\d*$/.test(s));
    if (saved.relations) state.relations = normalizeRelations(saved.relations);
    if (saved.rules) state.rules = { ...defaultRules(), ...saved.rules };
    if (saved.settings) state.settings = { ...state.settings, ...saved.settings };
    if (Array.isArray(saved.logs)) state.logs = saved.logs.slice(0, 100);
    return state;
  }

  boot() {
    // Theme
    const applyTheme = () => {
      document.body.classList.toggle('dark-theme', this.store.getState().settings.theme === 'dark');
    };
    applyTheme();
    this.store.subscribe('settings', applyTheme);

    // Views (order matters: classroom is built first so studentsPanel can reference seatName)
    this.views.classroom = createClassroomView(this);
    this.views.studentsPanel = createStudentsPanel(this);
    this.views.rulesPanel = createRulesPanel(this);
    this.views.topbar = createTopbar(this);

    // Initial render
    Object.values(this.views).forEach(v => v.render?.());
    this.arranger.refreshScore();

    // Keyboard shortcuts
    setupShortcuts(this);

    // Force a flush before the page unloads
    window.addEventListener('beforeunload', () => {
      if (this.store.getState().settings.autoSave) this.persistNow();
    });

    // First-use hint
    const state = this.store.getState();
    if (!state.students.list.length) {
      setTimeout(() => toast.info('欢迎使用智能排座！点击右栏「🎲 演示数据」快速生成学生体验全部功能', 6000), 600);
    }
  }

  schedulePersist() {
    if (!this.store.getState().settings.autoSave) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persistNow(), 600);
  }

  persistNow() {
    clearTimeout(this.saveTimer);
    this.storage.persist(this.store.getState());
    const el = document.getElementById('saveState');
    if (el) el.textContent = `💾 已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
  }
}
