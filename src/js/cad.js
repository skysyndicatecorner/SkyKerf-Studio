'use strict';
/* ================= Kerf Studio · CAD: view, plates, drawing, editing, import, nesting ================= */
const cv=$('#cv'),ctx=cv.getContext('2d');let CW=0,CH=0,DPR=1;
let V={s:2,ox:60,oy:500,fitted:false};
let drag=null,spaceDown=false,penPts=null,cursorW=null,measure=null;
const toolOpt={radius:0,sides:6,points:5,inner:45,text:'Kerf',font:'unb',size:12,lock:true,off:2,ac:3,ar:2,ag:5,cc:8,cr:40};
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}
function resize(){const r=$('#stage').getBoundingClientRect();if(!r.width||!r.height)return;DPR=window.devicePixelRatio||1;CW=r.width;CH=r.height;cv.width=Math.round(CW*DPR);cv.height=Math.round(CH*DPR);if(!V.fitted){fitPlate(curPlate);V.fitted=true}draw()}
function fitBox(b,pad=60,bottom=0){const s=Math.min((CW-pad*2)/(b[2]-b[0]||1),(CH-pad*2-bottom)/(b[3]-b[1]||1));V.s=clamp(s,.05,200);V.ox=(CW-(b[2]-b[0])*V.s)/2-b[0]*V.s;V.oy=(CH-bottom)/2+(b[3]+b[1])/2*V.s}
function fitPlate(i){const m=S.machine,x=plateX(i);fitBox([x,0,x+m.w,m.h],tab==='cad'?64:44,tab==='gcode'?50:0);P.sc=Math.min(CW,CH)/Math.max(m.w,m.h)*.85;P.panX=0;P.panY=0}
function fitAll(){const m=S.machine;fitBox([0,0,plateX(S.plates-1)+m.w,m.h],56,0)}
const w2s=(x,y,v=V)=>[v.ox+x*v.s,v.oy-y*v.s];
const s2w=(px,py)=>[(px-V.ox)/V.s,(V.oy-py)/V.s];
let rq=0;function draw(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;drawNow()})}
function drawNow(){
 if(tab==='machine'){drawMachineCanvas();return}
 if(!CW)return;
 ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,CW,CH);
 if(tab==='gcode'&&P.mode==='3d'){draw3D(ctx,CW,CH);return}
 if(tab==='cad'){for(let i=0;i<S.plates;i++)drawBed(ctx,V,CW,CH,i);drawShapes(ctx,V,1);drawSelection();drawTemp()}
 else{drawBed(ctx,V,CW,CH,curPlate);const ox=plateX(curPlate);
  if(tab==='cam'){drawShapes(ctx,V,.32,curPlate);drawMoves(ctx,p=>w2s(p[0]+ox,p[1]),P.total,true)}
  else{drawMoves(ctx,p=>w2s(p[0]+ox,p[1]),P.t,false);drawHead2D(ctx,p=>w2s(p[0]+ox,p[1]),P.t)}}
}
function niceStep(px){for(const s of[.5,1,2,5,10,20,50,100,200,500])if(s*px>=9)return s;return 1000}
function drawBed(c,v,W,H,pi=0,bare){
 const m=S.machine,X=pi?plateX(pi):0,[x0,y0]=w2s(X,m.h,v),[x1,y1]=w2s(X+m.w,0,v);
 if(x1<-40||x0>W+40)return;
 c.fillStyle=css('--bed');c.fillRect(x0,y0,x1-x0,y1-y0);
 const st=niceStep(v.s),maj=st*(st===.5||st===5||st===50?2:5);c.lineWidth=1;
 for(const[step,col]of[[st,css('--grid')],[maj,css('--grid-2')]]){if(step*v.s<4)continue;c.strokeStyle=col;c.beginPath();
  for(let x=0;x<=m.w+1e-6;x+=step){const sx=Math.round(v.ox+(X+x)*v.s)+.5;if(sx<-1||sx>W+1)continue;c.moveTo(sx,Math.max(y0,0));c.lineTo(sx,Math.min(y1,H))}
  for(let y=0;y<=m.h+1e-6;y+=step){const sy=Math.round(v.oy-y*v.s)+.5;if(sy<-1||sy>H+1)continue;c.moveTo(Math.max(x0,0),sy);c.lineTo(Math.min(x1,W),sy)}c.stroke()}
 // material sheet
 if(S.sheet.on&&!bare){const sh=S.sheet,[a,b]=w2s(X+sh.x,sh.y+sh.h,v),[a2,b2]=w2s(X+sh.x+sh.w,sh.y,v);c.fillStyle=css('--sheet');c.fillRect(a,b,a2-a,b2-b);c.strokeStyle=css('--sheet-line');c.setLineDash([6,4]);c.strokeRect(a+.5,b+.5,a2-a,b2-b);c.setLineDash([]);
  if(a2-a>120){c.fillStyle=css('--sheet-line');c.font=`10.5px ${css('--f-mono')}`;c.textAlign='right';c.textBaseline='bottom';c.fillText(`${matName(curMat(),sh.thick)} · ${fx(sh.w,1)}×${fx(sh.h,1)}`,a2-6,b2-4)}}
 const active=pi===curPlate&&S.plates>1&&tab==='cad';
 c.strokeStyle=active?css('--accent'):css('--line-2');c.lineWidth=active?1.5:1;c.strokeRect(Math.round(x0)+.5,Math.round(y0)+.5,Math.round(x1-x0),Math.round(y1-y0));c.lineWidth=1;
 c.fillStyle=css('--muted');c.font=`10.5px ${css('--f-mono')}`;c.textAlign='center';c.textBaseline='top';
 const lab=maj*(maj*v.s<40?2:1);
 for(let x=0;x<=m.w+1e-6;x+=lab){const sx=v.ox+(X+x)*v.s;if(sx>8&&sx<W-8&&sx>=x0-1&&sx<=x1+1)c.fillText(fx(x,1),sx,y1+5)}
 c.textAlign='right';c.textBaseline='middle';if(x0-6>8)for(let y=lab;y<=m.h+1e-6;y+=lab){const sy=v.oy-y*v.s;if(sy>8&&sy<H-8)c.fillText(fx(y,1),x0-6,sy)}
 if(S.plates>1&&!bare){c.textAlign='left';c.textBaseline='bottom';c.fillStyle=pi===curPlate?css('--accent'):css('--muted');c.font=`600 12px ${css('--f-ui')}`;c.fillText(T('Лист ','Sheet ')+(pi+1),x0,y0-6)}
 c.fillStyle=css('--accent');c.beginPath();c.arc(x0,y1,3.5,0,Math.PI*2);c.fill();
}
function tracePath(c,p,closed,v=V){for(let i=0;i<p.length;i++){const[x,y]=w2s(p[i][0],p[i][1],v);i?c.lineTo(x,y):c.moveTo(x,y)}if(closed)c.closePath()}
function hexA(hex,a){const n=parseInt(String(hex).slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function drawShapes(c,v,alpha,onlyPlate){
 const laser=S.machine.type==='laser';
 for(const s of S.shapes){const L=S.layers[s.layer];if(!L||!L.show)continue;if(onlyPlate!=null&&plateOf(s)!==onlyPlate)continue;
  if(s.kind==='image'){drawImageShape(c,v,s,alpha);continue}
  c.beginPath();for(const p of s.paths)tracePath(c,p,s.closed,v);
  const fill=s.closed&&L.out&&(laser?L.laser.mode!=='line':(L.cnc.op==='pocket'||L.cnc.op==='vcarve'));
  if(fill){c.fillStyle=hexA(L.color,.16*alpha);c.fill('evenodd')}
  c.globalAlpha=alpha;c.strokeStyle=L.color;c.lineWidth=sel.has(s.id)&&tab==='cad'?2:1.3;if(!L.out)c.setLineDash([5,4]);c.stroke();c.setLineDash([]);c.globalAlpha=1}
}

/* ---------- raster images ---------- */
const IMGS=new Map();
function imgEl(src){let im=IMGS.get(src);if(!im){im=new Image();im.onload=()=>{prevCache.clear();draw()};im.src=src;IMGS.set(src,im)}return im}
const prevCache=new Map();
function processImage(s,pw,ph){
 const im=imgEl(s.img.src);if(!im.complete||!im.naturalWidth)return null;
 pw=Math.max(1,Math.round(pw));ph=Math.max(1,Math.round(ph));
 const c=document.createElement('canvas');c.width=pw;c.height=ph;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,pw,ph);
 x.save();if(s.img.fx){x.translate(pw,0);x.scale(-1,1)}if(s.img.fy){x.translate(0,ph);x.scale(1,-1)}x.drawImage(im,0,0,pw,ph);x.restore();
 const d=x.getImageData(0,0,pw,ph).data,n=pw*ph,g=new Float32Array(n),o=s.img;
 const con=clamp(o.contrast||0,-100,100)*2.55,cf=(259*(con+255))/(255*(259-con)),gm=o.gamma||1;
 for(let i=0;i<n;i++){let l=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];l=cf*(l-128)+128+(o.bright||0)*2.55;l=clamp(l,0,255);l=255*Math.pow(l/255,1/gm);if(o.invert)l=255-l;g[i]=255-l}
 const out=new Uint8ClampedArray(n),md=o.mode||'fs';
 if(md==='gray'){for(let i=0;i<n;i++)out[i]=g[i];return out}
 if(md==='threshold'){const t=255-(o.thr??128);for(let i=0;i<n;i++)out[i]=g[i]>t?255:0;return out}
 if(md==='ordered'){const B=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];for(let y=0;y<ph;y++)for(let x2=0;x2<pw;x2++){const i=y*pw+x2;out[i]=g[i]>(B[(y&3)*4+(x2&3)]+.5)*16?255:0}return out}
 const K={fs:[[1,0,7],[-1,1,3],[0,1,5],[1,1,1],16],atkinson:[[1,0,1],[2,0,1],[-1,1,1],[0,1,1],[1,1,1],[0,2,1],8],
  jarvis:[[1,0,7],[2,0,5],[-2,1,3],[-1,1,5],[0,1,7],[1,1,5],[2,1,3],[-2,2,1],[-1,2,3],[0,2,5],[1,2,3],[2,2,1],48],
  stucki:[[1,0,8],[2,0,4],[-2,1,2],[-1,1,4],[0,1,8],[1,1,4],[2,1,2],[-2,2,1],[-1,2,2],[0,2,4],[1,2,2],[2,2,1],42]}[md]||null;
 const ker=K||[[1,0,7],[-1,1,3],[0,1,5],[1,1,1],16],div=ker[ker.length-1],ks=ker.slice(0,-1);
 for(let y=0;y<ph;y++)for(let x2=0;x2<pw;x2++){const i=y*pw+x2,v=g[i],nv=v>127?255:0,e=v-nv;out[i]=nv;
  for(const[dx,dy,w]of ks){const xx=x2+dx,yy=y+dy;if(xx>=0&&xx<pw&&yy<ph)g[yy*pw+xx]+=e*w/div}}
 return out;
}
function imagePreview(s){
 const b=bboxOf(s.paths),wmm=b[2]-b[0],hmm=b[3]-b[1],pw=Math.round(clamp(wmm*4,40,520)),ph=Math.round(pw*hmm/wmm),fg=css('--fg');
 const key=[s.id,s.img.src.length,s.img.mode,s.img.bright,s.img.contrast,s.img.gamma,s.img.invert,s.img.thr,s.img.fx,s.img.fy,pw,ph,fg].join('|');
 let c=prevCache.get(key);if(c)return c;
 const data=processImage(s,pw,ph);if(!data)return null;
 c=document.createElement('canvas');c.width=pw;c.height=ph;const x=c.getContext('2d'),id=x.createImageData(pw,ph),n=parseInt(fg.slice(1),16);
 for(let i=0;i<data.length;i++){id.data[i*4]=n>>16&255;id.data[i*4+1]=n>>8&255;id.data[i*4+2]=n&255;id.data[i*4+3]=data[i]}
 x.putImageData(id,0,0);if(prevCache.size>40)prevCache.clear();prevCache.set(key,c);return c;
}
function drawImageShape(c,v,s,alpha){
 const b=bboxOf(s.paths),[x0,y0]=w2s(b[0],b[3],v),[x1,y1]=w2s(b[2],b[1],v),pc=imagePreview(s);
 c.globalAlpha=alpha*.95;if(pc)c.drawImage(pc,x0,y0,x1-x0,y1-y0);c.globalAlpha=1;
 c.strokeStyle=S.layers[s.layer].color;c.lineWidth=sel.has(s.id)&&tab==='cad'?2:1;c.setLineDash([3,3]);c.strokeRect(x0+.5,y0+.5,x1-x0,y1-y0);c.setLineDash([]);
}

