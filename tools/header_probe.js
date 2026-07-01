const{spawn}=require('child_process');const http=require('http');const WebSocket=require('ws');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';const PORT=9000+(process.pid%900);
const c=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--window-size=390,1400','--no-first-run',`--user-data-dir=/tmp/cdp-hp-${PORT}`]);
const gj=p=>new Promise((r,j)=>http.get(`http://127.0.0.1:${PORT}${p}`,x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>r(JSON.parse(d)));}).on('error',j));
(async()=>{let t;for(let i=0;i<60;i++){try{const v=await gj('/json');t=v.find(x=>x.type==='page');if(t)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};const cdp=(m,pr)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pr||{}}));});
ws.on('message',m=>{const x=JSON.parse(m);if(x.id&&p[x.id]){p[x.id](x.result);delete p[x.id];}});await new Promise(r=>ws.on('open',r));
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cdp('Page.navigate',{url:'http://127.0.0.1:8080/index'});await new Promise(r=>setTimeout(r,4500));
const e=`JSON.stringify((()=>{
  const pick=(sel)=>{const el=document.querySelector(sel);if(!el)return null;const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return{sel,top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height),pos:cs.position,z:cs.zIndex};};
  const header=pick('header')||pick('.header')||pick('#header')||pick('.Header');
  const burger=pick('.burger')||pick('.Burger')||pick('[aria-label*=menu i]')||pick('.header-menu-icon')||pick('.header-burger');
  const logo=pick('.header-title')||pick('.Header-branding')||pick('.header-title-logo')||pick('a[href*="index"] img');
  // hero section + its background image
  const hero=document.querySelector('section.page-section');const hr=hero.getBoundingClientRect();const hcs=getComputedStyle(hero);
  const bg=hero.querySelector('.section-background img, .section-background');const br=bg?bg.getBoundingClientRect():null;
  return{header,burger,logo,hero:{top:Math.round(hr.top),h:Math.round(hr.height),pt:hcs.paddingTop},heroBg:br?{top:Math.round(br.top),h:Math.round(br.height)}:null};
})())`;
const r=await cdp('Runtime.evaluate',{expression:e,returnByValue:true});console.log(r.result.value);c.kill();process.exit(0);})();
