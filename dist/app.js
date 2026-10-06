import {blockRuns,positionedRuns,fillTextWithSpaces,lineHighlights} from './richtext.js';
import {blockMetrics,presentationColors,messageX,chatPath} from './messages.js';
import {createEditor,syncEditor,readEditor} from './editor.js';
import {readDraft,writeDraft} from './draft.js';
import {replaceBlocks} from './replace.js';
import {exportHTML,htmlSettings} from './html.js';
import {icons} from './icons.js';
import {splitParagraphs,constrainDelta,fonts,radialGeometry,gradientCSS,alignedX,resizeWidths,verticalPositions,reorderBlocks,snapEdge} from './core.js';
const $=id=>document.getElementById(id),canvas=$('artwork'),ctx=canvas.getContext('2d');
const palettes=[{name:'깊은 밤',background:'radial',colors:['#2d3643','#57545f'],text:'#f0edf5',noise:18},{name:'책 내지',background:'solid',colors:['#f5f5f5','#f5f5f5'],text:'#333333',noise:0}];
let pngScale=1;try{if(localStorage.getItem('writemisu-png-scale')==='2')pngScale=2;}catch{}
let editorMode='png';try{if(localStorage.getItem('writemisu-mode')==='html')editorMode='html';}catch{}
let counter=0,preferredFont='kopubBatang';
try{const saved=localStorage.getItem('letter-studio-font');if(Object.hasOwn(fonts,saved))preferredFont=saved;}catch{}
function defaultFontSize(font){return (font==='freesentation'?20:12)*4/3;}
function newBlock(text='',type='text'){return {id:'b'+(++counter),type,text,x:(state.width-bodyWidth())/2,y:state.margin,w:bodyWidth(),size:defaultFontSize(preferredFont),lineHeight:1.85,font:preferredFont,auto:true,color:state.textColor,align:'left',bold:false,padding:state.padding,box:'#ffffff',opacity:0,group:null};}
let state={width:800,height:260,margin:80,padding:0,background:'solid',colors:[...palettes[1].colors],textColor:palettes[1].text,noise:0,seed:741,blocks:[],demo:false};
const tabDraft=readDraft(()=>sessionStorage),restoredDraft=tabDraft||readDraft(()=>localStorage);
if(restoredDraft){state=restoredDraft.state;counter=restoredDraft.counter;if(!tabDraft)writeDraft(()=>sessionStorage,JSON.stringify({version:1,...restoredDraft}));}else state.blocks.push(newBlock());
let selected=new Set(state.blocks[0]?[state.blocks[0].id]:[]),undoStack=[],redoStack=[],alignmentMode='text',zoom=.7,fitMode=true,drag=null,bgKey='',background=null,renderFrame=0,toastTimer;
const snapshot=()=>JSON.stringify(state);
function record(before=snapshot()){if(undoStack.at(-1)!==before)undoStack.push(before);if(undoStack.length>60)undoStack.shift();redoStack=[];updateHistory();queueDraftSave();}
function change(fn){const before=snapshot();fn();if(snapshot()!==before)record(before);render();}
function updateHistory(){$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;}
function historyBack(forward=false){const from=forward?redoStack:undoStack,to=forward?undoStack:redoStack;if(!from.length)return;to.push(snapshot());state=JSON.parse(from.pop());endTyping();selected=new Set([...selected].filter(id=>state.blocks.some(b=>b.id===id)));render();queueDraftSave();notify(forward?'다시 실행됨':'실행 취소됨');}
function notify(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
function selection(){return state.blocks.filter(b=>selected.has(b.id));}
function fontString(b,run={}){return `${run.bold||b.bold?'700':'400'} ${b.size}px ${fonts[b.font]}`;}
function measureRun(b,text,run){ctx.font=fontString(b,run);return ctx.measureText(text).width;}
const metricCache=new Map();
function metrics(b){const key=[b.text,b.w,b.padding,b.size,b.lineHeight,b.font,b.bold,b.presentation,b.messageSender,b.messageTitle,b.messageTime,b.messageSide,b.messageFit,JSON.stringify(b.runs),JSON.stringify(state.quoteStyle),JSON.stringify(state.replacementRules)].join('|'),cached=metricCache.get(b.id);if(cached?.key===key)return cached.value;const display=replaceBlocks([b],state.replacementRules||[]).blocks[0],value={...blockMetrics(display,(text,run)=>measureRun(b,text,run),state.quoteStyle),messageTitle:display.messageTitle,messageTime:display.messageTime};metricCache.set(b.id,{key,value});return value;}
function bounds(blocks){if(!blocks.length)return null;const x=Math.min(...blocks.map(b=>b.x)),y=Math.min(...blocks.map(b=>b.y));return {x,y,w:Math.max(...blocks.map(b=>b.x+metrics(b).w))-x,h:Math.max(...blocks.map(b=>b.y+metrics(b).h))-y};}
function fitHeight(){state.height=Math.ceil(Math.max(state.margin*2+100,...state.blocks.map(b=>b.y+metrics(b).h+state.margin)));}
function bodyWidth(){return Math.min(480,state.width-state.margin*2);}
function createPresentationControls(id){
 const host=document.createElement('div');host.className='presentation-controls';
 host.innerHTML='<div class="presentation-picker"><span>표현</span><button type="button" class="presentation-trigger" data-presentation aria-haspopup="listbox" aria-expanded="false"><span data-presentation-label>본문</span><span class="presentation-chevron" aria-hidden="true"></span></button><div class="presentation-menu" popover="auto" role="listbox" aria-label="표현"><button type="button" role="option" tabindex="-1" data-value="plain">본문</button><button type="button" role="option" tabindex="-1" data-value="chapter">챕터 제목</button><button type="button" role="option" tabindex="-1" data-value="notification">문자 메시지 알림</button><button type="button" role="option" tabindex="-1" data-value="chat">문자 대화 표현</button></div></div><div class="message-side segmented" hidden><button type="button" data-side="left">왼쪽</button><button type="button" data-side="right">오른쪽</button></div><div class="notification-fields" hidden><label>제목<input type="text" data-message="messageTitle" placeholder="메시지"></label><label>시간<input type="text" data-message="messageTime" placeholder="지금"></label><label class="sender-field">발신자<input type="text" data-message="messageSender" placeholder="발신자 이름"></label></div>';
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
function flowLayout(){let y=state.margin;for(const b of state.blocks){if(b.auto!==false)b.y=y;if(b.presentation==='chat'&&b.messagePinned!==false)pinMessage(b);y=Math.max(y,b.y+metrics(b).h+32);}}
function autoLayout(){state.blocks.forEach(b=>{b.auto=true;if(b.type!=='line')b.w=b.presentation==='chat'?Math.round(bodyWidth()*.78):bodyWidth();b.x=(state.width-bodyWidth())/2;if(b.presentation==='chat'){b.messagePinned=true;b.messageFit=true;}});flowLayout();fitHeight();}
function clamp(n,min,max){return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;}

// A deterministic texture keeps preview and export identical.
function hash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263)+state.seed*1447;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function smoothNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;}
function getBackground(){const key=JSON.stringify([state.width,state.height,state.background,state.colors,state.noise,state.seed]);if(key===bgKey)return background;const c=document.createElement('canvas');const scale=Math.min(1,12000/state.height);c.width=Math.max(1,Math.round(state.width*scale));c.height=Math.round(state.height*scale);const g=c.getContext('2d'),{x,y,radius}=radialGeometry(c.width,c.height);
  const gradient=g.createRadialGradient(x,y,0,x,y,radius);state.colors.forEach((color,i)=>gradient.addColorStop(i/(state.colors.length-1),color));g.fillStyle=state.background==='solid'?state.colors[0]:gradient;g.fillRect(0,0,c.width,c.height);
  if(state.noise){const pixels=g.getImageData(0,0,c.width,c.height),data=pixels.data;let random=state.seed;const fw=Math.ceil(c.width/8)+1,fh=Math.ceil(c.height/8)+1,field=new Float32Array(fw*fh);for(let y=0;y<fh;y++)for(let x=0;x<fw;x++)field[y*fw+x]=smoothNoise(x/12,y/12)*.6+smoothNoise(x/6,y/6)*.27+smoothNoise(x/3,y/3)*.13-.5;for(let y=0;y<c.height;y++){const row=Math.floor(y/8)*fw;for(let x=0;x<c.width;x++){random^=random<<13;random^=random>>>17;random^=random<<5;const value=(((random>>>0)/4294967295-.5)*.75+field[row+Math.floor(x/8)]*.65)*state.noise,i=(y*c.width+x)*4;data[i]+=value;data[i+1]+=value;data[i+2]+=value;}}g.putImageData(pixels,0,0);}background=c;bgKey=key;return c;}
