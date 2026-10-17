import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');

test('a failed font request can retry, while successful requests remain cached',async()=>{
 let attempts=0,redraws=0;
 const env={metricCache:new Map([['old',1]]),marginGeometry:{old:true},folioGeometry:{old:true},scheduleDraw(){redraws++;},notify(){},document:{fonts:{load(){attempts++;return attempts===1?Promise.reject(Error('Temporary font failure')):Promise.resolve([]);}}}};
 runInNewContext(app.slice(app.indexOf('const fontLoads=new Map();'),app.indexOf('function loadUsedFonts(')),env);
 await assert.rejects(env.loadFont('Pretendard',400,'한글'),/Temporary font failure/);
 await env.loadFont('Pretendard',400,'한글');await env.loadFont('Pretendard',400,'한글');
 assert.equal(attempts,2);assert.equal(redraws,1);assert.equal(env.metricCache.size,0);assert.equal(env.marginGeometry,null);assert.equal(env.folioGeometry,null);
});

test('long pages start at width fit and still support fitting the entire page',()=>{
 const nodes=Object.fromEntries(['board','boardShell','zoomLabel','zoomFit','zoomPage'].map(id=>[id,{style:{},setAttribute(key,value){this[key]=value;}}]));
 nodes.stageScroll={clientWidth:800,clientHeight:600};
 const env={editorMode:'png',fitMode:'width',zoom:1,pngPage:()=>({width:1080,height:40000}),$:id=>nodes[id],getComputedStyle:()=>({paddingLeft:'20',paddingRight:'20',paddingTop:'20',paddingBottom:'20'})};
 runInNewContext(app.split('\n').find(line=>line.startsWith('function updateZoom(')),env);
 env.updateZoom();assert.equal(env.zoom,760/1080);assert.equal(nodes.zoomFit['aria-pressed'],true);
 env.fitMode='page';env.updateZoom();assert.equal(env.zoom,560/40000);assert.equal(nodes.zoomPage['aria-pressed'],true);
 env.fitMode=false;env.zoom=1;env.updateZoom();assert.equal(env.zoom,1);
});

test('limited PNG exports display the actual scale instead of claiming double resolution',()=>{
 const buttons=[1,2].map(scale=>({dataset:{pngScale:String(scale)},label:{},size:{},setAttribute(key,value){this[key]=value;},querySelector(selector){return selector==='span'?this.label:this.size;}})),nodes={pngScaleLabel:{},pngScale:{},pngScaleMenu:{querySelectorAll:()=>buttons}};
 let page={width:1080,height:40000};const env={pngScale:2,pngPage:()=>page,$:id=>nodes[id]};
 runInNewContext(app.split('\n').find(line=>line.startsWith('function pngOutput('))+'\n'+app.slice(app.indexOf('function renderPNGOptions('),app.indexOf("\n$('pngScaleMenu').addEventListener")),env);
 env.renderPNGOptions();assert.equal(nodes.pngScaleLabel.textContent,'최대 크기 · 40%');
 for(const button of buttons){assert.equal(button.label.textContent,'최대 크기 · 40%');assert.equal(button.size.textContent,'432 × 16000 px');}
 page={width:1080,height:1350};env.renderPNGOptions();assert.equal(nodes.pngScaleLabel.textContent,'고화질 2배');assert.equal(buttons[1].size.textContent,'2160 × 2700 px');
});

test('font changes retain each paragraph size in PNG and HTML',()=>{
 const handler=app.split('\n').find(line=>line.startsWith(" $('blockFont').value="));
 for(const editorMode of ['png','html']){
  const blocks=[{font:'kopubBatang',size:32},{font:'kopubBatang',size:24}],input={},env={editorMode,state:{pngLayout:'plain'},b:blocks[0],$:()=>input,localStorage:{setItem(){}},change:fn=>fn(),formatTargets:()=>blocks,setFormat:(b,key,value)=>{b[key]=value;},setHTMLSetting(){}};
  runInNewContext(handler,env);input.onchange({target:{value:'pretendard'}});
  assert.deepEqual(blocks.map(b=>b.size),[32,24]);assert.ok(blocks.every(b=>b.font==='pretendard'));
 }
});

test('Papyrus font size control matches the 48pt rendering limit',()=>{
 const start=app.indexOf(' host.innerHTML=`<label class="full-field">글꼴'),end=app.indexOf('\n const title=',start),source=app.slice(start,end);
 for(const [pngLayout,size,max] of [['margin',64,48],['folio',100,75],['plain',100,75]]){
  const host={},env={host,editorMode:'png',state:{pngLayout},b:{font:'pretendard',size,lineHeight:1.85},colors:{color:'#333333',box:'#ffffff',opacity:0}};
  runInNewContext(source,env);const slider=host.innerHTML.match(/<input id="fontSize"[^>]+>/)[0];
  assert.match(slider,new RegExp('max="'+max+'"'));assert.match(slider,new RegExp('value="'+size*.75+'"'));
 }
});
