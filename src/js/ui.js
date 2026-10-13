'use strict';
/* ================= Kerf Studio · UI: panels, modes, machine, events, boot ================= */
const MC={mode:'demo',connected:false,port:null,writer:null,reader:null,pos:[0,0,0],zero:[0,0,0],log:[],job:{run:false,pause:false,t:0,line:0},step:10,feedOv:100,demoRate:20,checks:{a:false,b:false,c:false},baud:115200};
const DESK=window.kerfDesktop||null;
async function saveOut(name,data,ext,label){if(!DESK)return false;try{const r=await DESK.saveFile({name,data,filters:[{name:label,extensions:[ext]}]});if(r&&r.ok)toast(T('Сохранено: ','Saved: ')+r.path)}catch(e){toast(T('Не удалось сохранить файл: ','Could not save the file: ')+(e.message||e))}return true}
function openDeskFile(f){if(!f)return;try{if(/\.(kerf|json)$/i.test(f.name)){const j=JSON.parse(f.data);if(!(j.v===1||j.v===2)||!Array.isArray(j.shapes))throw 0;pushUndo();S=migrate(j);sel.clear();curPlate=0;changed();fitPlate(0);draw();toast(T('Открыт проект ','Opened project ')+f.name)}
 else if(/\.(nc|gcode|gc|ngc|tap)$/i.test(f.name)){loadGcode(f.data,f.name);P.t=0;switchTab('gcode');refresh()}}catch(e){toast(T('Не удалось открыть файл.','Could not open the file.'))}}
const WIZ=[['slicer','slices',()=>T('3D-модель → слои','3D model → layers'),()=>T('STL/OBJ режется на листы: стопка или решётка, штифты, раскладка','STL/OBJ sliced into sheets: stacked or interlocked, dowels, nesting')],
 ['layered','layers',()=>GENS.layered.name(),()=>GENS.layered.desc()],['box','box',()=>GENS.box.name(),()=>GENS.box.desc()],['puzzle','puzzle',()=>GENS.puzzle.name(),()=>GENS.puzzle.desc()],
 ['sign','sign',()=>GENS.sign.name(),()=>GENS.sign.desc()],['gear','gear',()=>GENS.gear.name(),()=>GENS.gear.desc()],['qr','qr',()=>GENS.qr.name(),()=>GENS.qr.desc()],
 ['hinge','hinge',()=>GENS.hinge.name(),()=>GENS.hinge.desc()],['test','test',()=>GENS.test.name(),()=>GENS.test.desc()]];
function changed(){camDirty=true;save();refresh()}
function refresh(){document.body.classList.toggle('simple',mode==='simple');renderLeft();renderRight();renderChrome();renderStatus();draw()}
const isLaser=()=>S.machine.type==='laser';

