'use strict';
/* ============================================================================
   SkyKerf_Studio · 3D model slicer (spec 10.1)
   STL/OBJ → stacked layers (horizontal, vertical or diagonal) with optional
   alignment dowels, or an interlocked slotted grid. Parts go through the
   shared nesting subsystem.
   ============================================================================ */

/* ---------- three.js viewer (shared with generators) ---------- */
function createViewer(canvas){
 if(typeof THREE==='undefined')return null;
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true})}catch(e){return null}
 renderer.setClearColor(0x000000,0);
 const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(38,1,.5,50000);cam.up.set(0,0,1);
 scene.add(new THREE.HemisphereLight(0xffffff,0x3a4452,.7));const dl=new THREE.DirectionalLight(0xffffff,.75);dl.position.set(.6,-1,1.4);scene.add(dl);const dl2=new THREE.DirectionalLight(0xffffff,.25);dl2.position.set(-1,.8,.4);scene.add(dl2);
 const gModel=new THREE.Group(),gPlates=new THREE.Group();scene.add(gModel,gPlates);
 let tgt=new THREE.Vector3(),dist=400,yaw=-.9,pitch=.5,raf=0,alive=true,modelMat=null;
 const req=()=>{if(raf||!alive)return;raf=requestAnimationFrame(()=>{raf=0;render()})};
 function render(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.setSize(w,h,false);cam.aspect=w/h;cam.near=Math.max(.5,dist/300);cam.far=dist*30;cam.updateProjectionMatrix();
  cam.position.set(tgt.x+dist*Math.cos(pitch)*Math.cos(yaw),tgt.y+dist*Math.cos(pitch)*Math.sin(yaw),tgt.z+dist*Math.sin(pitch));cam.lookAt(tgt);renderer.render(scene,cam)}
 /* camera: left drag — orbit; right/middle drag, Shift or Ctrl — move; wheel — zoom towards the cursor;
    two fingers — move and pinch-zoom; on-screen buttons and arrow keys do the same */
 let dr=null,home=null;const touches=new Map();
 const right=()=>new THREE.Vector3(-Math.sin(yaw),Math.cos(yaw),0),upv=()=>new THREE.Vector3(-Math.sin(pitch)*Math.cos(yaw),-Math.sin(pitch)*Math.sin(yaw),Math.cos(pitch));
 const panPx=(dx,dy,base)=>{const s=dist/(canvas.clientHeight||400)*.9;tgt=(base||tgt).clone().addScaledVector(right(),-dx*s).addScaledVector(upv(),dy*s)};
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);touches.set(e.pointerId,[e.clientX,e.clientY]);dr={x:e.clientX,y:e.clientY,yaw,pitch,pan:e.button===2||e.button===1||e.shiftKey||e.ctrlKey||touches.size>1,t:tgt.clone(),d:dist,pinch:touches.size>1?pinchDist():0}});
 const pinchDist=()=>{const p=[...touches.values()];return p.length>1?Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]):0};
 canvas.addEventListener('pointermove',e=>{if(touches.has(e.pointerId))touches.set(e.pointerId,[e.clientX,e.clientY]);if(!dr)return;const dx=e.clientX-dr.x,dy=e.clientY-dr.y;
  if(touches.size>1&&dr.pinch){const k=dr.pinch/(pinchDist()||dr.pinch);dist=clamp(dr.d*k,5,60000);panPx(dx/2,dy/2,dr.t)}
  else if(dr.pan)panPx(dx,dy,dr.t);
  else{yaw=dr.yaw-dx*.008;pitch=clamp(dr.pitch+dy*.006,-1.45,1.5)}req()});
 const up=e=>{touches.delete(e.pointerId);dr=null};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
 canvas.addEventListener('wheel',e=>{e.preventDefault();const k=Math.exp(e.deltaY*.0012),r=canvas.getBoundingClientRect(),cx=e.clientX-r.left-r.width/2,cy=e.clientY-r.top-r.height/2;
  if(k<1)panPx(-cx*(1-k),-cy*(1-k));dist=clamp(dist*k,5,60000);req()},{passive:false});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.tabIndex=0;canvas.addEventListener('keydown',e=>{const st=60,map={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]};
  if(map[e.key]){e.preventDefault();if(e.shiftKey){yaw-=map[e.key][0]*.004;pitch=clamp(pitch-map[e.key][1]*.004,-1.45,1.5)}else panPx(-map[e.key][0],-map[e.key][1]);req()}
  else if(e.key==='+'||e.key==='='){dist=clamp(dist/1.25,5,60000);req()}else if(e.key==='-'){dist=clamp(dist*1.25,5,60000);req()}else if(e.key==='0'&&home){api.reset()}});
 // on-screen camera buttons
 let pad=null;const host=canvas.parentElement;
 if(host&&!canvas.dataset.nopad){pad=document.createElement('div');pad.className='campad';
  const B=(a,t,h)=>`<button type="button" data-cam="${a}" title="${t}">${h}</button>`;
  pad.innerHTML=`<button type="button" class="cp-fold" data-camfold="1" title="${T('Показать или спрятать кнопки камеры','Show or hide the camera buttons')}">${T('Камера','Camera')}</button><div class="cp-grid">${B('up',T('Сдвинуть вверх','Move up'),'▲')}${B('left',T('Сдвинуть влево','Move left'),'◀')}${B('reset',T('Исходный вид (0)','Reset view (0)'),'⟲')}${B('right',T('Сдвинуть вправо','Move right'),'▶')}${B('down',T('Сдвинуть вниз','Move down'),'▼')}</div>
   <div class="cp-col">${B('zin',T('Приблизить (+)','Zoom in (+)'),'+')}${B('zout',T('Отдалить (−)','Zoom out (−)'),'−')}</div>
   <div class="cp-col">${B('rl',T('Повернуть влево','Rotate left'),'↺')}${B('rr',T('Повернуть вправо','Rotate right'),'↻')}</div>
   <div class="cp-col">${B('tu',T('Наклон вверх','Tilt up'),'⤒')}${B('td',T('Наклон вниз','Tilt down'),'⤓')}</div>
   <div class="cp-views">${B('vFront',T('Спереди','Front'),T('Перед','Front'))}${B('vSide',T('Сбоку','Side'),T('Бок','Side'))}${B('vTop',T('Сверху','Top'),T('Верх','Top'))}${B('vIso',T('В изометрии','Isometric'),'3D')}</div>
   <small class="cp-hint">${T('ЛКМ — вращать · ПКМ/Shift — двигать · колесо — масштаб','Left drag — orbit · right drag/Shift — move · wheel — zoom')}</small>`;
  pad.addEventListener('pointerdown',e=>e.stopPropagation());
  if(store.get('camPad')!=='open')pad.classList.add('folded');
  pad.addEventListener('click',e=>{if(!e.target.closest('[data-camfold]'))return;const f=pad.classList.toggle('folded');store.set('camPad',f?'folded':'open')});
  let hold=0;const act=a=>{const st=40;({up:()=>panPx(0,-st),down:()=>panPx(0,st),left:()=>panPx(-st,0),right:()=>panPx(st,0),zin:()=>{dist=clamp(dist/1.2,5,60000)},zout:()=>{dist=clamp(dist*1.2,5,60000)},rl:()=>{yaw+=.12},rr:()=>{yaw-=.12},tu:()=>{pitch=clamp(pitch+.1,-1.45,1.5)},td:()=>{pitch=clamp(pitch-.1,-1.45,1.5)},reset:()=>api.reset(),vFront:()=>{yaw=-Math.PI/2;pitch=.05},vSide:()=>{yaw=0;pitch=.05},vTop:()=>{yaw=-Math.PI/2;pitch=1.49},vIso:()=>{yaw=-.9;pitch=.5}}[a]||(()=>{}))();req()};
  pad.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-cam]');if(!b)return;e.preventDefault();act(b.dataset.cam);if(/^(up|down|left|right|zin|zout|rl|rr|tu|td)$/.test(b.dataset.cam)){clearInterval(hold);hold=setInterval(()=>act(b.dataset.cam),70)}});
  const stop=()=>clearInterval(hold);pad.addEventListener('pointerup',stop);pad.addEventListener('pointerleave',stop);
  host.appendChild(pad)}
 const ro=new ResizeObserver(req);ro.observe(canvas);
 const clear=g=>{for(const c of[...g.children]){g.remove(c);if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose()}};
 const api={
  setMesh(mesh){clear(gModel);modelMat=null;if(!mesh){req();return}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(mesh.pos,3));geo.setIndex(new THREE.BufferAttribute(mesh.idx,1));geo.computeVertexNormals();
   modelMat=new THREE.MeshStandardMaterial({color:0xa9b4c2,roughness:.55,metalness:.05,transparent:true,opacity:1,side:THREE.DoubleSide});gModel.add(new THREE.Mesh(geo,modelMat));req()},
  setPlates(list){clear(gPlates);for(const p of list||[]){for(const c of components(p.paths)){const sh=new THREE.Shape(c[0].map(q=>new THREE.Vector2(q[0],q[1])));for(const h of c.slice(1))sh.holes.push(new THREE.Path(h.map(q=>new THREE.Vector2(q[0],q[1]))));
    let geo;try{geo=new THREE.ExtrudeGeometry(sh,{depth:p.t,bevelEnabled:false,curveSegments:2})}catch(e){continue}
    const m=new THREE.Matrix4().makeBasis(new THREE.Vector3(...p.u),new THREE.Vector3(...p.v),new THREE.Vector3(...p.n));m.setPosition(new THREE.Vector3(...p.origin));geo.applyMatrix4(m);
    gPlates.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:new THREE.Color(p.color||'#c99c62'),roughness:.82,metalness:0,side:THREE.DoubleSide})))}}req()},
  show(model,plates,ghost){gModel.visible=!!model;gPlates.visible=!!plates;if(modelMat){modelMat.opacity=ghost?.16:1;modelMat.depthWrite=!ghost}req()},
  fit(b){tgt.set((b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2);const r=Math.hypot(b[3]-b[0],b[4]-b[1],b[5]-b[2])/2||50;dist=r/Math.tan(19*Math.PI/180)*1.1;home={t:tgt.clone(),dist,yaw,pitch};req()},
  reset(){if(home){tgt=home.t.clone();dist=home.dist;yaw=-.9;pitch=.5}req()},
  showPad(v){if(pad)pad.hidden=!v},
  fitPlates(){const b=new THREE.Box3().setFromObject(gPlates);if(b.isEmpty())return;this.fit([b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z])},
  render:req,
  dispose(){alive=false;ro.disconnect();clear(gModel);clear(gPlates);renderer.dispose();if(pad)pad.remove()}
 };
 return api;
}

