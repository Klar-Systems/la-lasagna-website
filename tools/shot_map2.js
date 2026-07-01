const { spawn } = require('child_process');
const http = require('http'); const WebSocket = require('ws'); const fs=require('fs');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT=9225;
const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=1440,900','--no-first-run','--user-data-dir=/tmp/cdp-shot2']);
const getJSON=p=>new Promise((res,rej)=>http.get(`http://127.0.0.1:${PORT}${p}`,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej));
(async()=>{
  let t; for(let i=0;i<40;i++){try{const v=await getJSON('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  const ws=new WebSocket(t.webSocketDebuggerUrl); let id=0;const p={};
  const cdp=(m,pr)=>new Promise(res=>{const i=++id;p[i]=res;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
  ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});
  await new Promise(r=>ws.on('open',r));
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4000));
  const box=await cdp('Runtime.evaluate',{expression:`(()=>{const el=document.querySelector('.lala-map');el.scrollIntoView({block:'center'});return new Promise(r=>setTimeout(()=>{const b=el.getBoundingClientRect();r(JSON.stringify({x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height)}));},400));})()`,returnByValue:true,awaitPromise:true});
  const c=JSON.parse(box.result.value);
  const shot=await cdp('Page.captureScreenshot',{clip:{x:c.x-10,y:Math.max(0,c.y-10),w:c.w+20,h:c.h+20,scale:2}});
  fs.writeFileSync('/tmp/map-crop.png',Buffer.from(shot.data,'base64'));
  console.log('saved /tmp/map-crop.png',JSON.stringify(c));
  chrome.kill();process.exit(0);
})();
