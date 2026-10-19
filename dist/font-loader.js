export function createFontLoader({onLoad,onError,fontSet=document.fonts}){
 const loads=new Map();
 return function loadFont(family,weight,text){
  const key=family+':'+weight;
  if(!loads.has(key)){
   const job=fontSet.load(weight+' 22px '+family,text||'한글').then(onLoad).catch(error=>{
    loads.delete(key);onError();throw error;
   });
   loads.set(key,job);job.catch(()=>{});
  }
  return loads.get(key);
 };
}