/* ---------- mesh I/O ---------- */
function parseSTL(buf){
 const dv=new DataView(buf);
 if(buf.byteLength>=84){const n=dv.getUint32(80,true);if(84+n*50===buf.byteLength){const out=new Float32Array(n*9);for(let i=0;i<n;i++){const o=84+i*50+12;for(let k=0;k<9;k++)out[i*9+k]=dv.getFloat32(o+k*4,true)}return out}}
 const txt=new TextDecoder().decode(buf),re=/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g,a=[];let m;while((m=re.exec(txt)))a.push(+m[1],+m[2],+m[3]);return new Float32Array(a);
}
function parseOBJ(txt){const v=[],f=[];
 for(const line of txt.split('\n')){const s=line.trim();if(s.startsWith('v ')){const p=s.split(/\s+/);v.push([+p[1],+p[2],+p[3]])}
  else if(s.startsWith('f ')){const p=s.split(/\s+/).slice(1).map(t=>{const i=parseInt(t.split('/')[0],10);return i<0?v.length+i:i-1});for(let k=1;k+1<p.length;k++)f.push(p[0],p[k],p[k+1])}}
 const out=new Float32Array(f.length*3);f.forEach((vi,i)=>{const q=v[vi]||[0,0,0];out[i*3]=q[0];out[i*3+1]=q[1];out[i*3+2]=q[2]});return out}
function indexMesh(soup){const map=new Map(),pos=[],idx=new Uint32Array(soup.length/3);
 for(let i=0;i<soup.length;i+=3){const k=Math.round(soup[i]*1e4)+'_'+Math.round(soup[i+1]*1e4)+'_'+Math.round(soup[i+2]*1e4);let j=map.get(k);if(j===undefined){j=pos.length/3;map.set(k,j);pos.push(soup[i],soup[i+1],soup[i+2])}idx[i/3]=j}
 const keep=[];for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2];if(a!==b&&b!==c&&a!==c)keep.push(a,b,c)}
 return{pos:new Float32Array(pos),idx:new Uint32Array(keep)}}
