const { spawn } = require('child_process');
const http = require('http'); const WebSocket = require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL=process.argv[2]; const PORT=+(process.argv[3]||9240);
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
  // For each section, collect leaf visible elements' vertical spans, find biggest gap between them
  const expr=`JSON.stringify([...document.querySelectorAll('section.page-section')].map(s=>{
    const sid=(s.getAttribute('data-section-id')||'').slice(-6);
    const sr=s.getBoundingClientRect();
    const leaves=[...s.querySelectorAll('*')].filter(e=>e.children.length===0 || e.tagName==='IMG'||e.tagName==='VIDEO'||e.tagName==='IFRAME');
    const spans=[];
    leaves.forEach(e=>{const r=e.getBoundingClientRect(); const txt=(e.textContent||'').trim(); if(r.width>8&&r.height>8&&(txt.length>0||['IMG','VIDEO','IFRAME','SVG'].includes(e.tagName))) spans.push([r.top,r.bottom]);});
    spans.sort((a,b)=>a[0]-b[0]);
    // merge & find largest vertical gap
    let maxGap=0, gapAt=0, cur=spans.length?spans[0][1]:sr.top;
    spans.forEach(([tp,bt])=>{ if(tp-cur>maxGap){maxGap=tp-cur;gapAt=Math.round(cur);} cur=Math.max(cur,bt); });
    // also top gap (section top -> first content) and bottom gap
    const topGap = spans.length? Math.round(spans[0][0]-sr.top):0;
    const botGap = spans.length? Math.round(sr.bottom-spans[spans.length-1][1]):0;
    return {sid, secH:Math.round(sr.height), maxInnerGap:Math.round(maxGap), gapAt, topGap, botGap};
  }))`;
  const res=await cdp('Runtime.evaluate',{expression:expr,returnByValue:true});
  console.log(res.result.value);chrome.kill();process.exit(0);
})();
