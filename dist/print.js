import {fonts} from './core.js';
import {positionedRuns,fillTextWithSpaces,lineHighlights} from './richtext.js';

export function validPrintOptions(s){
 const q=s.quoteStyle,color=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);
 if(q!==undefined&&(!q||typeof q.enabled!=='boolean'||q.color!=null&&!color(q.color)||!color(q.highlight)||!Number.isFinite(q.highlightOpacity)||q.highlightOpacity<0||q.highlightOpacity>100||!['bold','italic','underline','strike'].every(key=>typeof q[key]==='boolean')))return false;
 if(s.blocks!==undefined){
  if(!s.blocks||typeof s.blocks!=='object'||Array.isArray(s.blocks))return false;
  for(const [id,b] of Object.entries(s.blocks))if(!/^b\d+$/.test(id)||!b||typeof b!=='object'||Array.isArray(b)||b.align!==undefined&&!['left','center','right','justify'].includes(b.align)||b.layerAlign!==undefined&&!['left','center','right'].includes(b.layerAlign)||b.w!==undefined&&(!Number.isFinite(b.w)||b.w<20||b.w>1600))return false;
 }
 return true;
}
export function alignPrintBlock(b,x,width,align,fixedWidth){
 if(!align)return;
 const parts=b.parts||[b],natural=fixedWidth??Math.min(width,Math.max(20,...parts.flatMap(p=>p.metrics.lines.map(line=>p.x-x+line.width)))),left=x+(width-natural)*(align==='center'?.5:align==='right'?1:0);
 for(const part of parts){const inset=part.x-x;part.x=left+inset;part.w=Math.max(20,natural-inset);part.metrics={...part.metrics,w:part.w,textWidth:part.w};}
 b.x=left;b.w=natural;b.metrics={...b.metrics,w:natural,textWidth:natural};
}
export function paintPrintText(c,b){
 const m=b.metrics,h=b.size*b.lineHeight;c.save();c.textBaseline='alphabetic';c.font='400 '+b.size+'px '+fonts[b.font];
 const sample=c.measureText('한글Ag'),ascent=sample.actualBoundingBoxAscent||b.size*.8,descent=sample.actualBoundingBoxDescent||b.size*.2;
 for(let i=0;i<m.lines.length;i++){
  const y=b.y+i*h+(h-ascent-descent)/2+ascent,runs=positionedRuns(m.lines[i],m.textWidth,b.align,(text,run)=>{c.font=(run.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];return c.measureText(text).width;});
  for(const run of lineHighlights(runs)){c.fillStyle=run.highlight;c.globalAlpha=run.highlightOpacity/100;c.fillRect(b.x+run.x,y-ascent-2,run.w,Math.min(h,ascent+descent+4));c.globalAlpha=1;}
  for(const run of runs){const x=b.x+run.x;c.font=(run.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];c.fillStyle=run.color||b.color;c.save();if(run.italic){c.translate(x,y);c.transform(1,0,-.21,1,0,0);}fillTextWithSpaces(c,run.text,run.italic?0:x,run.italic?0:y);c.restore();const thickness=Math.max(1,b.size/18);if(run.underline)c.fillRect(x,y+Math.max(2,descent/2),run.w,thickness);if(run.strike)c.fillRect(x,y-ascent*.38,run.w,thickness);}
 }
 c.restore();
}
