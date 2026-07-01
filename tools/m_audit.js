const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9972;const URL=process.argv[2];
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,2400','--no-first-run','--user-data-dir=/tmp/cdp-ma']);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:URL});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{const vw=390;
// suppliers section logos
const sup=[...document.querySelectorAll('section[data-section-id="6989e82883d7eb240f7d7052"] .fe-block')].map(b=>{const r=b.getBoundingClientRect();const img=b.querySelector('img');return img?{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),offRight:Math.round(r.right-vw)}:null;}).filter(Boolean);
// any element overflowing viewport horizontally
const overflow=[...document.querySelectorAll('section *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>vw+2&&r.width>30&&r.width<vw*3;}).slice(0,8).map(e=>({cls:(e.className||'').toString().slice(0,30),right:Math.round(e.getBoundingClientRect().right)}));
return {docScrollW:document.documentElement.scrollWidth, vw, supplierLogos:sup, overflowing:overflow};})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