/* ================= top bar & stage chrome ================= */
function renderTop(){
 document.documentElement.lang=lang;const m=S.machine;
 $('#deviceBtn').innerHTML=`<span class="dev-ic">${ic(isLaser()?'laser':'cnc',18)}</span><span class="dev-txt"><b>${esc(m.name)}</b><small>${m.w}×${m.h} ${MM()} · ${isLaser()?T('лазер','laser'):T('фрезер','router')}</small></span>${ic('chev',14)}`;
 $('#deviceBtn').title=T('Профиль станка и настройки','Machine profile and settings');
 $('#modeSeg').innerHTML=`<button data-mode="simple" aria-pressed="${mode==='simple'}" title="${T('Простой режим: мастера, материалы, минимум настроек','Simple mode: wizards, materials, fewer settings')}">${T('Простой','Simple')}</button><button data-mode="pro" aria-pressed="${mode==='pro'}" title="${T('Профессиональный режим: все параметры','Pro mode: every parameter')}">${T('Про','Pro')}</button>`;
 const tabs=[['cad','CAD',T('Чертёж','Design')],['cam','CAM',T('Траектории','Toolpaths')],['gcode',T('G-код','G-code'),T('Симуляция','Simulation')],['machine',T('Станок','Machine'),T('Управление','Control')]];
 $('#tabs').innerHTML=tabs.map(([id,a,b],i)=>`<button role="tab" data-tab="${id}" aria-selected="${tab===id}"><i>${i+1}</i><span><b>${a}</b><small>${b}</small></span></button>`).join('');
 $$('#langSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lang===lang));
 const th=document.documentElement.dataset.theme||'system';$('#themeBtn').innerHTML=ic('theme',17);$('#themeBtn').title=T('Тема: ','Theme: ')+({system:T('как в системе','system'),light:T('светлая','light'),dark:T('тёмная','dark')})[th];
 const pb=$('#primaryBtn'),pl=S.plates>1?` · ${T('лист','sheet')} ${curPlate+1}`:'';
 if(tab==='cad'||tab==='cam'){pb.innerHTML=`${ic('play',14)} ${T('Рассчитать','Generate')}${pl}`;pb.disabled=!S.shapes.some(s=>plateOf(s)===curPlate)}
 else if(tab==='gcode'){pb.innerHTML=`${T('На станок','To machine')} →`;pb.disabled=!P.moves.length}
 else{pb.innerHTML=MC.job.run?`${ic('stop',14)} ${T('Стоп','Stop')}`:`${ic('play',14)} ${T('Запустить','Start job')}`;pb.disabled=!P.moves.length}
}
const TOOLS_UI=[['select','V',()=>T('Выбор и перемещение','Select & move')],['hand','H',()=>T('Панорама','Pan')],null,['rect','R',()=>T('Прямоугольник (Shift — квадрат)','Rectangle (Shift = square)')],['ellipse','E',()=>T('Эллипс (Shift — круг)','Ellipse (Shift = circle)')],['polygon','P',()=>T('Многоугольник','Polygon'),1],['star','S',()=>T('Звезда','Star'),1],['line','L',()=>T('Линия','Line'),1],['pen','N',()=>T('Ломаная (Enter — завершить)','Polyline (Enter to finish)')],['text','T',()=>T('Текст','Text')],null,['measure','M',()=>T('Рулетка','Measure'),1]];
function renderChrome(){
 renderTop();const isM=tab==='machine';
 $('#cv').hidden=isM;$('#mach').hidden=!isM;$('#stage').classList.toggle('machmode',isM);
 const tb=$('#toolbar');tb.hidden=tab!=='cad';
 if(tab==='cad')tb.innerHTML=TOOLS_UI.map(t=>t?`<button data-tool="${t[0]}" class="${t[3]?'pro':''}" aria-pressed="${tool===t[0]}" title="${t[2]()} (${t[1]})" aria-label="${t[2]()}">${ic(t[0],19)}</button>`:'<hr>').join('');
 const vb=$('#viewbar');vb.hidden=isM;
 if(!isM){let h='';
  if(tab==='cad')h+=`<button class="icon-btn" data-act="undo" title="${T('Отменить','Undo')} (Ctrl+Z)" ${undoS.length?'':'disabled'}>${ic('undo')}</button><button class="icon-btn" data-act="redo" title="${T('Повторить','Redo')} (Ctrl+Y)" ${redoS.length?'':'disabled'}>${ic('redo')}</button><span class="sep"></span><button class="btn" data-act="nestSel" title="${T('Разложить выделенное (или всё на листе) по листам','Nest the selection (or the whole sheet)')}">${ic('nest',16)} ${T('Раскладка','Nest')}</button><span class="sep"></span>`;
  if(tab==='gcode')h+=`<div class="seg"><button data-act="pmode" data-v="2d" aria-pressed="${P.mode==='2d'}">2D</button><button data-act="pmode" data-v="3d" aria-pressed="${P.mode==='3d'}">3D</button></div><span class="sep"></span>`;
  h+=`<button class="icon-btn" data-act="zout" title="${T('Отдалить','Zoom out')}">${ic('zout')}</button><button class="icon-btn" data-act="zin" title="${T('Приблизить','Zoom in')}">${ic('zin')}</button><button class="icon-btn" data-act="fit" title="${T('Показать лист','Fit sheet')} (F)">${ic('fit')}</button>${tab==='cad'&&S.plates>1?`<button class="icon-btn" data-act="fitAll" title="${T('Все листы','All sheets')}">${ic('grid')}</button>`:''}`;
  vb.innerHTML=h}
 renderPlates();
 const pal=$('#palette');pal.hidden=tab!=='cad';
 if(tab==='cad'){const L3=[0,1,2].map(i=>S.layers[i]);
  pal.innerHTML=`<span>${sel.size?T('Операция для выделенного:','Operation for selection:'):T('Рисовать на слое:','Draw on layer:')}</span>`+
   `<span class="simple-only" style="display:contents">${L3.map(L=>`<button class="wide${curDrawLayer===L.id&&!sel.size?' cur':''}" data-act="assign" data-l="${L.id}" style="background:${L.color}">${esc(layerName(L))}</button>`).join('')}</span>`+
   `<span class="pro" style="display:contents">${S.layers.map(L=>`<button class="${curDrawLayer===L.id&&!sel.size?'cur':''}" data-act="assign" data-l="${L.id}" style="background:${L.color}" title="${esc(layerName(L))}">${L.id===TOOL_L?'T':String(L.id+1).padStart(2,'0')}</button>`).join('')}</span>`}
 const pbar=$('#playbar');pbar.hidden=tab!=='gcode';
 if(tab==='gcode'){pbar.innerHTML=`<button class="icon-btn" data-act="play" title="${P.playing?T('Пауза','Pause'):T('Воспроизвести','Play')} (Space)" ${P.moves.length?'':'disabled'}>${ic(P.playing?'pause':'play',15)}</button>
  <input type="range" id="pbSlider" min="0" max="1000" step="1" value="${P.total?Math.round(P.t/P.total*1000):1000}" aria-label="${T('Прогресс симуляции','Simulation progress')}">
  <span class="time" id="pbTime"></span><div class="seg" title="${T('Скорость симуляции','Simulation speed')}">${[1,10,50,200].map(r=>`<button data-act="rate" data-v="${r}" aria-pressed="${P.rate===r}">${r}×</button>`).join('')}</div>`;updatePbTime()}
 if(isM)renderMachineView();
}
function renderPlates(){
 const el=$('#plates'),show=tab==='cad'||((tab==='cam'||tab==='gcode')&&S.plates>1);el.hidden=!show||tab==='gcode';if(!show)return;
 const cnt=i=>S.shapes.filter(s=>plateOf(s)===i).length;let h='';
 for(let i=0;i<S.plates;i++)h+=`<button data-act="plate" data-v="${i}" aria-pressed="${i===curPlate}" title="${T('Лист ','Sheet ')}${i+1}">${T('Лист ','Sheet ')}${i+1} <small>${cnt(i)}</small></button>`;
 if(tab==='cad')h+=`<button data-act="addPlate" title="${T('Добавить лист','Add sheet')}">${ic('plus',14)}</button>${S.plates>1?`<button class="pro" data-act="delPlate" title="${T('Удалить текущий лист','Delete current sheet')}">${ic('trash',14)}</button>`:''}`;
 el.innerHTML=h;
}
function updatePbTime(){const e=$('#pbTime');if(e)e.textContent=`${fmtTime(P.t)} / ${fmtTime(P.total)}`;const s=$('#pbSlider');if(s&&document.activeElement!==s)s.value=P.total?Math.round(P.t/P.total*1000):1000}

/* ================= left pane ================= */
function wizHtml(compact){return `<div class="wiz${compact?' compact':''}">${WIZ.map(([k,icn,n,d],i)=>`<button data-act="wiz" data-v="${k}" class="${i===0?'hero':''}" ${GENS[k]&&GENS[k].laserOnly&&!isLaser()?'disabled style="opacity:.45"':''}>${ic(icn,i===0?26:20)}${i===0?`<span><b>${n()}</b><small>${d()}</small></span>`:`<b>${n()}</b><small>${d()}</small>`}</button>`).join('')}</div>`}
function shapeUnits(list){const units=[],seen=new Set();for(const s of list){if(s.g){if(seen.has(s.g))continue;seen.add(s.g);units.push(list.filter(q=>q.g===s.g))}else units.push([s])}return units}
function renderLeft(){
 const el=$('#left');
 if(tab==='cad'){
  const used=usedLayers();
  const lay=used.map(L=>{const n=S.shapes.filter(s=>s.layer===L.id).length,md=!L.out?T('не выводится','no output'):isLaser()?laserModeName(L.laser.mode):cncOpName(L.cnc.op);
   return `<div class="li${L.show?'':' off'}" data-act="pickLayer" data-l="${L.id}"><span class="sw" style="background:${L.color}"></span><span class="nm">${esc(layerName(L))}</span><span class="meta">${n} · ${md}</span><button class="mini" data-act="eye" data-l="${L.id}" title="${T('Показать/скрыть','Show/hide')}">${ic(L.show?'eye':'eyeoff',15)}</button></div>`}).join('')||`<p class="note">${T('Слои появятся, когда вы что-нибудь нарисуете.','Layers appear once you draw something.')}</p>`;
  const units=shapeUnits([...S.shapes].reverse()).filter(u=>plateOf(u[0])===curPlate);
  const objs=units.slice(0,300).map(u=>{const s=u[0],L=S.layers[s.layer],b=bboxOf(u.flatMap(q=>q.paths)),on=u.some(q=>sel.has(q.id));
   return `<div class="li${on?' on':''}" data-act="pickShape" data-id="${s.id}"><span class="sw" style="background:${L.color}"></span>${ic(u.length>1?'group':kindIcon(s.kind),15)}<span class="nm">${esc(u.length>1?(s.nm||T('Группа','Group'))+` · ${u.length}`:(s.nm||kindName(s)))}</span><span class="meta">${fx(b[2]-b[0],0)}×${fx(b[3]-b[1],0)}</span></div>`}).join('')||`<p class="note">${T('На этом листе пусто. Выберите мастер выше, инструмент слева на холсте или импортируйте файл.','This sheet is empty. Pick a wizard above, a tool on the canvas, or import a file.')}</p>`;
  el.innerHTML=`<div class="sec"><h3>${mode==='simple'?T('Что сделаем?','What shall we make?'):T('Мастера и генераторы','Wizards & generators')}</h3>${wizHtml(mode!=='simple')}</div>
   <div class="sec"><h3>${T('Импорт','Import')}</h3><div class="grid3"><button class="btn" data-act="impVec" title="SVG, DXF">${ic('svg',15)} SVG/DXF</button><button class="btn" data-act="impImg">${ic('image',15)} ${T('Фото','Image')}</button><button class="btn" data-act="imp3d">${ic('cube',15)} STL/OBJ</button></div></div>
   <div class="sec pro"><h3>${T('Проект','Project')}</h3><div class="grid3"><button class="btn" data-act="newProj">${ic('newp',15)} ${T('Новый','New')}</button><button class="btn" data-act="exportProj">${ic('save',15)} ${T('Сохранить','Save')}</button><button class="btn" data-act="impProj">${ic('open',15)} ${T('Открыть','Open')}</button>
    <button class="btn" data-act="sample">${ic('file',15)} ${T('Пример','Sample')}</button><button class="btn bad" data-act="clearAll">${ic('trash',15)} ${T('Очистить','Clear')}</button><button class="btn" data-act="svgCopy" title="${T('Копировать лист как SVG','Copy sheet as SVG')}">SVG ↗</button></div></div>
   <div class="sec pro"><h3>${T('Слои','Layers')}<span class="sp"></span><em>${used.length}</em></h3><div class="list">${lay}</div></div>
   <div class="sec grow"><h3>${T('Объекты на листе','Objects on sheet')} ${curPlate+1}<span class="sp"></span><em>${units.length}</em></h3><div class="list">${objs}</div></div>`;
 }else if(tab==='cam'){
  ensureCam();const used=usedLayers(curPlate).filter(L=>L.out);if(camSel==null||!used.find(L=>L.id===camSel))camSel=used[0]?used[0].id:null;
  const ops=used.map((L,i)=>`<div class="li${L.id===camSel?' on':''}${L.on?'':' off'}" data-act="camPick" data-l="${L.id}">
   <input type="checkbox" data-act="camOn" data-l="${L.id}" ${L.on?'checked':''} title="${T('Включить операцию','Enable operation')}">
   <span class="sw" style="background:${L.color}"></span><span class="nm">${esc(layerName(L))}<br><span class="meta">${opSummary(L)}</span></span>
   <button class="mini pro" data-act="camUp" data-l="${L.id}" ${i?'':'disabled'} title="${T('Выше','Move up')}">${ic('up',14)}</button><button class="mini pro" data-act="camDown" data-l="${L.id}" ${i<used.length-1?'':'disabled'} title="${T('Ниже','Move down')}">${ic('down',14)}</button></div>`).join('')||`<p class="note">${T('На этом листе нечего обрабатывать — нарисуйте что-нибудь во вкладке CAD.','Nothing to machine on this sheet — draw something in CAD.')}</p>`;
  el.innerHTML=`${S.plates>1?`<div class="sec"><h3>${T('Лист','Sheet')}</h3><div class="seg full">${Array.from({length:S.plates},(_,i)=>`<button data-act="plate" data-v="${i}" aria-pressed="${i===curPlate}">${i+1}</button>`).join('')}</div></div>`:''}
   <div class="sec"><h3>${T('Операции','Operations')}<span class="sp"></span><em>${T('по порядку','in order')}</em></h3><div class="list">${ops}</div>
   <p class="note">${T('Каждый цветной слой — отдельная операция. Сверху вниз — порядок выполнения.','Each colour layer is one operation, run top to bottom.')}</p></div>
   <div class="sec"><h3>${T('Материал','Material')}</h3><p class="note"><b>${esc(matName(curMat(),S.sheet.thick))}</b> · ${T('лист','sheet')} ${fx(S.sheet.w,0)}×${fx(S.sheet.h,0)} ${MM()}</p><button class="btn" data-act="applyMat">${ic('wand',14)} ${T('Подставить параметры материала','Apply material settings')}</button></div>
   <div class="sec pro"><h3>${T('Задание','Job')}</h3><label class="chk"><input type="checkbox" data-job="innerFirst" ${S.job.innerFirst?'checked':''}> ${T('Сначала внутренние контуры','Cut inner shapes first')}</label>
   <p class="note">${isLaser()?T('Ноль XY — левый нижний угол поля. G0 выполняется с выключенным лучом (режим лазера GRBL, $32=1).','XY zero is the lower-left corner. G0 moves run with the beam off (GRBL laser mode, $32=1).'):T('Ноль Z — верх заготовки, ноль XY — левый нижний угол поля.','Z zero is the stock top, XY zero is the lower-left corner.')}</p></div>
   ${lastWarn.length?`<div class="sec"><h3>${T('Проверка','Checks')}</h3><div class="warnbox">${lastWarn.map(w=>`<div>${esc(w)}</div>`).join('')}</div></div>`:''}`;
 }else if(tab==='gcode'){
  ensureCam();const st=P.stats;
  el.innerHTML=`${S.plates>1&&!P.file?`<div class="sec"><h3>${T('Лист','Sheet')}</h3><div class="seg full">${Array.from({length:S.plates},(_,i)=>`<button data-act="plate" data-v="${i}" aria-pressed="${i===curPlate}">${i+1}</button>`).join('')}</div></div>`:''}
   <div class="sec"><h3>${T('G-код','G-code')}<span class="sp"></span><em>${P.lines.length.toLocaleString(lang)} ${T('стр.','lines')}</em></h3>
   <div class="row"><span class="pill ${P.file?'mut':'ok'}">${P.file?esc(P.file):T('из проекта','from project')}</span>${st?`<span class="pill mut">${fmtTime(st.time)}</span>`:''}</div>
   <div class="grid2"><button class="btn" data-act="copyGc">${ic('copy',15)} ${T('Копировать','Copy')}</button><button class="btn" data-act="openGc">${ic('open',15)} ${T('Открыть .nc','Open .nc')}</button>
   <button class="btn pro" data-act="editGc">${ic('edit',15)} ${T('Редактировать','Edit')}</button><button class="btn pro" data-act="svgCopy">SVG ↗</button></div>
   ${DESK&&P.moves.length?`<button class="btn block acc" data-act="saveGc">${ic('save',15)} ${T('Сохранить G-код в файл','Save G-code to file')}</button>`:''}
   ${P.file?`<button class="btn block" data-act="backProj">${T('Вернуть G-код проекта','Back to project G-code')}</button>`:''}
   <label class="chk pro"><input type="checkbox" id="followChk" ${P.follow?'checked':''}> ${T('Следить за текущей строкой','Follow current line')}</label></div>
   <div class="gcwrap pro"><div id="gcList" tabindex="0" aria-label="G-code"><div id="gcInner"></div></div></div>
   <div class="sec simple-only"><p class="note">${T('Листинг G-кода и редактор доступны в режиме «Про».','The G-code listing and editor are in Pro mode.')}</p></div>`;
  const gl=$('#gcList');if(gl){gl.addEventListener('scroll',renderGcList);renderGcList()}
 }else{
  const L=isLaser();
  el.innerHTML=`<div class="sec"><h3>${T('Подключение','Connection')}<span class="sp"></span><span class="pill ${MC.connected?'ok':MC.mode==='demo'?'warn':'mut'}">${MC.connected?T('подключено','connected'):MC.mode==='demo'?T('демо','demo'):T('нет связи','offline')}</span></h3>
   <div class="seg full"><button data-act="mcMode" data-v="demo" aria-pressed="${MC.mode==='demo'}">${T('Демо-станок','Demo machine')}</button><button data-act="mcMode" data-v="serial" aria-pressed="${MC.mode==='serial'}">USB / Serial</button></div>
   ${MC.mode==='serial'?`${selF(T('Скорость порта','Baud rate'),'id="baudSel"',[9600,57600,115200,230400,250000].map(b=>[b,b]),MC.baud)}
   <button class="btn block acc" data-act="mcConnect">${ic('link',15)} ${MC.connected?T('Отключить','Disconnect'):T('Выбрать порт и подключить','Pick port & connect')}</button>
   <p class="note">${T('Web Serial в Chrome/Edge и в настольной версии. Протокол GRBL 1.1: строка → «ok».','Web Serial in Chrome/Edge and the desktop build. GRBL 1.1 protocol: line → “ok”.')}</p>`:
   `<p class="note">${T('Демо-станок повторяет движения по рассчитанному G-коду — удобно проверить задание до реального запуска.','The demo machine replays the generated G-code, so you can check a job before a real run.')}</p>`}</div>
   <div class="sec"><h3>${T('Станок','Machine')}</h3><div class="kv"><span>${T('Профиль','Profile')}</span><b>${esc(S.machine.name)}</b><span>${T('Поле','Work area')}</span><b>${S.machine.w}×${S.machine.h} ${MM()}</b>
   <span>${T('Прошивка','Firmware')}</span><b>${({grbl:'GRBL 1.1',marlin:'Marlin',fluidnc:'FluidNC'})[S.machine.fw]||'GRBL'}</b><span>${T('Материал','Material')}</span><b>${esc(matName(curMat(),S.sheet.thick))}</b></div>
   <button class="btn" data-act="settings">${ic('cog',15)} ${T('Настройки станка','Machine settings')}</button></div>
   <div class="sec"><h3>${T('Перед запуском','Before you start')}</h3>
   ${[['a',L?T('Защитные очки под длину волны лазера','Laser-rated safety glasses on'):T('Заготовка надёжно закреплена','Stock is clamped down')],['b',L?T('Вытяжка и обдув включены','Extraction and air assist on'):T('Фреза затянута, ноль Z выставлен','Bit is tight, Z zero is set')],['c',L?T('Не отхожу от станка во время работы','I will stay with the machine'):T('Очки надеты, руки вне зоны','Glasses on, hands clear')]].map(([k,t])=>`<label class="chk"><input type="checkbox" data-chk="${k}" ${MC.checks[k]?'checked':''}> ${t}</label>`).join('')}</div>`;
 }
}
function kindIcon(k){return({rect:'rect',ellipse:'ellipse',polygon:'polygon',star:'star',line:'line',pen:'pen',text:'text',svg:'svg',dxf:'svg',trace:'wand',image:'image',bool:'group',offset:'group',part:'nest'})[k]||'rect'}
function kindName(s){const n={rect:T('Прямоугольник','Rectangle'),ellipse:T('Эллипс','Ellipse'),polygon:T('Многоугольник','Polygon'),star:T('Звезда','Star'),line:T('Линия','Line'),pen:T('Ломаная','Polyline'),text:T('Текст','Text'),svg:'SVG',dxf:'DXF',trace:T('Трассировка','Trace'),image:T('Фото','Photo'),bool:T('Контур','Shape'),offset:T('Смещение','Offset'),part:T('Деталь','Part')}[s.kind]||T('Фигура','Shape');return s.kind==='text'?`${n} «${String(s.text).replace(/\n/g,' ')}»`:`${n} #${s.id}`}
const laserModeName=m=>({line:T('Линия','Line'),fill:T('Заливка','Fill'),both:T('Заливка+линия','Fill+line')})[m];
const cncOpName=o=>({out:T('Снаружи','Outside'),in:T('Внутри','Inside'),on:T('По линии','On line'),pocket:T('Карман','Pocket'),engrave:T('Гравировка','Engrave'),drill:T('Сверление','Drill'),vcarve:T('V-резьба','V-carve')})[o];
function opSummary(L){if(isLaser()){const l=L.laser;return `${laserModeName(l.mode)} · ${l.power}% · ${l.speed} ${MMIN()}${l.passes>1?' · ×'+l.passes:''}`}const c=L.cnc;return `${cncOpName(c.op)} · ⌀${fx(c.tool,3)} · ${fx(c.depth,2)} ${MM()}`}

/* ================= right pane ================= */
function sheetSection(){const sh=S.sheet,ml=matList();
 return `<div class="sec"><h3>${T('Материал и лист','Material & sheet')}<span class="sp"></span><label class="chk pro" style="text-transform:none;letter-spacing:0;font-weight:400"><input type="checkbox" data-sheet="on" ${sh.on?'checked':''}> ${T('на столе','on bed')}</label></h3>
  ${selF(T('Материал','Material'),'id="matSel"',ml.map((m,i)=>[i,`${lang==='ru'?m.ru:m.en} · ${m.t} ${MM()}`]),sh.mat)}
  <div class="grid2">${numF(T('Толщина','Thickness'),'data-sheet="thick" min="0.1"',sh.thick,MM(),.1)}${selF(T('Формат','Format'),'id="sheetPreset"',[['',T('свой','custom')],...SHEETS.map((s,i)=>[i,s[0]])],SHEETS.findIndex(s=>s[1]===sh.w&&s[2]===sh.h))}
  ${numF(T('Ширина листа','Sheet width'),'data-sheet="w" min="10"',sh.w,MM(),1)}${numF(T('Высота листа','Sheet height'),'data-sheet="h" min="10"',sh.h,MM(),1)}
  ${numF(T('Отступ X','Offset X'),'data-sheet="x" min="0"',sh.x,MM(),1,'pro')}${numF(T('Отступ Y','Offset Y'),'data-sheet="y" min="0"',sh.y,MM(),1,'pro')}
  ${numF(T('Поля для раскладки','Nesting margin'),'data-sheet="margin" min="0"',sh.margin,MM(),.5,'pro')}</div>
  <p class="note">${T('Лист — это ваша заготовка на столе. Раскладка и мастера кладут детали внутрь неё.','The sheet is your stock on the bed. Nesting and wizards place parts inside it.')}</p></div>`}
function renderRight(){
 const el=$('#right');
 if(tab==='cad'){
  const ss=selShapes();
  if(ss.length){
   const b=selBox(),units=shapeUnits(ss),one=ss.length===1?ss[0]:null,ox=plateX(plateOfBox([b[0],b[1],b[0],b[1]])),hasImg=ss.some(s=>s.kind==='image'),L0=S.layers[ss[0].layer];
   let h=`<div class="sec"><h3>${units.length>1?T('Выделено: ','Selected: ')+units.length:esc(one?(one.nm||kindName(one)):(ss[0].nm||T('Группа','Group')))}<span class="sp"></span><button class="mini" data-act="dup" title="${T('Дублировать','Duplicate')} (Ctrl+D)">${ic('copy',15)}</button><button class="mini" data-act="del" title="${T('Удалить','Delete')} (Del)">${ic('trash',15)}</button></h3>
    <div class="grid2">${numF('X','data-prop="x"',fx(b[0]-ox,2),MM())}${numF('Y','data-prop="y"',fx(b[1],2),MM())}${numF(T('Ширина','Width'),'data-prop="w"',fx(b[2]-b[0],2),MM())}${numF(T('Высота','Height'),'data-prop="h"',fx(b[3]-b[1],2),MM())}</div>
    <label class="chk"><input type="checkbox" id="lockRatio" ${toolOpt.lock?'checked':''}> ${T('Сохранять пропорции','Keep proportions')}</label>
    <div class="grid3"><button class="btn" data-act="rot" data-v="-90">↺ 90°</button><button class="btn" data-act="rot" data-v="90">↻ 90°</button><button class="btn" data-act="center">${T('В центр','Center')}</button>
    <button class="btn" data-act="mirror" data-v="h">⇋ ${T('Гориз.','Flip H')}</button><button class="btn" data-act="mirror" data-v="v">⇵ ${T('Верт.','Flip V')}</button><button class="btn" data-act="nestSel">${ic('nest',14)} ${T('Разложить','Nest')}</button></div>
    <div class="row pro">${numF(T('Повернуть на','Rotate by'),'id="rotBy"',0,'°',1)}<div class="fld" style="align-self:end"><button class="btn" data-act="rotApply">${T('Применить','Apply')}</button></div></div></div>
    <div class="sec"><h3>${T('Операция','Operation')}</h3><div class="grid3">${[0,1,2].map(i=>`<button class="btn${ss.every(s=>s.layer===i)?' acc':''}" data-act="assign" data-l="${i}"><span class="sw" style="background:${S.layers[i].color}"></span>${esc(layerName(S.layers[i]))}</button>`).join('')}</div>
    <p class="note pro">${T('Другие слои — в палитре внизу холста. Слой «T» — направляющие, не выводятся.','More layers are in the palette under the canvas. Layer “T” holds guides and is not output.')}</p>
    ${isLaser()?`<label class="chk pro"><input type="checkbox" id="ovChk" ${ss.every(s=>s.ov)?'checked':''}> ${T('Свои мощность и скорость для объекта','Own power & speed for this object')}</label>
    ${ss.every(s=>s.ov)?`<div class="grid2 pro">${numF(T('Мощность','Power'),'data-ov="power" min="0" max="100"',ss[0].ov.power,'%',1)}${numF(T('Скорость','Speed'),'data-ov="speed" min="1"',ss[0].ov.speed,MMIN(),10)}</div>`:''}`:''}</div>`;
   if(one&&one.kind==='text')h+=`<div class="sec"><h3>${T('Текст','Text')}</h3><textarea class="plain" id="txtEdit" rows="2">${esc(one.text)}</textarea>
    <div class="grid2">${selF(T('Шрифт','Font'),'id="txtFont"',Object.entries(FONTS).map(([k,f])=>[k,f.n]),one.font)}${numF(T('Размер','Size'),'id="txtSize" min="1"',one.size,MM(),.5)}</div>
    <button class="btn acc" data-act="txtApply">${T('Обновить текст','Update text')}</button></div>`;
   if(one&&one.kind==='image'){const o=one.img;h+=`<div class="sec"><h3>${T('Фото','Photo')}</h3>
    ${selF(T('Дизеринг','Dithering'),'data-img="mode"',[['jarvis','Jarvis'],['fs','Floyd–Steinberg'],['stucki','Stucki'],['atkinson','Atkinson'],['ordered',T('Упорядоченный (Байер)','Ordered (Bayer)')],['threshold',T('Порог','Threshold')],['gray',T('Оттенки серого (мощность)','Grayscale (power)')]],o.mode)}
    <label class="fld"><span>${T('Яркость','Brightness')}: ${o.bright}</span><input type="range" min="-100" max="100" value="${o.bright}" data-img="bright"></label>
    <label class="fld"><span>${T('Контраст','Contrast')}: ${o.contrast}</span><input type="range" min="-100" max="100" value="${o.contrast}" data-img="contrast"></label>
    <label class="fld pro"><span>${T('Гамма','Gamma')}: ${o.gamma}</span><input type="range" min="0.3" max="3" step="0.05" value="${o.gamma}" data-img="gamma"></label>
    ${o.mode==='threshold'?`<label class="fld"><span>${T('Порог','Threshold')}: ${o.thr}</span><input type="range" min="1" max="254" value="${o.thr}" data-img="thr"></label>`:''}
    <label class="chk"><input type="checkbox" data-img="invert" ${o.invert?'checked':''}> ${T('Инвертировать (для тёмных материалов, стекла, сланца)','Invert (for dark materials, glass, slate)')}</label>
    <p class="note">${T('Разрешение гравировки задаётся шагом строк в CAM.','Engraving resolution is the line interval in CAM.')}</p></div>`}
   h+=`<div class="sec pro"><h3>${T('Выравнивание','Align')}</h3><div class="grid3">
    <button class="btn" data-act="align" data-v="l">⇤ ${T('Лево','Left')}</button><button class="btn" data-act="align" data-v="cx">↔ ${T('Центр','Centre')}</button><button class="btn" data-act="align" data-v="r">${T('Право','Right')} ⇥</button>
    <button class="btn" data-act="align" data-v="t">⤒ ${T('Верх','Top')}</button><button class="btn" data-act="align" data-v="cy">↕ ${T('Середина','Middle')}</button><button class="btn" data-act="align" data-v="b">⤓ ${T('Низ','Bottom')}</button></div>
    <p class="note">${units.length>1?T('Относительно общей рамки выделения; группы двигаются целиком.','Relative to the selection frame; groups move as one.'):T('Одиночный объект выравнивается по листу материала.','A single object aligns to the material sheet.')}</p></div>
    <div class="sec pro"><h3>${T('Построение','Construct')}</h3>
    <div class="grid3"><button class="btn" data-act="bool" data-v="union" ${ss.length>1?'':'disabled'}>${T('Объединить','Union')}</button><button class="btn" data-act="bool" data-v="diff" ${ss.length>1?'':'disabled'}>${T('Вычесть','Subtract')}</button><button class="btn" data-act="bool" data-v="inter" ${ss.length>1?'':'disabled'}>${T('Пересечь','Intersect')}</button>
    <button class="btn" data-act="group" ${ss.length>1?'':'disabled'}>${ic('group',14)} ${T('Группа','Group')}</button><button class="btn" data-act="ungroup" ${ss.some(s=>s.g)?'':'disabled'}>${ic('ungroup',14)} ${T('Разгрупп.','Ungroup')}</button><button class="btn" data-act="break">${ic('split',14)} ${T('Разбить','Break')}</button></div>
    <div class="row">${numF(T('Смещение контура','Offset outline'),'id="offD"',toolOpt.off,MM(),.5)}<div class="fld" style="align-self:end"><button class="btn" data-act="offset">${T('Создать','Create')}</button></div><div class="fld" style="align-self:end"><button class="btn" data-act="simplify" title="${T('Упростить узлы (0,1 мм)','Simplify nodes (0.1 mm)')}">${ic('smooth',14)}</button></div></div>
    <div class="grid3">${numF(T('Столбцы','Columns'),'id="arrC" min="1"',toolOpt.ac,'',1)}${numF(T('Ряды','Rows'),'id="arrR" min="1"',toolOpt.ar,'',1)}${numF(T('Зазор','Gap'),'id="arrG"',toolOpt.ag,MM(),.5)}</div>
    <button class="btn" data-act="array">${ic('grid',14)} ${T('Массив сеткой','Grid array')}</button>
    <div class="grid2">${numF(T('Копий по кругу','Copies in circle'),'id="cirN" min="2"',toolOpt.cc,'',1)}${numF(T('Радиус','Radius'),'id="cirR" min="1"',toolOpt.cr,MM(),1)}</div>
    <button class="btn" data-act="circArr">${ic('circle',14)} ${T('Круговой массив','Circular array')}</button>
    <p class="note">${T('Вычитание: из самой большой фигуры удаляются остальные. Alt+клик или двойной клик выбирает объект внутри группы.','Subtract removes other shapes from the largest. Alt+click or double-click picks one object inside a group.')}</p></div>`;
   el.innerHTML=h;return;
  }
  let opt='';
  if(tool==='rect')opt=numF(T('Радиус скругления','Corner radius'),'data-topt="radius" min="0"',toolOpt.radius,MM(),.5);
  else if(tool==='polygon')opt=numF(T('Число сторон','Sides'),'data-topt="sides" min="3" max="64"',toolOpt.sides,'',1);
  else if(tool==='star')opt=`<div class="grid2">${numF(T('Лучей','Points'),'data-topt="points" min="3" max="40"',toolOpt.points,'',1)}${numF(T('Внутр. радиус','Inner radius'),'data-topt="inner" min="5" max="95"',toolOpt.inner,'%',1)}</div>`;
  else if(tool==='text')opt=`<textarea class="plain" data-topt="text" rows="2">${esc(toolOpt.text)}</textarea><div class="grid2">${selF(T('Шрифт','Font'),'data-topt="font"',Object.entries(FONTS).map(([k,f])=>[k,f.n]),toolOpt.font)}${numF(T('Размер','Size'),'data-topt="size" min="1"',toolOpt.size,MM(),.5)}</div><p class="note">${T('Кликните по холсту, чтобы поставить текст. Буквы сразу становятся контурами для станка.','Click the canvas to place text. Letters become machine-ready outlines.')}</p>`;
  else if(tool==='pen')opt=`<p class="note">${T('Клик — точка. Клик по первой точке замыкает контур, Enter или двойной клик — открытая линия, Esc — отмена.','Click to add points. Click the first point to close, Enter or double-click to finish open, Esc to cancel.')}</p>`;
  else if(tool==='measure')opt=`<p class="note">${T('Тяните от точки к точке — покажу расстояние, угол и смещения. Shift — шаг 15°.','Drag between two points to see distance, angle and offsets. Shift snaps to 15°.')}</p>`;
  const cur=TOOLS_UI.find(t=>t&&t[0]===tool);
  el.innerHTML=`${opt?`<div class="sec"><h3>${T('Инструмент','Tool')}: ${cur[2]()}</h3>${opt}</div>`:''}${sheetSection()}
   <div class="sec"><h3>${T('Сетка и листы','Grid & sheets')}</h3><div class="row"><label class="chk"><input type="checkbox" id="snapChk" ${S.snapOn?'checked':''}> ${T('Привязка к сетке','Snap to grid')}</label><div class="inp" style="width:96px"><input type="number" id="snapStep" value="${S.snap}" step="0.5" min="0.1"><em>${MM()}</em></div></div>
   <div class="kv"><span>${T('Листов в проекте','Sheets in project')}</span><b>${S.plates}</b><span>${T('Объектов','Objects')}</span><b>${S.shapes.length}</b></div></div>
   <div class="sec pro"><h3>${T('Горячие клавиши','Shortcuts')}</h3><div class="kv">
   <span>${T('Отменить / повторить','Undo / redo')}</span><b><span class="kbd">Ctrl Z</span> <span class="kbd">Ctrl Y</span></b><span>${T('Копировать / вставить','Copy / paste')}</span><b><span class="kbd">Ctrl C</span> <span class="kbd">Ctrl V</span></b>
   <span>${T('Группа / разгруппировать','Group / ungroup')}</span><b><span class="kbd">Ctrl G</span> <span class="kbd">⇧ Ctrl G</span></b><span>${T('Дублировать','Duplicate')}</span><b><span class="kbd">Ctrl D</span></b>
   <span>${T('Сдвиг 1 / 10 мм','Nudge 1 / 10 mm')}</span><b><span class="kbd">←↑→↓</span> <span class="kbd">Shift</span></b><span>${T('Панорама','Pan')}</span><b><span class="kbd">${T('Пробел','Space')}</span>+${T('мышь','drag')}</b><span>${T('Показать лист','Fit sheet')}</span><b><span class="kbd">F</span></b></div></div>`;
 }else if(tab==='cam'){
  const L=camSel!=null?S.layers[camSel]:null;if(!L){el.innerHTML=`<div class="sec"><p class="note">${T('Выберите операцию слева.','Pick an operation on the left.')}</p></div>`;return}
  const hasImg=S.shapes.some(s=>s.layer===L.id&&s.kind==='image'&&plateOf(s)===curPlate);
  let h=`<div class="sec"><h3><span class="sw" style="background:${L.color}"></span>${T('Операция','Operation')}</h3><label class="fld pro"><span>${T('Название','Name')}</span><input class="plain" id="layerName" value="${esc(layerName(L))}"></label>`;
  if(isLaser()){const l=L.laser,guess=l.mode!=='line'?'engrave':l.power>=70?'cut':'score';
   h+=`<div class="seg full simple-only">${[['cut',T('Резка','Cut')],['engrave',T('Гравировка','Engrave')],['score',T('Разметка','Score')]].map(([k,n])=>`<button data-act="simpleOp" data-v="${k}" aria-pressed="${guess===k}">${n}</button>`).join('')}</div>
    <div class="seg full pro">${['line','fill','both'].map(m=>`<button data-act="lmode" data-v="${m}" aria-pressed="${l.mode===m}">${laserModeName(m)}</button>`).join('')}</div>
    <label class="fld"><span>${T('Мощность','Power')}: <b>${l.power}%</b></span><input type="range" min="0" max="100" value="${l.power}" data-k="laser.power"></label>
    <label class="fld"><span>${T('Скорость','Speed')}: <b>${l.speed} ${MMIN()}</b></span><input type="range" min="50" max="${Math.max(12000,l.speed)}" step="50" value="${l.speed}" data-k="laser.speed"></label>
    <div class="grid2">${numF(T('Мощность','Power'),'data-k="laser.power" min="0" max="100"',l.power,'%',1,'pro')}${numF(T('Скорость','Speed'),'data-k="laser.speed" min="1"',l.speed,MMIN(),10,'pro')}
    ${numF(T('Проходов','Passes'),'data-k="laser.passes" min="1" max="50"',l.passes,'',1)}${l.mode!=='line'||hasImg?numF(T('Шаг строк','Line interval'),'data-k="laser.interval" min="0.02"',l.interval,MM(),.01):''}
    ${l.mode!=='line'?numF(T('Угол заливки','Fill angle'),'data-k="laser.angle"',l.angle,'°',5,'pro'):''}</div>
    ${l.mode!=='line'||hasImg?`<p class="note">${T('Шаг','Interval')} ${l.interval} ${MM()} ≈ ${Math.round(25.4/l.interval)} DPI</p>`:''}
    <label class="chk"><input type="checkbox" data-kb="laser.air" ${l.air?'checked':''}> ${T('Обдув (M8/M9)','Air assist (M8/M9)')}</label></div>
    <div class="sec pro"><h3>${T('Тонкая настройка','Advanced')}</h3><div class="grid2">
    ${numF(T('Компенсация реза','Kerf offset'),'data-k="laser.kerf" min="0" max="1"',l.kerf,MM(),.01)}${numF(T('Перебег (заливка/фото)','Overscan (fill/photo)'),'data-k="laser.overscan" min="0"',l.overscan,MM(),.5)}
    ${numF(T('Перемычки на контуре','Bridges per outline'),'data-k="laser.bridges" min="0" max="20"',l.bridges,'',1)}${numF(T('Ширина перемычки','Bridge width'),'data-k="laser.bridgeW" min="0.1"',l.bridgeW,MM(),.1)}
    ${hasImg?numF(T('Мин. мощность (серый)','Min power (gray)'),'data-k="laser.minPower" min="0" max="100"',l.minPower,'%',1):''}</div>
    ${hasImg?`<label class="chk"><input type="checkbox" data-kb="laser.bidir" ${l.bidir!==false?'checked':''}> ${T('Двунаправленная гравировка','Bidirectional engraving')}</label>`:''}
    <p class="note">${T('Перемычки оставляют деталь в листе, пока не закончится задание.','Bridges keep the part in the sheet until the job ends.')}</p></div>
    <div class="sec pro"><h3>${T('Пресет материала','Material preset')}</h3>${selF('','id="matPreset"',[['',T('— выберите —','— choose —')],...MATERIALS.map((m,i)=>[i,`${lang==='ru'?m.ru:m.en} ${m.t} ${MM()}`])],'')}
    <button class="btn" data-act="matPresetApply">${T('Применить к операции','Apply to operation')}</button><p class="note">${T('Значения ориентировочные для диода 10 Вт. Проверьте тестом материала.','Starting values for a 10 W diode. Verify with a material test.')}</p></div>`;
  }else{const c=L.cnc,prof=c.op==='out'||c.op==='in';
   h+=`<div class="seg full simple-only">${[['out',T('Вырезать','Cut out')],['pocket',T('Карман','Pocket')],['engrave',T('Гравировка','Engrave')],['vcarve','V-carve']].map(([k,n])=>`<button data-act="cncOp" data-v="${k}" aria-pressed="${c.op===k}">${n}</button>`).join('')}</div>
    ${selF(T('Тип обработки','Operation type'),'data-k="cnc.op"',['out','in','on','pocket','engrave','vcarve','drill'].map(o=>[o,cncOpName(o)]),c.op,'pro')}
    ${selF(T('Фреза','Tool'),'id="toolSel"',[['',`${T('Своя','Custom')} ⌀${fx(c.tool,3)}`],...TOOLS.map((t,i)=>[i,lang==='ru'?t.ru:t.en])],'')}
    <div class="grid2">${numF(T('Диаметр фрезы','Tool diameter'),'data-k="cnc.tool" min="0.1"',c.tool,MM(),.1,'pro')}${numF(T('Глубина','Depth'),'data-k="cnc.depth" min="0.05"',c.depth,MM(),.1)}
    ${numF(T('Шаг по Z','Step down'),'data-k="cnc.step" min="0.05"',c.step,MM(),.1,'pro')}${numF(T('Обороты','Spindle'),'data-k="cnc.rpm" min="0"',c.rpm,T('об/мин','rpm'),500,'pro')}
    ${numF(T('Подача','Feed'),'data-k="cnc.feed" min="1"',c.feed,MMIN(),10)}${numF(T('Врезание','Plunge'),'data-k="cnc.plunge" min="1"',c.plunge,MMIN(),10,'pro')}
    ${c.op==='pocket'?numF(T('Перекрытие','Stepover'),'data-k="cnc.stepover" min="5" max="95"',c.stepover,'%',5):''}
    ${c.op==='vcarve'?numF(T('Угол V-фрезы','V-bit angle'),'data-k="cnc.vangle" min="20" max="150"',c.vangle,'°',5)+numF(T('Шаг колец','Ring step'),'data-k="cnc.vstep" min="0.05"',c.vstep,MM(),.05,'pro'):''}</div></div>`;
   if(prof)h+=`<div class="sec"><h3>${T('Перемычки','Holding tabs')}</h3><div class="grid3">${numF(T('Кол-во','Count'),'data-k="cnc.tabs" min="0" max="24"',c.tabs,'',1)}${numF(T('Высота','Height'),'data-k="cnc.tabH" min="0.1"',c.tabH,MM(),.1)}${numF(T('Ширина','Width'),'data-k="cnc.tabW" min="0.5"',c.tabW,MM(),.5)}</div>
    <p class="note">${T('Перемычки держат деталь, чтобы она не вылетела на последнем проходе.','Tabs keep the part attached so it does not fly out on the final pass.')}</p></div>`;
   if(c.op==='vcarve')h+=`<div class="sec"><p class="note">${T('V-резьба строится кольцами внутрь контура: чем дальше от края, тем глубже — до заданной глубины.','V-carving runs inward rings: the further from the edge, the deeper, up to the set depth.')}</p></div>`;
   const fl=toolOpt.fl??2,mt=curMat(),feed=Math.round(c.rpm*fl*mt.chip);
   h+=`<div class="sec pro"><h3>${T('Калькулятор подачи','Feed calculator')}</h3><div class="kv"><span>${T('Материал','Material')}</span><b>${esc(lang==='ru'?mt.ru:mt.en)}</b><span>${T('Съём на зуб','Chip load')}</span><b>${mt.chip} ${MM()}</b><span>${T('Зубьев','Flutes')}</span><b>${fl}</b><span>${T('Подача = об/мин × зубья × съём','Feed = rpm × flutes × chip')}</span><b>${feed} ${MMIN()}</b></div>
    <button class="btn" data-act="feedApply" data-v="${feed}">${T('Подставить подачу','Use this feed')}</button></div>`;
  }
  const st=P.stats;
  h+=`<div class="sec"><h3>${T('Итог листа','Sheet summary')} ${curPlate+1}</h3><div class="statgrid"><div class="stat big"><span>${T('Время (оценка)','Time (estimate)')}</span><b>${st?fmtTime(st.time):'—'}</b></div>
   <div class="stat"><span>${T('Рабочий путь','Cut path')}</span><b>${st?fmtLen(st.cut):'—'}</b></div><div class="stat"><span>${T('Холостые','Travel')}</span><b>${st?fmtLen(st.rapid):'—'}</b></div></div></div>`;
  el.innerHTML=h;
 }else if(tab==='gcode'){
  const st=P.stats;
  el.innerHTML=`<div class="sec"><h3>${T('Сводка','Summary')}</h3>${st&&P.moves.length?`<div class="statgrid"><div class="stat big"><span>${T('Время (оценка)','Time (estimate)')}</span><b>${fmtTime(st.time)}</b></div>
   <div class="stat"><span>${P.laser?T('Прожиг','Burn'):T('Резание','Cutting')}</span><b>${fmtLen(st.cut)}</b></div><div class="stat"><span>${T('Холостые','Travel')}</span><b>${fmtLen(st.rapid)}</b></div>
   <div class="stat"><span>${T('Перемещений','Moves')}</span><b>${st.n.toLocaleString(lang)}</b></div><div class="stat"><span>${T('Строк','Lines')}</span><b>${P.lines.length.toLocaleString(lang)}</b></div></div>
   <div class="kv"><span>${T('Габарит X','Extent X')}</span><b>${fx(st.b[0],1)} … ${fx(st.b[3],1)} ${MM()}</b><span>${T('Габарит Y','Extent Y')}</span><b>${fx(st.b[1],1)} … ${fx(st.b[4],1)} ${MM()}</b>${P.laser?'':`<span>${T('Глубина Z','Depth Z')}</span><b>${fx(st.b[2],2)} … ${fx(st.b[5],2)} ${MM()}</b>`}</div>`:`<p class="note">${T('Нет G-кода. Нарисуйте объекты и нажмите «Рассчитать».','No G-code yet. Draw shapes and press “Generate”.')}</p>`}</div>
   <div class="sec"><h3>${T('Отображение','Display')}</h3>
   <div class="seg full"><button data-act="colorBy" data-v="layer" aria-pressed="${P.colorBy==='layer'}">${T('Слои','Layers')}</button><button data-act="colorBy" data-v="feed" aria-pressed="${P.colorBy==='feed'}">${T('Скорость','Speed')}</button>${P.laser?`<button data-act="colorBy" data-v="power" aria-pressed="${P.colorBy==='power'}">${T('Мощность','Power')}</button>`:`<button data-act="colorBy" data-v="z" aria-pressed="${P.colorBy==='z'}">${T('Глубина','Depth')}</button>`}</div>
   <label class="chk"><input type="checkbox" id="rapChk" ${P.rapids?'checked':''}> ${T('Показывать холостые ходы','Show travel moves')}</label>
   <label class="chk"><input type="checkbox" id="ghostChk" ${P.ghost?'checked':''}> ${T('Показывать будущий путь','Show remaining path')}</label>
   <p class="note">${P.mode==='3d'?T('3D: тяните для вращения, Shift или правая кнопка — сдвиг, колесо — масштаб.','3D: drag to orbit, Shift or right-drag to pan, wheel to zoom.'):T('Колесо — масштаб, перетаскивание — панорама. Пробел — пуск/пауза.','Wheel to zoom, drag to pan. Space plays/pauses.')}</p></div>
   <div class="sec"><h3>${T('Легенда','Legend')}</h3><div class="legend">${legendHtml()}</div></div>`;
 }else{
  const st=P.stats,j=MC.job,prog=P.total?j.t/P.total:0;
  el.innerHTML=`<div class="sec"><h3>${T('Задание','Job')}<span class="sp"></span><span class="pill ${j.run?(j.pause?'warn':'ok'):'mut'}">${j.run?(j.pause?T('пауза','paused'):T('выполняется','running')):T('готово','ready')}</span></h3>
   <div class="kv"><span>${T('Файл','File')}</span><b>${esc(P.file||T('лист ','sheet ')+(curPlate+1)+'.nc')}</b><span>${T('Оценка времени','Estimated')}</span><b>${st?fmtTime(st.time):'—'}</b></div>
   <div class="prog"><i id="jobBar" style="width:${(prog*100).toFixed(1)}%"></i></div>
   <div class="kv"><span>${T('Прошло','Elapsed')}</span><b id="jobEl">${fmtTime(j.t)}</b><span>${T('Осталось','Remaining')}</span><b id="jobRem">${fmtTime(P.total-j.t)}</b><span>${T('Строка','Line')}</span><b id="jobLn">${j.line+1} / ${P.lines.length}</b></div>
   <div class="grid3"><button class="btn acc" data-act="jobStart" ${P.moves.length?'':'disabled'}>${ic('play',13)} ${j.run&&j.pause?T('Дальше','Resume'):T('Старт','Start')}</button><button class="btn" data-act="jobPause" ${j.run&&!j.pause?'':'disabled'}>${ic('pause',13)} ${T('Пауза','Pause')}</button><button class="btn bad" data-act="jobStop" ${j.run?'':'disabled'}>${ic('stop',13)} ${T('Стоп','Stop')}</button></div></div>
   <div class="sec"><h3>${T('Коррекция','Overrides')}</h3><label class="fld"><span>${T('Подача','Feed')}: <b id="fovV">${MC.feedOv}%</b></span><input type="range" id="fovR" min="25" max="200" step="5" value="${MC.feedOv}"></label>
   ${MC.mode==='demo'?`<label class="fld"><span>${T('Ускорение демо','Demo speed-up')}</span><div class="seg full">${[1,5,20,60].map(r=>`<button data-act="demoRate" data-v="${r}" aria-pressed="${MC.demoRate===r}">${r}×</button>`).join('')}</div></label>`:''}</div>
   <div class="sec pro"><h3>${T('Макросы','Macros')}<span class="sp"></span><button class="mini" data-act="editMacros" title="${T('Изменить','Edit')}">${ic('edit',14)}</button></h3><div class="macros">${(S.macros||[]).map((m,i)=>`<button class="btn" data-act="macro" data-v="${i}" title="${esc(m.g)}">${esc(m.n)}</button>`).join('')}</div></div>`;
 }
}
function legendHtml(){
 let h=`<div><i class="dash"></i>${T('Холостой ход (G0)','Travel (G0)')}</div>`;
 if(P.colorBy==='layer'){const ls=P.layers.length?P.layers:[{name:T('Рабочий ход','Cutting'),color:css('--accent')}];h+=ls.map(l=>`<div><i style="background:${l.color}"></i>${esc(l.name)}</div>`).join('')}
 else h+=`<div><i style="background:linear-gradient(90deg,hsl(205 85% 55%),hsl(35 95% 55%))"></i>${P.colorBy==='feed'?T('медленно → быстро','slow → fast'):P.colorBy==='power'?T('слабо → мощно','low → high power'):T('мелко → глубоко','shallow → deep')}</div>`;
 return h;
}
function renderStatus(){
 const c=cursorW?`X ${fx(cursorW[0]-plateX(curPlate),2).toFixed(2)}  Y ${fx(cursorW[1],2).toFixed(2)}`:'X —  Y —';
 const hints={select:T('Клик — выбрать (группа целиком), Shift — добавить, рамка — выделить. Ручки — масштаб и поворот.','Click selects (whole group), Shift adds, drag a box to select. Handles scale and rotate.'),hand:T('Тяните, чтобы двигать вид.','Drag to move the view.'),rect:T('Тяните, чтобы нарисовать прямоугольник. Shift — квадрат.','Drag to draw a rectangle. Shift for a square.'),ellipse:T('Тяните от угла. Shift — круг.','Drag from a corner. Shift for a circle.'),polygon:T('Тяните от центра.','Drag from the centre.'),star:T('Тяните от центра.','Drag from the centre.'),line:T('Тяните от начала к концу. Shift — шаг 15°.','Drag from start to end. Shift snaps to 15°.'),pen:T('Клик — точка, Enter — завершить.','Click to add points, Enter to finish.'),text:T('Клик — поставить текст.','Click to place text.'),measure:T('Тяните, чтобы измерить.','Drag to measure.')};
 const hint=tab==='cad'?hints[tool]:tab==='cam'?T('Траектории пересчитываются при каждом изменении параметров.','Toolpaths recalculate as you change parameters.'):tab==='gcode'?T('Клик по строке G-кода переносит симуляцию к ней.','Click a G-code line to jump the simulation there.'):T('Перемещения — шагом, выбранным над джойстиком.','Jog moves use the step chosen above the pad.');
 $('#status').innerHTML=`<span class="mono">${c}</span><span class="hint">${hint}</span>${tab==='cad'?`<button data-act="snapT" aria-pressed="${S.snapOn}">${ic('grid',13)} ${T('Сетка','Snap')} ${S.snap} ${MM()}</button>`:''}<span class="mono">${esc(matName(curMat(),S.sheet.thick))}</span><span class="mono">${Math.round(V.s/(96/25.4)*100)}%</span>${hasClip()?'':`<span class="mono" style="color:var(--warn)">⚠ ${T('без Clipper','no Clipper')}</span>`}`;
}

/* ================= playback / demo loop ================= */
let lastTs=0;
function tick(ts){const dt=lastTs?Math.min(.1,(ts-lastTs)/1000):0;lastTs=ts;
 if(P.playing&&tab==='gcode'){P.t=Math.min(P.total,P.t+dt*P.rate);if(P.t>=P.total){P.playing=false;renderChrome()}updatePbTime();syncLine();draw()}
 if(MC.job.run&&!MC.job.pause&&MC.mode==='demo'){const j=MC.job;j.t=Math.min(P.total,j.t+dt*MC.demoRate*MC.feedOv/100);const i=idxAt(j.t);j.line=i>=0?P.moves[i].l:0;
  MC.pos=posAt(j.t);if(j.t>=P.total){j.run=false;mlog('rx',T('Задание выполнено','Job complete')+' — '+fmtTime(P.total));toast(T('Задание выполнено','Job complete'));renderRight();renderChrome()}
  if(tab==='machine')updateMachineLive()}
 requestAnimationFrame(tick)}

/* ================= machine tab ================= */
function mlog(k,t){MC.log.push([k,t]);if(MC.log.length>300)MC.log.shift();const c=$('#mcCon');if(c){c.insertAdjacentHTML('beforeend',`<div class="${k}">${esc(t)}</div>`);c.scrollTop=c.scrollHeight}}
function renderMachineView(){
 const L=isLaser(),w=MC.pos.map((v,i)=>v-MC.zero[i]);
 $('#mach').innerHTML=`<div class="card"><h4>${T('Положение','Position')}<span style="flex:1"></span><span class="pill mut">${T('рабочие координаты','work coords')}</span></h4>
  <div class="dro">${['X','Y','Z'].map((a,i)=>`<div class="ax"><b>${a}</b><span id="dro${a}">${w[i].toFixed(3)}</span><button class="btn" data-act="zeroAx" data-v="${i}">${T('Ноль','Zero')}</button></div>`).join('')}</div>
  <h4>${T('Перемещение','Jog')}<span style="flex:1"></span><div class="seg">${[.1,1,10,50].map(s=>`<button data-act="jogStep" data-v="${s}" aria-pressed="${MC.step===s}">${s}</button>`).join('')}</div></h4>
  <div class="jog"><span></span><button data-act="jog" data-v="Y+">Y+</button><span></span><span></span><button data-act="jog" data-v="Z+">Z+</button>
   <button data-act="jog" data-v="X-">X−</button><button class="home" data-act="mHome" title="${T('Домой','Home')} ($H)">${ic('home',18)}</button><button data-act="jog" data-v="X+">X+</button><span></span><span></span>
   <span></span><button data-act="jog" data-v="Y-">Y−</button><span></span><span></span><button data-act="jog" data-v="Z-">Z−</button></div>
  <div class="grid3"><button class="btn" data-act="mZeroXY">${T('Ноль XY здесь','Set XY zero')}</button><button class="btn" data-act="mGoZero">${T('В ноль','Go to zero')}</button><button class="btn" data-act="mFrame" ${P.moves.length?'':'disabled'}>${ic('frame',14)} ${T('Рамка','Frame')}</button>
   <button class="btn" data-act="mUnlock">${T('Разблок. $X','Unlock $X')}</button>${L?`<button class="btn" data-act="mFire">${T('Тест луча 1%','Test fire 1%')}</button>`:`<button class="btn" data-act="mSpin">${T('Шпиндель','Spindle')}</button>`}<button class="btn" data-act="mProbe">${L?T('Фокус','Focus'):T('Щуп Z','Probe Z')}</button></div></div>
 <div class="card"><h4>${T('Задание на столе','Job on the bed')}</h4><canvas id="mcv"></canvas><div class="prog"><i id="jobBar2" style="width:${P.total?(MC.job.t/P.total*100).toFixed(1):0}%"></i></div>
  <h4>${T('Консоль','Console')}</h4><div class="console" id="mcCon">${MC.log.map(([k,t])=>`<div class="${k}">${esc(t)}</div>`).join('')}</div>
  <form class="row pro" id="mcForm" autocomplete="off"><div class="inp" style="flex:1"><input id="mcCmd" placeholder="${T('Команда, например $$ или G0 X10','Command, e.g. $$ or G0 X10')}"></div><button class="btn" type="submit">${T('Отправить','Send')}</button></form></div>`;
 const con=$('#mcCon');con.scrollTop=con.scrollHeight;
 $('#mcForm').onsubmit=e=>{e.preventDefault();const v=$('#mcCmd').value.trim();if(v){sendCmd(v);$('#mcCmd').value=''}};
 drawMachineCanvas();
}
function updateMachineLive(){const w=MC.pos.map((v,i)=>v-MC.zero[i]);['X','Y','Z'].forEach((a,i)=>{const e=$('#dro'+a);if(e)e.textContent=w[i].toFixed(3)});
 const j=MC.job,pr=P.total?(j.t/P.total*100).toFixed(1)+'%':'0%';for(const id of['jobBar','jobBar2']){const e=$('#'+id);if(e)e.style.width=pr}
 const el=$('#jobEl');if(el){el.textContent=fmtTime(j.t);$('#jobRem').textContent=fmtTime(P.total-j.t);$('#jobLn').textContent=`${j.line+1} / ${P.lines.length}`}drawMachineCanvas()}
function drawMachineCanvas(){const c=$('#mcv');if(!c)return;const r=c.getBoundingClientRect();if(!r.width)return;const d=window.devicePixelRatio||1;c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);
 const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);const m=S.machine,s=Math.min((r.width-40)/m.w,(r.height-36)/m.h),v={s,ox:(r.width-m.w*s)/2+8,oy:(r.height+m.h*s)/2-6};
 drawBed(x,v,r.width,r.height,0,true);const pj=p=>w2s(p[0],p[1],v);const keep=P.ghost;P.ghost=true;drawMoves(x,pj,MC.job.t,false);P.ghost=keep;
 const[hx,hy]=pj(MC.pos);x.strokeStyle=css('--accent');x.lineWidth=2;x.beginPath();x.arc(hx,hy,6,0,Math.PI*2);x.moveTo(hx-11,hy);x.lineTo(hx+11,hy);x.moveTo(hx,hy-11);x.lineTo(hx,hy+11);x.stroke()}