/* ---------- selection & temp ---------- */
function selBox(){let b=null;for(const s of S.shapes)if(sel.has(s.id)){const x=bboxOf(s.paths);b=b?unionBox(b,x):x}return b}
const selShapes=()=>S.shapes.filter(s=>sel.has(s.id));
function handlePts(b){const[x0,y1]=w2s(b[0],b[1]),[x1,y0]=w2s(b[2],b[3]),mx=(x0+x1)/2,my=(y0+y1)/2;
 return{nw:[x0,y0],n:[mx,y0],ne:[x1,y0],e:[x1,my],se:[x1,y1],s:[mx,y1],sw:[x0,y1],w:[x0,my],rot:[mx,y0-24]}}
function drawSelection(){
 const b=selBox();if(!b)return;const h=handlePts(b),ac=css('--accent');
 ctx.strokeStyle=ac;ctx.setLineDash([5,4]);ctx.lineWidth=1;ctx.strokeRect(h.nw[0]-.5,h.nw[1]-.5,h.se[0]-h.nw[0]+1,h.se[1]-h.nw[1]+1);ctx.setLineDash([]);
 ctx.beginPath();ctx.moveTo(h.n[0],h.n[1]);ctx.lineTo(h.rot[0],h.rot[1]);ctx.stroke();
 ctx.fillStyle=css('--raised');ctx.lineWidth=1.5;
 for(const k of['nw','n','ne','e','se','s','sw','w']){const[x,y]=h[k];ctx.fillRect(x-4,y-4,8,8);ctx.strokeRect(x-4,y-4,8,8)}
 ctx.beginPath();ctx.arc(h.rot[0],h.rot[1],5,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.fillStyle=ac;ctx.font=`11px ${css('--f-mono')}`;ctx.textAlign='center';ctx.textBaseline='top';
 ctx.fillText(`${fx(b[2]-b[0],1)} × ${fx(b[3]-b[1],1)} ${MM()}`,h.s[0],h.s[1]+9);
}
function drawTemp(){
 const ac=css('--accent');ctx.strokeStyle=ac;ctx.lineWidth=1.4;
 if(drag&&drag.k==='draw'){const sh=buildShape(drag.start,drag.cur,drag.shift);if(sh){ctx.beginPath();for(const p of sh.paths)tracePath(ctx,p,sh.closed);ctx.stroke();
  const b=bboxOf(sh.paths),[sx,sy]=w2s(b[2],b[1]);ctx.fillStyle=ac;ctx.font=`11px ${css('--f-mono')}`;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(`${fx(b[2]-b[0],1)} × ${fx(b[3]-b[1],1)}`,sx+8,sy+6)}}
 if(drag&&drag.k==='marquee'){const a=w2s(...drag.start),b=w2s(...drag.cur),cross=drag.cur[0]<drag.start[0];ctx.setLineDash(cross?[4,3]:[]);ctx.fillStyle=css('--accent-soft');ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.strokeRect(a[0]+.5,a[1]+.5,b[0]-a[0],b[1]-a[1]);ctx.setLineDash([])}
 if(penPts&&penPts.length){ctx.beginPath();tracePath(ctx,cursorW?penPts.concat([snapP(cursorW)]):penPts,false);ctx.stroke();ctx.fillStyle=ac;for(const p of penPts){const[x,y]=w2s(...p);ctx.fillRect(x-3,y-3,6,6)}}
 if(measure){const a=w2s(...measure.a),b=w2s(...measure.b),d=Math.hypot(measure.b[0]-measure.a[0],measure.b[1]-measure.a[1]),ang=Math.atan2(measure.b[1]-measure.a[1],measure.b[0]-measure.a[0])*180/Math.PI;
  ctx.strokeStyle=css('--info');ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();for(const p of[a,b]){ctx.beginPath();ctx.arc(p[0],p[1],3.5,0,Math.PI*2);ctx.stroke()}
  const t=`${fx(d,2)} ${MM()} · ${fx(ang,1)}° · ΔX ${fx(measure.b[0]-measure.a[0],2)} ΔY ${fx(measure.b[1]-measure.a[1],2)}`;ctx.font=`11.5px ${css('--f-mono')}`;const tw=ctx.measureText(t).width;
  const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2-16;ctx.fillStyle=css('--panel');ctx.fillRect(mx-tw/2-6,my-10,tw+12,20);ctx.fillStyle=css('--info');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,mx,my)}
 if(cursorW&&tool!=='select'&&tool!=='hand'&&!drag){const[x,y]=w2s(...snapP(cursorW));ctx.strokeStyle=ac;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke()}
}

