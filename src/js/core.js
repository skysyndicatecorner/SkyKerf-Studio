'use strict';
/* ================= Kerf Studio · core: helpers, model, geometry ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fx=(n,d=2)=>{const v=+(+n).toFixed(d);return Object.is(v,-0)?0:v};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let lang=store.get('kerf.lang')||(/^en/i.test(navigator.language||'')?'en':'ru');
const T=(ru,en)=>lang==='ru'?ru:en;
const MM=()=>T('мм','mm'), MMIN=()=>T('мм/мин','mm/min');
function fmtTime(sec){sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
function fmtLen(mm){return mm>=1000?fx(mm/1000,2)+' '+T('м','m'):fx(mm,0)+' '+MM()}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function hslRgb(h,s,l){const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))))};return[f(0),f(8),f(4)]}
const hslHex=(h,s,l)=>'#'+hslRgb(((h%360)+360)%360/360,clamp(s,0,100)/100,clamp(l,0,100)/100).map(v=>v.toString(16).padStart(2,'0')).join('');
let seedRnd=1;function rnd(){seedRnd=(seedRnd*16807)%2147483647;return(seedRnd-1)/2147483646}

const ICON={
 select:'<path d="M5 3l11 7-5 1.2 3 5.3-2 1.1-3-5.3L5 16z"/>',
 rect:'<rect x="3.5" y="5.5" width="13" height="9" rx="1.2"/>',
 ellipse:'<ellipse cx="10" cy="10" rx="7" ry="5.5"/>',
 polygon:'<path d="M10 3l6.5 3.8v6.4L10 17l-6.5-3.8V6.8z"/>',
 star:'<path d="M10 2.8l2.1 4.6 5 .5-3.8 3.4 1.1 4.9L10 13.7l-4.4 2.5 1.1-4.9L2.9 7.9l5-.5z"/>',
 line:'<path d="M4.5 15.5l11-11"/><circle cx="4.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="4.5" r="1.5"/>',
 pen:'<path d="M3.5 16.5l3-1 9-9-2-2-9 9z"/><path d="M11.5 6.5l2 2"/>',
 text:'<path d="M4 5h12M10 5v11M7.5 16h5"/>',
 hand:'<path d="M7 10.5V5.2a1.3 1.3 0 012.6 0V9.5M9.6 9V4a1.3 1.3 0 012.6 0v5M12.2 9.2V5.6a1.3 1.3 0 012.6 0v6.2a5.2 5.2 0 01-5.2 5.2H9.1a4 4 0 01-3.2-1.6l-2.4-3.3a1.3 1.3 0 012-1.6L7 12"/>',
 measure:'<path d="M2.5 13.5l11-11 4 4-11 11z"/><path d="M6 10l1.5 1.5M8.5 7.5L10 9M11 5l1.5 1.5"/>',
 fit:'<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/><rect x="7" y="7" width="6" height="6" rx="1"/>',
 zin:'<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4M9 6.5v5M6.5 9h5"/>',
 zout:'<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4M6.5 9h5"/>',
 undo:'<path d="M7 5L3.5 8.5 7 12"/><path d="M4 8.5h8a4.5 4.5 0 010 9H9"/>',
 redo:'<path d="M13 5l3.5 3.5L13 12"/><path d="M16 8.5H8a4.5 4.5 0 000 9h3"/>',
 play:'<path d="M6 4l10 6-10 6z" fill="currentColor"/>',
 pause:'<path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor"/>',
 stop:'<rect x="5" y="5" width="10" height="10" rx="1" fill="currentColor"/>',
 eye:'<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.3"/>',
 eyeoff:'<path d="M3 3l14 14M8.3 5A7 7 0 0110 4.5c5 0 8 5.5 8 5.5a14 14 0 01-2.4 3M12 15.2a7 7 0 01-2 .3c-5 0-8-5.5-8-5.5a14 14 0 013-3.6"/>',
 up:'<path d="M5 12l5-5 5 5"/>', down:'<path d="M5 8l5 5 5-5"/>',
 copy:'<rect x="6.5" y="6.5" width="10" height="10" rx="1.5"/><path d="M13.5 6.5v-2a1 1 0 00-1-1h-8a1 1 0 00-1 1v8a1 1 0 001 1h2"/>',
 trash:'<path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6"/>',
 svg:'<path d="M4 3.5h8l4 4v9H4z"/><path d="M12 3.5v4h4M10 9.5v5M7.5 12l2.5 2.5 2.5-2.5"/>',
 image:'<rect x="3" y="4" width="14" height="12" rx="1.5"/><circle cx="7.5" cy="8" r="1.5"/><path d="M3.5 14l4-4 3 3 2.5-2.5 3.5 3.5"/>',
 file:'<path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3"/>',
 gear:'<path d="M10 2.5l1.3 2.2 2.5-.7.6 2.5 2.4 1-1 2.4 1.6 2-2 1.6.3 2.6-2.6.2-1.1 2.4-2-1.6-2 1.6-1.1-2.4-2.6-.2.3-2.6-2-1.6 1.6-2-1-2.4 2.4-1 .6-2.5 2.5.7z"/><circle cx="10" cy="10" r="2.6"/>',
 cog:'<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
 theme:'<circle cx="10" cy="10" r="6.5"/><path d="M10 3.5a6.5 6.5 0 000 13z" fill="currentColor"/>',
 laser:'<path d="M7 3h6v5H7z"/><path d="M10 8v5" stroke-dasharray="1.6 1.4"/><path d="M6 17h8M8.5 14.5L10 13l1.5 1.5"/>',
 cnc:'<path d="M8 3h4v4H8zM9 7h2v4l-1 2-1-2z"/><path d="M4 16h12"/><path d="M6 14v2M14 14v2"/>',
 chev:'<path d="M6 8l4 4 4-4"/>',
 grid:'<path d="M3 7h14M3 13h14M7 3v14M13 3v14"/>',
 cube:'<path d="M10 2.5l7 4v7l-7 4-7-4v-7z"/><path d="M3 6.5l7 4 7-4M10 10.5v7"/>',
 slices:'<path d="M3 14.5l7 3 7-3M3 11.5l7 3 7-3M3 8.5l7 3 7-3M10 2.5l7 3-7 3-7-3z"/>',
 layers:'<rect x="2.5" y="3" width="11" height="9" rx="1"/><rect x="6.5" y="8" width="11" height="9" rx="1" fill="var(--panel)"/><path d="M9 14c1.5-2 3-2.5 6-1"/>',
 box:'<path d="M3 7l7-3.5L17 7v7l-7 3.5L3 14z"/><path d="M3 7l7 3.5L17 7M10 10.5v7"/><path d="M5.5 8.2v1.6M7.5 9.2v1.6M12.5 9.2v1.6M14.5 8.2v1.6"/>',
 puzzle:'<path d="M4 4h4.5a1.8 1.8 0 113 0H16v4.5a1.8 1.8 0 110 3V16h-4.5a1.8 1.8 0 10-3 0H4v-4.5a1.8 1.8 0 100-3z"/>',
 hinge:'<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M6.5 4v5M6.5 11v5M10 4v2M10 8v4M10 14v2M13.5 4v5M13.5 11v5"/>',
 qr:'<path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3z"/><path d="M12 12h2v2h-2zM15 15h2v2h-2zM15 12h2M12 16v1"/>',
 test:'<rect x="3" y="3" width="4" height="4" fill="currentColor" opacity=".3"/><rect x="8" y="3" width="4" height="4" fill="currentColor" opacity=".6"/><rect x="13" y="3" width="4" height="4" fill="currentColor"/><rect x="3" y="8" width="4" height="4" fill="currentColor" opacity=".5"/><rect x="8" y="8" width="4" height="4" fill="currentColor" opacity=".8"/><rect x="13" y="8" width="4" height="4"/><rect x="3" y="13" width="4" height="4" fill="currentColor" opacity=".7"/><rect x="8" y="13" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/>',
 sign:'<rect x="2.5" y="5" width="15" height="10" rx="2"/><circle cx="5" cy="7.5" r=".8"/><circle cx="15" cy="7.5" r=".8"/><path d="M6.5 11.5h7"/>',
 nest:'<rect x="2.5" y="2.5" width="15" height="15" rx="1"/><path d="M2.5 9h7v8.5M9.5 5.5h8M13 5.5v12"/>',
 group:'<rect x="2.5" y="2.5" width="15" height="15" rx="1.5" stroke-dasharray="2 2"/><rect x="5.5" y="5.5" width="5" height="5"/><circle cx="12.5" cy="12.5" r="2.5"/>',
 ungroup:'<rect x="3" y="3" width="6" height="6"/><circle cx="14" cy="14" r="3"/>',
 wand:'<path d="M3 17L13 7M11 5l4 4"/><path d="M15 2v3M13.5 3.5h3M17 9v2M16 10h2"/>',
 plus:'<path d="M10 4v12M4 10h12"/>',
 home:'<path d="M3.5 9.5L10 4l6.5 5.5M5.5 8v8h9V8"/>',
 frame:'<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/>',
 link:'<path d="M8.5 11.5l3-3M7 9l-2 2a2.8 2.8 0 004 4l2-2M13 11l2-2a2.8 2.8 0 00-4-4L9 7"/>',
 open:'<path d="M3 6.5V15h14V8H9.5L8 6.5z"/>',
 save:'<path d="M4 4h9.5L16 6.5V16H4z"/><path d="M7 4v4h6V4M7 16v-5h6v5"/>',
 newp:'<path d="M5 3h7l3 3v11H5z"/><path d="M10 8.5v5M7.5 11h5"/>',
 edit:'<path d="M4 16l1-4 8-8 3 3-8 8z"/>',
 circle:'<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="3.5" r="1.3" fill="currentColor"/><circle cx="16.5" cy="10" r="1.3" fill="currentColor"/><circle cx="10" cy="16.5" r="1.3" fill="currentColor"/><circle cx="3.5" cy="10" r="1.3" fill="currentColor"/>',
 split:'<path d="M3 10h4M13 10h4M7 6l3 4-3 4M13 6l-3 4 3 4"/>',
 smooth:'<path d="M3 14c3-8 5 4 8-4s4-2 6-4"/>',
};
const ic=(k,s=18)=>`<svg viewBox="0 0 20 20" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[k]||''}</svg>`;

/* ================= model ================= */
const COLORS=['#e5484d','#3e8ef7','#30a46c','#f5a524','#a46ef0','#12a5b8','#e5679f','#8b95a3','#d9653b','#5c6bc0','#9aa3af'];
const NL=11, TOOL_L=10;
const MACHINES=[
 {id:'diode',type:'laser',name:'Diode Laser 10W',w:400,h:400,smax:1000,rapid:6000,safeZ:5,rpm:0,fw:'grbl'},
 {id:'diode20',type:'laser',name:'Diode Laser 20W',w:400,h:400,smax:1000,rapid:9000,safeZ:5,rpm:0,fw:'grbl'},
 {id:'co2',type:'laser',name:'CO2 Laser 50W',w:500,h:300,smax:1000,rapid:12000,safeZ:5,rpm:0,fw:'grbl'},
 {id:'c3018',type:'cnc',name:'CNC 3018 Pro',w:300,h:180,smax:1000,rapid:1500,safeZ:5,rpm:10000,fw:'grbl'},
 {id:'c6060',type:'cnc',name:'CNC Router 6060',w:600,h:600,smax:24000,rapid:5000,safeZ:5,rpm:18000,fw:'grbl'},
];
const FONTS={plex:{css:'"IBM Plex Sans"',w:600,n:'IBM Plex Sans'},unb:{css:'"Unbounded"',w:700,n:'Unbounded'},mono:{css:'"JetBrains Mono"',w:700,n:'JetBrains Mono'},serif:{css:'"PT Serif"',w:700,n:'PT Serif'},hand:{css:'"Caveat"',w:600,n:'Caveat'}};
// laser materials (starting values for a 10 W diode)
const MATERIALS=[
 {ru:'Фанера',en:'Plywood',t:3,cut:{power:100,speed:300,passes:2},eng:{power:35,speed:3000,interval:.1},score:{power:25,speed:1500}},
 {ru:'Фанера',en:'Plywood',t:4,cut:{power:100,speed:250,passes:3},eng:{power:35,speed:3000,interval:.1},score:{power:25,speed:1500}},
 {ru:'Фанера',en:'Plywood',t:6,cut:{power:100,speed:180,passes:4},eng:{power:35,speed:3000,interval:.1},score:{power:25,speed:1500}},
 {ru:'МДФ',en:'MDF',t:3,cut:{power:100,speed:250,passes:2},eng:{power:30,speed:3000,interval:.1},score:{power:22,speed:1500}},
 {ru:'Акрил (CO2)',en:'Acrylic (CO2)',t:3,cut:{power:65,speed:600,passes:1},eng:{power:20,speed:12000,interval:.08},score:{power:12,speed:6000}},
 {ru:'Кожа',en:'Leather',t:2,cut:{power:90,speed:500,passes:2},eng:{power:25,speed:4000,interval:.1},score:{power:18,speed:2500}},
 {ru:'Картон',en:'Cardboard',t:2,cut:{power:70,speed:900,passes:1},eng:{power:15,speed:5000,interval:.12},score:{power:12,speed:3000}},
 {ru:'Бумага 300 г/м²',en:'Card stock 300 gsm',t:.4,cut:{power:30,speed:1500,passes:1},eng:{power:8,speed:6000,interval:.12},score:{power:6,speed:4000}},
 {ru:'Фетр',en:'Felt',t:2,cut:{power:60,speed:800,passes:1},eng:{power:15,speed:4000,interval:.12},score:{power:12,speed:3000}},
 {ru:'Пробка',en:'Cork',t:3,cut:{power:80,speed:600,passes:2},eng:{power:20,speed:4000,interval:.12},score:{power:15,speed:3000}},
 {ru:'Анодированный алюминий',en:'Anodized aluminium',t:1,cut:null,eng:{power:80,speed:1500,interval:.06},score:{power:80,speed:1000}},
 {ru:'Сланец',en:'Slate',t:5,cut:null,eng:{power:60,speed:2000,interval:.1},score:{power:60,speed:1500}},
];
const CNC_MATS=[
 {ru:'Фанера',en:'Plywood',t:6,chip:.05,doc:.5,rpm:12000},
 {ru:'МДФ',en:'MDF',t:6,chip:.06,doc:.6,rpm:12000},
 {ru:'Твёрдое дерево',en:'Hardwood',t:10,chip:.04,doc:.4,rpm:14000},
 {ru:'Акрил',en:'Acrylic',t:3,chip:.04,doc:.3,rpm:15000},
 {ru:'ПВХ / пластик',en:'PVC / plastic',t:4,chip:.05,doc:.4,rpm:12000},
 {ru:'Алюминий',en:'Aluminium',t:3,chip:.015,doc:.15,rpm:18000},
];
const TOOLS=[
 {d:1,fl:2,ru:'Концевая 1 мм, 2 зуба',en:'1 mm flat, 2 flute'},
 {d:2,fl:2,ru:'Концевая 2 мм, 2 зуба',en:'2 mm flat, 2 flute'},
 {d:3.175,fl:2,ru:'Концевая 3,175 мм, 2 зуба',en:'3.175 mm flat, 2 flute'},
 {d:3.175,fl:1,ru:'Однозаходная 3,175 мм',en:'3.175 mm single flute'},
 {d:6,fl:2,ru:'Концевая 6 мм, 2 зуба',en:'6 mm flat, 2 flute'},
 {d:6,fl:2,v:90,ru:'V-фреза 90°',en:'V-bit 90°'},
 {d:6,fl:2,v:60,ru:'V-фреза 60°',en:'V-bit 60°'},
];
const SHEETS=[['A4',297,210],['A3',420,297],['300×200',300,200],['300×300',300,300],['400×300',400,300],['600×400',600,400]];
const matList=()=>S.machine.type==='laser'?MATERIALS:CNC_MATS;
const curMat=()=>{const l=matList();return l[clamp(S.sheet.mat|0,0,l.length-1)]};
const matName=(m,t)=>`${lang==='ru'?m.ru:m.en} ${fx(t??m.t,2)} ${MM()}`;

