const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9952;
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=1440,900','--no-first-run','--user-data-dir=/tmp/cdp-vid']);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:8080/who-we-are'});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{const vids=[...document.querySelectorAll('section.page-section video, section.page-section .sqs-block-video, section.page-section .fluid-image-container, section.page-section iframe')];return vids.map(v=>{const r=v.getBoundingClientRect();const blk=v.closest('.fe-block');const br=blk?blk.getBoundingClientRect():null;return {tag:v.tagName,vidH:Math.round(r.height),vidW:Math.round(r.width),blockId:(blk&&(blk.className||'').toString().match(/fe-block-[0-9a-f]+/)?.[0])||'?',blockH:br?Math.round(br.height):0,gridRow:blk?getComputedStyle(blk).gridRow:''};});})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
