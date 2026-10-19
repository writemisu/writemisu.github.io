import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHistory} from '../dist/history.js';
import {blockRuns} from '../dist/richtext.js';
import {storeFilmImage,readFilmImage,retainFilmImages} from '../dist/film-image.js';

test('undo and redo restore independent nested state, deletion and paragraph order',()=>{
 const history=createHistory(),original={blocks:[{id:'b1',text:'처음',runs:[{text:'처음',bold:true}]},{id:'b2',text:'둘째'}],film:{blocks:{b1:{x:.2}}}};
 let state=structuredClone(original);
 history.record(JSON.stringify(state));state.blocks[0].text='수정';state.blocks[0].runs[0].text='수정';state.blocks.reverse();state.film.blocks.b1.x=.7;
 const edited=structuredClone(state);
 history.record(JSON.stringify(state));state.blocks.pop();
 state=history.step(state);assert.deepEqual(state,edited);
 state=history.step(state);assert.deepEqual(state,original);assert.equal(history.canUndo,false);
 state=history.step(state,true);assert.deepEqual(state,edited);
 state.blocks[0].text='live mutation';state.film.blocks.b1.x=.9;
 state=history.step(state);assert.deepEqual(state,original);
 state=history.step(state,true);assert.equal(state.blocks[0].text,'live mutation');assert.equal(state.film.blocks.b1.x,.9);
});

test('a new edit clears redo and history still retains exactly sixty undo steps',()=>{
 const history=createHistory();let state={value:0};
 for(let i=1;i<=75;i++){history.record(JSON.stringify(state));state.value=i;}
 for(let i=74;i>=15;i--){state=history.step(state);assert.equal(state.value,i);}
 assert.equal(history.canUndo,false);assert.equal(history.step(state),null);assert.equal(history.canRedo,true);
 state=history.step(state,true);history.record(JSON.stringify(state));state.value=999;
 assert.equal(history.canRedo,false);assert.equal(history.step(state,true),null);
 assert.equal(history.step(state).value,16);
});

test('special JSON keys stay data and never change object prototypes',()=>{
 const history=createHistory(),before=JSON.parse('{"blocks":[],"__proto__":{"unexpected":true}}');
 history.record(JSON.stringify(before));const restored=history.step({blocks:[]});
 assert.ok(Object.hasOwn(restored,'__proto__'));assert.equal(Object.getPrototypeOf(restored),Object.prototype);assert.equal({}.unexpected,undefined);
});

test('typing a burst in a long document captures history once and keeps formatting',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),source=app.split('\n').find(line=>line.startsWith('function updateText('));
 const state={blocks:Array.from({length:500},(_,i)=>({id:'b'+i,text:'긴 본문 '.repeat(50)}))};
 let snapshots=0,records=0;
 const env={state,blockRuns,typing:false,typingTimer:null,inlineEdit:null,snapshot(){snapshots++;return JSON.stringify(state);},record(){records++;},clearTimeout(){},setTimeout(){return 1;},endTyping(){},loadUsedFonts:()=>Promise.resolve(),scheduleDraw(){},queueDraftSave(){}};
 runInNewContext(source,env);
 for(let i=0;i<100;i++)env.updateText('b250',[{text:'이어 쓰기 '+i,bold:true}]);
 assert.equal(snapshots,1);assert.equal(records,1);assert.equal(state.blocks[250].runs[0].bold,true);assert.equal(state.blocks[249].text,'긴 본문 '.repeat(50));
 env.typing=false;env.updateText('b250',[{text:'다음 입력 묶음'}]);assert.equal(snapshots,2);assert.equal(records,2);
});

test('image cleanup keeps undo and redo images, then releases discarded history',async t=>{
 let closes=0;
 globalThis.createImageBitmap=async file=>({file,close(){closes++;}});
 t.after(()=>{delete globalThis.createImageBitmap;});
 const first=await storeFilmImage({name:'first'}),second=await storeFilmImage({name:'second'}),history=createHistory();
 let state={film:{imageId:first}};
 history.record(JSON.stringify(state));state.film.imageId=second;
 retainFilmImages(new Set([state.film.imageId,...history.imageIds()]));
 assert.equal((await readFilmImage(first)).file.name,'first');
 state=history.step(state);retainFilmImages(new Set([state.film.imageId,...history.imageIds()]));
 assert.equal((await readFilmImage(second)).file.name,'second');
 const third=await storeFilmImage({name:'third'});
 history.record(JSON.stringify(state));state.film.imageId=third;
 retainFilmImages(new Set([state.film.imageId,...history.imageIds()]));
 await assert.rejects(readFilmImage(second),/현재 탭에 배경 이미지가 없음/);
 for(let i=0;i<61;i++){history.record(JSON.stringify(state));state={film:{imageId:third},edit:i};}
 retainFilmImages(new Set([state.film.imageId,...history.imageIds()]));
 await assert.rejects(readFilmImage(first),/현재 탭에 배경 이미지가 없음/);
 assert.equal((await readFilmImage(third)).file.name,'third');assert.equal(closes,3);
 retainFilmImages(new Set());
});
