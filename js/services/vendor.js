/**
 * Lazy-load UMD dependencies (local vendor first, CDN fallback on failure)
 */

const cache = {};

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error('load fail: ' + src)); };
    document.head.append(s);
  });
}

async function loadGlobal(globalName, localPath, cdnUrl) {
  if (window[globalName]) return window[globalName];
  if (cache[globalName]) return cache[globalName];
  cache[globalName] = (async () => {
    try {
      await injectScript(localPath);
    } catch {
      await injectScript(cdnUrl);
    }
    if (!window[globalName]) throw new Error(`${globalName} 加载失败`);
    return window[globalName];
  })();
  return cache[globalName];
}

export const loadXlsx = () => loadGlobal('XLSX',
  'assets/vendor/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
