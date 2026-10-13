'use strict';
/* ================= Kerf Studio · CAM: toolpaths, G-code, parsing, preview ================= */
let camDirty=true,lastWarn=[],camSel=null;
const P={text:'',lines:[],moves:[],total:0,t:0,playing:false,rate:20,mode:'2d',colorBy:'layer',rapids:true,ghost:true,yaw:-.65,pitch:.95,sc:1.2,panX:0,panY:0,laser:true,stats:null,file:null,follow:true,curLine:-1,layers:[],_acc:'#f0a43a'};
const usedLayers=(plate)=>{const u=new Set(S.shapes.filter(s=>plate==null||plateOf(s)===plate).map(s=>s.layer));return S.order.filter(i=>u.has(i)).map(i=>S.layers[i])};

function hatch(paths,step,angDeg){
 if(!paths.length)return[];
 const a=-angDeg*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);const R=paths.map(p=>p.map(([x,y])=>[x*ca-y*sa,x*sa+y*ca]));
 const b=bboxOf(R);step=Math.max(step,(b[3]-b[1])/20000);const segs=[];let dir=0;
 for(let y=b[1]+step/2;y<b[3];y+=step){const xs=[];for(const p of R){const n=p.length;for(let i=0;i<n;i++){const A=p[i],B=p[(i+1)%n];if((A[1]<=y&&B[1]>y)||(B[1]<=y&&A[1]>y))xs.push(A[0]+(y-A[1])/(B[1]-A[1])*(B[0]-A[0]))}}
  if(xs.length<2)continue;xs.sort((u,v)=>u-v);let row=[];for(let k=0;k+1<xs.length;k+=2)if(xs[k+1]-xs[k]>1e-4)row.push([xs[k],xs[k+1]]);if(!row.length)continue;
  if(dir){row=row.reverse().map(([u,v])=>[v,u])}dir^=1;for(const[u,v]of row)segs.push([[u,y],[v,y]])}
 const back=([x,y])=>[x*ca+y*sa,-x*sa+y*ca];return segs.map(([p,q])=>[back(p),back(q)]);
}
function orderPaths(items,start,innerFirst){
 const it=items.map(o=>({...o,b:bboxOf([o.p])}));
 for(const o of it){o.depth=0;if(innerFirst&&o.closed)for(const q of it)if(q!==o&&q.closed&&q.b[0]<=o.b[0]&&q.b[1]<=o.b[1]&&q.b[2]>=o.b[2]&&q.b[3]>=o.b[3]&&(q.b[2]-q.b[0])*(q.b[3]-q.b[1])>(o.b[2]-o.b[0])*(o.b[3]-o.b[1]))o.depth++}
 const groups=[...new Set(it.map(o=>o.depth))].sort((a,b)=>b-a),res=[];let cur=start;
 for(const g of groups){const pool=it.filter(o=>o.depth===g);
  while(pool.length){let best=0,bi=0,bd=Infinity,rev=false;
   for(let i=0;i<pool.length;i++){const o=pool[i];if(o.closed){const st=Math.max(1,Math.floor(o.p.length/64));for(let k=0;k<o.p.length;k+=st){const d=Math.hypot(o.p[k][0]-cur[0],o.p[k][1]-cur[1]);if(d<bd){bd=d;best=i;bi=k;rev=false}}}
    else{const d0=Math.hypot(o.p[0][0]-cur[0],o.p[0][1]-cur[1]),d1=Math.hypot(o.p[o.p.length-1][0]-cur[0],o.p[o.p.length-1][1]-cur[1]);if(d0<bd){bd=d0;best=i;rev=false;bi=0}if(d1<bd){bd=d1;best=i;rev=true;bi=0}}}
   const o=pool.splice(best,1)[0];let p=o.p;if(o.closed&&bi)p=p.slice(bi).concat(p.slice(0,bi));if(rev)p=[...p].reverse();res.push({...o,p});cur=o.closed?p[0]:p[p.length-1]}}
 return res;
}
// walk a polyline, splitting at tab boundaries; emit(x,y,inTab) for each piece end
function walkTabs(pts,count,width,emit){
 const tot=pathLen(pts,false);if(!count||tot<=0){for(let i=1;i<pts.length;i++)emit(pts[i][0],pts[i][1],false);return}
 const sp=tot/count,half=width/2,bps=[];for(let k=0;k<count;k++){const c=sp*(k+.5);bps.push(c-half,c+half)}
 const inTab=s=>Math.abs(((s%sp)+sp)%sp-sp/2)<half;let s=0;
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-9)continue;
  const cuts=bps.filter(q=>q>s+1e-9&&q<s+len-1e-9).sort((u,v)=>u-v);cuts.push(s+len);let prev=s;
  for(const c of cuts){const t=(c-s)/len;emit(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,inTab((prev+c)/2));prev=c}s+=len}
}