function defLayer(i){
 const L={id:i,color:COLORS[i],name:'',on:true,show:true,out:i!==TOOL_L,
  laser:{mode:'line',power:60,minPower:0,speed:1500,passes:1,interval:.1,angle:0,air:false,kerf:0,bridges:0,bridgeW:.6,overscan:2.5,bidir:true},
  cnc:{op:'out',depth:3,step:1,feed:800,plunge:250,tool:3.175,stepover:45,rpm:12000,tabs:0,tabH:1.5,tabW:5,vangle:90,vstep:.25}};
 if(i===0){Object.assign(L.laser,{mode:'line',power:100,speed:300,passes:2});L.cnc.op='out';L.cnc.tabs=4}
 if(i===1){Object.assign(L.laser,{mode:'fill',power:35,speed:3000});Object.assign(L.cnc,{op:'pocket',depth:1.5})}
 if(i===2){Object.assign(L.laser,{mode:'line',power:25,speed:1500});Object.assign(L.cnc,{op:'engrave',depth:.4,tool:1,feed:500,plunge:150})}
 return L;
}
function defaultName(L){return L.id===0?T('Резка','Cut'):L.id===1?T('Гравировка','Engrave'):L.id===2?T('Разметка','Score'):L.id===TOOL_L?T('Направляющие','Guides'):T('Слой ','Layer ')+String(L.id+1).padStart(2,'0')}
const layerName=L=>L.name||defaultName(L);
function blankState(m,sheet){
 const mm={...(m||MACHINES[0])};
 return{v:2,machine:mm,layers:Array.from({length:NL},(_,i)=>defLayer(i)),order:Array.from({length:NL},(_,i)=>i),shapes:[],nextId:1,nextG:1,plates:1,
  sheet:Object.assign({on:true,mat:0,thick:3,w:Math.min(300,mm.w-20),h:Math.min(200,mm.h-20),x:10,y:10,margin:3},sheet||{}),
  job:{innerFirst:true,header:'',footer:''},snap:1,snapOn:true,macros:[{n:'Home',g:'$H'},{n:'Unlock',g:'$X'},{n:T('Настройки','Settings'),g:'$$'},{n:T('Парковка','Park'),g:'G90 G0 X0 Y0'}]};
}

