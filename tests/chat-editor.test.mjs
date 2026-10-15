import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {exportHTML} from '../dist/html.js';

const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const chat={id:'b1',type:'text',text:'원래 대화',runs:[{text:'원래 대화',bold:true}],presentation:'chat',messageSide:'left',font:'noto',size:16,lineHeight:1.55,w:300,x:80,y:80,htmlTabId:'t1',htmlStyle:{size:20},messageColor:'#eeeeee'};

test('stage plus alternates blank bubbles in the active tab and keeps their typography',()=>{
 const state={blocks:[structuredClone(chat),{...chat,id:'other',messageSide:'right',htmlTabId:'t2'}],htmlTabs:[{id:'t1',open:false},{id:'t2',open:false}],margin:80};
 let counter=2,edits=0,history=0;const button={};
 const env={state,editorMode:'html',activeHTMLTab:'t1',htmlCodeView:false,selected:new Set(),finishInlineEdit(){},endTyping(){},newBlock:()=>({id:'b'+(++counter),type:'text',text:'',x:80,htmlTabId:'t1'}),change(fn){history++;fn();},metrics:()=>({h:50}),pinMessage(){},beginInlineEdit(){edits++;},$:id=>id==='addChat'?button:id==='htmlPreview'?{contentDocument:{querySelector:()=>null},scrollIntoView(){}}:null};
 runInNewContext(app.slice(app.indexOf('function chatMembers('),app.indexOf('const addChat='))+'\nthis.add=addChatBubble;this.update=renderChatAdd;',env);
 env.update();assert.equal(button.hidden,false);assert.equal(button.ariaLabel,'오른쪽 말풍선 추가');
 env.add();env.add();assert.equal(history,2);assert.equal(edits,2);assert.equal(state.htmlTabs[0].open,true);assert.equal(state.htmlTabs[1].open,false);
 assert.deepEqual(state.blocks.map(b=>b.id),['b1','b3','b4','other']);
 assert.deepEqual(state.blocks.slice(0,3).map(b=>b.messageSide),['left','right','left']);
 for(const b of state.blocks.slice(1,3)){assert.equal(b.text,'');assert.equal(b.runs,undefined);assert.equal(b.htmlTabId,'t1');assert.equal(b.htmlStyle.size,20);assert.equal(b.messageColor,'#eeeeee');assert.equal(b.messageFit,true);}
 env.activeHTMLTab='empty';env.update();assert.equal(button.hidden,true);
});

test('PNG chat dragging changes direction and snaps to that side without changing text; resize and cancel do not flip it',()=>{
 const source=app.slice(app.indexOf('function finishDrag('),app.indexOf('\ndocument.addEventListener(\'pointermove\''));
 for(const [cancel,resize] of [[false,false],[false,true],[true,false]]){
  const b={...chat,x:540},before=JSON.stringify({blocks:[chat]}),env={state:{blocks:[b]},drag:{before,moved:true,resize,original:[chat]},document:{body:{style:{}}},metrics:()=>({w:140}),pinMessage(b){b.x=b.messageSide==='right'?580:80;},record(value){assert.equal(value,before);},render(){}};env.state.width=800;
  runInNewContext(source+'\nthis.finish=finishDrag;',env);env.finish(cancel);
  const result=env.state.blocks[0];assert.equal(result.text,chat.text);
  assert.equal(result.messageSide,!cancel&&!resize?'right':'left');
  if(!cancel&&!resize){assert.equal(result.x,580);assert.equal(result.messagePinned,true);}
 }
});

test('HTML bubble drag maps both sides, supports cancellation, and is absent from copied output',()=>{
 const source=app.slice(app.indexOf('function bindHTMLChatDrag('),app.indexOf('function renderHTMLPreview('));
 for(const [dx,cancel,side] of [[300,false,'right'],[300,true,'left'],[2,false,'left']]){
  const b=structuredClone(chat),body={style:{},querySelectorAll:()=>[bubble]},bubble={dataset:{chatId:b.id},style:{},getBoundingClientRect:()=>({left:0,right:100,width:100}),parentElement:{getBoundingClientRect:()=>({left:0,right:500,width:500})},setPointerCapture(){}};
  const env={state:{blocks:[b]},inlineEdit:null,selected:new Set(),clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),endTyping(){},change:fn=>fn()};
  runInNewContext(source+'\nthis.bind=bindHTMLChatDrag;',env);env.bind(body);bubble.onpointerdown({button:0,clientX:20,clientY:20});bubble.onpointermove({clientX:20+dx,clientY:20,pointerId:1,preventDefault(){}});
  if(cancel)bubble.onpointercancel();else bubble.onpointerup();assert.equal(b.messageSide,side);assert.equal(bubble.style.transform,'');assert.equal(body.style.userSelect,'');
 }
 const state={blocks:[chat]},preview=exportHTML(state,{preview:true}),copied=exportHTML(state);
 assert.match(preview,/data-chat-id="b1"/);assert.doesNotMatch(copied,/data-chat-|cursor:grab|touch-action|transform/);
});
