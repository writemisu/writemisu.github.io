import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {marginLayout,validMargin} from '../dist/margin.js';
import {stripeLayout,validStripe} from '../dist/stripe.js';
import {folioLayout,validFolio} from '../dist/folio.js';
import {paintPrintText} from '../dist/print.js';
import {positionedRuns} from '../dist/richtext.js';
import {parseDraft} from '../dist/draft.js';

const layouts=[['margin','marginLayout',marginLayout,validMargin],['stripe','stripeLayout',stripeLayout,validStripe],['folio','folioLayout',folioLayout,validFolio]];
const quote={enabled:true,color:'#bb2233',highlight:'#ffee55',highlightOpacity:20,bold:true,italic:true,underline:true,strike:false};
const block=(id,text)=>({id,type:'text',text,x:80,y:90,w:320,font:'pretendard',size:16,lineHeight:1.8,color:'#333333',box:'#ffffff',opacity:0,padding:0,align:'left',bold:false});
const state=()=>({width:800,height:600,margin:80,padding:0,background:'solid',colors:['#f5f5f5','#ffffff'],textColor:'#333333',noise:0,seed:741,blocks:[block('b1','"대사입니다."'),block('b2','이어지는 본문에 남겨진 말들이 있었다. '.repeat(16))]});
const measure=(b,text,run={})=>Array.from(text).length*b.size*.5*(run.bold?1.1:1);
const parts=b=>b.parts||[b];

for(const [name,key,layout,valid] of layouts){
 test(name+' supports text alignment, justification and quoted styling without modifying source paragraphs',()=>{
  const s=state();s.pngLayout=name;s[key]={quoteStyle:quote,blocks:{b1:{align:'right'},b2:{align:'justify'}}};const before=structuredClone(s),g=layout(s,measure),a=g.blocks[0],b=g.blocks[1];
  assert.equal(a.align,'right');assert.ok(parts(a).every(p=>p.align==='right'));assert.equal(b.align,'justify');
  const runs=parts(a).flatMap(p=>p.metrics.lines.flatMap(line=>line.runs));
  assert.equal(runs.filter(r=>r.highlight===quote.highlight).map(r=>r.text).join(''),'"대사입니다."');assert.ok(runs.some(r=>r.color===quote.color&&r.bold&&r.italic&&r.underline));
  const p=parts(b).find(p=>p.metrics.lines.some(line=>line.justify)),line=p.metrics.lines.find(line=>line.justify),placed=positionedRuns(line,p.metrics.textWidth,p.align,(text,run)=>measure(p,text,run)),last=placed.at(-1);
  assert.ok(Math.abs(last.x+last.w-p.metrics.textWidth)<1e-6);assert.deepEqual(s,before);assert.deepEqual(parseDraft(JSON.stringify({version:1,state:s})).state,s);
 });

 test(name+' aligns paragraph layers inside its own body column and preserves vertical flow',()=>{
  for(const align of ['left','center','right']){
   const s=state();s[key]={blocks:{b1:{layerAlign:align}}};const g=layout(s,measure),b=g.blocks[0],factor=align==='left'?0:align==='center'?.5:1;
   assert.ok(b.w<g.bodyWidth);assert.ok(Math.abs(b.x-(g.bodyX+(g.bodyWidth-b.w)*factor))<1e-6);assert.ok(g.blocks[1].y>=b.y+b.metrics.h);
   assert.ok(parts(b).every(p=>p.x>=g.bodyX&&p.x+p.metrics.w<=g.bodyX+g.bodyWidth+1e-6));
  }
 });

 test(name+' rejects invalid saved alignment and quote settings',()=>{
  for(const patch of [{blocks:{b1:{align:'bad'}}},{blocks:{b1:{layerAlign:'justify'}}},{blocks:[]},{quoteStyle:{...quote,highlightOpacity:101}},{quoteStyle:{...quote,color:'bad'}}])assert.equal(valid(patch),false);
 });
}

test('print text paints centered highlights including both quotation marks',()=>{
 const s=state();s.stripeLayout={quoteStyle:quote,blocks:{b1:{align:'center'}}};const b=stripeLayout(s,measure).blocks[0],events=[],c=new Proxy({measureText(text){const size=parseFloat(this.font.split(' ')[1]),bold=this.font.startsWith('700');return {width:text.length*size*.5*(bold?1.1:1),actualBoundingBoxAscent:size*.8,actualBoundingBoxDescent:size*.2};}},{get:(o,k)=>k in o?o[k]:(...args)=>events.push({key:k,args,color:o.fillStyle,alpha:o.globalAlpha}),set:(o,k,v)=>{o[k]=v;return true;}});
 paintPrintText(c,b);const rect=events.find(e=>e.key==='fillRect'&&e.color===quote.highlight),quotes=events.filter(e=>e.key==='fillText'&&e.args[0]==='"');
 assert.ok(rect);assert.equal(rect.alpha,.2);assert.equal(quotes.length,2);assert.ok(rect.args[0]>b.x);assert.ok(rect.args[0]<=quotes[0].args[1]+1e-6);assert.ok(rect.args[0]+rect.args[2]>=quotes[1].args[1]+b.size*.5-1e-6);
});

test('print alignment controls store per-paragraph settings and quote controls stay separate from the basic layout',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),format=app.slice(app.indexOf('function setPrintBlockFormat('),app.indexOf('function setHTMLSetting(')),quotes=app.slice(app.indexOf('function quoteSettings('),app.indexOf('function renderQuoteSettings('));
 for(const [name,key] of layouts){
  const s=state();s.pngLayout=name;s.quoteStyle={...quote,enabled:false};const before=structuredClone(s),env={state:s,editorMode:'png',marginGeometry:null,stripeGeometry:null,folioGeometry:null};
  for(const prefix of ['Margin','Stripe','Folio'])env['set'+prefix+'Setting']=(field,value)=>{s[key]={...s[key],[field]:value};};
  runInNewContext(format+'\n'+quotes+'\nthis.format=setFormat;this.setQuote=setQuoteSettings;',env);
  env.format(s.blocks[0],'align','center');env.format(s.blocks[0],'layerAlign','right');env.setQuote(quote);
  assert.deepEqual(s.blocks,before.blocks);assert.deepEqual(s.quoteStyle,before.quoteStyle);assert.equal(s[key].blocks.b1.align,'center');assert.equal(s[key].blocks.b1.layerAlign,'right');assert.deepEqual(s[key].quoteStyle,quote);
 }
});
