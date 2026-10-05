import test from 'node:test';
import assert from 'node:assert/strict';
import {blockMetrics,presentationColors,messageX} from '../dist/messages.js';
const base={type:'text',text:'문자 예시',w:480,padding:0,size:18,lineHeight:1.85,color:'#fafafa',box:'#123456',opacity:0};
const measure=(text,run)=>Array.from(text).length*(run.bold?11:10);

test('plain paragraphs retain their dimensions and colors without opting in',()=>{
 const m=blockMetrics(base,measure);assert.equal(m.w,480);assert.equal(m.h,33.300000000000004);assert.equal(m.paddingX,0);assert.equal(m.headerHeight,0);assert.deepEqual(presentationColors(base),{color:base.color,box:base.box,opacity:0});
});
test('chat bubbles fit short text, wrap long text, and keep explicit blank lines and marks',()=>{
 const chat={...base,presentation:'chat'},m=blockMetrics(chat,measure);assert.equal(m.w,86);assert.equal(m.h,base.size*base.lineHeight+20);
 const long={...chat,w:140,text:'',runs:[{text:'가나다라마바사아자차카타파하',italic:true},{text:'\n\n끝',bold:true}]},before=structuredClone(long),wrapped=blockMetrics(long,measure);
 assert.ok(wrapped.w<=140);assert.ok(wrapped.lines.every(l=>l.width<=wrapped.textWidth));assert.equal(wrapped.lines.at(-2).runs.length,0);assert.equal(wrapped.lines[0].runs[0].italic,true);assert.equal(wrapped.lines.at(-1).runs[0].bold,true);assert.deepEqual(long,before);
});
test('notifications reserve a header and include sender in wrapping without changing body text',()=>{
 const b={...base,presentation:'notification',messageSender:'아주 긴 발신자 이름',runs:[{text:base.text,underline:true}]},before=structuredClone(b),m=blockMetrics(b,measure);
 assert.equal(m.w,480);assert.ok(m.headerHeight>0);assert.equal(m.lines[0].runs[0].bold,true);assert.equal(m.lines.at(-1).runs.at(-1).underline,true);assert.deepEqual(b,before);
 assert.ok(m.h>blockMetrics(base,measure).h);assert.deepEqual(presentationColors(b),{color:'#333333',box:'#ededed',opacity:100});
});
test('message styles stay separate from plain styles and left/right positioning uses actual bubble width',()=>{
 const b={...base,presentation:'chat',messageBox:'#dddddd',messageColor:'#222222',messageOpacity:80};
 assert.equal(presentationColors(b).box,'#dddddd');assert.equal(presentationColors({...b,presentation:'plain'}).box,base.box);
 assert.equal(messageX('left',86,800,480),160);assert.equal(messageX('right',86,800,480)+86,640);
 const m=blockMetrics({...b,w:80,padding:60},measure);assert.ok(m.textWidth>=20);assert.ok(m.paddingX*2+m.textWidth<=m.w);
});
test('chapter title reserves space for its marker and wraps bold text without changing source formatting',()=>{
 const b={...base,presentation:'chapter',w:180,runs:[{text:'긴 챕터 제목을 여러 줄에 표현',italic:true}]},before=structuredClone(b),m=blockMetrics(b,measure);
 assert.equal(m.w,180);assert.ok(m.markerSize>0);assert.ok(m.lines.length>1);assert.ok(m.lines.every(line=>line.width<=m.textWidth&&line.runs.every(run=>run.bold&&run.italic)));
 assert.equal(m.paddingX*2+m.textOffset+m.textWidth,m.w);assert.equal(m.h,m.lines.length*b.size*b.lineHeight+24);assert.deepEqual(b,before);
 assert.equal(blockMetrics({...b,presentation:'plain'},measure).lines[0].runs[0].bold,undefined);
 const narrow=blockMetrics({...b,w:80,padding:60},measure);assert.equal(narrow.paddingX*2+narrow.textOffset+narrow.textWidth,80);
});
