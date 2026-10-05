import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceBlocks} from '../dist/replace.js';
import {blockMetrics} from '../dist/messages.js';
import {styledHTML} from '../dist/core.js';

const rule=(find,replace)=>({find,replace});
test('replacement is a reversible display projection across paragraphs and leaves originals intact',()=>{
 const blocks=[{id:'a',type:'text',text:'안새롬은 안새롬이다.',x:80,y:80,w:200},{id:'b',type:'text',text:'“안새롬!”',presentation:'chat',messageSide:'right'},{id:'c',type:'line',text:'안새롬'}],before=structuredClone(blocks);
 const result=replaceBlocks(blocks,[rule('안새롬','{{user}}')]);
 assert.equal(result.count,3);assert.deepEqual(result.blocks.map(b=>b.text),['{{user}}은 {{user}}이다.','“{{user}}!”','안새롬']);
 assert.equal(result.blocks[0].x,80);assert.equal(result.blocks[1].messageSide,'right');assert.equal(result.blocks[2],blocks[2]);
 assert.deepEqual(blocks,before);assert.equal(replaceBlocks(blocks,[]).blocks,blocks);
 for(const rules of [[rule('안새롬','')],[rule('','{{user}}')],[rule('안새롬','안새롬')],[rule('없는 말','다른 말')]])assert.deepEqual(replaceBlocks(blocks,rules),{blocks,count:0});
});

test('partial matches and matches across style boundaries preserve original marks and surrounding text',()=>{
 const blocks=[{type:'text',text:'앞 안새롬 뒤',runs:[{text:'앞 ',underline:true},{text:'안새',bold:true,italic:true},{text:'롬 뒤',strike:true}]}],before=structuredClone(blocks);
 const result=replaceBlocks(blocks,[rule('안새롬','{{user}}')]);
 assert.deepEqual(result.blocks[0].runs,[{text:'앞 ',underline:true},{text:'{{user}}',bold:true,italic:true},{text:' 뒤',strike:true}]);
 assert.deepEqual(blocks,before);
});

test('literal symbols and replacement dollars, braces and HTML are not interpreted as code',()=>{
 const text='[a].*+?^${}()|\\ 끝',replacement='<b>{{user}} $& $1</b>',blocks=[{type:'text',text}];
 const result=replaceBlocks(blocks,[rule(text.slice(0,-2),replacement)]);
 assert.equal(result.count,1);assert.equal(result.blocks[0].text,replacement+' 끝');
 assert.ok(styledHTML(result.blocks[0]).includes('&lt;b&gt;'));assert.ok(!styledHTML(result.blocks[0]).includes('<b>'));
});

test('all rules read the original text once, with first-listed precedence for overlapping rules',()=>{
 const blocks=[{type:'text',text:'안새롬 {{user}} 새롬'}];
 const result=replaceBlocks(blocks,[rule('안새롬','{{user}}'),rule('{{user}}','다른 이름'),rule('안새롬','중복'),rule('새롬','미수')]);
 assert.equal(result.blocks[0].text,'{{user}} 다른 이름 미수');assert.equal(result.count,3);
 assert.equal(replaceBlocks([{type:'text',text:'aaaa'}],[rule('aa','a')]).blocks[0].text,'aa');
});

test('emoji, fullwidth indent and manual breaks survive projected replacement and layout',()=>{
 const block={type:'text',text:'　안새롬 👨‍👩‍👧‍👦\n안새롬',font:'noto',size:16,lineHeight:1.85,w:80,padding:0};
 const result=replaceBlocks([block],[rule('안새롬','{{user}}'),rule('👨‍👩‍👧‍👦','🙂')]);
 assert.equal(result.blocks[0].text,'　{{user}} 🙂\n{{user}}');
 const segmenter=new Intl.Segmenter('ko',{granularity:'grapheme'}),measure=t=>[...segmenter.segment(t)].length*8;
 assert.ok(blockMetrics(result.blocks[0],measure).h>blockMetrics(block,measure).h);
 assert.equal(block.text,'　안새롬 👨‍👩‍👧‍👦\n안새롬');
});

test('notification title, sender, time and body use the same projection',()=>{
 const block={type:'text',presentation:'notification',text:'안새롬에게',messageTitle:'안새롬 알림',messageSender:'안새롬',messageTime:'지금'};
 const result=replaceBlocks([block],[rule('안새롬','{{user}}'),rule('지금','방금')]);
 assert.deepEqual({...result.blocks[0],runs:undefined},{...block,text:'{{user}}에게',messageTitle:'{{user}} 알림',messageSender:'{{user}}',messageTime:'방금',runs:undefined});
 assert.equal(result.count,4);assert.equal(block.messageSender,'안새롬');
});
