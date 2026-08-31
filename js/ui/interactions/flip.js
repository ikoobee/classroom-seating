/**
 * FLIP animation: First → Last → Invert → Play
 * Relies on the classroom view reusing card elements by studentId; do not use for layout rebuilds
 */

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function withFlip(container, mutate) {
  if (reducedMotion() || !container) { mutate(); return; }

  // First: record old positions
  const first = new Map();
  for (const el of container.querySelectorAll('.student-card')) {
    first.set(el.dataset.studentId, el.getBoundingClientRect());
  }

  container.classList.add('flipping');

  // Last: apply the state change + DOM update (synchronous)
  mutate();

  // Invert: once new positions are in place, instantly snap cards back to their old positions
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

  // Play: after a double rAF, release the transition back to 0
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