function latheMesh(profile,seg){const pos=[],idx=[],R=profile.length;
 for(const[r,z]of profile)for(let s=0;s<seg;s++){const a=s/seg*Math.PI*2;pos.push(r*Math.cos(a),r*Math.sin(a),z)}
 for(let i=0;i<R-1;i++)for(let s=0;s<seg;s++){const a=i*seg+s,b=i*seg+(s+1)%seg,c=(i+1)*seg+s,d=(i+1)*seg+(s+1)%seg;idx.push(a,b,d,a,d,c)}
 const bc=pos.length/3;pos.push(0,0,profile[0][1]);const tc=pos.length/3;pos.push(0,0,profile[R-1][1]);
 for(let s=0;s<seg;s++){idx.push(bc,(s+1)%seg,s);idx.push(tc,(R-1)*seg+s,(R-1)*seg+(s+1)%seg)}
 return{pos:new Float32Array(pos),idx:new Uint32Array(idx)}}
function sampleVase(){const p=[];for(let i=0;i<=64;i++){const z=i/64*150,r=26+15*Math.sin(z/150*Math.PI*1.3+.15)+5*Math.sin(z/150*Math.PI*5.2)-(z>136?(z-136)*.9:0);p.push([Math.max(5,r),z])}return latheMesh(p,96)}
function sampleTorus(){const R=55,r=22,nu=96,nv=40,pos=[],idx=[];
 for(let i=0;i<nu;i++){const u=i/nu*Math.PI*2;for(let j=0;j<nv;j++){const v=j/nv*Math.PI*2,w=1+.18*Math.sin(u*3);pos.push((R+r*w*Math.cos(v))*Math.cos(u),(R+r*w*Math.cos(v))*Math.sin(u),r*w*Math.sin(v))}}
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*nv+j,b=((i+1)%nu)*nv+j,c=((i+1)%nu)*nv+(j+1)%nv,d=i*nv+(j+1)%nv;idx.push(a,b,c,a,c,d)}
 return{pos:new Float32Array(pos),idx:new Uint32Array(idx)}}

/* ---------- state ---------- */
const slReq=()=>({thick:SL.t,mat:sheetAt(curPlate).mat});
const SL={base:null,name:'',size:150,method:'stack',axis:'z',az:30,tilt:45,rn:3,t:3,dowels:true,dd:4,dn:2,reg:true,nums:true,ca:6,cb:6,diag:false,fit:.15,view:'both',res:null,viewer:null,mesh:null,dims:[0,0,0],spacing:3};
function meshBounds(pos){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++){const v=pos[i+k];if(v<b[k])b[k]=v;if(v>b[k+3])b[k+3]=v}return b}
function slPrepare(){const p=SL.base.pos,b=meshBounds(p),k=SL.size/((b[5]-b[2])||1),out=new Float32Array(p.length);
 for(let i=0;i<p.length;i+=3){out[i]=(p[i]-b[0])*k;out[i+1]=(p[i+1]-b[1])*k;out[i+2]=(p[i+2]-b[2])*k}
 SL.mesh={pos:out,idx:SL.base.idx};SL.dims=[(b[3]-b[0])*k,(b[4]-b[1])*k,(b[5]-b[2])*k]}
function slRotate(ax){const p=SL.base.pos,b0=meshBounds(p),k=SL.size/((b0[5]-b0[2])||1);
 for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],z=p[i+2];if(ax==='x'){p[i+1]=-z;p[i+2]=y}else if(ax==='y'){p[i]=z;p[i+2]=-x}else{p[i]=-y;p[i+1]=x}}
 const b1=meshBounds(p);SL.size=fx(Math.max(5,k*(b1[5]-b1[2])),1);slPrepare();slRenderSide();slRefresh(true)}