async function sendCmd(cmd){
 if(MC.mode==='serial'&&MC.connected){await serialWrite(cmd);return}
 mlog('tx','> '+cmd);const u=cmd.toUpperCase();
 if(u==='$$'){['$0=10','$1=25','$3=0','$22=1 (homing)','$30='+(isLaser()?S.machine.smax:S.machine.rpm),'$32='+(isLaser()?1:0)+' (laser mode)',`$110=${S.machine.rapid}`,`$130=${S.machine.w}`,`$131=${S.machine.h}`].forEach(l=>mlog('rx',l))}
 else if(u==='?'){mlog('rx',`<Idle|MPos:${MC.pos.map(v=>v.toFixed(3)).join(',')}|FS:0,0>`)}
 else if(/^\$H/.test(u)){MC.pos=[0,0,isLaser()?0:S.machine.safeZ];updateMachineLive()}
 else if(/G0?[01]\b/.test(u)||/^\$J=/.test(u)){const rel=/G91/.test(u);const p=[...MC.pos];['X','Y','Z'].forEach((a,i)=>{const m=new RegExp(a+'\\s*(-?[\\d.]+)').exec(u);if(m)p[i]=rel?p[i]+(+m[1]):(+m[1])+MC.zero[i]});
  p[0]=clamp(p[0],0,S.machine.w);p[1]=clamp(p[1],0,S.machine.h);MC.pos=p;updateMachineLive()}
 setTimeout(()=>mlog('rx','ok'),50);
}
async function serialConnect(){
 if(MC.connected){try{MC.reader&&await MC.reader.cancel();MC.writer&&MC.writer.releaseLock();await MC.port.close()}catch(e){}MC.connected=false;mlog('rx',T('Отключено','Disconnected'));refresh();return}
 if(!('serial' in navigator)){toast(T('Этот браузер не поддерживает Web Serial. Откройте в Chrome/Edge или в настольной версии.','This browser has no Web Serial. Use Chrome/Edge or the desktop build.'));return}
 try{const port=await navigator.serial.requestPort();await port.open({baudRate:MC.baud});MC.port=port;MC.writer=port.writable.getWriter();MC.connected=true;mlog('rx',T('Порт открыт','Port open')+' @'+MC.baud);refresh();readLoop()}
 catch(e){toast(T('Нет доступа к порту: ','No port access: ')+(e.message||e.name));mlog('er',String(e.message||e))}
}
let okWait=null;
async function readLoop(){const dec=new TextDecoder();let buf='';try{MC.reader=MC.port.readable.getReader();while(true){const{value,done}=await MC.reader.read();if(done)break;buf+=dec.decode(value);let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!l)continue;mlog(/^error|ALARM/i.test(l)?'er':'rx',l);if((/^ok/i.test(l)||/^error/i.test(l))&&okWait){const f=okWait;okWait=null;f(l)}}}}catch(e){mlog('er',String(e.message||e))}finally{try{MC.reader.releaseLock()}catch(e){}}}
async function serialWrite(line,wait){mlog('tx','> '+line);await MC.writer.write(new TextEncoder().encode(line+'\n'));if(wait)return new Promise(r=>{okWait=r})}
async function streamSerial(){const j=MC.job,lines=P.lines.map(l=>l.replace(/;.*/,'').trim()).map((l,i)=>[l,i]).filter(x=>x[0]);
 for(const[l,i]of lines){if(!j.run)break;while(j.pause&&j.run)await sleep(200);const r=await serialWrite(l,true);j.line=i;const mv=P.moves.find(m=>m.l>=i);if(mv)j.t=mv.t0;updateMachineLive();if(/^error/i.test(r)){j.run=false;toast(T('Станок вернул ошибку — задание остановлено.','The machine reported an error — job stopped.'))}}
 j.run=false;renderRight();renderChrome()}