/* ---------- interaction ---------- */
const snapV=v=>S.snapOn?Math.round(v/S.snap)*S.snap:v;
const snapP=p=>[snapV(p[0]),snapV(p[1])];
function buildShape(a,b,shift){
 let[x0,y0]=a,[x1,y1]=b;const dx=x1-x0,dy=y1-y0;
 if(tool==='rect'||tool==='ellipse'){let w=dx,h=dy;if(shift){const m=Math.max(Math.abs(w),Math.abs(h));w=Math.sign(w||1)*m;h=Math.sign(h||1)*m}
  const x=Math.min(x0,x0+w),y=Math.min(y0,y0+h),W=Math.abs(w),H=Math.abs(h);if(W<.2&&H<.2)return null;
  return tool==='rect'?{kind:'rect',paths:[rectPts(x,y,W,H,toolOpt.radius)],closed:true}:{kind:'ellipse',paths:[ellipsePts(x+W/2,y+H/2,W/2,H/2)],closed:true}}
 const r=Math.hypot(dx,dy);
 if(tool==='polygon'){if(r<.2)return null;return{kind:'polygon',paths:[polyPts(x0,y0,r,clamp(toolOpt.sides|0,3,64))],closed:true}}
 if(tool==='star'){if(r<.2)return null;return{kind:'star',paths:[starPts(x0,y0,r,r*clamp(toolOpt.inner,5,95)/100,clamp(toolOpt.points|0,3,40))],closed:true}}
 if(tool==='line'){if(r<.2)return null;if(shift){const a2=Math.round(Math.atan2(dy,dx)/(Math.PI/12))*(Math.PI/12);x1=x0+r*Math.cos(a2);y1=y0+r*Math.sin(a2)}return{kind:'line',paths:[[[x0,y0],[x1,y1]]],closed:false}}
 return null;
}
function hitShape(w){const tol=6/V.s;for(let i=S.shapes.length-1;i>=0;i--){const s=S.shapes[i];if(!S.layers[s.layer].show)continue;const b=bboxOf(s.paths);
 if(w[0]<b[0]-tol||w[0]>b[2]+tol||w[1]<b[1]-tol||w[1]>b[3]+tol)continue;
 if(s.kind==='image')return s;
 if(s.closed&&inPolys(w,s.paths))return s;
 for(const p of s.paths){const n=p.length;for(let k=0;k<(s.closed?n:n-1);k++)if(distSeg(w,p[k],p[(k+1)%n])<tol)return s}}return null}
function hitHandle(px,py){const b=selBox();if(!b)return null;const h=handlePts(b);for(const k in h){if(Math.abs(px-h[k][0])<=7&&Math.abs(py-h[k][1])<=7)return k}return null}
const groupIds=s=>s.g?S.shapes.filter(q=>q.g===s.g).map(q=>q.id):[s.id];
const snapSel=()=>new Map(selShapes().map(s=>[s.id,JSON.parse(JSON.stringify(s.paths))]));
function applyFromOrig(orig,f){for(const[id,paths]of orig){const s=shapeById(id);if(s)s.paths=mapPaths(paths,f)}}
function evtPos(e){const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}
function plateAtWorld(w){const pw=S.machine.w+plateGap(),i=Math.floor((w[0]+plateGap()/2)/pw);return i>=0&&i<S.plates&&w[1]>=-20&&w[1]<=S.machine.h+20?i:null}

cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
 cv.setPointerCapture(e.pointerId);const[px,py]=evtPos(e),w=s2w(px,py);
 if(tab==='gcode'&&P.mode==='3d'){drag={k:'orbit',px,py,yaw:P.yaw,pitch:P.pitch,pan:e.button===2||e.shiftKey,panX:P.panX,panY:P.panY};return}
 if(e.button===1||e.button===2||spaceDown||tool==='hand'||tab!=='cad'){drag={k:'pan',px,py,ox:V.ox,oy:V.oy};cv.style.cursor='grabbing';return}
 const pl=plateAtWorld(w);if(pl!=null&&pl!==curPlate){curPlate=pl;camDirty=true;renderChrome();renderLeft()}
 if(tool==='measure'){measure={a:snapP(w),b:snapP(w)};drag={k:'measure'};draw();return}
 measure=null;
 if(tool==='select'){
  const hk=sel.size?hitHandle(px,py):null;
  if(hk){pushUndo();const b=selBox();drag={k:hk==='rot'?'rot':'scale',h:hk,box:b,orig:snapSel(),start:w,c:[(b[0]+b[2])/2,(b[1]+b[3])/2],moved:false,undo:true};return}
  const hit=hitShape(w);
  if(hit){const ids=e.altKey?[hit.id]:groupIds(hit);
   if(e.shiftKey){const has=sel.has(hit.id);for(const id of ids)has?sel.delete(id):sel.add(id)}else if(!sel.has(hit.id)){sel=new Set(ids)}
   pushUndo();drag={k:'move',start:w,box:selBox(),orig:snapSel(),moved:false,undo:true};selChanged();return}
  if(!e.shiftKey)sel.clear();drag={k:'marquee',start:w,cur:w,base:new Set(sel)};selChanged();return}
 if(tool==='pen'){const p=snapP(w);if(!penPts)penPts=[];
  if(penPts.length>=3){const[fx0,fy0]=w2s(...penPts[0]);if(Math.hypot(px-fx0,py-fy0)<9){finishPen(true);return}}
  penPts.push(p);draw();return}
 if(tool==='text'){placeText(snapP(w));return}
 drag={k:'draw',start:snapP(w),cur:snapP(w),shift:e.shiftKey};
});
cv.addEventListener('pointermove',e=>{
 const[px,py]=evtPos(e),w=s2w(px,py);
 if(tab!=='gcode'||P.mode==='2d'){cursorW=w;const sm=$('#status .mono');if(sm){const ox=tab==='cad'?plateX(plateAtWorld(w)??curPlate):plateX(curPlate);sm.textContent=`X ${fx(w[0]-ox,2).toFixed(2)}  Y ${fx(w[1],2).toFixed(2)}`}}
 if(!drag){if(tab==='cad'&&tool==='select'){const hk=sel.size?hitHandle(px,py):null;cv.style.cursor=hk?(hk==='rot'?'grab':({nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize'})[hk]):hitShape(w)?'move':'default'}
  else cv.style.cursor=tab!=='cad'||tool==='hand'||spaceDown?'grab':'crosshair';
  if(tab==='cad'&&tool!=='select')draw();return}
 const d=drag;
 if(d.k==='orbit'){if(d.pan){P.panX=d.panX+(px-d.px);P.panY=d.panY+(py-d.py)}else{P.yaw=d.yaw+(px-d.px)*.008;P.pitch=clamp(d.pitch+(py-d.py)*.006,0,1.5)}draw();return}
 if(d.k==='pan'){V.ox=d.ox+(px-d.px);V.oy=d.oy+(py-d.py);draw();return}
 if(d.k==='measure'){measure.b=e.shiftKey?(()=>{const dx=w[0]-measure.a[0],dy=w[1]-measure.a[1],r=Math.hypot(dx,dy),a=Math.round(Math.atan2(dy,dx)/(Math.PI/12))*(Math.PI/12);return[measure.a[0]+r*Math.cos(a),measure.a[1]+r*Math.sin(a)]})():snapP(w);draw();return}
 if(d.k==='move'){const b=d.box;let dx=w[0]-d.start[0],dy=w[1]-d.start[1];dx=snapV(b[0]+dx)-b[0];dy=snapV(b[1]+dy)-b[1];if(Math.abs(dx)+Math.abs(dy)>0)d.moved=true;applyFromOrig(d.orig,(x,y)=>[x+dx,y+dy]);draw();return}
 if(d.k==='scale'){const b=d.box,h=d.h;d.moved=true;
  const ax=h.includes('w')?b[2]:b[0],ay=h.includes('s')?b[3]:b[1],hx=h.includes('w')?b[0]:b[2],hy=h.includes('s')?b[1]:b[3];
  const p=snapP(w);let sx=h==='n'||h==='s'?1:(p[0]-ax)/((hx-ax)||1),sy=h==='e'||h==='w'?1:(p[1]-ay)/((hy-ay)||1);
  const lock=e.shiftKey!==toolOpt.lock||[...d.orig.keys()].some(id=>{const s=shapeById(id);return s&&s.kind==='image'});
  if(lock){if(h==='n'||h==='s')sx=sy;else if(h==='e'||h==='w')sy=sx;else{const m=Math.max(Math.abs(sx),Math.abs(sy));sx=Math.sign(sx||1)*m;sy=Math.sign(sy||1)*m}}
  if(Math.abs(sx)<.001)sx=.001;if(Math.abs(sy)<.001)sy=.001;
  applyFromOrig(d.orig,(x,y)=>[ax+(x-ax)*sx,ay+(y-ay)*sy]);d.sy=sy;draw();return}
 if(d.k==='rot'){if([...d.orig.keys()].some(id=>shapeById(id)?.kind==='image'))return;const c=d.c;let a=Math.atan2(w[1]-c[1],w[0]-c[0])-Math.atan2(d.start[1]-c[1],d.start[0]-c[0]);if(e.shiftKey)a=Math.round(a/(Math.PI/12))*(Math.PI/12);
  d.moved=true;d.ang=a;const ca=Math.cos(a),sa=Math.sin(a);applyFromOrig(d.orig,(x,y)=>[c[0]+(x-c[0])*ca-(y-c[1])*sa,c[1]+(x-c[0])*sa+(y-c[1])*ca]);draw();return}
 if(d.k==='marquee'){d.cur=w;const x0=Math.min(d.start[0],w[0]),x1=Math.max(d.start[0],w[0]),y0=Math.min(d.start[1],w[1]),y1=Math.max(d.start[1],w[1]),cross=w[0]<d.start[0];
  sel=new Set(d.base);for(const s of S.shapes){if(!S.layers[s.layer].show)continue;const b=bboxOf(s.paths);const inside=b[0]>=x0&&b[2]<=x1&&b[1]>=y0&&b[3]<=y1,hit=b[0]<=x1&&b[2]>=x0&&b[1]<=y1&&b[3]>=y0;if(cross?hit:inside)for(const id of groupIds(s))sel.add(id)}draw();return}
 if(d.k==='draw'){d.cur=snapP(w);d.shift=e.shiftKey;draw()}
});
cv.addEventListener('pointerup',()=>{
 const d=drag;drag=null;if(!d)return;cv.style.cursor='';
 if(d.undo&&!d.moved)undoS.pop();
 if(d.k==='rot'&&d.moved)for(const id of d.orig.keys()){const s=shapeById(id);if(s&&s.kind==='text')s.rot=((s.rot||0)+d.ang*180/Math.PI)%360}
 if(d.k==='scale'&&d.moved)for(const id of d.orig.keys()){const s=shapeById(id);if(s&&s.kind==='text')s.size=fx(s.size*Math.abs(d.sy||1),2)}
 if(d.k==='draw'){const sh=buildShape(d.start,d.cur,d.shift);if(sh){pushUndo();const s=addShape(S,curDrawLayer,sh.kind,sh.paths,sh.closed);sel=new Set([s.id]);if(mode==='simple'||!toolSticky)setTool('select');changed();return}}
 if(d.k==='move'||d.k==='scale'||d.k==='rot'){if(d.moved)changed();else{renderRight();draw()}return}
 if(d.k==='marquee'){selChanged();return}
 draw();
});
let toolSticky=false;
cv.addEventListener('pointerleave',()=>{if(tab==='cad'&&tool!=='select'){cursorW=null;draw()}});
cv.addEventListener('dblclick',e=>{if(tool==='pen'&&penPts){finishPen(false);return}
 if(tab==='cad'&&tool==='select'){const hit=hitShape(s2w(...evtPos(e)));if(hit&&hit.g){sel=new Set([hit.id]);selChanged();toast(T('Выбран один объект из группы (Alt+клик делает то же).','Selected one object inside the group (Alt+click does the same).'))}}});
cv.addEventListener('wheel',e=>{e.preventDefault();const[px,py]=evtPos(e),f=Math.exp(-e.deltaY*.0015);
 if(tab==='gcode'&&P.mode==='3d'){P.sc=clamp(P.sc*f,.05,80);draw();return}zoomAt(px,py,f)},{passive:false});
function zoomAt(px,py,f){const ns=clamp(V.s*f,.05,200),k=ns/V.s;V.ox=px-(px-V.ox)*k;V.oy=py-(py-V.oy)*k;V.s=ns;draw();renderStatus()}
function finishPen(closed){const p=penPts;penPts=null;if(!p||p.length<2){draw();return}pushUndo();const s=addShape(S,curDrawLayer,'pen',[p],closed&&p.length>2);sel=new Set([s.id]);setTool('select');changed()}
async function placeText(at){const txt=String(toolOpt.text).trim();if(!txt){toast(T('Введите текст в панели справа.','Type the text in the right panel.'));return}
 const paths=await makeTextPaths(txt,toolOpt.font,toolOpt.size);if(!paths.length){toast(T('Не удалось построить контуры текста.','Could not outline this text.'));return}
 pushUndo();const s=addShape(S,curDrawLayer,'text',mapPaths(paths,(x,y)=>[x+at[0],y+at[1]]),true,{text:txt,font:toolOpt.font,size:toolOpt.size,rot:0});sel=new Set([s.id]);setTool('select');changed()}
function setTool(t){tool=t;if(t!=='pen')penPts=null;if(t!=='measure')measure=null;renderChrome();renderRight();renderStatus();draw()}
function selChanged(){renderLeft();renderRight();renderChrome();draw()}

/* ---------- commands ---------- */
function transformSel(f,noUndo){if(!noUndo)pushUndo();for(const s of selShapes())s.paths=mapPaths(s.paths,f);changed()}
function setBox(prop,val){const b=selBox();if(!b||!isFinite(val))return;const w=b[2]-b[0],h=b[3]-b[1],lock=toolOpt.lock||selShapes().some(s=>s.kind==='image');const ox=plateX(plateOfBox([b[0],b[1],b[0],b[1]]));
 if(prop==='x')return transformSel((x,y)=>[x+val+ox-b[0],y]);if(prop==='y')return transformSel((x,y)=>[x,y+val-b[1]]);
 if(val<=0)return;let sx=1,sy=1;if(prop==='w'){sx=w?val/w:1;if(lock)sy=sx}else{sy=h?val/h:1;if(lock)sx=sy}
 for(const s of selShapes())if(s.kind==='text')s.size=fx(s.size*sy,2);
 transformSel((x,y)=>[b[0]+(x-b[0])*sx,b[1]+(y-b[1])*sy])}
function rotSel(deg){const b=selBox();if(!b)return;if(selShapes().some(s=>s.kind==='image')){toast(T('Фото можно только отражать, поворот пока недоступен.','Photos can be flipped but not rotated yet.'));return}
 const c=[(b[0]+b[2])/2,(b[1]+b[3])/2];for(const s of selShapes())if(s.kind==='text')s.rot=((s.rot||0)+deg)%360;transformSel((x,y)=>{const r=rotPaths([[[x,y]]],deg,c[0],c[1])[0][0];return r})}
function mirrorSel(h){const b=selBox();if(!b)return;const cx=b[0]+b[2],cy=b[1]+b[3];for(const s of selShapes())if(s.kind==='image'){if(h)s.img.fx=!s.img.fx;else s.img.fy=!s.img.fy}transformSel(h?(x,y)=>[cx-x,y]:(x,y)=>[x,cy-y])}
function alignSel(k){const ss=selShapes();if(!ss.length)return;const units=new Map();for(const s of ss){const key=s.g&&ss.filter(q=>q.g===s.g).length>1?'g'+s.g:'s'+s.id;(units.get(key)||units.set(key,[]).get(key)).push(s)}
 const pl=plateOfBox(selBox()),ref=units.size>1?selBox():S.sheet.on?[plateX(pl)+S.sheet.x,S.sheet.y,plateX(pl)+S.sheet.x+S.sheet.w,S.sheet.y+S.sheet.h]:[plateX(pl),0,plateX(pl)+S.machine.w,S.machine.h];pushUndo();
 for(const u of units.values()){let b=null;for(const s of u){const x=bboxOf(s.paths);b=b?unionBox(b,x):x}let dx=0,dy=0;
  if(k==='l')dx=ref[0]-b[0];if(k==='r')dx=ref[2]-b[2];if(k==='cx')dx=(ref[0]+ref[2])/2-(b[0]+b[2])/2;if(k==='b')dy=ref[1]-b[1];if(k==='t')dy=ref[3]-b[3];if(k==='cy')dy=(ref[1]+ref[3])/2-(b[1]+b[3])/2;
  for(const s of u)s.paths=mapPaths(s.paths,(x,y)=>[x+dx,y+dy])}changed()}
function cloneShapes(list,dx,dy,rot,c){const gmap=new Map(),ns=[];for(const s of list){const n=JSON.parse(JSON.stringify(s));n.id=S.nextId++;if(s.g){if(!gmap.has(s.g))gmap.set(s.g,S.nextG++);n.g=gmap.get(s.g)}
 if(rot){n.paths=rotPaths(n.paths,rot,c[0],c[1]);if(n.kind==='text')n.rot=((n.rot||0)+rot)%360}n.paths=mapPaths(n.paths,(x,y)=>[x+dx,y+dy]);S.shapes.push(n);ns.push(n.id)}return ns}
function dupSel(off=5){const ss=selShapes();if(!ss.length)return;pushUndo();sel=new Set(cloneShapes(ss,off,-off));changed()}
function delSel(){if(!sel.size)return;pushUndo();S.shapes=S.shapes.filter(s=>!sel.has(s.id));sel.clear();changed()}
function groupSel(){const ss=selShapes();if(ss.length<2)return;pushUndo();const g=S.nextG++;for(const s of ss)s.g=g;changed();toast(T('Объекты сгруппированы.','Objects grouped.'))}
function ungroupSel(){pushUndo();for(const s of selShapes())delete s.g;changed();toast(T('Группа разобрана.','Group dissolved.'))}
function breakApart(){const ss=selShapes().filter(s=>s.paths.length>1&&s.kind!=='image');if(!ss.length){toast(T('Нечего разбивать: у объектов по одному контуру.','Nothing to break apart: each object has one outline.'));return}pushUndo();const ns=new Set();
 for(const s of ss){const parts=s.closed?components(s.paths):s.paths.map(p=>[p]);S.shapes=S.shapes.filter(q=>q!==s);for(const c of parts){const n=addShape(S,s.layer,s.kind==='text'?'bool':s.kind,c,s.closed,s.g?{g:s.g}:{});ns.add(n.id)}}sel=ns;changed()}
function simplifySel(eps){pushUndo();for(const s of selShapes())if(s.kind!=='image')s.paths=s.paths.map(p=>s.closed?rdpClosed(p,eps):rdp(p,eps));changed()}
function boolSel(kind){if(!hasClip()){toast(T('Булевы операции недоступны: библиотека Clipper не загрузилась.','Boolean ops need the Clipper library, which did not load.'));return}
 const ss=selShapes().filter(s=>s.closed&&s.kind!=='image');if(ss.length<2){toast(T('Нужно выделить минимум две замкнутые фигуры.','Select at least two closed shapes.'));return}
 let res;if(kind==='diff'){const big=ss.reduce((a,s)=>areaOf(s.paths)>areaOf(a.paths)?s:a);res=boolOp(big.paths,ss.filter(s=>s!==big).flatMap(s=>s.paths),'diff')}
 else if(kind==='union')res=boolOp(ss[0].paths,ss.slice(1).flatMap(s=>s.paths),'union');
 else{res=ss[0].paths;for(const s of ss.slice(1))res=boolOp(res,s.paths,'inter')}
 if(!res.length){toast(T('Результат пустой — фигуры не пересекаются.','The result is empty — shapes do not overlap.'));return}
 pushUndo();const layer=ss[0].layer,g=ss[0].g;S.shapes=S.shapes.filter(s=>!ss.includes(s));const n=addShape(S,layer,'bool',res,true,g?{g}:{});sel=new Set([n.id]);changed()}
function offsetSel(d){const ss=selShapes().filter(s=>s.closed&&s.kind!=='image');if(!ss.length){toast(T('Смещение работает с замкнутыми фигурами.','Offset needs closed shapes.'));return}
 const res=offsetPaths(ss.flatMap(s=>s.paths),d);if(!res.length){toast(T('Смещение съело фигуру целиком — уменьшите значение.','The offset consumed the shape — use a smaller value.'));return}
 pushUndo();const n=addShape(S,ss[0].layer,'offset',res,true);sel=new Set([n.id]);changed()}
function arraySel(cols,rows,gap){const ss=selShapes();if(!ss.length)return;const b=selBox(),w=b[2]-b[0]+gap,h=b[3]-b[1]+gap;pushUndo();const all=new Set(sel);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(!r&&!c)continue;for(const id of cloneShapes(ss,c*w,r*h))all.add(id)}sel=all;changed();toast(T(`Создано копий: ${cols*rows-1}`,`${cols*rows-1} copies created`))}
function circArraySel(n,r){const ss=selShapes();if(!ss.length||n<2)return;if(ss.some(s=>s.kind==='image')){toast(T('Круговой массив не работает с фото.','Circular arrays do not support photos.'));return}
 const b=selBox(),c=[(b[0]+b[2])/2,(b[1]+b[3])/2-r];pushUndo();const all=new Set(sel);for(let i=1;i<n;i++)for(const id of cloneShapes(ss,0,0,360*i/n,c))all.add(id);sel=all;changed();toast(T(`Создано копий: ${n-1}`,`${n-1} copies created`))}
async function updateText(txt,font,size){const s=selShapes()[0];if(!s||s.kind!=='text'||!txt.trim())return;const paths=await makeTextPaths(txt,font,size);if(!paths.length)return;
 const b=bboxOf(s.paths),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,nb=bboxOf(paths);let np=mapPaths(paths,(x,y)=>[x-(nb[2]-nb[0])/2+cx,y-(nb[3]-nb[1])/2+cy]);
 if(s.rot)np=rotPaths(np,s.rot,cx,cy);pushUndo();Object.assign(s,{paths:np,text:txt,font,size});changed()}

/* ---------- import: SVG ---------- */
function importSVG(text){
 const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;if(!root||root.nodeName.toLowerCase()!=='svg'||doc.querySelector('parsererror'))throw new Error('svg');
 const svg=document.importNode(root,true);const vb=(svg.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);
 const unit=a=>{const m=/^\s*([\d.]+)\s*(mm|cm|in|pt|pc|px)?/.exec(a||'');if(!m)return null;return +m[1]*({mm:1,cm:10,in:25.4,pt:25.4/72,pc:25.4/6,px:25.4/96}[m[2]||'px'])};
 const vw=vb.length===4?vb[2]:parseFloat(svg.getAttribute('width'))||100,vh=vb.length===4?vb[3]:parseFloat(svg.getAttribute('height'))||100;
 const wmm=unit(svg.getAttribute('width')),k=wmm&&vw?wmm/vw:25.4/96;
 svg.setAttribute('width',vw);svg.setAttribute('height',vh);if(vb.length!==4)svg.setAttribute('viewBox',`0 0 ${vw} ${vh}`);
 svg.setAttribute('style','position:absolute;left:-10000px;top:0;visibility:hidden');document.body.appendChild(svg);
 const out=[];
 try{for(const el of svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')){if(el.closest('defs,clipPath,mask,symbol,marker,pattern'))continue;
  let len=0;try{len=el.getTotalLength()}catch(e){}if(!len)continue;const step=Math.max(len/6000,.2/k),n=Math.ceil(len/step),m=el.getCTM(),pts=[];
  for(let i=0;i<=n;i++){let p=el.getPointAtLength(Math.min(len,i*step));if(m)p=p.matrixTransform(m);pts.push([p.x*k,(vh-p.y)*k])}
  const paths=[[pts[0]]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(Math.hypot(b[0]-a[0],b[1]-a[1])>step*k*4)paths.push([]);paths[paths.length-1].push(b)}
  const tag=el.nodeName.toLowerCase(),forced=['rect','circle','ellipse','polygon'].includes(tag);
  const clean=paths.filter(p=>p.length>1).map(p=>{const cl=forced||Math.hypot(p[0][0]-p[p.length-1][0],p[0][1]-p[p.length-1][1])<step*k*2.5;return{q:cl?rdpClosed(p.slice(0,-1),.02):rdp(p,.02),cl}});
  if(!clean.length)continue;const stroke=(el.getAttribute('stroke')||getComputedStyle(el).stroke||'').toLowerCase();
  if(clean.every(c=>c.cl))out.push({paths:clean.map(c=>c.q),closed:true,stroke});else for(const c of clean)out.push({paths:[c.q],closed:c.cl,stroke})}}
 finally{svg.remove()}
 if(!out.length)throw new Error('empty');
 placeImported(out,'svg');
}
/* ---------- import: DXF ---------- */
function importDXF(text){
 const L=text.split(/\r?\n/),pr=[];for(let i=0;i+1<L.length;i+=2)pr.push([parseInt(L[i].trim(),10),L[i+1].trim()]);
 let scale=1;for(let i=0;i<pr.length-1;i++)if(pr[i][0]===9&&pr[i][1]==='$INSUNITS'){const u=+pr[i+1][1];scale=u===1?25.4:u===2?304.8:u===5?10:u===6?1000:1}
 let i=pr.findIndex((p,k)=>p[0]===2&&p[1]==='ENTITIES'&&pr[k-1]&&pr[k-1][1]==='SECTION');if(i<0)throw new Error('dxf');
 const ents=[];let cur=null;for(i++;i<pr.length;i++){const[c,v]=pr[i];if(c===0){if(v==='ENDSEC')break;cur={type:v,d:[]};ents.push(cur)}else if(cur)cur.d.push([c,v])}
 const num=(e,c,def=0)=>{const p=e.d.find(q=>q[0]===c);return p?parseFloat(p[1]):def};
 const arcPts=(cx,cy,r,a0,a1)=>{if(a1<=a0)a1+=360;const n=Math.max(6,Math.ceil((a1-a0)*Math.PI/180*r/.5)),p=[];for(let k=0;k<=n;k++){const a=(a0+(a1-a0)*k/n)*Math.PI/180;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}return p};
 const bulge=(p1,p2,b)=>{const th=4*Math.atan(b),c=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);if(c<1e-9||Math.abs(b)<1e-9)return[];const r=c/(2*Math.sin(th/2)),d=r*Math.cos(th/2),ux=(p2[0]-p1[0])/c,uy=(p2[1]-p1[1])/c,cx=(p1[0]+p2[0])/2-uy*d,cy=(p1[1]+p2[1])/2+ux*d,a1=Math.atan2(p1[1]-cy,p1[0]-cx),n=Math.max(4,Math.ceil(Math.abs(th*r)/.5)),o=[];for(let k=1;k<n;k++){const a=a1+th*k/n;o.push([cx+Math.abs(r)*Math.cos(a),cy+Math.abs(r)*Math.sin(a)])}return o};
 const out=[],open=[];
 const vtxList=(d)=>{const v=[];let last=null;for(const[c,val]of d){if(c===10){last=[parseFloat(val),0,0];v.push(last)}else if(c===20&&last)last[1]=parseFloat(val);else if(c===42&&last)last[2]=parseFloat(val)}return v};
 const polyFrom=(v,closed)=>{const p=[];for(let k=0;k<v.length;k++){p.push([v[k][0],v[k][1]]);const nx=v[(k+1)%v.length];if(v[k][2]&&(k<v.length-1||closed))p.push(...bulge(v[k],nx,v[k][2]))}return p};
 for(let k=0;k<ents.length;k++){const e=ents[k];
  if(e.type==='LINE')open.push([[num(e,10),num(e,20)],[num(e,11),num(e,21)]]);
  else if(e.type==='LWPOLYLINE'){const cl=(num(e,70)&1)===1,p=polyFrom(vtxList(e.d),cl);if(p.length>1)(cl?out.push({paths:[p],closed:true}):open.push(p))}
  else if(e.type==='POLYLINE'){const cl=(num(e,70)&1)===1,v=[];while(ents[k+1]&&ents[k+1].type==='VERTEX'){k++;v.push([num(ents[k],10),num(ents[k],20),num(ents[k],42)])}const p=polyFrom(v,cl);if(p.length>1)(cl?out.push({paths:[p],closed:true}):open.push(p))}
  else if(e.type==='CIRCLE'){const r=num(e,40);out.push({paths:[ellipsePts(num(e,10),num(e,20),r,r)],closed:true})}
  else if(e.type==='ARC')open.push(arcPts(num(e,10),num(e,20),num(e,40),num(e,50),num(e,51)));
  else if(e.type==='ELLIPSE'){const cx=num(e,10),cy=num(e,20),mx=num(e,11),my=num(e,21),ra=num(e,40,1),t0=num(e,41,0),t1=num(e,42,Math.PI*2),R=Math.hypot(mx,my),rot=Math.atan2(my,mx);let t1b=t1<=t0?t1+Math.PI*2:t1;const n=Math.max(24,Math.ceil((t1b-t0)*R/.5)),p=[];
   for(let q=0;q<=n;q++){const t=t0+(t1b-t0)*q/n,x=R*Math.cos(t),y=R*ra*Math.sin(t);p.push([cx+x*Math.cos(rot)-y*Math.sin(rot),cy+x*Math.sin(rot)+y*Math.cos(rot)])}
   if(Math.abs(t1b-t0-Math.PI*2)<1e-3)out.push({paths:[p.slice(0,-1)],closed:true});else open.push(p)}
  else if(e.type==='SPLINE'){const fit=[],ctl=[];let lx=null;for(const[c,v]of e.d){if(c===11){lx=[+v,0];fit.push(lx)}else if(c===21&&lx)lx[1]=+v;else if(c===10){lx=[+v,0];ctl.push(lx)}else if(c===20&&lx)lx[1]=+v}const p=fit.length>1?fit:ctl;if(p.length>1){if((num(e,70)&1)===1)out.push({paths:[p],closed:true});else open.push(p)}}
 }
 // chain open segments into longer paths
 const tol=.01,used=new Array(open.length).fill(false),near=(a,b)=>Math.abs(a[0]-b[0])<tol&&Math.abs(a[1]-b[1])<tol;
 for(let a=0;a<open.length;a++){if(used[a])continue;used[a]=true;let ch=open[a].slice(),grew=true;
  while(grew){grew=false;for(let b=0;b<open.length;b++){if(used[b])continue;const q=open[b];
   if(near(ch[ch.length-1],q[0])){ch=ch.concat(q.slice(1));used[b]=grew=true}else if(near(ch[ch.length-1],q[q.length-1])){ch=ch.concat(q.slice(0,-1).reverse());used[b]=grew=true}
   else if(near(ch[0],q[q.length-1])){ch=q.slice(0,-1).concat(ch);used[b]=grew=true}else if(near(ch[0],q[0])){ch=q.slice(1).reverse().concat(ch);used[b]=grew=true}}}
  if(ch.length>2&&near(ch[0],ch[ch.length-1]))out.push({paths:[ch.slice(0,-1)],closed:true});else out.push({paths:[ch],closed:false})}
 if(!out.length)throw new Error('empty');
 for(const o of out)o.paths=mapPaths(o.paths,(x,y)=>[x*scale,y*scale]);
 placeImported(out,'dxf');
}
function placeImported(out,kind){
 let b=null;for(const o of out){const x=bboxOf(o.paths);b=b?unionBox(b,x):x}
 const base=S.sheet.on?[S.sheet.x+5,S.sheet.y+5]:[10,10],dx=plateX(curPlate)+base[0]-b[0],dy=base[1]-b[1];
 pushUndo();const ids=new Set(),g=out.length>1?S.nextG++:0;
 for(const o of out){const s=addShape(S,curDrawLayer,kind,mapPaths(o.paths,(x,y)=>[x+dx,y+dy]),o.closed,g?{g}:{});ids.add(s.id)}sel=ids;changed();
 const bw=b[2]-b[0],bh=b[3]-b[1];toast(T(`Импортировано контуров: ${out.length} · ${fx(bw,1)}×${fx(bh,1)} мм`,`Imported ${out.length} outlines · ${fx(bw,1)}×${fx(bh,1)} mm`));
}
/* ---------- import: images ---------- */
function loadImageFile(f){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(f)})}
function imageToDataURL(im,max=1600){const sc=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.round(im.naturalWidth*sc),h=Math.round(im.naturalHeight*sc),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);return{src:c.toDataURL('image/jpeg',.9),w,h}}
let pendingImg=null;
function imageChooser(im){pendingImg=im;
 openModal(T('Что сделать с изображением?','What should we do with the image?'),`<div class="wiz">
  <button data-act="imgRaster">${ic('image',22)}<b>${T('Гравировка фото','Photo engraving')}</b><small>${T('Растровая гравировка с дизерингом: Флойд–Стейнберг, Джарвис, Аткинсон, полутона.','Raster engraving with dithering: Floyd–Steinberg, Jarvis, Atkinson, grayscale.')}</small></button>
  <button data-act="imgTrace">${ic('wand',22)}<b>${T('Трассировка в контуры','Trace to outlines')}</b><small>${T('Логотипы и силуэты превращаются в векторы для резки.','Logos and silhouettes become vectors for cutting.')}</small></button>
  <button class="hero" data-act="imgLayered">${ic('layers',26)}<span><b>${T('Многослойная картина','Layered picture')}</b><small>${T('Разделить картинку на 1–10 слоёв по яркости и вырезать их из листов.','Split the picture into 1–10 depth layers and cut them from sheets.')}</small></span></button></div>`,null);
}
function addRasterImage(im){const d=imageToDataURL(im),ar=d.h/d.w,sh=S.sheet,w=Math.min(100,(sh.on?sh.w:S.machine.w)*.6),h=w*ar,x0=plateX(curPlate)+(sh.on?sh.x:0)+10,y0=(sh.on?sh.y:0)+10;
 pushUndo();const s=addShape(S,1,'image',[[[x0,y0],[x0+w,y0],[x0+w,y0+h],[x0,y0+h]]],true,{img:{src:d.src,mode:'jarvis',bright:0,contrast:0,gamma:1,invert:false,thr:128,fx:false,fy:false}});sel=new Set([s.id]);changed();
 toast(T('Фото добавлено на слой «Гравировка». Настройки дизеринга — справа.','Photo added to the Engrave layer. Dithering settings are on the right.'))}
