import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {filmSize} from '../dist/film.js';
import {marginLayout} from '../dist/margin.js';
import {stripeLayout} from '../dist/stripe.js';

const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('\n').filter(line=>line.startsWith('async function savePNG()')||line.startsWith('function pngOutput(')).join('\n');
async function exportPNG(width,height,pngScale=1,film=null,margin=null,stripe=null){
 const button={},result={downloads:0,errors:[]};
 const env={state:{width,height,blocks:[],...(film?{pngLayout:'film',film}:{}),...(margin?{pngLayout:'margin',marginLayout:margin}:{}),...(stripe?{pngLayout:'stripe',stripeLayout:stripe}:{})},filmSize,marginLayout,marginGeometry:null,stripeLayout,stripeGeometry:null,measureRun:(b,text)=>Array.from(text).length*b.size*.52,pngScale,$:()=>button,saveButtonContent:'PNG 저장',finishInlineEdit(){result.finished=true;},ensureFilmImage:async()=>{result.imageReady=true;},loadUsedFonts:async()=>{},updateCanvas(){},requestAnimationFrame:fn=>fn(),setTimeout(){},URL:{createObjectURL:()=> 'blob:png',revokeObjectURL(){}},notify:message=>result.message=message,console:{error:error=>result.errors.push(error)}};
 env.document={fonts:{ready:Promise.resolve()},createElement:type=>type==='canvas'?{toBlob(callback,mime){result.size=[this.width,this.height];result.mime=mime;callback({});}}:{click(){result.downloads++;}}};
 env.paint=(canvas,scale)=>{assert.equal(result.finished,true);result.paint=[canvas.width,canvas.height,scale];};
 runInNewContext(source,env);await env.savePNG();assert.deepEqual(result.errors,[]);assert.equal(button.disabled,false);return result;
}

test('PNG dimensions match page pixels instead of doubling them',async()=>{
 for(const [width,height] of [[500,741],[700,780],[800,503]]){
  const result=await exportPNG(width,height);
  assert.deepEqual(result.size,[width,height]);assert.deepEqual(result.paint,[width,height,1]);
  assert.equal(result.mime,'image/png');assert.equal(result.downloads,1);assert.ok(result.message.includes(`${width} × ${height}px`));
 }
});

test('large PNG exports retain existing canvas size limits',async()=>{
 const result=await exportPNG(1600,24000),[width,height]=result.size;
 assert.ok(width<=1600&&height<=16000&&width*height<=16000000);assert.ok(result.paint[2]<1);
});

test('high-resolution selection renders at double dimensions and matches its displayed output size',async()=>{
 for(const [width,height] of [[500,741],[700,780]]){
  const result=await exportPNG(width,height,2);
  assert.deepEqual(result.size,[width*2,height*2]);assert.deepEqual(result.paint,[width*2,height*2,2]);
  assert.ok(result.message.includes(`${width*2} × ${height*2}px`));
 }
 const limited=await exportPNG(1600,12000,2),[width,height]=limited.size;
 assert.ok(height<=16000&&width*height<=16000000);
});

test('Film waits for the image and exports its own aspect ratio at original and double resolution',async()=>{
 for(const scale of [1,2]){const result=await exportPNG(500,741,scale,{width:800,ratio:'16:9'});assert.equal(result.imageReady,true);assert.deepEqual(result.size,[800*scale,450*scale]);}
});

test('MARGIN exports its calculated page at original and double resolution',async()=>{
 const settings={width:800,header:false},page=marginLayout({width:500,blocks:[],marginLayout:settings},(b,text)=>text.length*b.size*.52);
 for(const scale of [1,2]){const result=await exportPNG(500,741,scale,null,settings);assert.deepEqual(result.size,[page.width*scale,page.height*scale]);}
});

test('STRIPE exports the independent 1080 by 1350 page at original and double resolution',async()=>{
 for(const scale of [1,2]){const result=await exportPNG(800,500,scale,null,null,{});assert.deepEqual(result.size,[1080*scale,1350*scale]);assert.deepEqual(result.paint,[1080*scale,1350*scale,scale]);}
});
