const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9980;const URL=process.argv[2];const W=+(process.argv[3]||390);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--window-size=${W},2400`,'--no-first-run','--user-data-dir=/tmp/cdp-os']);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');
if(W<500)await cdp('Emulation.setDeviceMetricsOverride',{width:W,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:URL});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{
  // collect text-bearing leaf blocks (headings, paragraphs) and detect overlaps between TEXT blocks of different fe-blocks
  const txt=[...document.querySelectorAll('.fe-block')].map(b=>{const r=b.getBoundingClientRect();const tt=(b.textContent||'').replace(/\\s+/g,' ').trim();return{id:(b.className.match(/fe-block-[0-9a-f]+/)||[])[0],t:tt.slice(0,28),top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right)};}).filter(b=>b.t.length>2&&b.bottom>b.top);
  const ov=[];
  for(let i=0;i<txt.length;i++)for(let j=i+1;j<txt.length;j++){const a=txt[i],b=txt[j];
    const vO=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);const hO=Math.min(a.right,b.right)-Math.max(a.left,b.left);
    if(vO>10&&hO>10){ov.push({a:a.t,b:b.t,vOverlap:vO,hOverlap:hO,at:a.top});}}
  return ov.slice(0,20);})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
