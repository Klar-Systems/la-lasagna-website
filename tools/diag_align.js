const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.argv[2] || 'http://127.0.0.1:8080/';
const PORT = 9223;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1440,900', '--no-first-run', '--user-data-dir=/tmp/cdp-diag', '--hide-scrollbars=false']);
const getJSON = (p) => new Promise((res, rej) => http.get(`http://127.0.0.1:${PORT}${p}`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error', rej));
(async () => {
  let target;
  for (let i=0;i<40;i++){ try{ const v=await getJSON('/json'); target=v.find(t=>t.type==='page'); if(target)break; }catch{} await new Promise(r=>setTimeout(r,250)); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id=0; const pending={};
  const cdp=(m,p)=>new Promise(res=>{const mid=++id;pending[mid]=res;ws.send(JSON.stringify({id:mid,method:m,params:p||{}}));});
  ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&pending[x.id]){pending[x.id](x.result);delete pending[x.id];}});
  await new Promise(r=>ws.on('open',r));
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Page.navigate',{url:URL}); await new Promise(r=>setTimeout(r,3500));
  const expr = `JSON.stringify((()=>{
    const de=document.documentElement, b=document.body;
    const sec=document.querySelector('section.page-section');
    const cs=sec?getComputedStyle(sec):{};
    const cw=sec?sec.querySelector('.content-wrapper'):null;
    const cwcs=cw?getComputedStyle(cw):{};
    return {
      innerW: window.innerWidth, clientW: de.clientWidth, bodyW: b.getBoundingClientRect().width,
      bodyLeft: Math.round(b.getBoundingClientRect().left),
      deScrollW: de.scrollWidth,
      bodyMarginL: getComputedStyle(b).marginLeft, bodyMarginR: getComputedStyle(b).marginRight,
      bodyPadL: getComputedStyle(b).paddingLeft, bodyPadR: getComputedStyle(b).paddingRight,
      secWidth: cs.width, secMarginL: cs.marginLeft, secMarginR: cs.marginRight, secPadL: cs.paddingLeft, secPadR: cs.paddingRight, secTransform: cs.transform,
      cwMaxW: cwcs.maxWidth, cwMarginL: cwcs.marginLeft, cwMarginR: cwcs.marginRight, cwPadL: cwcs.paddingLeft, cwPadR: cwcs.paddingRight
    };
  })())`;
  const res = await cdp('Runtime.evaluate',{expression:expr,returnByValue:true});
  console.log(res.result.value);
  chrome.kill(); process.exit(0);
})();
