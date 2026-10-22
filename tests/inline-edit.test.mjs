import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {readEditor} from '../dist/editor.js';

const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function finishInlineEdit('),app.indexOf('function editBlock('));

test('finishing inline edits commits text and closes the editor in every layout',()=>{
 for(const mode of ['plain','film','margin','folio','html']){
  const state={pngLayout:mode,blocks:[{id:'b1',text:'앞\n원래 글\n끝'}]},calls={commit:0,remove:0,composition:0,typing:0,render:0};
  const input={childNodes:[{nodeType:1,tagName:'STRONG',dataset:{},style:{fontWeight:'700',fontStyle:'normal',textDecoration:''},childNodes:[{nodeType:3,data:'수정한 글'}]}]};
  const current={id:'b1',mode:mode==='html'?'html':'png',input,wrapper:{remove(){calls.remove++;}},commit(id,runs){calls.commit++;assert.equal(id,'b1');state.blocks[0].runs=runs;state.blocks[0].text=mode==='html'?'앞\n'+runs.map(r=>r.text).join('')+'\n끝':runs.map(r=>r.text).join('');}};
  const env={state,inlineEdit:current,readEditor,autosave:{endComposition(node){assert.equal(node,input);calls.composition++;}},endTyping(){calls.typing++;},render(){calls.render++;}};
  runInNewContext(source,env);env.finishInlineEdit();
  assert.equal(env.inlineEdit,null);assert.equal(state.blocks[0].text,mode==='html'?'앞\n수정한 글\n끝':'수정한 글');assert.equal(state.blocks[0].runs[0].bold,true);
  assert.deepEqual(calls,{commit:1,remove:1,composition:1,typing:1,render:1});
  env.finishInlineEdit();assert.equal(calls.commit,1);assert.equal(calls.remove,1);
 }
});
