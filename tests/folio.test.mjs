import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {folioSettings,folioLayout,validFolio,paintFolio} from '../dist/folio.js';
import {marginLayout} from '../dist/margin.js';
import {filmLayout} from '../dist/film.js';
import {exportHTML} from '../dist/html.js';
import {parseDraft} from '../dist/draft.js';

const block=(id,text)=>({id,type:'text',text,x:80,y:90,w:480,font:'kopubBatang',size:16,lineHeight:1.85,color:'#333333',box:'#ffffff',opacity:0,padding:0,align:'left',bold:false});
const state=()=>({width:800,height:500,margin:80,padding:0,background:'solid',colors:['#f5f5f5','#ffffff'],textColor:'#333333',noise:0,seed:741,blocks:[block('b1','조용한 방 안에 말하지 못한 이야기가 남아 있었다.'),block('b2','“기다린 건 아니야.”\n“그럼 왜 아직 여기 있어?”')]});
const measure=(b,text)=>Array.from(text).length*b.size*.52;

test('Folio keeps a single column within a thin frame and a restrained footer on a 1080 by 1350 page',()=>{
 const s=state(),before=structuredClone(s),g=folioLayout(s,measure);
 assert.deepEqual([g.width,g.height],[1080,1350]);assert.ok(g.blocks.every(b=>b.x===g.bodyX&&b.size===26&&b.font==='pretendard'));
 assert.ok(g.bodyX>g.outer&&g.bodyX+g.bodyWidth<g.width-g.outer);assert.ok(g.bodyBottom<g.mainBottom);assert.ok(g.barHeight<100);assert.deepEqual(s,before);
});

test('Folio default dialogue controls match rendering and keep saved quote styles',()=>{
 const s=state(),before=structuredClone(s),app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');s.pngLayout='folio';
 const source=app.slice(app.indexOf('function quoteSettings('),app.indexOf('function setQuoteSettings(')),env={state:s,editorMode:'png',folioSettings};
 runInNewContext(source,env);
 const q=env.quoteSettings(),g=folioLayout(s,measure),runs=g.blocks[1].metrics.lines.flatMap(line=>line.runs);
 assert.ok(q.enabled);assert.equal(q.highlightOpacity,10);assert.equal(q.color,null);assert.ok(!q.bold&&!q.italic&&!q.underline&&!q.strike);
 assert.ok(runs.some(run=>run.highlight===q.highlight&&run.highlightOpacity===10));assert.deepEqual(s.blocks,before.blocks);
 s.quoteStyle={...q,enabled:false,highlightOpacity:23};assert.equal(env.quoteSettings().enabled,false);assert.equal(folioSettings(s).quoteStyle.highlightOpacity,23);
 s.folioLayout={project:'직접 쓴 이름',quoteStyle:{...q,highlight:'#224466',highlightOpacity:35}};
 assert.equal(env.quoteSettings().highlight,'#224466');assert.equal(folioSettings(s).project,'직접 쓴 이름');
 assert.deepEqual(parseDraft(JSON.stringify({version:1,state:s})).state,s);
});

test('Folio expands for long text and long footer text without overlapping either column',()=>{
 const s=state();s.blocks=Array.from({length:50},(_,i)=>block('b'+(i+1),'남겨진 마음은 한동안 같은 자리에 머물렀다. '.repeat(8)));
 s.folioLayout={project:'긴 프로젝트 문구 '.repeat(60),code:'긴 코드 '.repeat(120)};const g=folioLayout(s,measure);
 assert.ok(g.height>1350*4);assert.ok(g.bodyBottom+79<=g.mainBottom);
 assert.ok(Math.max(g.projectLines.length,g.codeLines.length)*26+30<=g.barHeight);
 for(let i=1;i<g.blocks.length;i++)assert.ok(g.blocks[i].y>=g.blocks[i-1].y+g.blocks[i-1].metrics.h);
});

test('hiding or clearing footer information removes the entire footer band',()=>{
 for(const settings of [{infoOn:false},{name:'',heading:'',tag:'',note:'',project:'',code:''}]){
  const s=state();s.folioLayout=settings;const g=folioLayout(s,measure);assert.equal(g.barHeight,0);assert.deepEqual(g.projectLines,[]);assert.deepEqual(g.codeLines,[]);assert.equal(g.mainBottom,g.height-g.outer);
 }
});