/* ================= geometry ================= */
function rectPts(x,y,w,h,r){r=Math.min(r||0,w/2,h/2);if(r<=0.01)return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];const p=[],n=10;
 for(const[cx,cy,a0]of[[x+w-r,y+r,-90],[x+w-r,y+h-r,0],[x+r,y+h-r,90],[x+r,y+r,180]])for(let i=0;i<=n;i++){const a=(a0+90*i/n)*Math.PI/180;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}return p}
function ellipsePts(cx,cy,rx,ry,n){n=n||Math.max(28,Math.min(220,Math.round((rx+ry)*2.2)));const p=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;p.push([cx+rx*Math.cos(a),cy+ry*Math.sin(a)])}return p}
function polyPts(cx,cy,r,n){const p=[];for(let i=0;i<n;i++){const a=Math.PI/2+i/n*Math.PI*2;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}return p}
function starPts(cx,cy,R,ri,n){const p=[];for(let i=0;i<n*2;i++){const a=Math.PI/2+i/(n*2)*Math.PI*2,r=i%2?ri:R;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}return p}
function bboxOf(paths){const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of paths)for(const q of p){if(q[0]<b[0])b[0]=q[0];if(q[1]<b[1])b[1]=q[1];if(q[0]>b[2])b[2]=q[0];if(q[1]>b[3])b[3]=q[1]}return b}
function unionBox(a,b){return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]}
function distSeg(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=clamp(t,0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
function inPolys(pt,paths){let c=false;for(const p of paths){for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c}}return c}
function area(p){let s=0;for(let i=0,j=p.length-1;i<p.length;j=i++)s+=(p[j][0]-p[i][0])*(p[j][1]+p[i][1]);return s/2}
function areaOf(paths){let s=0;for(const c of components(paths)){s+=Math.abs(area(c[0]));for(const h of c.slice(1))s-=Math.abs(area(h))}return s}
function pathLen(p,closed){let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);if(closed&&p.length>1)s+=Math.hypot(p[0][0]-p[p.length-1][0],p[0][1]-p[p.length-1][1]);return s}
function rdp(pts,eps){if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];for(let i=1;i<pts.length-1;i++){const d=distSeg(pts[i],a,b);if(d>dm){dm=d;ix=i}}
 if(dm>eps){const l=rdp(pts.slice(0,ix+1),eps),r=rdp(pts.slice(ix),eps);return l.slice(0,-1).concat(r)}return[a,b]}