function paint(target,scale=1){const c=target.getContext('2d');c.setTransform(scale,0,0,scale,0,0);c.drawImage(getBackground(),0,0,state.width,state.height);for(const b of state.blocks){const m=metrics(b),colors=presentationColors(b);if(colors.opacity>0){c.globalAlpha=colors.opacity/100;c.fillStyle=colors.box;if(b.presentation==='chat'){chatPath(c,b.x,b.y,m,b.messageSide);c.fill();}else if(b.presentation==='notification'){c.beginPath();c.roundRect(b.x,b.y,m.w,m.h,14);c.fill();}else c.fillRect(b.x,b.y,m.w,m.h);c.globalAlpha=1;}c.fillStyle=colors.color;if(b.type==='line'){c.fillRect(b.x,b.y+11,b.w,1);continue;}if(m.markerSize)c.fillRect(b.x+m.paddingX,b.y+m.paddingY+(b.size*b.lineHeight-m.markerSize)/2,m.markerSize,m.markerSize);c.textBaseline='alphabetic';c.textAlign='left';if(b.presentation==='notification')paintMessageHeader(c,b,m);c.font=fontString(b);const h=b.size*b.lineHeight,sample=c.measureText('한글Ag'),ascent=sample.actualBoundingBoxAscent||b.size*.8,descent=sample.actualBoundingBoxDescent||b.size*.2,width=m.textWidth;for(let i=0;i<m.lines.length;i++){const y=b.y+m.paddingY+m.headerHeight+i*h+(h-ascent-descent)/2+ascent;const runs=positionedRuns(m.lines[i],width,b.align,(text,style)=>measureRun(b,text,style));for(const run of lineHighlights(runs)){c.fillStyle=run.highlight;c.globalAlpha=run.highlightOpacity/100;c.fillRect(b.x+m.paddingX+m.textOffset+run.x,y-ascent-2,run.w,Math.min(h,ascent+descent+4));c.globalAlpha=1;}for(const run of runs){c.fillStyle=run.color||colors.color;c.font=fontString(b,run);const x=b.x+m.paddingX+m.textOffset+run.x;if(run.italic){c.save();c.translate(x,y);c.transform(1,0,-.21,1,0,0);fillTextWithSpaces(c,run.text,0,0);c.restore();}else fillTextWithSpaces(c,run.text,x,y);const thickness=Math.max(1,b.size/18);if(run.underline)c.fillRect(x,y+Math.max(2,descent/2),run.w,thickness);if(run.strike)c.fillRect(x,y-ascent*.38,run.w,thickness);}}}c.setTransform(1,0,0,1,0,0);}
function updateCanvas(){if(editorMode==='html'){renderHTMLPreview();return;}flowLayout();fitHeight();const ratio=Math.min(1,12000/state.height,Math.sqrt(12000000/(state.width*state.height)));const width=Math.ceil(state.width*ratio),height=Math.ceil(state.height*ratio);if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;paint(canvas,ratio);$('board').style.width=state.width+'px';$('board').style.height=state.height+'px';$('sizeLabel').textContent=`${state.width} × ${Math.round(state.height)} px`;renderPNGOptions();updateZoom();}
function updateZoom(){if(editorMode==='html')return;if(fitMode){const host=$('stageScroll'),style=getComputedStyle(host),width=host.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=host.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);zoom=clamp(Math.min(width/state.width,height/state.height),.15,1);}$('board').style.transform=`scale(${zoom})`;$('boardShell').style.width=state.width*zoom+'px';$('boardShell').style.height=state.height*zoom+'px';$('zoomLabel').textContent=Math.round(zoom*100)+'%';}
function moveBlock(id,direction){
 endTyping();if(editorMode==='html'){change(()=>{const index=state.blocks.findIndex(b=>b.id===id),to=index+direction;if(index>=0&&to>=0&&to<state.blocks.length)[state.blocks[index],state.blocks[to]]=[state.blocks[to],state.blocks[index]];selected=new Set([id]);});return;}flowLayout();
 change(()=>{state.blocks=reorderBlocks(state.blocks,id,direction,b=>metrics(b).h);selected=new Set([id]);});
 const card=$('blockList').querySelector('[data-id="'+id+'"]'),button=card.querySelector('[data-move="'+direction+'"]');
 (button.disabled?card.querySelector('.block-row'):button).focus({preventScroll:true});card.scrollIntoView({block:'nearest'});
 const b=state.blocks.find(b=>b.id===id);$('stageScroll').scrollTo({top:Math.max(0,b.y*zoom-60),behavior:'smooth'});
}
function renderList(){
 const list=$('blockList');for(const child of Array.from(list.children))if(!state.blocks.some(b=>b.id===child.dataset.id))child.remove();
 state.blocks.forEach((b,i)=>{
  let card=list.querySelector('[data-id="'+b.id+'"]');
  if(!card){
   const id=b.id;card=document.createElement('div');card.className='paragraph-editor';card.dataset.id=id;
   const button=document.createElement('button');button.className='block-row';button.onclick=e=>{select(id,e.shiftKey||e.ctrlKey||e.metaKey);const current=state.blocks.find(x=>x.id===id);if(current&&editorMode==='png')$('stageScroll').scrollTo({top:Math.max(0,current.y*zoom-60),behavior:'smooth'});};
   const header=document.createElement('div');header.className='paragraph-heading';header.append(button);
   for(const [direction,icon] of [[-1,'arrow-up'],[1,'arrow-down']]){const move=document.createElement('button');move.type='button';move.className='paragraph-move';move.dataset.move=direction;move.innerHTML=icons[icon];move.onclick=()=>moveBlock(id,direction);header.append(move);}
   const remove=document.createElement('button');remove.className='paragraph-delete';remove.textContent='삭제';remove.onclick=()=>change(()=>{state.blocks=state.blocks.filter(x=>x.id!==id);selected.delete(id);});header.append(remove);card.append(header);
   if(b.type==='text'){
    const label=document.createElement('label');label.className='html-summary-field';label.textContent='접기 제목';label.dataset.htmlOnly='';
    const input=document.createElement('input');input.type='text';input.onfocus=()=>{endTyping();if(!selected.has(id))select(id);};input.onblur=endTyping;input.onkeydown=textKeyDown;
    input.oninput=()=>{const block=state.blocks.find(x=>x.id===id),before=snapshot();block.htmlSummary=input.value;if(!typing)record(before);typing=true;clearTimeout(typingTimer);typingTimer=setTimeout(endTyping,700);scheduleDraw();queueDraftSave();};label.append(input);card.append(label,createPresentationControls(id));
   }
   if(b.type==='text')card.append(createEditor(id,{getBlock:key=>state.blocks.find(x=>x.id===key),select:key=>{if(!selected.has(key))select(key);},onChange:updateText,onKeyDown:textKeyDown,onBlur:endTyping}));
  }
  const button=card.querySelector('.block-row'),label=(b.type==='line'?'구분선 ':'문단 ')+(i+1);
  card.querySelector('.paragraph-delete').setAttribute('aria-label',label+' 삭제');
  for(const move of card.querySelectorAll('[data-move]')){const up=move.dataset.move==='-1';move.disabled=up?i===0:i===state.blocks.length-1;move.title=up?'위로 이동':'아래로 이동';move.setAttribute('aria-label',label+' '+move.title);}
  button.textContent=label+(editorMode==='png'&&b.group?' · 묶음':'');button.setAttribute('aria-label',button.textContent+' 선택');button.setAttribute('aria-pressed',selected.has(b.id));card.classList.toggle('selected',selected.has(b.id));
  const summary=card.querySelector('.html-summary-field');if(summary){summary.hidden=editorMode!=='html';const field=summary.querySelector('input');field.value=b.htmlSummary||'';field.placeholder='문단 '+(i+1);field.setAttribute('aria-label','문단 '+(i+1)+' 접기 제목');}
  const input=card.querySelector('.paragraph-input');if(input){syncPresentationControls(card,b,i);input.setAttribute('aria-label','문단 '+(i+1)+' 내용');syncEditor(input,b);}
  if(list.children[i]!==card)list.insertBefore(card,list.children[i]||null);
 });
}
function renderOverlays(){
 const host=$('overlays');if(editorMode==='html'){host.replaceChildren();return;}host.querySelectorAll('.guide,.multi-selection').forEach(e=>e.remove());
 for(const child of Array.from(host.children))if(!state.blocks.some(b=>b.id===child.dataset.id))child.remove();
 for(const b of state.blocks){let overlay=host.querySelector('[data-id="'+b.id+'"]');if(!overlay){overlay=document.createElement('div');overlay.dataset.id=b.id;overlay.tabIndex=0;overlay.setAttribute('role','button');overlay.innerHTML='<span class="drag-label"></span><span class="resize-handle" data-resize="true" title="문단 너비"></span>';overlay.onpointerdown=e=>startDrag(e,b.id);overlay.ondblclick=()=>editBlock(b.id);overlay.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();select(b.id);editBlock(b.id);}};host.append(overlay);}overlay.className='block-overlay'+(selected.has(b.id)?' selected':'');overlay.setAttribute('aria-label',(b.type==='line'?'구분선':b.text.slice(0,40))+'. 드래그해서 이동, Enter로 수정');overlay.style.cssText='left:'+b.x+'px;top:'+b.y+'px;width:'+metrics(b).w+'px;height:'+metrics(b).h+'px';overlay.querySelector('.drag-label').textContent=b.group?'묶음':b.presentation==='chat'?'문자 대화':b.presentation==='notification'?'메시지 알림':b.presentation==='chapter'?'챕터 제목':'문단';overlay.querySelector('.resize-handle').hidden=!(selected.size===1&&selected.has(b.id));}
 const blocks=selection();if(blocks.length>1){const r=bounds(blocks),frame=document.createElement('div');frame.className='multi-selection';frame.tabIndex=0;frame.setAttribute('role','group');frame.setAttribute('aria-label','선택 문단 전체');frame.style.cssText='left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px';frame.innerHTML='<span class="resize-handle" data-resize="true" title="선택 문단 너비 함께 조절"></span>';frame.onpointerdown=e=>startDrag(e,blocks[0].id);host.append(frame);}
 if(blocks.length){addGuide('vertical',state.margin,true);addGuide('vertical',state.width-state.margin,true);}
}
function select(id,multiple=false){const b=state.blocks.find(b=>b.id===id);if(!b)return;if(b.type==='line'&&editorMode==='png')alignmentMode='layer';if(editorMode==='html')multiple=false;const ids=editorMode==='png'&&b.group?state.blocks.filter(x=>x.group===b.group).map(x=>x.id):[id];if(multiple){if(ids.every(key=>selected.has(key)))ids.forEach(key=>selected.delete(key));else ids.forEach(key=>selected.add(key));}else selected=new Set(ids);renderList();renderOverlays();renderSelection();}
function formatTargets(){const chosen=selection();return chosen.length?chosen:state.blocks.filter(b=>b.type==='text');}
function quoteSettings(){return state.quoteStyle||{enabled:false,color:null,highlight:state.textColor,highlightOpacity:8,bold:false,italic:false,underline:false,strike:false};}
function renderQuoteSettings(){
 const q=quoteSettings(),host=$('quoteControls');
 host.innerHTML='<div class="quote-heading"><h3>대사 서식 <span>전체 문단</span></h3><button id="quoteEnabled" class="quote-switch" role="switch" aria-label="대사 자동 서식" aria-checked="'+q.enabled+'" aria-controls="quoteFields">'+(q.enabled?'ON':'OFF')+'</button></div><div id="quoteFields" '+(q.enabled?'':'hidden')+'><div class="color-row"><label>하이라이트 색<input id="quoteHighlight" type="color" value="'+q.highlight+'"></label></div><label class="range-label">하이라이트 농도<output id="quoteOpacityValue">'+q.highlightOpacity+'%</output><input id="quoteOpacity" aria-label="대사 하이라이트 농도" type="range" min="0" max="100" value="'+q.highlightOpacity+'"></label><label class="quote-color-toggle"><input id="quoteCustomColor" type="checkbox" '+(q.color?'checked':'')+'>글자색 변경</label><div class="color-row" '+(q.color?'':'hidden')+'><label>대사 글자색<input id="quoteColor" type="color" value="'+(q.color||state.textColor)+'"></label></div><div class="text-formatting" id="quoteMarks" role="toolbar" aria-label="대사 글자 서식"></div></div>';
 const update=fn=>change(()=>{state.quoteStyle={...quoteSettings()};fn(state.quoteStyle);});
 $('quoteEnabled').onclick=()=>update(s=>s.enabled=!s.enabled);
 $('quoteCustomColor').onchange=e=>update(s=>s.color=e.target.checked?state.textColor:null);
 for(const [id,key] of [['quoteHighlight','highlight'],['quoteColor','color']])$(id).onchange=e=>update(s=>s[key]=e.target.value);
 bindSlider($('quoteOpacity'),value=>{state.quoteStyle={...quoteSettings(),highlightOpacity:value};},value=>$('quoteOpacityValue').textContent=value+'%');
 for(const [key,label] of [['bold','굵게'],['italic','기울임'],['underline','밑줄'],['strike','취소선']]){const button=document.createElement('button');button.type='button';button.innerHTML=icons[key==='strike'?'strikethrough':key];button.title='대사 '+label;button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',q[key]);button.onclick=()=>update(s=>s[key]=!s[key]);$('quoteMarks').append(button);}
}
function renderTypography(){const blocks=formatTargets(),b=blocks[0]||{font:preferredFont,size:defaultFontSize(preferredFont),lineHeight:1.85,color:state.textColor,box:'#ffffff',bold:false,opacity:0,align:'left'},colors=presentationColors(b),host=$('typographyControls');
 host.innerHTML=`<h3>글자</h3><label class="full-field">글꼴<select id="blockFont"><optgroup label="본문"><option value="kopubDotum">코펍돋움</option><option value="kopubBatang">코펍바탕</option><option value="pretendard">프리텐다드</option><option value="noto">Noto Serif KR</option></optgroup><optgroup label="헤더"><option value="freesentation">프리젠테이션</option></optgroup></select></label><label class="range-label">글자 크기<output id="fontSizeValue">${Math.round(b.size*75)/100}pt</output><input id="fontSize" aria-label="글자 크기" type="range" min="9" max="75" step=".5" value="${b.size*3/4}"></label><label class="range-label">행간<output id="lineHeightValue">${b.lineHeight.toFixed(2)}배</output><input id="lineHeight" aria-label="행간" type="range" min="1" max="3" step=".05" value="${b.lineHeight}"></label><div class="alignment-control"><h4>정렬</h4><div class="segmented" role="tablist" aria-label="정렬 방식"><button id="textAlignTab" role="tab" aria-controls="alignmentButtons">글 정렬</button><button id="layerAlignTab" role="tab" aria-controls="alignmentButtons">레이어 정렬</button></div><div id="alignmentButtons" class="align-buttons" role="tabpanel"></div></div><div class="color-row"><label>글자 색<input id="textColor" type="color" value="${colors.color}"></label><label>박스 색<input id="boxColor" type="color" value="${colors.box}"></label></div><label class="range-label">박스 불투명도<output id="opacityValue">${colors.opacity}%</output><input id="boxOpacity" type="range" min="0" max="100" value="${colors.opacity}"></label>`;
 $('blockFont').value=b.font;$('blockFont').onchange=e=>{preferredFont=e.target.value;try{localStorage.setItem('letter-studio-font',preferredFont);}catch{}change(()=>formatTargets().forEach(x=>{x.font=preferredFont;x.size=defaultFontSize(preferredFont);}));};
 bindSlider($('fontSize'),v=>formatTargets().forEach(x=>x.size=v*4/3),v=>{$('fontSizeValue').textContent=v+'pt';});bindSlider($('lineHeight'),v=>formatTargets().forEach(x=>x.lineHeight=v),v=>{$('lineHeightValue').textContent=v.toFixed(2)+'배';});
 for(const [id,key] of [['textColor','color'],['boxColor','box']])$(id).onchange=e=>{const value=e.target.type==='checkbox'?e.target.checked:e.target.value;change(()=>formatTargets().forEach(x=>x[x.presentation&&x.presentation!=='plain'?key==='color'?'messageColor':'messageBox':key]=value));};
 bindSlider($('boxOpacity'),v=>formatTargets().forEach(x=>x[x.presentation&&x.presentation!=='plain'?'messageOpacity':'opacity']=v),v=>$('opacityValue').textContent=v+'%');
 $('textAlignTab').onclick=()=>{alignmentMode='text';renderAlignment();};$('layerAlignTab').onclick=()=>{alignmentMode='layer';renderAlignment();};renderAlignment();
}
function renderAlignment(){if(editorMode==='html')alignmentMode='text';$('layerAlignTab').hidden=editorMode==='html';const isText=alignmentMode==='text',blocks=isText?formatTargets().filter(b=>b.type==='text'):selection(),host=$('alignmentButtons'),rect=blocks.length?bounds(blocks):null;host.replaceChildren();host.setAttribute('aria-labelledby',isText?'textAlignTab':'layerAlignTab');for(const [id,active] of [['textAlignTab',isText],['layerAlignTab',!isText]]){$(id).setAttribute('aria-selected',active);$(id).tabIndex=active?0:-1;$(id).onkeydown=e=>{if(editorMode==='png'&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();e.stopPropagation();alignmentMode=isText?'layer':'text';renderAlignment();$(alignmentMode==='text'?'textAlignTab':'layerAlignTab').focus();}};}
 for(const [align,label] of [['left','왼쪽'],['center','가운데'],['right','오른쪽'],...(isText?[['justify','양쪽']]:[])]){const button=document.createElement('button');button.innerHTML=icons[isText?{left:'text-align-start',center:'text-align-center',right:'text-align-end',justify:'text-align-justify'}[align]:{left:'align-start-vertical',center:'align-center-vertical',right:'align-end-vertical'}[align]];button.title=(isText?'글 ':'레이어 ')+label+' 정렬';button.setAttribute('aria-label',button.title);button.disabled=!blocks.length;button.setAttribute('aria-pressed',isText?blocks.length>0&&blocks.every(b=>b.align===align):!!rect&&Math.abs(rect.x-alignedX(align,rect.w,state.width,state.margin))<1);button.onclick=()=>change(()=>{if(isText)blocks.forEach(b=>b.align=align);else{const r=bounds(blocks),dx=alignedX(align,r.w,state.width,state.margin)-r.x;blocks.forEach(b=>{b.auto=false;if(b.presentation==='chat')b.messagePinned=false;b.x+=dx;if(b.type==='line')b.align=align;});}});host.append(button);}
}
function widthLimit(b){const maxWidth=state.width-b.x;return {minWidth:Math.min(metrics(b).w,maxWidth,Math.max(80,b.padding*2+40)),maxWidth};}
function setBlockWidth(b,width){const limits=widthLimit(b);b.w=clamp(width,limits.minWidth,limits.maxWidth);if(b.presentation==='chat'){b.messageFit=false;b.messagePinned=false;}}
function arrangeSelection(gap){const blocks=selection();if(blocks.length<2)return;state.blocks.forEach(b=>b.auto=false);for(const position of verticalPositions(blocks.map(b=>({id:b.id,y:b.y,h:metrics(b).h})),gap))state.blocks.find(b=>b.id===position.id).y=position.y;}
function renderSelection(){
 renderTypography();if(editorMode==='html'){$('selectionPanel').hidden=true;return;}const blocks=selection(),b=blocks[0],host=$('selectionControls'),detailsOpen=!!host.querySelector('details[open]');host.replaceChildren();$('selectionPanel').hidden=!b;$('selectionTitle').textContent=blocks.length>1?blocks.length+'개 문단 선택':b?.type==='line'?'선택한 구분선':'선택한 문단';if(!b)return;
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
   row.innerHTML='<div class="replacement-fields"><label>찾을 단어<input data-replacement="find" type="text" autocomplete="off" spellcheck="false"></label><label>표시할 글자<input data-replacement="replace" type="text" autocomplete="off" spellcheck="false"></label></div><button type="button" class="replacement-delete">삭제</button>';
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
$('addReplacement').onclick=()=>{endTyping();change(()=>{state.replacementRules=[...replacementRules(),{find:'',replace:''}];});const input=$('replacementRows').lastElementChild.querySelector('input');input.focus();input.scrollIntoView({block:'nearest'});};
function renderSettings(){$('backgroundTitle').textContent=editorMode==='html'?'접기 창':'배경';$('color2').closest('label').hidden=editorMode==='html'||state.background==='solid';$('color1').closest('label').firstChild.textContent=editorMode==='html'?'창 배경색':state.background==='solid'?'바탕색':'색 1';state.colors.forEach((v,i)=>$('color'+(i+1)).value=v);$('noise').value=state.noise;$('noiseValue').textContent=state.noise+'%';$('pageWidth').value=state.width;$('pageMargin').value=state.margin;const html=htmlSettings(state);$('htmlWidth').value=html.width;$('htmlPadding').value=html.padding;$('htmlGap').value=html.gap;$('htmlGapValue').textContent=html.gap+'px';$('palettes').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',palettes[i].background===state.background&&JSON.stringify(palettes[i].colors)===JSON.stringify(state.colors)));}
function render(){cancelAnimationFrame(renderFrame);renderFrame=0;const ids=new Set(state.blocks.map(b=>b.id));for(const id of metricCache.keys())if(!ids.has(id))metricCache.delete(id);loadUsedFonts().catch(()=>{});updateCanvas();renderList();renderOverlays();renderSelection();renderQuoteSettings();renderReplacements();renderSettings();updateHistory();}

function startDrag(e,id){if(editorMode==='html'||e.button!==0)return;e.preventDefault();const resize=!!e.target.dataset.resize;if(e.shiftKey||e.ctrlKey||e.metaKey){select(id,true);return;}if(!selected.has(id))select(id);const blocks=selection();e.currentTarget.focus({preventScroll:true});drag={startX:e.clientX,startY:e.clientY,before:snapshot(),original:blocks.map(b=>({...b,w:resize?metrics(b).w:b.w,...widthLimit(b)})),bounds:bounds(blocks),resize,moved:false,zoom};document.body.style.userSelect='none';}
function onDrag(e){
 if(!drag)return;e.preventDefault();let dx=(e.clientX-drag.startX)/drag.zoom,dy=(e.clientY-drag.startY)/drag.zoom;if(Math.abs(dx)+Math.abs(dy)<2&&!drag.moved)return;if(!drag.moved&&!drag.resize)state.blocks.forEach(b=>b.auto=false);drag.moved=true;let gx=null,gy=null;
 const columnLeft=(state.width-bodyWidth())/2,xs=[state.margin,columnLeft,state.width/2,columnLeft+bodyWidth(),state.width-state.margin],ys=[state.margin];state.blocks.filter(b=>!selected.has(b.id)).forEach(b=>{xs.push(b.x,b.x+metrics(b).w/2,b.x+metrics(b).w);ys.push(b.y,b.y+metrics(b).h);});
 if(drag.resize){gx=snapEdge(drag.bounds.x+drag.bounds.w+dx,xs,6/drag.zoom);if(gx)dx+=gx.delta;for(const item of resizeWidths(drag.original,dx))setBlockWidth(state.blocks.find(b=>b.id===item.id),item.w);}
 else{const r=drag.bounds;let bestX=6/drag.zoom,bestY=6/drag.zoom;for(const edge of [0,r.w/2,r.w]){const snap=snapEdge(r.x+dx+edge,xs,bestX);if(snap){gx=snap;bestX=Math.abs(snap.delta);}}for(const edge of [0,r.h]){const snap=snapEdge(r.y+dy+edge,ys,bestY);if(snap){gy=snap;bestY=Math.abs(snap.delta);}}if(gx)dx+=gx.delta;if(gy)dy+=gy.delta;const d=constrainDelta(r,dx,dy,state.width);for(const o of drag.original){const b=state.blocks.find(b=>b.id===o.id);b.auto=false;if(b.presentation==='chat')b.messagePinned=false;b.x=Math.round(o.x+d.x);b.y=Math.round(o.y+d.y);}}
 updateCanvas();renderOverlays();if(gx)addGuide('vertical',gx.pos);if(gy)addGuide('horizontal',gy.pos);if(drag.resize){const r=bounds(selection());addGuide('vertical',r.x+r.w);}
}
function addGuide(direction,position,layout=false){const e=document.createElement('div');e.className='guide '+direction+(layout?' layout-guide':'');e.style[direction==='vertical'?'left':'top']=position+'px';$('overlays').append(e);}
function finishDrag(cancel=false){if(!drag)return;const {before,moved}=drag;drag=null;document.body.style.userSelect='';if(cancel)state=JSON.parse(before);else if(moved)record(before);render();}
document.addEventListener('pointermove',onDrag,{passive:false});document.addEventListener('pointerup',()=>finishDrag());document.addEventListener('pointercancel',()=>finishDrag(true));window.addEventListener('blur',()=>finishDrag());
$('board').addEventListener('pointerdown',e=>{if(e.target===canvas){selected.clear();renderList();renderOverlays();renderSelection();}});
let typing=false,typingTimer;
function endTyping(){typing=false;clearTimeout(typingTimer);}
function updateText(id,runs){const b=state.blocks.find(b=>b.id===id);if(!b||JSON.stringify(blockRuns(b))===JSON.stringify(runs))return;const before=snapshot();b.runs=runs;b.text=runs.map(r=>r.text).join('');if(!typing)record(before);typing=true;clearTimeout(typingTimer);typingTimer=setTimeout(endTyping,700);loadUsedFonts().catch(()=>{});scheduleDraw();queueDraftSave();}
function textKeyDown(e){if(e.isComposing)return;if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();historyBack(e.shiftKey||e.key.toLowerCase()==='y');}}
function editBlock(id){const input=$('blockList').querySelector('[data-id="'+id+'"] .paragraph-input');if(input){input.focus();input.scrollIntoView({block:'nearest'});}}
const fontLoads=new Map();
function loadUsedFonts(){const jobs=[];for(const b of state.blocks){if(b.type!=='text')continue;const family=fonts[b.font]||fonts.noto,weights=new Set([400,...(b.presentation==='chapter'||b.presentation==='notification'&&b.messageSender||state.quoteStyle?.enabled&&state.quoteStyle.bold?[700]:[]),...blockRuns(b).map(r=>r.bold||b.bold?700:400)]);for(const weight of weights){const key=family+':'+weight;if(!fontLoads.has(key)){const job=document.fonts.load(weight+' 22px '+family,b.text||'한글').then(()=>{metricCache.clear();scheduleDraw();}).catch(error=>{notify('글꼴을 불러오지 못했어. 연결을 확인해 줘.');throw error;});fontLoads.set(key,job);job.catch(()=>{});}jobs.push(fontLoads.get(key));}}return Promise.all(jobs);}
function insertParagraphs(text,{eachLine=false,append=false}={}){const paragraphs=splitParagraphs(text,eachLine);if(!paragraphs.length){notify('붙여 넣을 글을 입력하세요.');return false;}change(()=>{const fresh=paragraphs.map(t=>newBlock(t)),color=state.blocks.find(b=>b.type==='text')?.color||state.textColor;fresh.forEach(b=>{b.w=bodyWidth();b.color=color;});if(append&&!state.demo){let y=Math.max(state.margin,...state.blocks.map(b=>b.y+metrics(b).h+32));fresh.forEach(b=>{b.x=(state.width-bodyWidth())/2;b.y=y;y+=metrics(b).h+32;});state.blocks.push(...fresh);fitHeight();}else{state.blocks=fresh;autoLayout();}state.demo=false;selected=new Set([fresh[0].id]);});$('stageScroll').scrollTop=0;notify(`${paragraphs.length}개 문단 추가됨`);return true;}
$('addText').onclick=()=>{change(()=>{const b=newBlock();b.x=(state.width-bodyWidth())/2;b.w=bodyWidth();b.color=state.textColor;b.y=Math.max(state.margin,...state.blocks.map(x=>x.y+metrics(x).h+32));b.auto=!state.blocks.some(x=>x.auto===false);state.blocks.push(b);selected=new Set([b.id]);});editBlock(state.blocks.at(-1).id);};
$('addLine').onclick=()=>change(()=>{const b=newBlock('','line');b.x=(state.width-bodyWidth())/2;b.w=bodyWidth()/3;b.color=state.blocks[0]?.color||'#f4eee2';b.y=Math.max(state.margin,...state.blocks.map(x=>x.y+metrics(x).h+24));state.blocks.push(b);selected=new Set([b.id]);alignmentMode='layer';});
$('autoLayout').onclick=()=>{change(autoLayout);notify('자동 배치 완료');};
$('undo').onclick=()=>historyBack();$('redo').onclick=()=>historyBack(true);$('zoomOut').onclick=()=>{fitMode=false;zoom=clamp(zoom-.1,.15,1.5);updateZoom();};$('zoomIn').onclick=()=>{fitMode=false;zoom=clamp(zoom+.1,.15,1.5);updateZoom();};$('zoomFit').onclick=()=>{fitMode=true;updateZoom();};new ResizeObserver(()=>{if(fitMode)updateZoom();}).observe($('stageScroll'));
palettes.forEach(p=>{const button=document.createElement('button');button.className='palette';button.title=p.name;button.setAttribute('aria-label',p.name);const label=document.createElement('span');label.className='palette-name';label.textContent=p.background==='solid'?'단색':'그라데이션';button.append(label);button.style.background=p.background==='solid'?p.colors[0]:gradientCSS(p.colors);button.onclick=()=>change(()=>{state.background=p.background;state.colors=[...p.colors];state.textColor=p.text;state.noise=p.noise;state.blocks.forEach(b=>b.color=p.text);});$('palettes').append(button);});
for(let i=0;i<2;i++)$('color'+(i+1)).onchange=e=>change(()=>state.colors[i]=e.target.value);
bindSlider($('noise'),v=>state.noise=v,v=>$('noiseValue').textContent=v+'%');
$('pageWidth').onchange=e=>change(()=>{const next=clamp(+e.target.value,400,1600),ratio=next/state.width;state.blocks.forEach(b=>{b.x*=ratio;b.w*=ratio;});state.width=next;state.margin=Math.min(state.margin,next/3);fitHeight();});$('pageMargin').onchange=e=>change(()=>{state.margin=clamp(+e.target.value,24,Math.min(160,state.width/3));autoLayout();notify('여백 적용됨');});
function pngOutput(requestedScale=pngScale){const scale=Math.min(requestedScale,16000/state.height,Math.sqrt(16000000/(state.width*state.height)));return {width:Math.floor(state.width*scale),height:Math.floor(state.height*scale),scale};}
function renderPNGOptions(){
 $('pngScaleLabel').textContent=pngScale===2?'고화질 2배':'기본 크기';
 for(const button of $('pngScaleMenu').querySelectorAll('[data-png-scale]')){const value=+button.dataset.pngScale,{width,height}=pngOutput(value);button.setAttribute('aria-pressed',value===pngScale);button.querySelector('small').textContent=width+' × '+height+' px';}
}
$('pngScaleMenu').addEventListener('beforetoggle',e=>{if(e.newState!=='open')return;renderPNGOptions();const menu=$('pngScaleMenu'),r=$('pngScale').getBoundingClientRect(),width=Math.min(220,innerWidth-16);menu.style.width=width+'px';menu.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';menu.style.top=r.bottom+8+'px';});
for(const button of $('pngScaleMenu').querySelectorAll('[data-png-scale]'))button.onclick=()=>{pngScale=+button.dataset.pngScale;try{localStorage.setItem('writemisu-png-scale',String(pngScale));}catch{}renderPNGOptions();$('pngScaleMenu').hidePopover();$('pngScale').focus({preventScroll:true});};
window.addEventListener('resize',()=>$('pngScaleMenu').hidePopover());
async function savePNG(){const exportScale=pngScale,button=$('savePNG');button.disabled=true;button.textContent='저장 준비 중…';try{await loadUsedFonts();await document.fonts.ready;updateCanvas();await new Promise(requestAnimationFrame);const {width,height,scale}=pngOutput(exportScale),output=document.createElement('canvas');output.width=width;output.height=height;paint(output,scale);const blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('PNG 생성 실패')),'image/png'));const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='작성미수-'+new Date().toISOString().slice(0,10)+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);notify(`PNG 저장을 시작했어요. ${output.width} × ${output.height}px`);output.width=output.height=1;}catch(error){notify('PNG를 저장하지 못했어요. 글을 나눠서 다시 시도해 주세요.');console.error(error);}finally{button.disabled=false;button.innerHTML=saveButtonContent;}}
for(const [id,icon] of [['undo','undo-2'],['redo','redo-2']])$(id).innerHTML=icons[icon];
const saveButtonContent=icons.download+'<span>PNG 저장</span>';
$('savePNG').innerHTML=saveButtonContent;$('savePNG').onclick=savePNG;
let htmlCodeView=false,htmlPreviewObserver;
const htmlOpenIds=new Set();
function resizeHTMLPreview(){const root=$('htmlPreview').contentDocument?.body.firstElementChild;if(root)$('htmlPreview').style.height=Math.max(120,Math.ceil(root.getBoundingClientRect().height))+'px';}
function renderHTMLPreview(){
 const html=exportHTML(state),settings=htmlSettings(state),frame=$('htmlPreview');
 $('htmlCode').value=html;$('htmlSizeLabel').textContent='최대 '+settings.width+'px · HTML + 인라인';frame.style.maxWidth=settings.width+'px';
 const body=frame.contentDocument?.body;if(!body||!frame.dataset.ready)return;
 htmlPreviewObserver?.disconnect();body.innerHTML=html;
 const blocks=state.blocks.filter(b=>b.type==='text');body.querySelectorAll('details').forEach((details,i)=>{const id=blocks[i].id;details.open=htmlOpenIds.has(id);details.ontoggle=()=>{if(details.open)htmlOpenIds.add(id);else htmlOpenIds.delete(id);resizeHTMLPreview();};});
 htmlPreviewObserver.observe(body.firstElementChild);resizeHTMLPreview();
}
function setHTMLView(code){htmlCodeView=code;$('htmlCode').hidden=!code;$('htmlPreview').hidden=code;$('htmlPreviewTab').setAttribute('aria-pressed',!code);$('htmlCodeTab').setAttribute('aria-pressed',code);if(!code)resizeHTMLPreview();}
function renderMode(){
 const html=editorMode==='html';document.body.classList.toggle('html-mode',html);
 for(const element of document.querySelectorAll('[data-png-only]'))element.hidden=html;
 for(const element of document.querySelectorAll('[data-html-only]'))element.hidden=!html;
 $('pngMode').setAttribute('aria-pressed',!html);$('htmlMode').setAttribute('aria-pressed',html);$('stageTitle').textContent=html?'HTML':'지면';
 const frame=$('htmlPreview');if(html&&!frame.hasAttribute('srcdoc')){
  frame.onload=()=>{frame.dataset.ready='true';htmlPreviewObserver?.disconnect();htmlPreviewObserver=new ResizeObserver(resizeHTMLPreview);renderHTMLPreview();frame.contentDocument.fonts.ready.then(resizeHTMLPreview);};
  const fontURL=new URL('fonts.css',import.meta.url).href;
  frame.srcdoc='<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="'+fontURL+'"><style>body{margin:0}summary:focus-visible{outline:2px solid #40566b;outline-offset:3px}</style></head><body></body></html>';
 }
 setHTMLView(htmlCodeView);
}
function setEditorMode(mode){finishDrag();endTyping();closePresentationMenus();$('pngScaleMenu').hidePopover();editorMode=mode;alignmentMode='text';selected=new Set(selection().slice(0,1).map(b=>b.id));try{localStorage.setItem('writemisu-mode',mode);}catch{}renderMode();render();$('stageScroll').scrollTop=0;}
$('pngMode').onclick=()=>setEditorMode('png');$('htmlMode').onclick=()=>setEditorMode('html');
$('htmlPreviewTab').onclick=()=>setHTMLView(false);$('htmlCodeTab').onclick=()=>setHTMLView(true);
for(const [id,key,min,max] of [['htmlWidth','width',280,1600],['htmlPadding','padding',0,120]])$(id).onchange=e=>change(()=>state.htmlSettings={...htmlSettings(state),[key]:clamp(+e.target.value,min,max)});
bindSlider($('htmlGap'),value=>state.htmlSettings={...htmlSettings(state),gap:value},value=>$('htmlGapValue').textContent=value+'px');
async function copyHTML(formatted=false){
 const html=exportHTML(state);
 try{
  if(formatted){const doc=new DOMParser().parseFromString(html,'text/html');await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([doc.body.textContent],{type:'text/plain'})})]);}
  else await navigator.clipboard.writeText(html);
  notify(formatted?'서식 복사됨 · 웹편집기에 붙여넣기':'HTML 복사됨 · HTML 입력 모드에 붙여넣기');
 }catch{setHTMLView(true);$('htmlCode').value=html;$('htmlCode').focus();$('htmlCode').select();notify('클립보드 접근이 막혔어. 선택된 코드를 Ctrl+C로 복사해.');}
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
function setDesignOpen(open){closePresentationMenus();$('designSidebar').hidden=!open;workspace.classList.toggle('design-open',open);$('designTab').setAttribute('aria-expanded',open);$('designTab').setAttribute('aria-pressed',open);}
$('contentTab').onclick=()=>{const id=selection().find(b=>b.type==='text')?.id;if(id)editBlock(id);};
$('designTab').onclick=()=>setDesignOpen($('designSidebar').hidden);
$('closeDesign').innerHTML=icons['panel-left-close'];$('closeDesign').onclick=()=>setDesignOpen(false);
document.addEventListener('keydown',e=>{if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();historyBack(e.shiftKey);return;}if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();historyBack(true);return;}if(e.key==='Escape'){if(drag)finishDrag(true);else{selected.clear();renderOverlays();renderList();renderSelection();}return;}if(editorMode==='png'&&mod&&e.key.toLowerCase()==='a'){e.preventDefault();selected=new Set(state.blocks.map(b=>b.id));renderOverlays();renderList();renderSelection();return;}if(editorMode==='html')return;if(!selected.size)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?10:1;change(()=>{state.blocks.forEach(b=>b.auto=false);const blocks=selection(),r=bounds(blocks),d=constrainDelta(r,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0,state.width);blocks.forEach(b=>{b.auto=false;if(b.presentation==='chat')b.messagePinned=false;b.x+=d.x;b.y+=d.y;});});}if(e.key==='Delete'){e.preventDefault();change(()=>{state.blocks=state.blocks.filter(b=>!selected.has(b.id));selected.clear();});}});
renderMode();
let draftDirty=!!restoredDraft?.pending,draftTimer=null,draftErrorShown=false,composingInput=null;
function draftStatus(text,failed=false){const node=$('draftStatus');if(node.textContent!==text)node.textContent=text;if(node.dataset.failed!==String(failed))node.dataset.failed=failed;}
function queueDraftSave(){draftDirty=true;draftStatus('임시저장 중…');if(draftTimer===null)draftTimer=setTimeout(flushDraft,500);}
function flushDraft(){
 clearTimeout(draftTimer);draftTimer=null;if(!draftDirty)return true;
 if(renderFrame&&editorMode==='png'){flowLayout();fitHeight();}let draftState=state;
 // Only uncommitted IME text needs a DOM read; all other edits are already in state.
 if(composingInput?.isConnected){const id=composingInput.closest('.paragraph-editor').dataset.id,runs=readEditor(composingInput),text=runs.map(r=>r.text).join('');draftState={...state,blocks:state.blocks.map(b=>b.id===id?{...b,runs,text}:b)};}
 const draft={version:1,state:draftState,counter},data=JSON.stringify(draft);
 const saved=writeDraft(()=>localStorage,data),sessionSaved=writeDraft(()=>sessionStorage,saved?data:JSON.stringify({...draft,pending:true}));
 if(!sessionSaved){try{sessionStorage.removeItem('writemisu-draft-v1');}catch{}}
 draftDirty=!saved;draftStatus(saved?'임시저장됨':'임시저장 실패',!saved);
 if(!saved&&!draftErrorShown){draftErrorShown=true;notify('임시저장을 사용할 수 없어. 탭을 닫기 전에 내용을 복사해 둬.');}if(saved)draftErrorShown=false;
 return saved;
}
document.addEventListener('compositionstart',e=>{composingInput=e.target.closest('.paragraph-input');});
document.addEventListener('compositionend',()=>{composingInput=null;});
document.addEventListener('input',()=>{if(composingInput)queueDraftSave();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){finishDrag();flushDraft();}});
window.addEventListener('pagehide',()=>{finishDrag();flushDraft();});
window.addEventListener('beforeunload',e=>{finishDrag();if(!flushDraft()){e.preventDefault();e.returnValue='';}});
draftStatus(restoredDraft?'임시저장 복원됨':'자동 임시저장');
if(restoredDraft?.pending)queueDraftSave();

render();document.fonts.ready.then(()=>{metricCache.clear();scheduleDraw();});
if(document.modelContext?.registerTool){const lifecycle=new AbortController(),register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'read_layout',description:'Read paragraph order, text, positions, background settings and webfont load status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({...structuredClone(state),fonts:Array.from(document.fonts,f=>({family:f.family,weight:f.weight,status:f.status}))})});
  register({name:'insert_paragraphs',description:'Replace the current text or append paragraphs when append is true. The change can be undone.',inputSchema:{type:'object',properties:{text:{type:'string'},append:{type:'boolean'}},required:['text'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>{if(typeof input?.text!=='string'||!input.text.trim()||(input.append!==undefined&&typeof input.append!=='boolean'))throw Error('text must be non-empty and append must be boolean');insertParagraphs(input.text,{append:!!input.append});return {paragraphs:state.blocks.length};}});
}
