/**
 * Node headless test runner (for browser tests, open runner.html instead)
 * Usage: node tests/_node.mjs
 */
// Minimal DOM / localStorage shim
globalThis.document = { getElementById: () => null };
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
  get length() { return mem.size; },
  key: i => [...mem.keys()][i] ?? null,
};

const dir = new URL('.', import.meta.url);

await import(new URL('engine.test.js', dir).href);

const results = globalThis.__testResults ?? [];
const failed = results.filter(r => !r.ok);
for (const f of failed) {
  console.log(`✘ [${f.group}] ${f.name}`);
  console.log(`   ${f.msg ?? ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} 通过` +
  (failed.length ? `，${failed.length} 失败 ❌` : '，全部通过 ✅'));
process.exit(failed.length ? 1 : 0);
