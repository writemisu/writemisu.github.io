import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {constrainDelta,snapEdge} from '../dist/core.js';

const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function setup(){
 const blocks=[{id:'plain',x:80,y:80.8,w:140,auto:true},{id:'chat',presentation:'chat',x:80,y:180.4,w:140,auto:true},{id:'nearby',x:600,y:82,w:100}],selected=new Set(['plain','chat']);
 const events={},env={state:{width:800,margin:80,blocks},selected,editorMode:'png',zoom:.7,drag:null,snapshot:()=>JSON.stringify(env.state),finishInlineEdit(){},select(id,multiple){env.picked=[id,multiple];},selection:()=>blocks.filter(b=>selected.has(b.id)),widthLimit:()=>({}),bounds:()=>({x:80,y:80.8,w:140,h:129.6}),bodyWidth:()=>480,metrics:b=>({w:b.w,h:30}),snapEdge,constrainDelta,updateCanvas(){},renderOverlays(){},addGuide(){},document:{body:{style:{}},addEventListener(name,fn){events[name]=fn;}},window:{addEventListener(){}}};
 const source=app.slice(app.indexOf('function startDrag('),app.indexOf('function addGuide('));
 const keys=app.slice(app.indexOf("for(const type of ['keydown','keyup'])document.addEventListener"),app.indexOf("\n$('board').addEventListener"));
 runInNewContext(source+'\n'+keys+'\nthis.start=startDrag;this.move=onDrag;',env);
 const pointer=(dx,dy,shiftKey=false)=>({clientX:100+dx*.7,clientY:100+dy*.7,shiftKey,preventDefault(){}});
 env.start({...pointer(0,0),button:0,target:{dataset:{}},currentTarget:{focus(){}}},'plain');
 return {env,blocks,events,pointer};
}

test('Shift drag preserves exact heights and paragraph gaps for plain text and chat, despite nearby snap targets',()=>{
 const {env,blocks,pointer}=setup();env.move(pointer(220,70,true));
 assert.deepEqual(blocks.slice(0,2).map(b=>b.y),[80.8,180.4]);assert.equal(blocks[1].y-blocks[0].y,99.60000000000001);
 assert.ok(blocks.slice(0,2).every(b=>b.x>80));assert.equal(blocks[1].messagePinned,false);
});

test('pressing or releasing Shift mid-drag changes the constraint even without another pointer move',()=>{
 const {env,blocks,events,pointer}=setup();env.move(pointer(200,60));assert.deepEqual(blocks.slice(0,2).map(b=>b.y),[141,240]);
 events.keydown({key:'Shift'});assert.deepEqual(blocks.slice(0,2).map(b=>b.y),[80.8,180.4]);
 events.keyup({key:'Shift'});assert.deepEqual(blocks.slice(0,2).map(b=>b.y),[141,240]);
});

test('Shift click still selects multiple paragraphs instead of starting a drag',()=>{
 const {env,pointer}=setup();env.drag=null;env.start({...pointer(0,0,true),button:0,target:{dataset:{}}},'chat');
 assert.deepEqual(Array.from(env.picked),['chat',true]);assert.equal(env.drag,null);
});
