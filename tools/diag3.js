const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,2600','--no-first-run',`--user-data-dir=/tmp/cdp-d3-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{
  // spritz image inside its full-bleed block
  const sb=document.querySelector('.fe-block-132feefd1e18d9420227');
  const simg=sb?sb.querySelector('img'):null;
  const sr=simg?simg.getBoundingClientRect():null;
  // learn more button styling
  const lm=document.querySelector('.fe-block-1dfe7d7cffc243e71ef8 a')||document.querySelector('.fe-block-1dfe7d7cffc243e71ef8 .sqs-block-button-element');
  const lmcs=lm?getComputedStyle(lm):null;
  // phone tel button
  const tel=document.querySelector('.lala-tel');
  const tcs=tel?getComputedStyle(tel):null;
  return {
    spritzImg: sr?{left:Math.round(sr.left),w:Math.round(sr.width)}:null,
    learnMore: lmcs?{bg:lmcs.backgroundColor,color:lmcs.color,border:lmcs.borderColor,radius:lmcs.borderRadius}:'NOT FOUND',
    phoneTel: tcs?{bg:tcs.backgroundColor,color:tcs.color,border:tcs.borderColor,radius:tcs.borderRadius}:'NOT FOUND (contact page only)'
  };
})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