/* ---------- plane slicing ---------- */
function sliceAt(mesh,n,d,u,v){
 const P=mesh.pos,I=mesh.idx,NV=P.length/3,sd=new Float64Array(NV);
 const pts=new Map(),sa=[],sb=[];
 const fast=typeof sliceSegK==='function'?sliceSegK(mesh,n,d,u,v):null;
 if(fast){for(let i=0;i<fast.n;i++){const ka=fast.key[4*i]*NV+fast.key[4*i+1],kb=fast.key[4*i+2]*NV+fast.key[4*i+3];if(!pts.has(ka))pts.set(ka,[fast.seg[4*i],fast.seg[4*i+1]]);if(!pts.has(kb))pts.set(kb,[fast.seg[4*i+2],fast.seg[4*i+3]]);sa.push(ka);sb.push(kb)}}else{
 for(let i=0;i<NV;i++)sd[i]=P[3*i]*n[0]+P[3*i+1]*n[1]+P[3*i+2]*n[2]-d;
 const pt=(a,b)=>{const k=a<b?a*NV+b:b*NV+a;if(!pts.has(k)){const t=sd[a]/(sd[a]-sd[b]),x=P[3*a]+(P[3*b]-P[3*a])*t,y=P[3*a+1]+(P[3*b+1]-P[3*a+1])*t,z=P[3*a+2]+(P[3*b+2]-P[3*a+2])*t;
  pts.set(k,[x*u[0]+y*u[1]+z*u[2],x*v[0]+y*v[1]+z*v[2]])}return k};
 for(let f=0;f<I.length;f+=3){const a=I[f],b=I[f+1],c=I[f+2],A=sd[a]>=0,B=sd[b]>=0,C=sd[c]>=0;if(A===B&&B===C)continue;
  const ks=[];if(A!==B)ks.push(pt(a,b));if(B!==C)ks.push(pt(b,c));if(C!==A)ks.push(pt(c,a));if(ks.length===2){sa.push(ks[0]);sb.push(ks[1])}}}
 const adj=new Map();for(let i=0;i<sa.length;i++){for(const k of[sa[i],sb[i]]){const l=adj.get(k);l?l.push(i):adj.set(k,[i])}}
 const used=new Uint8Array(sa.length),loops=[];
 for(let i=0;i<sa.length;i++){if(used[i])continue;used[i]=1;const start=sa[i];let cur=sb[i];const loop=[pts.get(start)];let g=0;
  while(cur!==start&&g++<1e6){loop.push(pts.get(cur));const c=adj.get(cur);let nx=-1;for(const j of c)if(!used[j]){nx=j;break}if(nx<0)break;used[nx]=1;cur=sa[nx]===cur?sb[nx]:sa[nx]}
  if(loop.length>2)loops.push(loop)}
 let out=hasClip()?cleanPaths(loops):loops;
 return out.map(l=>rdpClosed(l,.03)).filter(l=>l.length>2&&Math.abs(area(l))>.3);
}
function axisRange(mesh,n){let lo=Infinity,hi=-Infinity;const P=mesh.pos;for(let i=0;i<P.length;i+=3){const d=P[i]*n[0]+P[i+1]*n[1]+P[i+2]*n[2];if(d<lo)lo=d;if(d>hi)hi=d}return[lo,hi]}
function pickPins(reg,count,avoid,minSep){
 const b=bboxOf(reg),step=Math.max(Math.hypot(b[2]-b[0],b[3]-b[1])/45,.6);let c=[];
 for(let y=b[1]+step/2;y<b[3];y+=step)for(let x=b[0]+step/2;x<b[2];x+=step){const p=[x,y];if(inPolys(p,reg)&&avoid.every(a=>Math.hypot(a[0]-x,a[1]-y)>=minSep))c.push(p)}
 if(!c.length)return[];if(c.length>420){const st=Math.ceil(c.length/420);c=c.filter((_,i)=>i%st===0)}
 if(count===1){const dp=deepPoint(reg,avoid.map(a=>[a[0],a[1],minSep]));return dp?[dp.p]:[c[0]]}
 let best=[c[0],c[0]],bd=-1;for(let i=0;i<c.length;i++)for(let j=i+1;j<c.length;j++){const d=Math.hypot(c[i][0]-c[j][0],c[i][1]-c[j][1]);if(d>bd){bd=d;best=[c[i],c[j]]}}
 if(bd<minSep)return[best[0]];const out=[best[0],best[1]];
 while(out.length<count){let bp=null,bm=-1;for(const p of c){let m=Infinity;for(const q of out)m=Math.min(m,Math.hypot(p[0]-q[0],p[1]-q[1]));if(m>bm){bm=m;bp=p}}if(!bp||bm<minSep)break;out.push(bp)}
 return out;
}
async function labelItem(text,comp,avoid){
 for(const sz of[6,4.5,3,2.2]){const need=sz*.36*Math.max(2,text.length)+sz*.2,dp=deepPoint(comp,avoid,need);if(dp){const p=await textAt(text,'mono',sz,dp.p[0],dp.p[1]);if(p.length)return{layer:markLayer(),kind:'text',paths:p,closed:true,extra:{text,font:'mono',size:sz,rot:0}}}}
 return null;
}
const LETTERS='abcdefghijklmnopqrstuvwxyz';
async function slStack(){
 const mesh=SL.mesh,A=slAxis();
 const[lo,hi]=axisRange(mesh,A.n),L=hi-lo,t=SL.t,n=clamp(Math.round(L/t),1,600),step=L/n,slices=[],warn=[];
 for(let k=0;k<n;k++){slices.push(sliceAt(mesh,A.n,lo+(k+.5)*step,A.u,A.v));if(k%6===5){busy(T(`Режу слои: ${k+1} из ${n}`,`Slicing: ${k+1} of ${n}`));await sleep(0)}}
 const pins=[],r=SL.dd/2,marg=Math.max(1.5,SL.dd*.4);
 if(SL.dowels&&hasClip()&&n>1){busy(T('Подбираю места для штифтов…','Placing dowels…'));await sleep(0);
  const R=slices.map(s=>s.length?offsetPaths(s,-(r+marg)):[]);let i=0;
  while(i<n-1){if(!R[i].length){i++;continue}let reg=R[i],j=i+1;
   while(j<n&&R[j].length){const nr=boolOp(reg,R[j],'inter');if(!nr.length||areaOf(nr)<Math.PI*r*r*1.5)break;reg=nr;j++}
   if(j-1>i){const avoid=pins.filter(p=>p.k1>=i&&p.k0<=j-1).map(p=>[p.x,p.y]),pts=pickPins(reg,SL.dn,avoid,2*(r+marg));if(pts.length){for(const q of pts)pins.push({x:q[0],y:q[1],k0:i,k1:j-1});i=j-1}else i=j}
   else i=j}
  let un=0;for(let k=0;k<n-1;k++)if(slices[k].length&&slices[k+1].length&&!pins.some(p=>p.k0<=k&&p.k1>=k+1))un++;
  if(un)warn.push(T(`Пар слоёв без штифтов: ${un} — там слои склеиваются по гравировке-разметке.`,`${un} layer pairs have no dowel — glue them using the score marks.`))}
 if(SL.dowels&&!hasClip())warn.push(T('Штифты недоступны без библиотеки Clipper.','Dowels need the Clipper library.'));
 // assembly sequence check: every layer must rest on the previous one
 if(hasClip()){let floating=[];for(let k=1;k<n;k++){if(!slices[k].length||!slices[k-1].length)continue;const it=boolOp(slices[k],slices[k-1],'inter');if(!it.length||areaOf(it)<1)floating.push(k+1)}
  if(floating.length)warn.push(T(`Слои без опоры на предыдущий: ${floating.slice(0,8).join(', ')}${floating.length>8?'…':''} — понадобится подставка или склейка с поддержкой.`,`Layers not resting on the previous one: ${floating.slice(0,8).join(', ')}${floating.length>8?'…':''} — they need a support while gluing.`))}
 const parts=[],asm=[],hr=r+SL.fit/2;
 for(let k=0;k<n;k++){if(!slices[k].length)continue;if(k%5===4){busy(T(`Готовлю детали: ${k+1} из ${n}`,`Preparing parts: ${k+1} of ${n}`));await sleep(0)}
  const myPins=pins.filter(p=>p.k0<=k&&p.k1>=k),paths=slices[k].concat(myPins.map(p=>ellipsePts(p.x,p.y,hr,hr,28))),comps=components(paths);
  let reg=[];if(SL.reg&&k<n-1&&slices[k+1].length&&hasClip()){const it=boolOp(slices[k+1],slices[k],'inter');if(it.length)reg=offsetPaths(it,-.5)}
  const nm=String(k+1);
  for(let ci=0;ci<comps.length;ci++){const comp=comps[ci],label=nm+(comps.length>1?LETTERS[ci%26]:''),items=[{layer:0,kind:'part',paths:comp,closed:true}];
   const myReg=reg.filter(l=>inPolys(l[0],comp));if(myReg.length)items.push({layer:markLayer(),kind:'part',paths:myReg,closed:true});
   if(SL.nums){const it=await labelItem(label,comp,myPins.map(p=>[p.x,p.y,hr+1]));if(it)items.push(it)}
   parts.push({name:T('Слой ','Layer ')+label,items,req:slReq()});asm.push({paths:comp,origin:A.n.map(c=>c*(lo+k*t)),u:A.u,v:A.v,n:A.n,t,color:hslHex(28+(k%2)*6,42+(k%3)*6,58+(k%2)*8)})}}
 const bomMap=new Map();for(const p of pins){const len=fx((p.k1-p.k0+1)*t-1,1);bomMap.set(len,(bomMap.get(len)||0)+1)}
 const bom=[...bomMap].sort((a,b)=>b[0]-a[0]).map(([l,c])=>T(`Штифт ⌀${SL.dd} × ${l} мм — ${c} шт.`,`Dowel ⌀${SL.dd} × ${l} mm — ${c} pcs`));
 return{parts,asm,warn,bom,info:T(`${n} слоёв по ${t} мм · деталей: ${parts.length}`,`${n} layers of ${t} mm · ${parts.length} parts`)};
}
async function slWaffle(){
 const mesh=SL.mesh,th=SL.diag?Math.PI/4:0,c=Math.cos(th),s=Math.sin(th),nA=[c,s,0],tA=[-s,c,0],nB=tA,tB=nA,Z=[0,0,1],t=SL.t,w=t+SL.fit,warn=[];
 const[a0,a1]=axisRange(mesh,nA),[b0,b1]=axisRange(mesh,nB),ca=clamp(SL.ca|0,1,60),cb=clamp(SL.cb|0,0,60);
 const offA=Array.from({length:ca},(_,i)=>a0+(a1-a0)*(i+1)/(ca+1)),offB=Array.from({length:cb},(_,i)=>b0+(b1-b0)*(i+1)/(cb+1));
 busy(T('Режу решётку…','Slicing the grid…'));await sleep(0);
 let A=offA.map(a=>sliceAt(mesh,nA,a,tA,Z)),B=offB.map(b=>sliceAt(mesh,nB,b,tB,Z));
 const iv=(paths,u)=>{const vs=[];for(const p of paths)for(let i=0;i<p.length;i++){const P=p[i],Q=p[(i+1)%p.length];if((P[0]<=u&&Q[0]>u)||(Q[0]<=u&&P[0]>u))vs.push(P[1]+(u-P[0])/(Q[0]-P[0])*(Q[1]-P[1]))}vs.sort((x,y)=>x-y);const o=[];for(let k=0;k+1<vs.length;k+=2)o.push([vs[k],vs[k+1]]);return o};
 const sA=A.map(()=>[]),sB=B.map(()=>[]);
 for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++){for(const ia of iv(A[i],offB[j]))for(const ib of iv(B[j],offA[i])){const o0=Math.max(ia[0],ib[0]),o1=Math.min(ia[1],ib[1]);if(o1-o0<.8)continue;const mid=(o0+o1)/2;
  sA[i].push(rectPts(offB[j]-w/2,mid,w,ia[1]-mid+1));sB[j].push(rectPts(offA[i]-w/2,ib[0]-1,w,mid-ib[0]+1))}}
 if(hasClip()){let split=0;const ap=(set,sl)=>set.map((paths,i)=>{if(!sl[i].length)return paths;const before=components(paths).length,r=boolOp(paths,sl[i],'diff');if(components(r).length>before)split++;return r});A=ap(A,sA);B=ap(B,sB);
  if(split)warn.push(T(`Пазы разрезали деталей на части: ${split}. Уменьшите число рёбер или сдвиньте модель.`,`Slots split ${split} parts into pieces. Use fewer ribs or move the model.`))}
 else warn.push(T('Пазы недоступны без библиотеки Clipper.','Slots need the Clipper library.'));
 const parts=[],asm=[];
 const add=async(set,offs,pref,n,u,col)=>{for(let i=0;i<set.length;i++){const comps=components(set[i]);for(let ci=0;ci<comps.length;ci++){const comp=comps[ci],label=pref+(i+1)+(comps.length>1?LETTERS[ci%26]:''),items=[{layer:0,kind:'part',paths:comp,closed:true}];
  if(SL.nums){const it=await labelItem(label,comp,[]);if(it)items.push(it)}parts.push({name:label,items,req:slReq()});asm.push({paths:comp,origin:n.map(q=>q*(offs[i]-t/2)),u,v:Z,n,t,color:col})}}};
 await add(A,offA,'A',nA,tA,hslHex(30,45,60));await add(B,offB,'B',nB,tB,hslHex(205,30,62));
 return{parts,asm,warn,bom:[T('Рёбра A ставятся пазами вниз, рёбра B — пазами вверх, номера идут слева направо.','Ribs A go slots-down, ribs B slots-up; numbers run left to right.'),T(`Ширина паза ${fx(w,2)} мм — подгонка ${SL.fit} мм.`,`Slot width ${fx(w,2)} mm — fit ${SL.fit} mm.`)],info:T(`Решётка ${ca}×${cb}${SL.diag?' под 45°':''} · деталей: ${parts.length}`,`Grid ${ca}×${cb}${SL.diag?' at 45°':''} · ${parts.length} parts`)};
}

