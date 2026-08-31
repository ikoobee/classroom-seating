/**
 * FLIP 动画：First → Last → Invert → Play
 * 依赖 classroom 按 studentId 复用卡片元素；布局重建场景请勿使用
 */

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function withFlip(container, mutate) {
  if (reducedMotion() || !container) { mutate(); return; }

  // First：记录旧位置
  const first = new Map();
  for (const el of container.querySelectorAll('.student-card')) {
    first.set(el.dataset.studentId, el.getBoundingClientRect());
  }

  container.classList.add('flipping');

  // Last：执行状态变更 + DOM 更新（同步）
  mutate();

  // Invert：新位置就绪后把卡片瞬时拉回旧位置
  const plays = [];
  for (const el of container.querySelectorAll('.student-card')) {
    const f = first.get(el.dataset.studentId);
    if (!f) {
      el.classList.add('enter-anim');
      setTimeout(() => el.classList.remove('enter-anim'), 320);
      continue;
    }
    const l = el.getBoundingClientRect();
    const dx = f.left - l.left, dy = f.top - l.top;
    if (!dx && !dy) continue;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    plays.push(el);
  }

  // Play：双 rAF 后释放过渡回 0
  requestAnimationFrame(() => requestAnimationFrame(() => {
    container.classList.remove('flipping');
    for (const el of plays) {
      el.classList.add('flip-playing');
      el.style.transform = '';
      el.addEventListener('transitionend', () => {
        el.classList.remove('flip-playing');
        el.style.transition = '';
      }, { once: true });
    }
  }));
}
