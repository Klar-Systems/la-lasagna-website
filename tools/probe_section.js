const { spawn } = require('child_process');
const http = require('http'); const WebSocket = require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL=process.argv[2]; const SID=process.argv[3]; const PORT=+(process.argv[4]||9300);
const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=1440,900','--no-first-run',`--user-data-dir=/tmp/cdp-${PORT}`]);
const getJSON=p=>new Promise((res,rej)=>http.get(`http://127.0.0.1:${PORT}${p}`,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej));
(async()=>{
  let t;for(let i=0;i<40;i++){try{const v=await getJSON('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};
  const cdp=(m,pr)=>new Promise(res=>{const i=++id;p[i]=res;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
  ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});
  await new Promise(r=>ws.on('open',r));
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Page.navigate',{url:URL});await new Promise(r=>setTimeout(r,4500));
  const expr=`JSON.stringify((()=>{
    const s=[...document.querySelectorAll('section.page-section')].find(x=>(x.getAttribute('data-section-id')||'').endsWith('${SID}'));
    if(!s)return{err:'no section'};
    const fe=s.querySelector('.fluid-engine');
    const cs=getComputedStyle(s), cw=getComputedStyle(s.querySelector('.content-wrapper')||s);
    const fes=fe?getComputedStyle(fe):{};
    return {secMinH:cs.minHeight, secH:cs.height, secPadTop:cs.paddingTop, secPadBot:cs.paddingBottom,
      cwMinH:cw.minHeight, feMinH:fes.minHeight, feRows:fes.gridTemplateRows? fes.gridTemplateRows.split(' ').length:0, feRowGap:fes.rowGap};
  })())`;
  const res=await cdp('Runtime.evaluate',{expression:expr,returnByValue:true});
  console.log(res.result.value);chrome.kill();process.exit(0);
})();