/* ---------- workspace UI ---------- */
function openSlicer(){
 if(!SL.base){SL.base=sampleVase();SL.name=T('Ваза (пример)','Vase (sample)');SL.size=150}
 const sh0=sheetAt(curPlate),m0=matById(sh0.mat);SL.t=sh0.thick;if(!SL.fitTouched)SL.fit=fx(((m0&&m0.fit!=null)?m0.fit:.05)+.1,2);slPrepare();
 openModal(`${ic('slices',18)} ${T('3D-модель → слои','3D model → sheet parts')}`,`<div class="ws-view"><canvas id="slCv"></canvas><div class="float" id="slVb"></div><div class="badge" id="slInfo">…</div></div><div class="ws-side" id="slSide"></div>`,
  `<p class="note">${T('Детали лягут на слой «Резка», номера и разметка — на «Разметку». Если детали не поместятся на лист, откроется раскладка.','Parts go to the Cut layer; numbers and marks to Mark. If the parts do not fit on the sheet, the layout window opens.')}</p><button class="btn" data-act="closeModal">${T('Отмена','Cancel')}</button><button class="primary" data-act="slPlace">${ic('nest',15)} ${T('Разложить…','Nest…')}</button>`,'xl');
 onModalClose=()=>{if(SL.viewer){SL.viewer.dispose();SL.viewer=null}};
 SL.viewer=createViewer($('#slCv'));if(!SL.viewer)$('#slInfo').textContent=T('3D-просмотр недоступен (нет WebGL), но нарезка работает.','3D preview unavailable (no WebGL), slicing still works.');
 slRenderSide();slRefresh(true);
}
function slRenderSide(){
 const st=SL.method==='stack',d=SL.dims;
 $('#slVb').innerHTML=`<div class="seg">${[['model',T('Модель','Model')],['both',T('Вместе','Both')],['parts',T('Сборка','Assembly')]].map(([v,n])=>`<button data-act="slView" data-v="${v}" aria-pressed="${SL.view===v}">${n}</button>`).join('')}</div>`;
 $('#slSide').innerHTML=`<div class="sec"><h3>${T('Модель','Model')}</h3><div class="row"><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(SL.name)}</b><span class="pill mut">${(SL.base.idx.length/3).toLocaleString(lang)} ${T('треуг.','tris')}</span></div>
  <div class="grid3"><button class="btn" data-act="slOpen">${ic('open',14)} STL/OBJ</button><button class="btn" data-act="slSample" data-v="vase">${T('Ваза','Vase')}</button><button class="btn" data-act="slSample" data-v="torus">${T('Тор','Torus')}</button></div>
  ${selF(T('Готовые формы','Ready shapes'),'data-sl="prim"',[['',T('— выбрать —','— choose —')]].concat(SL_PRIMS().map(p=>[p[0],p[1]])),'')}
  ${numF(T('Высота модели (Z)','Model height (Z)'),'data-sl="size" min="5"',fx(SL.size,1),MM(),1)}
  <p class="note">${T('Габарит','Size')}: <b>${fx(d[0],1)} × ${fx(d[1],1)} × ${fx(d[2],1)} ${MM()}</b></p>
  <div class="grid3"><button class="btn" data-act="slRot" data-v="x">⟲ X 90°</button><button class="btn" data-act="slRot" data-v="y">⟲ Y 90°</button><button class="btn" data-act="slRot" data-v="z">⟲ Z 90°</button></div></div>
  <div class="sec"><h3>${T('Способ сборки','Construction')}</h3>
  <div class="seg full"><button data-act="slMethod" data-v="stack" aria-pressed="${st}">${T('Стопка','Stack')}</button><button data-act="slMethod" data-v="waffle" aria-pressed="${SL.method==='waffle'}">${T('Решётка','Grid')}</button><button data-act="slMethod" data-v="radial" aria-pressed="${SL.method==='radial'}">${T('Звезда','Radial')}</button></div>
  ${numF(T('Толщина листа','Sheet thickness'),'data-sl="t" min="0.2"',SL.t,MM(),.1)}
  ${st?`${selF(T('Направление слоёв','Slice direction'),'data-sl="axis"',[['z',T('горизонтально (по Z)','horizontal (along Z)')],['x',T('вертикально (по X)','vertical (along X)')],['y',T('вертикально (по Y)','vertical (along Y)')],['d',T('вертикально по диагонали (45°)','vertical diagonal (45°)')],['dz',T('наклонно сверху (45°)','tilted from the top (45°)')],['custom',T('под своим углом','custom angle')]],SL.axis)}
   ${SL.axis==='custom'?`<div class="grid2">${numF(T('Наклон от вертикали','Tilt from vertical'),'data-sl="tilt" min="0" max="90"',SL.tilt,'°',5)}${numF(T('Поворот вокруг Z','Turn around Z'),'data-sl="az" min="-180" max="180"',SL.az,'°',5)}</div>`:''}
   <label class="chk"><input type="checkbox" data-sl="dowels" ${SL.dowels?'checked':''}> ${T('Точки крепления (штифты)','Alignment dowels')}</label>
   ${SL.dowels?`<div class="grid2">${numF(T('Диаметр штифта','Dowel diameter'),'data-sl="dd" min="1"',SL.dd,MM(),.5)}${numF(T('Штифтов на группу','Dowels per group'),'data-sl="dn" min="1" max="4"',SL.dn,'',1)}</div>`:''}
   <label class="chk"><input type="checkbox" data-sl="reg" ${SL.reg?'checked':''}> ${T('Разметка контура следующего слоя','Score the outline of the next layer')}</label>`:
   SL.method==='radial'?`${numF(T('Пластин','Plates'),'data-sl="rn" min="2" max="8"',SL.rn,'',1)}<p class="note">${T('Вертикальные пластины через центр модели, как звезда. Пазы чередуются по высоте: пластины ставятся по номерам, каждая сверху вниз.','Vertical plates through the model centre, like a star. Slots alternate by height: put the plates in by number, each sliding down from the top.')}</p>`:`<div class="grid2">${numF(T('Рёбер A','Ribs A'),'data-sl="ca" min="1" max="60"',SL.ca,'',1)}${numF(T('Рёбер B','Ribs B'),'data-sl="cb" min="0" max="60"',SL.cb,'',1)}</div>
   <label class="chk"><input type="checkbox" data-sl="diag" ${SL.diag?'checked':''}> ${T('По диагонали (45°)','Diagonal (45°)')}</label>`}
  ${numF(T('Подгонка (зазор отверстий и пазов)','Fit allowance (holes & slots)'),'data-sl="fit" min="0" max="1"',SL.fit,MM(),.05,'pro')}
  <label class="chk"><input type="checkbox" data-sl="nums" ${SL.nums?'checked':''}> ${T('Номера деталей','Part numbers')}</label></div>
  <div class="sec"><h3>${T('Результат','Result')}</h3><div class="bom" id="slRes">…</div></div>`;
}
let slT=0;
function slRefresh(refit){clearTimeout(slT);slT=setTimeout(async()=>{
 if(SL.viewer){SL.viewer.setMesh(SL.mesh);if(refit)SL.viewer.fit([0,0,0,...SL.dims])}
 try{SL.res=SL.method==='stack'?await slStack():SL.method==='radial'?await slRadial():await slWaffle()}catch(e){SL.res=null;$('#slInfo').textContent='⚠ '+(e.message||e)}finally{busy(null)}
 if(!SL.res||!$('#slRes'))return;const r=SL.res,area=r.parts.reduce((s,p)=>s+areaOf(p.items[0].paths),0),sh=sheetAt(curPlate),A={w:sh.w-2*sh.margin,h:sh.h-2*sh.margin},sheets=Math.max(1,Math.ceil(area/(A.w*A.h*.62)));
 $('#slInfo').textContent=r.info;
 $('#slRes').innerHTML=[`<b>${T('Деталей','Parts')}: ${r.parts.length}</b>`,T(`Материал ≈ ${fx(area/100,0)} см² · листов ≈ ${sheets} (${fx(A.w,0)}×${fx(A.h,0)} мм)`,`Material ≈ ${fx(area/100,0)} cm² · sheets ≈ ${sheets} (${fx(A.w,0)}×${fx(A.h,0)} mm)`),...r.bom.map(esc),...r.warn.map(w=>`<span style="color:var(--warn)">⚠ ${esc(w)}</span>`)].map(x=>`<div>${x}</div>`).join('');
 if(SL.viewer){SL.viewer.setPlates(r.asm);slApplyView()}},refit?60:260)}
