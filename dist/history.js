// History owns immutable snapshots. Unchanged branches are shared across entries.
function share(previous,value){
 if(previous===value)return previous;
 if(!value||typeof value!=='object')return value;
 const array=Array.isArray(value),keys=Object.keys(value);
 const compatible=previous&&typeof previous==='object'&&Array.isArray(previous)===array;
 let unchanged=compatible&&Object.keys(previous).length===keys.length;
 const result=array?[]:{...value};
 for(const key of keys){
  result[key]=share(compatible?previous[key]:undefined,value[key]);
  if(!compatible||!Object.hasOwn(previous,key)||result[key]!==previous[key])unchanged=false;
 }
 return unchanged?previous:result;
}

export function createHistory(){
 const undo=[],redo=[];
 function push(stack,state){
  const previous=stack.at(-1),next=share(previous,state);
  if(next!==previous)stack.push(next);
  if(stack.length>60)stack.shift();
 }
 return {
  get canUndo(){return undo.length>0;},
  get canRedo(){return redo.length>0;},
  record(before){push(undo,JSON.parse(before));redo.length=0;},
  step(current,forward=false){
   const from=forward?redo:undo,to=forward?undo:redo;
   if(!from.length)return null;
   push(to,JSON.parse(JSON.stringify(current)));
   // The editor mutates state, so it must never receive a retained snapshot.
   const next=structuredClone(from.pop());
   return next;
  },
  imageIds(){return new Set([...undo,...redo].map(s=>s.film?.imageId).filter(Boolean));}
 };
}
