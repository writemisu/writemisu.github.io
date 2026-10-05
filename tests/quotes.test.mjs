import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteRuns,normalizeRuns,richTextLines,positionedRuns,lineHighlights} from '../dist/richtext.js';
import {blockMetrics} from '../dist/messages.js';

const style={enabled:true,color:'#40566b',highlight:'#333333',highlightOpacity:8,bold:true,italic:false,underline:false,strike:false};
const text=runs=>runs.map(r=>r.text).join('');

test('only paired straight and curly quote interiors receive automatic formatting',()=>{
 const input=[{text:'앞 "첫 대사" 지문 “둘째\n대사” 뒤 "미완성'}],before=structuredClone(input),result=quoteRuns(input,style);
 assert.deepEqual(result.filter(r=>r.highlight).map(r=>r.text),['첫 대사','둘째\n대사']);
 assert.equal(text(result),text(input));assert.deepEqual(input,before);
 assert.ok(result.filter(r=>!r.highlight).every(r=>!r.bold&&!r.color));
 assert.strictEqual(quoteRuns(input,{...style,enabled:false}),input);
});

test('empty quotes, apostrophes and unmatched quotes do not color narration',()=>{
 const input=[{text:'"" 지문 "대사" ‘’ 작은따옴표 “미완성'}],result=quoteRuns(input,style);
 assert.deepEqual(result.filter(r=>r.highlight).map(r=>r.text),['대사']);
 assert.strictEqual(quoteRuns([{text:'평범한 글'}],undefined)[0].text,'평범한 글');
});

test('quote ranges cross manual format boundaries without replacing original marks',()=>{
 const input=[{text:'앞 “👨‍👩‍👧‍👦가',italic:true},{text:'나다',underline:true},{text:'” 뒤',strike:true}],before=structuredClone(input);
 const result=quoteRuns(input,{...style,bold:false,color:null});
 assert.equal(text(result),text(input));assert.deepEqual(input,before);
 assert.equal(result.find(r=>r.text==='👨‍👩‍👧‍👦가').italic,true);
 assert.equal(result.find(r=>r.text==='나다').underline,true);
 assert.equal(result.at(-1).strike,true);assert.ok(result.every(r=>!r.color&&!r.bold));
 assert.deepEqual(quoteRuns(input,{...style,enabled:false}),before);
});

test('highlight and colors survive wrapping and all four alignments',()=>{
 const measure=t=>Array.from(t).length,lines=richTextLines(quoteRuns([{text:'“가나다라마바사아자차카타파하”'}],style),5,measure);
 for(const align of ['left','center','right','justify']){
  const runs=lines.flatMap(line=>positionedRuns(line,8,align,measure));
  assert.ok(runs.filter(r=>r.text!=='“'&&r.text!=='”').every(r=>r.highlight===style.highlight&&r.color===style.color));
 }
 assert.equal(normalizeRuns([{text:'가',color:'#111111'},{text:'나',color:'#222222'}]).length,2);
});

test('quoted bold widths drive layout and notifications do not style their sender',()=>{
 const b={type:'text',text:'"가나다라마바"',font:'noto',w:80,padding:0,size:16,lineHeight:1.8},measure=(t,r)=>t.length*(r.bold?20:10);
 const plain=blockMetrics(b,measure),styled=blockMetrics(b,measure,style);
 assert.ok(styled.h>plain.h);assert.ok(styled.lines.every(l=>l.width<=styled.textWidth));
 const n=blockMetrics({...b,w:480,presentation:'notification',messageSender:'"이름"'},measure,style);
 assert.equal(n.lines[0].runs[0].text,'"이름": ');assert.equal(n.lines[0].runs[0].highlight,undefined);
 assert.ok(n.lines.flatMap(l=>l.runs).some(r=>r.highlight));
});

test('zero opacity disables highlighting without disabling other quote marks',()=>{
 const result=quoteRuns([{text:'"대사"'}],{...style,highlightOpacity:0,italic:true});
 assert.ok(result.every(r=>r.highlight===undefined));assert.ok(result.some(r=>r.bold&&r.italic));
});

test('justified highlights cover expanded word and character spacing without moving text',()=>{
 const measure=t=>[...t].length;
 for(const text of ['“가 나 다”','“가나다”','"Stop hiding your hands"']){
  const runs=quoteRuns([{text}],style),line={runs,width:measure(text),justify:true},positioned=positionedRuns(line,40,'justify',measure),before=structuredClone(positioned);
  const marked=positioned.filter(r=>r.highlight),spans=lineHighlights(positioned);
  assert.ok(marked.some((r,i)=>i&&r.x>marked[i-1].x+marked[i-1].w),'reproduces expanded gaps');
  assert.equal(spans.length,1);assert.equal(spans[0].x,marked[0].x);
  assert.equal(spans[0].x+spans[0].w,marked.at(-1).x+marked.at(-1).w);
  assert.deepEqual(positioned,before);
 }
});

test('highlight spans join across manual marks but stop at narration and quote boundaries',()=>{
 const marked={highlight:'#333333',highlightOpacity:8};
 const runs=[{text:'가 ',x:0,w:10,...marked},{text:'나',x:20,w:5,bold:true,...marked},{text:'” 지문 “',x:25,w:20},{text:'다',x:45,w:5,...marked},{text:'라',x:50,w:5,highlight:'#ffffff',highlightOpacity:8}];
 assert.deepEqual(lineHighlights(runs),[{x:0,w:25,...marked},{x:45,w:5,...marked},{x:50,w:5,highlight:'#ffffff',highlightOpacity:8}]);
 assert.deepEqual(lineHighlights([{text:'가',x:0,w:5,highlight:'#333333',highlightOpacity:0}]),[]);
});

test('wrapped and final dialogue lines each have one highlight for every alignment',()=>{
 const measure=t=>[...t].length,lines=richTextLines(quoteRuns([{text:'“가 나 다 라 마 바 사 아 자 차 카 타 파 하”'}],style),10,measure);
 assert.ok(lines.length>1);assert.equal(lines.at(-1).justify,false);
 for(const align of ['left','center','right','justify'])for(const line of lines){
  const positioned=positionedRuns(line,12,align,measure),marked=positioned.filter(r=>r.highlight),spans=lineHighlights(positioned);
  assert.equal(spans.length,1);assert.equal(spans[0].x,marked[0].x);
  assert.equal(spans[0].w,marked.at(-1).x+marked.at(-1).w-marked[0].x);
 }
});