function slApplyView(){if(!SL.viewer)return;SL.viewer.show(SL.view!=='parts',SL.view!=='model',SL.view==='both')}
async function slLoadFile(f){
 busy(T('Читаю модель…','Reading the model…'));await sleep(0);
 try{const buf=await f.arrayBuffer(),soup=/\.obj$/i.test(f.name)?parseOBJ(new TextDecoder().decode(buf)):parseSTL(buf);if(soup.length<9)throw new Error(T('В файле нет треугольников.','The file has no triangles.'));
  SL.base=indexMesh(soup);SL.name=f.name;const b=meshBounds(SL.base.pos);SL.size=fx(clamp(b[5]-b[2],10,300),1);slPrepare();
  if(!$('#slSide'))openSlicer();else{slRenderSide();slRefresh(true)}}
 catch(e){logError('slicer',e);toast(T('Не удалось прочитать модель: ','Could not read the model: ')+(e.message||e),'err')}finally{busy(null)}
}
function slSet(k,v){if(k==='prim'){slPrim(v);return}if(['size','t','dd','dn','ca','cb','fit','spacing','az','tilt','rn'].includes(k)){v=parseFloat(v);if(!isFinite(v))return}
 if(k==='fit')SL.fitTouched=true;SL[k]=v;if(k==='size'){SL.size=Math.max(5,v);slPrepare();slRenderSide();slRefresh(true);return}if(k==='spacing')return;
 if(['dowels','axis','method'].includes(k))slRenderSide();slRefresh(false)}
