const marks=['bold','italic','underline','strike'];
export function normalizeRuns(runs){
 const result=[];
 for(const run of runs){if(!run.text)continue;const next={text:run.text};for(const key of marks)if(run[key])next[key]=true;const last=result.at(-1);if(last&&marks.every(key=>!!last[key]===!!next[key]))last.text+=next.text;else result.push(next);}
 return result;
}
export function blockRuns(block){return block.runs||[{text:block.text,bold:!!block.bold}];}
export function sliceRuns(runs,start,end){let offset=0;return normalizeRuns(runs.flatMap(run=>{const from=Math.max(0,start-offset),to=Math.min(run.text.length,end-offset);offset+=run.text.length;return to>from?[{...run,text:run.text.slice(from,to)}]:[];}));}
export function rangeHasMark(runs,start,end,key){const selected=sliceRuns(runs,start,end);return selected.length>0&&selected.every(run=>run[key]);}
export function toggleMark(runs,start,end,key){
 if(start===end)return runs;const enabled=!rangeHasMark(runs,start,end,key),length=runs.reduce((n,r)=>n+r.text.length,0);
 return normalizeRuns([...sliceRuns(runs,0,start),...sliceRuns(runs,start,end).map(r=>({...r,[key]:enabled})),...sliceRuns(runs,end,length)]);
}
export function runCSS(run){return `${run.bold?'font-weight:700;':''}${run.italic?'font-style:italic;':''}${run.underline||run.strike?'text-decoration:'+[(run.underline?'underline':''),(run.strike?'line-through':'')].filter(Boolean).join(' ')+';':''}`;}
const segmenter=new Intl.Segmenter('ko',{granularity:'grapheme'});
function glyphs(runs){const text=runs.map(r=>r.text).join('');let offset=0,index=0;return Array.from(segmenter.segment(text),part=>{while(index<runs.length-1&&offset+runs[index].text.length<=part.index)offset+=runs[index++].text.length;return {...runs[index],text:part.segment};});}
function measureRuns(runs,measure){return normalizeRuns(runs).reduce((n,r)=>n+measure(r.text,r),0);}
export function richTextLines(runs,width,measure){
 const lines=[];let line=[];
 const push=justify=>{const runs=normalizeRuns(line);lines.push({runs,width:measureRuns(runs,measure),justify});line=[];};
 for(const glyph of glyphs(runs)){
  if(glyph.text==='\n'){push(false);continue;}
  if(line.length&&measureRuns([...line,glyph],measure)>width){
   const space=line.findLastIndex(g=>g.text===' ');
   if(space>0&&measureRuns(line.slice(0,space),measure)>width*.6){const rest=line.slice(space+1);line=line.slice(0,space);push(true);line=rest;}
   else if(/^[,.!?，。！？、”’」』)\]]$/.test(glyph.text)&&line.length>1){const tail=line.pop();push(true);line=[tail];}
   else{push(true);if(glyph.text===' ')continue;}
  }
  line.push(glyph);
 }
 push(false);return lines;
}
export function positionedRuns(line,width,align,measure){
 if(align!=='justify'||!line.justify){let x=align==='center'?(width-line.width)/2:align==='right'?width-line.width:0;return line.runs.map(run=>{const w=measure(run.text,run),part={...run,x,w};x+=w;return part;});}
 const chars=glyphs(line.runs);let first=chars.findIndex(c=>!/^\s+$/.test(c.text)),last=chars.findLastIndex(c=>!/^\s+$/.test(c.text));if(first<0)return [];
 const slots=new Set();for(let i=first;i<last;i++)if(/^\s+$/.test(chars[i].text)&&!/^\s+$/.test(chars[i+1].text))slots.add(i);
 if(!slots.size)for(let i=first;i<last;i++)slots.add(i);
 const extra=Math.max(0,width-measureRuns(chars.slice(0,last+1),measure)),gap=slots.size?extra/slots.size:0,result=[];let x=0,buffer=[];
 for(let i=0;i<=last;i++){buffer.push(chars[i]);if(slots.has(i)||i===last){for(const run of normalizeRuns(buffer)){const w=measure(run.text,run);result.push({...run,x,w});x+=w;}if(slots.has(i))x+=gap;buffer=[];}}
 return result;
}
