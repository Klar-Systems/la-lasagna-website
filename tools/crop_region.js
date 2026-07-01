const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');const fs=require('fs');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL=process.argv[2];const SEL=process.argv[3];const OUT=process.argv[4];const PORT=+(process.argv[5]||9973);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,2400','--no-first-run','--user-data-dir=/tmp/cdp-cr'+PORT]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:URL});await new Promise(r=>setTimeout(r,4500));
const box=await cdp('Runtime.evaluate',{expression:`(()=>{const el=document.querySelector('${SEL}');if(!el)return null;el.scrollIntoView({block:'center'});return new Promise(r=>setTimeout(()=>{const b=el.getBoundingClientRect();r(JSON.stringify({x:0,y:Math.max(0,b.top-60),w:390,h:Math.min(700,b.height+200)}));},500));})()`,returnByValue:true,awaitPromise:true});
let clip;try{clip=JSON.parse(box.result.value);}catch{clip=null;}
const shot=await cdp('Page.captureScreenshot',clip?{clip:{...clip,scale:2}}:{captureBeyondViewport:true});
fs.writeFileSync(OUT,Buffer.from(shot.data,'base64'));console.log('saved '+OUT+(clip?'':' (full)'));c.kill();process.exit(0);})();
