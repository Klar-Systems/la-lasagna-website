const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9307;const URL=process.argv[2]||'http://127.0.0.1:8080/index';
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=1440,900','--no-first-run','--user-data-dir=/tmp/cdp-p3']);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.navigate',{url:URL});await new Promise(r=>setTimeout(r,4000));
// walk from section down, print each descendant's paddingTop/marginTop until we find the 291
const e=`JSON.stringify((()=>{const s=document.querySelector('section.page-section');const out=[];let el=s;for(let depth=0;depth<6&&el;depth++){const cs=getComputedStyle(el);out.push({d:depth,cls:(el.className||'').toString().slice(0,38),pt:cs.paddingTop,mt:cs.marginTop,disp:cs.display,align:cs.alignItems,justify:cs.justifyContent});el=[...el.children].find(c=>c.getBoundingClientRect().height>200);}return out;})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