test('Folio settings round-trip through drafts while other layout geometry and HTML stay unchanged',()=>{
 const s=state(),before=structuredClone(s.blocks),html=exportHTML(s),others=[marginLayout(s,measure),filmLayout(s,measure)];
 s.pngLayout='folio';s.folioLayout={...folioSettings(s),paper:'#fafafa',color:'#111111',font:'noto',size:30,lineHeight:2,project:'사용자 문구',code:'사용자 코드'};
 assert.ok(folioLayout(s,measure).blocks.every(b=>b.size===30&&b.font==='noto'&&b.lineHeight===2));assert.deepEqual(s.blocks,before);assert.equal(exportHTML(s),html);
 [marginLayout(s,measure),filmLayout(s,measure)].forEach((g,i)=>assert.deepEqual(g,others[i]));
 assert.deepEqual(parseDraft(JSON.stringify({version:1,state:s})).state,s);
 for(const patch of [{width:200},{font:'missing'},{paper:'gray'},{size:0},{infoOn:'yes'},{note:7},[]])assert.equal(validFolio(patch),false);
});

test('shared body controls update only Folio settings',()=>{
 const s=state();s.pngLayout='folio';const before=structuredClone(s.blocks),app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const format=app.slice(app.indexOf('function setFormat('),app.indexOf('function setHTMLSetting(')),settings=app.slice(app.indexOf('function setFolioSetting('),app.indexOf('function renderFolioSettings('));
 const env={state:s,editorMode:'png',folioSettings,folioGeometry:null};runInNewContext(settings+'\n'+format+'\nthis.format=setFormat;',env);
 env.format(s.blocks[0],'font','noto');env.format(s.blocks[1],'size',32);env.format(s.blocks[0],'color','#663322');assert.deepEqual(s.blocks,before);assert.ok(folioLayout(s,measure).blocks.every(b=>b.font==='noto'&&b.size===32&&b.color==='#663322'));
});

test('Folio paints the same text coordinates at preview and double resolution with small footer type',()=>{
 const s=state(),g=folioLayout(s,measure),events=[],sizes=[],c=new Proxy({measureText:text=>({width:text.length*10,actualBoundingBoxAscent:20,actualBoundingBoxDescent:6})},{get:(o,k)=>k in o?o[k]:(...args)=>events.push({key:k,args}),set:(o,k,v)=>{if(k==='font')sizes.push(parseFloat(v.split(' ')[1]));o[k]=v;return true;}}),target={getContext:()=>c};
 paintFolio(target,s,g,1);const first=events.splice(0);paintFolio(target,s,g,2);
 assert.deepEqual(first.filter(e=>e.key==='fillText'),events.filter(e=>e.key==='fillText'));assert.ok(Math.max(...sizes)<=26);assert.ok(events.some(e=>e.key==='setTransform'&&e.args[0]===2));
});

test('saved legacy Folio name and information cells never reappear',()=>{
 const s=state();s.folioLayout={name:'REMOVED_NAME',heading:'REMOVED_HEADING',tag:'REMOVED_TAG',note:'REMOVED_NOTE',project:'KEEP_PROJECT',code:'KEEP_CODE'};const settings=folioSettings(s),g=folioLayout(s,measure);
 for(const key of ['name','heading','tag','note'])assert.equal(Object.hasOwn(settings,key),false);
 assert.deepEqual(g.projectLines,['KEEP_PROJECT']);assert.deepEqual(g.codeLines,['KEEP_CODE']);assert.equal(g.nameHeight,undefined);assert.equal(g.infoHeight,undefined);assert.equal(g.height,1350);
});

test('footer glyphs are vertically centered while preserving the 68:32 split and left padding',()=>{
 for(const width of [800,1080]){
  const s=state();s.blocks=[];s.folioLayout={width,project:'정의영',code:'glyph / 001'};const g=folioLayout(s,measure),draws=[];
  const c=new Proxy({measureText(text){const size=parseFloat(this.font.split(' ')[1]),korean=/[가-힣]/.test(text);return {width:text.length*size*.5,actualBoundingBoxAscent:size*(korean?.8:.65),actualBoundingBoxDescent:size*(korean?.05:.2)};}},{get:(o,key)=>key in o?o[key]:(...args)=>{if(key==='fillText')draws.push({text:args[0],x:args[1],y:args[2],font:o.font,baseline:o.textBaseline,...o.measureText(args[0])});},set:(o,key,value)=>{o[key]=value;return true;}});
  paintFolio({getContext:()=>c},s,g);assert.equal(draws.length,2);assert.equal(g.barSplit,g.outer+(g.width-g.outer*2)*.68);
  assert.equal(draws[0].x,g.outer+20*g.k);assert.equal(draws[1].x,g.barSplit+20*g.k);
  for(const draw of draws){const center=draw.y+(draw.actualBoundingBoxDescent-draw.actualBoundingBoxAscent)/2;assert.equal(draw.font,'400 '+(20*g.k)+"px 'Mona12',monospace");assert.equal(draw.baseline,'alphabetic');assert.ok(Math.abs(center-(g.barY+g.barHeight/2))<1e-6);}
 }
});
