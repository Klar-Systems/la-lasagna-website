const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,2600','--no-first-run',`--user-data-dir=/tmp/cdp-fp-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4500));
// footer section is the last page-section; list its text blocks top-to-bottom with gaps
const e=`JSON.stringify((()=>{const secs=[...document.querySelectorAll('section.page-section')];const f=secs[secs.length-1];
const blocks=[...f.querySelectorAll('.fe-block')].map(b=>{const r=b.getBoundingClientRect();const tt=(b.textContent||'').replace(/\\s+/g,' ').trim();return{t:tt.slice(0,22),top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height)};}).filter(b=>b.t.length>1&&b.h>8).sort((a,b)=>a.top-b.top);
const out=[];let prev=null;blocks.forEach(b=>{out.push({t:b.t,top:b.top,gapAbove: prev?b.top-prev:0});prev=b.bottom;});return out;})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