let traceImg=null;
function openTrace(img){traceImg=img;
 openModal(T('Трассировка изображения','Trace image'),`<canvas id="traceCv" style="width:100%;max-height:300px;object-fit:contain;background:#fff;border-radius:8px;border:1px solid var(--line)"></canvas>
  <label class="fld"><span>${T('Порог','Threshold')}: <b id="thrV">128</b></span><input type="range" id="thr" min="10" max="245" value="128"></label>
  <div class="grid2"><label class="chk"><input type="checkbox" id="trInv"> ${T('Инвертировать','Invert')}</label>${numF(T('Ширина результата','Result width'),'id="trW" min="5"',Math.min(100,S.machine.w-20),MM(),1)}</div>
  <p class="note">${T('Тёмные области станут контурами. Лучше всего работают чёткие логотипы и силуэты.','Dark areas become outlines. Crisp logos and silhouettes work best.')}</p>`,
  `<button class="btn" data-act="closeModal">${T('Отмена','Cancel')}</button><button class="primary" data-act="doTrace">${T('Трассировать','Trace')}</button>`);
 const upd=()=>{$('#thrV').textContent=$('#thr').value;tracePreview()};$('#thr').oninput=upd;$('#trInv').onchange=upd;upd();
}
function traceMaskFrom(){const img=traceImg,sc=Math.min(1,700/Math.max(img.width,img.height)),w=Math.max(2,Math.round(img.width*sc)),h=Math.max(2,Math.round(img.height*sc));
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);const d=x.getImageData(0,0,w,h).data;
 const thr=+$('#thr').value,inv=$('#trInv').checked,m=new Uint8Array(w*h);for(let i=0;i<m.length;i++){const l=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];m[i]=(l<thr)!==inv?1:0}return{m,w,h}}
