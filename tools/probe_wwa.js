const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9950;
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=1440,900','--no-first-run','--user-data-dir=/tmp/cdp-wwa']);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:8080/who-we-are'});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{const s=[...document.querySelectorAll('section.page-section')][0];const fe=s.querySelector('.fluid-engine');const fcs=getComputedStyle(fe);
// last child block bottom vs fe bottom
const blocks=[...fe.children].map(b=>{const r=b.getBoundingClientRect();const cs=getComputedStyle(b);return {cls:(b.className||'').toString().match(/fe-block-[0-9a-f]+/)?.[0]||'', bottom:Math.round(r.bottom), gridRow:cs.gridRow};}).sort((a,b)=>a.bottom-b.bottom);
const feR=fe.getBoundingClientRect();
return {feHeight:Math.round(feR.height), feRows:fcs.gridTemplateRows.split(' ').length, feMinH:fcs.minHeight, lastBlocks:blocks.slice(-4)};})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
