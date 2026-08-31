/**
 * Entry point: assemble the App and boot it
 */
import { App } from './app.js';

window.addEventListener('error', e => {
  console.error('[app]', e.error ?? e.message);
});

try {
  const app = new App();
  window.seatingApp = app; // debug handle
  const boot = () => app.boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
} catch (err) {
  console.error('[app] 启动失败', err);
  document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif">
    <h2>⚠️ 系统启动失败</h2>
    <p>${String(err?.message ?? err)}</p>
    <p style="color:#888">请通过 HTTP 服务访问（如 http://localhost:8000/index.html），ES Modules 不支持 file:// 直接打开。</p>
  </div>`;
}
