import {blockRuns,positionedRuns,fillTextWithSpaces,lineHighlights,sliceRuns,spliceRuns} from './richtext.js';
import {blockMetrics,presentationColors,messageX,chatPath} from './messages.js';
import {createEditor,syncEditor,readEditor} from './editor.js';
import {readDraft,writeDraft} from './draft.js';
import {replaceBlocks} from './replace.js';
import {exportHTML,htmlSettings,htmlBlock,initializeHTML,initializeHTMLTabs,htmlGroups} from './html.js';
import {icons} from './icons.js';
import {paragraphFormat,applyParagraphFormat} from './paragraph-format.js';
import {filmSettings,filmSize,filmLayout,filmImageRect,paintFilm} from './film.js';
import {marginSettings,marginLayout,paintMargin} from './margin.js';
import {playerTime,playerSeconds} from './film-player.js';
import {storeFilmImage,readFilmImage} from './film-image.js';
import {splitParagraphs,constrainDelta,fonts,radialGeometry,gradientCSS,alignedX,resizeWidths,verticalPositions,reorderBlocks,snapEdge} from './core.js';
const $=id=>document.getElementById(id),canvas=$('artwork'),ctx=canvas.getContext('2d');
const selectChevron=icons['chevron-down'].replaceAll('currentColor',getComputedStyle(document.documentElement).getPropertyValue('--muted').trim());
document.documentElement.style.setProperty('--select-chevron','url("data:image/svg+xml,'+encodeURIComponent(selectChevron)+'")');
const palettes=[{name:'깊은 밤',background:'radial',colors:['#2d3643','#57545f'],text:'#f0edf5',noise:18},{name:'책 내지',background:'solid',colors:['#f5f5f5','#f5f5f5'],text:'#333333',noise:0}];
let pngScale=1;try{if(localStorage.getItem('writemisu-png-scale')==='2')pngScale=2;}catch{}
let editorMode='png';try{if(localStorage.getItem('writemisu-mode')==='html')editorMode='html';}catch{}
let counter=0,preferredFont='kopubBatang';
try{const saved=localStorage.getItem('letter-studio-font');if(Object.hasOwn(fonts,saved))preferredFont=saved;}catch{}
function defaultFontSize(font){return (font==='freesentation'?20:12)*4/3;}
function newBlock(text='',type='text'){return {id:'b'+(++counter),type,text,x:(state.width-bodyWidth())/2,y:state.margin,w:bodyWidth(),size:defaultFontSize(preferredFont),lineHeight:1.85,font:preferredFont,auto:true,color:state.textColor,align:'left',bold:false,padding:state.padding,box:'#ffffff',opacity:0,group:null,...(state.htmlTabs?{htmlTabId:activeHTMLTab}:{}),...(state.htmlSettings?{htmlStyle:{font:htmlSettings(state).font,size:defaultFontSize(htmlSettings(state).font)}}:{})};}
let state={width:800,height:260,margin:80,padding:0,background:'solid',colors:[...palettes[1].colors],textColor:palettes[1].text,noise:0,seed:741,blocks:[],demo:false};
const tabDraft=readDraft(()=>sessionStorage),restoredDraft=tabDraft||readDraft(()=>localStorage);
if(restoredDraft){state=restoredDraft.state;counter=restoredDraft.counter;if(!tabDraft)writeDraft(()=>sessionStorage,JSON.stringify({version:1,...restoredDraft}));}else state.blocks.push(newBlock());
const htmlMigrated=[initializeHTML(state,!!restoredDraft),initializeHTMLTabs(state)].some(Boolean);
let activeHTMLTab=state.htmlTabs[0].id;
let inlineEdit=null;
const copiedParagraphFormats={png:null,html:null};
let marginGeometry=null;
let filmGeometry=null,filmImage=null,filmImageId=null,filmImagePromise=Promise.resolve(),filmImageError=false;
let selected=new Set(state.blocks[0]?[state.blocks[0].id]:[]),undoStack=[],redoStack=[],alignmentMode='text',zoom=.7,fitMode=true,drag=null,bgKey='',background=null,renderFrame=0,toastTimer;
const snapshot=()=>JSON.stringify(state);
function record(before=snapshot()){if(undoStack.at(-1)!==before)undoStack.push(before);if(undoStack.length>60)undoStack.shift();redoStack=[];updateHistory();queueDraftSave();}
function change(fn){const before=snapshot();fn();if(state.pngLayout==='film')filmGeometry=null;marginGeometry=null;if(snapshot()!==before)record(before);render();}
function updateHistory(){$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;}
function historyBack(forward=false){const from=forward?redoStack:undoStack,to=forward?undoStack:redoStack;if(!from.length)return;to.push(snapshot());state=JSON.parse(from.pop());endTyping();selected=new Set([...selected].filter(id=>state.blocks.some(b=>b.id===id)));render();queueDraftSave();notify(forward?'다시 실행됨':'실행 취소됨');}
function notify(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
function selection(){return state.blocks.filter(b=>selected.has(b.id));}
function displayBlock(b){return editorMode==='html'?htmlBlock(state,b):state.pngLayout==='film'?filmView(b):state.pngLayout==='margin'?marginView(b):b;}
function setFormat(b,key,value){if(editorMode==='html')b.htmlStyle={...b.htmlStyle,[key]:value};else if(state.pngLayout==='film')setFilmFormat(b,key,value);else if(state.pngLayout==='margin'){key={messageColor:'color',messageBox:'box',messageOpacity:'opacity'}[key]||key;if(['font','size','lineHeight','color'].includes(key))setMarginSetting(key,value);}else b[key]=value;}
function setHTMLSetting(key,value){state.htmlSettings={...htmlSettings(state),[key]:value};}
function fontString(b,run={}){return `${run.bold||b.bold?'700':'400'} ${b.size}px ${fonts[b.font]}`;}
function measureRun(b,text,run){ctx.font=fontString(b,run);return ctx.measureText(text).width;}
const metricCache=new Map();
function metrics(b){if(editorMode==='png'&&state.pngLayout==='margin'&&b.type==='text'){const view=marginView(b);if(view.metrics)return view.metrics;}if(editorMode==='png'&&state.pngLayout==='film'&&b.type==='text'){const view=filmView(b);if(view.metrics)return view.metrics;}const key=[b.text,b.w,b.padding,b.size,b.lineHeight,b.font,b.bold,b.presentation,b.messageSender,b.messageTitle,b.messageTime,b.messageSide,b.messageFit,JSON.stringify(b.runs),JSON.stringify(state.quoteStyle),JSON.stringify(state.replacementRules)].join('|'),cached=metricCache.get(b.id);if(cached?.key===key)return cached.value;const display=replaceBlocks([b],state.replacementRules||[]).blocks[0],value={...blockMetrics(display,(text,run)=>measureRun(b,text,run),state.quoteStyle),messageTitle:display.messageTitle,messageTime:display.messageTime};metricCache.set(b.id,{key,value});return value;}
function bounds(blocks){if(!blocks.length)return null;if(editorMode==='png'&&['film','margin'].includes(state.pngLayout))blocks=blocks.map(displayBlock);const x=Math.min(...blocks.map(b=>b.x)),y=Math.min(...blocks.map(b=>b.y));return {x,y,w:Math.max(...blocks.map(b=>b.x+metrics(b).w))-x,h:Math.max(...blocks.map(b=>b.y+metrics(b).h))-y};}
function fitHeight(){if(['film','margin'].includes(state.pngLayout))return;state.height=Math.ceil(Math.max(state.margin*2+100,...state.blocks.map(b=>b.y+metrics(b).h+state.margin)));}
function bodyWidth(){return Math.min(480,state.width-state.margin*2);}
function createPresentationControls(id){
 const host=document.createElement('div');host.className='presentation-controls';
 host.innerHTML='<div class="presentation-picker"><span>표현</span><button type="button" class="presentation-trigger" data-presentation aria-haspopup="listbox" aria-expanded="false"><span data-presentation-label>본문</span><span class="presentation-chevron" aria-hidden="true"></span></button><div class="presentation-menu" popover="auto" role="listbox" aria-label="표현"><button type="button" role="option" tabindex="-1" data-value="plain">본문</button><button type="button" role="option" tabindex="-1" data-value="chapter">챕터 제목</button><button type="button" role="option" tabindex="-1" data-value="notification">문자 메시지 알림</button><button type="button" role="option" tabindex="-1" data-value="chat">문자 대화 표현</button></div></div><div class="message-side segmented" hidden><button type="button" data-side="left">왼쪽</button><button type="button" data-side="right">오른쪽</button></div><div class="notification-fields" hidden><label>제목<input type="text" data-message="messageTitle" placeholder="메시지"></label><label>시간<input type="text" data-message="messageTime" placeholder="지금"></label><label class="sender-field">발신자<input type="text" data-message="messageSender" placeholder="발신자 이름"></label></div>';
 host.querySelector('.presentation-chevron').innerHTML=icons['chevron-down'];host.querySelectorAll('[role=option]').forEach(option=>option.insertAdjacentHTML('beforeend',icons.check));
 const trigger=host.querySelector('[data-presentation]'),menu=host.querySelector('.presentation-menu'),options=Array.from(menu.querySelectorAll('[role=option]'));menu.id='presentation-'+id;trigger.setAttribute('aria-controls',menu.id);
 const choose=value=>{endTyping();change(()=>{const b=state.blocks.find(x=>x.id===id);const previous=b.presentation;if(editorMode==='png'&&previous!=='chat'&&value==='chat'){b.messageOriginX=b.x;b.messageOriginW=b.w;b.messageOriginLineHeight=b.lineHeight;b.w=Math.round(bodyWidth()*.78);b.lineHeight=1.55;b.messageFit=true;b.messagePinned=true;}b.presentation=value;if(editorMode==='png'&&previous==='chat'&&value!=='chat'){b.w=b.messageOriginW??bodyWidth();b.lineHeight=b.messageOriginLineHeight??1.85;b.x=clamp(b.messageOriginX??(state.width-bodyWidth())/2,0,state.width-b.w);}selected=new Set([id]);if(editorMode==='png'&&value==='chat')pinMessage(b);});menu.hidePopover();trigger.focus({preventScroll:true});};
 const open=()=>{menu.showPopover();const r=trigger.getBoundingClientRect(),width=Math.min(Math.max(r.width,180),innerWidth-16);menu.style.width=width+'px';menu.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';menu.style.top=Math.max(8,r.bottom+6+menu.offsetHeight>innerHeight-8?r.top-menu.offsetHeight-6:r.bottom+6)+'px';(options.find(o=>o.getAttribute('aria-selected')==='true')||options[0]).focus({preventScroll:true});};
 menu.addEventListener('beforetoggle',e=>trigger.setAttribute('aria-expanded',e.newState==='open'));
 trigger.onclick=()=>menu.matches(':popover-open')?menu.hidePopover():open();
 trigger.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();open();}else if(e.key==='Escape'&&menu.matches(':popover-open')){e.preventDefault();e.stopPropagation();menu.hidePopover();}};
 options.forEach(option=>option.onclick=()=>choose(option.dataset.value));
 menu.onkeydown=e=>{const index=options.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();options[e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length].focus({preventScroll:true});}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();menu.hidePopover();trigger.focus({preventScroll:true});}else if(e.key==='Tab'){menu.hidePopover();trigger.focus({preventScroll:true});}};
 for(const button of host.querySelectorAll('[data-side]'))button.onclick=()=>change(()=>{const b=state.blocks.find(x=>x.id===id);b.messageSide=button.dataset.side;b.messagePinned=true;if(editorMode==='png')pinMessage(b);selected=new Set([id]);});
 for(const input of host.querySelectorAll('[data-message]')){input.onfocus=()=>{endTyping();if(!selected.has(id))select(id);};input.oninput=()=>{const b=state.blocks.find(x=>x.id===id),before=snapshot();b[input.dataset.message]=input.value;if(!typing)record(before);typing=true;clearTimeout(typingTimer);typingTimer=setTimeout(endTyping,700);loadUsedFonts().catch(()=>{});scheduleDraw();queueDraftSave();};input.onblur=endTyping;input.onkeydown=textKeyDown;}
 return host;
}
function closePresentationMenus(){document.querySelectorAll('.presentation-menu:popover-open').forEach(menu=>menu.hidePopover());}
document.addEventListener('scroll',closePresentationMenus,true);window.addEventListener('resize',closePresentationMenus);
function syncPresentationControls(card,b,index){
 const value=b.presentation||'plain';card.querySelector('[data-presentation-label]').textContent={plain:'본문',chapter:'챕터 제목',notification:'문자 메시지 알림',chat:'문자 대화 표현'}[value];card.querySelector('[data-presentation]').setAttribute('aria-label',`문단 ${index+1} 표현`);for(const option of card.querySelectorAll('[role=option]'))option.setAttribute('aria-selected',option.dataset.value===value);
 card.querySelector('.message-side').hidden=b.presentation!=='chat';card.querySelector('.notification-fields').hidden=b.presentation!=='notification';
 for(const button of card.querySelectorAll('[data-side]')){button.setAttribute('aria-label',`문단 ${index+1} 대화 ${button.dataset.side==='right'?'오른쪽':'왼쪽'}`);button.setAttribute('aria-pressed',(b.messageSide||'left')===button.dataset.side);}
 for(const input of card.querySelectorAll('[data-message]')){const key=input.dataset.message;input.value=b[key]??(key==='messageTitle'?'메시지':key==='messageTime'?'지금':'');input.setAttribute('aria-label',`문단 ${index+1} ${key==='messageTitle'?'알림 제목':key==='messageTime'?'알림 시간':'발신자'}`);}
}
function paintMessageHeader(c,b,m){
 c.font=`400 ${m.headerSize}px ${fonts[b.font]}`;
 const fit=(text,width)=>{const chars=Array.from(text);if(c.measureText(text).width<=width)return text;while(chars.length&&c.measureText(chars.join('')+'…').width>width)chars.pop();return chars.length?chars.join('')+'…':'';};
 const width=m.textWidth,time=fit(m.messageTime??'지금',width*.4),timeWidth=c.measureText(time).width,title=fit(m.messageTitle??'메시지',width-(time?timeWidth+12:0)),y=b.y+m.paddingY+m.headerSize;
 fillTextWithSpaces(c,title,b.x+m.paddingX,y);c.globalAlpha=.55;fillTextWithSpaces(c,time,b.x+m.w-m.paddingX-timeWidth,y);c.globalAlpha=1;
}
function pinMessage(b){b.x=messageX(b.messageSide,metrics(b).w,state.width,state.width-state.margin*2);}
function flowLayout(){if(['film','margin'].includes(state.pngLayout))return;let y=state.margin;for(const b of state.blocks){if(b.auto!==false)b.y=y;if(b.presentation==='chat'&&b.messagePinned!==false)pinMessage(b);y=Math.max(y,b.y+metrics(b).h+32);}}
function autoLayout(){if(editorMode==='png'&&state.pngLayout==='margin'){marginGeometry=null;return;}if(editorMode==='png'&&state.pngLayout==='film'){for(const b of Object.values(state.film.blocks)){delete b.x;delete b.y;delete b.w;}filmGeometry=null;return;}state.blocks.forEach(b=>{b.auto=true;if(b.type!=='line')b.w=b.presentation==='chat'?Math.round(bodyWidth()*.78):bodyWidth();b.x=(state.width-bodyWidth())/2;if(b.presentation==='chat'){b.messagePinned=true;b.messageFit=true;}});flowLayout();fitHeight();}
function clamp(n,min,max){return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;}