function jobStart(){if(!P.moves.length)return;const ch=MC.checks;if(!(ch.a&&ch.b&&ch.c)){toast(T('Отметьте все пункты «Перед запуском» слева.','Tick every “Before you start” item on the left.'));return}
 const j=MC.job;if(j.run&&j.pause){j.pause=false;if(MC.mode==='serial'&&MC.connected)MC.writer.write(new Uint8Array([0x7e]));refresh();return}
 if(MC.mode==='serial'&&!MC.connected){toast(T('Сначала подключите станок.','Connect the machine first.'));return}
 j.run=true;j.pause=false;j.t=0;j.line=0;mlog('rx',T('Старт задания','Job started')+` (${P.lines.length} ${T('строк','lines')})`);if(MC.mode==='serial')streamSerial();refresh()}
function jobPause(){MC.job.pause=true;if(MC.mode==='serial'&&MC.connected)MC.writer.write(new Uint8Array([0x21]));mlog('rx',T('Пауза (feed hold)','Paused (feed hold)'));refresh()}
function jobStop(){const j=MC.job;j.run=false;j.pause=false;if(MC.mode==='serial'&&MC.connected)MC.writer.write(new Uint8Array([0x18]));mlog('er',T('Остановлено пользователем','Stopped by user'));refresh()}

