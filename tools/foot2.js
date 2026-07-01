const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,2600','--no-first-run',`--user-data-dir=/tmp/cdp-f2-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4500));
// find fe-blocks whose text is 'Opening hours...' and 'Service in languages'
const e=`JSON.stringify((()=>{const out={};[...document.querySelectorAll('.fe-block')].forEach(b=>{const tt=(b.textContent||'').replace(/\\s+/g,' ').trim();const fe=(b.className.match(/fe-block-[0-9a-zA-Z_]+/)||[])[0];const gr=getComputedStyle(b).gridRow;if(tt.startsWith('Opening hours')&&!out.opening)out.opening={fe,gr};if(tt.startsWith('Service in languages')&&!out.service)out.service={fe,gr};if(/^(Location)/.test(tt)&&!out.location)out.location={fe,gr};});return out;})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