function rdpClosed(p,eps){if(p.length<8)return p;let far=0,fi=0;for(let i=1;i<p.length;i++){const d=Math.hypot(p[i][0]-p[0][0],p[i][1]-p[0][1]);if(d>far){far=d;fi=i}}
 const a=rdp(p.slice(0,fi+1),eps),b=rdp(p.slice(fi).concat([p[0]]),eps);return a.slice(0,-1).concat(b.slice(0,-1))}
const mapPaths=(paths,f)=>paths.map(p=>p.map(q=>f(q[0],q[1])));
function rotPaths(paths,deg,cx=0,cy=0){if(!deg)return paths;const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return mapPaths(paths,(x,y)=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c])}
// split a set of closed loops into components: [outer, ...holes]
function components(paths){
 const ps=paths.filter(p=>p.length>2).map(p=>({p,a:Math.abs(area(p)),b:bboxOf([p])}));ps.sort((a,b)=>b.a-a.a);
 for(const o of ps){o.d=0;o.par=null;for(const q of ps){if(q===o||q.a<=o.a)continue;if(o.b[0]>=q.b[0]-1e-9&&o.b[2]<=q.b[2]+1e-9&&o.b[1]>=q.b[1]-1e-9&&o.b[3]<=q.b[3]+1e-9&&inPolys(o.p[0],[q.p])){o.d++;if(!o.par||q.a<o.par.a)o.par=q}}}
 const comps=[];for(const o of ps)if(o.d%2===0){o.comp=[o.p];comps.push(o.comp)}
 for(const o of ps)if(o.d%2===1&&o.par&&o.par.comp)o.par.comp.push(o.p);
 return comps;
}
// interior point far from edges (for labels / pins)
function deepPoint(paths,avoid=[],minClear=0){
 const b=bboxOf(paths),step=Math.max((b[2]-b[0])/36,(b[3]-b[1])/36,.4);let best=null,bd=-1;
 for(let y=b[1]+step/2;y<b[3];y+=step)for(let x=b[0]+step/2;x<b[2];x+=step){const p=[x,y];if(!inPolys(p,paths))continue;
  let d=Infinity;for(const q of paths)for(let i=0;i<q.length;i++){const e=distSeg(p,q[i],q[(i+1)%q.length]);if(e<d)d=e}
  for(const a of avoid)d=Math.min(d,Math.hypot(a[0]-x,a[1]-y)-(a[2]||0));
  if(d>bd){bd=d;best=p}}
 return best&&bd>=minClear?{p:best,d:bd}:null;
}