/* ================= dialogs: machine settings, new project, G-code editor, macros ================= */
let draftM=null;
function openSettings(){draftM={...S.machine};renderSettings()}
function machineCards(curId,act){return `<div class="presets">${MACHINES.map(p=>`<button class="preset${p.id===curId?' on':''}" data-act="${act}" data-v="${p.id}"><span class="row">${ic(p.type==='laser'?'laser':'cnc',16)}<b>${p.name}</b></span><small>${p.w}×${p.h} ${MM()}</small></button>`).join('')}</div>`}
function renderSettings(){const m=draftM;
 openModal(T('Станок и настройки','Machine & settings'),`<div><div class="fld"><span>${T('Готовые профили','Presets')}</span></div>${machineCards(m.id,'preset')}</div>
  <div class="grid2"><label class="fld"><span>${T('Название','Name')}</span><input class="plain" id="mName" value="${esc(m.name)}"></label>
  ${selF(T('Тип станка','Machine type'),'id="mType"',[['laser',T('Лазерный гравер/резак','Laser engraver/cutter')],['cnc',T('Фрезерный ЧПУ','CNC router')]],m.type)}
  ${numF(T('Рабочее поле X','Work area X'),'id="mW" min="10"',m.w,MM(),1)}${numF(T('Рабочее поле Y','Work area Y'),'id="mH" min="10"',m.h,MM(),1)}
  ${numF(T('Макс. значение S','Max S value'),'id="mS" min="1"',m.smax,'',1)}${numF(T('Скорость холостых','Rapid speed'),'id="mR" min="10"',m.rapid,MMIN(),100)}
  ${numF(T('Безопасная высота Z','Safe Z height'),'id="mZ" min="0.5"',m.safeZ,MM(),.5)}${selF(T('Прошивка','Firmware'),'id="mFw"',[['grbl','GRBL 1.1'],['fluidnc','FluidNC'],['marlin','Marlin']],m.fw)}</div>
  <label class="fld"><span>${T('Начало G-кода (header)','G-code header')}</span><textarea class="plain" id="mHead" placeholder="; ${T('например','e.g.')} $H">${esc(S.job.header)}</textarea></label>
  <label class="fld"><span>${T('Конец G-кода (footer)','G-code footer')}</span><textarea class="plain" id="mFoot">${esc(S.job.footer)}</textarea></label>`,
  `<button class="btn" data-act="closeModal">${T('Отмена','Cancel')}</button><button class="primary" data-act="saveSettings">${T('Сохранить','Save')}</button>`)}
