// Strong overlap detector: any two different fe-blocks whose visible boxes overlap
// significantly (excluding intentional parent/child & background layers).
const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL=process.argv[2];const W=+(process.argv[3]||390);const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--window-size=${W},2600`,'--no-first-run',`--user-data-dir=/tmp/cdp-o2-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');
if(W<500)await cdp('Emulation.setDeviceMetricsOverride',{width:W,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:URL});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{
  const bs=[...document.querySelectorAll('.fe-block')].map(b=>{const r=b.getBoundingClientRect();const tt=(b.textContent||'').replace(/\\s+/g,' ').trim();const m=b.querySelector('img,video,iframe');
    return{id:(b.className.match(/fe-block-[0-9a-f]+/)||[])[0],t:tt.slice(0,22),kind:m?m.tagName.toLowerCase():(tt?'text':'empty'),top:r.top,bottom:r.bottom,left:r.left,right:r.right,area:r.width*r.height};}).filter(b=>b.bottom>b.top&&b.right>b.left&&(b.right-b.left)>15);
  const out=[];
  for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];
    const vO=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);const hO=Math.min(a.right,b.right)-Math.max(a.left,b.left);
    if(vO<=6||hO<=6)continue;
    const inter=vO*hO;const minA=Math.min(a.area,b.area);
    // ignore tiny grazes; flag when overlap covers >25% of the smaller block
    if(inter/minA>0.25){out.push({a:a.t||a.kind,aid:a.id,ak:a.kind,b:b.t||b.kind,bid:b.id,bk:b.kind,pct:Math.round(100*inter/minA),at:Math.round(a.top)});}}
  out.sort((x,y)=>x.at-y.at);return out.slice(0,25);})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
