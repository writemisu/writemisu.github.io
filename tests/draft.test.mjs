import test from 'node:test';
import assert from 'node:assert/strict';
import {draftKey,parseDraft,readDraft,writeDraft} from '../dist/draft.js';

const block={id:'b4',type:'text',text:'한글 👋\n두 번째 줄',runs:[{text:'한글 👋',bold:true,italic:true},{text:'\n두 번째 줄',underline:true,strike:true}],x:90,y:120,w:310,size:16,lineHeight:1.55,font:'pretendard',padding:8,color:'#333333',box:'#ffffff',opacity:0,align:'left',auto:false,group:'g8',presentation:'chat',messageSide:'right',messagePinned:false,messageFit:false,messageBox:'#dfe6ed'};
const state={width:800,height:350,margin:80,padding:8,background:'radial',colors:['#2d3643','#57545f'],textColor:'#ffffff',noise:18,seed:741,blocks:[block],demo:false};
const encode=(s=state,counter=9)=>JSON.stringify({version:1,state:s,counter});
function storage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}

test('draft round trip preserves text, marks, layout, message style, groups and background',()=>{
 const store=storage();assert.equal(writeDraft(()=>store,encode()),true);
 assert.deepEqual(readDraft(()=>store),{state,counter:9});
});

test('restoration advances ids beyond existing blocks and groups',()=>{
 assert.equal(parseDraft(encode(state,1)).counter,8);
});

test('an intentionally empty document is restored without bringing deleted text back',()=>{
 assert.deepEqual(parseDraft(encode({...state,blocks:[]})).state.blocks,[]);
});

test('a tab-only backup retains the need to retry persistent saving after recovery',()=>{
 assert.equal(parseDraft(JSON.stringify({version:1,state,counter:9,pending:true})).pending,true);
});

test('malformed and unsupported drafts do not reach the editor',()=>{
 for(const raw of [null,'{','null','{}',JSON.stringify({version:2,state}),encode({...state,width:0}),encode({...state,colors:['bad','#000000']}),encode({...state,blocks:[block,block]}),encode({...state,blocks:[{...block,lineHeight:null}]}),encode({...state,blocks:[{...block,runs:[null]}]})])assert.equal(parseDraft(raw),null);
});

test('storage denial and quota errors report failure and leave prior data intact',()=>{
 const denied=()=>{throw Error('SecurityError');};assert.equal(readDraft(denied),null);assert.equal(writeDraft(denied,encode()),false);
 const store=storage();store.setItem(draftKey,encode());store.setItem=()=>{throw Error('QuotaExceededError');};
 assert.equal(writeDraft(()=>store,encode({...state,blocks:[]})),false);assert.deepEqual(readDraft(()=>store).state,state);
});

test('tab recovery is independent from the last draft saved by another tab',()=>{
 const tabA=storage(),tabB=storage(),shared=storage(),other={...state,blocks:[{...block,text:'다른 탭',runs:[{text:'다른 탭'}]}]};
 writeDraft(()=>tabA,encode());writeDraft(()=>shared,encode());
 writeDraft(()=>tabB,encode(other));writeDraft(()=>shared,encode(other));
 assert.deepEqual((readDraft(()=>tabA)||readDraft(()=>shared)).state,state);
 assert.deepEqual((readDraft(()=>storage())||readDraft(()=>shared)).state,other);
});