function slPlace(){if(!SL.res||!SL.res.parts.length){toast(T('Нет деталей для раскладки.','No parts to nest.'));return}const parts=SL.res.parts;for(const p of parts)p.group={nm:p.name,slicer:{model:SL.name,method:SL.method,t:SL.t}};closeModal();placeParts(parts,{title:T('Детали из 3D-модели','Parts from the 3D model')})}

/* ---------- more slice directions, radial mode, built-in shapes ---------- */
function slAxis(){const q=Math.SQRT1_2;if(SL.axis==='custom'||SL.axis==='dz'){const tl=(SL.axis==='dz'?45:clamp(+SL.tilt||0,0,90))*Math.PI/180,az=(SL.axis==='dz'?-90:(+SL.az||0))*Math.PI/180,n=[Math.sin(tl)*Math.cos(az),Math.sin(tl)*Math.sin(az),Math.cos(tl)];let u=[-n[1],n[0],0];const L=Math.hypot(u[0],u[1]);u=L<1e-6?[1,0,0]:[u[0]/L,u[1]/L,0];const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];return{n,u,v}}
 return{z:{n:[0,0,1],u:[1,0,0],v:[0,1,0]},x:{n:[1,0,0],u:[0,1,0],v:[0,0,1]},y:{n:[0,1,0],u:[1,0,0],v:[0,0,1]},d:{n:[q,q,0],u:[-q,q,0],v:[0,0,1]}}[SL.axis]||{n:[0,0,1],u:[1,0,0],v:[0,1,0]}}
/* radial: N vertical plates through the vertical centre axis; along the axis plate i keeps material only in height band i,
   so the plates go in one after another, each sliding down from the top */
