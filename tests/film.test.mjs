import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {filmSettings,filmSize,filmImageRect,filmLayout,paintFilm,validFilm} from '../dist/film.js';
import {parseDraft} from '../dist/draft.js';
import {exportHTML} from '../dist/html.js';
import {snapEdge,alignedX} from '../dist/core.js';

const block={id:'b1',type:'text',text:'그때로 돌아갈 수 있다면,\n너에게 다른 말을 했을까.',font:'noto',size:16,lineHeight:1.85,color:'#333333',box:'#ffffff',opacity:0,padding:0,align:'left',w:320,x:90,y:120,auto:true};
const state=()=>({width:800,height:741,margin:80,padding:0,noise:0,seed:741,background:'solid',colors:['#18212b','#ffffff'],textColor:'#333333',blocks:[structuredClone(block)]});
const measure=(b,text)=>Array.from(text).length*b.size*.5;

test('Film defaults preserve the source layout and place subtitles inside the lower image safe area',()=>{
 const s=state(),before=structuredClone(s),f=filmSettings(s),scene=filmLayout(s,measure),b=scene.blocks[0];
 assert.deepEqual(filmSize(s),{width:800,height:450});assert.deepEqual([f.fit,f.blur,f.darken,f.letterbox,f.metadataOn,f.leftText,f.rightText,f.grain,f.vignette],['cover',2,28,true,true,'SCENE 04 / TAKE 02','00:02:17:08',11,20]);
 assert.equal(b.align,'center');assert.equal(b.font,'pretendard');assert.equal(b.color,'#ffffff');assert.equal(b.lineHeight,1.3);assert.equal(b.metrics.lines.length,2);assert.equal(b.w,624);
 assert.ok(b.y>=scene.bar+scene.safe);assert.ok(b.y+b.metrics.h<=scene.height-scene.bar-scene.safe+1);assert.deepEqual(scene.warnings,[]);assert.deepEqual(s,before);
});

test('cover and contain preserve image proportions and constrain every alignment to the frame',()=>{
 for(const image of [{width:1600,height:900},{width:400,height:1200},{width:2000,height:500}])for(const fit of ['cover','contain'])for(const x of [0,.5,1])for(const y of [0,.5,1]){
  const r=filmImageRect(image,800,450,fit,x,y);assert.ok(Math.abs(r.w/r.h-image.width/image.height)<1e-9);
  if(fit==='cover'){assert.ok(r.x<=1e-8&&r.y<=1e-8);assert.ok(r.x+r.w>=800-1e-8&&r.y+r.h>=450-1e-8);}
  else{assert.ok(r.x>=-1e-8&&r.y>=-1e-8);assert.ok(r.x+r.w<=800+1e-8&&r.y+r.h<=450+1e-8);}
 }
});

test('ratio and resolution changes scale subtitles while all paragraphs remain visible with their manual line breaks',()=>{
 const s=state();s.blocks.push({...block,id:'b2',text:'두 번째 자막'});s.pngLayout='film';s.film={...filmSettings(s),width:1600,ratio:'4:5',letterbox:false,blocks:{b1:{visible:false},b2:{visible:true,x:.12,y:.7,w:.7,size:30,color:'#ffeecc'}}};const before=structuredClone(s),scene=filmLayout(s,measure);
 assert.deepEqual(filmSize(s),{width:1600,height:2000});assert.equal(scene.bar,0);assert.equal(scene.blocks[0].visible,true);assert.equal(scene.blocks[1].visible,true);assert.equal(scene.blocks[1].size,60);assert.equal(scene.blocks[1].x,192);assert.equal(scene.blocks[1].y,1400);assert.deepEqual(s,before);
 s.film.ratio='2.39:1';assert.equal(filmSize(s).height,669);
});

test('long subtitles are warned about without truncation or automatic font shrinking',()=>{
 const s=state();s.blocks[0].text='첫 줄\n둘째 줄\n셋째 줄\n넷째 줄';const scene=filmLayout(s,measure);
 assert.equal(scene.blocks[0].size,24);assert.equal(scene.blocks[0].text,s.blocks[0].text);assert.equal(scene.warnings[0].lines,4);
 s.film={...filmSettings(s),blocks:{b1:{y:.99}}};assert.equal(filmLayout(s,measure).warnings.length,1);
});