function tracePreview(){const{m,w,h}=traceMaskFrom(),c=$('#traceCv');c.width=w;c.height=h;const x=c.getContext('2d'),id=x.createImageData(w,h);for(let i=0;i<m.length;i++){const v=m[i]?20:255;id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=v;id.data[i*4+3]=255}x.putImageData(id,0,0)}
function doTrace(){const{m,w,h}=traceMaskFrom();let loops=traceMask(m,w,h).map(l=>rdpClosed(l,.8)).filter(l=>l.length>2&&Math.abs(area(l))>6);
 if(!loops.length){toast(T('Контуры не найдены — поменяйте порог.','No outlines found — adjust the threshold.'));return}
 const W=Math.max(5,+$('#trW').value||80),k=W/w;loops=loops.map(l=>l.map(([x,y])=>[x*k,(h-y)*k]));
 closeModal();placeImported([{paths:loops,closed:true}],'trace')}

/* ================= nesting (raster true-shape, part-in-part capable) ================= */
function nestArea(){const sh=S.sheet,m=S.machine;return sh.on?{x:sh.x+sh.margin,y:sh.y+sh.margin,w:sh.w-2*sh.margin,h:sh.h-2*sh.margin}:{x:3,y:3,w:m.w-6,h:m.h-6}}
function rasterItems(items,ox,oy,w,h,res,sp){
 const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);const x=c.getContext('2d');
 x.setTransform(1/res,0,0,1/res,-ox/res,-oy/res);x.fillStyle='#000';x.strokeStyle='#000';x.lineWidth=Math.max(sp,res*.5)+res;x.lineJoin='round';x.lineCap='round';
 let big=null,ba=-1;for(const it of items)if(it.closed){const b=bboxOf(it.paths),a=(b[2]-b[0])*(b[3]-b[1]);if(a>ba){ba=a;big=it}}
 for(const it of items){x.beginPath();for(const p of it.paths){p.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));if(it.closed)x.closePath()}
  if(it.closed)x.fill(it===big?'evenodd':'nonzero');x.stroke()}
 const d=x.getImageData(0,0,c.width,c.height).data,m=new Uint8Array(c.width*c.height);for(let i=0;i<m.length;i++)m[i]=d[i*4+3]>8?1:0;return m;
}
async function nestParts(parts,opt){
 opt=Object.assign({spacing:3,rotations:[0,90,180,270],newPlates:true,exclude:new Set(),startPlate:0},opt||{});
 const A=nestArea(),res=opt.res||Math.max(.5,Math.max(A.w,A.h)/340),gw=Math.floor(A.w/res),gh=Math.floor(A.h/res),sp=opt.spacing;
 const grids=[];
 const mkGrid=p=>{const occ=new Uint8Array(gw*gh),ex=S.shapes.filter(s=>!opt.exclude.has(s.id)&&p<S.plates&&plateOf(s)===p);
  if(ex.length){const m=rasterItems(ex.map(s=>({paths:s.paths,closed:s.closed})),plateX(p)+A.x,A.y,gw,gh,res,sp);for(let i=0;i<m.length;i++)occ[i]=m[i]}
  const pref=new Int32Array((gw+1)*gh);const g={occ,pref};for(let r=0;r<gh;r++)rowPref(g,r);return g};
 const rowPref=(g,r)=>{let s=0,o=r*(gw+1);g.pref[o]=0;for(let x=0;x<gw;x++){s+=g.occ[r*gw+x];g.pref[o+x+1]=s}};
 const prep=parts.map((pt,i)=>{const items=pt.items.map(it=>({paths:it.paths,closed:it.closed}));let a=0;for(const it of items)if(it.closed){const b=bboxOf(it.paths);a=Math.max(a,(b[2]-b[0])*(b[3]-b[1]))}let big=null,ba=-1;for(const it of items)if(it.closed){const b=bboxOf(it.paths),q=(b[2]-b[0])*(b[3]-b[1]);if(q>ba){ba=q;big=it}}return{i,items,a,mat:big?areaOf(big.paths):0,rots:pt.noRotate?[0]:opt.rotations}});
 prep.sort((a,b)=>b.a-a.a);
 const out=new Array(parts.length).fill(null);let plateCount=Math.max(S.plates,opt.startPlate+1),used=0,partArea=0;
 for(let pi=0;pi<prep.length;pi++){const pp=prep[pi];if(pi%3===0){busy(T(`Раскладка: ${pi+1} из ${prep.length}`,`Nesting: ${pi+1} of ${prep.length}`));await sleep(0)}
  const masks=pp.rots.map(ang=>{const its=pp.items.map(it=>({paths:rotPaths(it.paths,ang),closed:it.closed})),b=bboxOf(its.flatMap(it=>it.paths)),pad=sp/2+res,bx=b[0]-pad,by=b[1]-pad,pw=Math.ceil((b[2]-b[0]+2*pad)/res)+1,ph=Math.ceil((b[3]-b[1]+2*pad)/res)+1;
   if(pw>gw||ph>gh)return null;const m=rasterItems(its,bx,by,pw,ph,res,sp),spans=[];for(let r=0;r<ph;r++){let x=0;while(x<pw){while(x<pw&&!m[r*pw+x])x++;const s=x;while(x<pw&&m[r*pw+x])x++;if(x>s)spans.push([r,s,x-1])}}
   let cells=0;for(const s of spans)cells+=s[2]-s[1]+1;return{ang,bx,by,pw,ph,spans,cells}}).filter(Boolean);
  if(!masks.length)continue;
  let placed=false;
  for(let p=opt.startPlate;p<plateCount+(opt.newPlates?1:0)&&!placed;p++){
   if(!grids[p])grids[p]=mkGrid(p);const g=grids[p];let best=null;
   for(const mk of masks){const{spans,pw,ph}=mk;let found=null;
    outer:for(let gy=0;gy<=gh-ph;gy++)for(let gx=0;gx<=gw-pw;gx++){let ok=true;for(const[r,s,e]of spans){const o=(gy+r)*(gw+1);if(g.pref[o+gx+e+1]-g.pref[o+gx+s]){ok=false;break}}if(ok){found=[gx,gy];break outer}}
    if(found&&(!best||found[1]*gw*0.5+found[0]<best.gy*gw*0.5+best.gx))best={mk,gx:found[0],gy:found[1]}}
   if(best){const{mk,gx,gy}=best;for(const[r,s,e]of mk.spans){const row=gy+r;for(let x=s;x<=e;x++)g.occ[row*gw+gx+x]=1;rowPref(g,row)}
    out[pp.i]={plate:p,ang:mk.ang,tx:plateX(p)+A.x+gx*res-mk.bx,ty:A.y+gy*res-mk.by};placed=true;if(p>=plateCount)plateCount=p+1;used=Math.max(used,p+1);partArea+=pp.mat}}
 }
 busy(null);
 return{place:out,plates:plateCount,usage:partArea/(A.w*A.h*Math.max(1,used-opt.startPlate))};
}
// place generator / slicer parts into the project: parts=[{name, items:[{layer,kind,paths,closed,extra}], noRotate}]
async function placeParts(parts,opt){
 opt=Object.assign({nest:true,spacing:3},opt||{});if(!parts.length)return;
 pushUndo();const ids=new Set();let first=null,unplaced=0;
 if(opt.nest&&opt.nest!=='off'){
  const r=await nestParts(parts,{spacing:opt.spacing,newPlates:true,startPlate:opt.startPlate??curPlate});
  S.plates=Math.max(S.plates,r.plates);
  parts.forEach((pt,i)=>{const pl=r.place[i];if(!pl){unplaced++;return}const g=S.nextG++;if(first==null)first=pl.plate;
   for(const it of pt.items){const s=addShape(S,it.layer,it.kind||'part',mapPaths(rotPaths(it.paths,pl.ang),(x,y)=>[x+pl.tx,y+pl.ty]),it.closed,Object.assign({g,nm:pt.name},it.extra||{}));if(s.kind==='text'&&pl.ang)s.rot=((s.rot||0)+pl.ang)%360;ids.add(s.id)}});
  toast(T(`Разложено деталей: ${parts.length-unplaced} на листах: ${r.plates-(opt.startPlate??curPlate)} · заполнение ≈ ${Math.round(r.usage*100)}%`,`Placed ${parts.length-unplaced} parts on ${r.plates-(opt.startPlate??curPlate)} sheets · ≈ ${Math.round(r.usage*100)}% used`)+(unplaced?T(` · не поместилось: ${unplaced}`,` · did not fit: ${unplaced}`):''));
 }else{
  const A=nestArea();let x=A.x,y=A.y,rowH=0;const X0=plateX(curPlate);
  for(const pt of parts){const b=bboxOf(pt.items.flatMap(it=>it.paths)),w=b[2]-b[0],h=b[3]-b[1];if(x+w>A.x+A.w&&x>A.x){x=A.x;y+=rowH+opt.spacing;rowH=0}
   const g=S.nextG++;for(const it of pt.items){const s=addShape(S,it.layer,it.kind||'part',mapPaths(it.paths,(px,py)=>[px-b[0]+x+X0,py-b[1]+y]),it.closed,Object.assign({g,nm:pt.name},it.extra||{}));ids.add(s.id)}
   x+=w+opt.spacing;rowH=Math.max(rowH,h)}first=curPlate}
 sel=ids;if(first!=null)curPlate=first;changed();fitPlate(curPlate);draw();
}
async function nestSelection(spacing){
 const ss=selShapes().length?selShapes():S.shapes.filter(s=>plateOf(s)===curPlate);if(!ss.length){toast(T('Нечего раскладывать.','Nothing to nest.'));return}
 const units=new Map();for(const s of ss){const k=s.g?'g'+s.g:'s'+s.id;(units.get(k)||units.set(k,[]).get(k)).push(s)}
 const list=[...units.values()],parts=list.map(u=>({items:u.map(s=>({paths:s.paths,closed:s.closed})),noRotate:u.some(s=>s.kind==='image')}));
 const r=await nestParts(parts,{spacing,exclude:new Set(ss.map(s=>s.id)),startPlate:0});
 pushUndo();let un=0;S.plates=Math.max(S.plates,r.plates);
 list.forEach((u,i)=>{const pl=r.place[i];if(!pl){un++;return}for(const s of u){s.paths=mapPaths(rotPaths(s.paths,pl.ang),(x,y)=>[x+pl.tx,y+pl.ty]);if(s.kind==='text'&&pl.ang)s.rot=((s.rot||0)+pl.ang)%360}});
 changed();fitAll();draw();toast(T(`Раскладка готова · листов: ${r.plates} · заполнение ≈ ${Math.round(r.usage*100)}%`,`Nesting done · sheets: ${r.plates} · ≈ ${Math.round(r.usage*100)}% used`)+(un?T(` · не поместилось: ${un}`,` · did not fit: ${un}`):''));
}