/* ---- marching-squares tracer (text + bitmap trace + layered art) ---- */
function traceMask(mask,w,h){
 const at=(x,y)=>(x<0||y<0||x>=w||y>=h)?0:mask[y*w+x];
 const ax=[],ay=[],bx=[],by=[];
 const E=(x,y,e)=>e===0?[2*x+1,2*y]:e===1?[2*x+2,2*y+1]:e===2?[2*x+1,2*y+2]:[2*x,2*y+1];
 const TAB={1:[3,2],2:[2,1],3:[3,1],4:[0,1],5:[3,2,0,1],6:[0,2],7:[3,0],8:[3,0],9:[0,2],10:[3,0,2,1],11:[0,1],12:[3,1],13:[2,1],14:[3,2]};
 for(let y=-1;y<h;y++)for(let x=-1;x<w;x++){const c=at(x,y)*8+at(x+1,y)*4+at(x+1,y+1)*2+at(x,y+1);if(c===0||c===15)continue;const t=TAB[c];
  for(let k=0;k<t.length;k+=2){const p=E(x,y,t[k]),q=E(x,y,t[k+1]);ax.push(p[0]);ay.push(p[1]);bx.push(q[0]);by.push(q[1])}}
 const n=ax.length,map=new Map(),key=(x,y)=>x*100003+y;
 for(let i=0;i<n;i++){for(const k of[key(ax[i],ay[i]),key(bx[i],by[i])]){const l=map.get(k);l?l.push(i):map.set(k,[i])}}
 const used=new Uint8Array(n),loops=[];
 for(let i=0;i<n;i++){if(used[i])continue;used[i]=1;const loop=[[ax[i]/2,ay[i]/2]];const sk=key(ax[i],ay[i]);let cx=bx[i],cy=by[i],guard=0;
  while(key(cx,cy)!==sk&&guard++<2e6){loop.push([cx/2,cy/2]);const c=map.get(key(cx,cy));let nx=-1;if(c)for(const j of c)if(!used[j]){nx=j;break}if(nx<0)break;used[nx]=1;
   if(ax[nx]===cx&&ay[nx]===cy){cx=bx[nx];cy=by[nx]}else{cx=ax[nx];cy=ay[nx]}}
  if(loop.length>=4)loops.push(loop)}
 return loops;
}
const textCache=new Map();
async function makeTextPaths(text,font,size){
 const key=font+'|'+size+'|'+text;if(textCache.has(key))return textCache.get(key);
 const F=FONTS[font]||FONTS.plex,k=Math.max(5,Math.min(24,240/size)),px=size*k,css=`${F.w} ${px}px ${F.css}`;
 try{await document.fonts.load(css,text||'A')}catch(e){}
 const lines=String(text||' ').split('\n'),c=document.createElement('canvas'),x=c.getContext('2d');x.font=css;
 const lw=Math.max(1,...lines.map(l=>x.measureText(l).width)),lh=px*1.22;
 c.width=Math.ceil(lw+px*.4);c.height=Math.ceil(lh*lines.length+px*.4);x.font=css;x.fillStyle='#000';x.textBaseline='alphabetic';x.textAlign='left';
 lines.forEach((l,i)=>x.fillText(l,px*.2,px*.2+px*.92+i*lh));
 const d=x.getImageData(0,0,c.width,c.height).data,m=new Uint8Array(c.width*c.height);for(let i=0;i<m.length;i++)m[i]=d[i*4+3]>110?1:0;
 let loops=traceMask(m,c.width,c.height).map(l=>rdpClosed(l,.45)).filter(l=>l.length>2&&Math.abs(area(l))>2);
 loops=loops.map(l=>l.map(([X,Y])=>[X/k,(c.height-Y)/k]));
 let res=[];if(loops.length){const b=bboxOf(loops);res=mapPaths(loops,(X,Y)=>[X-b[0],Y-b[1]])}
 textCache.set(key,res);return res;
}
async function textAt(text,font,size,cx,cy){const p=await makeTextPaths(text,font,size);if(!p.length)return[];const b=bboxOf(p);return mapPaths(p,(x,y)=>[x-(b[2]-b[0])/2+cx,y-(b[3]-b[1])/2+cy])}