// A deterministic texture keeps preview and export identical.
function hash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263)+state.seed*1447;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function smoothNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;}
function getBackground(page=state){const key=JSON.stringify([page.width,page.height,page.background,page.colors,page.noise,page.seed]);if(key===bgKey)return background;const c=document.createElement('canvas');const scale=Math.min(1,12000/page.height);c.width=Math.max(1,Math.round(page.width*scale));c.height=Math.round(page.height*scale);const g=c.getContext('2d'),{x,y,radius}=radialGeometry(c.width,c.height);
  const gradient=g.createRadialGradient(x,y,0,x,y,radius);page.colors.forEach((color,i)=>gradient.addColorStop(i/(page.colors.length-1),color));g.fillStyle=page.background==='solid'?page.colors[0]:gradient;g.fillRect(0,0,c.width,c.height);
  if(page.noise){const pixels=g.getImageData(0,0,c.width,c.height),data=pixels.data;let random=page.seed;const fw=Math.ceil(c.width/8)+1,fh=Math.ceil(c.height/8)+1,field=new Float32Array(fw*fh);for(let y=0;y<fh;y++)for(let x=0;x<fw;x++)field[y*fw+x]=smoothNoise(x/12,y/12)*.6+smoothNoise(x/6,y/6)*.27+smoothNoise(x/3,y/3)*.13-.5;for(let y=0;y<c.height;y++){const row=Math.floor(y/8)*fw;for(let x=0;x<c.width;x++){random^=random<<13;random^=random>>>17;random^=random<<5;const value=(((random>>>0)/4294967295-.5)*.75+field[row+Math.floor(x/8)]*.65)*page.noise,i=(y*c.width+x)*4;data[i]+=value;data[i+1]+=value;data[i+2]+=value;}}g.putImageData(pixels,0,0);}background=c;bgKey=key;return c;}
function paint(target,scale=1,editingId=null){if(state.pngLayout==='margin'){const g=marginGeometry||marginLayout(state,measureRun),m=marginSettings(state);paintMargin(target,state,g,getBackground({...state,width:g.width,height:g.height,background:'solid',colors:[m.background,m.background],noise:m.texture}),scale,editingId);return;}if(state.pngLayout==='film'){paintFilm(target,state,filmImage,filmGeometry||filmLayout(state,measureRun),scale,editingId);return;}const c=target.getContext('2d');c.setTransform(scale,0,0,scale,0,0);c.drawImage(getBackground(),0,0,state.width,state.height);for(const b of state.blocks){const m=metrics(b),colors=presentationColors(b);if(colors.opacity>0){c.globalAlpha=colors.opacity/100;c.fillStyle=colors.box;if(b.presentation==='chat'){chatPath(c,b.x,b.y,m,b.messageSide);c.fill();}else if(b.presentation==='notification'){c.beginPath();c.roundRect(b.x,b.y,m.w,m.h,14);c.fill();}else c.fillRect(b.x,b.y,m.w,m.h);c.globalAlpha=1;}c.fillStyle=colors.color;if(b.type==='line'){c.fillRect(b.x,b.y+11,b.w,1);continue;}if(m.markerSize)c.fillRect(b.x+m.paddingX,b.y+m.paddingY+(b.size*b.lineHeight-m.markerSize)/2,m.markerSize,m.markerSize);c.textBaseline='alphabetic';c.textAlign='left';if(b.presentation==='notification')paintMessageHeader(c,b,m);if(b.id===editingId)continue;c.font=fontString(b);const h=b.size*b.lineHeight,sample=c.measureText('한글Ag'),ascent=sample.actualBoundingBoxAscent||b.size*.8,descent=sample.actualBoundingBoxDescent||b.size*.2,width=m.textWidth;for(let i=0;i<m.lines.length;i++){const y=b.y+m.paddingY+m.headerHeight+i*h+(h-ascent-descent)/2+ascent;const runs=positionedRuns(m.lines[i],width,b.align,(text,style)=>measureRun(b,text,style));for(const run of lineHighlights(runs)){c.fillStyle=run.highlight;c.globalAlpha=run.highlightOpacity/100;c.fillRect(b.x+m.paddingX+m.textOffset+run.x,y-ascent-2,run.w,Math.min(h,ascent+descent+4));c.globalAlpha=1;}for(const run of runs){c.fillStyle=run.color||colors.color;c.font=fontString(b,run);const x=b.x+m.paddingX+m.textOffset+run.x;if(run.italic){c.save();c.translate(x,y);c.transform(1,0,-.21,1,0,0);fillTextWithSpaces(c,run.text,0,0);c.restore();}else fillTextWithSpaces(c,run.text,x,y);const thickness=Math.max(1,b.size/18);if(run.underline)c.fillRect(x,y+Math.max(2,descent/2),run.w,thickness);if(run.strike)c.fillRect(x,y-ascent*.38,run.w,thickness);}}}c.setTransform(1,0,0,1,0,0);}
function updateCanvas(){if(editorMode==='html'){renderHTMLPreview();return;}const film=state.pngLayout==='film';let page=state;if(film){requestFilmImage();filmGeometry=filmLayout(state,measureRun);page=filmGeometry;renderFilmWarning();}else if(state.pngLayout==='margin'){marginGeometry=marginLayout(state,measureRun);page=marginGeometry;}else{flowLayout();fitHeight();}const ratio=Math.min(1,12000/page.height,Math.sqrt(12000000/(page.width*page.height)));const width=Math.ceil(page.width*ratio),height=Math.ceil(page.height*ratio);if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;paint(canvas,ratio,inlineEdit?.mode==='png'?inlineEdit.id:null);$('board').style.width=page.width+'px';$('board').style.height=page.height+'px';$('board').style.borderRadius=film?12*filmGeometry.scale+'px':'';$('sizeLabel').textContent=page.width+' × '+Math.round(page.height)+' px';renderPNGOptions();updateZoom();}
function updateZoom(){if(editorMode==='html')return;const page=state.pngLayout==='film'?filmSize(state):state.pngLayout==='margin'?(marginGeometry||marginLayout(state,measureRun)):state;if(fitMode){const host=$('stageScroll'),style=getComputedStyle(host),width=host.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=host.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);zoom=clamp(Math.min(width/page.width,height/page.height),.15,1);}$('board').style.transform='scale('+zoom+')';$('boardShell').style.width=page.width*zoom+'px';$('boardShell').style.height=page.height*zoom+'px';$('zoomLabel').textContent=Math.round(zoom*100)+'%';}

