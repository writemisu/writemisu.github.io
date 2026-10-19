import {writeDraft,draftKey} from './draft.js';
import {readEditor} from './editor.js';
import {blockRuns,spliceRuns} from './richtext.js';

export function createAutosave({getContext,prepareLayout,finishDrag,status,notify,dirty=false,restored=false,local=()=>localStorage,session=()=>sessionStorage,doc=document,win=window}){
 let timer=null,errorShown=false,composingInput=null;
 function setStatus(text,failed=false){
  if(status.textContent!==text)status.textContent=text;
  if(status.dataset.failed!==String(failed))status.dataset.failed=failed;
 }
 function queue(){
  dirty=true;setStatus('임시저장 중…');
  if(timer===null)timer=win.setTimeout(flush,500);
 }
 function flush(){
  win.clearTimeout(timer);timer=null;if(!dirty)return true;
  const {state,counter,editorMode,renderFrame,inlineEdit}=getContext();
  if(renderFrame&&editorMode==='png')prepareLayout();
  let draftState=state;
  if(composingInput?.isConnected){
   const id=composingInput.dataset?.blockId||composingInput.closest('.paragraph-editor').dataset.id;
   const edited=readEditor(composingInput);
   draftState={...state,blocks:state.blocks.map(b=>{
    if(b.id!==id)return b;
    const range=inlineEdit?.input===composingInput?inlineEdit.range:null;
    const runs=range?spliceRuns(blockRuns(b),range.start,range.end,edited):edited;
    return {...b,runs,text:runs.map(r=>r.text).join('')};
   })};
  }
  if(draftState.film?.imageId)draftState={...draftState,film:{...draftState.film,imageId:null,imageName:''}};
  const draft={version:1,state:draftState,counter},data=JSON.stringify(draft);
  const saved=writeDraft(local,data),sessionSaved=writeDraft(session,saved?data:JSON.stringify({...draft,pending:true}));
  if(!sessionSaved){try{session().removeItem(draftKey);}catch{}}
  dirty=!saved;setStatus(saved?'임시저장됨':'임시저장 실패',!saved);
  if(!saved&&!errorShown){errorShown=true;notify('임시저장 사용 불가');}
  if(saved)errorShown=false;
  return saved;
 }
 function watchEditor(input){
  input.addEventListener('compositionstart',()=>{composingInput=input;});
  input.addEventListener('compositionend',()=>{if(composingInput===input)composingInput=null;});
  input.addEventListener('input',()=>{if(composingInput===input)queue();});
 }
 doc.addEventListener('compositionstart',e=>{composingInput=e.target.closest('.paragraph-input');});
 doc.addEventListener('compositionend',()=>{composingInput=null;});
 doc.addEventListener('input',()=>{if(composingInput)queue();});
 doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden'){finishDrag();flush();}});
 win.addEventListener('pagehide',()=>{finishDrag();flush();});
 win.addEventListener('beforeunload',e=>{finishDrag();if(!flush()){e.preventDefault();e.returnValue='';}});
 setStatus(restored?'임시저장 복원됨':'자동 임시저장');
 if(dirty)queue();
 return {queue,flush,watchEditor};
}