let NP=null;
function openNewProject(){NP={m:S.machine.id,mat:0,thick:null,sheet:2,w:300,h:200};renderNewProject()}
function renderNewProject(){const mm=MACHINES.find(x=>x.id===NP.m)||MACHINES[0],ml=mm.type==='laser'?MATERIALS:CNC_MATS;NP.mat=Math.min(NP.mat,ml.length-1);const mt=ml[NP.mat];if(NP.thick==null)NP.thick=mt.t;
 openModal(T('Новый проект','New project'),`<div class="fld"><span>${T('1. Станок','1. Machine')}</span></div>${machineCards(NP.m,'npMach')}
  <div class="grid2">${selF(T('2. Материал','2. Material'),'id="npMat"',ml.map((m,i)=>[i,`${lang==='ru'?m.ru:m.en} · ${m.t} ${MM()}`]),NP.mat)}${numF(T('Толщина','Thickness'),'id="npThick" min="0.1"',NP.thick,MM(),.1)}</div>
  <div class="fld"><span>${T('3. Лист на столе','3. Sheet on the bed')}</span></div><div class="seg full" style="flex-wrap:wrap">${SHEETS.map((s,i)=>`<button data-act="npSheet" data-v="${i}" aria-pressed="${NP.sheet===i}">${s[0]}</button>`).join('')}<button data-act="npSheet" data-v="-1" aria-pressed="${NP.sheet===-1}">${T('Свой','Custom')}</button></div>
  <div class="grid2">${numF(T('Ширина','Width'),'id="npW" min="10"',NP.sheet>=0?SHEETS[NP.sheet][1]:NP.w,MM(),1)}${numF(T('Высота','Height'),'id="npH" min="10"',NP.sheet>=0?SHEETS[NP.sheet][2]:NP.h,MM(),1)}</div>
  <p class="note">${T('Лист рисуется прямо на столе с реальными размерами. Всё, что вы рисуете или генерируете, кладётся внутрь листа. Текущий проект можно вернуть через Ctrl+Z.','The sheet is drawn on the bed at real size. Everything you draw or generate goes inside it. Ctrl+Z brings back the current project.')}</p>`,
  `<button class="btn" data-act="closeModal">${T('Отмена','Cancel')}</button><button class="primary" data-act="npCreate">${ic('newp',15)} ${T('Создать','Create')}</button>`)}
function readNP(){const t=$('#npThick'),w=$('#npW'),h=$('#npH'),mt=$('#npMat');if(mt)NP.mat=+mt.value;if(t)NP.thick=+t.value||NP.thick;if(w)NP.w=+w.value||NP.w;if(h)NP.h=+h.value||NP.h}
function createProject(){readNP();const mm=MACHINES.find(x=>x.id===NP.m)||MACHINES[0];const w=Math.min(NP.w,mm.w),h=Math.min(NP.h,mm.h);
 pushUndo();S=blankState(mm,{mat:NP.mat,thick:NP.thick,w,h,x:Math.max(0,Math.min(10,(mm.w-w)/2)),y:Math.max(0,Math.min(10,(mm.h-h)/2))});applyMaterial();sel.clear();curPlate=0;closeModal();changed();fitPlate(0);draw();
 toast(T('Новый проект создан. Параметры слоёв подобраны под материал.','New project created. Layer settings match the material.'))}
function openGcEdit(){openModal(T('Редактор G-кода','G-code editor'),`<textarea class="plain" id="gcEdit" style="min-height:52vh;font-size:11.5px" spellcheck="false">${esc(P.text)}</textarea><p class="note">${T('После применения правки видны в симуляции и уходят на станок. Пересчёт проекта заменит их.','Edits show in the simulation and go to the machine. Regenerating the project replaces them.')}</p>`,
 `<button class="btn" data-act="closeModal">${T('Отмена','Cancel')}</button><button class="primary" data-act="gcApply">${T('Применить','Apply')}</button>`)}
function openMacros(){openModal(T('Макросы','Macros'),`<textarea class="plain" id="mcEdit" style="min-height:220px">${esc((S.macros||[]).map(m=>`${m.n} | ${m.g}`).join('\n'))}</textarea><p class="note">${T('Одна строка — один макрос: «Название | G-код». Несколько команд разделяйте точкой с запятой без пробела: G0 X0;G0 Y0.','One line per macro: “Name | G-code”. Separate several commands with “;” (no space).')}</p>`,
 `<button class="btn" data-act="closeModal">${T('Отмена','Cancel')}</button><button class="primary" data-act="saveMacros">${T('Сохранить','Save')}</button>`)}

/* ================= events ================= */
function switchTab(t){if(t===tab)return;tab=t;store.set('kerf.tab',t);if(t!=='gcode')P.playing=false;drag=null;penPts=null;measure=null;
 if(t==='cam'||t==='gcode'||t==='machine')ensureCam();requestAnimationFrame(()=>{resize();if(t!=='machine')fitPlate(curPlate);draw();if(t==='machine')renderMachineView()});refresh()}
