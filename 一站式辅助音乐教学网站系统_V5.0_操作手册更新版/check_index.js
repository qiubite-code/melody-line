
const $ = (id) => document.getElementById(id);
const state = { page:'dashboard', bpm:80, timeSig:'4/4', bars:16, playing:false, audioCtx:null, metroTimer:null, beatIndex:0, playTimer:null, selectedRhythm:null, selectedNote:null, rhythmEnabled:true, playStartCell:0, activePlayTimers:[] };
var rhythmEvents = []; // 全局节奏事件：确保节奏轨道首屏即可渲染
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const RHYTHM_SOUND_OPTIONS=[['wood','木鱼'],['clave','响棒'],['clap','拍手'],['snare','小军鼓'],['kick','低音鼓'],['hihat','踩镲'],['ride','吊镲'],['tambourine','铃鼓'],['shaker','沙锤'],['maraca','沙槌'],['bongo','邦戈鼓'],['conga','康加鼓'],['cowbell','牛铃'],['triangle','三角铁'],['tom','通鼓'],['rim','鼓边']];
function fillSoundSelects(){for(let i=1;i<=4;i++){const sel=$('rhythmSound'+i); if(!sel) continue; sel.innerHTML=RHYTHM_SOUND_OPTIONS.map(([v,n])=>`<option value="${v}">${n}</option>`).join(''); sel.value=['wood','snare','hihat','cowbell'][i-1];}}
const midiToFreq=m=>440*Math.pow(2,(m-69)/12); const midiName=m=>NOTE_NAMES[m%12]+(Math.floor(m/12)-1);
const toast=(msg)=>{const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)};
function ctx(){ if(!state.audioCtx) state.audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(state.audioCtx.state==='suspended') state.audioCtx.resume(); return state.audioCtx; }
function parseSig(){const [top,bottom]=state.timeSig.split('/').map(Number); return {top,bottom,unitsPerBar:top*(16/bottom), quartersPerBar:top*(4/bottom)};}
function totalUnits(){const {unitsPerBar}=parseSig(); const rMax=(typeof rhythmEvents!=='undefined'&&rhythmEvents.length)?Math.max(...rhythmEvents.map(e=>e.cell+e.units),0):0; const mMax=(typeof melodyNotes!=='undefined'&&melodyNotes.length)?Math.max(...melodyNotes.map(n=>n.start+n.units),0):0; const min=unitsPerBar*16; return Math.max(min, rMax+unitsPerBar*2, mMax+unitsPerBar*2, (state.playStartCell||0)+unitsPerBar*4);}
function secPerUnit(){return 60/state.bpm/4;}
function switchPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===id));state.page=id; const names={dashboard:['首页总览','选择左侧功能，在右侧完成课堂创编与展示。'],visualizer:['实时音频旋律线条可视化',''],rhythm:['音乐节奏创编','标准节奏素材自由拖拽组合，支持附点、连音、切分与从头播放。'],melody:['旋律创编','钢琴卷帘点写，标尺显示每一拍，可拖动音符尾部调整时值。'],metronome:['节拍器','课堂速度与强弱规律训练。'],records:['作品保存','保存、读取和导出本地作品。'],manual:['操作手册','查看平台使用说明。']}; $('pageTitle').textContent=names[id][0]; $('pageSub').textContent=names[id][1];
  if(id==='rhythm') setTimeout(()=>{renderRhythm();}, 0);
  if(id==='melody') setTimeout(()=>{renderPianoRoll();}, 0);
}
window.switchPage=switchPage;
$('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-page]'); if(b) switchPage(b.dataset.page)});
$('sidebarToggle')?.addEventListener('click',()=>{const app=document.querySelector('.app'); app.classList.toggle('sidebar-collapsed'); $('sidebarToggle').textContent=app.classList.contains('sidebar-collapsed')?'›':'‹';});
function syncGlobal(){state.bpm=Number($('globalBpm').value);$('globalBpmRange').value=state.bpm; state.timeSig=$('globalTimeSig').value; renderRhythm(); renderPianoRoll(); renderBeatDots();}
$('globalBpm').addEventListener('input',syncGlobal);$('globalBpmRange').addEventListener('input',e=>{$('globalBpm').value=e.target.value;syncGlobal()});$('globalTimeSig').addEventListener('change',syncGlobal);
$('globalPlay').addEventListener('click',()=>playAll());$('globalStop').addEventListener('click',()=>stopAll());
function beep(freq=880,dur=.06,type='sine',gain=.12){const a=ctx(); if($('muteMetro')?.checked && state.page==='metronome') return; const o=a.createOscillator(), g=a.createGain(); o.type=type; o.frequency.value=freq; g.gain.setValueAtTime(gain,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+dur); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+dur);}
function makeNoiseBuffer(a){
  const len=Math.floor(a.sampleRate*0.35), buf=a.createBuffer(1,len,a.sampleRate), data=buf.getChannelData(0);
  for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2);
  return buf;
}
function playTone(midi,start,dur,timbre='grandPiano'){
  const a=ctx(); const freq=midiToFreq(midi); const safeStart=Math.max(start,a.currentTime+0.01), safeDur=Math.max(0.06,dur);
  const profiles={grandPiano:{type:'triangle',gain:.16,atk:.006,dec:.18,sus:.30,rel:.24,partials:[[1,1],[2,.30],[3,.12],[4,.05]],lp:5200},uprightPiano:{type:'triangle',gain:.14,atk:.008,dec:.20,sus:.28,rel:.20,partials:[[1,1],[2,.24],[3,.10]],lp:4600},electricPiano:{type:'sine',gain:.14,atk:.014,dec:.24,sus:.45,rel:.32,partials:[[1,1],[2,.16],[3,.05]],lp:3800},musicBox:{type:'sine',gain:.17,atk:.003,dec:.09,sus:.16,rel:.60,partials:[[1,1],[2,.45],[4,.16]],lp:7000},glockenspiel:{type:'sine',gain:.13,atk:.002,dec:.05,sus:.12,rel:.85,partials:[[1,1],[2.01,.55],[3.02,.18]],lp:8200},flute:{type:'sine',gain:.12,atk:.05,dec:.08,sus:.80,rel:.20,partials:[[1,1],[2,.08],[3,.03]],lp:3600},clarinet:{type:'square',gain:.07,atk:.035,dec:.08,sus:.62,rel:.18,partials:[[1,1],[3,.22],[5,.08]],lp:3000},violin:{type:'sawtooth',gain:.075,atk:.08,dec:.10,sus:.70,rel:.26,partials:[[1,1],[2,.30],[3,.12]],lp:4200},cello:{type:'sawtooth',gain:.085,atk:.10,dec:.12,sus:.68,rel:.32,partials:[[.5,.35],[1,1],[2,.22]],lp:2400},dizi:{type:'square',gain:.065,atk:.025,dec:.08,sus:.58,rel:.14,partials:[[1,1],[2,.18],[3,.07]],lp:4200},synthLead:{type:'sawtooth',gain:.08,atk:.015,dec:.08,sus:.55,rel:.22,partials:[[1,1],[2,.20]],lp:2600}};
  const pr=profiles[timbre]||profiles.grandPiano; const master=a.createGain(); master.connect(a.destination);
  pr.partials.forEach(([mul,amp])=>{const o=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();o.type=pr.type;o.frequency.setValueAtTime(freq*mul,safeStart);f.type='lowpass';f.frequency.value=pr.lp;f.Q.value=.9;const peak=pr.gain*amp;g.gain.setValueAtTime(.0001,safeStart);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),safeStart+pr.atk);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak*pr.sus),safeStart+pr.atk+pr.dec);g.gain.setValueAtTime(Math.max(.0002,peak*pr.sus),safeStart+safeDur);g.gain.exponentialRampToValueAtTime(.0001,safeStart+safeDur+pr.rel);o.connect(f).connect(g).connect(master);o.start(safeStart);o.stop(safeStart+safeDur+pr.rel+.05)});
}
function playRhythmHit(time, dur, sound='wood', accent=false){
  const a=ctx(); const t=Math.max(time,a.currentTime+0.006); const d=Math.max(0.035,dur); const out=a.createGain(); out.gain.value=accent?1.15:0.92; out.connect(a.destination);
  const noise=(len=.22)=>{const buf=a.createBuffer(1,Math.floor(a.sampleRate*len),a.sampleRate), data=buf.getChannelData(0); for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2.6); return buf;};
  const env=(node,peak=.25,len=.12)=>{const g=a.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.006);g.gain.exponentialRampToValueAtTime(0.0001,t+len);node.connect(g).connect(out);return g};
  const osc=(freq,type='sine',len=.12,peak=.18)=>{const o=a.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);env(o,peak,len);o.start(t);o.stop(t+len+.02)};
  const nz=(filterType='bandpass',freq=1500,q=3,len=.12,peak=.18)=>{const s=a.createBufferSource(),f=a.createBiquadFilter();s.buffer=noise(len*2.1);f.type=filterType;f.frequency.value=freq;f.Q.value=q;s.connect(f);env(f,peak,len);s.start(t);s.stop(t+len+.02)};
  if(sound==='kick'){osc(90,'sine',Math.min(.22,d),.34);return} if(sound==='snare'||sound==='drum'){nz('bandpass',1800,1.2,.16,.22);osc(210,'triangle',.12,.10);return} if(sound==='hihat'){nz('highpass',6500,.8,.07,.16);return} if(sound==='ride'){nz('highpass',4500,.8,.22,.10);osc(2500,'triangle',.18,.04);return} if(sound==='clap'){nz('bandpass',2200,1.0,.12,.19);setTimeout(()=>nz('bandpass',2500,1.0,.09,.12),18);return} if(sound==='tambourine'||sound==='bell'){nz('highpass',5000,1.5,.20,.13);osc(1200,'triangle',.18,.06);return} if(sound==='shaker'||sound==='maraca'){nz('highpass',4200,1.0,.08,.12);return} if(sound==='bongo'){osc(accent?280:360,'triangle',.16,.18);nz('bandpass',900,2,.08,.06);return} if(sound==='conga'){osc(accent?180:230,'triangle',.22,.18);nz('bandpass',700,2,.10,.05);return} if(sound==='cowbell'){osc(760,'square',.16,.10);osc(1180,'square',.14,.08);return} if(sound==='triangle'){osc(2400,'sine',Math.min(.55,d),.10);return} if(sound==='tom'){osc(accent?155:190,'sine',.26,.22);return} if(sound==='rim'||sound==='clave'){osc(1900,'triangle',.08,.14);nz('bandpass',2200,5,.06,.05);return} osc(sound==='wood'?1050:1600,'triangle',.10,.16);
}