async function slRadial(){
 const mesh=SL.mesh,N=clamp(SL.rn|0,2,8),t=SL.t,w=t+SL.fit,d=SL.dims,cx=d[0]/2,cy=d[1]/2,H=d[2],Z=[0,0,1],parts=[],asm=[],warn=[];
 busy(T('Режу пластины…','Slicing plates…'));await sleep(0);let split=0;
 for(let i=0;i<N;i++){const th=Math.PI*i/N,u=[Math.cos(th),Math.sin(th),0],n=[-Math.sin(th),Math.cos(th),0],dd=n[0]*cx+n[1]*cy,uc=u[0]*cx+u[1]*cy;
  let paths=sliceAt(mesh,n,dd,u,Z);if(!paths.length)continue;const before=components(paths).length,cuts=[];
  if(i>0)cuts.push(rectPts(uc-w/2,-1,w,H*i/N+1));if(i<N-1)cuts.push(rectPts(uc-w/2,H*(i+1)/N,w,H+1));
  if(hasClip()&&cuts.length)paths=boolOp(paths,cuts,'diff');const comps=components(paths);if(comps.length>before)split++;
  for(let ci=0;ci<comps.length;ci++){const comp=comps[ci],label='R'+(i+1)+(comps.length>1?LETTERS[ci%26]:''),items=[{layer:0,kind:'part',paths:comp,closed:true}];if(SL.nums){const it=await labelItem(label,comp,[]);if(it)items.push(it)}
   parts.push({name:label,items,req:slReq()});asm.push({paths:comp,origin:n.map(q=>q*(dd-t/2)),u,v:Z,n,t,color:hslHex(30+i*40,40,62)})}}
 if(split)warn.push(T(`Пластин, распавшихся на части пазами: ${split} — у модели в центре нет материала; лучше стопка или решётка.`,`${split} plates fall apart at the slots — the model has no material at its centre; use stack or grid instead.`));
 return{parts,asm,warn,bom:[T('Порядок: R1 (сплошная внизу у оси) ставится первой, затем R2, R3… — каждая сдвигается сверху вниз по оси.','Order: R1 (solid at the bottom of the axis) goes first, then R2, R3… — each slides down along the axis.'),T(`Ширина паза ${fx(w,2)} мм.`,`Slot width ${fx(w,2)} mm.`)],info:T(`Звезда из ${N} пластин · деталей: ${parts.length}`,`Radial, ${N} plates · ${parts.length} parts`)};
}
/* loft: a closed outline scaled along Z (rings [z, scale]); ends are capped */
function loftMesh(poly,rings){const n=poly.length,pos=[],idx=[];let cxp=0,cyp=0;for(const p of poly){cxp+=p[0];cyp+=p[1]}cxp/=n;cyp/=n;
 for(const[z,k]of rings)for(const p of poly)pos.push(cxp+(p[0]-cxp)*k,cyp+(p[1]-cyp)*k,z);
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n,c=(r+1)*n+i,d=(r+1)*n+(i+1)%n;idx.push(a,b,d,a,d,c)}
 const b0=pos.length/3;pos.push(cxp,cyp,rings[0][0]);const b1=pos.length/3;pos.push(cxp,cyp,rings[rings.length-1][0]);const L=(rings.length-1)*n;
 for(let i=0;i<n;i++){idx.push(b0,(i+1)%n,i);idx.push(b1,L+i,L+(i+1)%n)}return{pos:new Float32Array(pos),idx:new Uint32Array(idx)}}
const puffy=(poly,h,steps=14)=>loftMesh(poly,Array.from({length:steps+1},(_,i)=>{const a=-Math.PI/2+Math.PI*i/steps;return[h/2*Math.sin(a),Math.max(.04,Math.cos(a)**.55)]}));
function heartPoly(s){const p=[];for(let i=0;i<96;i++){const a=i/96*Math.PI*2;p.push([16*Math.sin(a)**3*s,(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*s])}return p}
const SL_PRIMS=()=>[['sphere',T('Шар','Sphere')],['egg',T('Яйцо','Egg')],['heart',T('Сердце объёмное','Puffy heart')],['star',T('Звезда объёмная','Puffy star')],['cone',T('Конус','Cone')],['pyramid',T('Пирамида','Pyramid')],['gem',T('Кристалл','Gem')],['bell',T('Колокол','Bell')],['pear',T('Груша','Pear')],['apple',T('Яблоко','Apple')],['mushroom',T('Гриб','Mushroom')],['cup',T('Кубок','Goblet')],['barrel',T('Бочка','Barrel')],['tree',T('Ёлка','Fir tree')]];
function slPrimMesh(k){const L=(f,n=64,seg=96)=>latheMesh(Array.from({length:n+1},(_,i)=>{const t=i/n;return[Math.max(.01,f(t)),t*100]}),seg);
 switch(k){case 'sphere':return L(t=>50*Math.sqrt(Math.max(0,1-(2*t-1)**2)));case 'egg':return L(t=>38*Math.sqrt(Math.max(0,1-(2*t-1)**2))*(1-.25*(t-.4)));
  case 'cone':return L(t=>40*(1-t),2);case 'pyramid':return L(t=>45*(1-t),2,4);case 'gem':return L(t=>t<.3?45*t/.3:45*(1-(t-.3)/.7),2,8);
  case 'bell':return L(t=>t<.08?46:t>.92?10*Math.sqrt(Math.max(0,1-((t-.92)/.08)**2)):16+30*(1-(t-.08)/.84)**2.2);case 'pear':return L(t=>{const a=34*Math.sqrt(Math.max(0,1-((t-.32)/.34)**2)),b=21*Math.sqrt(Math.max(0,1-((t-.72)/.3)**2));return Math.max(a,b,t<.02?20:0)});
  case 'apple':return L(t=>t>.9?(t>.97?1.6:2.2):46*Math.sqrt(Math.max(0,1-(2*(t/.9)-1)**2))*(1-.08*Math.cos(t/.9*Math.PI*2)));case 'mushroom':return L(t=>t<.55?14+3*Math.sin(t*6):46*Math.sqrt(Math.max(0,1-((t-.55)/.45)**2)),80);
  case 'cup':return L(t=>t<.08?32:t<.5?6+2*Math.sin(t*20):t<.55?12:26+12*Math.sin((t-.55)/.45*Math.PI/2),80);case 'barrel':return L(t=>32+9*Math.sin(Math.PI*t));
  case 'tree':return L(t=>t<.12?9:42*(1-((t-.12)/.88))*(1-.25*Math.abs(Math.sin(((t-.12)/.88)*Math.PI*3.5))),96);
  case 'heart':return puffy(heartPoly(3),36);case 'star':{const p=[];for(let i=0;i<10;i++){const r=i%2?22:50,a=Math.PI/2+Math.PI*i/5;p.push([r*Math.cos(a),r*Math.sin(a)])}return puffy(p,30,10)}}
 return sampleVase()}
function slPrim(k){if(!k)return;const m=slPrimMesh(k);SL.base=m;SL.name=(SL_PRIMS().find(p=>p[0]===k)||[0,k])[1];SL.size=k==='heart'||k==='star'?40:120;
 if(k==='heart'||k==='star'){const p=SL.base.pos;for(let i=0;i<p.length;i+=3){const y=p[i+1],z=p[i+2];p[i+1]=-z;p[i+2]=y}const b=meshBounds(p);SL.size=fx(b[5]-b[2],1)}
 slPrepare();slRenderSide();slRefresh(true)}
