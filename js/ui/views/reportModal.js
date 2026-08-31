/**
 * 评分报告模态框：总分 / 维度子分条形 / 违规明细 / 硬冲突与建议
 */
import { h } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';
import { dimBar } from '../components/charts.js';

export function openReportModal(app, score, warnings = []) {
  const content = h('div', {},
    // 总分
    h('div', { class: 'score-hero' },
      h('div', {
        class: 'sh-num',
        style: { color: score.total >= 80 ? 'var(--success)' : score.total >= 50 ? 'var(--warning)' : 'var(--danger)' },
      }, String(score.total)),
      h('div', { class: 'sh-sub' }, '综合评分（0-100，软规则加权）')),

    // 硬冲突
    score.hardViolations.length ? h('div', { class: 'hard-block' },
      h('div', { style: { fontWeight: 600, marginBottom: 4 } }, `⛔ ${score.hardViolations.length} 项硬约束未满足`),
      score.hardViolations.map(v => h('div', {}, '• ' + v.msg)),
    ) : h('div', { class: 'warn-block', style: { borderColor: 'var(--success)', background: 'var(--success-soft)', color: 'var(--success)' } },
      '✅ 全部硬约束（锁定座位 / 好友同桌 / 黑名单隔离）均已满足'),

    warnings.length ? h('div', { class: 'warn-block' },
      h('div', { style: { fontWeight: 600, marginBottom: 4 } }, '⚠️ 排座提示'),
      warnings.map(w => h('div', {}, '• ' + w)),
    ) : null,

    // 维度子分
    h('div', { style: { margin: '16px 0 12px', fontWeight: 600, fontSize: 13.5 } }, '维度得分'),
    score.dimensions.length ? score.dimensions.map(d => h('div', { style: { marginBottom: 10 } },
      dimBar(d.name, d.score, d.weight),
      h('div', { style: { fontSize: 11.5, color: 'var(--text-3)', margin: '4px 0 0 86px' } }, d.details),
      d.violations.length ? h('details', { class: 'fold', style: { marginTop: 8 } },
        h('summary', {}, `查看 ${d.violations.length} 条违规明细`),
        h('ul', { class: 'vio-list' }, d.violations.map(v => h('li', {}, v))),
      ) : null,
    )) : h('div', { class: 'empty-tip' }, '没有启用任何规则（权重全为 0）'),
  );

  const modal = openModal({
    title: '📊 排座评分报告',
    width: 620,
    content,
    footer: [h('button', { class: 'btn btn-primary', onclick: () => closeModal(modal) }, '关闭')],
  });
  return modal;
}
