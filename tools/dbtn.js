const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=1440,900','--no-first-run',`--user-data-dir=/tmp/cdp-db-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4000));
const ids={Lasagnas:'3020aa3bb48429ac5465',Pizzas:'ba584fcc6a3fd51e5e88',Lunch:'715f4d8d7f2cd9f32556'};
const e=`JSON.stringify((()=>{const o={};${Object.entries(ids).map(([k,v])=>`{const el=document.querySelector('.fe-block-${v}');if(el){const r=el.getBoundingClientRect();o['${k}']={left:Math.round(r.left),top:Math.round(r.top),w:Math.round(r.width)};}}`).join('')}return o;})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log('DESKTOP '+r.result.value);c.kill();process.exit(0);})();