test('Film styles and caption positions do not overwrite the normal PNG or HTML design',()=>{
 const s=state(),before=structuredClone(s),html=exportHTML(s);s.pngLayout='film';s.film=filmSettings(s);
 const env={state:s,filmGeometry:null,filmSettings,filmSize,filmLayout,measureRun:measure};
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),source=app.slice(app.indexOf('function filmView('),app.indexOf('function requestFilmImage('));runInNewContext(source+'\nthis.format=setFilmFormat;',env);
 for(const [key,value] of [['size',36],['x',200],['y',250],['w',400],['color','#ffeedd']])env.format(s.blocks[0],key,value);
 const b=filmLayout(s,measure).blocks[0];assert.deepEqual([b.size,b.x,b.y,b.w,b.color],[36,200,250,400,'#ffeedd']);assert.deepEqual(s.blocks,before.blocks);assert.equal(s.width,before.width);assert.equal(s.height,before.height);assert.equal(exportHTML(s),html);
 assert.equal(validFilm(s.film),true);assert.deepEqual(parseDraft(JSON.stringify({version:1,state:s})).state,JSON.parse(JSON.stringify(s)));
 for(const patch of [{ratio:'bad'},{blur:21},{darken:81},{x:-1},{scene:4},{imageId:{}},{blocks:{b1:{w:2}}}])assert.equal(validFilm({...s.film,...patch}),false);
});

test('Film Shift dragging preserves subtitle height and the source PNG geometry',()=>{
 const s=state();s.pngLayout='film';s.film=filmSettings(s);const before=structuredClone(s.blocks),scene=filmLayout(s,measure),b=scene.blocks[0],env={state:s,filmGeometry:scene,filmSettings,filmSize,filmLayout,filmImageRect,measureRun:measure,snapEdge,clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),renderOverlays(){},drag:{film:'text',startX:0,startY:0,original:[b],bounds:{x:b.x,y:b.y,w:b.w,h:b.metrics.h},resize:false,moved:false,zoom:1}};
 env.updateCanvas=()=>env.filmGeometry=filmLayout(s,measure);
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),settings=app.slice(app.indexOf('function filmView('),app.indexOf('function requestFilmImage(')),move=app.slice(app.indexOf('function onFilmDrag('),app.indexOf('function nudgeFilm('));runInNewContext(settings+'\n'+move+'\nthis.move=onFilmDrag;',env);
 env.move({clientX:30,clientY:100,shiftKey:true,preventDefault(){}});const next=filmLayout(s,measure).blocks[0];assert.equal(next.x,b.x+30);assert.equal(next.y,b.y);assert.deepEqual(s.blocks,before);
});