function moveBlock(id,direction){
 endTyping();if(editorMode==='html'){change(()=>{const members=state.blocks.filter(b=>b.htmlTabId===activeHTMLTab),at=members.findIndex(b=>b.id===id),other=members[at+direction];if(other){const index=state.blocks.findIndex(b=>b.id===id),to=state.blocks.indexOf(other);[state.blocks[index],state.blocks[to]]=[state.blocks[to],state.blocks[index]];}selected=new Set([id]);});return;}if(state.pngLayout==='margin'){change(()=>{const i=state.blocks.findIndex(b=>b.id===id),j=i+direction;if(j>=0&&j<state.blocks.length)[state.blocks[i],state.blocks[j]]=[state.blocks[j],state.blocks[i]];selected=new Set([id]);});return;}flowLayout();
 change(()=>{state.blocks=reorderBlocks(state.blocks,id,direction,b=>metrics(b).h);selected=new Set([id]);});
 const card=$('blockList').querySelector('[data-id="'+id+'"]'),button=card.querySelector('[data-move="'+direction+'"]');
 (button.disabled?card.querySelector('.paragraph-heading'):button).focus({preventScroll:true});card.scrollIntoView({block:'nearest'});
 const b=state.blocks.find(b=>b.id===id);$('stageScroll').scrollTo({top:Math.max(0,b.y*zoom-60),behavior:'smooth'});
}
function chooseHTMLTab(id){if(activeHTMLTab===id)return;endTyping();activeHTMLTab=id;selected=new Set(state.blocks.filter(b=>b.htmlTabId===id).slice(0,1).map(b=>b.id));render();}
function renderHTMLTabs(){
 if(!state.htmlTabs.some(t=>t.id===activeHTMLTab))activeHTMLTab=state.htmlTabs[0].id;
 const host=$('htmlTabList');for(const row of Array.from(host.children))if(!state.htmlTabs.some(t=>t.id===row.dataset.tab))row.remove();
 state.htmlTabs.forEach((tab,i)=>{
  let row=host.querySelector('[data-tab="'+tab.id+'"]');
  if(!row){
   const id=tab.id;row=document.createElement('div');row.className='html-tab-row';row.dataset.tab=id;row.setAttribute('role','listitem');
   const input=document.createElement('input');input.type='text';input.placeholder='탭 제목';input.onfocus=()=>chooseHTMLTab(id);input.onblur=endTyping;input.onkeydown=textKeyDown;
   input.oninput=()=>{const before=snapshot();state.htmlTabs.find(t=>t.id===id).title=input.value;if(!typing)record(before);typing=true;clearTimeout(typingTimer);typingTimer=setTimeout(endTyping,700);scheduleDraw();queueDraftSave();};
   const remove=document.createElement('button');remove.type='button';remove.innerHTML=icons['trash-2'];remove.onclick=()=>removeHTMLTab(id);row.append(input,remove);host.append(row);
  }
  const input=row.querySelector('input');if(document.activeElement!==input)input.value=tab.title;input.setAttribute('aria-label','탭 '+(i+1)+' 제목');row.classList.toggle('active',tab.id===activeHTMLTab);
  const remove=row.querySelector('button');remove.disabled=state.htmlTabs.length===1;remove.setAttribute('aria-label','탭 '+(i+1)+' 삭제');remove.title='탭 삭제';
 });
 $('htmlTabOpen').checked=state.htmlTabs.find(t=>t.id===activeHTMLTab).open;$('addHTMLTab').disabled=state.htmlTabs.length>=3;
}
$('addHTMLTab').innerHTML=icons.plus;
$('addHTMLTab').onclick=e=>{e.preventDefault();if(state.htmlTabs.length>=3)return;$('htmlTabTools').open=true;endTyping();change(()=>{activeHTMLTab='t'+(Math.max(0,...state.htmlTabs.map(t=>+t.id.slice(1)))+1);state.htmlTabs.push({id:activeHTMLTab,title:'',open:false,collapse:true});const b=newBlock();state.blocks.push(b);selected=new Set([b.id]);});$('htmlTabList').querySelector('[data-tab="'+activeHTMLTab+'"] input').focus();};
function removeHTMLTab(id){if(state.htmlTabs.length===1)return;endTyping();change(()=>{state.blocks=state.blocks.filter(b=>b.htmlTabId!==id);state.htmlTabs=state.htmlTabs.filter(t=>t.id!==id);if(activeHTMLTab===id)activeHTMLTab=state.htmlTabs[0].id;selected=new Set(state.blocks.filter(b=>b.htmlTabId===activeHTMLTab).slice(0,1).map(b=>b.id));});}
$('htmlTabOpen').onchange=e=>{endTyping();change(()=>state.htmlTabs.find(t=>t.id===activeHTMLTab).open=e.target.checked);};
function renderList(){
 renderHTMLTabs();
 const list=$('blockList');for(const child of Array.from(list.children))if(!state.blocks.some(b=>b.id===child.dataset.id))child.remove();
 state.blocks.forEach((b,i)=>{
  let card=list.querySelector('[data-id="'+b.id+'"]');
  if(!card){
   const id=b.id;card=document.createElement('details');card.open=b.type==='text'&&selected.has(id);card.className='paragraph-editor';card.dataset.id=id;card.dataset.type=b.type;
   const button=document.createElement('span');button.className='block-row';
   const header=document.createElement('summary');header.className='paragraph-heading';header.innerHTML='<span class="paragraph-chevron" aria-hidden="true">'+icons[b.type==='line'?'minus':'chevron-down']+'</span>';header.append(button);header.onpointerdown=e=>{if((e.shiftKey||e.ctrlKey||e.metaKey)&&!e.target.closest('button'))e.preventDefault();};header.onclick=e=>{if(e.target.closest('button'))return;e.preventDefault();const multiple=e.shiftKey||e.ctrlKey||e.metaKey,wasSelected=selected.has(id),wasOpen=card.open;select(id,multiple);if(!multiple&&wasSelected&&b.type==='text')card.open=!wasOpen;};
   for(const [direction,icon] of [[-1,'arrow-up'],[1,'arrow-down']]){const move=document.createElement('button');move.type='button';move.className='paragraph-move';move.dataset.move=direction;move.innerHTML=icons[icon];move.onclick=()=>moveBlock(id,direction);header.append(move);}
   const remove=document.createElement('button');remove.className='paragraph-delete';remove.innerHTML=icons['trash-2'];remove.title='문단 삭제';remove.onclick=()=>change(()=>{state.blocks=state.blocks.filter(x=>x.id!==id);selected.delete(id);});header.append(remove);card.append(header);
   if(b.type==='text'){
    card.append(createPresentationControls(id));
   }
   if(b.type==='text')card.append(createEditor(id,{getBlock:key=>state.blocks.find(x=>x.id===key),select:key=>{if(!selected.has(key))select(key);},onChange:updateText,onKeyDown:textKeyDown,onBlur:endTyping}));
  }
  const button=card.querySelector('.block-row'),n=editorMode==='html'?state.blocks.filter(x=>x.htmlTabId===activeHTMLTab).indexOf(b)+1:i+1,label=(b.type==='line'?'구분선 ':'문단 ')+n;
  card.querySelector('.paragraph-delete').setAttribute('aria-label',label+' 삭제');
  for(const move of card.querySelectorAll('[data-move]')){move.hidden=editorMode==='png'&&state.pngLayout==='film';const up=move.dataset.move==='-1';const members=editorMode==='html'?state.blocks.filter(x=>x.htmlTabId===activeHTMLTab):state.blocks,index=members.indexOf(b);move.disabled=up?index<=0:index===members.length-1;move.title=up?'위로 이동':'아래로 이동';move.setAttribute('aria-label',label+' '+move.title);}
  if(b.type==='text'&&card.classList.contains('selected')!==selected.has(b.id))card.open=selected.has(b.id);
  button.textContent=label+(editorMode==='png'&&b.group?' · 묶음':'');if(b.type==='text'){const preview=document.createElement('span');preview.className='paragraph-preview';preview.textContent=b.text.replace(/\s+/g,' ').trim()||'내용 없음';button.append(preview);}card.querySelector('summary').setAttribute('aria-label',label+(b.type==='line'?' 선택':' 접기·펼치기'));button.setAttribute('aria-pressed',selected.has(b.id));card.classList.toggle('selected',selected.has(b.id));
  card.hidden=editorMode==='html'&&b.htmlTabId!==activeHTMLTab||editorMode==='png'&&['film','margin'].includes(state.pngLayout)&&b.type==='line';
  const input=card.querySelector('.paragraph-input');if(input){syncPresentationControls(card,b,n-1);input.setAttribute('aria-label','문단 '+n+' 내용');syncEditor(input,b);}
  if(list.children[i]!==card)list.insertBefore(card,list.children[i]||null);
 });
}
function renderOverlays(){
 renderChatAdd();
 const host=$('overlays');if(editorMode==='html'){host.replaceChildren();return;}host.querySelectorAll('.guide,.multi-selection').forEach(e=>e.remove());
 const sources=state.pngLayout==='film'?(filmGeometry||filmLayout(state,measureRun)).blocks:state.pngLayout==='margin'?(marginGeometry||marginLayout(state,measureRun)).blocks:state.blocks;
 for(const child of Array.from(host.children))if(!sources.some(b=>b.id===child.dataset.id))child.remove();
 for(const b of sources){let overlay=host.querySelector('.block-overlay[data-id="'+b.id+'"]');if(!overlay){overlay=document.createElement('div');overlay.dataset.id=b.id;overlay.tabIndex=0;overlay.setAttribute('role','button');overlay.innerHTML='<span class="drag-label"></span><span class="resize-handle" data-resize="true" title="문단 너비"></span>';overlay.onpointerdown=e=>startDrag(e,b.id);overlay.ondblclick=e=>{e.preventDefault();beginInlineEdit(b.id,e);};overlay.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();beginInlineEdit(b.id);}};host.append(overlay);}overlay.className='block-overlay'+(selected.has(b.id)?' selected':'');overlay.setAttribute('aria-label',(b.type==='line'?'구분선':b.text.slice(0,40))+'. 드래그해서 이동, 더블클릭 또는 Enter로 바로 수정');overlay.hidden=inlineEdit?.mode==='png'&&inlineEdit.id===b.id;overlay.style.cssText='left:'+b.x+'px;top:'+b.y+'px;width:'+metrics(b).w+'px;height:'+metrics(b).h+'px';overlay.querySelector('.drag-label').textContent=b.group?'묶음':b.presentation==='chat'?'문자 대화':b.presentation==='notification'?'메시지 알림':b.presentation==='chapter'?'챕터 제목':'문단';overlay.querySelector('.resize-handle').hidden=!(selected.size===1&&selected.has(b.id));}
 const blocks=selection().map(displayBlock).filter(b=>b.visible!==false);if(blocks.length>1){const r=bounds(blocks),frame=document.createElement('div');frame.className='multi-selection';frame.tabIndex=0;frame.setAttribute('role','group');frame.setAttribute('aria-label','선택 문단 전체');frame.style.cssText='left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px';frame.innerHTML='<span class="resize-handle" data-resize="true" title="선택 문단 너비 함께 조절"></span>';frame.onpointerdown=e=>startDrag(e,blocks[0].id);host.append(frame);}
 if(blocks.length){const page=state.pngLayout==='film'?filmSize(state):state.pngLayout==='margin'?(marginGeometry||marginLayout(state,measureRun)):state,margin=state.pngLayout==='film'?page.width*.045:state.pngLayout==='margin'?marginSettings(state).outer:state.margin;addGuide('vertical',margin,true);addGuide('vertical',page.width-margin,true);}
 positionInlineEdit();
}
function select(id,multiple=false){const b=state.blocks.find(b=>b.id===id);if(!b)return;if(b.type==='line'&&editorMode==='png')alignmentMode='layer';const ids=editorMode==='png'&&!['film','margin'].includes(state.pngLayout)&&b.group?state.blocks.filter(x=>x.group===b.group).map(x=>x.id):[id];if(multiple){if(ids.every(key=>selected.has(key)))ids.forEach(key=>selected.delete(key));else ids.forEach(key=>selected.add(key));}else selected=new Set(ids);renderList();renderOverlays();renderSelection();}
function formatTargets(){const chosen=selection();return chosen.length?chosen:state.blocks.filter(b=>b.type==='text'&&(editorMode!=='html'||b.htmlTabId===activeHTMLTab));}
function selectedTextBlocks(){return selection().filter(b=>b.type==='text'&&(editorMode!=='html'||b.htmlTabId===activeHTMLTab));}
function inheritParagraphFormat(block){
 if(editorMode==='png'&&state.pngLayout==='margin')return block;
 const members=state.blocks.filter(b=>b.type==='text'&&(editorMode!=='html'||b.htmlTabId===activeHTMLTab));
 const source=members.find(b=>selected.has(b.id))||members.at(-1);
 if(editorMode==='png'&&state.pngLayout==='film'){if(source)for(const [key,value] of Object.entries(paragraphFormat(state,displayBlock(source),'png')))setFilmFormat(block,key,value);return block;}
 if(source)applyParagraphFormat(block,paragraphFormat(state,source,editorMode),editorMode);
 return block;
}
function copyParagraphFormat(){
 finishInlineEdit();endTyping();const blocks=selectedTextBlocks();if(blocks.length!==1)return;
 const film=editorMode==='png'&&state.pngLayout==='film';copiedParagraphFormats[film?'film':editorMode]=paragraphFormat(state,film?displayBlock(blocks[0]):blocks[0],editorMode);renderTypography();notify('서식 복사 완료');
}
function pasteParagraphFormat(){
 finishInlineEdit();endTyping();const film=editorMode==='png'&&state.pngLayout==='film',format=copiedParagraphFormats[film?'film':editorMode],blocks=selectedTextBlocks();if(!format||!blocks.length)return;
 change(()=>{for(const b of blocks){if(film){for(const [key,value] of Object.entries(format))setFilmFormat(b,key,key==='w'?Math.min(value,filmSize(state).width-filmView(b).x):value);}else{applyParagraphFormat(b,format,editorMode);if(editorMode==='png')b.w=Math.min(b.w,state.width-b.x);}}});
 notify(blocks.length+'개 문단 서식 적용');
}
function quoteSettings(){return (editorMode==='html'?htmlSettings(state).quoteStyle:undefined)||state.quoteStyle||{enabled:false,color:null,highlight:editorMode==='html'?htmlSettings(state).accent:state.textColor,highlightOpacity:8,bold:false,italic:false,underline:false,strike:false};}
function setQuoteSettings(value){if(editorMode==='html')setHTMLSetting('quoteStyle',value);else state.quoteStyle=value;}
function renderQuoteSettings(){
 const q=quoteSettings(),host=$('quoteControls');
 host.innerHTML='<div class="quote-heading"><span>자동 서식 · 전체 문단</span><button id="quoteEnabled" class="quote-switch" role="switch" aria-label="대사 자동 서식" aria-checked="'+q.enabled+'" aria-controls="quoteFields">'+(q.enabled?'ON':'OFF')+'</button></div><div id="quoteFields" '+(q.enabled?'':'hidden')+'><div class="color-row"><label>하이라이트 색<input id="quoteHighlight" type="color" value="'+q.highlight+'"></label></div><label class="range-label">하이라이트 농도<output id="quoteOpacityValue">'+q.highlightOpacity+'%</output><input id="quoteOpacity" aria-label="대사 하이라이트 농도" type="range" min="0" max="100" value="'+q.highlightOpacity+'"></label><label class="quote-color-toggle"><input id="quoteCustomColor" type="checkbox" '+(q.color?'checked':'')+'>글자색 변경</label><div class="color-row" '+(q.color?'':'hidden')+'><label>대사 글자색<input id="quoteColor" type="color" value="'+(q.color||(editorMode==='html'?htmlSettings(state).textColor:state.textColor))+'"></label></div><div class="text-formatting" id="quoteMarks" role="toolbar" aria-label="대사 글자 서식"></div></div>';
 const update=fn=>change(()=>{const value={...quoteSettings()};fn(value);setQuoteSettings(value);});
 $('quoteEnabled').onclick=()=>update(s=>s.enabled=!s.enabled);
 $('quoteCustomColor').onchange=e=>update(s=>s.color=e.target.checked?(editorMode==='html'?htmlSettings(state).textColor:state.textColor):null);
 for(const [id,key] of [['quoteHighlight','highlight'],['quoteColor','color']])$(id).onchange=e=>update(s=>s[key]=e.target.value);
 bindSlider($('quoteOpacity'),value=>setQuoteSettings({...quoteSettings(),highlightOpacity:value}),value=>$('quoteOpacityValue').textContent=value+'%');
 for(const [key,label] of [['bold','굵게'],['italic','기울임'],['underline','밑줄'],['strike','취소선']]){const button=document.createElement('button');button.type='button';button.innerHTML=icons[key==='strike'?'strikethrough':key];button.title='대사 '+label;button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',q[key]);button.onclick=()=>update(s=>s[key]=!s[key]);$('quoteMarks').append(button);}
}
function renderTypography(){const blocks=formatTargets(),b=displayBlock(blocks[0]||{font:preferredFont,size:defaultFontSize(preferredFont),lineHeight:1.85,color:state.textColor,box:'#ffffff',bold:false,opacity:0,align:'left'}),colors=presentationColors(b),host=$('typographyControls'),advancedOpen=!!host.querySelector('.typography-advanced[open]');
 host.innerHTML=`<label class="full-field">글꼴<select id="blockFont"><optgroup label="본문"><option value="kopubDotum">코펍돋움</option><option value="kopubBatang">코펍바탕</option><option value="pretendard">프리텐다드</option><option value="noto">Noto Serif KR</option></optgroup><optgroup label="헤더"><option value="freesentation">프리젠테이션</option></optgroup></select></label><label class="range-label">글자 크기<output id="fontSizeValue">${Math.round(b.size*75)/100}pt</output><input id="fontSize" aria-label="글자 크기" type="range" min="9" max="75" step=".5" value="${b.size*3/4}"></label><label class="range-label">행간<output id="lineHeightValue">${b.lineHeight.toFixed(2)}배</output><input id="lineHeight" aria-label="행간" type="range" min="1" max="3" step=".05" value="${b.lineHeight}"></label><div class="alignment-control"><h4>정렬</h4><div class="segmented" role="tablist" aria-label="정렬 방식"><button id="textAlignTab" role="tab" aria-controls="alignmentButtons">글 정렬</button><button id="layerAlignTab" role="tab" aria-controls="alignmentButtons">레이어 정렬</button></div><div id="alignmentButtons" class="align-buttons" role="tabpanel"></div></div><details class="typography-advanced"><summary>색과 박스 설정</summary><div class="color-row"><label>글자 색<input id="textColor" type="color" value="${colors.color}"></label><label>박스 색<input id="boxColor" type="color" value="${colors.box}"></label></div><label class="range-label">박스 불투명도<output id="opacityValue">${colors.opacity}%</output><input id="boxOpacity" type="range" min="0" max="100" value="${colors.opacity}"></label></details>`;
 const title=$('typographyGroup').querySelector('summary');title.querySelector('.paragraph-format-tools')?.remove();
 const tools=document.createElement('div');tools.className='paragraph-format-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','문단 서식');tools.innerHTML='<button type="button" id="copyParagraphFormat" aria-label="문단 서식 복사" title="문단 서식 복사">'+icons.copy+'</button><button type="button" id="pasteParagraphFormat" aria-label="문단 서식 붙여넣기" title="선택한 문단에 서식 붙여넣기">'+icons['clipboard-paste']+'</button>';title.insertBefore(tools,title.querySelector('.summary-chevron'));tools.onclick=e=>e.stopPropagation();
 if(selectedTextBlocks().length>1)host.insertAdjacentHTML('afterbegin','<p class="paragraph-format-selection">'+selectedTextBlocks().length+'개 문단 선택</p>');
 host.querySelector('.typography-advanced').open=advancedOpen;
 if(editorMode==='png'&&['film','margin'].includes(state.pngLayout))host.querySelector('.typography-advanced>summary').textContent=state.pngLayout==='film'?'자막 색':'본문 색';
 $('copyParagraphFormat').disabled=selectedTextBlocks().length!==1;$('pasteParagraphFormat').disabled=!copiedParagraphFormats[editorMode==='png'&&state.pngLayout==='film'?'film':editorMode]||!selectedTextBlocks().length;
 $('copyParagraphFormat').onclick=e=>{e.preventDefault();e.stopPropagation();copyParagraphFormat();};$('pasteParagraphFormat').onclick=e=>{e.preventDefault();e.stopPropagation();pasteParagraphFormat();};
 $('blockFont').value=b.font;$('blockFont').onchange=e=>{const font=e.target.value;if(editorMode==='png'&&!['film','margin'].includes(state.pngLayout)){preferredFont=font;try{localStorage.setItem('letter-studio-font',font);}catch{}}change(()=>{if(editorMode==='html')setHTMLSetting('font',font);formatTargets().forEach(x=>{setFormat(x,'font',font);if(editorMode!=='png'||!['film','margin'].includes(state.pngLayout))setFormat(x,'size',defaultFontSize(font));});});};
 bindSlider($('fontSize'),v=>formatTargets().forEach(x=>setFormat(x,'size',v*4/3)),v=>{$('fontSizeValue').textContent=v+'pt';});bindSlider($('lineHeight'),v=>formatTargets().forEach(x=>setFormat(x,'lineHeight',v)),v=>{$('lineHeightValue').textContent=v.toFixed(2)+'배';});
 for(const [id,key] of [['textColor','color'],['boxColor','box']])$(id).onchange=e=>{const value=e.target.value;change(()=>{formatTargets().forEach(x=>setFormat(x,x.presentation&&x.presentation!=='plain'?key==='color'?'messageColor':'messageBox':key,value));if(editorMode==='html'&&key==='color'&&!selected.size)setHTMLSetting('textColor',value);});};
 bindSlider($('boxOpacity'),v=>formatTargets().forEach(x=>setFormat(x,x.presentation&&x.presentation!=='plain'?'messageOpacity':'opacity',v)),v=>$('opacityValue').textContent=v+'%');
 $('textAlignTab').onclick=()=>{alignmentMode='text';renderAlignment();};$('layerAlignTab').onclick=()=>{alignmentMode='layer';renderAlignment();};renderAlignment();
}
function renderAlignment(){if(editorMode==='html'||state.pngLayout==='film'&&editorMode==='png')alignmentMode='text';$('layerAlignTab').hidden=editorMode==='html'||state.pngLayout==='film';const isText=alignmentMode==='text',blocks=isText?formatTargets().filter(b=>b.type==='text'||editorMode==='html'&&b.type==='line'):selection(),host=$('alignmentButtons'),rect=blocks.length?bounds(blocks):null;host.replaceChildren();host.setAttribute('aria-labelledby',isText?'textAlignTab':'layerAlignTab');for(const [id,active] of [['textAlignTab',isText],['layerAlignTab',!isText]]){$(id).setAttribute('aria-selected',active);$(id).tabIndex=active?0:-1;$(id).onkeydown=e=>{if(editorMode==='png'&&state.pngLayout!=='film'&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();e.stopPropagation();alignmentMode=isText?'layer':'text';renderAlignment();$(alignmentMode==='text'?'textAlignTab':'layerAlignTab').focus();}};}
 for(const [align,label] of [['left','왼쪽'],['center','가운데'],['right','오른쪽'],...(isText&&blocks.some(b=>b.type==='text')?[['justify','양쪽']]:[])]){const button=document.createElement('button');button.innerHTML=icons[isText?{left:'text-align-start',center:'text-align-center',right:'text-align-end',justify:'text-align-justify'}[align]:{left:'align-start-vertical',center:'align-center-vertical',right:'align-end-vertical'}[align]];button.title=(isText?'글 ':'레이어 ')+label+' 정렬';button.setAttribute('aria-label',button.title);button.disabled=!blocks.length;button.setAttribute('aria-pressed',isText?blocks.length>0&&blocks.every(b=>displayBlock(b).align===align):!!rect&&Math.abs(rect.x-alignedX(align,rect.w,state.width,state.margin))<1);button.onclick=()=>change(()=>{if(isText)blocks.forEach(b=>setFormat(b,'align',align));else{const r=bounds(blocks),dx=alignedX(align,r.w,state.width,state.margin)-r.x;blocks.forEach(b=>{b.auto=false;if(b.presentation==='chat')b.messagePinned=false;b.x+=dx;if(b.type==='line')b.align=align;});}});host.append(button);}
}
function widthLimit(b){const maxWidth=state.width-b.x;return {minWidth:Math.min(metrics(b).w,maxWidth,Math.max(80,b.padding*2+40)),maxWidth};}
function setBlockWidth(b,width){const limits=widthLimit(b);b.w=clamp(width,limits.minWidth,limits.maxWidth);if(b.presentation==='chat'){b.messageFit=false;b.messagePinned=false;}}
function arrangeSelection(gap){const blocks=selection();if(blocks.length<2)return;state.blocks.forEach(b=>b.auto=false);for(const position of verticalPositions(blocks.map(b=>({id:b.id,y:b.y,h:metrics(b).h})),gap))state.blocks.find(b=>b.id===position.id).y=position.y;}
function renderSelection(){
 renderTypography();if(editorMode==='html'){$('selectionPanel').hidden=true;return;}if(state.pngLayout==='film'){renderFilmSelection();return;}if(state.pngLayout==='margin'){renderMarginSelection();return;}const blocks=selection(),b=blocks[0],host=$('selectionControls'),detailsOpen=!!host.querySelector('details[open]');host.replaceChildren();$('selectionPanel').hidden=!b;$('selectionTitle').textContent=blocks.length>1?blocks.length+'개 문단 선택':b?.type==='line'?'선택한 구분선':'선택한 문단';if(!b)return;
 const grouped=blocks.some(x=>x.group),minWidth=Math.max(...blocks.map(x=>widthLimit(x).minWidth)),maxWidth=Math.max(minWidth,Math.min(...blocks.map(x=>widthLimit(x).maxWidth))),width=Math.round(metrics(b).w),r=bounds(blocks),gap=blocks.length>1?Math.max(0,(r.h-blocks.reduce((sum,x)=>sum+metrics(x).h,0))/(blocks.length-1)):32;
 host.innerHTML='<div class="property-actions"><button id="groupSelected" '+(blocks.length<2?'disabled':'')+'>묶기</button><button id="ungroupSelected" '+(!grouped?'disabled':'')+'>묶음 해제</button><button id="matchWidth" '+(blocks.length<2?'disabled':'')+'>너비 맞춤</button><button id="equalGaps" '+(blocks.length<3?'disabled':'')+'>세로 간격 균등</button></div><label class="range-label">문단 너비<output id="blockWidthValue">'+(blocks.every(x=>Math.round(metrics(x).w)===width)?width+'px':'여러 값')+'</output><input id="blockWidth" aria-label="선택 문단 너비" type="range" min="'+minWidth+'" max="'+maxWidth+'" value="'+width+'"></label><details><summary>간격</summary><label class="range-label">문단 사이<output id="paragraphGapValue">'+Math.round(gap)+'px</output><input id="paragraphGap" aria-label="선택 문단 간격" type="range" min="0" max="160" value="'+Math.min(160,Math.round(gap))+'" '+(blocks.length<2?'disabled':'')+'></label><div class="field-grid"><label>좌우 여백 · 전체<input id="padding" type="number" min="0" max="60" value="'+b.padding+'"></label></div></details>';
 for(const [id,name] of [['groupSelected','group'],['ungroupSelected','ungroup'],['matchWidth','move-horizontal'],['equalGaps','align-vertical-distribute-center']]){const button=$(id);button.title=button.textContent;button.setAttribute('aria-label',button.textContent);button.innerHTML=icons[name];}
 host.querySelector('details').open=detailsOpen;
 $('groupSelected').onclick=()=>change(()=>{const group='g'+(++counter);selection().forEach(x=>x.group=group);notify('묶음 생성됨');});$('ungroupSelected').onclick=()=>change(()=>{selection().forEach(x=>x.group=null);notify('묶음 해제됨');});
 $('matchWidth').onclick=()=>change(()=>{const width=Math.min(maxWidth,Math.max(...selection().map(x=>metrics(x).w)));selection().forEach(x=>setBlockWidth(x,width));});$('equalGaps').onclick=()=>change(()=>arrangeSelection());
 bindSlider($('blockWidth'),v=>selection().forEach(x=>setBlockWidth(x,v)),v=>$('blockWidthValue').textContent=v+'px');
 bindSlider($('paragraphGap'),v=>arrangeSelection(v),v=>$('paragraphGapValue').textContent=v+'px');
 bindSlider($('padding'),v=>{state.padding=clamp(v,0,60);state.blocks.forEach(x=>x.padding=state.padding);});
}
function bindSlider(element,mutate,display){let before=null;element.oninput=()=>{if(before===null)before=snapshot();mutate(+element.value);display?.(+element.value);scheduleDraw();queueDraftSave();};element.onchange=()=>{if(before!==null&&before!==snapshot())record(before);before=null;};}
function scheduleDraw(){if(renderFrame)return;renderFrame=requestAnimationFrame(()=>{renderFrame=0;updateCanvas();renderOverlays();});}
function replacementRules(){return state.replacementRules||[{find:'',replace:''}];}
function renderReplacements(){
 const rules=replacementRules(),host=$('replacementRows');
 while(host.children.length>rules.length)host.lastElementChild.remove();
 rules.forEach((rule,i)=>{
  let row=host.children[i];
  if(!row){
   row=document.createElement('div');row.className='replacement-row';
   row.innerHTML='<div class="replacement-fields"><label>찾을 단어<input data-replacement="find" type="text" autocomplete="off" spellcheck="false"></label><label>표시할 글자<input data-replacement="replace" type="text" autocomplete="off" spellcheck="false"></label></div><button type="button" class="replacement-delete">'+icons['trash-2']+'</button>';
   for(const input of row.querySelectorAll('input')){
    input.onfocus=endTyping;input.onblur=endTyping;input.onkeydown=textKeyDown;
    input.oninput=()=>{const before=snapshot();state.replacementRules=replacementRules();state.replacementRules[i][input.dataset.replacement]=input.value;if(!typing)record(before);typing=true;clearTimeout(typingTimer);typingTimer=setTimeout(endTyping,700);scheduleDraw();queueDraftSave();};
   }
   row.querySelector('button').onclick=()=>{endTyping();change(()=>{state.replacementRules=replacementRules();state.replacementRules.splice(i,1);});(host.children[Math.min(i,host.children.length-1)]?.querySelector('input')||$('addReplacement')).focus({preventScroll:true});};
   host.append(row);
  }
  for(const input of row.querySelectorAll('input')){input.value=rule[input.dataset.replacement];input.setAttribute('aria-label','치환 '+(i+1)+(input.dataset.replacement==='find'?' 찾을 단어':' 표시할 글자'));}
  row.querySelector('button').setAttribute('aria-label','치환 '+(i+1)+' 삭제');
 });
}
$('addReplacement').onclick=()=>{$('replacementTools').open=true;endTyping();change(()=>{state.replacementRules=[...replacementRules(),{find:'',replace:''}];});const input=$('replacementRows').lastElementChild.querySelector('input');input.focus();input.scrollIntoView({block:'nearest'});};
function marginView(b){marginGeometry??=marginLayout(state,measureRun);const s=marginSettings(state);return marginGeometry.blocks.find(x=>x.id===b.id)||{...b,font:s.font,size:s.size,lineHeight:s.lineHeight,color:s.color,align:'left',presentation:'plain',padding:0,opacity:0};}
function setMarginSetting(key,value){state.marginLayout=marginSettings({...state,marginLayout:{...marginSettings(state),[key]:value}});marginGeometry=null;}
function setMarginBlockSetting(id,key,value){const s=marginSettings(state);state.marginLayout={...s,blocks:{...s.blocks,[id]:{...s.blocks[id],[key]:value}}};marginGeometry=null;}
function renderMarginSettings(){
 const active=editorMode==='png'&&state.pngLayout==='margin',s=marginSettings(state);document.body.classList.toggle('margin-mode',active);
 for(const node of document.querySelectorAll('[data-margin-only]'))node.hidden=!active;
 const panel=$('designPanel'),background=$('backgroundGroup'),type=$('typographyGroup'),quote=$('quoteGroup');
 if(active){if(type.nextElementSibling!==$('marginNumberGroup'))panel.insertBefore(type,$('marginNumberGroup'));}
 else if(background.nextElementSibling!==type||type.nextElementSibling!==quote){panel.insertBefore(background,quote);panel.insertBefore(type,quote);}
 type.querySelector('summary').firstChild.textContent=active?'본문':'글자';
 if(!active)return;
 for(const input of document.querySelectorAll('[data-margin-key]')){const value=s[input.dataset.marginKey];if(input.type==='checkbox')input.checked=value;else if(document.activeElement!==input)input.value=value;}
 for(const output of document.querySelectorAll('[data-margin-value]'))output.textContent=s[output.dataset.marginValue]+output.dataset.unit;
 $('marginHeaderFields').hidden=!s.header;$('marginFooterFields').hidden=!s.footer;
}
function renderMarginSelection(){
 const blocks=selection().filter(b=>b.type==='text'),host=$('selectionControls'),s=marginSettings(state),first=state.blocks.find(b=>b.type==='text')?.id;
 host.replaceChildren();$('selectionPanel').hidden=!blocks.length;if(!blocks.length)return;
 $('selectionTitle').textContent=blocks.length>1?blocks.length+'개 문단':'선택한 문단';
 host.innerHTML='<label class="full-field">문단 역할<select id="marginRole"><option value="auto">자동</option><option value="narration">지문</option><option value="dialogue">대사</option></select></label><label class="html-option"><input id="marginSectionStart" type="checkbox">구간 시작</label>';
 $('marginRole').value=s.blocks[blocks[0].id]?.role||'auto';$('marginRole').onchange=e=>change(()=>blocks.forEach(b=>setMarginBlockSetting(b.id,'role',e.target.value)));
 const starts=blocks.map(b=>b.id===first||!!s.blocks[b.id]?.sectionStart);$('marginSectionStart').checked=starts.every(Boolean);$('marginSectionStart').indeterminate=starts.some(Boolean)&&!starts.every(Boolean);$('marginSectionStart').disabled=blocks.every(b=>b.id===first);
 $('marginSectionStart').onchange=e=>{const checked=e.target.checked;change(()=>blocks.filter(b=>b.id!==first).forEach(b=>setMarginBlockSetting(b.id,'sectionStart',checked)));};
}
for(const input of document.querySelectorAll('[data-margin-key]')){
 const key=input.dataset.marginKey;
 if(input.type==='range')bindSlider(input,value=>setMarginSetting(key,value),()=>{const output=document.querySelector('[data-margin-value="'+key+'"]');output.textContent=marginSettings(state)[key]+output.dataset.unit;});
 else if(input.type==='text'){
  input.oninput=()=>{const before=snapshot();setMarginSetting(key,input.value);if(!typing)record(before);typing=true;clearTimeout(typingTimer);typingTimer=setTimeout(endTyping,700);loadUsedFonts().catch(()=>{});scheduleDraw();queueDraftSave();};input.onblur=endTyping;input.onkeydown=textKeyDown;
 }else input.onchange=()=>change(()=>setMarginSetting(key,input.type==='checkbox'?input.checked:input.type==='number'?+input.value:input.value));
}
function filmView(b){filmGeometry??=filmLayout(state,measureRun);return filmGeometry.blocks.find(x=>x.id===b.id)||b;}
function setFilmSetting(key,value){state.film={...filmSettings(state),[key]:value};filmGeometry=null;}
function setFilmFormat(b,key,value){
 key={messageColor:'color',messageBox:'box',messageOpacity:'opacity'}[key]||key;
 const s=filmSettings(state),page=filmSize(state);
 if(key==='x'||key==='w')value/=page.width;else if(key==='y')value/=page.height;else if(key==='size'||key==='padding')value/=page.width/800;
 state.film={...s,blocks:{...s.blocks,[b.id]:{...s.blocks[b.id],[key]:value}}};filmGeometry=null;
}
function requestFilmImage(){
 const id=filmSettings(state).imageId;if(id===filmImageId)return filmImagePromise;
 filmImage?.close();filmImage=null;filmImageId=id;filmImageError=false;
 filmImagePromise=id?readFilmImage(id).then(image=>{if(filmImageId!==id){image.close();return;}filmImage=image;}).catch(()=>{if(filmImageId===id){filmImageError=true;notify('배경 이미지 불러오기 실패');}}).finally(()=>{if(filmImageId===id){renderFilmSettings();scheduleDraw();}}):Promise.resolve();
 return filmImagePromise;
}
async function ensureFilmImage(){await requestFilmImage();if(filmSettings(state).imageId&&(!filmImage||filmImageId!==filmSettings(state).imageId))throw Error('배경 이미지가 준비되지 않음');}
function renderFilmWarning(){
 const scene=filmGeometry,warning=$('filmWarning');warning.hidden=!scene?.warnings.length;
 warning.textContent=scene?.warnings.map(item=>'문단 '+(state.blocks.findIndex(b=>b.id===item.id)+1)+': '+(item.lines>3?item.lines+'줄 · 1~2줄 권장':'자막 안전 영역 벗어남')).join(' / ')||'';
}
const filmTextControls=[['filmRatio','ratio'],['filmFit','fit'],['filmLeftText','leftText'],['filmRightText','rightText'],['filmPlayerTitle','playerTitle']];
const filmToggleControls=[['filmLetterbox','letterbox'],['filmPlayer','player'],['filmMetadataOn','metadataOn'],['filmShadow','shadow']];
const filmSliderControls=[['filmBarPercent','barPercent','%'],['filmBlur','blur','px'],['filmDarken','darken','%'],['filmOutline','outline','px'],['filmGrain','grain','%'],['filmVignette','vignette','%']];
const filmTimeControls=[['filmPlayerElapsed','playerElapsed'],['filmPlayerDuration','playerDuration']];
function renderFilmSettings(){
 const active=editorMode==='png'&&state.pngLayout==='film',s=filmSettings(state);document.body.classList.toggle('film-mode',active);
 const widthField=$('pageWidth').closest('label'),ratioField=$('filmRatio').closest('label'),widthHost=active?$('filmScreenSize'):editorMode==='png'&&state.pngLayout==='margin'?$('marginPageSize'):$('pageSettings').querySelector('.field-grid');
 if(widthField.parentElement!==widthHost)widthHost.prepend(widthField);
 if(ratioField.parentElement!==$('filmScreenSize'))$('filmScreenSize').append(ratioField);
 for(const node of document.querySelectorAll('[data-film-only]'))node.hidden=!active;
 $('pngLayout').value=state.pngLayout||'plain';$('autoLayout').textContent=active?'자막 자동 배치':state.pngLayout==='margin'?'본문 자동 배치':'문단 자동 배치';
 if(!active)return;
 for(const [id,key] of filmTextControls)if(document.activeElement!==$(id))$(id).value=s[key];
 for(const [id,key] of filmToggleControls)$(id).checked=s[key];
 for(const [id,key,unit] of filmSliderControls){$(id).value=s[key];$(id+'Value').textContent=s[key]+unit;}
 $('filmBarFields').hidden=!s.letterbox;$('filmPlayerFields').hidden=!s.player;$('filmPlayerTimes').hidden=!s.player;
 for(const [id,key] of filmTimeControls)if(document.activeElement!==$(id))$(id).value=playerTime(s[key]);
 $('filmMetadataFields').hidden=!s.metadataOn;
 $('filmUpload').innerHTML=icons.plus+'<span>'+(s.imageId?'이미지 교체':'이미지 선택')+'</span>';$('filmRemove').innerHTML=icons['trash-2'];$('filmRemove').disabled=!s.imageId;$('filmCenter').disabled=!s.imageId;
 $('filmImageStatus').textContent=!s.imageId?'이미지 미선택':filmImageError?'이미지 불러오기 실패':!filmImage?'이미지 불러오는 중':'이미지: '+s.imageName;
 renderFilmWarning();
}
function renderFilmSelection(){
 const blocks=selection().filter(b=>b.type==='text'),host=$('selectionControls');host.replaceChildren();$('selectionPanel').hidden=!blocks.length;if(!blocks.length)return;
 $('selectionTitle').textContent=blocks.length>1?blocks.length+'개 자막':'선택한 자막';const b=filmView(blocks[0]),page=filmSize(state),max=Math.max(20,page.width-b.x),min=Math.min(80,max);
 host.innerHTML='<label class="range-label">자막 너비<output id="filmWidthValue">'+Math.round(b.w)+'px</output><input id="filmBlockWidth" type="range" min="'+min+'" max="'+max+'" value="'+b.w+'"></label>';
 bindSlider($('filmBlockWidth'),v=>blocks.forEach(source=>setFilmFormat(source,'w',Math.min(v,page.width-filmView(source).x))),v=>$('filmWidthValue').textContent=v+'px');
}
function startFilmDrag(e,id){
 finishInlineEdit();e.preventDefault();if(e.shiftKey||e.ctrlKey||e.metaKey){select(id,true);return;}if(!selected.has(id))select(id);
 const blocks=selection().filter(b=>b.type==='text').map(displayBlock);if(!blocks.length)return;
 drag={film:'text',startX:e.clientX,startY:e.clientY,before:snapshot(),original:blocks.map(b=>({...b})),bounds:bounds(blocks),resize:!!e.target.dataset.resize,moved:false,zoom};document.body.style.userSelect='none';
}
function startFilmBackground(e){
 if(e.button!==0)return;finishInlineEdit();e.preventDefault();selected.clear();renderList();renderOverlays();renderSelection();
 const s=filmSettings(state),page=filmSize(state);drag={film:'image',startX:e.clientX,startY:e.clientY,before:snapshot(),origin:{x:s.x,y:s.y},rect:filmImageRect(filmImage,page.width,page.height,s.fit,s.x,s.y),moved:false,zoom};document.body.style.userSelect='none';
}
function onFilmDrag(e){
 e.preventDefault();drag.clientX=e.clientX;drag.clientY=e.clientY;let dx=(e.clientX-drag.startX)/drag.zoom,dy=e.shiftKey&&!drag.resize?0:(e.clientY-drag.startY)/drag.zoom;if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<2)return;
 const page=filmSize(state);
 if(drag.film==='image'){
  const gapX=page.width-drag.rect.w,gapY=page.height-drag.rect.h;
  state.film={...filmSettings(state),x:Math.abs(gapX)<1?.5:clamp(drag.origin.x+dx/gapX,0,1),y:Math.abs(gapY)<1?.5:clamp(drag.origin.y+dy/gapY,0,1)};
 }else{
  if(!drag.moved){const all=(filmGeometry||filmLayout(state,measureRun)).blocks;for(const b of all){setFilmFormat(b,'x',b.x);setFilmFormat(b,'y',b.y);}}
  const r=drag.bounds;
  if(drag.resize)for(const b of drag.original)setFilmFormat(b,'w',clamp(b.w+dx,Math.min(80,page.width-b.x),page.width-b.x));
  else{
   const snap=snapEdge(r.x+dx+r.w/2,[page.width/2],6/drag.zoom);if(snap)dx+=snap.delta;
   dx=clamp(dx,-r.x,page.width-r.x-r.w);dy=clamp(dy,-r.y,Math.max(-r.y,page.height-r.y-r.h));
   for(const b of drag.original){setFilmFormat(b,'x',b.x+dx);setFilmFormat(b,'y',e.shiftKey?b.y:b.y+dy);}
  }
 }
 drag.moved=true;updateCanvas();renderOverlays();
}
function nudgeFilm(key,step){
 const blocks=selection().filter(b=>b.type==='text').map(displayBlock);if(!blocks.length)return;const page=filmSize(state);
 change(()=>{for(const b of blocks){setFilmFormat(b,'x',clamp(b.x+(key==='ArrowLeft'?-step:key==='ArrowRight'?step:0),0,page.width-b.w));setFilmFormat(b,'y',clamp(b.y+(key==='ArrowUp'?-step:key==='ArrowDown'?step:0),0,Math.max(0,page.height-b.metrics.h)));}});
}
$('pngLayout').onchange=e=>{
 finishInlineEdit();endTyping();const value=e.target.value;
 change(()=>{state.pngLayout=value;if(value==='film'&&!state.film)state.film=filmSettings(state);if(value==='margin'&&!state.marginLayout){state.marginLayout=marginSettings(state);$('marginHeaderGroup').open=true;}if(value==='film'){alignmentMode='text';$('filmImageGroup').open=true;}});
};
$('filmUpload').onclick=()=>$('filmFile').click();
$('filmFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;$('filmUpload').disabled=true;
 try{const id=await storeFilmImage(file);finishInlineEdit();endTyping();change(()=>{state.film={...filmSettings(state),imageId:id,imageName:file.name,x:.5,y:.5};});}
 catch{notify('이미지 불러오기 실패');}
 finally{e.target.value='';$('filmUpload').disabled=false;}
};
$('filmRemove').onclick=()=>change(()=>{state.film={...filmSettings(state),imageId:null,imageName:''};});
$('filmCenter').onclick=()=>change(()=>{state.film={...filmSettings(state),x:.5,y:.5};});
for(const [id,key] of filmTextControls)$(id).onchange=e=>{endTyping();change(()=>setFilmSetting(key,e.target.value));};
for(const [id,key] of filmToggleControls)$(id).onchange=e=>change(()=>setFilmSetting(key,e.target.checked));
for(const [id,key,unit] of filmSliderControls)bindSlider($(id),v=>setFilmSetting(key,v),v=>$(id+'Value').textContent=v+unit);
for(const [id,key] of filmTimeControls)$(id).onchange=e=>{
 const seconds=playerSeconds(e.target.value);
 if(seconds===null||seconds>86400||key==='playerDuration'&&seconds===0){e.target.value=playerTime(filmSettings(state)[key]);notify('시간 형식 오류');return;}
 endTyping();change(()=>{setFilmSetting(key,seconds);state.film=filmSettings(state);});e.target.value=playerTime(filmSettings(state)[key]);
};
function renderSettings(){
 renderFilmSettings();renderMarginSettings();const html=htmlSettings(state),isHTML=editorMode==='html',film=!isHTML&&state.pngLayout==='film',margin=!isHTML&&state.pngLayout==='margin',m=marginSettings(state);
 $('backgroundTitle').textContent=isHTML?'배경 및 색상':'배경';$('color2').closest('label').hidden=!isHTML&&state.background==='solid';
 $('color1').closest('label').firstChild.textContent=isHTML?'본문 배경':state.background==='solid'?'바탕색':'색 1';$('color2').closest('label').firstChild.textContent=isHTML?'바깥 배경':'색 2';
 $('color1').value=isHTML?html.surface:state.colors[0];$('color2').value=isHTML?html.background:state.colors[1];
 for(const [id,key] of [['color1','surface'],['color2','background'],['htmlTextColor','textColor'],['htmlAccent','accent'],['htmlMuted','muted'],['htmlBorder','border']]){$(id+'Value').textContent=html[key].toUpperCase();if(isHTML)$(id).value=html[key];}
 $('noise').value=state.noise;$('noiseValue').textContent=state.noise+'%';$('pageWidth').value=film?filmSettings(state).width:margin?m.width:state.width;$('pageMargin').value=state.margin;
 for(const [id,key] of [['htmlWidth','width'],['htmlPadding','padding'],['htmlGap','gap'],['htmlAccent','accent'],['htmlMuted','muted'],['htmlBorder','border'],['htmlRadius','radius'],['htmlHeaderDecoration','headerDecoration'],['htmlFooterDecoration','footerDecoration'],['htmlDecorationLabel','decorationLabel']])$(id).value=html[key];
 $('htmlGapValue').textContent=html.gap+'px';$('htmlFrame').checked=html.frame;$('htmlFrameFields').hidden=!html.frame;$('htmlDecoration').checked=html.decoration;$('htmlDecorationFields').hidden=!html.decoration;$('htmlDecorationLabel').closest('label').hidden=html.footerDecoration!=='editorial';
 $('palettes').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',palettes[i].background===state.background&&JSON.stringify(palettes[i].colors)===JSON.stringify(state.colors)));
}
function decorateSummaries(){
 for(const summary of document.querySelectorAll('summary')){
  if(summary.classList.contains('paragraph-heading'))continue;
  if(summary.closest('.selection-help')){if(!summary.querySelector('svg'))summary.innerHTML=icons['circle-help'];continue;}
  if(!summary.querySelector('.summary-chevron')){const arrow=document.createElement('span');arrow.className='summary-chevron';arrow.setAttribute('aria-hidden','true');arrow.innerHTML=icons['chevron-down'];summary.append(arrow);}
 }
}
function render(){cancelAnimationFrame(renderFrame);renderFrame=0;const ids=new Set(state.blocks.map(b=>b.id));for(const id of metricCache.keys())if(!ids.has(id))metricCache.delete(id);loadUsedFonts().catch(()=>{});updateCanvas();renderList();renderOverlays();renderSelection();renderQuoteSettings();renderReplacements();renderSettings();decorateSummaries();updateHistory();}

