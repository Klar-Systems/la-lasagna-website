const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9971;
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=1440,900','--no-first-run','--user-data-dir=/tmp/cdp-rev']);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{const s=[...document.querySelectorAll('section')].find(x=>(x.getAttribute('data-section-id')||'').endsWith('7d7058'));
if(!s)return{err:1};const sr=s.getBoundingClientRect();
const blocks=[...s.querySelectorAll('.fe-block')].map(b=>{const r=b.getBoundingClientRect();const img=b.querySelector('img');const txt=(b.textContent||'').trim().slice(0,20);return{id:(b.className.match(/fe-block-[0-9a-f]+/)||[])[0],hasImg:!!img,txt,x:Math.round(r.left),y:Math.round(r.top-sr.top),w:Math.round(r.width),h:Math.round(r.height)};}).filter(b=>b.w>20&&b.h>20);
return {secH:Math.round(sr.height), blocks};})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
