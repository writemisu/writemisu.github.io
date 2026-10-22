import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutosave} from '../dist/autosave.js';
import {draftKey} from '../dist/draft.js';

function editor(count=100,htmlMigrated=false){
 const store=()=>({data:new Map(),setItem(key,value){this.data.set(key,value);},removeItem(key){this.data.delete(key);}});
 const localStorage=store(),sessionStorage=store(),events={},stats={reads:0,layouts:0,statusWrites:0,timers:0};let statusText='';
 const status={dataset:{},get textContent(){return statusText;},set textContent(value){statusText=value;stats.statusWrites++;}};
 const state={blocks:Array.from({length:count},(_,i)=>({id:'b'+(i+1),text:'저장할 문단 '+i,runs:[{text:'저장할 문단 '+i,bold:true}]}))};
 const env={state,editorMode:'png',inlineEdit:null,counter:count,renderFrame:0,notify(){},finishDrag(){},flowLayout(){stats.layouts++;},fitHeight(){},setTimeout(fn,delay){assert.equal(delay,500);stats.timers++;return 1;},clearTimeout(){}};
 const register=(name,fn)=>{events[name]=fn;};
 const doc={addEventListener(name,fn){register(name,name==='compositionstart'?e=>{
  const input=e.target;Object.defineProperty(input,'childNodes',{get(){stats.reads++;return input.runs.map(run=>({nodeType:1,dataset:{},tagName:'SPAN',style:{fontWeight:run.bold?'700':'400',fontStyle:run.italic?'italic':'normal',textDecoration:[run.underline?'underline':'',run.strike?'line-through':''].join(' ')},childNodes:[{nodeType:3,data:run.text}]}));}});fn(e);
 }:fn);}};
 const saver=createAutosave({getContext:()=>env,prepareLayout:()=>{env.flowLayout();env.fitHeight();},finishDrag:env.finishDrag,status,notify:env.notify,dirty:htmlMigrated,local:()=>localStorage,session:()=>sessionStorage,doc,win:{addEventListener:register,setTimeout:env.setTimeout,clearTimeout:env.clearTimeout}});
 env.queue=saver.queue;env.flush=saver.flush;env.watchEditor=saver.watchEditor;env.endComposition=saver.endComposition;
 return {env,state,events,stats,localStorage,sessionStorage,saved:()=>JSON.parse(localStorage.data.get(draftKey)).state};
}

test('a burst of edits uses one timer, no document reads and no repeated layout work',()=>{
 const h=editor(),writes=h.stats.statusWrites;
 for(let i=0;i<100;i++)h.env.queue();
 assert.equal(h.stats.timers,1);assert.equal(h.stats.statusWrites-writes,1);
 h.env.flush();assert.equal(h.stats.reads,0);assert.equal(h.stats.layouts,0);
 assert.deepEqual(h.saved(),h.state);
 assert.equal(h.localStorage.data.get(draftKey),h.sessionStorage.data.get(draftKey));
});

test('IME saving reads only the composing paragraph without changing live state',()=>{
 const h=editor(),before=structuredClone(h.state);
 const input={isConnected:true,runs:[{text:'아직 조합 중인 한글',italic:true}],closest(selector){return selector==='.paragraph-input'?this:{dataset:{id:'b50'}};}};
 h.events.compositionstart({target:input});h.events.input();h.env.flush();
 assert.equal(h.stats.reads,1);assert.equal(h.saved().blocks[49].text,'아직 조합 중인 한글');assert.equal(h.saved().blocks[49].runs[0].italic,true);
 assert.deepEqual(h.state,before);assert.deepEqual(h.saved().blocks[48],h.state.blocks[48]);
 h.state.blocks[49]={...h.state.blocks[49],text:'완성된 한글',runs:[{text:'완성된 한글'}]};
 h.events.compositionend();h.env.queue();h.env.flush();assert.equal(h.stats.reads,1);assert.equal(h.saved().blocks[49].text,'완성된 한글');
});

test('closing before the queued frame updates layout and flushes the latest data',()=>{
 const h=editor();h.env.renderFrame=1;h.state.blocks[0].text='닫기 직전 수정';h.env.queue();h.events.beforeunload({preventDefault(){throw Error('Saved work should not block closing');}});
 assert.equal(h.stats.layouts,1);assert.equal(h.saved().blocks[0].text,'닫기 직전 수정');
 h.events.pagehide();assert.equal(h.stats.layouts,1);
});

test('IME saving finds a stage editor by its block id without a sidebar ancestor',()=>{
 const h=editor(),before=structuredClone(h.state);
 const input={isConnected:true,dataset:{blockId:'b2'},runs:[{text:'지면에서 조합 중',bold:true}],closest(selector){return selector==='.paragraph-input'?this:null;}};
 h.events.compositionstart({target:input});h.events.input();h.env.flush();
 assert.equal(h.saved().blocks[1].text,'지면에서 조합 중');assert.equal(h.saved().blocks[1].runs[0].bold,true);assert.deepEqual(h.state,before);
});