function genGcode(plate){
 const m=S.machine,laser=m.type==='laser',out=[],warn=[],n3=v=>String(fx(v,3)),OX=plateX(plate);
 const shapes=S.shapes.filter(s=>plateOf(s)===plate).map(s=>({...s,paths:mapPaths(s.paths,(x,y)=>[x-OX,y])}));
 let cx=0,cy=0,cz=null,cf=null,cs=null;
 const G0=(x,y,z)=>{let s='G0';if(x!=null&&fx(x,3)!==fx(cx,3)){s+=' X'+n3(x);cx=x}if(y!=null&&fx(y,3)!==fx(cy,3)){s+=' Y'+n3(y);cy=y}if(z!=null&&(cz==null||fx(z,3)!==fx(cz,3))){s+=' Z'+n3(z);cz=z}if(s!=='G0')out.push(s)};
 const G1=(x,y,z,f,sp)=>{let s='G1',mv=false;if(x!=null&&fx(x,3)!==fx(cx,3)){s+=' X'+n3(x);cx=x;mv=true}if(y!=null&&fx(y,3)!==fx(cy,3)){s+=' Y'+n3(y);cy=y;mv=true}if(z!=null&&(cz==null||fx(z,3)!==fx(cz,3))){s+=' Z'+n3(z);cz=z;mv=true}
  if(!mv)return;if(f!=null&&f!==cf){s+=' F'+Math.round(f);cf=f}if(sp!=null&&sp!==cs){s+=' S'+Math.round(sp);cs=sp}out.push(s)};
 out.push(`; Kerf Studio — ${m.name} (${laser?'laser':'cnc'})`,`; ${T('Лист','Sheet')} ${plate+1}/${S.plates} · ${matName(curMat(),S.sheet.thick)}`,`; ${T('Создано','Generated')} ${new Date().toISOString().slice(0,16).replace('T',' ')}`,'G21 ; mm','G90 ; absolute');
 if(!laser)out.push('G17');
 for(const l of(S.job.header||'').split('\n'))if(l.trim())out.push(l.trim());
 if(shapes.length){const bb=bboxOf(shapes.flatMap(s=>s.paths));if(bb[0]<-.01||bb[1]<-.01||bb[2]>m.w+.01||bb[3]>m.h+.01)warn.push(T('Часть объектов выходит за рабочее поле станка.','Some objects extend beyond the machine work area.'))}
 if(laser){out.push('M4 S0 ; dynamic laser power');cs=0}else{out.push(`G0 Z${m.safeZ}`);cz=m.safeZ}
 let spindle=null;
 for(const L of usedLayers(plate)){if(!L.on||!L.out)continue;const ls=shapes.filter(s=>s.layer===L.id);if(!ls.length)continue;
  out.push(`;LAYER ${layerName(L).replace(/\s+/g,'_')} ${L.color}`);
  if(laser){const l=L.laser,groups=new Map();
   for(const s of ls){const k=s.ov?`${s.ov.power}|${s.ov.speed}`:'_';(groups.get(k)||groups.set(k,[]).get(k)).push(s)}
   if(l.air)out.push('M8');
   for(const[k,list]of groups){const pwP=k==='_'?l.power:list[0].ov.power,spd=Math.max(1,k==='_'?l.speed:list[0].ov.speed),pw=Math.round(clamp(pwP,0,100)/100*m.smax);
    const vec=list.filter(s=>s.kind!=='image'),imgs=list.filter(s=>s.kind==='image');
    for(let pass=0;pass<Math.max(1,l.passes|0);pass++){
     for(const s of imgs)raster(s,l,pw,spd);
     if(l.mode!=='line'){const closed=vec.filter(s=>s.closed).flatMap(s=>s.paths);if(!closed.length&&vec.length&&!pass)warn.push(T(`Слой «${layerName(L)}»: заливка возможна только для замкнутых фигур.`,`Layer “${layerName(L)}”: fill needs closed shapes.`));
      for(const[a,b]of hatch(closed,Math.max(.02,l.interval),l.angle)){G0(a[0],a[1]);G1(b[0],b[1],null,spd,pw)}}
     if(l.mode!=='fill'){const items=[];for(const s of vec){let ps=s.paths;if(s.closed&&l.kerf>0)ps=offsetPaths(s.paths,l.kerf/2,'miter');for(const p of ps)items.push({p,closed:s.closed})}
      for(const o of orderPaths(items,[cx,cy],S.job.innerFirst)){G0(o.p[0][0],o.p[0][1]);const pts=o.closed?o.p.concat([o.p[0]]):o.p;
       walkTabs(pts,o.closed?(l.bridges|0):0,l.bridgeW,(x,y,tb)=>G1(x,y,null,spd,tb?0:pw))}}}}
   if(l.air)out.push('M9');
  }else{const c=L.cnc,r=Math.max(.01,c.tool)/2,safe=m.safeZ,levels=[];let z=0;const dep=Math.max(.01,c.depth),stp=Math.max(.01,c.step);while(z>-dep+1e-6){z=Math.max(z-stp,-dep);levels.push(z)}
   if(dep>S.sheet.thick+.5)warn.push(T(`Слой «${layerName(L)}»: глубина ${dep} мм больше толщины заготовки ${S.sheet.thick} мм.`,`Layer “${layerName(L)}”: depth ${dep} mm exceeds stock ${S.sheet.thick} mm.`));
   if(spindle!==c.rpm){out.push(`M3 S${Math.round(c.rpm)}`);if(spindle==null)out.push('G4 P2 ; spin up');spindle=c.rpm}
   const retract=()=>G0(null,null,safe),vec=ls.filter(s=>s.kind!=='image');
   if(ls.length>vec.length&&!warn.some(w=>w.includes('фото')||w.includes('photo')))warn.push(T('Фото пропущены: для фрезера используйте трассировку или многослойную картину.','Photos skipped: for a router, trace them or use a layered picture.'));
   const cutLoop=(p,zz,closed,tabZ)=>{const pts=closed?p.concat([p[0]]):p;
    if(tabZ==null){for(let i=1;i<pts.length;i++)G1(pts[i][0],pts[i][1],zz,c.feed);return}
    let curZ=zz;walkTabs(pts,c.tabs,c.tabW+c.tool,(x,y,tb)=>{const want=tb?Math.max(zz,tabZ):zz;if(want!==curZ){G1(null,null,want,c.plunge);curZ=want}G1(x,y,want,c.feed)});if(curZ!==zz)G1(null,null,zz,c.plunge)};
   const op=c.op;
   if(op==='drill'){for(const s of vec){const b=bboxOf(s.paths),x=(b[0]+b[2])/2,y=(b[1]+b[3])/2;retract();G0(x,y);for(const zz of levels){G1(null,null,zz,c.plunge);G0(null,null,.5)}retract()}}
   else if(op==='pocket'){
    for(const s of vec.filter(s=>s.closed)){let rings=[];
     if(hasClip()){let d=-r;for(let g=0;g<800;g++){const o=offsetPaths(s.paths,d);if(!o.length)break;rings.push(o);d-=c.tool*clamp(c.stepover,5,95)/100}rings.reverse()}
     if(!rings.length&&hasClip()){warn.push(T(`Слой «${layerName(L)}»: фреза ⌀${c.tool} не помещается в карман.`,`Layer “${layerName(L)}”: the ⌀${c.tool} tool does not fit the pocket.`));continue}
     let prev=0;for(const zz of levels){const clear=Math.min(safe,prev+.5);
      if(hasClip()){for(const ring of rings)for(const p of ring){G0(null,null,clear);G0(p[0][0],p[0][1]);G1(null,null,zz,c.plunge);cutLoop(p,zz,true,null)}}
      else{const inner=s.paths.map(p=>missOffset(p,-r)).filter(Boolean);for(const[a,b]of hatch(inner,c.tool*c.stepover/100,0)){G0(null,null,clear);G0(a[0],a[1]);G1(null,null,zz,c.plunge);G1(b[0],b[1],zz,c.feed)}}
      prev=zz}retract()}}
   else if(op==='vcarve'){const ang=clamp(c.vangle||90,20,150)*Math.PI/180,tn=Math.tan(ang/2),st=Math.max(.05,c.vstep||.25);
    for(const s of vec.filter(s=>s.closed)){let d=st/2;const rings=[];for(let g=0;g<1000;g++){const o=offsetPaths(s.paths,-d);if(!o.length)break;rings.push({d,o});d+=st}
     for(const rg of rings){const zt=-Math.min(rg.d/tn,dep);for(const p of rg.o){G0(null,null,1);G0(p[0][0],p[0][1]);let zz=0;while(zz>zt+1e-6){zz=Math.max(zz-stp,zt);G1(null,null,zz,c.plunge);cutLoop(p,zz,true,null)}}}retract()}}
   else{const items=[];for(const s of vec){if(!s.closed||op==='on'||op==='engrave'){for(const p of s.paths)items.push({p,closed:s.closed});continue}
     const off=offsetPaths(s.paths,op==='out'?r:-r);if(!off.length){warn.push(T(`Слой «${layerName(L)}»: фреза больше внутреннего контура #${s.id}.`,`Layer “${layerName(L)}”: tool is larger than inner contour #${s.id}.`));continue}for(const p of off)items.push({p,closed:true,tabs:true})}
    const tabZ=-(dep-Math.min(c.tabH,dep));
    for(const o of orderPaths(items,[cx,cy],S.job.innerFirst)){retract();G0(o.p[0][0],o.p[0][1]);
     for(const zz of levels){if(!o.closed&&zz!==levels[0]){retract();G0(o.p[0][0],o.p[0][1])}G1(null,null,zz,c.plunge);cutLoop(o.p,zz,o.closed,(o.tabs&&c.tabs>0&&zz<tabZ-1e-6)?tabZ:null)}retract()}}
  }}
 if(laser)out.push('M5 S0','G0 X0 Y0');else out.push(`G0 Z${m.safeZ}`,'M5','G0 X0 Y0');
 for(const l of(S.job.footer||'').split('\n'))if(l.trim())out.push(l.trim());
 out.push('M2');
 return{text:out.join('\n'),warn};

 function raster(s,l,pwMax,spd){
  const b=bboxOf(s.paths),wmm=b[2]-b[0],hmm=b[3]-b[1],iv=Math.max(.02,l.interval);let pw=Math.round(wmm/iv),ph=Math.round(hmm/iv);
  if(pw*ph>4e6){const k=Math.sqrt(4e6/(pw*ph));pw=Math.floor(pw*k);ph=Math.floor(ph*k);warn.push(T('Фото уменьшено до 4 Мпикс для гравировки — увеличьте шаг строк.','Photo reduced to 4 Mpx for engraving — increase the line interval.'))}
  const data=processImage(s,pw,ph);if(!data){warn.push(T('Фото ещё загружается — нажмите «Рассчитать» ещё раз.','The photo is still loading — press Generate again.'));return}
  const px=wmm/pw,ry=hmm/ph,gray=s.img.mode==='gray',minP=(l.minPower||0)/100*m.smax,os=l.overscan||0;let dir=1;
  const sval=v=>gray?(v<4?0:Math.round(minP+(pwMax-minP)*v/255)):(v>127?pwMax:0);
  for(let r=0;r<ph;r++){const y=b[3]-(r+.5)*ry,row=r*pw;let f=-1,la=-1;for(let x=0;x<pw;x++)if(sval(data[row+x])>0){if(f<0)f=x;la=x}if(f<0)continue;
   const runs=[];let x=f;while(x<=la){const v=sval(data[row+x]);let e=x;while(e+1<=la&&sval(data[row+e+1])===v)e++;runs.push([x,e,v]);x=e+1}
   if(dir>0){G0(b[0]+f*px-os,y);G1(b[0]+f*px,y,null,spd,0);for(const[x0,x1,v]of runs)G1(b[0]+(x1+1)*px,y,null,spd,v);G1(b[0]+(la+1)*px+os,y,null,spd,0)}
   else{G0(b[0]+(la+1)*px+os,y);G1(b[0]+(la+1)*px,y,null,spd,0);for(let i=runs.length-1;i>=0;i--){const[x0,,v]=runs[i];G1(b[0]+x0*px,y,null,spd,v)}G1(b[0]+f*px-os,y,null,spd,0)}
   if(l.bidir!==false)dir=-dir}
 }
}
function ensureCam(){if(!camDirty||P.file)return;camDirty=false;const g=genGcode(curPlate);lastWarn=g.warn;loadGcode(g.text,null,true)}

