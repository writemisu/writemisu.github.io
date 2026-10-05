import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleMark,normalizeRuns,richTextLines,positionedRuns} from '../dist/richtext.js';
import {styledHTML} from '../dist/core.js';

test('overlapping range formats combine and toggle only the selected mark',()=>{
 let runs=toggleMark([{text:'가나다라마'}],1,4,'bold');
 runs=toggleMark(runs,2,5,'underline');
 assert.deepEqual(runs,[{text:'가'},{text:'나',bold:true},{text:'다라',bold:true,underline:true},{text:'마',underline:true}]);
 runs=toggleMark(runs,2,4,'bold');
 assert.deepEqual(runs,[{text:'가'},{text:'나',bold:true},{text:'다라마',underline:true}]);
});
test('UTF16 selection offsets preserve emoji and combined marks',()=>{
 const text='가👨‍👩‍👧‍👦나',end=text.length-1,runs=toggleMark([{text}],1,end,'italic');
 assert.deepEqual(runs,[{text:'가'},{text:'👨‍👩‍👧‍👦',italic:true},{text:'나'}]);
 assert.equal(normalizeRuns([...runs,{text:'다'}]).at(-1).text,'나다');
});
test('editor markup escapes text and keeps all four character formats',()=>{
 const b={text:'<가>\n나',runs:[{text:'<가>',bold:true,italic:true},{text:'\n나',underline:true,strike:true}],type:'text',font:'noto',size:18,lineHeight:1.8,box:'#ffffff',color:'#333',padding:0};
 const html=styledHTML(b);
 assert.match(html,/font-weight:700;font-style:italic/);assert.match(html,/text-decoration:underline line-through/);assert.match(html,/&lt;가&gt;/);assert.match(html,/<br>나/);assert.doesNotMatch(html,/<style|<script|class=/);
 assert.ok(styledHTML(b,false).includes('\n나'));
});
test('wrapping uses bold widths, preserves hard breaks and emoji graphemes',()=>{
 const measure=(text,r)=>Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text)).length*(r.bold?2:1);
 const runs=[{text:'가나',bold:true},{text:'다👨‍👩‍👧‍👦\n\n끝'}],lines=richTextLines(runs,4,measure);
 assert.deepEqual(lines.map(l=>l.runs.map(r=>r.text).join('')),['가나','다👨‍👩‍👧‍👦','','끝']);
 assert.equal(lines[0].justify,true);assert.equal(lines[1].justify,false);assert.equal(lines.at(-1).justify,false);
 assert.ok(lines.every(l=>l.width<=4));
});
test('rich left, center, right and justified positioning use styled widths',()=>{
 const measure=(t,r)=>t.length*(r.bold?2:1),line={runs:[{text:'가 ',bold:true},{text:'나'}],width:5,justify:true};
 assert.equal(positionedRuns(line,10,'center',measure)[0].x,2.5);
 assert.equal(positionedRuns(line,10,'right',measure)[0].x,5);
 const parts=positionedRuns(line,10,'justify',measure),last=parts.at(-1);assert.equal(last.x+last.w,10);assert.equal(parts[0].bold,true);
});
