import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('\n').filter(line=>line.startsWith('async function savePNG()')||line.startsWith('function pngOutput(')).join('\n');
async function exportPNG(width,height,pngScale=1){
 const button={},result={downloads:0,errors:[]};
 const env={state:{width,height},pngScale,$:()=>button,saveButtonContent:'PNG 저장',loadUsedFonts:async()=>{},updateCanvas(){},requestAnimationFrame:fn=>fn(),setTimeout(){},URL:{createObjectURL:()=> 'blob:png',revokeObjectURL(){}},notify:message=>result.message=message,console:{error:error=>result.errors.push(error)}};
 env.document={fonts:{ready:Promise.resolve()},createElement:type=>type==='canvas'?{toBlob(callback,mime){result.size=[this.width,this.height];result.mime=mime;callback({});}}:{click(){result.downloads++;}}};
 env.paint=(canvas,scale)=>result.paint=[canvas.width,canvas.height,scale];
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