/* ---------- G-code parsing ---------- */
function loadGcode(text,file,keepT){
 P.text=text;P.file=file;P.lines=text.split(/\r?\n/);P.laser=file?!/\bZ\s*-\s*\.?\d/i.test(text):S.machine.type==='laser';
 const mv=[],layers=[];let x=0,y=0,z=P.laser?0:S.machine.safeZ,f=1000,s=0,abs=true,inch=false,on=false,col=null,mode=0,t=0,cut=0,rap=0;
 const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],rapid=S.machine.rapid||3000;let minF=Infinity,maxF=0;
 const push=(nx,ny,nz,i)=>{const d=Math.hypot(nx-x,ny-y,nz-z);if(d<1e-9){x=nx;y=ny;z=nz;return}const r=mode===0,feed=r?rapid:Math.max(1,f);
  const c=!r&&(P.laser?(on&&s>0):(Math.min(z,nz)<-1e-4));const dt=d/feed*60;
  mv.push({a:[x,y,z],b:[nx,ny,nz],r,c,f:feed,s,l:i,col,t0:t,t1:t+dt});t+=dt;if(c){cut+=d;minF=Math.min(minF,feed);maxF=Math.max(maxF,feed);for(const q of[[x,y,z],[nx,ny,nz]]){for(let k=0;k<3;k++){b[k]=Math.min(b[k],q[k]);b[k+3]=Math.max(b[k+3],q[k])}}}else rap+=d;x=nx;y=ny;z=nz};
 for(let i=0;i<P.lines.length;i++){const raw=P.lines[i];
  const lm=/^\s*;\s*LAYER\s+(\S+)\s+(#[0-9a-fA-F]{6})/.exec(raw);if(lm){col=lm[2];layers.push({name:lm[1].replace(/_/g,' '),color:col});continue}
  const ln=raw.replace(/\(.*?\)/g,'').replace(/;.*/,'').toUpperCase();if(!ln.trim())continue;
  let nx=null,ny=null,nz=null,I=0,J=0,Rr=null;
  for(const mm of ln.matchAll(/([A-Z])\s*([-+]?\d*\.?\d+)/g)){const w=mm[1],v=parseFloat(mm[2]);
   if(w==='G'){if(v===0||v===1||v===2||v===3)mode=v;else if(v===90)abs=true;else if(v===91)abs=false;else if(v===20)inch=true;else if(v===21)inch=false}
   else if(w==='M'){if(v===3||v===4)on=true;else if(v===5)on=false}
   else if(w==='X')nx=v;else if(w==='Y')ny=v;else if(w==='Z')nz=v;else if(w==='F')f=v*(inch?25.4:1);else if(w==='S')s=v;else if(w==='I')I=v;else if(w==='J')J=v;else if(w==='R')Rr=v}
  if(nx==null&&ny==null&&nz==null)continue;const k=inch?25.4:1;
  const tx=nx==null?x:abs?nx*k:x+nx*k,ty=ny==null?y:abs?ny*k:y+ny*k,tz=nz==null?z:abs?nz*k:z+nz*k;
  if((mode===2||mode===3)&&(I||J||Rr)){let ccx=x+I*k,ccy=y+J*k;
   if(Rr!=null&&!I&&!J){const r=Rr*k,dx=tx-x,dy=ty-y,dd=Math.hypot(dx,dy)||1,h=Math.sqrt(Math.max(0,r*r-dd*dd/4))*((mode===2)===(r>0)?1:-1);ccx=x+dx/2-h*dy/dd;ccy=y+dy/2+h*dx/dd}
   const r=Math.hypot(x-ccx,y-ccy),a0=Math.atan2(y-ccy,x-ccx);let da=Math.atan2(ty-ccy,tx-ccx)-a0;
   if(mode===2){if(da>=-1e-9)da-=Math.PI*2}else{if(da<=1e-9)da+=Math.PI*2}
   const n=Math.max(4,Math.ceil(Math.abs(da)*r/.4)),z0=z;for(let q=1;q<=n;q++){const a=a0+da*q/n;push(q===n?tx:ccx+r*Math.cos(a),q===n?ty:ccy+r*Math.sin(a),z0+(tz-z0)*q/n,i)}}
  else push(tx,ty,tz,i)}
 P.moves=mv;P.total=t;P.layers=layers;P.minF=minF;P.maxF=maxF;P.minZ=b[2];
 P.stats={time:t,cut,rapid:rap,n:mv.length,b:isFinite(b[0])?b:[0,0,0,0,0,0]};
 if(!keepT||!P.playing||P.t>t)P.t=t;
 if(typeof MC!=='undefined'){MC.job.t=0;MC.job.line=0}
}
function moveColor(mv){
 if(P.colorBy==='feed'){const k=P.maxF>P.minF?(mv.f-P.minF)/(P.maxF-P.minF):1;return `hsl(${205-170*k} 85% 55%)`}
 if(P.colorBy==='z'){const k=P.minZ<0?clamp(Math.min(mv.a[2],mv.b[2])/P.minZ,0,1):1;return `hsl(${205-170*k} 85% 55%)`}
 if(P.colorBy==='power'){const k=clamp(mv.s/(S.machine.smax||1000),0,1);return `hsl(${205-170*k} 85% 55%)`}
 return mv.col||P._acc;
}
function idxAt(t){const m=P.moves;let lo=0,hi=m.length-1;if(hi<0)return-1;if(t>=m[hi].t1)return hi;while(lo<hi){const mid=(lo+hi)>>1;if(m[mid].t1<t)lo=mid+1;else hi=mid}return lo}
function posAt(t){const i=idxAt(t);if(i<0)return[0,0,P.laser?0:S.machine.safeZ];const m=P.moves[i],k=m.t1>m.t0?clamp((t-m.t0)/(m.t1-m.t0),0,1):1;return[m.a[0]+(m.b[0]-m.a[0])*k,m.a[1]+(m.b[1]-m.a[1])*k,m.a[2]+(m.b[2]-m.a[2])*k]}
function drawMoves(c,proj,upto,camView){
 const mv=P.moves;if(!mv.length)return;const rc=css('--rapid');P._acc=css('--accent');
 if(P.ghost&&!camView&&upto<P.total){c.beginPath();for(let i=Math.max(0,idxAt(upto));i<mv.length;i++){const m=mv[i];if(!m.c)continue;const a=proj(m.a),b=proj(m.b);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])}c.strokeStyle=css('--faint');c.globalAlpha=.35;c.lineWidth=1;c.stroke();c.globalAlpha=1}
 if(!P.laser&&camView){const byL={};for(const m of mv){if(!m.c)continue;const k=m.col||'x';(byL[k]=byL[k]||[]).push(m)}
  for(const k in byL){const L=S.layers.find(L=>L.color===k);const tw=(L?(L.cnc.op==='vcarve'?.4:L.cnc.tool):3)*V.s;c.beginPath();for(const m of byL[k]){const a=proj(m.a),b=proj(m.b);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])}c.strokeStyle=hexA(k==='x'?'#f0a43a':k,.13);c.lineWidth=Math.max(1,tw);c.lineCap='round';c.lineJoin='round';c.stroke()}c.lineCap='butt';c.lineJoin='miter'}
 const rap=[];let curCol=null;c.lineWidth=P.laser?1.2:1.5;c.beginPath();
 for(let i=0;i<mv.length;i++){const m=mv[i];if(m.t0>=upto)break;let b=m.b;if(m.t1>upto){const k=(upto-m.t0)/(m.t1-m.t0);b=[m.a[0]+(m.b[0]-m.a[0])*k,m.a[1]+(m.b[1]-m.a[1])*k,m.a[2]+(m.b[2]-m.a[2])*k]}
  if(!m.c){if(P.rapids&&m.r)rap.push(m.a,b);continue}
  const col=moveColor(m);if(col!==curCol){if(curCol)c.stroke();c.beginPath();c.strokeStyle=curCol=col}const A=proj(m.a),B=proj(b);c.moveTo(A[0],A[1]);c.lineTo(B[0],B[1])}
 if(curCol)c.stroke();
 if(rap.length){c.beginPath();for(let i=0;i<rap.length;i+=2){const a=proj(rap[i]),b=proj(rap[i+1]);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])}c.setLineDash([4,4]);c.strokeStyle=rc;c.globalAlpha=.7;c.lineWidth=1;c.stroke();c.setLineDash([]);c.globalAlpha=1}
}
function drawHead2D(c,proj,t){if(!P.moves.length)return;const p=posAt(t),[x,y]=proj(p),i=idxAt(t),m=P.moves[i],burn=m&&m.c&&t<P.total;
 if(P.laser){if(burn){const g=c.createRadialGradient(x,y,0,x,y,14);g.addColorStop(0,'rgba(255,90,40,.9)');g.addColorStop(1,'rgba(255,90,40,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,14,0,Math.PI*2);c.fill()}
  c.strokeStyle=css('--fg');c.lineWidth=1.5;c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.moveTo(x-10,y);c.lineTo(x-3,y);c.moveTo(x+3,y);c.lineTo(x+10,y);c.moveTo(x,y-10);c.lineTo(x,y-3);c.moveTo(x,y+3);c.lineTo(x,y+10);c.stroke()}
 else{const L=S.layers.find(L=>L.color===(m&&m.col)),r=Math.max(4,(L?L.cnc.tool:3)/2*V.s);c.fillStyle=burn?'rgba(240,164,58,.35)':'rgba(140,150,165,.3)';c.strokeStyle=css('--fg');c.lineWidth=1.5;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.stroke()}
}
function proj3(p,W,H){const m=S.machine,X=p[0]-m.w/2,Y=p[1]-m.h/2,Z=p[2]*(P.laser?1:2);const cy=Math.cos(P.yaw),sy=Math.sin(P.yaw);const x1=X*cy-Y*sy,y1=X*sy+Y*cy;const u=y1*Math.cos(P.pitch)+Z*Math.sin(P.pitch);return[W/2+P.panX+x1*P.sc,H/2+P.panY-u*P.sc]}
function draw3D(c,W,H){
 const m=S.machine,pj=p=>proj3(p,W,H),poly=pts=>{c.beginPath();pts.forEach((p,i)=>{const q=pj(p);i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1])});c.closePath()};
 const bedZ=P.laser?0:-S.sheet.thick;
 poly([[0,0,bedZ],[m.w,0,bedZ],[m.w,m.h,bedZ],[0,m.h,bedZ]]);c.fillStyle=css('--bed');c.fill();c.strokeStyle=css('--line-2');c.lineWidth=1;c.stroke();
 c.beginPath();const st=m.w>300?50:25;for(let x=0;x<=m.w;x+=st){const a=pj([x,0,bedZ]),b=pj([x,m.h,bedZ]);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])}for(let y=0;y<=m.h;y+=st){const a=pj([0,y,bedZ]),b=pj([m.w,y,bedZ]);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])}c.strokeStyle=css('--grid-2');c.stroke();
 if(S.sheet.on){const sh=S.sheet,zt=P.laser?0:0,zb=P.laser?-.01:-sh.thick;poly([[sh.x,sh.y,zt],[sh.x+sh.w,sh.y,zt],[sh.x+sh.w,sh.y+sh.h,zt],[sh.x,sh.y+sh.h,zt]]);c.fillStyle=css('--sheet');c.fill();c.strokeStyle=css('--sheet-line');c.stroke();
  if(!P.laser){c.beginPath();for(const[x,y]of[[sh.x,sh.y],[sh.x+sh.w,sh.y],[sh.x+sh.w,sh.y+sh.h],[sh.x,sh.y+sh.h]]){const a=pj([x,y,0]),q=pj([x,y,zb]);c.moveTo(a[0],a[1]);c.lineTo(q[0],q[1])}c.stroke()}}
 const o=pj([0,0,bedZ]);for(const[d,col,l]of[[[20,0,0],'#e5484d','X'],[[0,20,0],'#30a46c','Y'],[[0,0,20],'#3e8ef7','Z']]){const q=pj([d[0],d[1],bedZ+d[2]]);c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(o[0],o[1]);c.lineTo(q[0],q[1]);c.stroke();c.fillStyle=col;c.font=`600 11px ${css('--f-mono')}`;c.fillText(l,q[0]+3,q[1]-3)}
 drawMoves(c,pj,P.t,false);
 if(P.moves.length){const p=posAt(P.t),a=pj(p),top=pj([p[0],p[1],p[2]+(P.laser?25:30)]);c.strokeStyle=css('--fg');c.lineWidth=P.laser?1.5:4;c.globalAlpha=.8;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(top[0],top[1]);c.stroke();c.globalAlpha=1;
  const i=idxAt(P.t),mm=P.moves[i];if(mm&&mm.c&&P.t<P.total&&P.laser){c.fillStyle='rgba(255,90,40,.9)';c.beginPath();c.arc(a[0],a[1],4,0,Math.PI*2);c.fill()}}
}
/* G-code list (virtual) */
function hl(line){const e=esc(line);if(/^\s*;\s*LAYER/.test(line))return `<span class="c-l">${e}</span>`;
 const i=e.indexOf(';'),code=i<0?e:e.slice(0,i),cm=i<0?'':`<span class="c-c">${e.slice(i)}</span>`;
 return code.replace(/\b([GM])(\d+)/g,(_,a,b)=>`<span class="c-${a.toLowerCase()}">${a}${b}</span>`).replace(/\b([FS])(-?[\d.]+)/g,'<span class="c-f">$1$2</span>')+cm}