const rhythmGroups=[
  ['基础时值',[[ '全音符',16,'note','𝅝'],['二分音符',8,'note','𝅗𝅥'],['四分音符',4,'note','♩'],['八分音符',2,'note','♪'],['十六分音符',1,'note','♬'],['全休止',16,'rest','𝄻'],['二分休止',8,'rest','𝄼'],['四分休止',4,'rest','𝄽'],['八分休止',2,'rest','𝄾'],['十六分休止',1,'rest','𝄿']]],
  ['附点记号',[[ '附点',0,'dot','·']]],
  ['连音节奏',[[ '八分二连音',4,'note','♪ ♪'],['十六分四连音',4,'note','♬ ♬ ♬ ♬'],['十六分两两均分',4,'note','♬♬ ♬♬'],['八分三连音',4,'note','♪♪♪³'],['十六分三连音',2,'note','♬♬♬³']]],
  ['切分节奏',[[ '八分小切分',4,'note','♪ ♩ ♪'],['大切分',8,'note','♩ 𝅗𝅥 ♩'],['十六分切分',4,'note','♬ ♪ ♬'],['后切分',4,'note','♪ ♩ ♪']]],
  ['附点节奏',[[ '附点四分+八分',8,'note','♩. ♪'],['八分+附点四分',8,'note','♪ ♩.'],['附点八分+十六分',4,'note','♪. ♬'],['十六分+附点八分',4,'note','♬ ♪.']]],
  ['常用组合',[[ '四分+双八分',8,'note','♩ ♪♪'],['双八分+四分',8,'note','♪♪ ♩'],['四分+休止',8,'note','♩ 𝄽'],['八分+休止',4,'note','♪ 𝄾']]],
  ['休止组合',[[ '两音一休',4,'note','♪ ♪ 𝄾'],['一休两音',4,'note','𝄾 ♪ ♪'],['音休穿插',4,'note','♪ 𝄾 ♪ 𝄾'],['前休止',4,'note','𝄾 ♩'],['后休止',4,'note','♩ 𝄾']]],
  ['长音延展',[[ '两拍长音',8,'note','𝅗𝅥'],['四拍长音',16,'note','𝅝'],['结尾延长',12,'note','𝅗𝅥 ♩.']]]
];
let rhythmPalettePage='1';
function rhythmSymbol(name,type){ if(type==='dot'||name==='附点') return '·'; for(const [,items] of rhythmGroups){const hit=items.find(x=>x[0]===name); if(hit) return hit[3]||hit[0];} return type==='rest'?'𝄽':'♩';}
function rhythmEventSymbol(ev){ const base=rhythmSymbol(ev.name,ev.type); return ev.dotted ? (base + '.') : base; }
function dottedName(ev){ const u=Math.round((ev.baseUnits||ev.units/1.5||ev.units)*100)/100; const map={1:'十六分',2:'八分',4:'四分',8:'二分',16:'全'}; const label=map[u]||ev.name; return '附点'+label+(ev.type==='rest'?'休止':'音符'); }
function renderLibrary(){
  const box=$('rhythmLibrary'); if(!box) return; box.innerHTML='';
  const pages=[['1','基础/附点'],['2','连音'],['3','切分'],['4','组合/休止'],['All','全部']];
  const tabs=document.createElement('div'); tabs.className='sibelius-tabs';
  pages.forEach(([key,label])=>{const b=document.createElement('button'); b.type='button'; b.className=rhythmPalettePage===key?'active':''; b.innerHTML='<b>'+key+'</b>'; b.title=label; b.onclick=()=>{rhythmPalettePage=key;renderLibrary()}; tabs.appendChild(b);});
  box.appendChild(tabs);
  const pageMap={'1':['基础时值','附点记号'],'2':['连音节奏'],'3':['切分节奏'],'4':['附点节奏','常用组合','休止组合','长音延展'],'All':rhythmGroups.map(g=>g[0])};
  const wanted=new Set(pageMap[rhythmPalettePage]||pageMap['1']);
  const grid=document.createElement('div'); grid.className='sibelius-grid';
  rhythmGroups.forEach(([title,items])=>{ if(!wanted.has(title)) return;
    items.forEach(([name,units,type,symbol])=>{ const c=document.createElement('div'); c.className='sib-key '+(type==='rest'?'rest ':type==='dot'?'dot ':''); c.draggable=true; c.dataset.name=name; c.dataset.units=units; c.dataset.type=type; c.dataset.symbol=symbol||''; c.title=name+(type==='dot'?'｜拖到音符或休止后面':'｜'+units+'格');
      c.innerHTML='<span class="rhythm-symbol">'+rhythmSymbol(name,type)+'</span><strong>'+name+'</strong><small>'+(type==='dot'?'延长前一音/休止':units+'格')+'</small>';
      c.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',JSON.stringify({name,units,type,symbol:symbol||''}))}); grid.appendChild(c); });
  }); box.appendChild(grid);
}
function setPlayStartCell(cell){state.playStartCell=Math.max(0,Math.round(cell)); const {unitsPerBar}=parseSig(); const bar=Math.floor(state.playStartCell/unitsPerBar)+1; const pos=state.playStartCell%unitsPerBar+1; if($('playStartReadout')) $('playStartReadout').textContent='小节 '+bar+' · 第 '+pos+' 格'; renderRhythm(); renderPianoRoll();}
function renderRhythm(){
  const {unitsPerBar}=parseSig(); const total=totalUnits(); const unitW=24; const editor=$('rhythmEditor'); if(!editor) return;
  editor.innerHTML=''; editor.style.setProperty('--unit-w',unitW+'px'); editor.style.setProperty('--units-bar',unitsPerBar); editor.style.setProperty('--total-units',total);
  const scroller=document.createElement('div'); scroller.className='rhythm-timeline-scroller'; const timeline=document.createElement('div'); timeline.className='rhythm-timeline-inner'; timeline.style.width=(total*unitW+92)+'px';
  const labels=document.createElement('div'); labels.className='bar-labels rhythm-bar-ruler'; labels.style.gridTemplateColumns=`92px repeat(${Math.ceil(total/unitsPerBar)}, ${unitsPerBar*unitW}px)`; labels.innerHTML='<span class="track-ruler-title">轨道</span>'+Array.from({length:Math.ceil(total/unitsPerBar)},(_,i)=>`<span>小节 ${i+1}</span>`).join(''); timeline.appendChild(labels);
  [1,2,3,4].forEach(trackNo=>{const track=document.createElement('div'); track.className='track rhythm-one-track rhythm-dual-track'; const name=document.createElement('div'); name.className='track-name'; name.innerHTML='轨道 '+trackNo; const grid=document.createElement('div'); grid.className='gridline'; grid.style.width=total*unitW+'px'; grid.style.height='78px'; grid.addEventListener('click',e=>{if(e.target!==grid)return; const rect=grid.getBoundingClientRect(); setPlayStartCell(Math.floor((e.clientX-rect.left+grid.scrollLeft)/unitW));}); const catcher=document.createElement('div'); catcher.className='cell-catcher'; for(let i=0;i<total;i++){const cell=document.createElement('div'); cell.className='drop-cell'; cell.dataset.cell=i; cell.dataset.track=trackNo; cell.addEventListener('click',()=>setPlayStartCell(i)); cell.addEventListener('dragover',e=>{e.preventDefault(); cell.classList.add('drop-over')}); cell.addEventListener('dragleave',()=>cell.classList.remove('drop-over')); cell.addEventListener('drop',e=>{cell.classList.remove('drop-over');dropRhythm(e,i,trackNo)}); catcher.appendChild(cell)} grid.appendChild(catcher); const startLine=document.createElement('div'); startLine.className='track-start-line'; startLine.style.left=(state.playStartCell*unitW)+'px'; grid.appendChild(startLine); rhythmEvents.filter(ev=>(ev.track||1)===trackNo).forEach(ev=>{const idx=rhythmEvents.indexOf(ev); const el=document.createElement('div'); el.className='event '+(ev.type==='rest'?'rest':''); el.style.left=ev.cell*unitW+'px'; el.style.width=Math.max(32,ev.units*unitW-4)+'px'; el.dataset.idx=idx; el.title=(ev.dotted?dottedName(ev):ev.name)+'｜双击删除'; el.innerHTML='<b>'+rhythmEventSymbol(ev)+'</b>'; if(ev.dotted){ el.classList.add('dotted'); } if(idx===state.selectedRhythm)el.classList.add('selected'); el.onclick=()=>{state.selectedRhythm=idx;renderRhythm()}; el.ondblclick=()=>{rhythmEvents.splice(idx,1);state.selectedRhythm=null;renderRhythm()}; grid.appendChild(el)}); const ph=document.createElement('div'); ph.className='track-playhead'; ph.dataset.trackPlayhead=trackNo; ph.style.display='none'; grid.appendChild(ph); track.appendChild(name); track.appendChild(grid); timeline.appendChild(track);});
  scroller.appendChild(timeline); editor.appendChild(scroller);
}
function dropRhythm(e,cell,track=1){
  const ev=JSON.parse(e.dataTransfer.getData('text/plain'));
  if(ev.type==='dot'||ev.name==='附点'){
    const sameTrack=rhythmEvents.filter(x=>(x.track||1)===track && x.type!=='dot');
    let prev=sameTrack.find(x=>Math.abs((x.cell+x.units)-cell)<0.001);
    if(!prev){ prev=sameTrack.filter(x=>(x.cell+x.units)<=cell).sort((a,b)=>(b.cell+b.units)-(a.cell+a.units))[0]; }
    if(!prev){ toast('请把附点拖到音符或休止后面。'); return; }
    if(prev.dotted){ toast('该节奏已经是附点节奏。'); return; }
    prev.baseUnits=Number(prev.units);
    prev.units=Number((prev.units+prev.units/2).toFixed(3));
    prev.dotted=true;
    prev.displayName=dottedName(prev);
    renderRhythm();
    toast('已融合为'+prev.displayName);
    return;
  }
  rhythmEvents.push({cell,track,name:ev.name,units:Number(ev.units),baseUnits:Number(ev.units),type:ev.type,dotted:false});
  renderRhythm();
}
function rhythmPattern(ev){const u=Number(ev.units)||1,name=ev.name; const N=(off,len,rest=false)=>({off,len,rest}); if(ev.dotted) return [N(0,u,ev.type==='rest')]; if(ev.type==='rest'||(name.includes('休止')&&!name.includes('+'))) return [N(0,u,true)]; if(name==='八分二连音')return[N(0,2),N(2,2)]; if(name==='十六分四连音')return[N(0,1),N(1,1),N(2,1),N(3,1)]; if(name==='十六分两两均分')return[N(0,1),N(1,1),N(2,1),N(3,1)]; if(name==='四分+双八分')return[N(0,4),N(4,2),N(6,2)]; if(name==='双八分+四分')return[N(0,2),N(2,2),N(4,4)]; if(name==='四分+休止')return[N(0,4),N(4,4,true)]; if(name==='八分+休止')return[N(0,2),N(2,2,true)]; if(name==='附点四分+八分')return[N(0,6),N(6,2)]; if(name==='八分+附点四分')return[N(0,2),N(2,6)]; if(name==='附点八分+十六分')return[N(0,3),N(3,1)]; if(name==='十六分+附点八分')return[N(0,1),N(1,3)]; if(name==='八分小切分'||name==='后切分')return[N(0,1),N(1,2),N(3,1)]; if(name==='大切分')return[N(0,2),N(2,4),N(6,2)]; if(name==='十六分切分')return[N(0,1),N(1,2),N(3,1)]; if(name==='八分三连音')return[N(0,4/3),N(4/3,4/3),N(8/3,4/3)]; if(name==='十六分三连音')return[N(0,2/3),N(2/3,2/3),N(4/3,2/3)]; if(name==='两音一休')return[N(0,1.33),N(1.33,1.33),N(2.66,1.34,true)]; if(name==='一休两音')return[N(0,1.33,true),N(1.33,1.33),N(2.66,1.34)]; if(name==='音休穿插')return[N(0,1),N(1,1,true),N(2,1),N(3,1,true)]; if(name==='前休止')return[N(0,2,true),N(2,2)]; if(name==='后休止')return[N(0,2),N(2,2,true)]; if(name==='结尾延长')return[N(0,8),N(8,4)]; return[N(0,u)];}
function playRhythm(track='all',startCell=state.playStartCell||0){const a=ctx(); const start=a.currentTime+.08; rhythmEvents.filter(ev=>(track==='all'||(ev.track||1)===track)&&(ev.cell+ev.units)>startCell).forEach(ev=>{const sound=$('rhythmSound'+(ev.track||1))?.value||'wood'; rhythmPattern(ev).forEach((hit,i)=>{if(hit.rest)return; const when=start+(ev.cell-startCell+hit.off)*secPerUnit(); if(when<a.currentTime)return; playRhythmHit(when,Math.max(.06,hit.len*secPerUnit()),sound,i===0);});}); animateRhythmPlayhead(startCell);}
function animateRhythmPlayhead(startCell=state.playStartCell||0){const unitW=24,total=totalUnits(),dur=(total-startCell)*secPerUnit()*1000,start=performance.now(); state.activePlayTimers.forEach(clearInterval); state.activePlayTimers=[]; document.querySelectorAll('[data-track-playhead]').forEach(ph=>{ph.style.display='block';ph.style.left=(startCell*unitW)+'px';}); const timer=setInterval(()=>{const p=(performance.now()-start)/dur; const cell=startCell+p*(total-startCell); document.querySelectorAll('[data-track-playhead]').forEach(ph=>ph.style.left=(cell*unitW)+'px'); if(p>=1){document.querySelectorAll('[data-track-playhead]').forEach(ph=>ph.style.display='none');clearInterval(timer)}},30); state.activePlayTimers.push(timer);}
$('playRhythm').onclick=()=>playRhythm('all');$('playRhythmTrack1').onclick=()=>playRhythm(1);$('playRhythmTrack2').onclick=()=>playRhythm(2);$('playRhythmTrack3').onclick=()=>playRhythm(3);$('playRhythmTrack4').onclick=()=>playRhythm(4);
$('deleteRhythm').onclick=()=>{if(state.selectedRhythm!=null){rhythmEvents.splice(state.selectedRhythm,1);state.selectedRhythm=null;renderRhythm()}};
$('resetRhythm').onclick=()=>{rhythmEvents=[];state.selectedRhythm=null;renderRhythm()};
// Melody
let melodyNotes=[]; const noteRange=Array.from({length:25},(_,i)=>60-i+12); // C5 down to C3
function allowedPitch(midi){const pc=midi%12; const mode=$('scaleMode').value; if(mode==='free')return true; if(mode==='pentatonic')return [0,2,4,7,9].includes(pc); return [0,2,4,5,7,9,11].includes(pc);}
function renderPianoRoll(){
  const keys=$('pianoKeys'), roll=$('pianoRoll'), ruler=$('pianoRuler');
  if(!keys||!roll) return;
  keys.innerHTML=''; roll.innerHTML=''; if(ruler) ruler.innerHTML='';
  const {unitsPerBar}=parseSig(); const unitW=24,rowH=24,total=totalUnits();
  roll.style.setProperty('--unit-w',unitW+'px'); roll.style.setProperty('--units-bar',unitsPerBar);
  roll.style.width=total*unitW+'px'; roll.style.height=noteRange.length*rowH+'px'; keys.style.height=roll.style.height;
  if(ruler){ruler.style.width=total*unitW+'px'; const bars=Math.ceil(total/unitsPerBar); for(let i=0;i<bars;i++){const rb=document.createElement('div');rb.className='ruler-bar';rb.style.left=(i*unitsPerBar*unitW)+'px';rb.style.width=(unitsPerBar*unitW)+'px';rb.textContent=i+1;rb.onclick=()=>setPlayStartCell(i*unitsPerBar);ruler.appendChild(rb)}}
  const rollWrapForRuler = document.querySelector('.cubase-roll-v38');
  if (ruler && rollWrapForRuler) {
    const syncRuler = () => { Array.from(ruler.children).forEach(ch => { ch.style.transform = 'translateX(' + (-rollWrapForRuler.scrollLeft) + 'px)'; }); };
    rollWrapForRuler.onscroll = syncRuler;
    syncRuler();
  }
  noteRange.forEach((m,i)=>{const k=document.createElement('div');k.className='piano-key '+([1,3,6,8,10].includes(m%12)?'black ':'')+(allowedPitch(m)?'allowed':'');k.innerHTML=`<span>${midiName(m)}</span>`;keys.appendChild(k)});
  const catcher=document.createElement('div'); catcher.style.position='absolute'; catcher.style.inset='0'; catcher.style.cursor='crosshair'; catcher.addEventListener('click',addNoteFromClick); catcher.addEventListener('contextmenu',e=>{e.preventDefault(); const rect=e.currentTarget.getBoundingClientRect(); const sc=e.currentTarget.parentElement; setPlayStartCell(Math.floor((e.clientX-rect.left+sc.scrollLeft)/24));}); roll.appendChild(catcher);
  melodyNotes.forEach((n,idx)=>{const row=noteRange.indexOf(n.midi); if(row<0)return; const el=document.createElement('div');el.className='note-block';el.dataset.idx=idx;el.style.left=n.start*unitW+'px';el.style.top=row*rowH+4+'px';el.style.width=Math.max(24,n.units*unitW-4)+'px';el.style.height=rowH-8+'px';el.textContent=midiName(n.midi); if(idx===state.selectedNote)el.classList.add('selected'); el.onmousedown=startDragNote; el.ondblclick=()=>{melodyNotes.splice(idx,1);renderPianoRoll()}; roll.appendChild(el)});
  const ph=document.createElement('div'); ph.id='melodyPlayhead'; ph.className='playhead'; ph.style.display='none'; roll.appendChild(ph);
}
function addNoteFromClick(e){if(e.target!==e.currentTarget)return; const rect=e.currentTarget.getBoundingClientRect(); const sc=e.currentTarget.parentElement; const x=e.clientX-rect.left+sc.scrollLeft; const y=e.clientY-rect.top+sc.scrollTop; const cell=Math.floor(x/24); const row=Math.floor(y/24); const midi=noteRange[row]; if(midi==null)return; const units=Number($('noteDuration').value); if(!allowedPitch(midi)){toast('当前音阶模式屏蔽了这个音。');return;} melodyNotes.push({start:cell,midi,units}); renderPianoRoll();}
let drag=null;function startDragNote(e){const idx=Number(e.currentTarget.dataset.idx); state.selectedNote=idx; const n=melodyNotes[idx]; drag={idx,dx:e.offsetX,dy:e.offsetY}; document.onmousemove=dragNote; document.onmouseup=()=>{drag=null;document.onmousemove=null;document.onmouseup=null}; e.preventDefault();}
function dragNote(e){if(!drag)return; const roll=$('pianoRoll'); const sc=roll.parentElement; const rect=roll.getBoundingClientRect(); const x=e.clientX-rect.left+sc.scrollLeft-drag.dx; const y=e.clientY-rect.top+sc.scrollTop-drag.dy; const cell=Math.max(0,Math.round(x/24)); const row=Math.max(0,Math.min(noteRange.length-1,Math.round(y/24))); const midi=noteRange[row]; if(allowedPitch(midi)){melodyNotes[drag.idx].start=cell;melodyNotes[drag.idx].midi=midi;renderPianoRoll();}}
$('scaleMode').addEventListener('change',renderPianoRoll);$('resetMelody').onclick=()=>{melodyNotes=[];renderPianoRoll()};$('playMelody').onclick=()=>playMelody();
function playMelody(startCell=state.playStartCell||0){const a=ctx(); const start=a.currentTime+.08; const timbre=$('melodyTimbre').value; melodyNotes.filter(n=>n.start+n.units>startCell).forEach(n=>playTone(n.midi,start+(n.start-startCell)*secPerUnit(),n.units*secPerUnit()*0.92,timbre)); animateMelodyPlayhead(startCell); drawMelodyCurve();}
function animateMelodyPlayhead(startCell=state.playStartCell||0){const ph=$('melodyPlayhead'); if(!ph)return; ph.style.display='block'; const start=performance.now(), dur=(totalUnits()-startCell)*secPerUnit()*1000, w=24; clearInterval(state.playTimer); state.playTimer=setInterval(()=>{const p=(performance.now()-start)/dur; if(p>=1){ph.style.display='none';clearInterval(state.playTimer);return} ph.style.left=((startCell+p*(totalUnits()-startCell))*w)+'px';},30);}
// Metronome
const METER_PATTERNS = {
  '2/4':['strong','weak'],
  '3/4':['strong','weak','weak'],
  '3/8':['strong','weak','weak'],
  '4/4':['strong','weak','medium','weak'],
  '6/8':['strong','weak','weak','medium','weak','weak'],
  '9/8':['strong','weak','weak','medium','weak','weak','medium','weak','weak'],
  '12/8':['strong','weak','weak','medium','weak','weak','medium','weak','weak','medium','weak','weak'],
  '5/4':['strong','weak','medium','weak','weak'],
  '5/8':['strong','weak','weak','medium','weak'],
  '7/4':['strong','weak','medium','weak','medium','weak','weak'],
  '7/8':['strong','weak','medium','weak','medium','weak','weak']
};
function currentMeterPattern(){
  return METER_PATTERNS[state.timeSig] || Array.from({length:parseSig().top},(_,i)=>i===0?'strong':'weak');
}
function beatStrength(idx){
  const pattern=currentMeterPattern();
  return pattern[idx % pattern.length] || 'weak';
}
function beatLabel(strength){
  if(strength==='strong') return '强';
  if(strength==='medium') return '次强';
  return '弱';
}
function patternText(){
  const p=currentMeterPattern().map(beatLabel).join(' ');
  return `${state.timeSig}：${p}`;
}
function renderBeatDots(){
  const pattern=currentMeterPattern(); const top=pattern.length; const box=$('beatDots'); if(!box)return;
  const mode=$('metroVisualMode')?.value || 'blocks';
  const cls={blocks:'metro-block-row',wave:'metro-wave-row',dots:'metro-dot-row',bars:'metro-bar-row'}[mode]||'metro-block-row';
  const itemCls={blocks:'metro-block',wave:'metro-wave-point',dots:'metro-dot',bars:'metro-line'}[mode]||'metro-block';
  const title={blocks:'图形色块',wave:'高低波形',dots:'圆点大小',bars:'竖线粗细'}[mode]||'图形色块';
  box.setAttribute('aria-label', title+'节拍可视化');
  let html=`<div class="${cls}">`;
  for(let i=0;i<top;i++){
    const s=beatStrength(i);
    html+=`<div class="${itemCls} ${s}" data-beat="${i}" title="第${i+1}拍：${beatLabel(s)}拍"><span>${i+1}</span></div>`;
  }
  html+='</div>';
  box.innerHTML=html;
  const patternBox=$('metroPatternText'); if(patternBox) patternBox.textContent=patternText();
}
function startMetro(){stopMetro(); state.beatIndex=0; renderBeatDots(); tickMetro(); state.metroTimer=setInterval(tickMetro,60000/state.bpm); $('metroStart').textContent='Ⅱ 暂停';}
function stopMetro(){clearInterval(state.metroTimer);state.metroTimer=null;document.querySelectorAll('#beatDots [data-beat]').forEach(d=>d.classList.remove('on')); if($('metroStart')) $('metroStart').textContent='▶ 开始';}
function tickMetro(){const pattern=currentMeterPattern(); const idx=state.beatIndex%pattern.length; const strength=beatStrength(idx); const strong=strength==='strong', medium=strength==='medium'; if(!$('muteMetro')?.checked) beep(strong?880:medium?680:520,strong?.075:.055,strong?'triangle':medium?'sine':'sine',strong?.18:medium?.13:.1); document.querySelectorAll('#beatDots [data-beat]').forEach((d)=>d.classList.toggle('on',Number(d.dataset.beat)===idx)); state.beatIndex++;}
$('metroStart').onclick=()=>{ if(state.metroTimer) stopMetro(); else startMetro();};$('metroStop').onclick=stopMetro;document.querySelectorAll('[data-bpm]').forEach(b=>b.onclick=()=>{$('globalBpm').value=b.dataset.bpm;syncGlobal()});$('metroVisualMode')?.addEventListener('change',renderBeatDots);
// Visualizer
let analyser, dataArray, micStream, mediaRecorder, vizRunning=false, vizPoints=[], vizStart=0, fileSource, audioSourceConnected=false; const vizCanvas=$('vizCanvas'), vctx=vizCanvas.getContext('2d');
function setupAnalyser(source){const a=ctx(); analyser=a.createAnalyser(); analyser.fftSize=4096; dataArray=new Float32Array(analyser.fftSize); source.connect(analyser); try{source.connect(a.destination)}catch{} }
$('startMic').onclick=async()=>{const a=ctx(); micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}}); const src=a.createMediaStreamSource(micStream); setupAnalyser(src); mediaRecorder=new MediaRecorder(micStream); mediaRecorder.start(); vizRunning=true; vizStart=performance.now(); $('stopMic').disabled=false; $('startMic').disabled=true; $('vizState').textContent='录音'; visualizeLoop();};
$('stopMic').onclick=()=>{vizRunning=false; if(micStream) micStream.getTracks().forEach(t=>t.stop()); if(mediaRecorder&&mediaRecorder.state!=='inactive') mediaRecorder.stop(); $('stopMic').disabled=true; $('startMic').disabled=false; $('vizState').textContent='停止'};
$('audioFile').addEventListener('change',e=>{const file=e.target.files[0]; if(!file)return; const audio=$('audioPlayer'); audio.src=URL.createObjectURL(file); audio.onplay=()=>{const a=ctx(); if(!audioSourceConnected){const src=a.createMediaElementSource(audio); setupAnalyser(src); audioSourceConnected=true;} vizRunning=true; vizStart=performance.now()-audio.currentTime*1000; visualizeLoop();}; audio.onpause=()=>vizRunning=false;});
$('clearViz').onclick=()=>{vizPoints=[];drawViz()};$('saveViz').onclick=()=>{const a=document.createElement('a');a.download='旋律线.png';a.href=vizCanvas.toDataURL('image/png');a.click()};
function autoCorrelate(buf,sampleRate){let rms=0; for(const v of buf)rms+=v*v; rms=Math.sqrt(rms/buf.length); if(rms<Number($('vizSilence').value))return {freq:0,rms}; let best=0,bestCorr=0; const minLag=Math.floor(sampleRate/1800), maxLag=Math.floor(sampleRate/60); for(let lag=minLag;lag<maxLag;lag++){let corr=0; for(let i=0;i<buf.length-lag;i++) corr += buf[i]*buf[i+lag]; if(corr>bestCorr){bestCorr=corr;best=lag}} if(!best)return {freq:0,rms}; return {freq:sampleRate/best,rms};}
function freqToMidi(f){return Math.round(69+12*Math.log2(f/440))}
function visualizeLoop(){if(!analyser||!vizRunning)return; analyser.getFloatTimeDomainData(dataArray); const res=autoCorrelate(dataArray,ctx().sampleRate); const t=(performance.now()-vizStart)/1000; if(res.freq){const midi=freqToMidi(res.freq); $('vizPitch').textContent=Math.round(res.freq)+'Hz';$('vizNote').textContent=midiName(midi); vizPoints.push({t,midi,rms:res.rms,note:midiName(midi)});}else{$('vizPitch').textContent='休止';$('vizNote').textContent='—'} $('vizRms').textContent=res.rms.toFixed(3); drawViz(); requestAnimationFrame(visualizeLoop);}
function drawViz(){const w=Math.max(1400, (vizPoints.at(-1)?.t||0)*100+200), h=520; if(vizCanvas.width!==w){vizCanvas.width=w;vizCanvas.height=h} vctx.clearRect(0,0,w,h); vctx.fillStyle='#061326';vctx.fillRect(0,0,w,h); vctx.strokeStyle='rgba(185,211,235,.10)';vctx.lineWidth=1; for(let x=0;x<w;x+=80){vctx.beginPath();vctx.moveTo(x,0);vctx.lineTo(x,h);vctx.stroke()} for(let y=0;y<h;y+=40){vctx.beginPath();vctx.moveTo(0,y);vctx.lineTo(w,y);vctx.stroke()} const minM=48,maxM=84; const yOf=m=>h-40-(m-minM)/(maxM-minM)*(h-80); vctx.lineJoin='round'; vctx.lineCap='round'; for(let i=1;i<vizPoints.length;i++){const a=vizPoints[i-1],b=vizPoints[i]; if(b.t-a.t>.35)continue; vctx.strokeStyle=`rgba(101,200,215,${Math.min(.95,.25+b.rms*8)})`; vctx.lineWidth=2+b.rms*18; vctx.beginPath();vctx.moveTo(a.t*100,yOf(a.midi));vctx.lineTo(b.t*100,yOf(b.midi));vctx.stroke()} if($('vizLabels').checked){vctx.font='13px sans-serif';vctx.fillStyle='#eaf8ff'; for(let i=0;i<vizPoints.length;i+=Math.max(1,Math.floor(vizPoints.length/30))){const p=vizPoints[i]; vctx.fillText(p.note,p.t*100+5,yOf(p.midi)-8)}}}
function drawMelodyCurve(){vizPoints=[]; melodyNotes.sort((a,b)=>a.start-b.start).forEach(n=>vizPoints.push({t:n.start*secPerUnit(),midi:n.midi,rms:.06,note:midiName(n.midi)})); drawViz();}
// Unified playback/save
function playAll(){playRhythm('all',state.playStartCell||0);playMelody(state.playStartCell||0); if($('globalMetroEnabled')?.checked) startMetro();}function stopAll(){stopMetro();clearInterval(state.playTimer); state.activePlayTimers.forEach(clearInterval); state.activePlayTimers=[]; const ph=$('melodyPlayhead'); if(ph)ph.style.display='none'; document.querySelectorAll('[data-track-playhead]').forEach(p=>p.style.display='none');}
function projectData(){return {bpm:state.bpm,timeSig:state.timeSig,rhythmEvents,melodyNotes,rhythmSounds:{track1:$('rhythmSound1')?.value,track2:$('rhythmSound2')?.value,track3:$('rhythmSound3')?.value,track4:$('rhythmSound4')?.value}}};
$('saveProject').onclick=()=>{localStorage.setItem('musicTeachingProject',JSON.stringify(projectData()));toast('作品已保存到本地浏览器。')};
$('loadProject').onclick=()=>{const s=localStorage.getItem('musicTeachingProject'); if(!s)return toast('暂无保存作品'); const d=JSON.parse(s); state.bpm=d.bpm||80; state.timeSig=d.timeSig||'4/4'; rhythmEvents=(d.rhythmEvents||[]).map(ev=>({...ev,track:ev.track||1})); melodyNotes=d.melodyNotes||[]; if(d.rhythmSounds){if($('rhythmSound1'))$('rhythmSound1').value=d.rhythmSounds.track1||'wood'; if($('rhythmSound2'))$('rhythmSound2').value=d.rhythmSounds.track2||'snare'; if($('rhythmSound3'))$('rhythmSound3').value=d.rhythmSounds.track3||'hihat'; if($('rhythmSound4'))$('rhythmSound4').value=d.rhythmSounds.track4||'cowbell';} $('globalBpm').value=state.bpm;$('globalTimeSig').value=state.timeSig;syncGlobal();previewProject();toast('已读取作品')};
$('exportProject').onclick=()=>{const blob=new Blob([JSON.stringify(projectData(),null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='音乐创编作品.json';a.click()};
$('clearProject').onclick=()=>{localStorage.removeItem('musicTeachingProject');toast('已清除本地保存')};function previewProject(){$('projectPreview').textContent=JSON.stringify(projectData(),null,2)};setInterval(()=>{if($('records').classList.contains('active'))previewProject()},1200);

// Notation export: rhythm + melody quantized to sixteenth grid
function durationLabel(units){const u=Math.round(units*100)/100; if(u>=16)return '全音符'; if(u>=8)return '二分音符'; if(u>=4)return '四分音符'; if(u>=2)return '八分音符'; if(u>=1)return '十六分音符'; return '三连/装饰';}
function jianpuDegree(midi){const pc=(midi%12+12)%12; const map={0:'1',2:'2',4:'3',5:'4',7:'5',9:'6',11:'7'}; return map[pc] || ['1','#1','2','#2','3','4','#4','5','#5','6','#6','7'][pc];}
function buildScoreEvents(){const rhythm=[]; rhythmEvents.slice().sort((a,b)=>a.cell-b.cell||(a.track||1)-(b.track||1)).forEach(ev=>{rhythmPattern(ev).forEach(h=>rhythm.push({track:ev.track||1,start:ev.cell+h.off,units:h.len,rest:h.rest,symbol:h.rest?(ev.dotted?'0.':'0'):rhythmEventSymbol(ev),name:ev.dotted?dottedName(ev):ev.name}))}); const melody=melodyNotes.slice().sort((a,b)=>a.start-b.start).map(n=>({start:n.start,units:n.units,midi:n.midi,name:midiName(n.midi),degree:jianpuDegree(n.midi)})); return {rhythm,melody};}
function drawCompositionNotation(){const box=$('compositionNotationBox'), c=$('compositionNotationCanvas'); if(!box||!c) return; box.style.display='block'; const ctx2=c.getContext('2d'); const total=totalUnits(), unit=28, left=76, top=44; c.width=Math.max(1400,left+total*unit+160); c.height=660; ctx2.fillStyle='#fff'; ctx2.fillRect(0,0,c.width,c.height); ctx2.fillStyle='#0b1d34'; ctx2.font='bold 22px Microsoft YaHei, sans-serif'; ctx2.fillText('创编作品谱例（简谱 + 五线谱参考）',24,30); const {unitsPerBar}=parseSig(); for(let u=0;u<=total;u++){const x=left+u*unit; ctx2.strokeStyle=(u%unitsPerBar===0)?'#9aa8b8':'#edf1f5'; ctx2.lineWidth=(u%unitsPerBar===0)?2:1; ctx2.beginPath();ctx2.moveTo(x,50);ctx2.lineTo(x,c.height-40);ctx2.stroke(); if(u%unitsPerBar===0){ctx2.fillStyle='#3b4a5a';ctx2.font='bold 13px sans-serif';ctx2.fillText('小节 '+(u/unitsPerBar+1),x+4,52)}} const score=buildScoreEvents(); ctx2.fillStyle='#0b1d34';ctx2.font='bold 16px sans-serif';ctx2.fillText('简谱',24,92);ctx2.fillText('五线谱',24,290);ctx2.fillText('节奏轨',24,520); score.melody.forEach(n=>{const x=left+n.start*unit;ctx2.fillStyle='#0b1d34';ctx2.font='bold 20px serif';ctx2.fillText(n.degree,x,98);ctx2.font='11px sans-serif';ctx2.fillStyle='#5b6b7d';ctx2.fillText(durationLabel(n.units),x-4,116);}); const staffY=230; ctx2.strokeStyle='#1f2937';ctx2.lineWidth=1; for(let i=0;i<5;i++){ctx2.beginPath();ctx2.moveTo(left,staffY+i*12);ctx2.lineTo(c.width-55,staffY+i*12);ctx2.stroke();} ctx2.fillStyle='#0b1d34'; ctx2.font='32px serif'; ctx2.fillText('𝄞',32,staffY+42); const yOfMidi=m=>staffY+48-(m-60)*3.5; score.melody.forEach(n=>{const x=left+n.start*unit+6,y=yOfMidi(n.midi);ctx2.fillStyle='#0b6d7f';ctx2.beginPath();ctx2.ellipse(x,y,8,6,-.25,0,Math.PI*2);ctx2.fill();ctx2.strokeStyle='#0b6d7f';ctx2.beginPath();ctx2.moveTo(x+7,y);ctx2.lineTo(x+7,y-36);ctx2.stroke();ctx2.fillStyle='#253244';ctx2.font='11px sans-serif';ctx2.fillText(n.name,x-10,y+22);ctx2.fillText(durationLabel(n.units),x-16,y+36);}); [1,2,3,4].forEach((tr,i)=>{const y=360+i*58; ctx2.fillStyle='#253244';ctx2.font='bold 14px sans-serif';ctx2.fillText('轨道 '+tr,24,y+10);ctx2.strokeStyle='#e3e8ef';ctx2.beginPath();ctx2.moveTo(left,y+12);ctx2.lineTo(c.width-55,y+12);ctx2.stroke(); score.rhythm.filter(r=>r.track===tr).forEach(r=>{const x=left+r.start*unit; ctx2.fillStyle=r.rest?'#7c8794':'#0b6d7f';ctx2.font='bold 22px serif';ctx2.fillText(r.rest?'0':r.symbol,x,y+6); ctx2.font='10px sans-serif';ctx2.fillText(durationLabel(r.units),x-2,y+24);});}); return c;}
function exportCompositionNotation(){const c=drawCompositionNotation(); if(!c)return; const a=document.createElement('a'); a.download='创编作品谱例.png'; a.href=c.toDataURL('image/png'); a.click();}
$('generateCompositionNotation')?.addEventListener('click',drawCompositionNotation);$('exportCompositionNotation')?.addEventListener('click',exportCompositionNotation);$('melodyToNotation')?.addEventListener('click',()=>{switchPage('rhythm'); setTimeout(drawCompositionNotation,80)});



/* ===== V3.9 功能覆盖：统一小节数、每拍标尺、可拖动音符时值 ===== */
function getGlobalBars(){
  const v=Number($('globalBars')?.value || state.bars || 16);
  return Math.max(1, Math.min(128, Math.round(v)));
}
function totalUnits(){
  const {unitsPerBar}=parseSig();
  state.bars=getGlobalBars();
  const rMax=(typeof rhythmEvents!=='undefined'&&rhythmEvents.length)?Math.max(...rhythmEvents.map(e=>e.cell+Number(e.units||1)),0):0;
  const mMax=(typeof melodyNotes!=='undefined'&&melodyNotes.length)?Math.max(...melodyNotes.map(n=>n.start+Number(n.units||1)),0):0;
  return Math.max(unitsPerBar*state.bars, rMax+unitsPerBar, mMax+unitsPerBar, (state.playStartCell||0)+unitsPerBar*2);
}
function syncGlobal(){
  state.bpm=Number($('globalBpm').value);
  $('globalBpmRange').value=state.bpm;
  state.timeSig=$('globalTimeSig').value;
  state.bars=getGlobalBars();
  if($('melodyBarsHint')) $('melodyBarsHint').textContent='当前生成 '+state.bars+' 小节，可在顶部调整';
  renderRhythm(); renderPianoRoll(); renderBeatDots();
}
$('globalBars')?.addEventListener('input', syncGlobal);
function setPlayStartCell(cell){
  state.playStartCell=Math.max(0,Math.round(cell));
  const {unitsPerBar}=parseSig();
  const bar=Math.floor(state.playStartCell/unitsPerBar)+1;
  const pos=state.playStartCell%unitsPerBar+1;
  if($('playStartReadout')) $('playStartReadout').textContent='小节 '+bar+' · 第 '+pos+' 格';
  renderRhythm(); renderPianoRoll();
}
function renderRhythm(){
  const {unitsPerBar}=parseSig(); const total=totalUnits(); const unitW=24; const editor=$('rhythmEditor'); if(!editor) return;
  editor.innerHTML=''; editor.style.setProperty('--unit-w',unitW+'px'); editor.style.setProperty('--units-bar',unitsPerBar); editor.style.setProperty('--total-units',total);
  const scroller=document.createElement('div'); scroller.className='rhythm-timeline-scroller';
  const timeline=document.createElement('div'); timeline.className='rhythm-timeline-inner'; timeline.style.width=(total*unitW+92)+'px';
  const bars=Math.ceil(total/unitsPerBar);
  const labels=document.createElement('div'); labels.className='bar-labels rhythm-bar-ruler'; labels.style.gridTemplateColumns=`92px repeat(${bars}, ${unitsPerBar*unitW}px)`;
  labels.innerHTML='<span class="track-ruler-title">轨道</span>'+Array.from({length:bars},(_,i)=>`<span>小节 ${i+1}</span>`).join(''); timeline.appendChild(labels);
  [1,2,3,4].forEach(trackNo=>{
    const track=document.createElement('div'); track.className='track rhythm-one-track rhythm-dual-track';
    const name=document.createElement('div'); name.className='track-name'; name.innerHTML='轨道 '+trackNo;
    const grid=document.createElement('div'); grid.className='gridline'; grid.style.width=total*unitW+'px'; grid.style.height='66px'; grid.style.position='relative';
    grid.addEventListener('click',e=>{if(e.target!==grid)return; const rect=grid.getBoundingClientRect(); setPlayStartCell(Math.floor((e.clientX-rect.left+grid.scrollLeft)/unitW));});
    const catcher=document.createElement('div'); catcher.className='cell-catcher';
    for(let i=0;i<total;i++){
      const cell=document.createElement('div'); cell.className='drop-cell'; cell.dataset.cell=i; cell.dataset.track=trackNo;
      cell.addEventListener('click',()=>setPlayStartCell(i));
      cell.addEventListener('dragover',e=>{e.preventDefault(); cell.classList.add('drop-over')});
      cell.addEventListener('dragleave',()=>cell.classList.remove('drop-over'));
      cell.addEventListener('drop',e=>{cell.classList.remove('drop-over');dropRhythm(e,i,trackNo)});
      catcher.appendChild(cell);
    }
    grid.appendChild(catcher);
    const startLine=document.createElement('div'); startLine.className='track-start-line'; startLine.style.left=(state.playStartCell*unitW)+'px'; grid.appendChild(startLine);
    rhythmEvents.filter(ev=>(ev.track||1)===trackNo).forEach(ev=>{
      const idx=rhythmEvents.indexOf(ev); const el=document.createElement('div'); el.className='event '+(ev.type==='rest'?'rest':'');
      el.style.left=ev.cell*unitW+'px'; el.style.width=Math.max(30,ev.units*unitW-4)+'px'; el.dataset.idx=idx; el.title=ev.name+'｜双击删除';
      el.innerHTML='<b>'+rhythmSymbol(ev.name,ev.type)+'</b>';
      if(idx===state.selectedRhythm)el.classList.add('selected');
      el.onclick=()=>{state.selectedRhythm=idx;renderRhythm()};
      el.ondblclick=()=>{rhythmEvents.splice(idx,1);state.selectedRhythm=null;renderRhythm()};
      grid.appendChild(el);
    });
    const ph=document.createElement('div'); ph.className='track-playhead'; ph.dataset.trackPlayhead=trackNo; ph.style.display='none'; grid.appendChild(ph);
    track.appendChild(name); track.appendChild(grid); timeline.appendChild(track);
  });
  scroller.appendChild(timeline); editor.appendChild(scroller);
}
let noteEdit=null;
function renderPianoRoll(){
  const keys=$('pianoKeys'), roll=$('pianoRoll'), ruler=$('pianoRuler'); if(!keys||!roll) return;
  keys.innerHTML=''; roll.innerHTML=''; if(ruler) ruler.innerHTML='';
  const {unitsPerBar,top,bottom}=parseSig(); const unitW=24,rowH=24,total=totalUnits(); const beatUnits=16/bottom;
  roll.style.setProperty('--unit-w',unitW+'px'); roll.style.setProperty('--units-bar',unitsPerBar);
  roll.style.width=total*unitW+'px'; roll.style.height=noteRange.length*rowH+'px'; keys.style.height=roll.style.height;
  if(ruler){
    ruler.style.width=total*unitW+'px'; const bars=Math.ceil(total/unitsPerBar);
    for(let i=0;i<bars;i++){
      const rb=document.createElement('div'); rb.className='ruler-bar'; rb.style.left=(i*unitsPerBar*unitW)+'px'; rb.style.width=(unitsPerBar*unitW)+'px'; rb.textContent=i+1; rb.onclick=()=>setPlayStartCell(i*unitsPerBar); ruler.appendChild(rb);
      for(let b=0;b<top;b++){
        const x=(i*unitsPerBar + b*beatUnits)*unitW; if(x>=total*unitW) continue;
        const bt=document.createElement('div'); bt.className='ruler-beat '+(b===0?'strong':''); bt.style.left=x+'px'; bt.style.width=(beatUnits*unitW)+'px'; bt.textContent=b+1; bt.onclick=()=>setPlayStartCell(i*unitsPerBar+b*beatUnits); ruler.appendChild(bt);
      }
    }
  }
  const rollWrapForRuler = document.querySelector('.cubase-roll-v38');
  if (ruler && rollWrapForRuler) {
    const syncRuler = () => { Array.from(ruler.children).forEach(ch => { ch.style.transform = 'translateX(' + (-rollWrapForRuler.scrollLeft) + 'px)'; }); };
    rollWrapForRuler.onscroll = syncRuler;
    syncRuler();
  }
  noteRange.forEach((m,i)=>{const k=document.createElement('div');k.className='piano-key '+([1,3,6,8,10].includes(m%12)?'black ':'')+(allowedPitch(m)?'allowed':'');k.innerHTML=`<span>${midiName(m)}</span>`;keys.appendChild(k)});
  const catcher=document.createElement('div'); catcher.style.position='absolute'; catcher.style.inset='0'; catcher.style.cursor='crosshair'; catcher.addEventListener('click',addNoteFromClick); catcher.addEventListener('contextmenu',e=>{e.preventDefault(); const rect=e.currentTarget.getBoundingClientRect(); const sc=e.currentTarget.parentElement; setPlayStartCell(Math.floor((e.clientX-rect.left+sc.scrollLeft)/24));}); roll.appendChild(catcher);
  melodyNotes.forEach((n,idx)=>{
    const row=noteRange.indexOf(n.midi); if(row<0)return; const el=document.createElement('div'); el.className='note-block'; el.dataset.idx=idx;
    el.style.left=n.start*unitW+'px'; el.style.top=row*rowH+4+'px'; el.style.width=Math.max(18,n.units*unitW-4)+'px'; el.style.height=rowH-8+'px';
    el.innerHTML='<span class="note-text">'+midiName(n.midi)+'</span><span class="note-resize-handle" title="拖动改变时值"></span>';
    if(idx===state.selectedNote)el.classList.add('selected'); el.onmousedown=startNoteEdit; el.ondblclick=()=>{melodyNotes.splice(idx,1);renderPianoRoll()}; roll.appendChild(el);
  });
  const ph=document.createElement('div'); ph.id='melodyPlayhead'; ph.className='playhead'; ph.style.display='none'; roll.appendChild(ph);
}
function addNoteFromClick(e){
  if(e.target!==e.currentTarget)return; const rect=e.currentTarget.getBoundingClientRect(); const sc=e.currentTarget.parentElement;
  const x=e.clientX-rect.left+sc.scrollLeft; const y=e.clientY-rect.top+sc.scrollTop; const cell=Math.floor(x/24); const row=Math.floor(y/24); const midi=noteRange[row]; if(midi==null)return;
  const units=Number($('noteDuration').value); if(!allowedPitch(midi)){toast('当前音阶模式屏蔽了这个音。');return;} melodyNotes.push({start:cell,midi,units}); renderPianoRoll();
}
function startNoteEdit(e){
  const el=e.currentTarget, idx=Number(el.dataset.idx); state.selectedNote=idx; const n=melodyNotes[idx];
  const rect=el.getBoundingClientRect(); const isResize=e.target.classList.contains('note-resize-handle') || (e.clientX > rect.right-10);
  noteEdit={idx,mode:isResize?'resize':'move',dx:e.offsetX,dy:e.offsetY,originUnits:n.units,originStart:n.start,mouseX:e.clientX};
  document.onmousemove=editNoteMove; document.onmouseup=()=>{noteEdit=null;document.onmousemove=null;document.onmouseup=null}; e.preventDefault(); e.stopPropagation();
}
function editNoteMove(e){
  if(!noteEdit)return; const roll=$('pianoRoll'); const sc=roll.parentElement; const rect=roll.getBoundingClientRect(); const unitW=24,rowH=24;
  const n=melodyNotes[noteEdit.idx]; if(!n)return;
  if(noteEdit.mode==='resize'){
    const delta=Math.round((e.clientX-noteEdit.mouseX)/unitW); n.units=Math.max(1,noteEdit.originUnits+delta); renderPianoRoll(); return;
  }
  const x=e.clientX-rect.left+sc.scrollLeft-noteEdit.dx; const y=e.clientY-rect.top+sc.scrollTop-noteEdit.dy; const cell=Math.max(0,Math.round(x/unitW)); const row=Math.max(0,Math.min(noteRange.length-1,Math.round(y/rowH))); const midi=noteRange[row];
  if(allowedPitch(midi)){n.start=cell;n.midi=midi;renderPianoRoll();}
}
function startDragNote(e){startNoteEdit(e)}
function dragNote(e){editNoteMove(e)}

// Init
fillSoundSelects();renderLibrary();renderBeatDots();syncGlobal();
setTimeout(()=>{renderRhythm();renderPianoRoll();drawViz();}, 60);


/* ===== V4.1 交互修复覆盖 ===== */
(function(){
  const UNIT_W = 24;
  const getRhythmScroller = () => document.querySelector('#rhythmEditor .rhythm-timeline-scroller');
  const getRollScroller = () => document.querySelector('.cubase-roll-v38');
  window.getGlobalBars = function(){
    const v = Math.max(1, Math.min(35, Number($('globalBars')?.value || state.bars || 35)));
    state.bars = v; return v;
  };
  window.totalUnits = function(){
    const {unitsPerBar}=parseSig();
    const rMax=(typeof rhythmEvents!=='undefined'&&rhythmEvents.length)?Math.max(...rhythmEvents.map(e=>e.cell+Number(e.units||1)),0):0;
    const mMax=(typeof melodyNotes!=='undefined'&&melodyNotes.length)?Math.max(...melodyNotes.map(n=>n.start+Number(n.units||1)),0):0;
    return Math.max(unitsPerBar*getGlobalBars(), rMax+unitsPerBar, mMax+unitsPerBar, (state.playStartCell||0)+unitsPerBar*2);
  };
  function updatePlayStartReadout(){
    const {unitsPerBar}=parseSig();
    const bar=Math.floor(state.playStartCell/unitsPerBar)+1;
    const pos=(state.playStartCell%unitsPerBar)+1;
    if($('playStartReadout')) $('playStartReadout').textContent='小节 '+bar+' · 第 '+pos+' 格';
  }
  function updateStartLines(){
    const left=(state.playStartCell||0)*UNIT_W+'px';
    document.querySelectorAll('.track-start-line').forEach(el=>el.style.left=left);
    const ph=$('melodyPlayhead'); if(ph && ph.style.display==='none') ph.style.left=left;
    updatePlayStartReadout();
  }
  window.setPlayStartCell = function(cell){
    state.playStartCell=Math.max(0,Math.round(cell));
    updateStartLines();
  };
  const oldRenderRhythm = window.renderRhythm || renderRhythm;
  window.renderRhythm = renderRhythm = function(){
    const oldScroll = getRhythmScroller()?.scrollLeft || 0;
    const {unitsPerBar}=parseSig(); const total=totalUnits(); const unitW=UNIT_W; const editor=$('rhythmEditor'); if(!editor) return;
    editor.innerHTML=''; editor.style.setProperty('--unit-w',unitW+'px'); editor.style.setProperty('--units-bar',unitsPerBar); editor.style.setProperty('--total-units',total);
    const scroller=document.createElement('div'); scroller.className='rhythm-timeline-scroller';
    const timeline=document.createElement('div'); timeline.className='rhythm-timeline-inner'; timeline.style.width=(total*unitW+92)+'px';
    const bars=Math.ceil(total/unitsPerBar);
    const labels=document.createElement('div'); labels.className='bar-labels rhythm-bar-ruler'; labels.style.display='grid'; labels.style.gridTemplateColumns=`92px repeat(${bars}, ${unitsPerBar*unitW}px)`;
    labels.innerHTML='<span class="track-ruler-title">轨道</span>'+Array.from({length:bars},(_,i)=>`<span>小节 ${i+1}</span>`).join(''); timeline.appendChild(labels);
    [1,2,3,4].forEach(trackNo=>{
      const track=document.createElement('div'); track.className='track rhythm-one-track rhythm-dual-track';
      const name=document.createElement('div'); name.className='track-name'; name.textContent='轨道 '+trackNo;
      const grid=document.createElement('div'); grid.className='gridline'; grid.style.width=total*unitW+'px'; grid.style.height='72px'; grid.style.position='relative';
      const catcher=document.createElement('div'); catcher.className='cell-catcher';
      for(let i=0;i<total;i++){
        const cell=document.createElement('div'); cell.className='drop-cell'; cell.dataset.cell=i; cell.dataset.track=trackNo;
        cell.addEventListener('click',()=>setPlayStartCell(i));
        cell.addEventListener('dragover',e=>{e.preventDefault(); cell.classList.add('drop-over')});
        cell.addEventListener('dragleave',()=>cell.classList.remove('drop-over'));
        cell.addEventListener('drop',e=>{e.preventDefault(); cell.classList.remove('drop-over'); const keep=getRhythmScroller()?.scrollLeft || oldScroll; dropRhythm(e,i,trackNo); setTimeout(()=>{const s=getRhythmScroller(); if(s) s.scrollLeft=keep;},0);});
        catcher.appendChild(cell);
      }
      grid.appendChild(catcher);
      const startLine=document.createElement('div'); startLine.className='track-start-line'; startLine.style.left=(state.playStartCell*unitW)+'px'; grid.appendChild(startLine);
      rhythmEvents.filter(ev=>(ev.track||1)===trackNo).forEach(ev=>{
        const idx=rhythmEvents.indexOf(ev); const el=document.createElement('div'); el.className='event '+(ev.type==='rest'?'rest':'');
        el.style.left=ev.cell*unitW+'px'; el.style.width=Math.max(30,Number(ev.units||1)*unitW-4)+'px'; el.dataset.idx=idx; el.title=ev.name+'｜双击删除';
        el.innerHTML='<b>'+rhythmSymbol(ev.name,ev.type)+'</b>';
        if(idx===state.selectedRhythm) el.classList.add('selected');
        el.onclick=()=>{state.selectedRhythm=idx; document.querySelectorAll('#rhythmEditor .event').forEach(x=>x.classList.remove('selected')); el.classList.add('selected');};
        el.ondblclick=()=>{rhythmEvents.splice(idx,1);state.selectedRhythm=null;renderRhythm();};
        grid.appendChild(el);
      });
      const ph=document.createElement('div'); ph.className='track-playhead'; ph.dataset.trackPlayhead=trackNo; ph.style.display='none'; grid.appendChild(ph);
      track.appendChild(name); track.appendChild(grid); timeline.appendChild(track);
    });
    scroller.appendChild(timeline); editor.appendChild(scroller);
    scroller.scrollLeft = oldScroll;
    updateStartLines();
  };
  const oldRenderPianoRoll = window.renderPianoRoll || renderPianoRoll;
  window.renderPianoRoll = renderPianoRoll = function(){
    const oldScroll = getRollScroller()?.scrollLeft || 0;
    const keys=$('pianoKeys'), roll=$('pianoRoll'), ruler=$('pianoRuler'); if(!keys||!roll) return;
    keys.innerHTML=''; roll.innerHTML=''; if(ruler) ruler.innerHTML='';
    const {unitsPerBar,top,bottom}=parseSig(); const unitW=UNIT_W,rowH=24,total=totalUnits(); const beatUnits=16/bottom;
    roll.style.setProperty('--unit-w',unitW+'px'); roll.style.setProperty('--units-bar',unitsPerBar);
    roll.style.width=total*unitW+'px'; roll.style.height=noteRange.length*rowH+'px'; keys.style.height=roll.style.height;
    if(ruler){
      ruler.style.width=total*unitW+'px'; const bars=Math.ceil(total/unitsPerBar);
      for(let i=0;i<bars;i++){
        const rb=document.createElement('div'); rb.className='ruler-bar'; rb.style.left=(i*unitsPerBar*unitW)+'px'; rb.style.width=(unitsPerBar*unitW)+'px'; rb.textContent=i+1; rb.onclick=()=>setPlayStartCell(i*unitsPerBar); ruler.appendChild(rb);
        for(let b=0;b<top;b++){ const x=(i*unitsPerBar + b*beatUnits)*unitW; if(x>=total*unitW) continue; const bt=document.createElement('div'); bt.className='ruler-beat '+(b===0?'strong':''); bt.style.left=x+'px'; bt.style.width=(beatUnits*unitW)+'px'; bt.textContent=b+1; bt.onclick=(ev)=>{ev.stopPropagation(); setPlayStartCell(i*unitsPerBar+b*beatUnits);}; ruler.appendChild(bt); }
      }
    }
    const rollWrapForRuler = getRollScroller();
    if (ruler && rollWrapForRuler) { const syncRuler = () => { ruler.style.transform = 'translateX(' + (-rollWrapForRuler.scrollLeft) + 'px)'; }; rollWrapForRuler.onscroll = syncRuler; syncRuler(); }
    noteRange.forEach((m)=>{const k=document.createElement('div');k.className='piano-key '+([1,3,6,8,10].includes(m%12)?'black ':'')+(allowedPitch(m)?'allowed':'');k.innerHTML=`<span>${midiName(m)}</span>`;keys.appendChild(k)});
    const catcher=document.createElement('div'); catcher.style.position='absolute'; catcher.style.inset='0'; catcher.style.cursor='crosshair'; catcher.addEventListener('click',addNoteFromClick); catcher.addEventListener('contextmenu',e=>{e.preventDefault(); const rect=e.currentTarget.getBoundingClientRect(); const sc=e.currentTarget.parentElement; setPlayStartCell(Math.floor((e.clientX-rect.left+sc.scrollLeft)/UNIT_W));}); roll.appendChild(catcher);
    melodyNotes.forEach((n,idx)=>{ const row=noteRange.indexOf(n.midi); if(row<0)return; const el=document.createElement('div'); el.className='note-block'; el.dataset.idx=idx; el.style.left=n.start*unitW+'px'; el.style.top=row*rowH+4+'px'; el.style.width=Math.max(18,Number(n.units||1)*unitW-4)+'px'; el.style.height=rowH-8+'px'; el.innerHTML='<span class="note-text">'+midiName(n.midi)+'</span><span class="note-resize-handle" title="拖动改变时值"></span>'; if(idx===state.selectedNote)el.classList.add('selected'); el.onmousedown=startNoteEdit; el.ondblclick=()=>{melodyNotes.splice(idx,1);renderPianoRoll()}; roll.appendChild(el); });
    const ph=document.createElement('div'); ph.id='melodyPlayhead'; ph.className='playhead'; ph.style.display='none'; ph.style.left=(state.playStartCell*unitW)+'px'; roll.appendChild(ph);
    if(rollWrapForRuler) rollWrapForRuler.scrollLeft=oldScroll;
  };
  function clearTimers(list){(list||[]).forEach(t=>clearTimeout(t));}
  function resetRhythmButtons(){['playRhythm','playRhythmTrack1','playRhythmTrack2','playRhythmTrack3','playRhythmTrack4'].forEach(id=>{const b=$(id); if(!b)return; b.classList.remove('is-playing'); b.textContent = id==='playRhythm'?'▶ 同时试听':'▶ 轨道 '+id.replace('playRhythmTrack','');});}
  function stopRhythmPlayback(){ clearTimers(state.rhythmTimeouts); state.rhythmTimeouts=[]; clearInterval(state.rhythmInterval); state.rhythmInterval=null; document.querySelectorAll('[data-track-playhead]').forEach(p=>p.style.display='none'); resetRhythmButtons(); state.rhythmPlaying=null; }
  function animateRhythm(startCell){ const unitW=UNIT_W,total=totalUnits(),dur=Math.max(1,(total-startCell)*secPerUnit()*1000),start=performance.now(); document.querySelectorAll('[data-track-playhead]').forEach(ph=>{ph.style.display='block';ph.style.left=(startCell*unitW)+'px';}); clearInterval(state.rhythmInterval); state.rhythmInterval=setInterval(()=>{const p=(performance.now()-start)/dur; const cell=startCell+Math.min(1,p)*(total-startCell); document.querySelectorAll('[data-track-playhead]').forEach(ph=>ph.style.left=(cell*unitW)+'px'); if(p>=1) stopRhythmPlayback();},30); }
  window.playRhythm = playRhythm = function(track='all',startCell=state.playStartCell||0){ if(state.rhythmPlaying===track){stopRhythmPlayback(); return;} stopRhythmPlayback(); const btn=$(track==='all'?'playRhythm':'playRhythmTrack'+track); if(btn){btn.classList.add('is-playing'); btn.textContent='Ⅱ 暂停';} state.rhythmPlaying=track; state.rhythmTimeouts=[]; const events=rhythmEvents.filter(ev=>(track==='all'||(ev.track||1)===track)&&(ev.cell+Number(ev.units||1))>startCell); events.forEach(ev=>{const sound=$('rhythmSound'+(ev.track||1))?.value||'wood'; rhythmPattern(ev).forEach((hit,i)=>{if(hit.rest)return; const delay=Math.max(0,(ev.cell-startCell+hit.off)*secPerUnit()*1000); const tid=setTimeout(()=>playRhythmHit(ctx().currentTime+0.006,Math.max(.06,hit.len*secPerUnit()),sound,i===0),delay); state.rhythmTimeouts.push(tid);});}); animateRhythm(startCell); };
  ['playRhythm','playRhythmTrack1','playRhythmTrack2','playRhythmTrack3','playRhythmTrack4'].forEach((id,idx)=>{const b=$(id); if(b)b.onclick=()=>playRhythm(idx===0?'all':idx);});
  function resetMelodyButton(){const b=$('playMelody'); if(b){b.classList.remove('is-playing'); b.textContent='▶ 试听旋律';}}
  function stopMelodyPlayback(){clearTimers(state.melodyTimeouts); state.melodyTimeouts=[]; clearInterval(state.playTimer); state.playTimer=null; const ph=$('melodyPlayhead'); if(ph) ph.style.display='none'; state.melodyPlaying=false; resetMelodyButton();}
  function animateMelody(startCell){const ph=$('melodyPlayhead'); if(!ph)return; ph.style.display='block'; const start=performance.now(), dur=Math.max(1,(totalUnits()-startCell)*secPerUnit()*1000), w=UNIT_W; clearInterval(state.playTimer); state.playTimer=setInterval(()=>{const p=(performance.now()-start)/dur; const cell=startCell+Math.min(1,p)*(totalUnits()-startCell); ph.style.left=(cell*w)+'px'; if(p>=1) stopMelodyPlayback();},30);}
  window.playMelody = playMelody = function(startCell=state.playStartCell||0){ if(state.melodyPlaying){stopMelodyPlayback(); return;} state.melodyPlaying=true; const b=$('playMelody'); if(b){b.classList.add('is-playing'); b.textContent='Ⅱ 暂停';} state.melodyTimeouts=[]; const timbre=$('melodyTimbre')?.value||'grandPiano'; melodyNotes.filter(n=>n.start+n.units>startCell).forEach(n=>{const delay=Math.max(0,(n.start-startCell)*secPerUnit()*1000); const tid=setTimeout(()=>playTone(n.midi,ctx().currentTime+0.006,Number(n.units||1)*secPerUnit()*0.92,timbre),delay); state.melodyTimeouts.push(tid);}); animateMelody(startCell); drawMelodyCurve(); };
  if($('playMelody')) $('playMelody').onclick=()=>playMelody(state.playStartCell||0);
  window.stopAll = stopAll = function(){ stopMetro(); stopRhythmPlayback(); stopMelodyPlayback(); state.globalPlaying=false; const g=$('globalPlay'); if(g){g.classList.remove('is-playing'); g.textContent='▶ 播放';} };
  window.playAll = playAll = function(){ if(state.globalPlaying){stopAll(); return;} state.globalPlaying=true; const g=$('globalPlay'); if(g){g.classList.add('is-playing'); g.textContent='Ⅱ 暂停';} playRhythm('all',state.playStartCell||0); playMelody(state.playStartCell||0); if($('globalMetroEnabled')?.checked) startMetro(); };
  if($('globalPlay')) $('globalPlay').onclick=()=>playAll(); if($('globalStop')) $('globalStop').onclick=()=>stopAll();
  function fullCurrent(){ const active=document.querySelector('.page.active'); if(!active) return; const iframe=active.querySelector('iframe'); (iframe||active).requestFullscreen?.(); }
  if($('fullscreenCurrent')) $('fullscreenCurrent').onclick=fullCurrent;
  // 重新绑定全局设置，防止旧监听只重绘一次且滚动回开头
  function applyGlobal(){ state.bpm=Number($('globalBpm')?.value||80); if($('globalBpmRange'))$('globalBpmRange').value=state.bpm; state.timeSig=$('globalTimeSig')?.value||'4/4'; state.bars=getGlobalBars(); renderRhythm(); renderPianoRoll(); renderBeatDots(); updateStartLines(); }
  ['globalBpm','globalBpmRange','globalTimeSig','globalBars'].forEach(id=>{const el=$(id); if(el) el.addEventListener('input',()=>{ if(id==='globalBpmRange'&&$('globalBpm')) $('globalBpm').value=el.value; applyGlobal();}); if(el) el.addEventListener('change',applyGlobal);});
  // 首次渲染与页面切换后的兜底渲染，解决必须点重置才显示的问题
  function ensureRenders(){ if($('rhythm')) renderRhythm(); if($('melody')) renderPianoRoll(); updateStartLines(); }
  window.addEventListener('load',()=>{ state.bars=getGlobalBars(); setTimeout(ensureRenders,80); setTimeout(ensureRenders,350); });
  document.querySelectorAll('#nav button[data-page]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(ensureRenders,80)));
  setTimeout(ensureRenders,100);
})();


try{renderBeatDots();}catch(e){}

;

/* ===== V4.2 最终修复层：覆盖旧播放与渲染逻辑 ===== */
(function(){
  function q(id){return document.getElementById(id)}
  function cloneBtn(id){const el=q(id); if(!el) return null; const n=el.cloneNode(true); el.parentNode.replaceChild(n,el); return n;}
  function getBars(){const v=Math.max(1,Math.min(35,Number(q('globalBars')?.value||35))); if(q('globalBars')) q('globalBars').value=v; if(typeof state!=='undefined') state.bars=v; return v;}
  window.getGlobalBars=getBars;
  window.totalUnits=function(){const {unitsPerBar}=parseSig(); const base=getBars()*unitsPerBar; const rMax=(typeof rhythmEvents!=='undefined'&&rhythmEvents.length)?Math.max(...rhythmEvents.map(e=>e.cell+Number(e.units||1)),0):0; const mMax=(typeof melodyNotes!=='undefined'&&melodyNotes.length)?Math.max(...melodyNotes.map(n=>n.start+Number(n.units||1)),0):0; return Math.max(base,rMax+unitsPerBar,mMax+unitsPerBar,(state.playStartCell||0)+unitsPerBar);};
  function saveRhythmScroll(){const s=document.querySelector('#rhythmEditor .rhythm-timeline-scroller'); return s?{x:s.scrollLeft,y:s.scrollTop}:null;}
  function restoreRhythmScroll(pos){const s=document.querySelector('#rhythmEditor .rhythm-timeline-scroller'); if(s&&pos){s.scrollLeft=pos.x;s.scrollTop=pos.y;}}
  window.setPlayStartCell=function(cell){state.playStartCell=Math.max(0,Math.round(cell)); const {unitsPerBar}=parseSig(); const bar=Math.floor(state.playStartCell/unitsPerBar)+1; const pos=state.playStartCell%unitsPerBar+1; if(q('playStartReadout')) q('playStartReadout').textContent='小节 '+bar+' · 第 '+pos+' 格'; updateStartLines();};
  window.updateStartLines=function(){document.querySelectorAll('.rhythm-v42-start-line,.track-start-line').forEach(l=>l.style.left=(state.playStartCell*24)+'px'); const mp=q('melodyPlayhead'); if(mp) mp.style.left=(state.playStartCell*24)+'px';};
  window.renderRhythm=function(preserveScroll=true){
    const old=preserveScroll?saveRhythmScroll():null;
    const {unitsPerBar}=parseSig(); const bars=getBars(); const total=totalUnits(); const unitW=24; const editor=q('rhythmEditor'); if(!editor) return;
    editor.innerHTML=''; editor.style.setProperty('--unit-w',unitW+'px'); editor.style.setProperty('--units-bar',unitsPerBar); editor.style.setProperty('--total-units',total);
    const scroller=document.createElement('div'); scroller.className='rhythm-timeline-scroller';
    const timeline=document.createElement('div'); timeline.className='rhythm-timeline-inner'; timeline.style.width=(86+total*unitW)+'px';
    const ruler=document.createElement('div'); ruler.className='rhythm-v42-ruler'; ruler.style.gridTemplateColumns='86px repeat('+bars+', '+(unitsPerBar*unitW)+'px)';
    ruler.innerHTML='<span class="track-ruler-title">轨道</span>'+Array.from({length:bars},(_,i)=>'<span>小节 '+(i+1)+'</span>').join(''); timeline.appendChild(ruler);
    [1,2,3,4].forEach(trackNo=>{
      const track=document.createElement('div'); track.className='rhythm-v42-track';
      const name=document.createElement('div'); name.className='rhythm-v42-track-name'; name.textContent='轨道 '+trackNo;
      const grid=document.createElement('div'); grid.className='rhythm-v42-grid'; grid.style.width=(total*unitW)+'px'; grid.style.setProperty('--unit-w',unitW+'px'); grid.style.setProperty('--units-bar',unitsPerBar); grid.style.setProperty('--total-units',total);
      const catcher=document.createElement('div'); catcher.className='rhythm-v42-catcher';
      for(let i=0;i<total;i++){const cell=document.createElement('div'); cell.className='rhythm-v42-cell'; cell.dataset.cell=i; cell.dataset.track=trackNo;
        cell.addEventListener('click',()=>setPlayStartCell(i)); cell.addEventListener('dragover',e=>{e.preventDefault(); cell.classList.add('drop-over')}); cell.addEventListener('dragleave',()=>cell.classList.remove('drop-over'));
        cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('drop-over'); window.dropRhythm(e,i,trackNo);}); catcher.appendChild(cell)}
      grid.appendChild(catcher);
      const startLine=document.createElement('div'); startLine.className='rhythm-v42-start-line'; startLine.style.left=(state.playStartCell*unitW)+'px'; grid.appendChild(startLine);
      rhythmEvents.filter(ev=>(ev.track||1)===trackNo).forEach(ev=>{const idx=rhythmEvents.indexOf(ev); const el=document.createElement('div'); el.className='rhythm-v42-event '+(ev.type==='rest'?'rest':''); el.style.left=(ev.cell*unitW)+'px'; el.style.width=Math.max(30,ev.units*unitW-4)+'px'; el.title=(ev.name||'节奏')+'｜双击删除'; el.innerHTML='<b>'+rhythmSymbol(ev.name,ev.type)+'</b>'; if(idx===state.selectedRhythm) el.classList.add('selected'); el.onclick=(event)=>{event.stopPropagation(); state.selectedRhythm=idx; renderRhythm(true)}; el.ondblclick=(event)=>{event.stopPropagation(); rhythmEvents.splice(idx,1); state.selectedRhythm=null; renderRhythm(true)}; grid.appendChild(el);});
      const ph=document.createElement('div'); ph.className='rhythm-v42-playhead'; ph.dataset.trackPlayhead=trackNo; grid.appendChild(ph);
      track.appendChild(name); track.appendChild(grid); timeline.appendChild(track);
    });
    scroller.appendChild(timeline); editor.appendChild(scroller); restoreRhythmScroll(old);
  };
  window.dropRhythm=function(e,cell,track=1){let ev; try{ev=JSON.parse(e.dataTransfer.getData('text/plain'));}catch(err){return} const pos=saveRhythmScroll(); rhythmEvents.push({cell,track,name:ev.name,units:Number(ev.units),type:ev.type}); renderRhythm(true); restoreRhythmScroll(pos);};

  // 旋律卷帘渲染：小节和每拍标尺随横向滚动同步
  window.renderPianoRoll=function(){
    const keys=q('pianoKeys'), roll=q('pianoRoll'), ruler=q('pianoRuler'); if(!keys||!roll) return;
    keys.innerHTML=''; roll.innerHTML=''; if(ruler) ruler.innerHTML='';
    const {unitsPerBar,top,bottom}=parseSig(); const unitW=24,rowH=24,total=totalUnits();
    const wrap=document.querySelector('.cubase-roll-wrap'); document.querySelector('.cubase-arrange-shell')?.classList.add('cubase-v42-shell');
    roll.style.setProperty('--unit-w',unitW+'px'); roll.style.setProperty('--units-bar',unitsPerBar); roll.style.width=(total*unitW)+'px'; roll.style.height=(noteRange.length*rowH)+'px'; keys.style.height=roll.style.height;
    if(ruler){const inner=document.createElement('div'); inner.className='piano-ruler-inner'; inner.style.width=(total*unitW)+'px'; const bars=getBars(); const beatUnits=16/bottom; for(let b=0;b<bars;b++){for(let beat=0;beat<top;beat++){const lab=document.createElement('div'); lab.className='piano-beat-label '+(beat===0?'bar-start':''); lab.style.left=((b*unitsPerBar+beat*beatUnits)*unitW)+'px'; lab.style.width=(beatUnits*unitW)+'px'; lab.textContent=beat===0?String(b+1):String(beat+1); lab.onclick=()=>setPlayStartCell(b*unitsPerBar+beat*beatUnits); inner.appendChild(lab)}} ruler.appendChild(inner); if(wrap){wrap.onscroll=()=>{inner.style.transform='translateX('+(-wrap.scrollLeft)+'px)';}; setTimeout(()=>wrap.onscroll(),0);}}
    noteRange.forEach((m,i)=>{const k=document.createElement('div'); k.className='piano-key '+([1,3,6,8,10].includes(m%12)?'black ':'')+(allowedPitch(m)?'allowed':''); k.innerHTML='<span>'+midiName(m)+'</span>'; keys.appendChild(k);});
    const catcher=document.createElement('div'); catcher.style.position='absolute'; catcher.style.inset='0'; catcher.style.cursor='crosshair'; catcher.addEventListener('click',addNoteFromClick); catcher.addEventListener('contextmenu',e=>{e.preventDefault(); const rect=e.currentTarget.getBoundingClientRect(); const sc=e.currentTarget.parentElement; setPlayStartCell(Math.floor((e.clientX-rect.left+sc.scrollLeft)/24));}); roll.appendChild(catcher);
    melodyNotes.forEach((n,idx)=>{const row=noteRange.indexOf(n.midi); if(row<0)return; const el=document.createElement('div'); el.className='note-block'; el.dataset.idx=idx; el.style.left=n.start*unitW+'px'; el.style.top=row*rowH+4+'px'; el.style.width=Math.max(24,n.units*unitW-4)+'px'; el.style.height=rowH-8+'px'; el.textContent=midiName(n.midi); if(idx===state.selectedNote)el.classList.add('selected'); el.onclick=(e)=>{e.stopPropagation();state.selectedNote=idx;renderPianoRoll()}; el.ondblclick=(e)=>{e.stopPropagation();melodyNotes.splice(idx,1);state.selectedNote=null;renderPianoRoll()}; let mode='',sx=0,sy=0,orig={}; el.onmousedown=(e)=>{e.stopPropagation(); const r=el.getBoundingClientRect(); mode=(r.right-e.clientX<10)?'resize':'move'; sx=e.clientX; sy=e.clientY; orig={...n}; document.onmousemove=(ev)=>{if(mode==='resize'){const du=Math.round((ev.clientX-sx)/unitW); n.units=Math.max(1,orig.units+du);}else{const dx=Math.round((ev.clientX-sx)/unitW); const dy=Math.round((ev.clientY-sy)/rowH); n.start=Math.max(0,orig.start+dx); const nr=noteRange.indexOf(orig.midi)+dy; if(noteRange[nr]!=null&&allowedPitch(noteRange[nr])) n.midi=noteRange[nr];} renderPianoRoll();}; document.onmouseup=()=>{document.onmousemove=null;document.onmouseup=null;};}; roll.appendChild(el);});
    const ph=document.createElement('div'); ph.id='melodyPlayhead'; ph.className='melody-playhead'; ph.style.display='none'; ph.style.left=(state.playStartCell*unitW)+'px'; roll.appendChild(ph);
  };

  // 可暂停的播放调度
  function clearPlayTimers(){(state.activePlayTimers||[]).forEach(clearTimeout); state.activePlayTimers=[]; clearInterval(state.playTimer); state.playTimer=null; document.querySelectorAll('.rhythm-v42-playhead,.track-playhead').forEach(p=>p.style.display='none'); const mp=q('melodyPlayhead'); if(mp) mp.style.display='none';}
  function setRhythmButtons(playing,label){[['playRhythm','同时试听'],['playRhythmTrack1','轨道 1'],['playRhythmTrack2','轨道 2'],['playRhythmTrack3','轨道 3'],['playRhythmTrack4','轨道 4']].forEach(([id,txt])=>{const b=q(id); if(!b)return; b.textContent=(playing&&(!label||label===id))?'Ⅱ 暂停':'▶ '+txt;});}
  function setMelodyButton(playing){const b=q('playMelody'); if(b)b.textContent=playing?'Ⅱ 暂停':'▶ 试听旋律';}
  function setGlobalButton(playing){const b=q('globalPlay'); if(b)b.textContent=playing?'Ⅱ 暂停全局':'▶ 播放';}
  window.pauseAllPlayback=function(){clearPlayTimers(); state.playing=false; state.rhythmPlaying=false; state.melodyPlaying=false; stopMetro(); setRhythmButtons(false); setMelodyButton(false); setGlobalButton(false);};
  window.playRhythm=function(track='all',startCell=state.playStartCell||0){
    const btnId=track==='all'?'playRhythm':'playRhythmTrack'+track; if(state.rhythmPlaying){pauseAllPlayback();return;}
    pauseAllPlayback(); state.rhythmPlaying=true; setRhythmButtons(true,btnId); const started=performance.now(); const unitMs=secPerUnit()*1000;
    rhythmEvents.filter(ev=>(track==='all'||(ev.track||1)===track)&&(ev.cell+ev.units)>startCell).forEach(ev=>{const sound=q('rhythmSound'+(ev.track||1))?.value||'wood'; rhythmPattern(ev).forEach((hit,i)=>{if(hit.rest)return; const delay=Math.max(0,(ev.cell-startCell+hit.off)*unitMs); const timer=setTimeout(()=>{playRhythmHit(ctx().currentTime+.001,Math.max(.06,hit.len*secPerUnit()),sound,i===0);},delay); state.activePlayTimers.push(timer);});});
    const maxCell=Math.max(startCell+1,...rhythmEvents.map(e=>e.cell+e.units)); state.playTimer=setInterval(()=>{const cell=startCell+(performance.now()-started)/unitMs; document.querySelectorAll('.rhythm-v42-playhead,.track-playhead').forEach(p=>{p.style.display='block';p.style.left=(cell*24)+'px'}); if(cell>maxCell+1) pauseAllPlayback();},30);
  };
  window.playMelody=function(startCell=state.playStartCell||0){
    if(state.melodyPlaying){pauseAllPlayback();return;}
    pauseAllPlayback(); state.melodyPlaying=true; setMelodyButton(true); const started=performance.now(); const unitMs=secPerUnit()*1000; const timbre=q('melodyTimbre')?.value||'grandPiano';
    melodyNotes.filter(n=>n.start+n.units>startCell).forEach(n=>{const delay=Math.max(0,(n.start-startCell)*unitMs); const timer=setTimeout(()=>playTone(n.midi,ctx().currentTime+.001,n.units*secPerUnit()*0.92,timbre),delay); state.activePlayTimers.push(timer);});
    const maxCell=Math.max(startCell+1,...melodyNotes.map(n=>n.start+n.units)); state.playTimer=setInterval(()=>{const cell=startCell+(performance.now()-started)/unitMs; const ph=q('melodyPlayhead'); if(ph){ph.style.display='block';ph.style.left=(cell*24)+'px';} if(cell>maxCell+1) pauseAllPlayback();},30); if(typeof drawMelodyCurve==='function') drawMelodyCurve();
  };
  window.playAll=function(){if(state.playing){pauseAllPlayback();return;} pauseAllPlayback(); state.playing=true; setGlobalButton(true); const started=performance.now(); const unitMs=secPerUnit()*1000; const startCell=state.playStartCell||0; if(q('globalMetroEnabled')?.checked) startMetro();
    rhythmEvents.filter(ev=>ev.cell+ev.units>startCell).forEach(ev=>{const sound=q('rhythmSound'+(ev.track||1))?.value||'wood'; rhythmPattern(ev).forEach((hit,i)=>{if(hit.rest)return; const delay=Math.max(0,(ev.cell-startCell+hit.off)*unitMs); state.activePlayTimers.push(setTimeout(()=>playRhythmHit(ctx().currentTime+.001,Math.max(.06,hit.len*secPerUnit()),sound,i===0),delay));});});
    const timbre=q('melodyTimbre')?.value||'grandPiano'; melodyNotes.filter(n=>n.start+n.units>startCell).forEach(n=>{const delay=Math.max(0,(n.start-startCell)*unitMs); state.activePlayTimers.push(setTimeout(()=>playTone(n.midi,ctx().currentTime+.001,n.units*secPerUnit()*0.92,timbre),delay));});
    const maxCell=Math.max(startCell+1,...rhythmEvents.map(e=>e.cell+e.units),...melodyNotes.map(n=>n.start+n.units)); state.playTimer=setInterval(()=>{const cell=startCell+(performance.now()-started)/unitMs; document.querySelectorAll('.rhythm-v42-playhead,.track-playhead').forEach(p=>{p.style.display='block';p.style.left=(cell*24)+'px'}); const ph=q('melodyPlayhead'); if(ph){ph.style.display='block';ph.style.left=(cell*24)+'px';} if(cell>maxCell+1) pauseAllPlayback();},30);
  };
  window.stopAll=window.pauseAllPlayback;
  // 替换按钮，移除旧监听
  [['playRhythm',()=>playRhythm('all')],['playRhythmTrack1',()=>playRhythm(1)],['playRhythmTrack2',()=>playRhythm(2)],['playRhythmTrack3',()=>playRhythm(3)],['playRhythmTrack4',()=>playRhythm(4)],['playMelody',()=>playMelody(state.playStartCell||0)],['globalPlay',()=>playAll()],['globalStop',()=>pauseAllPlayback()]].forEach(([id,fn])=>{const b=cloneBtn(id); if(b)b.onclick=fn;});
  const del=cloneBtn('deleteRhythm'); if(del)del.onclick=()=>{if(state.selectedRhythm!=null){rhythmEvents.splice(state.selectedRhythm,1);state.selectedRhythm=null;renderRhythm(true)}};
  const reset=cloneBtn('resetRhythm'); if(reset)reset.onclick=()=>{rhythmEvents=[];state.selectedRhythm=null;renderRhythm(false)};
  const resetM=cloneBtn('resetMelody'); if(resetM)resetM.onclick=()=>{melodyNotes=[];state.selectedNote=null;renderPianoRoll();};
  const full=cloneBtn('fullscreenCurrent'); if(full)full.onclick=()=>{const active=document.querySelector('.page.active'); if(!active)return; active.classList.add('fullscreen-module-active'); const iframe=active.querySelector('iframe'); (iframe||active).requestFullscreen?.();};
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement) document.querySelectorAll('.fullscreen-module-active').forEach(el=>el.classList.remove('fullscreen-module-active'));});
  function initRender(){try{getBars(); renderLibrary(); fillSoundSelects(); renderRhythm(false); renderPianoRoll(); renderBeatDots?.(); updateStartLines();}catch(e){console.warn(e)}}
  window.addEventListener('load',()=>{setTimeout(initRender,50);setTimeout(initRender,300);setTimeout(initRender,800);});
  document.querySelectorAll('#nav button[data-page]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(initRender,120)));
  ['globalBpm','globalBpmRange','globalTimeSig','globalBars'].forEach(id=>{const el=q(id); if(el){el.addEventListener('input',()=>setTimeout(initRender,20));el.addEventListener('change',()=>setTimeout(initRender,20));}});
  setTimeout(initRender,60);
})();