/* ---- Clipper (offset & booleans) with fallback ---- */
const CS=1000,hasClip=()=>typeof ClipperLib!=='undefined';
const toC=paths=>paths.filter(p=>p.length>2).map(p=>p.map(q=>({X:Math.round(q[0]*CS),Y:Math.round(q[1]*CS)})));
const fromC=cp=>cp.map(p=>p.map(q=>[q.X/CS,q.Y/CS])).filter(p=>p.length>2);
const normC=(paths,ft)=>ClipperLib.Clipper.SimplifyPolygons(toC(paths),ft==null?ClipperLib.PolyFillType.pftEvenOdd:ft);
function offsetPaths(paths,d,join){
 if(!hasClip())return paths.map(p=>missOffset(p,d)).filter(Boolean);
 const co=new ClipperLib.ClipperOffset(2,.02*CS);co.AddPaths(normC(paths),join==='miter'?ClipperLib.JoinType.jtMiter:ClipperLib.JoinType.jtRound,ClipperLib.EndType.etClosedPolygon);
 const sol=new ClipperLib.Paths();co.Execute(sol,d*CS);return fromC(sol);
}
function missOffset(p,d){
 const n=p.length,s=area(p)>0?1:-1,o=[];
 for(let i=0;i<n;i++){const a=p[(i-1+n)%n],b=p[i],c=p[(i+1)%n];
  const n1=norm2([(b[1]-a[1]),-(b[0]-a[0])]),n2=norm2([(c[1]-b[1]),-(c[0]-b[0])]);let m=[n1[0]+n2[0],n1[1]+n2[1]];const ml=Math.hypot(m[0],m[1])||1;m=[m[0]/ml,m[1]/ml];
  const cos=Math.max(.3,m[0]*n1[0]+m[1]*n1[1]);o.push([b[0]-s*m[0]*d/cos,b[1]-s*m[1]*d/cos])}
 if(d<0&&(Math.sign(area(o))!==Math.sign(area(p))||Math.abs(area(o))<.01))return null;return o;
}
function norm2(v){const l=Math.hypot(v[0],v[1])||1;return[v[0]/l,v[1]/l]}
function boolOp(subj,clip,kind,subjFill){
 if(!hasClip())return kind==='diff'||kind==='union'?subj.concat(kind==='union'?clip:[]):subj;
 const c=new ClipperLib.Clipper(),CT=ClipperLib.ClipType;c.AddPaths(normC(subj,subjFill),ClipperLib.PolyType.ptSubject,true);c.AddPaths(normC(clip,ClipperLib.PolyFillType.pftNonZero),ClipperLib.PolyType.ptClip,true);
 const sol=new ClipperLib.Paths();c.Execute(kind==='union'?CT.ctUnion:kind==='diff'?CT.ctDifference:kind==='xor'?CT.ctXor:CT.ctIntersection,sol,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);return fromC(sol);
}
const unionPaths=paths=>hasClip()?fromC(normC(paths,ClipperLib.PolyFillType.pftNonZero)):paths;
const cleanPaths=paths=>hasClip()?fromC(normC(paths)):paths;

