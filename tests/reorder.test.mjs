import test from 'node:test';
import assert from 'node:assert/strict';
import {reorderBlocks} from '../dist/core.js';
import {blockMetrics} from '../dist/messages.js';

const height=b=>b.h;
test('moving up swaps list order and unequal-height positions without changing the surrounding layout',()=>{
 const blocks=[{id:'before',y:20,h:20},{id:'a',y:80,h:40,x:160,w:480,auto:false,font:'noto',group:'g1'},{id:'b',y:152,h:120,x:300,w:300,auto:false,presentation:'chat',messageSide:'right',messagePinned:false},{id:'after',y:310,h:50}],before=structuredClone(blocks);
 const result=reorderBlocks(blocks,'b',-1,height);
 assert.deepEqual(result.map(b=>b.id),['before','b','a','after']);
 assert.equal(result[1].y,80);assert.equal(result[2].y,232);
 assert.equal(result[2].y-result[1].y-result[1].h,32);
 assert.equal(result[2].y+result[2].h,blocks[2].y+blocks[2].h);
 for(const b of result){const old=blocks.find(x=>x.id===b.id);assert.deepEqual({...b,y:old.y},old);}
 assert.deepEqual(reorderBlocks(result,'b',1,height),blocks);
 assert.deepEqual(blocks,before);
});

test('automatic paragraphs stay automatic through repeated moves and retain their total extent',()=>{
 let blocks=[{id:'a',y:80,h:40,auto:true},{id:'b',y:152,h:100,auto:true},{id:'c',y:284,h:24,auto:true}];
 blocks=reorderBlocks(blocks,'a',1,height);blocks=reorderBlocks(blocks,'a',1,height);
 assert.deepEqual(blocks.map(b=>[b.id,b.y,b.auto]),[['b',80,true],['c',212,true],['a',268,true]]);
 assert.equal(blocks.at(-1).y+blocks.at(-1).h,308);
 assert.equal(reorderBlocks(blocks,'b',-1,height),blocks);
 assert.equal(reorderBlocks(blocks,'a',1,height),blocks);
 assert.equal(reorderBlocks(blocks,'missing',1,height),blocks);
});

test('manual gaps and mixed placement stay fixed instead of being replaced by automatic spacing',()=>{
 const blocks=[{id:'a',y:140,h:60,auto:true},{id:'b',y:278,h:30,auto:false}];
 const result=reorderBlocks(blocks,'a',1,height);
 assert.deepEqual(result.map(b=>[b.id,b.y,b.auto]),[['b',140,false],['a',248,false]]);
 assert.equal(result[1].y-result[0].y-result[0].h,78);
 const overlap=reorderBlocks([{id:'a',y:80,h:100,auto:false},{id:'b',y:90,h:70,auto:false}],'b',-1,height);
 assert.equal(overlap[1].y,overlap[0].y+overlap[0].h);
});

test('real text, message and divider heights drive reordering while preserving rich formatting',()=>{
 const measured=b=>blockMetrics(b,t=>t.length*8).h;
 const a={id:'a',type:'text',text:'긴 본문입니다. '.repeat(20),w:240,size:16,lineHeight:1.85,padding:0,font:'noto',x:160,y:80,auto:false,runs:[{text:'긴 본문입니다. '.repeat(20),italic:true}]};
 const b={...a,id:'b',text:'짧은 대사',runs:[{text:'짧은 대사',bold:true}],presentation:'chat',messageSide:'right',messagePinned:true,x:400,y:a.y+measured(a)+32};
 const c={id:'c',type:'line',x:180,y:b.y+measured(b)+32,w:200,auto:false};
 const result=reorderBlocks([a,b,c],'b',-1,measured);
 assert.deepEqual(result.map(b=>b.id),['b','a','c']);
 assert.equal(result[0].y,80);assert.ok(Math.abs(result[1].y-(80+measured(b)+32))<1e-9);
 assert.ok(Math.abs(result[1].y+measured(a)+32-c.y)<1e-9);
 assert.deepEqual(result[0].runs,b.runs);assert.equal(result[0].messageSide,'right');assert.equal(result[0].x,b.x);
 const dividerFirst=reorderBlocks(result,'c',-1,measured);
 assert.equal(dividerFirst[1].type,'line');assert.ok(Math.abs(dividerFirst[2].y-(dividerFirst[1].y+24+32))<1e-9);
});