try{renderBeatDots();}catch(e){}

;

(function(){
  const q=id=>document.getElementById(id);
  const V43_GROUPS=[
    ['基础时值',[[ '全音符',16,'note','𝅝'],['二分音符',8,'note','𝅗𝅥'],['四分音符',4,'note','♩'],['八分音符',2,'note','♪'],['十六分音符',1,'note','♬'],['附点',0,'dot','·'],['全休止',16,'rest','𝄻'],['二分休止',8,'rest','𝄼'],['四分休止',4,'rest','𝄽'],['八分休止',2,'rest','𝄾'],['十六分休止',1,'rest','𝄿']]],
    ['连音节奏',[[ '八分二连音',4,'note','♪ ♪'],['十六分四连音',4,'note','♬ ♬ ♬ ♬'],['十六分两两均分',4,'note','♬♬ ♬♬'],['八分三连音',4,'note','♪♪♪³'],['十六分三连音',2,'note','♬♬♬³']]],
    ['切分节奏',[[ '八分小切分',4,'note','♪ ♩ ♪'],['大切分',8,'note','♩ 𝅗𝅥 ♩'],['十六分切分',4,'note','♬ ♪ ♬'],['后切分',4,'note','♪ ♩ ♪']]],
    ['附点与组合',[[ '附点四分+八分',8,'note','♩. ♪'],['八分+附点四分',8,'note','♪ ♩.'],['附点八分+十六分',4,'note','♪. ♬'],['十六分+附点八分',4,'note','♬ ♪.'],['四分+双八分',8,'note','♩ ♪♪'],['双八分+四分',8,'note','♪♪ ♩'],['四分+休止',8,'note','♩ 𝄽'],['八分+休止',4,'note','♪ 𝄾'],['两音一休',4,'note','♪ ♪ 𝄾'],['一休两音',4,'note','𝄾 ♪ ♪'],['音休穿插',4,'note','♪ 𝄾 ♪ 𝄾'],['前休止',4,'note','𝄾 ♩'],['后休止',4,'note','♩ 𝄾'],['两拍长音',8,'note','𝅗𝅥'],['四拍长音',16,'note','𝅝'],['结尾延长',12,'note','𝅗𝅥 ♩.']]]
  ];
  window.rhythmPalettePage = window.rhythmPalettePage || '1';
  window.rhythmSymbol = function(name,type){
    if(type==='dot' || name==='附点') return '·';
    for(const [,items] of V43_GROUPS){const hit=items.find(x=>x[0]===name); if(hit) return hit[3]||hit[0];}
    return type==='rest'?'𝄽':'♩';
  };
  window.renderLibrary = function(){
    const box=q('rhythmLibrary'); if(!box) return; box.innerHTML='';
    const pages=[['1','基础时值/附点'],['2','连音节奏'],['3','切分节奏'],['4','附点与组合'],['All','全部']];
    const tabs=document.createElement('div'); tabs.className='sibelius-tabs';
    pages.forEach(([key,label])=>{const b=document.createElement('button'); b.type='button'; b.className=window.rhythmPalettePage===key?'active':''; b.innerHTML='<b>'+key+'</b>'; b.title=label; b.onclick=()=>{window.rhythmPalettePage=key; window.renderLibrary();}; tabs.appendChild(b);});
    box.appendChild(tabs);
    const map={'1':['基础时值'],'2':['连音节奏'],'3':['切分节奏'],'4':['附点与组合'],'All':V43_GROUPS.map(g=>g[0])}; const wanted=new Set(map[window.rhythmPalettePage]||map['1']);
    const grid=document.createElement('div'); grid.className='sibelius-grid';
    V43_GROUPS.forEach(([title,items])=>{if(!wanted.has(title))return; items.forEach(([name,units,type,symbol])=>{const c=document.createElement('div'); c.className='sib-key '+(type==='rest'?'rest ':'')+(type==='dot'?'dot':''); c.draggable=true; c.dataset.name=name; c.dataset.units=units; c.dataset.type=type; c.title= name==='附点' ? '附点：拖到某个音符后，将前一音延长其一半时值' : (name+'｜'+units+'格'); c.innerHTML='<span class="rhythm-symbol">'+symbol+'</span><strong>'+name+'</strong><small>'+(type==='dot'?'延长前音 1/2':units+'格')+'</small>'; c.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',JSON.stringify({name,units,type,symbol:symbol||''}))}); grid.appendChild(c);});});
    box.appendChild(grid);
  };
  function saveScroll(){const sc=q('rhythmEditor')?.querySelector('.rhythm-timeline-scroller'); return sc?{x:sc.scrollLeft,y:sc.scrollTop}:null;}
  function restoreScroll(pos){if(!pos)return; setTimeout(()=>{const sc=q('rhythmEditor')?.querySelector('.rhythm-timeline-scroller'); if(sc){sc.scrollLeft=pos.x;sc.scrollTop=pos.y;}},0);}
  window.applyDotToPrevious=function(cell,track){
    const candidates=rhythmEvents.map((ev,idx)=>({...ev,idx,end:(ev.cell||0)+(Number(ev.units)||0)})).filter(ev=>(ev.track||1)===track && ev.type!=='rest' && ev.type!=='dot' && ev.end<=cell+0.001);
    if(!candidates.length){toast?.('请把附点拖到某个音符之后。'); return false;}
    const prev=candidates.sort((a,b)=>b.end-a.end)[0]; const add=(Number(prev.units)||1)/2; rhythmEvents[prev.idx].units=(Number(rhythmEvents[prev.idx].units)||1)+add; rhythmEvents[prev.idx].name=(rhythmEvents[prev.idx].name||'音符')+'·'; toast?.('已为前一音符增加附点时值。'); return true;
  };
  window.dropRhythm=function(e,cell,track=1){let ev; try{ev=JSON.parse(e.dataTransfer.getData('text/plain'));}catch(err){return} const pos=saveScroll(); if(ev.type==='dot'||ev.name==='附点'){window.applyDotToPrevious(cell,track);}else{rhythmEvents.push({cell,track,name:ev.name,units:Number(ev.units),type:ev.type});} window.renderRhythm(true); restoreScroll(pos);};
  window.renderRhythm=function(preserveScroll=true){
    const pos=preserveScroll?saveScroll():null; const {unitsPerBar}=parseSig(); const bars=Math.max(35, Math.ceil(totalUnits()/unitsPerBar)); const total=bars*unitsPerBar; const unitW=24; const editor=q('rhythmEditor'); if(!editor) return;
    editor.classList.add('rhythm-v43-layout-fix'); editor.innerHTML=''; editor.style.setProperty('--unit-w',unitW+'px'); editor.style.setProperty('--units-bar',unitsPerBar); editor.style.setProperty('--total-units',total);
    const scroller=document.createElement('div'); scroller.className='rhythm-timeline-scroller'; const timeline=document.createElement('div'); timeline.className='rhythm-timeline-inner'; timeline.style.width=(86+total*unitW)+'px';
    const ruler=document.createElement('div'); ruler.className='rhythm-v43-ruler'; ruler.style.gridTemplateColumns='86px repeat('+bars+', '+(unitsPerBar*unitW)+'px)'; ruler.innerHTML='<span>轨道</span>'+Array.from({length:bars},(_,i)=>'<span>小节 '+(i+1)+'</span>').join(''); timeline.appendChild(ruler);
    [1,2,3,4].forEach(trackNo=>{const track=document.createElement('div'); track.className='rhythm-v42-track'; const name=document.createElement('div'); name.className='rhythm-v42-track-name'; name.textContent='轨道 '+trackNo; const grid=document.createElement('div'); grid.className='rhythm-v42-grid'; grid.style.width=(total*unitW)+'px'; grid.style.setProperty('--unit-w',unitW+'px'); grid.style.setProperty('--units-bar',unitsPerBar); grid.style.setProperty('--total-units',total);
      const catcher=document.createElement('div'); catcher.className='rhythm-v42-catcher'; for(let i=0;i<total;i++){const cell=document.createElement('div'); cell.className='rhythm-v42-cell'; cell.dataset.cell=i; cell.dataset.track=trackNo; cell.addEventListener('click',()=>setPlayStartCell(i)); cell.addEventListener('dragover',e=>{e.preventDefault(); cell.classList.add('drop-over')}); cell.addEventListener('dragleave',()=>cell.classList.remove('drop-over')); cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('drop-over'); window.dropRhythm(e,i,trackNo);}); catcher.appendChild(cell);} grid.appendChild(catcher);
      const startLine=document.createElement('div'); startLine.className='rhythm-v42-start-line'; startLine.style.left=(state.playStartCell*unitW)+'px'; grid.appendChild(startLine);
      rhythmEvents.filter(ev=>(ev.track||1)===trackNo).forEach(ev=>{const idx=rhythmEvents.indexOf(ev); const el=document.createElement('div'); el.className='rhythm-v42-event '+(ev.type==='rest'?'rest':''); el.style.left=(ev.cell*unitW)+'px'; el.style.width=Math.max(30,(Number(ev.units)||1)*unitW-4)+'px'; el.title=(ev.name||'节奏')+'｜双击删除'; el.innerHTML='<b>'+window.rhythmSymbol(ev.name,ev.type)+'</b>'; if(idx===state.selectedRhythm)el.classList.add('selected'); el.onclick=(event)=>{event.stopPropagation();state.selectedRhythm=idx;window.renderRhythm(true)}; el.ondblclick=(event)=>{event.stopPropagation();rhythmEvents.splice(idx,1);state.selectedRhythm=null;window.renderRhythm(true)}; grid.appendChild(el);});
      const ph=document.createElement('div'); ph.className='rhythm-v42-playhead'; ph.dataset.trackPlayhead=trackNo; ph.style.display='none'; grid.appendChild(ph); track.appendChild(name); track.appendChild(grid); timeline.appendChild(track);});
    scroller.appendChild(timeline); editor.appendChild(scroller); restoreScroll(pos);
  };
  // 播放起点与旋律播放光标增强
  const oldSetPlayStartCell=window.setPlayStartCell || setPlayStartCell;
  window.setPlayStartCell=function(cell){oldSetPlayStartCell(cell); enhanceMelodyCursor();};
  function enhanceMelodyCursor(){const roll=q('pianoRoll'); if(!roll)return; let ph=q('melodyPlayhead'); if(!ph)return; ph.style.display='block'; ph.style.left=((state.playStartCell||0)*24)+'px'; ph.onmousedown=function(e){e.preventDefault(); e.stopPropagation(); const rect=roll.getBoundingClientRect(); const sc=roll.parentElement; const move=(ev)=>{const x=ev.clientX-rect.left+sc.scrollLeft; const cell=Math.max(0,Math.round(x/24)); window.setPlayStartCell(cell);}; document.addEventListener('mousemove',move); document.addEventListener('mouseup',()=>{document.removeEventListener('mousemove',move);},{once:true});};}
  const oldRenderPiano=window.renderPianoRoll || renderPianoRoll;
  window.renderPianoRoll=function(){oldRenderPiano(); enhanceMelodyCursor();};
  function addExtraButtons(){
    const rt=q('playRhythm'); if(rt && !q('playRhythmFromStart')){const b=document.createElement('button'); b.id='playRhythmFromStart'; b.className='btn v43-extra-btn'; b.textContent='↺ 从头播放'; b.onclick=()=>{window.setPlayStartCell(0); window.playRhythm('all',0);}; rt.parentElement.insertBefore(b,rt.nextSibling);}
    const pm=q('playMelody'); if(pm && !q('playMelodyFromStart')){const b=document.createElement('button'); b.id='playMelodyFromStart'; b.className='btn ghost mini v43-extra-btn'; b.textContent='↺ 从头播放'; b.onclick=()=>{window.setPlayStartCell(0); window.playMelody(0);}; pm.parentElement.insertBefore(b,pm.nextSibling);}
  }
  function initV43(){try{window.renderLibrary(); fillSoundSelects?.(); window.renderRhythm(false); window.renderPianoRoll(); addExtraButtons(); enhanceMelodyCursor();}catch(e){console.warn('V4.3 init',e)}}
  window.addEventListener('DOMContentLoaded',()=>setTimeout(initV43,30)); window.addEventListener('load',()=>{setTimeout(initV43,80);setTimeout(initV43,350);}); setTimeout(initV43,120);
  document.querySelectorAll('#nav button[data-page]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(initV43,120)));
})();

try{renderBeatDots();}catch(e){}

;

(function(){
  const q = id => document.getElementById(id);
  if (!window.rhythmEvents) window.rhythmEvents = [];
  try { if (typeof rhythmEvents === 'undefined') window.rhythmEvents = []; } catch(e) { window.rhythmEvents = []; }

  const V46_GROUPS = [
    ['基础时值',[[ '全音符',16,'note','𝅝'],['二分音符',8,'note','𝅗𝅥'],['四分音符',4,'note','♩'],['八分音符',2,'note','♪'],['十六分音符',1,'note','♬'],['附点',0,'dot','·'],['全休止',16,'rest','𝄻'],['二分休止',8,'rest','𝄼'],['四分休止',4,'rest','𝄽'],['八分休止',2,'rest','𝄾'],['十六分休止',1,'rest','𝄿']]],
    ['连音节奏',[[ '八分二连音',4,'note','♪ ♪'],['十六分四连音',4,'note','♬ ♬ ♬ ♬'],['十六分两两均分',4,'note','♬♬ ♬♬'],['八分三连音',4,'note','♪♪♪³'],['十六分三连音',2,'note','♬♬♬³']]],
    ['切分节奏',[[ '八分小切分',4,'note','♪ ♩ ♪'],['大切分',8,'note','♩ 𝅗𝅥 ♩'],['十六分切分',4,'note','♬ ♪ ♬'],['后切分',4,'note','♪ ♩ ♪']]],
    ['附点与组合',[[ '附点四分+八分',8,'note','♩. ♪'],['八分+附点四分',8,'note','♪ ♩.'],['附点八分+十六分',4,'note','♪. ♬'],['十六分+附点八分',4,'note','♬ ♪.'],['四分+双八分',8,'note','♩ ♪♪'],['双八分+四分',8,'note','♪♪ ♩'],['四分+休止',8,'note','♩ 𝄽'],['八分+休止',4,'note','♪ 𝄾'],['两音一休',4,'note','♪ ♪ 𝄾'],['一休两音',4,'note','𝄾 ♪ ♪'],['音休穿插',4,'note','♪ 𝄾 ♪ 𝄾'],['前休止',4,'note','𝄾 ♩'],['后休止',4,'note','♩ 𝄾'],['两拍长音',8,'note','𝅗𝅥'],['四拍长音',16,'note','𝅝'],['结尾延长',12,'note','𝅗𝅥 ♩.']]]
  ];
  window.rhythmPalettePage = window.rhythmPalettePage || '1';
  window.rhythmSymbol = function(name,type){
    if(type==='dot' || name==='附点') return '·';
    for(const [,items] of V46_GROUPS){ const hit=items.find(x=>x[0]===name); if(hit) return hit[3]||hit[0]; }
    return type==='rest'?'𝄽':'♩';
  };
  window.renderLibrary = function(){
    const box=q('rhythmLibrary'); if(!box) return; box.innerHTML='';
    const pages=[['1','基础时值/附点'],['2','连音节奏'],['3','切分节奏'],['4','附点与组合'],['All','全部']];
    const tabs=document.createElement('div'); tabs.className='sibelius-tabs';
    pages.forEach(([key,label])=>{ const b=document.createElement('button'); b.type='button'; b.className=window.rhythmPalettePage===key?'active':''; b.innerHTML='<b>'+key+'</b>'; b.title=label; b.onclick=()=>{window.rhythmPalettePage=key; window.renderLibrary();}; tabs.appendChild(b); });
    box.appendChild(tabs);
    const map={'1':['基础时值'],'2':['连音节奏'],'3':['切分节奏'],'4':['附点与组合'],'All':V46_GROUPS.map(g=>g[0])};
    const wanted=new Set(map[window.rhythmPalettePage]||map['1']);
    const grid=document.createElement('div'); grid.className='sibelius-grid';
    V46_GROUPS.forEach(([title,items])=>{ if(!wanted.has(title)) return; items.forEach(([name,units,type,symbol])=>{
      const c=document.createElement('div'); c.className='sib-key '+(type==='rest'?'rest ':'')+(type==='dot'?'dot':''); c.draggable=true;
      c.dataset.name=name; c.dataset.units=units; c.dataset.type=type; c.dataset.symbol=symbol||'';
      c.title = type==='dot' ? '附点：拖到音符或休止后面，独立占用前一节奏一半时值' : name+'｜'+units+'格';
      c.innerHTML='<span class="rhythm-symbol">'+symbol+'</span><strong>'+name+'</strong><small>'+(type==='dot'?'前一节奏 1/2':units+'格')+'</small>';
      c.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain', JSON.stringify({name,units,type,symbol:symbol||''})); });
      grid.appendChild(c);
    }); });
    box.appendChild(grid);
  };
  function saveScroll(){ const sc=q('rhythmEditor')?.querySelector('.rhythm-v46-scroller'); return sc?{x:sc.scrollLeft,y:sc.scrollTop}:null; }
  function restoreScroll(pos){ if(!pos)return; setTimeout(()=>{ const sc=q('rhythmEditor')?.querySelector('.rhythm-v46-scroller'); if(sc){ sc.scrollLeft=pos.x; sc.scrollTop=pos.y; } },0); }
  function bars(){ try{return Math.max(35, Number(q('globalBars')?.value)||35);}catch(e){return 35;} }
  function symbolForEvent(ev){ return window.rhythmSymbol(ev.name,ev.type); }
  window.renderRhythm = function(preserve=true){
    const editor=q('rhythmEditor'); if(!editor) return;
    const pos=preserve?saveScroll():null;
    const sig = (typeof parseSig==='function') ? parseSig() : {unitsPerBar:16};
    const unitsPerBar=sig.unitsPerBar||16;
    const total = Math.max(bars()*unitsPerBar, (typeof totalUnits==='function'?totalUnits():0));
    const unitW=24;
    editor.innerHTML='';
    const scroller=document.createElement('div'); scroller.className='rhythm-v46-scroller';
    const inner=document.createElement('div'); inner.className='rhythm-v46-inner'; inner.style.width=(92+total*unitW)+'px';
    const ruler=document.createElement('div'); ruler.className='rhythm-v46-ruler'; ruler.style.gridTemplateColumns='92px repeat('+Math.ceil(total/unitsPerBar)+', '+(unitsPerBar*unitW)+'px)';
    ruler.innerHTML='<span class="track-head">轨道</span>'+Array.from({length:Math.ceil(total/unitsPerBar)},(_,i)=>'<span>小节 '+(i+1)+'</span>').join(''); inner.appendChild(ruler);
    [1,2,3,4].forEach(trackNo=>{
      const track=document.createElement('div'); track.className='rhythm-v46-track';
      const name=document.createElement('div'); name.className='rhythm-v46-name'; name.textContent='轨道 '+trackNo;
      const grid=document.createElement('div'); grid.className='rhythm-v46-grid'; grid.style.width=(total*unitW)+'px'; grid.style.setProperty('--unit-w',unitW+'px'); grid.style.setProperty('--units-bar',unitsPerBar); grid.style.setProperty('--total-units',total);
      const catcher=document.createElement('div'); catcher.className='rhythm-v46-catcher';
      for(let i=0;i<total;i++){ const cell=document.createElement('div'); cell.className='rhythm-v46-cell'; cell.dataset.cell=i; cell.dataset.track=trackNo; cell.addEventListener('click',()=>{ if(typeof setPlayStartCell==='function') setPlayStartCell(i); }); cell.addEventListener('dragover',e=>{e.preventDefault(); cell.classList.add('drop-over');}); cell.addEventListener('dragleave',()=>cell.classList.remove('drop-over')); cell.addEventListener('drop',e=>{e.preventDefault(); cell.classList.remove('drop-over'); window.dropRhythm(e,i,trackNo);}); catcher.appendChild(cell); }
      grid.appendChild(catcher);
      const start=document.createElement('div'); start.className='rhythm-v46-start'; start.style.left=((state.playStartCell||0)*unitW)+'px'; grid.appendChild(start);
      rhythmEvents.filter(ev=>(ev.track||1)===trackNo).forEach((ev)=>{ const idx=rhythmEvents.indexOf(ev); const el=document.createElement('div'); el.className='rhythm-v46-event '+(ev.type==='rest'?'rest ':'')+(ev.type==='dot'?'dot':''); el.style.left=(Number(ev.cell)||0)*unitW+'px'; el.style.width=Math.max(22,(Number(ev.units)||1)*unitW-4)+'px'; el.title=(ev.name||'节奏')+'｜'+(Number(ev.units)||1)+'格｜双击删除'; el.innerHTML='<b>'+symbolForEvent(ev)+'</b>'; if(idx===state.selectedRhythm) el.classList.add('selected'); el.onclick=(event)=>{event.stopPropagation(); state.selectedRhythm=idx; window.renderRhythm(true);}; el.ondblclick=(event)=>{event.stopPropagation(); rhythmEvents.splice(idx,1); state.selectedRhythm=null; window.renderRhythm(true);}; grid.appendChild(el); });
      const ph=document.createElement('div'); ph.className='rhythm-v46-playhead rhythm-v42-playhead track-playhead'; ph.dataset.trackPlayhead=trackNo; grid.appendChild(ph);
      track.appendChild(name); track.appendChild(grid); inner.appendChild(track);
    });
    scroller.appendChild(inner); editor.appendChild(scroller); restoreScroll(pos);
  };
  window.dropRhythm = function(e,cell,track=1){
    let ev; try{ev=JSON.parse(e.dataTransfer.getData('text/plain'));}catch(err){return;}
    const pos=saveScroll();
    if(ev.type==='dot' || ev.name==='附点'){
      const prevs = rhythmEvents.map((x,idx)=>({x,idx,end:(Number(x.cell)||0)+(Number(x.units)||0)})).filter(o=>(o.x.track||1)===track && o.x.type!=='dot' && o.end<=cell+0.001);
      if(!prevs.length){ if(typeof toast==='function') toast('请把附点拖到音符或休止后面。'); return; }
      const prev=prevs.sort((a,b)=>b.end-a.end)[0].x;
      const dotUnits=Math.max(1, Math.round((Number(prev.units)||1)/2));
      rhythmEvents.push({cell:prev.cell+Number(prev.units||1), track, name:'附点', units:dotUnits, baseUnits:dotUnits, type:'dot', targetType:prev.type==='rest'?'rest':'note'});
      if(typeof toast==='function') toast('已添加独立附点：占前一节奏一半时值。');
    } else {
      rhythmEvents.push({cell,track,name:ev.name,units:Number(ev.units)||1,baseUnits:Number(ev.units)||1,type:ev.type||'note'});
    }
    rhythmEvents.sort((a,b)=>(a.track||1)-(b.track||1)||(a.cell||0)-(b.cell||0));
    window.renderRhythm(true); restoreScroll(pos);
  };
  const oldPattern = window.rhythmPattern || (typeof rhythmPattern==='function' ? rhythmPattern : null);
  window.rhythmPattern = function(ev){ if(ev.type==='dot' || ev.name==='附点') return [{off:0,len:Number(ev.units)||1,rest:true}]; return oldPattern ? oldPattern(ev) : [{off:0,len:Number(ev.units)||1,rest:ev.type==='rest'}]; };
  function boot(){ try{ window.renderLibrary(); if(typeof fillSoundSelects==='function') fillSoundSelects(); window.renderRhythm(false); }catch(e){ console.error('V4.6 rhythm boot failed', e); const ed=q('rhythmEditor'); if(ed){ ed.innerHTML='<div style="padding:24px;color:#ffd6d6">节奏轨道加载失败：'+e.message+'</div>'; } } }
  window.addEventListener('DOMContentLoaded',()=>setTimeout(boot,30)); window.addEventListener('load',()=>{setTimeout(boot,80);setTimeout(boot,300);}); setTimeout(boot,120);
  document.querySelectorAll('#nav button[data-page="rhythm"]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(boot,80)));
})();

try{renderBeatDots();}catch(e){}