function startDrag(e,id){if(editorMode==='html'||e.button!==0)return;if(state.pngLayout==='film'){startFilmDrag(e,id);return;}if(state.pngLayout==='margin'){e.preventDefault();select(id,e.shiftKey||e.ctrlKey||e.metaKey);return;}finishInlineEdit();e.preventDefault();const resize=!!e.target.dataset.resize;if(e.shiftKey||e.ctrlKey||e.metaKey){select(id,true);return;}if(!selected.has(id))select(id);const blocks=selection();e.currentTarget.focus({preventScroll:true});drag={startX:e.clientX,startY:e.clientY,before:snapshot(),original:blocks.map(b=>({...b,w:resize?metrics(b).w:b.w,...widthLimit(b)})),bounds:bounds(blocks),resize,moved:false,zoom};document.body.style.userSelect='none';}
function onDrag(e){
 if(!drag)return;if(drag.film){onFilmDrag(e);return;}e.preventDefault();drag.clientX=e.clientX;drag.clientY=e.clientY;let dx=(e.clientX-drag.startX)/drag.zoom,dy=e.shiftKey&&!drag.resize?0:(e.clientY-drag.startY)/drag.zoom;if(Math.abs(dx)+Math.abs(dy)<2&&!drag.moved)return;if(!drag.moved&&!drag.resize)state.blocks.forEach(b=>b.auto=false);drag.moved=true;let gx=null,gy=null;
 const columnLeft=(state.width-bodyWidth())/2,xs=[state.margin,columnLeft,state.width/2,columnLeft+bodyWidth(),state.width-state.margin],ys=[state.margin];state.blocks.filter(b=>!selected.has(b.id)).forEach(b=>{xs.push(b.x,b.x+metrics(b).w/2,b.x+metrics(b).w);ys.push(b.y,b.y+metrics(b).h);});
 if(drag.resize){gx=snapEdge(drag.bounds.x+drag.bounds.w+dx,xs,6/drag.zoom);if(gx)dx+=gx.delta;for(const item of resizeWidths(drag.original,dx))setBlockWidth(state.blocks.find(b=>b.id===item.id),item.w);}
 else{const r=drag.bounds;let bestX=6/drag.zoom,bestY=6/drag.zoom;for(const edge of [0,r.w/2,r.w]){const snap=snapEdge(r.x+dx+edge,xs,bestX);if(snap){gx=snap;bestX=Math.abs(snap.delta);}}if(!e.shiftKey)for(const edge of [0,r.h]){const snap=snapEdge(r.y+dy+edge,ys,bestY);if(snap){gy=snap;bestY=Math.abs(snap.delta);}}if(gx)dx+=gx.delta;if(gy)dy+=gy.delta;const d=constrainDelta(r,dx,dy,state.width);for(const o of drag.original){const b=state.blocks.find(b=>b.id===o.id);b.auto=false;if(b.presentation==='chat')b.messagePinned=false;b.x=Math.round(o.x+d.x);b.y=e.shiftKey?o.y:Math.round(o.y+d.y);}}
 updateCanvas();renderOverlays();if(gx)addGuide('vertical',gx.pos);if(gy)addGuide('horizontal',gy.pos);if(drag.resize){const r=bounds(selection());addGuide('vertical',r.x+r.w);}
}
function addGuide(direction,position,layout=false){const e=document.createElement('div');e.className='guide '+direction+(layout?' layout-guide':'');e.style[direction==='vertical'?'left':'top']=position+'px';$('overlays').append(e);}
function finishDrag(cancel=false){if(!drag)return;if(drag.film){const before=drag.before,moved=drag.moved;drag=null;document.body.style.userSelect='';if(cancel)state=JSON.parse(before);else if(moved)record(before);filmGeometry=null;render();return;}const {before,moved,resize,original}=drag;drag=null;document.body.style.userSelect='';if(cancel)state=JSON.parse(before);else if(moved){if(!resize)for(const o of original){const b=state.blocks.find(b=>b.id===o.id);if(b?.presentation==='chat'){b.messageSide=b.x+metrics(b).w/2>=state.width/2?'right':'left';b.messagePinned=true;pinMessage(b);}}record(before);}render();}
document.addEventListener('pointermove',onDrag,{passive:false});document.addEventListener('pointerup',()=>finishDrag());document.addEventListener('pointercancel',()=>finishDrag(true));window.addEventListener('blur',()=>finishDrag());
for(const type of ['keydown','keyup'])document.addEventListener(type,e=>{if(e.key==='Shift'&&drag&&!drag.resize)onDrag({clientX:drag.clientX??drag.startX,clientY:drag.clientY??drag.startY,shiftKey:type==='keydown',preventDefault(){}});});
$('board').addEventListener('pointerdown',e=>{if(e.target===canvas){if(editorMode==='png'&&state.pngLayout==='film'&&filmImage){startFilmBackground(e);return;}selected.clear();renderList();renderOverlays();renderSelection();}});
let typing=false,typingTimer;
function endTyping(){typing=false;clearTimeout(typingTimer);}
function updateText(id,runs){const b=state.blocks.find(b=>b.id===id);if(!b||JSON.stringify(blockRuns(b))===JSON.stringify(runs))return;const before=snapshot();b.runs=runs;b.text=runs.map(r=>r.text).join('');if(!typing)record(before);typing=true;clearTimeout(typingTimer);typingTimer=setTimeout(endTyping,700);if(inlineEdit?.id===id)renderList();loadUsedFonts().catch(()=>{});scheduleDraw();queueDraftSave();}
function textKeyDown(e){if(e.isComposing)return;if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();historyBack(e.shiftKey||e.key.toLowerCase()==='y');}}
function positionInlineEdit(){
 if(inlineEdit?.mode!=='png')return;
 const source=state.blocks.find(b=>b.id===inlineEdit.id);if(!source)return;const b=displayBlock(source);
 const m=metrics(b),{wrapper,input}=inlineEdit;
 Object.assign(wrapper.style,{position:'absolute',left:b.x+m.paddingX+m.textOffset+'px',top:b.y+m.paddingY+m.headerHeight+'px',width:m.textWidth+'px'});
 input.style.height='auto';input.style.minHeight=b.size*b.lineHeight+'px';input.style.height=Math.max(input.scrollHeight,m.h-m.paddingY*2-m.headerHeight)+'px';
}
function beginInlineEdit(id,event,lineIndex=0){
 const b=state.blocks.find(b=>b.id===id);if(!b||b.type!=='text'||inlineEdit?.id===id&&(editorMode!=='html'||inlineEdit.range?.index===lineIndex))return;
 finishInlineEdit();endTyping();
 const mode=editorMode,doc=mode==='html'?$('htmlPreview').contentDocument:document;
 let range=null;
 if(mode==='html'){
  const lines=b.text.split('\n'),index=clamp(lineIndex,0,lines.length-1),start=lines.slice(0,index).reduce((n,text)=>n+text.length+1,0);
  range={index,start,end:start+lines[index].length};htmlLineSelection={id,index};
 }
 const host=mode==='html'?doc?.querySelector('[data-block-id="'+id+'"] [data-line-index="'+range.index+'"]'):$('overlays');if(!host)return;
 selected=new Set([id]);if(mode==='html')activeHTMLTab=b.htmlTabId||activeHTMLTab;
 renderList();renderSelection();
 const getBlock=key=>{const block=state.blocks.find(b=>b.id===key);return block&&range?{...block,text:block.text.slice(range.start,range.end),runs:sliceRuns(blockRuns(block),range.start,range.end)}:block;};
 const commit=(key,runs)=>{const block=state.blocks.find(b=>b.id===key);if(!block)return;const next=range?spliceRuns(blockRuns(block),range.start,range.end,runs):runs;if(range)range.end=range.start+runs.reduce((n,r)=>n+r.text.length,0);updateText(key,next);};
 const wrapper=createEditor(id,{getBlock,select(){},onChange:commit,onKeyDown:inlineKeyDown,onBlur:endTyping,ownerDocument:doc});
 wrapper.className='stage-editor';wrapper.dataset.id=id;wrapper.style.cssText='box-sizing:border-box;min-width:20px;pointer-events:auto;background:transparent;outline:1px solid '+getComputedStyle(document.documentElement).getPropertyValue('--accent-line').trim()+';outline-offset:3px;border-radius:2px;';
 wrapper.querySelector('.text-formatting').style.display='none';wrapper.onpointerdown=e=>e.stopPropagation();wrapper.ondblclick=e=>e.stopPropagation();
 const input=wrapper.querySelector('.paragraph-input'),view=displayBlock(b),colors=presentationColors(view);
 input.dataset.blockId=id;input.setAttribute('aria-label',mode==='html'?'텍스트 블록 '+(range.index+1)+' 수정':'지면 문단 수정');
 input.style.cssText=`box-sizing:border-box;display:block;width:100%;min-height:1em;height:auto;margin:0;padding:0;border:0;outline:none;resize:none;overflow:visible;background:transparent;color:${colors.color};font-family:${fonts[view.font]||fonts.noto};font-size:${view.size}px;font-weight:${view.bold||view.presentation==='chapter'?700:400};line-height:${view.lineHeight};text-align:${view.align};white-space:pre-wrap;overflow-wrap:anywhere;font-synthesis:style;cursor:text;`;
 inlineEdit={id,mode,wrapper,input,range,commit};
 input.addEventListener('blur',finishInlineEdit);
 input.addEventListener('compositionstart',()=>{composingInput=input;});
 input.addEventListener('compositionend',()=>{if(composingInput===input)composingInput=null;});
 input.addEventListener('input',()=>{if(composingInput===input)queueDraftSave();});
 if(mode==='html'){host.replaceChildren(wrapper);host.style.display='block';}else{host.append(wrapper);updateCanvas();renderOverlays();}
 input.focus({preventScroll:true});
 const caretRange=doc.createRange();caretRange.selectNodeContents(input);caretRange.collapse(false);
 if(event){const point=doc.caretPositionFromPoint?.(event.clientX,event.clientY),hit=point?{node:point.offsetNode,offset:point.offset}:null,fallback=!hit&&doc.caretRangeFromPoint?.(event.clientX,event.clientY),node=hit?.node||fallback?.startContainer,offset=hit?.offset??fallback?.startOffset;if(node&&input.contains(node)){caretRange.setStart(node,offset);caretRange.collapse(true);}}
 const selection=doc.getSelection();selection.removeAllRanges();selection.addRange(caretRange);
}
function inlineKeyDown(e){
 if(e.isComposing)return;
 const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(mod&&(key==='z'||key==='y')){e.preventDefault();e.stopPropagation();const id=inlineEdit.id,index=inlineEdit.range?.index||0;finishInlineEdit();historyBack(key==='y'||e.shiftKey);beginInlineEdit(id,undefined,index);return;}
 if(e.key==='Escape'||mod&&e.key==='Enter'){e.preventDefault();e.stopPropagation();finishInlineEdit();}
}
function finishInlineEdit(){
 if(!inlineEdit)return;
 const current=inlineEdit;inlineEdit=null;
 if(state.blocks.some(b=>b.id===current.id))current.commit(current.id,readEditor(current.input));
 if(composingInput===current.input)composingInput=null;
 current.wrapper.remove();endTyping();render();
}
function editBlock(id){finishInlineEdit();const input=$('blockList').querySelector('[data-id="'+id+'"] .paragraph-input');if(input){input.closest('details').open=true;input.focus();input.scrollIntoView({block:'nearest'});}}
function chatMembers(){return state.blocks.filter(b=>editorMode!=='html'||b.htmlTabId===activeHTMLTab);}
function renderChatAdd(){
 const last=chatMembers().findLast(b=>b.type==='text'&&b.presentation==='chat');
 $('addChat').hidden=editorMode==='html'?htmlCodeView:['film','margin'].includes(state.pngLayout)||!last;
 $('addChat').title=$('addChat').ariaLabel=(last&&last.messageSide!=='right'?'오른쪽':'왼쪽')+' 말풍선 추가';
}
function addChatBubble(){
 finishInlineEdit();endTyping();const members=chatMembers(),last=members.findLast(b=>b.type==='text'&&b.presentation==='chat'),template=last||members.findLast(b=>b.type==='text');if(!last&&editorMode!=='html')return;
 let id;change(()=>{
  const b=newBlock();id=b.id;
  for(const key of ['font','size','lineHeight','color','bold','align','padding','messageColor','messageBox','messageOpacity'])if(template?.[key]!==undefined)b[key]=template[key];
  if(template?.htmlStyle)b.htmlStyle={...template.htmlStyle};
  Object.assign(b,{presentation:'chat',messageSide:last&&last.messageSide!=='right'?'right':'left',w:template?.w??Math.round(bodyWidth()*.78),messageFit:true,messagePinned:true,auto:!state.blocks.some(b=>b.auto===false)});
  b.y=Math.max(state.margin,...state.blocks.map(b=>b.y+metrics(b).h+32));pinMessage(b);
  state.blocks.splice(members.length?state.blocks.indexOf(members.at(-1))+1:state.blocks.length,0,b);selected=new Set([id]);
  if(editorMode==='html'){const tab=state.htmlTabs.find(t=>t.id===activeHTMLTab);if(tab)tab.open=true;}
 });
 const target=editorMode==='html'?$('htmlPreview').contentDocument.querySelector('[data-block-id="'+id+'"]'):$('overlays').querySelector('.block-overlay[data-id="'+id+'"]');
 if(editorMode==='html')$('htmlPreview').scrollIntoView({block:'end',inline:'nearest'});target?.scrollIntoView({block:'nearest',inline:'nearest'});beginInlineEdit(id);
}
const addChat=document.createElement('button');addChat.id='addChat';addChat.type='button';addChat.className='stage-chat-add';addChat.hidden=true;addChat.innerHTML=icons.plus+'<span>말풍선</span>';addChat.onclick=addChatBubble;$('stageScroll').append(addChat);
const fontLoads=new Map();
function loadUsedFonts(){const jobs=[];if(editorMode==='png'&&state.pngLayout==='margin'){const m=marginSettings(state);if(m.header||m.footer)jobs.push(document.fonts.load('400 28px '+fonts.pretendard,(m.header?'CHAPTER'+m.chapter+m.subtitle+m.title+m.description:'')+(m.footer?m.footerText+m.pageText:'')));}for(const source of state.blocks){const b=displayBlock(source);if(b.type!=='text')continue;const family=fonts[b.font]||fonts.noto,weights=new Set([400,...(b.presentation==='chapter'||b.presentation==='notification'&&b.messageSender||quoteSettings().enabled&&quoteSettings().bold?[700]:[]),...blockRuns(b).map(r=>r.bold||b.bold?700:400)]);for(const weight of weights){const key=family+':'+weight;if(!fontLoads.has(key)){const job=document.fonts.load(weight+' 22px '+family,b.text||'한글').then(()=>{metricCache.clear();scheduleDraw();}).catch(error=>{notify('글꼴 불러오기 실패');throw error;});fontLoads.set(key,job);job.catch(()=>{});}jobs.push(fontLoads.get(key));}}return Promise.all(jobs);}
function insertParagraphs(text,{eachLine=false,append=false}={}){const paragraphs=splitParagraphs(text,eachLine);if(!paragraphs.length){notify('입력된 글 없음');return false;}change(()=>{const fresh=paragraphs.map(t=>newBlock(t)),color=state.blocks.find(b=>b.type==='text')?.color||state.textColor;fresh.forEach(b=>{b.w=bodyWidth();b.color=color;});if(append&&!state.demo){let y=Math.max(state.margin,...state.blocks.map(b=>b.y+metrics(b).h+32));fresh.forEach(b=>{b.x=(state.width-bodyWidth())/2;b.y=y;y+=metrics(b).h+32;});state.blocks.push(...fresh);fitHeight();}else{state.blocks=editorMode==='html'?[...state.blocks.filter(b=>b.htmlTabId!==activeHTMLTab),...fresh]:fresh;if(editorMode==='png')autoLayout();}state.demo=false;selected=new Set([fresh[0].id]);});$('stageScroll').scrollTop=0;notify(`${paragraphs.length}개 문단 추가됨`);return true;}
$('addText').onclick=()=>{finishInlineEdit();endTyping();change(()=>{const b=inheritParagraphFormat(newBlock());b.x=(state.width-b.w)/2;b.y=Math.max(state.margin,...state.blocks.map(x=>x.y+metrics(x).h+32));b.auto=!state.blocks.some(x=>x.auto===false);state.blocks.push(b);selected=new Set([b.id]);});editBlock(state.blocks.at(-1).id);};
$('addLine').onclick=()=>change(()=>{const b=newBlock('','line');b.x=(state.width-bodyWidth())/2;b.w=bodyWidth()/3;b.color=state.blocks[0]?.color||'#f4eee2';b.y=Math.max(state.margin,...state.blocks.map(x=>x.y+metrics(x).h+24));state.blocks.push(b);selected=new Set([b.id]);alignmentMode='layer';});
$('autoLayout').onclick=()=>{change(autoLayout);notify('자동 배치 완료');};
$('undo').onclick=()=>historyBack();$('redo').onclick=()=>historyBack(true);$('zoomOut').onclick=()=>{fitMode=false;zoom=clamp(zoom-.1,.15,1.5);updateZoom();};$('zoomIn').onclick=()=>{fitMode=false;zoom=clamp(zoom+.1,.15,1.5);updateZoom();};$('zoomLabel').onclick=()=>{fitMode=false;zoom=1;updateZoom();};$('zoomFit').onclick=()=>{fitMode=true;updateZoom();};new ResizeObserver(()=>{if(fitMode)updateZoom();}).observe($('stageScroll'));
palettes.forEach(p=>{const button=document.createElement('button');button.className='palette';button.title=p.name;button.setAttribute('aria-label',p.name);const label=document.createElement('span');label.className='palette-name';label.textContent=p.background==='solid'?'단색':'그라데이션';button.append(label);button.style.background=p.background==='solid'?p.colors[0]:gradientCSS(p.colors);button.onclick=()=>change(()=>{state.background=p.background;state.colors=[...p.colors];state.textColor=p.text;state.noise=p.noise;state.blocks.forEach(b=>b.color=p.text);});$('palettes').append(button);});
for(let i=0;i<2;i++)$('color'+(i+1)).onchange=e=>change(()=>{if(editorMode==='html')setHTMLSetting(i===0?'surface':'background',e.target.value);else state.colors[i]=e.target.value;});
bindSlider($('noise'),v=>state.noise=v,v=>$('noiseValue').textContent=v+'%');
$('pageWidth').onchange=e=>change(()=>{const next=clamp(+e.target.value,400,1600);if(state.pngLayout==='film'){setFilmSetting('width',next);return;}if(state.pngLayout==='margin'){setMarginSetting('width',next);return;}const ratio=next/state.width;state.blocks.forEach(b=>{b.x*=ratio;b.w*=ratio;});state.width=next;state.margin=Math.min(state.margin,next/3);fitHeight();});$('pageMargin').onchange=e=>change(()=>{state.margin=clamp(+e.target.value,24,Math.min(160,state.width/3));autoLayout();notify('여백 적용됨');});
function pngOutput(requestedScale=pngScale){const page=state.pngLayout==='film'?filmSize(state):state.pngLayout==='margin'?(marginGeometry||marginLayout(state,measureRun)):state,scale=Math.min(requestedScale,16000/page.height,Math.sqrt(16000000/(page.width*page.height)));return {width:Math.floor(page.width*scale),height:Math.floor(page.height*scale),scale};}
function renderPNGOptions(){
 $('pngScaleLabel').textContent=pngScale===2?'고화질 2배':'기본 크기';
 for(const button of $('pngScaleMenu').querySelectorAll('[data-png-scale]')){const value=+button.dataset.pngScale,{width,height}=pngOutput(value);button.setAttribute('aria-pressed',value===pngScale);button.querySelector('small').textContent=width+' × '+height+' px';}
}
$('pngScaleMenu').addEventListener('beforetoggle',e=>{if(e.newState!=='open')return;renderPNGOptions();const menu=$('pngScaleMenu'),r=$('pngScale').getBoundingClientRect(),width=Math.min(220,innerWidth-16);menu.style.width=width+'px';menu.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';menu.style.top=r.bottom+8+'px';});
for(const button of $('pngScaleMenu').querySelectorAll('[data-png-scale]'))button.onclick=()=>{pngScale=+button.dataset.pngScale;try{localStorage.setItem('writemisu-png-scale',String(pngScale));}catch{}renderPNGOptions();$('pngScaleMenu').hidePopover();$('pngScale').focus({preventScroll:true});};
window.addEventListener('resize',()=>$('pngScaleMenu').hidePopover());
async function savePNG(){finishInlineEdit();const exportScale=pngScale,button=$('savePNG');button.disabled=true;button.textContent='저장 준비 중…';try{if(state.pngLayout==='film')await ensureFilmImage();await loadUsedFonts();await document.fonts.ready;updateCanvas();await new Promise(requestAnimationFrame);const {width,height,scale}=pngOutput(exportScale),output=document.createElement('canvas');output.width=width;output.height=height;paint(output,scale);const blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('PNG 생성 실패')),'image/png'));const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='작성미수-'+new Date().toISOString().slice(0,10)+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);notify(`PNG 저장 시작 · ${output.width} × ${output.height}px`);output.width=output.height=1;}catch(error){notify('PNG 저장 실패');console.error(error);}finally{button.disabled=false;button.innerHTML=saveButtonContent;}}
for(const [id,name,label] of [['addText','plus','문단 추가'],['addLine','minus','구분선']])$(id).innerHTML=icons[name]+'<span>'+label+'</span>';
for(const [id,name] of [['addReplacement','plus'],['zoomOut','minus'],['zoomIn','plus']])$(id).innerHTML=icons[name];
$('pngScale').querySelector('.presentation-chevron').innerHTML=icons['chevron-down'];
for(const [id,icon] of [['undo','undo-2'],['redo','redo-2']])$(id).innerHTML=icons[icon];
const saveButtonContent=icons.download+'<span>PNG 저장</span>';
$('savePNG').innerHTML=saveButtonContent;$('savePNG').onclick=savePNG;
let htmlCodeView=false,htmlPreviewObserver,htmlLineSelection=null;
function resizeHTMLPreview(){const root=$('htmlPreview').contentDocument?.body.firstElementChild;if(root)$('htmlPreview').style.height=Math.max(120,Math.ceil(root.getBoundingClientRect().height))+'px';}
function bindHTMLChatDrag(body){
 for(const bubble of body.querySelectorAll('[data-chat-id]')){
  let move=null;
  bubble.onpointerdown=e=>{if(e.button!==0||inlineEdit)return;move={x:e.clientX,y:e.clientY,rect:bubble.getBoundingClientRect(),row:bubble.parentElement.getBoundingClientRect(),dx:0,moved:false};};
  bubble.onpointermove=e=>{
   if(!move)return;const dx=e.clientX-move.x;if(!move.moved&&(Math.abs(dx)<6||Math.abs(dx)<Math.abs(e.clientY-move.y)))return;
   e.preventDefault();if(!move.moved)bubble.setPointerCapture(e.pointerId);move.moved=true;
   move.dx=clamp(dx,move.row.left-move.rect.left,move.row.right-move.rect.right);bubble.style.transform='translateX('+move.dx+'px)';bubble.style.cursor='grabbing';body.style.userSelect='none';
  };
  const finish=cancel=>{
   if(!move)return;const current=move;move=null;bubble.style.transform='';bubble.style.cursor='grab';body.style.userSelect='';
   if(cancel||!current.moved)return;
   const side=current.rect.left+current.rect.width/2+current.dx>=current.row.left+current.row.width/2?'right':'left';
   endTyping();change(()=>{const b=state.blocks.find(b=>b.id===bubble.dataset.chatId);if(!b)return;b.messageSide=side;b.messagePinned=true;activeHTMLTab=b.htmlTabId;selected=new Set([b.id]);});
  };
  bubble.onpointerup=()=>finish(false);bubble.onpointercancel=()=>finish(true);bubble.onlostpointercapture=()=>finish(true);
 }
}
function renderHTMLPreview(){
 const html=exportHTML(state),settings=htmlSettings(state),frame=$('htmlPreview');
 $('htmlCode').value=html;$('htmlSizeLabel').textContent=settings.width+'px';frame.style.maxWidth=settings.width+'px';
 const body=frame.contentDocument?.body;if(!body||!frame.dataset.ready)return;
 if(inlineEdit?.mode==='html'){resizeHTMLPreview();return;}
 htmlPreviewObserver?.disconnect();body.innerHTML=exportHTML(state,{preview:true,selectedLine:htmlLineSelection});
 body.onclick=e=>{
  const line=e.target.closest('[data-line-index]');if(!line||e.target.closest('.stage-editor'))return;
  const id=line.closest('[data-block-id]').dataset.blockId,block=state.blocks.find(b=>b.id===id);if(!block)return;
  const previous=body.querySelector('[data-line-selected]');if(previous){delete previous.dataset.lineSelected;previous.setAttribute('aria-pressed','false');}
  line.dataset.lineSelected='true';line.setAttribute('aria-pressed','true');htmlLineSelection={id,index:+line.dataset.lineIndex};activeHTMLTab=block.htmlTabId||activeHTMLTab;select(id);
 };
 body.ondblclick=e=>{const target=e.target.closest('[data-line-index]');if(target&&!e.target.closest('.stage-editor')){e.preventDefault();beginInlineEdit(target.closest('[data-block-id]').dataset.blockId,e,+target.dataset.lineIndex);}};
 body.onkeydown=e=>{const target=e.target.closest('[data-line-index]');if(target&&e.target===target&&['Enter','F2'].includes(e.key)){e.preventDefault();beginInlineEdit(target.closest('[data-block-id]').dataset.blockId,undefined,+target.dataset.lineIndex);}};
 bindHTMLChatDrag(body);
 const blocks=state.htmlTabs?htmlGroups(state).filter(t=>t.collapse!==false):state.blocks.filter(b=>b.type==='text'&&b.htmlCollapse!==false);body.querySelectorAll('details').forEach((details,i)=>{const id=blocks[i].id;details.ontoggle=()=>{
  if(!details.isConnected)return;
  const block=state.htmlTabs?state.htmlTabs.find(t=>t.id===id):state.blocks.find(b=>b.id===id),key=state.htmlTabs?'open':'htmlOpen';
  if(block&&Boolean(block[key])!==details.open){endTyping();const before=snapshot();block[key]=details.open;record(before);$('htmlCode').value=exportHTML(state);renderList();}
  resizeHTMLPreview();
 };});
 htmlPreviewObserver.observe(body.firstElementChild);resizeHTMLPreview();
}
function setHTMLView(code){htmlCodeView=code;$('htmlCode').hidden=!code;$('htmlPreview').hidden=code;$('htmlPreviewTab').setAttribute('aria-pressed',!code);$('htmlCodeTab').setAttribute('aria-pressed',code);renderChatAdd();if(!code)resizeHTMLPreview();}
function renderMode(){
 const html=editorMode==='html';document.body.classList.toggle('html-mode',html);
 (html?document.querySelector('.stage-footer'):$('stageScroll')).append($('addChat'));
 for(const element of document.querySelectorAll('[data-png-only]'))element.hidden=html;
 for(const element of document.querySelectorAll('[data-html-only]'))element.hidden=!html;
 $('pngMode').setAttribute('aria-pressed',!html);$('htmlMode').setAttribute('aria-pressed',html);$('stageTitle').textContent=html?'HTML':'지면';
 const frame=$('htmlPreview');if(html&&!frame.hasAttribute('srcdoc')){
  frame.onload=()=>{frame.dataset.ready='true';htmlPreviewObserver?.disconnect();htmlPreviewObserver=new ResizeObserver(resizeHTMLPreview);renderHTMLPreview();frame.contentDocument.fonts.ready.then(resizeHTMLPreview);};
  const fontURL=new URL('fonts.css',import.meta.url).href;
  frame.srcdoc='<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="'+fontURL+'"><style>body{margin:0}summary:focus-visible{outline:2px solid #40566b;outline-offset:3px}[data-line-index]{border-radius:3px;cursor:text}[data-line-index]:hover{outline:1px solid #8d9cb566;outline-offset:3px}[data-line-selected],[data-line-index]:focus-visible{outline:1px solid #8799bd;outline-offset:3px}[data-line-index]:has(.stage-editor){outline:none}</style></head><body></body></html>';
 }
 setHTMLView(htmlCodeView);
}
function setEditorMode(mode){finishInlineEdit();finishDrag();endTyping();closePresentationMenus();$('pngScaleMenu').hidePopover();editorMode=mode;alignmentMode='text';selected=new Set(selection().slice(0,1).map(b=>b.id));try{localStorage.setItem('writemisu-mode',mode);}catch{}renderMode();render();$('stageScroll').scrollTop=0;}
$('pngMode').onclick=()=>setEditorMode('png');$('htmlMode').onclick=()=>setEditorMode('html');
$('htmlPreviewTab').onclick=()=>setHTMLView(false);$('htmlCodeTab').onclick=()=>setHTMLView(true);
for(const [id,key,min,max] of [['htmlWidth','width',280,1600],['htmlPadding','padding',0,120],['htmlRadius','radius',0,40]])$(id).onchange=e=>change(()=>setHTMLSetting(key,clamp(+e.target.value,min,max)));
for(const [id,key] of [['htmlAccent','accent'],['htmlMuted','muted'],['htmlBorder','border'],['htmlHeaderDecoration','headerDecoration'],['htmlFooterDecoration','footerDecoration'],['htmlDecorationLabel','decorationLabel']])$(id).onchange=e=>change(()=>setHTMLSetting(key,e.target.value));
for(const [id,key] of [['htmlFrame','frame'],['htmlDecoration','decoration']])$(id).onchange=e=>change(()=>setHTMLSetting(key,e.target.checked));
$('htmlTextColor').onchange=e=>change(()=>{setHTMLSetting('textColor',e.target.value);state.blocks.forEach(b=>{setFormat(b,'color',e.target.value);if(b.presentation&&b.presentation!=='plain')setFormat(b,'messageColor',e.target.value);});});
$('htmlReset').onclick=()=>{endTyping();change(()=>{state.htmlSettings=htmlSettings({});state.blocks.forEach(b=>delete b.htmlStyle);});};
bindSlider($('htmlGap'),value=>state.htmlSettings={...htmlSettings(state),gap:value},value=>$('htmlGapValue').textContent=value+'px');
async function copyHTML(formatted=false){
 finishInlineEdit();const html=exportHTML(state);
 try{
  if(formatted){const doc=new DOMParser().parseFromString(html,'text/html');await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([doc.body.textContent],{type:'text/plain'})})]);}
  else await navigator.clipboard.writeText(html);
  notify(formatted?'글 복사 완료':'HTML 복사 완료');
 }catch{setHTMLView(true);$('htmlCode').value=html;$('htmlCode').focus();$('htmlCode').select();notify('클립보드 접근 차단');}
}
$('copyHTML').onclick=()=>copyHTML();$('copyRichHTML').onclick=()=>copyHTML(true);
const sidebar=$('editorSidebar'),sidebarResize=$('sidebarResize'),workspace=sidebar.parentElement;
let sidebarDrag=null;
function setSidebarWidth(width){workspace.style.setProperty('--sidebar-width',clamp(width,280,window.innerWidth/2)+'px');updateSidebarRange();}
function updateSidebarRange(){sidebarResize.setAttribute('aria-valuemin',280);sidebarResize.setAttribute('aria-valuemax',Math.floor(window.innerWidth/2));sidebarResize.setAttribute('aria-valuenow',Math.round(sidebar.getBoundingClientRect().width));}
sidebarResize.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();closePresentationMenus();sidebarDrag={x:e.clientX,width:sidebar.getBoundingClientRect().width};sidebarResize.setPointerCapture(e.pointerId);document.body.classList.add('resizing-sidebar');};
sidebarResize.onpointermove=e=>{if(sidebarDrag)setSidebarWidth(sidebarDrag.width+e.clientX-sidebarDrag.x);};
function endSidebarResize(){sidebarDrag=null;document.body.classList.remove('resizing-sidebar');}
sidebarResize.onpointerup=sidebarResize.onpointercancel=sidebarResize.onlostpointercapture=endSidebarResize;
window.addEventListener('blur',endSidebarResize);
sidebarResize.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const width=sidebar.getBoundingClientRect().width;setSidebarWidth(e.key==='Home'?280:e.key==='End'?window.innerWidth/2:width+(e.key==='ArrowLeft'?-10:10));}};
window.addEventListener('resize',()=>{if(window.innerWidth>960&&workspace.style.getPropertyValue('--sidebar-width'))setSidebarWidth(parseFloat(workspace.style.getPropertyValue('--sidebar-width')));else updateSidebarRange();});
updateSidebarRange();
function setDesignOpen(open){closePresentationMenus();$('designSidebar').hidden=!open;workspace.classList.toggle('design-open',open);$('designTab').setAttribute('aria-expanded',open);$('designTab').setAttribute('aria-pressed',open);$('designTab').setAttribute('aria-label',open?'디자인 닫기':'디자인 열기');$('designTab').title=open?'디자인 닫기':'디자인 열기';}
$('designTab').innerHTML=icons['sliders-horizontal']+'<span>디자인</span>';
$('designTab').onclick=()=>setDesignOpen($('designSidebar').hidden);
$('closeDesign').innerHTML=icons['panel-left-close'];$('closeDesign').onclick=()=>setDesignOpen(false);
document.addEventListener('keydown',e=>{if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();historyBack(e.shiftKey);return;}if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();historyBack(true);return;}if(e.key==='Escape'){if(drag)finishDrag(true);else{selected.clear();renderOverlays();renderList();renderSelection();}return;}if(editorMode==='png'&&mod&&e.key.toLowerCase()==='a'){e.preventDefault();selected=new Set(state.blocks.map(b=>b.id));renderOverlays();renderList();renderSelection();return;}if(editorMode==='html')return;if(state.pngLayout==='margin'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();return;}if(state.pngLayout==='film'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();nudgeFilm(e.key,e.shiftKey?10:1);return;}if(!selected.size)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?10:1;change(()=>{state.blocks.forEach(b=>b.auto=false);const blocks=selection(),r=bounds(blocks),d=constrainDelta(r,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0,state.width);blocks.forEach(b=>{b.auto=false;if(b.presentation==='chat')b.messagePinned=false;b.x+=d.x;b.y+=d.y;});});}if(e.key==='Delete'){e.preventDefault();change(()=>{state.blocks=state.blocks.filter(b=>!selected.has(b.id));selected.clear();});}});
renderMode();
let draftDirty=!!restoredDraft?.pending,draftTimer=null,draftErrorShown=false,composingInput=null;
function draftStatus(text,failed=false){const node=$('draftStatus');if(node.textContent!==text)node.textContent=text;if(node.dataset.failed!==String(failed))node.dataset.failed=failed;}
function queueDraftSave(){draftDirty=true;draftStatus('임시저장 중…');if(draftTimer===null)draftTimer=setTimeout(flushDraft,500);}
function flushDraft(){
 clearTimeout(draftTimer);draftTimer=null;if(!draftDirty)return true;
 if(renderFrame&&editorMode==='png'){flowLayout();fitHeight();}let draftState=state;
 // Only uncommitted IME text needs a DOM read; all other edits are already in state.
 if(composingInput?.isConnected){const id=composingInput.dataset?.blockId||composingInput.closest('.paragraph-editor').dataset.id,edited=readEditor(composingInput);draftState={...state,blocks:state.blocks.map(b=>{if(b.id!==id)return b;const range=inlineEdit?.input===composingInput?inlineEdit.range:null,runs=range?spliceRuns(blockRuns(b),range.start,range.end,edited):edited;return {...b,runs,text:runs.map(r=>r.text).join('')};})};}
 if(draftState.film?.imageId)draftState={...draftState,film:{...draftState.film,imageId:null,imageName:''}};
 const draft={version:1,state:draftState,counter},data=JSON.stringify(draft);
 const saved=writeDraft(()=>localStorage,data),sessionSaved=writeDraft(()=>sessionStorage,saved?data:JSON.stringify({...draft,pending:true}));
 if(!sessionSaved){try{sessionStorage.removeItem('writemisu-draft-v1');}catch{}}
 draftDirty=!saved;draftStatus(saved?'임시저장됨':'임시저장 실패',!saved);
 if(!saved&&!draftErrorShown){draftErrorShown=true;notify('임시저장 사용 불가');}if(saved)draftErrorShown=false;
 return saved;
}
document.addEventListener('compositionstart',e=>{composingInput=e.target.closest('.paragraph-input');});
document.addEventListener('compositionend',()=>{composingInput=null;});
document.addEventListener('input',()=>{if(composingInput)queueDraftSave();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){finishDrag();flushDraft();}});
window.addEventListener('pagehide',()=>{finishDrag();flushDraft();});
window.addEventListener('beforeunload',e=>{finishDrag();if(!flushDraft()){e.preventDefault();e.returnValue='';}});
draftStatus(restoredDraft?'임시저장 복원됨':'자동 임시저장');
if(restoredDraft?.pending||htmlMigrated)queueDraftSave();

render();document.fonts.ready.then(()=>{metricCache.clear();scheduleDraw();});
if(document.modelContext?.registerTool){const lifecycle=new AbortController(),register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'read_layout',description:'Read paragraph order, text, positions, background settings and webfont load status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({...structuredClone(state),fonts:Array.from(document.fonts,f=>({family:f.family,weight:f.weight,status:f.status}))})});
  register({name:'insert_paragraphs',description:'Replace the current text or append paragraphs when append is true. The change can be undone.',inputSchema:{type:'object',properties:{text:{type:'string'},append:{type:'boolean'}},required:['text'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>{if(typeof input?.text!=='string'||!input.text.trim()||(input.append!==undefined&&typeof input.append!=='boolean'))throw Error('text must be non-empty and append must be boolean');insertParagraphs(input.text,{append:!!input.append});return {paragraphs:state.blocks.length};}});
}
