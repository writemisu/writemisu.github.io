import {blockRuns,normalizeRuns,sliceRuns} from './richtext.js';

export function replaceBlocks(blocks,rules){
 const replacements=new Map();
 for(const {find,replace} of rules)if(find&&replace&&find!==replace&&!replacements.has(find))replacements.set(find,replace);
 if(!replacements.size)return {blocks,count:0};
 const pattern=new RegExp([...replacements.keys()].map(text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
 let count=0;
 const replaceRuns=runs=>{
  const text=runs.map(r=>r.text).join(''),parts=[];let cursor=0;
  for(const match of text.matchAll(pattern)){
   parts.push(...sliceRuns(runs,cursor,match.index),{...sliceRuns(runs,match.index,match.index+1)[0],text:replacements.get(match[0])});
   cursor=match.index+match[0].length;count++;
  }
  return cursor?normalizeRuns([...parts,...sliceRuns(runs,cursor,text.length)]):runs;
 };
 const result=blocks.map(block=>{
  if(block.type!=='text')return block;
  const before=count,runs=replaceRuns(blockRuns(block)),next={...block};
  if(count>before){next.runs=runs;next.text=runs.map(r=>r.text).join('');}
  for(const key of ['htmlSummary',...(block.presentation==='notification'?['messageTitle','messageSender','messageTime']:[])])if(typeof block[key]==='string')next[key]=replaceRuns([{text:block[key]}]).map(r=>r.text).join('');
  return count>before?next:block;
 });
 return {blocks:count?result:blocks,count};
}