function renderGcList(){const box=$('#gcList'),inn=$('#gcInner');if(!box||!inn)return;const rh=19,n=P.lines.length;inn.style.height=n*rh+'px';
 const top=box.scrollTop,h=box.clientHeight||400,i0=Math.max(0,Math.floor(top/rh)-6),i1=Math.min(n,Math.ceil((top+h)/rh)+6);let s='';
 for(let i=i0;i<i1;i++)s+=`<div class="gl${i===P.curLine?' on':''}" style="top:${i*rh}px" data-line="${i}"><b>${i+1}</b><code>${hl(P.lines[i])}</code></div>`;inn.innerHTML=s}
function syncLine(){if(!P.moves.length)return;const i=idxAt(P.t),ln=P.t>=P.total?-1:P.moves[i].l;if(ln===P.curLine)return;P.curLine=ln;const box=$('#gcList');
 if(box&&P.follow&&ln>=0){const y=ln*19;if(y<box.scrollTop+20||y>box.scrollTop+box.clientHeight-40)box.scrollTop=y-box.clientHeight/2}renderGcList()}
function svgExport(plate){
 const m=S.machine,OX=plateX(plate),sh=S.shapes.filter(s=>plateOf(s)===plate&&s.kind!=='image');let body='';
 for(const L of S.layers){const ls=sh.filter(s=>s.layer===L.id);if(!ls.length)continue;body+=`<g id="${esc(layerName(L))}" stroke="${L.color}" fill="none" stroke-width="0.1">`;
  for(const s of ls){const d=s.paths.map(p=>'M'+p.map(q=>`${fx(q[0]-OX,3)},${fx(m.h-q[1],3)}`).join('L')+(s.closed?'Z':'')).join('');body+=`<path d="${d}"/>`}body+='</g>'}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${m.w}mm" height="${m.h}mm" viewBox="0 0 ${m.w} ${m.h}">${body}</svg>`;
}
