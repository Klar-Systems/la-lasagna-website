const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9996;const URL=process.argv[2];
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,2400','--no-first-run','--user-data-dir=/tmp/cdp-mp']);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<40;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:URL});await new Promise(r=>setTimeout(r,4000));
const e=`JSON.stringify((()=>{const h=document.querySelector('.fe-block-916612e5e07cbc8f0eba');const ph=document.querySelector('.fe-block-523cda3f8fca79c5cf2b');const tel=document.querySelector('.lala-tel');
const hr=h?h.getBoundingClientRect():null;const pr=ph?ph.getBoundingClientRect():null;const tr=tel?tel.getBoundingClientRect():null;
return {heading:hr?{top:Math.round(hr.top),bottom:Math.round(hr.bottom)}:null, phoneBlock:pr?{top:Math.round(pr.top),bottom:Math.round(pr.bottom)}:null, tel:tr?{top:Math.round(tr.top),bottom:Math.round(tr.bottom),w:Math.round(tr.width)}:null, overlap: (hr&&pr)? Math.round(hr.bottom-pr.top):null};})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
