const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,2600','--no-first-run',`--user-data-dir=/tmp/cdp-fc-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:'http://127.0.0.1:8080/contact'});await new Promise(r=>setTimeout(r,4500));
// the image block between 'Thank you' and 'book by calling us' (y~1708)
const e=`JSON.stringify((()=>{const blocks=[...document.querySelectorAll('.fe-block')].filter(b=>b.querySelector('img')).map(b=>{const r=b.getBoundingClientRect();return{cls:b.className,top:Math.round(r.top),feid:(b.className.match(/fe-block-[0-9a-zA-Z_]+/)||[])[0]};}).filter(b=>b.top>1500&&b.top<1900);return blocks;})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
