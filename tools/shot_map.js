const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.argv[2] || 'http://127.0.0.1:8080/contact';
const OUT = process.argv[3] || '/tmp/map-shot.png';
const PORT = 9224;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1440,2200', '--no-first-run', '--user-data-dir=/tmp/cdp-shot']);
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
  await cdp('Page.navigate',{url:URL}); await new Promise(r=>setTimeout(r,4000));
  // scroll map into view & get its box
  const box = await cdp('Runtime.evaluate',{expression:`(()=>{const el=document.querySelector('.lala-map'); if(!el)return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return JSON.stringify({x:Math.max(0,r.left-40),y:Math.max(0,r.top-40),w:Math.min(1440,r.width+80),h:r.height+80});})()`,returnByValue:true});
  await new Promise(r=>setTimeout(r,800));
  let clip; try{ clip=JSON.parse(box.result.value); }catch{ clip=null; }
  if (clip) clip.h = Math.min(clip.h, 900);
  let shot = await cdp('Page.captureScreenshot', clip ? {clip:{...clip,scale:1}} : {captureBeyondViewport:false});
  if (!shot || !shot.data) { console.error('clip failed, full shot. box=',box.result.value); shot = await cdp('Page.captureScreenshot', {}); }
  fs.writeFileSync(OUT, Buffer.from(shot.data,'base64'));
  console.log('saved '+OUT+(clip?' (clipped to map)':' (full)'));
  chrome.kill(); process.exit(0);
})();
