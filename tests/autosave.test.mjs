import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {draftKey,writeDraft} from '../dist/draft.js';

const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('let draftDirty='),app.indexOf('\nrender();document.fonts.ready'));
function editor(count=100){
 const store=()=>({data:new Map(),setItem(key,value){this.data.set(key,value);},removeItem(key){this.data.delete(key);}});
 const localStorage=store(),sessionStorage=store(),events={},stats={reads:0,layouts:0,statusWrites:0,timers:0};let statusText='';
 const status={dataset:{},get textContent(){return statusText;},set textContent(value){statusText=value;stats.statusWrites++;}};
 const state={blocks:Array.from({length:count},(_,i)=>({id:'b'+(i+1),text:'저장할 문단 '+i,runs:[{text:'저장할 문단 '+i,bold:true}]}))};
 const env={state,editorMode:'png',counter:count,restoredDraft:null,renderFrame:0,localStorage,sessionStorage,writeDraft,$:()=>status,notify(){},finishDrag(){},flowLayout(){stats.layouts++;},fitHeight(){},readEditor(input){stats.reads++;return input.runs;},setTimeout(fn,delay){assert.equal(delay,500);stats.timers++;return 1;},clearTimeout(){},document:{addEventListener(name,fn){events[name]=fn;},querySelectorAll(){throw Error('Saving must not scan every editor');}},window:{addEventListener(name,fn){events[name]=fn;}}};
 runInNewContext(source+'\nthis.queue=queueDraftSave;this.flush=flushDraft;',env);
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

test('HTML autosaving skips PNG layout and preserves the original coordinates',()=>{
 const h=editor();h.env.editorMode='html';h.env.renderFrame=1;h.state.blocks[0].x=113;h.state.blocks[0].y=241;h.env.queue();h.env.flush();
 assert.equal(h.stats.layouts,0);assert.equal(h.saved().blocks[0].x,113);assert.equal(h.saved().blocks[0].y,241);
});