/* ================= state ================= */
let S, mode=store.get('kerf.mode')||'pro', tab=store.get('kerf.tab')||'cad', tool='select', sel=new Set(), curPlate=0, curDrawLayer=0;
let undoS=[],redoS=[], clip=null;
const plateGap=()=>Math.max(20,Math.round(S.machine.w*.08));
const plateX=i=>i*(S.machine.w+plateGap());
function plateOfBox(b){const pw=S.machine.w+plateGap(),cx=(b[0]+b[2])/2;return clamp(Math.floor((cx+plateGap()/2)/pw),0,S.plates-1)}
const plateOf=s=>plateOfBox(bboxOf(s.paths));
const shapeById=id=>S.shapes.find(s=>s.id===id);
function addShape(st,layer,kind,paths,closed,extra){const s={id:st.nextId++,layer,kind,paths,closed,...(extra||{})};st.shapes.push(s);return s}
function migrate(j){
 if(j.v===1){while(j.layers.length<NL){j.layers.push(defLayer(j.layers.length))}j.order=(j.order||[]).concat([8,9,10]).filter((v,i,a)=>a.indexOf(v)===i);
  for(const L of j.layers){L.out=L.id!==TOOL_L;Object.assign(L.laser,{minPower:0,kerf:0,bridges:0,bridgeW:.6,overscan:2.5,bidir:true},L.laser);Object.assign(L.cnc,{vangle:90,vstep:.25},L.cnc)}
  const b=blankState(j.machine);j.plates=1;j.nextG=1;j.sheet=b.sheet;j.sheet.thick=(j.job&&j.job.stock)||3;j.macros=b.macros;j.v=2}
 return j;
}
function load(){
 try{const j=JSON.parse(store.get('kerf.project')||'null');if(j&&(j.v===1||j.v===2)&&Array.isArray(j.shapes)){S=migrate(j);return false}}catch(e){}
 S=sampleState(MACHINES[0]);return true;
}
let saveT=0,saveWarned=false;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{if(!store.set('kerf.project',JSON.stringify(S))&&!saveWarned){saveWarned=true;toast(T('Проект слишком большой для автосохранения в браузере (обычно из-за фото). Сохраните его кнопкой «Сохранить».','The project is too large to auto-save in the browser (usually photos). Use “Save”.'))}},400)}
function sampleState(m){
 const s=blankState(m);s.sheet=Object.assign(s.sheet,{w:200,h:150,x:20,y:20});
 const g=s.nextG++;
 addShape(s,0,'rect',[rectPts(35,35,100,100,12)],true,{g});
 addShape(s,0,'ellipse',[ellipsePts(49,121,3.5,3.5)],true,{g});
 addShape(s,2,'ellipse',[ellipsePts(85,87,34,34)],true,{g});
 addShape(s,1,'star',[starPts(85,87,27,11.5,5)],true,{g});
 s._sampleText=g;return s;
}
function pushUndo(){undoS.push(JSON.stringify(S));if(undoS.length>80)undoS.shift();redoS=[]}
function undo(){if(!undoS.length)return;redoS.push(JSON.stringify(S));S=JSON.parse(undoS.pop());afterHist()}
function redo(){if(!redoS.length)return;undoS.push(JSON.stringify(S));S=JSON.parse(redoS.pop());afterHist()}
function afterHist(){const ids=new Set(S.shapes.map(s=>s.id));for(const i of[...sel])if(!ids.has(i))sel.delete(i);curPlate=Math.min(curPlate,S.plates-1);changed()}

