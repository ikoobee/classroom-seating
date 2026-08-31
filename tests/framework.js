/**
 * Mini test framework (runs in the browser)
 */
const results = [];
let currentGroup = '';
globalThis.__testResults = results; // read by the Node headless runner

export function describe(name) { currentGroup = name; }

export function test(name, fn) {
  const start = performance.now();
  try {
    fn();
    results.push({ group: currentGroup, name, ok: true, ms: performance.now() - start });
  } catch (e) {
    results.push({
      group: currentGroup, name, ok: false,
      msg: e.message, ms: performance.now() - start,
    });
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? '断言失败');
}

export function assertEquals(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg ?? '不相等'}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

export function assertNearly(actual, expected, eps = 1e-9, msg) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${msg ?? '数值不符'}：期望 ≈${expected}，实际 ${actual}`);
  }
}

/** Render the accumulated results to the page (idempotent: last call wins) */
export function renderResults() {
  const host = document.getElementById('results');
  if (!host) return;
  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;

  host.innerHTML = ''; // idempotent redraw
  const groups = [...new Set(results.map(r => r.group))];
  for (const g of groups) {
    const items = results.filter(r => r.group === g);
    const gFail = items.filter(r => !r.ok).length;
    host.insertAdjacentHTML('beforeend',
      `<h2>${gFail ? '🔴' : '🟢'} ${g}（${items.length - gFail}/${items.length}）</h2>`);
    for (const r of items) {
      host.insertAdjacentHTML('beforeend',
        `<div class="case ${r.ok ? 'ok' : 'bad'}">
           <span class="mark">${r.ok ? '✔' : '✘'}</span> ${r.name}
           <span class="ms">${r.ms.toFixed(1)}ms</span>
           ${r.ok ? '' : `<div class="err">${r.msg ?? ''}</div>`}
         </div>`);
    }
  }
  document.getElementById('summary').innerHTML =
    `<b class="${fail ? 'bad-text' : 'good-text'}">${pass}/${results.length} 通过</b>` +
    (fail ? `，${fail} 失败` : '，全部通过 ✅');
  document.title = fail ? `❌ ${fail} 个失败` : `✅ 全部通过 (${pass})`;
  return { pass, fail, total: results.length };
}
