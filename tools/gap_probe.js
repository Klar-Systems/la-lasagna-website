const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9993;
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=1440,900','--no-first-run','--user-data-dir=/tmp/cdp-gp']);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:8080/who-we-are'});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{const vid=document.querySelector('section.page-section video');const vr=vid.getBoundingClientRect();
const sec0=document.querySelectorAll('section.page-section')[0];const s0=sec0.getBoundingClientRect();
const fe=sec0.querySelector('.fluid-engine');const fr=fe.getBoundingClientRect();
const footer=document.querySelectorAll('section.page-section')[1].getBoundingClientRect();
return {videoBottom:Math.round(vr.bottom),fluidEngineBottom:Math.round(fr.bottom),section0Bottom:Math.round(s0.bottom),footerTop:Math.round(footer.top),
  gap_video_to_feBottom:Math.round(fr.bottom-vr.bottom), gap_feBottom_to_sec0Bottom:Math.round(s0.bottom-fr.bottom)};})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