/* material → layer parameters */
function applyMaterial(){
 const m=curMat(),t=S.sheet.thick;
 if(S.machine.type==='laser'){
  const k=clamp(t/(m.t||t),.5,3);// thicker sheet of same kind → more passes
  const L0=S.layers[0].laser,L1=S.layers[1].laser,L2=S.layers[2].laser;
  if(m.cut)Object.assign(L0,{mode:'line',power:m.cut.power,speed:m.cut.speed,passes:Math.max(1,Math.round(m.cut.passes*k))});
  Object.assign(L1,{mode:'fill',power:m.eng.power,speed:m.eng.speed,interval:m.eng.interval});
  Object.assign(L2,{mode:'line',power:m.score.power,speed:m.score.speed,passes:1});
 }else{
  for(const i of[0,1,2]){const c=S.layers[i].cnc;c.rpm=m.rpm;c.feed=Math.round(m.rpm*2*m.chip*(c.tool<2?.6:1));c.plunge=Math.round(c.feed*.35);c.step=fx(Math.max(.2,c.tool*m.doc),2)}
  S.layers[0].cnc.depth=fx(t+.2,2);
 }
}

/* ================= toast / modal / busy ================= */
let toastT=0;function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>e.hidden=true,3800)}
function openModal(title,body,foot,cls){const d=$('#dialog');d.className='dialog'+(cls?' '+cls:'');d.innerHTML=`<header><h2>${title}</h2><button class="icon-btn" data-act="closeModal" aria-label="${T('Закрыть','Close')}">✕</button></header><div class="body">${body}</div>${foot!=null?`<footer>${foot}</footer>`:''}`;$('#modal').hidden=false}
let onModalClose=null;
function closeModal(){$('#modal').hidden=true;if(onModalClose){const f=onModalClose;onModalClose=null;f()}}
function busy(t){const b=$('#busy');if(t==null){b.hidden=true;return}$('#busyT').textContent=t;b.hidden=false}
const numF=(label,attrs,val,unit,step=.1,cls='')=>`<label class="fld ${cls}"><span>${label}</span><div class="inp"><input type="number" ${attrs} value="${val}" step="${step}">${unit?`<em>${unit}</em>`:''}</div></label>`;
const selF=(label,attrs,opts,val,cls='')=>`<label class="fld ${cls}"><span>${label}</span><div class="inp"><select ${attrs}>${opts.map(([v,n])=>`<option value="${esc(v)}" ${String(v)===String(val)?'selected':''}>${esc(n)}</option>`).join('')}</select></div></label>`;
