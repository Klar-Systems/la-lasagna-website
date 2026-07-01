// Mobile/desktop layout audit for one page. Usage: node tools/audit.js <url> <width>
// Prints JSON: per fe-block geometry + detected text-overlaps + cramped (narrow) text blocks + big voids.
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.argv[2];
const W = +(process.argv[3] || 390);
const PORT = 9000 + (process.pid % 900);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},2400`, '--no-first-run', `--user-data-dir=/tmp/cdp-audit-${PORT}`]);
const getJSON = (p) => new Promise((res, rej) => http.get(`http://127.0.0.1:${PORT}${p}`, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error', rej));
(async () => {
  let t;
  for (let i=0;i<60;i++){ try{ const v=await getJSON('/json'); t=v.find(x=>x.type==='page'); if(t)break; }catch{} await new Promise(r=>setTimeout(r,250)); }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id=0; const p={};
  const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
  ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});
  await new Promise(r=>ws.on('open',r));
  await cdp('Page.enable'); await cdp('Runtime.enable');
  if (W < 500) await cdp('Emulation.setDeviceMetricsOverride',{width:W,height:844,deviceScaleFactor:2,mobile:true});
  await cdp('Page.navigate',{url:URL}); await new Promise(r=>setTimeout(r,4500));
  const expr = `JSON.stringify((()=>{
    const vw=${W};
    const blocks=[...document.querySelectorAll('.fe-block')].map(b=>{
      const r=b.getBoundingClientRect();
      const tt=(b.textContent||'').replace(/\\s+/g,' ').trim();
      const media=b.querySelector('img,video,iframe');
      return {id:(b.className.match(/fe-block-[0-9a-f]+/)||[])[0], kind: media?media.tagName.toLowerCase():(tt?'text':'empty'), t:tt.slice(0,30), top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),w:Math.round(r.width),h:Math.round(r.height)};
    }).filter(b=>b.w>8&&b.h>8);
    // text overlaps (different blocks, both text, real visual overlap), below hero
    const txt=blocks.filter(b=>b.kind==='text');
    const overlaps=[];
    for(let i=0;i<txt.length;i++)for(let j=i+1;j<txt.length;j++){const a=txt[i],bb=txt[j];const vO=Math.min(a.bottom,bb.bottom)-Math.max(a.top,bb.top);const hO=Math.min(a.right,bb.right)-Math.max(a.left,bb.left);if(vO>14&&hO>30&&a.top>900)overlaps.push({a:a.t,aid:a.id,b:bb.t,bid:bb.id,vO,hO,at:a.top});}
    // cramped text: narrow width relative to viewport (likely stuck in a column) on mobile
    const cramped = vw<500 ? txt.filter(b=>b.w<vw*0.62 && b.h>40 && b.top>900).map(b=>({id:b.id,t:b.t,w:b.w,left:b.left})) : [];
    // big voids: sections far taller than their content
    const secs=[...document.querySelectorAll('section.page-section')].map(s=>{const r=s.getBoundingClientRect();let tp=Infinity,bt=-Infinity;s.querySelectorAll('.fe-block').forEach(e=>{const er=e.getBoundingClientRect();const et=(e.textContent||'').trim();if(er.height>10&&(et||e.querySelector('img,video,iframe'))){tp=Math.min(tp,er.top);bt=Math.max(bt,er.bottom);}});const contentH=(bt>tp)?bt-tp:0;return {sid:(s.getAttribute('data-section-id')||'').slice(-6),secH:Math.round(r.height),contentH:Math.round(contentH),void:Math.round(r.height-contentH)};});
    return {vw, docScrollW:document.documentElement.scrollWidth, overlaps:overlaps.slice(0,12), cramped:cramped.slice(0,12), voids:secs.filter(s=>s.void>200)};
  })())`;
  const res = await cdp('Runtime.evaluate',{expression:expr,returnByValue:true});
  console.log(res.result.value);
  chrome.kill(); process.exit(0);
})();
