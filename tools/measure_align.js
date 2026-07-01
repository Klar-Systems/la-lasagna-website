// Measure per-section horizontal alignment offsets via headless Chrome (CDP, no deps).
const { spawn } = require('child_process');
const http = require('http');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.argv[2] || 'http://127.0.0.1:8080/';
const PORT = 9222;

function cdp(method, params, sessionId) {
  return new Promise((res) => global.__send(method, params, sessionId, res));
}

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--window-size=1440,900', '--no-first-run', '--user-data-dir=/tmp/cdp-align',
]);

function getJSON(path) {
  return new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

(async () => {
  // wait for chrome
  let target;
  for (let i = 0; i < 40; i++) {
    try { const v = await getJSON('/json'); target = v.find(t => t.type === 'page'); if (target) break; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  const WebSocket = require('ws');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = {};
  global.__send = (method, params, sessionId, cb) => {
    const mid = ++id; pending[mid] = cb;
    ws.send(JSON.stringify({ id: mid, method, params: params || {}, sessionId }));
  };
  ws.on('message', (m) => {
    const msg = JSON.parse(m);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg.result); delete pending[msg.id]; }
  });
  await new Promise(r => ws.on('open', r));

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Page.navigate', { url: URL });
  await new Promise(r => setTimeout(r, 3500));

  const expr = `JSON.stringify((()=>{
    const vw = window.innerWidth;
    const out = [];
    document.querySelectorAll('section, .fluid-engine, .content-wrapper, .page-section').forEach(el=>{
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 20) return;
      const leftGap = Math.round(r.left);
      const rightGap = Math.round(vw - r.right);
      out.push({tag: el.tagName.toLowerCase(), cls:(el.className||'').toString().slice(0,40), l:leftGap, r:rightGap, w:Math.round(r.width), skew: leftGap-rightGap});
    });
    return {vw, sections: out.slice(0,40)};
  })())`;
  const res = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(res.result.value);
  chrome.kill();
  process.exit(0);
})();
