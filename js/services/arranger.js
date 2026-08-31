/**
 * Arrangement orchestration: bridges the engine and the UI (single-solution arrangement / candidate solutions / rotation / score badge upkeep)
 */
import { generateSolution, generateCandidates, scoreAssignment } from '../core/engine/engine.js';
import { activeSeats } from '../core/grid.js';
import { applyRotation, ROTATION_MODES } from '../core/rotation.js';
import { setAssignmentCmd } from '../store/history.js';
import { withFlip } from '../ui/interactions/flip.js';
import { openModal, closeModal } from '../ui/components/modal.js';
import { toast } from '../ui/components/toast.js';
import { h } from '../ui/dom.js';
import { openReportModal } from '../ui/views/reportModal.js';
import { openCandidatesModal } from '../ui/views/candidatesModal.js';

export function createArranger(app) {
  const { store, history, logger } = app;
  let prevBaseline = null; // previous seating chart (comparison baseline for the randomShuffle scatter dimension)

  const stateToCfg = prev => {
    const s = store.getState();
    return {
      students: s.students.list,
      layout: s.layout,
      locks: new Set(s.locks),
      assignment: s.assignment,
      relations: s.relations,
      rules: s.rules,
      prevAssignment: prev,
    };
  };

  /* ---------- Score badge ---------- */

  function refreshScore() {
    const s = store.getState();
    if (!Object.keys(s.assignment).length) {
      store.dispatch({ type: 'PATCH_UI', patch: { lastScore: null } });
      return;
    }
    const { score } = scoreAssignment(stateToCfg(prevBaseline), s.assignment);
    store.dispatch({ type: 'PATCH_UI', patch: { lastScore: score } });
  }

  /* ---------- Single-solution smart arrangement ---------- */

  function arrangeOnce() {
    const state = store.getState();
    if (!state.students.list.length) { toast.warning('请先添加或生成学生'); return; }
    if (Object.keys(state.assignment).length) {
      const seatCount = activeSeats(state.layout).length;
      if (state.students.list.length > seatCount) {
        toast.warning(`学生数（${state.students.list.length}）超过座位数（${seatCount}）`);
      }
    }

    const seed = (state.rules.seedBase + Date.now()) % 0xffffffff;
    const cfg = stateToCfg(prevBaseline);
    const result = generateSolution(cfg, seed, { maxIter: 9000, timeMs: 350 });

    if (!result.ok) {
      const modal = openModal({
        title: '⛔ 无法排座',
        width: 420,
        content: h('div', {},
          h('div', { class: 'hard-block' }, result.fatal.map(f => h('div', {}, '• ' + f))),
          h('div', { style: { fontSize: 12.5, color: 'var(--text-3)' } }, '请调整教室布局或学生名单后重试'),
        ),
        footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '知道了')],
      });
      return;
    }

    const prevAssignment = { ...state.assignment };
    prevBaseline = prevAssignment;
    const grid = document.getElementById('seatGrid');
    withFlip(grid, () => history.exec(setAssignmentCmd(result.assignment, prevAssignment, '智能排座')));

    store.dispatch({ type: 'PATCH_UI', patch: { lastScore: result.score } });
    logger.seat({
      total: result.score.total,
      dimensions: result.score.dimensions,
      hardViolations: result.score.hardViolations,
      meta: result.meta,
      warnings: result.warnings,
      seedNote: `种子 ${seed}，迭代 ${result.meta.iterations} 次 / ${result.meta.elapsedMs}ms`,
    });

    const hard = result.score.hardViolations.length;
    const warn = result.warnings.length;
    toast.success(`排座完成：${result.score.total} 分` +
      (hard ? `，${hard} 项硬约束未满足` : '') + (warn ? `，${warn} 条提示` : ''), 3200);
    if (hard || warn) openReportModal(app, result.score, result.warnings);
  }

  /* ---------- Candidate solutions ---------- */

  async function arrangeCandidates(N = 5) {
    const state = store.getState();
    if (!state.students.list.length) { toast.warning('请先添加或生成学生'); return; }

    const progress = toast.info('正在生成候选方案… 0%', 600000);
    const setProgress = (done, total) => {
      const t = progress.querySelector('span:last-child');
      if (t) t.textContent = `正在生成候选方案… ${Math.round((done / total) * 100)}%`;
    };

    const cfg = stateToCfg(prevBaseline);
    const seedBase = (state.rules.seedBase * 31 + Date.now()) % 0xffffffff;
    const result = await generateCandidates(cfg, N, seedBase, setProgress, { maxIter: 6000, timeMs: 220 });
    progress.remove();

    if (!result.ok) {
      toast.error(result.fatal[0] ?? '无法生成方案');
      return;
    }
    openCandidatesModal(app, result, prevBaseline, (chosen) => {
      const prevAssignment = { ...store.getState().assignment };
      prevBaseline = prevAssignment;
      const grid = document.getElementById('seatGrid');
      withFlip(grid, () => history.exec(setAssignmentCmd(chosen.assignment, prevAssignment, `应用候选方案（${chosen.score.total} 分）`)));
      store.dispatch({ type: 'PATCH_UI', patch: { lastScore: chosen.score } });
      logger.seat({
        total: chosen.score.total,
        dimensions: chosen.score.dimensions,
        hardViolations: chosen.score.hardViolations,
        meta: chosen.meta,
        warnings: result.warnings,
        seedNote: `多方案择优 · 种子 ${chosen.seed}`,
      });
      toast.success(`已应用最优方案：${chosen.score.total} 分`);
    });
  }

  /* ---------- Rotation ---------- */

  function rotate(modeId) {
    const state = store.getState();
    const seats = activeSeats(state.layout);
    const occupied = Object.keys(state.assignment).length;
    if (!occupied) { toast.warning('座位表为空，请先排座'); return; }

    const mode = ROTATION_MODES.find(m => m.id === modeId);
    const { assignment: next, moved } = applyRotation(seats, new Set(state.locks), state.assignment, modeId);
    if (moved < 2) { toast.info('可轮换座位不足（锁定过多或座位过少）'); return; }

    const prevAssignment = { ...state.assignment };
    const grid = document.getElementById('seatGrid');
    withFlip(grid, () => history.exec(setAssignmentCmd(next, prevAssignment, mode.name)));

    const { score } = scoreAssignment(stateToCfg(prevAssignment), next);
    store.dispatch({ type: 'PATCH_UI', patch: { lastScore: score } });
    logger.rotate({ modeName: mode.name, moved, total: score.total });
    toast.success(`${mode.name}完成（${moved} 个座位迁移），当前 ${score.total} 分`);
  }

  /** Clear the scatter baseline whenever the seating chart is cleared */
  function resetBaseline() { prevBaseline = null; }

  return { arrangeOnce, arrangeCandidates, rotate, refreshScore, resetBaseline };
}
