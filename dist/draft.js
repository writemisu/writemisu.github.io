import {fonts} from './core.js';

export const draftKey='writemisu-draft-v1';
const number=(value,min=0)=>Number.isFinite(value)&&value>=min;
const color=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);

export function parseDraft(raw){
 try{
  const draft=JSON.parse(raw),s=draft?.state;
  if(draft?.version!==1||!s||!number(s.width,400)||s.width>1600||!number(s.margin)||!number(s.padding)||!number(s.noise)||!number(s.seed)||!['solid','radial'].includes(s.background)||!Array.isArray(s.colors)||s.colors.length!==2||!s.colors.every(color)||!color(s.textColor)||!Array.isArray(s.blocks))return null;
  const q=s.quoteStyle;
  if(q!==undefined&&(!q||typeof q.enabled!=='boolean'||q.color!=null&&!color(q.color)||!color(q.highlight)||!number(q.highlightOpacity)||q.highlightOpacity>100||['bold','italic','underline','strike'].some(key=>typeof q[key]!=='boolean')))return null;
  const ids=new Set();let counter=number(draft.counter)?draft.counter:0;
  for(const b of s.blocks){
   if(!b||!/^b\d+$/.test(b.id)||ids.has(b.id)||!['text','line'].includes(b.type)||typeof b.text!=='string'||!['x','y','padding'].every(key=>number(b[key]))||!['w','size','lineHeight'].every(key=>number(b[key],.01))||!Object.hasOwn(fonts,b.font)||!color(b.color)||!color(b.box)||!number(b.opacity)||!['left','center','right','justify'].includes(b.align))return null;
   if(b.presentation!==undefined&&!['plain','chapter','notification','chat'].includes(b.presentation))return null;
   if(['messageColor','messageBox'].some(key=>b[key]!==undefined&&!color(b[key])))return null;
   if(b.runs!==undefined&&(!Array.isArray(b.runs)||b.runs.some(run=>!run||typeof run.text!=='string')))return null;
   if(b.group!=null&&!/^g\d+$/.test(b.group))return null;
   ids.add(b.id);counter=Math.max(counter,Number(b.id.slice(1)),b.group?Number(b.group.slice(1)):0);
  }
  return {state:s,counter,...(draft.pending===true?{pending:true}:{})};
 }catch{return null;}
}

export function readDraft(getStorage){
 try{return parseDraft(getStorage().getItem(draftKey));}catch{return null;}
}
export function writeDraft(getStorage,data){
 try{getStorage().setItem(draftKey,data);return true;}catch{return false;}
}