function setPlate(i){curPlate=clamp(i,0,S.plates-1);camDirty=true;P.file=null;if(tab!=='cad')ensureCam();fitPlate(curPlate);refresh()}
function generateNow(){camDirty=true;P.file=null;ensureCam();P.t=0;P.playing=true;switchTab('gcode');if(lastWarn.length)toast(lastWarn[0])}
document.addEventListener('click',async e=>{
 const tb=e.target.closest('[data-tab]');if(tb){switchTab(tb.dataset.tab);return}
 const mb=e.target.closest('[data-mode]');if(mb){mode=mb.dataset.mode;store.set('kerf.mode',mode);if(mode==='simple'&&['polygon','star','line','measure'].includes(tool))tool='select';refresh();toast(mode==='simple'?T('Простой режим: мастера и материалы, минимум настроек.','Simple mode: wizards and materials, fewer settings.'):T('Профессиональный режим: все параметры открыты.','Pro mode: every parameter is available.'));return}
 const lb=e.target.closest('[data-lang]');if(lb){lang=lb.dataset.lang;store.set('kerf.lang',lang);refresh();if(GS)renderGenSide();return}
 const tl=e.target.closest('[data-tool]');if(tl){setTool(tl.dataset.tool);return}
 const gl=e.target.closest('.gl');if(gl){const ln=+gl.dataset.line,m=P.moves.find(m=>m.l>=ln);if(m){P.t=m.t0+1e-6;P.playing=false;updatePbTime();syncLine();renderChrome();draw()}return}
 const a=e.target.closest('[data-act]');if(!a||a.disabled)return;const act=a.dataset.act,v=a.dataset.v;
 if(a.type==='checkbox'&&act!=='camOn')return;
 switch(act){
  case'primary':if(tab==='cad'||tab==='cam')generateNow();else if(tab==='gcode')switchTab('machine');else MC.job.run?jobStop():jobStart();break;
  case'settings':openSettings();break;
  case'theme':{const r=document.documentElement,cur=r.dataset.theme||'system',nx={system:'light',light:'dark',dark:'system'}[cur];if(nx==='system')delete r.dataset.theme;else r.dataset.theme=nx;store.set('kerf.theme',nx);prevCache.clear();renderTop();draw();break}
  case'undo':undo();break;case'redo':redo();break;
  case'fit':fitPlate(curPlate);draw();renderStatus();break;case'fitAll':fitAll();draw();break;case'zin':zoomAt(CW/2,CH/2,1.25);break;case'zout':zoomAt(CW/2,CH/2,.8);break;
  case'plate':setPlate(+v);break;
  case'addPlate':pushUndo();S.plates++;setPlate(S.plates-1);break;
  case'delPlate':{if(S.plates<2)break;pushUndo();const p=curPlate,dx=plateX(1);S.shapes=S.shapes.filter(s=>plateOf(s)!==p);for(const s of S.shapes)if(plateOf(s)>p)s.paths=mapPaths(s.paths,(x,y)=>[x-dx,y]);S.plates--;sel.clear();setPlate(Math.min(p,S.plates-1));toast(T('Лист удалён. Ctrl+Z вернёт его.','Sheet deleted. Ctrl+Z brings it back.'));break}
  case'assign':{const l=+a.dataset.l;curDrawLayer=l;if(sel.size){pushUndo();for(const s of selShapes())s.layer=l;changed()}else{renderChrome();toast(T(`Новые фигуры рисуются на слое «${layerName(S.layers[l])}»`,`New shapes go to “${layerName(S.layers[l])}”`))}break}
  case'pickLayer':{if(e.target.closest('[data-act="eye"]'))break;const l=+a.dataset.l;sel=new Set(S.shapes.filter(s=>s.layer===l).map(s=>s.id));curDrawLayer=l;refresh();break}
  case'eye':{e.stopPropagation();const L=S.layers[+a.dataset.l];L.show=!L.show;for(const s of S.shapes)if(s.layer===L.id)sel.delete(s.id);changed();break}
  case'pickShape':{const s=shapeById(+a.dataset.id);if(!s)break;const ids=groupIds(s);if(e.shiftKey){const has=sel.has(s.id);for(const id of ids)has?sel.delete(id):sel.add(id)}else sel=new Set(ids);refresh();break}
  case'wiz':if(v==='slicer')openSlicer();else openGen(v);break;
  case'impVec':$('#fileSvg').click();break;case'impImg':$('#fileImg').click();break;case'imp3d':$('#file3d').click();break;case'impProj':$('#fileProj').click();break;
  case'newProj':openNewProject();break;
  case'exportProj':{if(await saveOut('project.kerf',JSON.stringify(S),'kerf','Kerf Studio'))break;try{await navigator.clipboard.writeText(JSON.stringify(S));toast(T('Проект скопирован в буфер обмена. Вставьте его в файл .kerf, чтобы сохранить.','Project copied to the clipboard. Paste it into a .kerf file to keep it.'))}catch(err){toast(T('Буфер обмена недоступен. Проект автоматически хранится в этом браузере.','Clipboard unavailable. The project is auto-saved in this browser.'))}break}
  case'svgCopy':{if(await saveOut(`sheet-${curPlate+1}.svg`,svgExport(curPlate),'svg','SVG'))break;try{await navigator.clipboard.writeText(svgExport(curPlate));toast(T('Лист скопирован как SVG.','Sheet copied as SVG.'))}catch(err){toast(T('Буфер обмена недоступен в этом окне.','Clipboard is unavailable here.'))}break}
  case'sample':{pushUndo();const m=S.machine,sh=S.sheet;S=sampleState(m);S.sheet=Object.assign(S.sheet,{mat:sh.mat,thick:sh.thick});applyMaterial();sel.clear();curPlate=0;changed();fitPlate(0);finishSample();toast(T('Загружен пример. Ctrl+Z вернёт прежний проект.','Sample loaded. Ctrl+Z restores your project.'));break}
  case'clearAll':if(!S.shapes.length)break;pushUndo();S.shapes=[];S.plates=1;curPlate=0;sel.clear();changed();toast(T('Проект очищен. Ctrl+Z, чтобы вернуть.','Project cleared. Ctrl+Z to undo.'));break;
  case'del':delSel();break;case'dup':dupSel();break;
  case'center':{const b=selBox();if(b){const pl=plateOfBox(b),ref=S.sheet.on?[plateX(pl)+S.sheet.x+S.sheet.w/2,S.sheet.y+S.sheet.h/2]:[plateX(pl)+S.machine.w/2,S.machine.h/2],dx=ref[0]-(b[0]+b[2])/2,dy=ref[1]-(b[1]+b[3])/2;transformSel((x,y)=>[x+dx,y+dy])}break}
  case'rot':rotSel(+v);break;case'rotApply':rotSel(+$('#rotBy').value||0);break;
  case'mirror':mirrorSel(v==='h');break;case'align':alignSel(v);break;case'bool':boolSel(v);break;
  case'group':groupSel();break;case'ungroup':ungroupSel();break;case'break':breakApart();break;case'simplify':simplifySel(.1);break;
  case'offset':{const d=+$('#offD').value;toolOpt.off=d;if(d)offsetSel(d);break}
  case'array':{const c=clamp(+$('#arrC').value|0,1,50),r=clamp(+$('#arrR').value|0,1,50),g=+$('#arrG').value||0;Object.assign(toolOpt,{ac:c,ar:r,ag:g});if(c*r>1)arraySel(c,r,g);break}
  case'circArr':{const n=clamp(+$('#cirN').value|0,2,200),r=Math.max(1,+$('#cirR').value||40);Object.assign(toolOpt,{cc:n,cr:r});circArraySel(n,r);break}
  case'nestSel':nestSelection(3);break;
  case'txtApply':updateText($('#txtEdit').value,$('#txtFont').value,Math.max(1,+$('#txtSize').value||10));break;
  case'snapT':S.snapOn=!S.snapOn;save();renderStatus();renderRight();break;
  case'applyMat':pushUndo();applyMaterial();changed();toast(T('Параметры операций подобраны под материал.','Operation settings now match the material.'));break;
  case'camPick':{if(e.target.closest('.mini')||e.target.type==='checkbox')break;camSel=+a.dataset.l;renderLeft();renderRight();break}
  case'camOn':{const L=S.layers[+a.dataset.l];pushUndo();L.on=e.target.checked;changed();break}
  case'camUp':case'camDown':{const id=+a.dataset.l,used=usedLayers(curPlate).filter(L=>L.out).map(L=>L.id),i=used.indexOf(id),j=act==='camUp'?i-1:i+1;if(j<0||j>=used.length)break;pushUndo();const o=S.order,ia=o.indexOf(id),ib=o.indexOf(used[j]);[o[ia],o[ib]]=[o[ib],o[ia]];changed();break}
  case'lmode':pushUndo();S.layers[camSel].laser.mode=v;changed();break;
  case'simpleOp':{const L=S.layers[camSel],m=curMat();pushUndo();if(v==='cut'){if(!m.cut){toast(T('Этот материал лазером не режется — выберите гравировку.','This material cannot be laser-cut — use engraving.'));undoS.pop();break}Object.assign(L.laser,{mode:'line',power:m.cut.power,speed:m.cut.speed,passes:m.cut.passes})}
   else if(v==='engrave')Object.assign(L.laser,{mode:'fill',power:m.eng.power,speed:m.eng.speed,interval:m.eng.interval,passes:1});else Object.assign(L.laser,{mode:'line',power:m.score.power,speed:m.score.speed,passes:1});changed();break}
  case'cncOp':{const c=S.layers[camSel].cnc;pushUndo();c.op=v;if(v==='out')c.depth=fx(S.sheet.thick+.2,2);if(v==='vcarve'){c.tool=6;c.vangle=90;c.depth=Math.min(c.depth,3)}changed();break}
  case'matPresetApply':{const i=$('#matPreset').value;if(i==='')break;const M=MATERIALS[+i],L=S.layers[camSel];pushUndo();if(L.laser.mode==='fill'||!M.cut)Object.assign(L.laser,M.eng,{passes:1});else Object.assign(L.laser,M.cut);changed();break}
  case'feedApply':pushUndo();S.layers[camSel].cnc.feed=+v;changed();break;
  case'pmode':P.mode=v;renderChrome();renderRight();draw();break;
  case'play':if(P.t>=P.total)P.t=0;P.playing=!P.playing;renderChrome();break;
  case'rate':P.rate=+v;renderChrome();break;
  case'colorBy':P.colorBy=v;renderRight();draw();break;
  case'copyGc':try{await navigator.clipboard.writeText(P.text);toast(T('G-код скопирован в буфер обмена.','G-code copied to the clipboard.'))}catch(err){toast(T('Буфер обмена недоступен в этом окне.','Clipboard is unavailable here.'))}break;
  case'openGc':$('#fileGc').click();break;
  case'saveGc':await saveOut((P.file||`sheet-${curPlate+1}`).replace(/\.[^.]+$/,'')+'.nc',P.text,'nc','G-code');break;
  case'backProj':P.file=null;camDirty=true;ensureCam();refresh();break;
  case'editGc':openGcEdit();break;
  case'gcApply':{const t=$('#gcEdit').value;closeModal();loadGcode(t,T('изменённый.nc','edited.nc'));P.t=0;refresh();break}
  case'closeModal':closeModal();break;case'doTrace':doTrace();break;
  case'imgRaster':closeModal();addRasterImage(pendingImg);break;case'imgTrace':closeModal();openTrace(pendingImg);break;case'imgLayered':{const im=pendingImg;closeModal();openGen('layered',{img:im});break}
  case'genView':if(GS){GS.view=v;renderGenVb();genDraw()}break;
  case'genPlace':genPlace();break;case'genImg':$('#fileGenImg').click();break;
  case'slOpen':$('#file3d').click();break;
  case'slSample':SL.base=v==='torus'?sampleTorus():sampleVase();SL.name=v==='torus'?T('Тор (пример)','Torus (sample)'):T('Ваза (пример)','Vase (sample)');SL.size=v==='torus'?60:150;slPrepare();slRenderSide();slRefresh(true);break;
  case'slRot':slRotate(v);break;case'slMethod':slSet('method',v);break;case'slView':SL.view=v;slRenderSide();slApplyView();break;case'slPlace':slPlace();break;
  case'preset':{const p=MACHINES.find(p=>p.id===v);draftM={...p};renderSettings();break}
  case'saveSettings':{const m=draftM;m.name=$('#mName').value.trim()||m.name;m.type=$('#mType').value;m.w=Math.max(10,+$('#mW').value||m.w);m.h=Math.max(10,+$('#mH').value||m.h);m.smax=Math.max(1,+$('#mS').value||m.smax);m.rapid=Math.max(10,+$('#mR').value||m.rapid);m.safeZ=Math.max(.5,+$('#mZ').value||5);m.fw=$('#mFw').value;
   pushUndo();const typeChanged=m.type!==S.machine.type;S.machine=m;S.job.header=$('#mHead').value;S.job.footer=$('#mFoot').value;if(typeChanged){S.sheet.mat=0;applyMaterial()}S.sheet.w=Math.min(S.sheet.w,m.w);S.sheet.h=Math.min(S.sheet.h,m.h);closeModal();changed();fitPlate(curPlate);draw();toast(T('Профиль станка обновлён.','Machine profile updated.'));break}
  case'npMach':readNP();NP.m=v;NP.thick=null;renderNewProject();break;
  case'npSheet':readNP();NP.sheet=+v;renderNewProject();break;
  case'npCreate':createProject();break;
  case'mcMode':MC.mode=v;refresh();break;case'mcConnect':MC.baud=+($('#baudSel')?.value||115200);serialConnect();break;
  case'demoRate':MC.demoRate=+v;renderRight();break;
  case'jobStart':jobStart();break;case'jobPause':jobPause();break;case'jobStop':jobStop();break;
  case'jogStep':MC.step=+v;renderMachineView();break;
  case'jog':{if(MC.job.run&&!MC.job.pause){toast(T('Во время задания перемещение недоступно.','Jogging is disabled while a job runs.'));break}const ax=v[0],dir=v[1]==='+'?1:-1;sendCmd(`$J=G91 ${ax}${fx(dir*MC.step,3)} F${ax==='Z'?600:3000}`);break}
  case'mHome':sendCmd('$H');break;case'mUnlock':sendCmd('$X');break;
  case'zeroAx':MC.zero[+v]=MC.pos[+v];mlog('tx',`> G10 L20 P1 ${'XYZ'[+v]}0`);mlog('rx','ok');updateMachineLive();break;
  case'mZeroXY':MC.zero[0]=MC.pos[0];MC.zero[1]=MC.pos[1];mlog('tx','> G10 L20 P1 X0 Y0');mlog('rx','ok');updateMachineLive();break;
  case'mGoZero':sendCmd(`G90 G0 X${fx(MC.zero[0],3)} Y${fx(MC.zero[1],3)}`);break;
  case'mFrame':{const b=P.stats.b,pts=[[b[0],b[1]],[b[3],b[1]],[b[3],b[4]],[b[0],b[4]],[b[0],b[1]]];mlog('rx',T('Обвод рамки задания','Tracing the job frame'));pts.forEach((p,i)=>setTimeout(()=>{MC.pos=[p[0],p[1],MC.pos[2]];mlog('tx',`> G0 X${fx(p[0],2)} Y${fx(p[1],2)}`);updateMachineLive()},i*450));break}
  case'mFire':sendCmd(`M3 S${Math.round(S.machine.smax*.01)}`);setTimeout(()=>sendCmd('M5'),600);break;
  case'mSpin':sendCmd(`M3 S${S.machine.rpm}`);break;
  case'mProbe':mlog('rx',T('Подключите щуп/датчик — функция выполняется на реальном станке.','Attach the probe/sensor — this runs on a real machine.'));break;
  case'macro':{const m=(S.macros||[])[+v];if(m)for(const c of m.g.split(';'))if(c.trim())await sendCmd(c.trim());break}
  case'editMacros':openMacros();break;
  case'saveMacros':{const list=$('#mcEdit').value.split('\n').map(l=>l.split('|')).filter(p=>p.length>1&&p[0].trim()&&p[1].trim()).map(p=>({n:p[0].trim(),g:p.slice(1).join('|').trim()}));pushUndo();S.macros=list;closeModal();changed();break}
 }
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset.prop){setBox(t.dataset.prop,parseFloat(t.value));return}
 if(t.id==='lockRatio'){toolOpt.lock=t.checked;return}
 if(t.dataset.topt){const k=t.dataset.topt;toolOpt[k]=t.tagName==='TEXTAREA'||t.tagName==='SELECT'?t.value:parseFloat(t.value);return}
 if(t.id==='snapChk'){S.snapOn=t.checked;save();renderStatus();return}
 if(t.id==='snapStep'){S.snap=Math.max(.1,parseFloat(t.value)||1);save();renderStatus();return}
 if(t.dataset.job){pushUndo();S.job[t.dataset.job]=t.checked;changed();return}
 if(t.dataset.sheet){const k=t.dataset.sheet;pushUndo();if(k==='on')S.sheet.on=t.checked;else{const v=parseFloat(t.value);if(!isFinite(v))return;S.sheet[k]=Math.max(k==='x'||k==='y'||k==='margin'?0:.1,v);if(k==='w')S.sheet.w=Math.min(S.sheet.w,S.machine.w);if(k==='h')S.sheet.h=Math.min(S.sheet.h,S.machine.h);if(k==='thick')applyMaterial()}changed();return}
 if(t.id==='matSel'){pushUndo();S.sheet.mat=+t.value;S.sheet.thick=curMat().t;applyMaterial();changed();toast(T('Материал выбран — параметры операций обновлены.','Material set — operation settings updated.'));return}
 if(t.id==='sheetPreset'&&t.value!==''){const p=SHEETS[+t.value];pushUndo();S.sheet.w=Math.min(p[1],S.machine.w);S.sheet.h=Math.min(p[2],S.machine.h);changed();return}
 if(t.dataset.img){const s=selShapes()[0];if(!s||!s.img)return;const k=t.dataset.img;pushUndo();s.img[k]=t.type==='checkbox'?t.checked:t.tagName==='SELECT'?t.value:parseFloat(t.value);changed();return}
 if(t.id==='ovChk'){pushUndo();for(const s of selShapes()){if(t.checked)s.ov=s.ov||{power:S.layers[s.layer].laser.power,speed:S.layers[s.layer].laser.speed};else delete s.ov}changed();return}
 if(t.dataset.ov){const v=parseFloat(t.value);if(!isFinite(v))return;pushUndo();for(const s of selShapes())if(s.ov)s.ov[t.dataset.ov]=t.dataset.ov==='power'?clamp(v,0,100):Math.max(1,v);changed();return}
 if(t.dataset.k&&camSel!=null){const[g,k]=t.dataset.k.split('.'),L=S.layers[camSel];let v=t.tagName==='SELECT'?t.value:parseFloat(t.value);
  if(typeof v==='number'){if(!isFinite(v))return;if(t.min!=='')v=Math.max(+t.min,v);if(t.max!=='')v=Math.min(+t.max,v)}pushUndo();L[g][k]=v;changed();return}
 if(t.dataset.kb&&camSel!=null){const[g,k]=t.dataset.kb.split('.');pushUndo();S.layers[camSel][g][k]=t.checked;changed();return}
 if(t.id==='layerName'&&camSel!=null){pushUndo();S.layers[camSel].name=t.value.trim();changed();return}
 if(t.id==='toolSel'&&t.value!==''){const tl=TOOLS[+t.value],c=S.layers[camSel].cnc;pushUndo();c.tool=tl.d;toolOpt.fl=tl.fl;if(tl.v){c.op='vcarve';c.vangle=tl.v}changed();return}
 if(t.id==='rapChk'){P.rapids=t.checked;draw();return}if(t.id==='ghostChk'){P.ghost=t.checked;draw();return}if(t.id==='followChk'){P.follow=t.checked;return}
 if(t.dataset.chk){MC.checks[t.dataset.chk]=t.checked;return}
 if(t.id==='fovR'){MC.feedOv=+t.value;return}
 if(t.id==='mType'){draftM.type=t.value;return}
 if(t.id==='npMat'){NP.mat=+t.value;const mm=MACHINES.find(x=>x.id===NP.m),ml=mm.type==='laser'?MATERIALS:CNC_MATS;NP.thick=ml[NP.mat].t;readNP();renderNewProject();return}
 if(t.dataset.gf&&GS){const f=GS.g.fields.find(f=>f.k===t.dataset.gf);GS.o[f.k]=f.t==='chk'?t.checked:f.t==='num'?(isFinite(parseFloat(t.value))?parseFloat(t.value):GS.o[f.k]):t.value;if(f.t==='chk'||f.t==='sel')renderGenSide();genRegen();return}
 if(t.dataset.sl){slSet(t.dataset.sl,t.type==='checkbox'?t.checked:t.value);return}
});
document.addEventListener('input',e=>{const t=e.target;
 if(t.id==='pbSlider'){P.t=P.total*(+t.value/1000);P.playing=false;updatePbTime();syncLine();draw();return}
 if(t.id==='fovR'){MC.feedOv=+t.value;$('#fovV').textContent=t.value+'%'}
});
$('#fileSvg').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const txt=await f.text();if(/\.dxf$/i.test(f.name)||/^\s*0\s*\r?\n\s*SECTION/.test(txt))importDXF(txt);else importSVG(txt)}catch(err){toast(T('Не удалось прочитать файл: в нём нет контуров или он повреждён.','Could not read the file: no outlines found or it is damaged.'))}};
$('#fileImg').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{imageChooser(await loadImageFile(f))}catch(err){toast(T('Не удалось открыть изображение.','Could not open the image.'))}};
$('#fileGenImg').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f||!GS)return;try{GS.o.img=await loadImageFile(f);renderGenSide();genRegen()}catch(err){toast(T('Не удалось открыть изображение.','Could not open the image.'))}};
$('#file3d').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;await slLoadFile(f)};
$('#fileGc').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;loadGcode(await f.text(),f.name);P.t=0;P.playing=false;fitPlate(0);refresh();toast(T(`Открыт ${f.name}: ${P.lines.length} строк`,`Opened ${f.name}: ${P.lines.length} lines`))};
$('#fileProj').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(!(j.v===1||j.v===2)||!Array.isArray(j.shapes))throw 0;pushUndo();S=migrate(j);sel.clear();curPlate=0;changed();fitPlate(0);draw()}catch(err){toast(T('Это не файл проекта Kerf Studio.','This is not a Kerf Studio project file.'))}};
document.addEventListener('paste',e=>{if(tab!=='cad'||!$('#modal').hidden||/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;const txt=e.clipboardData.getData('text');if(txt&&/<svg[\s>]/i.test(txt)){e.preventDefault();try{importSVG(txt)}catch(err){toast(T('Не удалось вставить SVG.','Could not paste the SVG.'))}}});
document.addEventListener('keydown',e=>{
 if(!$('#modal').hidden){if(e.key==='Escape')closeModal();return}
 const tg=document.activeElement&&document.activeElement.tagName;if(/INPUT|TEXTAREA|SELECT/.test(tg))return;
 const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
 if(e.key===' '){e.preventDefault();if(tab==='gcode'){if(P.t>=P.total)P.t=0;P.playing=!P.playing;renderChrome()}else{spaceDown=true;cv.style.cursor='grab'}return}
 if(k==='f'&&!mod){fitPlate(curPlate);draw();renderStatus();return}
 if(tab!=='cad')return;
 if(mod&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return}if(mod&&k==='y'){e.preventDefault();redo();return}
 if(mod&&k==='a'){e.preventDefault();sel=new Set(S.shapes.filter(s=>S.layers[s.layer].show&&plateOf(s)===curPlate).map(s=>s.id));refresh();return}
 if(mod&&k==='d'){e.preventDefault();dupSel();return}
 if(mod&&k==='g'){e.preventDefault();e.shiftKey?ungroupSel():groupSel();return}
 if(mod&&k==='c'){clip=JSON.parse(JSON.stringify(selShapes()));return}
 if(mod&&k==='v'){if(!clip||!clip.length)return;pushUndo();sel=new Set(cloneShapes(clip,10,-10));clip=clip.map(s=>({...s,paths:mapPaths(s.paths,(x,y)=>[x+10,y-10])}));changed();return}
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();delSel();return}
 if(e.key==='Escape'){if(penPts){penPts=null;draw();return}measure=null;sel.clear();refresh();return}
 if(e.key==='Enter'&&penPts){finishPen(false);return}
 if(e.key.startsWith('Arrow')&&sel.size){e.preventDefault();const d=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,dy=e.key==='ArrowDown'?-d:e.key==='ArrowUp'?d:0;transformSel((x,y)=>[x+dx,y+dy]);return}
 const map={v:'select',h:'hand',r:'rect',e:'ellipse',p:'polygon',s:'star',l:'line',n:'pen',t:'text',m:'measure'};if(!mod&&map[k]&&(mode==='pro'||!['polygon','star','line','measure'].includes(map[k])))setTool(map[k]);
});
document.addEventListener('keyup',e=>{if(e.key===' '){spaceDown=false;cv.style.cursor=''}});
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
new ResizeObserver(()=>{resize();if(tab==='machine')drawMachineCanvas();if(GS&&GS.view==='2d')genDraw()}).observe($('#stage'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{prevCache.clear();draw()});

/* ================= boot ================= */
async function finishSample(){const g=S._sampleText;if(!g)return;delete S._sampleText;
 const paths=await makeTextPaths('KERF · 2026','mono',6);if(!paths.length)return;const b=bboxOf(paths),w=b[2]-b[0];
 addShape(S,2,'text',mapPaths(paths,(x,y)=>[x+85-w/2,y+40]),true,{text:'KERF · 2026',font:'mono',size:6,rot:0,g});camDirty=true;save();refresh()}
(function boot(){
 const th=store.get('kerf.theme');if(th==='light'||th==='dark')document.documentElement.dataset.theme=th;
 load();if(!['cad','cam','gcode','machine'].includes(tab))tab='cad';if(mode!=='simple'&&mode!=='pro')mode='pro';
 if(tab!=='cad')ensureCam();
 refresh();resize();
 if(S._sampleText)finishSample();
 if(document.fonts)document.fonts.ready.then(()=>draw());
 mlog('rx','Kerf Studio · '+T('демо-станок готов','demo machine ready'));
 requestAnimationFrame(tick);
 if(DESK){if(DESK.pendingFile)DESK.pendingFile().then(openDeskFile).catch(()=>{});if(DESK.onOpenFile)DESK.onOpenFile(openDeskFile)}
})();
