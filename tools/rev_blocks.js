const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);const W=+(process.argv[2]||1440);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--window-size=${W},1400`,'--no-first-run',`--user-data-dir=/tmp/cdp-rb-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');if(W<500)await cdp('Emulation.setDeviceMetricsOverride',{width:W,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify([...document.querySelectorAll('section[data-section-id$="7d7058"] .fe-block')].map(b=>{const r=b.getBoundingClientRect();const img=b.querySelector('img');const tt=(b.textContent||'').replace(/\\s+/g,' ').trim();return{id:(b.className.match(/fe-block-[0-9a-f]+/)||[])[0],kind:img?'img':(tt?'text':'empty'),src:img?(img.currentSrc||img.src||'').split('/').pop().slice(0,24):'',t:tt.slice(0,14),l:Math.round(r.left),t2:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};}).filter(b=>b.w>10))`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
