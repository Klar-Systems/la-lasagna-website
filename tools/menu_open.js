const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');const fs=require('fs');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,1400','--no-first-run',`--user-data-dir=/tmp/cdp-mo-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4500));
// open the menu
await cdp('Runtime.evaluate',{expression:`document.body.classList.add('header--menu-open');var b=document.querySelector('.header-burger-btn,.header-menu-icon,[data-test=header-burger]');if(b)b.click();`});await new Promise(r=>setTimeout(r,600));
const e=`JSON.stringify((()=>{const navItem=document.querySelector('.header-menu-nav-item a');const lang=document.querySelector('.language-picker-mobile a');const g=e=>{if(!e)return null;const cs=getComputedStyle(e);return{pad:cs.padding,bg:cs.backgroundColor,disp:cs.display,fs:cs.fontSize,jc:cs.justifyContent};};return{navItem:g(navItem),langItem:g(lang)};})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
