import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {stripeSettings,stripeLayout,validStripe,paintStripe} from '../dist/stripe.js';
import {parseDraft} from '../dist/draft.js';
import {exportHTML} from '../dist/html.js';
import {marginLayout} from '../dist/margin.js';
import {filmLayout} from '../dist/film.js';

const block=(id,text)=>({id,type:'text',text,x:80,y:90,w:480,font:'pretendard',size:16,lineHeight:1.85,color:'#333333',box:'#ffffff',opacity:0,padding:0,align:'left',bold:false});
const state=()=>({width:800,height:500,margin:80,padding:0,background:'solid',colors:['#f5f5f5','#ffffff'],textColor:'#333333',noise:0,seed:741,blocks:[block('b1','비가 그친 뒤에도 신발 자국이 남아 있었다.'),block('b2','“기다린 건 아니야.”\n“그럼 왜 아직 여기 있어?”')]});
const measure=(b,text)=>Array.from(text).length*b.size*.52;

test('STRIPE defaults to 1080 by 1350 with one reading column and equal dialogue type',()=>{
 const s=state(),before=structuredClone(s),g=stripeLayout(s,measure);
 assert.deepEqual([g.width,g.height],[1080,1350]);assert.equal(g.stripWidth/g.width,.2);
 assert.ok(g.blocks.every(b=>b.x===g.bodyX&&b.w===g.bodyWidth&&b.size===28&&b.font==='kopubBatang'));
 assert.ok(g.bodyX>g.stripWidth&&g.bodyX+g.bodyWidth<g.width);assert.deepEqual(s,before);
});

test('long text expands only the page and keeps the fixed strip artwork and content intact',()=>{
 const s=state(),short=stripeLayout(s,measure);s.blocks=Array.from({length:70},(_,i)=>block('b'+(i+1),'장면은 이어지고, 말하지 못한 마음이 남아 있었다. '.repeat(6)));
 const before=structuredClone(s),long=stripeLayout(s,measure);
 assert.ok(long.height>1350*4);assert.equal(long.graphicTop,short.graphicTop);assert.equal(long.graphicBottom,short.graphicBottom);assert.equal(long.bodyX,short.bodyX);
 for(let i=1;i<long.blocks.length;i++)assert.ok(long.blocks[i].y>=long.blocks[i-1].y+long.blocks[i-1].metrics.h);
 assert.ok(long.bodyBottom<long.height);assert.ok(long.blocks.every(b=>b.size===28));assert.deepEqual(s,before);
});

test('optional title and editable side information reserve only their own space',()=>{
 const s=state(),normal=stripeLayout(s,measure);s.stripeLayout={infoOn:false,titleOn:false};const minimal=stripeLayout(s,measure);
 assert.deepEqual(minimal.titleLines,[]);assert.deepEqual(minimal.infoLines,[]);assert.deepEqual(minimal.labelLines,[]);assert.ok(minimal.bodyTop<normal.bodyTop);
 s.stripeLayout={infoText:'긴 이름과 시리즈\n'.repeat(12),infoLabel:'사용자 라벨'};const long=stripeLayout(s,measure);
 assert.ok(long.graphicTop>=long.infoY+long.infoLines.length*42+64);assert.ok(long.height>long.graphicBottom+190);
});

test('settings, typography and rich text remain separate from other layouts and survive draft restoration',()=>{
 const s=state();s.blocks[0].runs=[{text:s.blocks[0].text,italic:true}];const html=exportHTML(s),margin=marginLayout(s,measure),film=filmLayout(s,measure),original=structuredClone(s.blocks),runs=structuredClone(s.blocks[0].runs);
 s.pngLayout='stripe';s.stripeLayout={...stripeSettings(s),font:'noto',size:32,lineHeight:2,paper:'#eeddcc',red:'#990000',texture:40,infoText:'페어명',infoLabel:'시리즈',titleOn:false};
 const g=stripeLayout(s,measure);assert.ok(g.blocks.every(b=>b.font==='noto'&&b.size===32&&b.lineHeight===2));assert.deepEqual(g.blocks[0].runs,runs);
 assert.deepEqual(s.blocks,original);assert.equal(exportHTML(s),html);
 assert.deepEqual(marginLayout(s,measure).blocks.map(b=>[b.x,b.y,b.font,b.size]),margin.blocks.map(b=>[b.x,b.y,b.font,b.size]));assert.deepEqual(filmLayout(s,measure).blocks.map(b=>[b.x,b.y,b.font,b.size]),film.blocks.map(b=>[b.x,b.y,b.font,b.size]));
 assert.deepEqual(parseDraft(JSON.stringify({version:1,state:s})).state,s);
});

test('invalid STRIPE settings are rejected without invalidating legacy drafts',()=>{
 const s=state();assert.ok(parseDraft(JSON.stringify({version:1,state:s})));assert.ok(validStripe({}));
 for(const patch of [{width:200},{size:0},{font:'missing'},{texture:61},{infoOn:'yes'},{paper:'red'},{infoText:1},[]]){assert.equal(validStripe(patch),false);assert.equal(parseDraft(JSON.stringify({version:1,state:{...s,stripeLayout:patch}})),null);}
});

test('shared body controls change STRIPE settings without overwriting original styles',()=>{
 const s=state();s.pngLayout='stripe';const before=structuredClone(s.blocks),app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const format=app.slice(app.indexOf('function setFormat('),app.indexOf('function setHTMLSetting(')),settings=app.slice(app.indexOf('function setStripeSetting('),app.indexOf('function renderStripeSettings('));
 const env={state:s,editorMode:'png',stripeSettings,stripeGeometry:null};runInNewContext(settings+'\n'+format+'\nthis.format=setFormat;',env);
 env.format(s.blocks[0],'font','noto');env.format(s.blocks[0],'size',36);env.format(s.blocks[1],'lineHeight',2.1);env.format(s.blocks[0],'color','#663322');
 assert.deepEqual(s.blocks,before);assert.ok(stripeLayout(s,measure).blocks.every(b=>b.font==='noto'&&b.size===36&&b.lineHeight===2.1&&b.color==='#663322'));
});

test('STRIPE draws the same artwork and text coordinates at preview and double PNG resolution',()=>{
 const s=state(),g=stripeLayout(s,measure),events=[],context=()=>new Proxy({measureText:text=>({width:text.length*10,actualBoundingBoxAscent:20,actualBoundingBoxDescent:6})},{get:(o,k)=>k in o?o[k]:(...args)=>events.push({key:k,args}),set:(o,k,v)=>{o[k]=v;return true;}}),target={getContext:()=>context()},previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>context()})};
 try{paintStripe(target,s,g,{},1);const first=events.splice(0);assert.equal(first.filter(e=>e.key==='fillText'&&e.args[0].startsWith('“')).length,2);paintStripe(target,s,g,{},2);assert.deepEqual(first.filter(e=>e.key==='fillText'&&e.args[0].startsWith('“')).map(e=>e.args),events.filter(e=>e.key==='fillText'&&e.args[0].startsWith('“')).map(e=>e.args));assert.ok(events.some(e=>e.key==='setTransform'&&e.args[0]===2));assert.equal(g.width,1080);}finally{globalThis.document=previous;}
});