test('Film layer alignment moves selected caption boxes within its own frame and preserves text styling and vertical positions',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 for(const width of [400,1200])for(const count of [1,2])for(const [index,align] of ['left','center','right'].entries()){
  const s=state();s.pngLayout='film';s.blocks.push({...block,id:'b2',text:'두 번째 자막'},{...block,id:'b3',type:'line',text:''});
  s.film={width,x:.31,blocks:{b1:{x:.12,y:.5,w:.25,align:'left'},b2:{x:.5,y:.7,w:.25,align:'right'}}};const original=structuredClone(s.blocks),before=filmLayout(s,measure),html=exportHTML(s),history=[],buttons=[];
  const tab=()=>({setAttribute(key,value){this[key]=value;},focus(){}}),nodes={alignmentScope:{},textAlignTab:tab(),layerAlignTab:tab(),alignmentButtons:{replaceChildren(){buttons.length=0;},setAttribute(){},append(b){buttons.push(b);}}};
  const selected=new Set(['b1',...(count===2?['b2']:[]),'b3']),env={state:s,editorMode:'png',alignmentMode:'layer',selected,filmGeometry:before,filmSettings,filmSize,filmLayout,measureRun:measure,alignedX,icons:{},$:id=>nodes[id],selection:()=>s.blocks.filter(b=>selected.has(b.id)),metrics:b=>b.metrics,document:{createElement:()=>({setAttribute(key,value){this[key]=value;}})}};
  env.displayBlock=b=>env.filmView(b);env.formatTargets=()=>env.selection();env.setFormat=(b,key,value)=>env.setFilmFormat(b,key,value);env.change=fn=>{history.push(JSON.stringify(s));fn();env.renderAlignment();};
  const source=[app.slice(app.indexOf('function filmView('),app.indexOf('function requestFilmImage(')),app.split('\n').find(line=>line.startsWith('function bounds(')),app.slice(app.indexOf('function renderAlignment(){'),app.indexOf('function widthLimit('))].join('\n');
  runInNewContext(source,env);env.renderAlignment();assert.equal(env.alignmentMode,'layer');assert.equal(nodes.layerAlignTab.hidden,false);assert.equal(buttons.length,3);
  buttons[index].onclick();const after=filmLayout(s,measure),chosen=after.blocks.slice(0,count),left=Math.min(...chosen.map(b=>b.x)),right=Math.max(...chosen.map(b=>b.x+b.w));
  assert.ok(Math.abs(left-alignedX(align,right-left,width,width*.045))<1e-8);assert.equal(buttons[index]['aria-pressed'],true);
  assert.equal(nodes.alignmentScope.textContent,'선택 '+count+'개');assert.deepEqual(after.blocks.map(b=>[b.y,b.w,b.align]),before.blocks.map(b=>[b.y,b.w,b.align]));
  if(count===2)assert.ok(Math.abs(after.blocks[1].x-after.blocks[0].x-(before.blocks[1].x-before.blocks[0].x))<1e-8);
  else assert.equal(after.blocks[1].x,before.blocks[1].x);
  assert.deepEqual(s.blocks,original);assert.equal(exportHTML(s),html);assert.equal(s.film.x,.31);assert.equal(history.length,1);assert.deepEqual(parseDraft(JSON.stringify({version:1,state:s})).state,JSON.parse(JSON.stringify(s)));
  nodes.layerAlignTab.onkeydown({key:'ArrowLeft',preventDefault(){},stopPropagation(){}});assert.equal(env.alignmentMode,'text');assert.equal(buttons.length,4);
  nodes.textAlignTab.onkeydown({key:'ArrowRight',preventDefault(){},stopPropagation(){}});assert.equal(env.alignmentMode,'layer');assert.equal(buttons.length,3);
  selected.clear();env.renderAlignment();assert.ok(buttons.every(b=>b.disabled));
 }
});

test('Film draws background effects before subtitles, then bars and metadata, then the same grain at every output scale',()=>{
 const previous=globalThis.document,events=[];let count=0;
 const context=name=>new Proxy({measureText:text=>({width:Array.from(text).length*12,actualBoundingBoxAscent:18,actualBoundingBoxDescent:4}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createRadialGradient:()=>({addColorStop(){}})},{get(target,key){return key in target?target[key]:(...args)=>events.push({name,key,args});},set(target,key,value){target[key]=value;events.push({name,key,args:[value]});return true;}});
 globalThis.document={createElement:()=>{const name='layer'+(++count),c=context(name);return {name,getContext:()=>c};}};
 try{
  const s=state();s.film={...filmSettings(s),imageId:'session-image'};const scene=filmLayout(s,measure),c=context('output'),target={getContext:()=>c};paintFilm(target,s,{width:1600,height:900},scene,1);paintFilm(target,s,{width:1600,height:900},scene,2);
  assert.ok(events.filter(e=>e.key==='filter').every(e=>e.name!=='output'));
  const out=events.filter(e=>e.name==='output'),text=out.findIndex(e=>e.key==='strokeText'),bars=out.findIndex(e=>e.key==='fillRect'&&e.args[1]===0&&e.args[3]===scene.bar),grain=out.findIndex(e=>e.key==='drawImage'&&e.args[0].name==='layer2');
  assert.ok(text>=0&&bars>text&&grain>bars);assert.deepEqual(out.filter(e=>e.key==='setTransform').map(e=>e.args[0]),[1,2]);assert.equal(count,2);
 }finally{globalThis.document=previous;}
});