test('HTML autosaving skips PNG layout and preserves the original coordinates',()=>{
 const h=editor();h.env.editorMode='html';h.env.renderFrame=1;h.state.blocks[0].x=113;h.state.blocks[0].y=241;h.env.queue();h.env.flush();
 assert.equal(h.stats.layouts,0);assert.equal(h.saved().blocks[0].x,113);assert.equal(h.saved().blocks[0].y,241);
});

test('IME autosave merges a partial HTML editor without replacing the rest of its paragraph',()=>{
 const h=editor(1);h.env.editorMode='html';h.state.blocks[0]={id:'b1',text:'앞\n중간\n끝',runs:[{text:'앞\n',bold:true},{text:'중간'},{text:'\n끝',underline:true}]};const before=structuredClone(h.state);
 const input={isConnected:true,dataset:{blockId:'b1'},runs:[{text:'조합 중인 글자'}],closest(){return this;}};
 h.env.inlineEdit={input,range:{start:2,end:4}};h.events.compositionstart({target:input});h.events.input();h.env.flush();
 assert.equal(h.saved().blocks[0].text,'앞\n조합 중인 글자\n끝');assert.equal(h.saved().blocks[0].runs[0].bold,true);assert.equal(h.saved().blocks[0].runs.at(-1).underline,true);assert.deepEqual(h.state,before);
});

test('a migrated HTML design queues one save without scanning editors or changing layout',()=>{
 const h=editor(1,true);assert.equal(h.stats.timers,1);h.env.flush();assert.deepEqual(h.saved(),h.state);assert.equal(h.stats.reads,0);assert.equal(h.stats.layouts,0);
});

test('Film saves design settings without retaining an uploaded image or its file name',()=>{
 const h=editor(1);h.state.pngLayout='film';h.state.film={imageId:'current-tab-image',imageName:'my-photo.png',ratio:'16:9',blur:2,blocks:{b1:{visible:true}}};const before=structuredClone(h.state);
 h.env.queue();h.env.flush();const saved=h.saved();assert.equal(saved.film.imageId,null);assert.equal(saved.film.imageName,'');assert.equal(saved.film.ratio,'16:9');assert.equal(saved.film.blocks.b1.visible,true);assert.deepEqual(h.state,before);
});

test('storage failure keeps a recoverable session draft and prevents silent loss on closing',()=>{
 const h=editor(1),write=h.localStorage.setItem;
 h.localStorage.setItem=()=>{throw Error('Quota exceeded');};
 h.env.queue();assert.equal(h.env.flush(),false);
 assert.equal(JSON.parse(h.sessionStorage.data.get(draftKey)).pending,true);
 let prevented=false;h.events.beforeunload({preventDefault(){prevented=true;}});assert.equal(prevented,true);
 h.localStorage.setItem=write;assert.equal(h.env.flush(),true);assert.deepEqual(h.saved(),h.state);
 assert.equal(JSON.parse(h.sessionStorage.data.get(draftKey)).pending,undefined);
});

test('HTML preview composition listeners save only the active line before an IME commit',()=>{
 const h=editor(1),listeners={};h.env.editorMode='html';h.state.blocks[0]={id:'b1',text:'앞\n중간\n끝',runs:[{text:'앞\n중간\n끝'}]};
 const input={isConnected:true,dataset:{blockId:'b1'},childNodes:[{nodeType:3,data:'조합 중'}],addEventListener(name,fn){listeners[name]=fn;}};
 h.env.inlineEdit={input,range:{start:2,end:4}};h.env.watchEditor(input);
 listeners.compositionstart();listeners.input();h.env.flush();assert.equal(h.saved().blocks[0].text,'앞\n조합 중\n끝');
 listeners.compositionend();h.env.queue();h.env.flush();assert.equal(h.saved().blocks[0].text,'앞\n중간\n끝');
});

test('closing an editor releases its IME draft without clearing a different active editor',()=>{
 const h=editor(1),input={isConnected:true,dataset:{blockId:'b1'},runs:[{text:'조합 중'}],closest(){return this;}};
 h.events.compositionstart({target:input});h.env.endComposition({});h.env.queue();h.env.flush();
 assert.equal(h.saved().blocks[0].text,'조합 중');assert.equal(h.stats.reads,1);
 h.state.blocks[0]={id:'b1',text:'확정한 글',runs:[{text:'확정한 글'}]};
 h.env.endComposition(input);h.env.queue();h.env.flush();
 assert.equal(h.saved().blocks[0].text,'확정한 글');assert.equal(h.stats.reads,1);
});
