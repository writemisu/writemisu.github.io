import test from 'node:test';
import assert from 'node:assert/strict';
import {splitParagraphs,wrapText,constrainDelta,fonts,gradientCSS,radialGeometry,textLines,justifyLine,alignedX,resizeWidths,verticalPositions,snapEdge} from '../dist/core.js';
test('paragraph parsing preserves indentation, internal newlines and CRLF',()=>{
 assert.deepEqual(splitParagraphs('　첫 문단\r\n둘째 줄\r\n \r\n다음 문단'),['　첫 문단\n둘째 줄','다음 문단']);
 assert.deepEqual(splitParagraphs('하나\n둘\n\n셋',true),['하나','둘','셋']);
 assert.deepEqual(splitParagraphs(' \n\n '),[]);
});
test('wrapping retains Korean, emoji, indentation, and explicit blank lines',()=>{
 const text='　가나다라마바사👨‍👩‍👧‍👦아자차카타파하';
 const lines=wrapText(text,5,t=>Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(t)).length);
 assert.equal(lines.join(''),text);assert.ok(lines.every(s=>Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(s)).length<=5));
 assert.deepEqual(wrapText('가\n\n나',100,t=>t.length),['가','','나']);
});
test('group movement clamps the bounding box while preserving relative offsets',()=>{
 assert.deepEqual(constrainDelta({x:80,y:90,w:640,h:200},300,-300,800),{x:80,y:-90});
 assert.deepEqual(constrainDelta({x:80,y:90,w:640,h:200},-500,450,800),{x:-80,y:450});
});
test('punctuation at a wrap boundary does not overflow or create a blank line',()=>{
 const lines=wrapText('가나다라.',4,t=>Array.from(t).length);
 assert.equal(lines.join(''),'가나다라.');
 assert.ok(lines.every(s=>s.length>0&&s.length<=4));
});
test('radial background uses a single circular radius reaching every corner',()=>{
 for(const [w,h] of [[800,300],[800,14000],[400,800]]){const {x,y,radius}=radialGeometry(w,h);assert.ok(x<w/2&&y<h/2);for(const [cx,cy] of [[0,0],[w,0],[0,h],[w,h]])assert.ok(Math.hypot(cx-x,cy-y)<=radius+1e-9);}
 assert.match(gradientCSS(['#000000','#ffffff']),/^radial-gradient\(circle farthest-corner at /);assert.doesNotMatch(gradientCSS(['#000000','#ffffff']),/conic|linear/);
});
test('justification fills wrapped lines but leaves hard breaks and last lines alone',()=>{
 const lines=textLines('가나다 라마바 사아자\n끝\n\n마지막',7,t=>t.length);
 assert.ok(lines.some(line=>line.justify));assert.equal(lines.at(-1).justify,false);assert.ok(lines.filter(line=>['끝','','마지막'].includes(line.text)).every(line=>!line.justify));
 for(const text of ['가나다 라마바','　가나다 라마바','가나다라마바']){const parts=justifyLine(text,20,t=>t.length),last=parts.at(-1);assert.equal(parts.map(p=>p.text).join(''),text);assert.equal(last.x+last.text.length,20);}
});
test('divider alignment moves its box inside the page margins',()=>{
 assert.equal(alignedX('left',200,1400,112),112);
 assert.equal(alignedX('center',200,1400,112),600);
 assert.equal(alignedX('right',200,1400,112),1088);
 assert.equal(alignedX('right',790,800,80),0);
});

test('multi-resize applies one delta and stops every box together at either boundary',()=>{
 const items=[{id:'a',w:240,minWidth:80,maxWidth:720},{id:'b',w:320,minWidth:120,maxWidth:400}],before=structuredClone(items);
 assert.deepEqual(resizeWidths(items,40),[{id:'a',w:280},{id:'b',w:360}]);
 assert.deepEqual(resizeWidths(items,200),[{id:'a',w:320},{id:'b',w:400}]);
 assert.deepEqual(resizeWidths(items,-300),[{id:'a',w:80},{id:'b',w:160}]);
 assert.deepEqual(items,before);
});

test('equal vertical gaps account for different heights and preserve outer edges',()=>{
 const items=[{id:'c',y:300,h:60},{id:'a',y:80,h:40},{id:'b',y:150,h:80}],before=structuredClone(items);
 assert.deepEqual(verticalPositions(items),[{id:'a',y:80},{id:'b',y:170},{id:'c',y:300}]);
 assert.deepEqual(verticalPositions(items,24),[{id:'a',y:80},{id:'b',y:144},{id:'c',y:248}]);
 assert.deepEqual(items,before);
});

test('overlapping paragraphs distribute without negative gaps',()=>{
 assert.deepEqual(verticalPositions([{id:'a',y:80,h:100},{id:'b',y:90,h:80},{id:'c',y:120,h:20}]),[{id:'a',y:80},{id:'b',y:180},{id:'c',y:260}]);
});

test('right-edge snapping chooses the closest guide within the screen threshold',()=>{
 assert.deepEqual(snapEdge(637,[80,400,640,720],6),{pos:640,delta:3});
 assert.deepEqual(snapEdge(718,[640,720,719],6),{pos:719,delta:1});
 assert.equal(snapEdge(620,[640,720],6),null);
});
