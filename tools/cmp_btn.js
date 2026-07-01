const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,2600','--no-first-run',`--user-data-dir=/tmp/cdp-cmp-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{const lm=document.querySelector('.fe-block-1dfe7d7cffc243e71ef8 .sqs-block-button-element')||document.querySelector('.fe-block-1dfe7d7cffc243e71ef8 a');const ig=[...document.querySelectorAll('.sqs-block-button-element,a')].find(e=>/instagram/i.test((e.textContent||'').trim())&&(e.className||'').includes('button'));const g=e=>{if(!e)return 'NF';const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height),fs:cs.fontSize,pad:cs.padding,bg:cs.backgroundColor,color:cs.color,bw:cs.borderWidth,bc:cs.borderColor,rad:cs.borderRadius,cls:(e.className||'').toString().slice(0,50)};};return{learnMore:g(lm),instagram:g(ig)};})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
