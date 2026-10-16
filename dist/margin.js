import {fonts,wrapText} from './core.js';
import {blockMetrics} from './messages.js';
import {blockRuns,sliceRuns,positionedRuns,fillTextWithSpaces} from './richtext.js';
import {replaceBlocks} from './replace.js';

const limits={width:[400,1600],outer:[16,160],bodyWidth:[120,1400],marginWidth:[24,180],texture:[0,60],size:[12,64],lineHeight:[1,3],paragraphGap:[0,100],dialogueIndent:[0,64],dialogueGap:[0,64],headerScale:[50,150],headerGap:[0,120]};
const defaults={outer:44,bodyWidth:560,marginWidth:76,background:'#eee8d8',color:'#383027',muted:'#968a75',frameColor:'#baad91',accent:'#a89775',numberColor:'#8c806b',texture:10,font:'kopubBatang',size:20,lineHeight:1.85,paragraphGap:22,dialogueIndent:6,dialogueGap:8,frame:true,corners:true,header:true,chapter:'01',subtitle:'THE THINGS WE NEVER SAID',title:'비가 그친 자리',description:'젖은 거리와, 끝내 건네지 못한 말들에 대하여.',headerScale:100,headerGap:36,chapterStar:true,numbers:true,diamonds:true,guide:true,footer:true,footerText:'THE SPACE BETWEEN US',page:true,pageText:'01 — 01',footerStar:true,footerLine:true};
export function marginSettings(state){
 const stored=state.marginLayout||{},s={...defaults,width:state.width||800,...stored,blocks:stored.blocks||{}};
 for(const [key,[min,max]] of Object.entries(limits)){const value=s[key];s[key]=Number.isFinite(value)?Math.max(min,Math.min(max,value)):defaults[key]??800;}
 s.outer=Math.min(s.outer,s.width/4);s.marginWidth=Math.min(s.marginWidth,Math.max(24,s.width-s.outer*2-120));s.bodyWidth=Math.min(s.bodyWidth,s.width-s.outer*2-s.marginWidth);
 return s;
}
export function validMargin(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 for(const [key,[min,max]] of Object.entries(limits))if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max))return false;
 for(const [key,value] of Object.entries(defaults)){
  if(s[key]===undefined)continue;
  if(typeof value==='boolean'&&typeof s[key]!=='boolean'||typeof value==='string'&&typeof s[key]!=='string')return false;
 }
 if(s.font!==undefined&&!Object.hasOwn(fonts,s.font)||['background','color','muted','frameColor','accent','numberColor'].some(key=>s[key]!==undefined&&!/^#[\da-f]{6}$/i.test(s[key])))return false;
 if(s.blocks!==undefined){
  if(!s.blocks||typeof s.blocks!=='object'||Array.isArray(s.blocks))return false;
  for(const [id,b] of Object.entries(s.blocks))if(!/^b\d+$/.test(id)||!b||typeof b!=='object'||Array.isArray(b)||b.role!==undefined&&!['auto','narration','dialogue'].includes(b.role)||b.sectionStart!==undefined&&typeof b.sectionStart!=='boolean')return false;
 }
 return true;
}
function textBlock(s,source){return {...source,type:'text',presentation:'plain',font:s.font,size:s.size,lineHeight:s.lineHeight,color:s.color,align:'left',bold:false,padding:0,opacity:0,group:null,runs:source.runs||[{text:source.text}]};}
export function marginSegments(text,role='auto'){
 const ranges=[],stack=[],pairs={'"':'"','“':'”','‘':'’','「':'」','『':'』'};let quoteStart=0;
 if(role==='auto')for(let i=0;i<text.length;i++){
  const ch=text[i];if(ch==='\\'){i++;continue;}
  if(stack.length&&ch===stack.at(-1)){stack.pop();if(!stack.length)ranges.push({start:quoteStart,end:i+1});}
  else if(pairs[ch]){if(!stack.length)quoteStart=i;stack.push(pairs[ch]);}
 }
 if(!text.trim())return [{start:0,end:0,dialogue:role==='dialogue'}];
 const segments=[];let offset=0,index=0;
 const emit=(start,end,dialogue)=>{
  const raw=text.slice(start,end),leading=raw.match(/^\s*/)[0].length,trailing=raw.match(/\s*$/)[0].length;
  if(raw.trim())segments.push({start:start+leading,end:end-trailing,dialogue});
 };
 for(const line of text.split('\n')){
  const end=offset+line.length;
  if(!line.trim())segments.push({start:offset,end,blank:true});
  else if(role!=='auto')segments.push({start:offset,end,dialogue:role==='dialogue'});
  else{
   while(ranges[index]?.end<=offset)index++;let cursor=offset;
   for(let i=index;i<ranges.length&&ranges[i].start<end;i++){
    const range=ranges[i],from=Math.max(offset,range.start),to=Math.min(end,range.end);
    emit(cursor,from,false);emit(from,to,true);cursor=to;
   }
   emit(cursor,end,false);
  }
  offset=end+1;
 }
 return segments;
}
export function marginLayout(state,measure){
 const s=marginSettings(state),width=s.width,outer=Math.min(s.outer,width/4),available=width-outer*2-s.marginWidth,bodyWidth=Math.max(80,Math.min(s.bodyWidth,available)),bodyX=outer+s.marginWidth+(available-bodyWidth)/2;
 const hs=s.headerScale/100,headerX=outer+108*hs,headerWidth=Math.max(70,width-outer-headerX),headerRows=[];
 let headerHeight=0;
 if(s.header){
  let y=outer;
  for(const [key,size,gap,tracking] of [['subtitle',10*hs,12*hs,2*hs],['title',44*hs,12*hs,0],['description',17*hs,0,0]]){
   if(!s[key])continue;const b={font:key==='subtitle'?'serif':'kopubBatang',size,bold:false};
   const lines=wrapText(s[key],headerWidth,text=>measure(b,text)+(Math.max(0,Array.from(text).length-1)*tracking));
   headerRows.push({key,x:headerX,y,size,tracking,lines,font:b.font,lineHeight:1.45});y+=lines.length*size*1.45+gap;
  }
  headerHeight=Math.max(y-outer,(s.chapterStar?112:104)*hs);
 }
 let y=outer+(s.header?headerHeight+s.headerGap:0),number=0,pending=false;
 const bodyTop=y,blocks=[],dialogueGap=s.size*s.lineHeight+s.dialogueGap;
 for(const source of replaceBlocks(state.blocks,state.replacementRules||[]).blocks){
  if(source.type==='line'){pending=true;continue;}
  const options=s.blocks[source.id]||{},b=textBlock(s,source),parts=[],runs=blockRuns(b);
  for(const segment of marginSegments(b.text,options.role||'auto')){
   if(segment.blank){y+=s.paragraphGap;continue;}
   const {start,end,dialogue}=segment,indent=dialogue?Math.min(s.dialogueIndent,bodyWidth/4):0;
   if(dialogue)y+=dialogueGap;
   const part={...b,text:b.text.slice(start,end),runs:sliceRuns(runs,start,end),x:bodyX+indent,y,w:bodyWidth-indent};
   part.metrics=blockMetrics(part,(text,run)=>measure(part,text,run));parts.push(part);y+=part.metrics.h+(dialogue?dialogueGap:0);
  }
  if(!parts.length)continue;
  const section=blocks.length===0||pending||options.sectionStart;pending=false;if(section)number++;
  b.x=bodyX;b.y=parts[0].y;b.w=bodyWidth;b.parts=parts;b.section=section?number:null;
  b.metrics={...parts[0].metrics,w:bodyWidth,h:y-b.y,textWidth:bodyWidth,lines:parts.flatMap(p=>p.metrics.lines)};
  blocks.push(b);y+=s.paragraphGap;
 }
 const bodyBottom=blocks.length?y-s.paragraphGap:bodyTop,footerY=bodyBottom+40;
 const footerHeight=s.footer?Math.max(s.footerLine||s.footerStar?20:0,s.footerText||s.page?42:0):0;
 return {width,height:Math.ceil((s.footer?footerY+footerHeight:bodyBottom)+outer),outer,bodyX,bodyWidth,bodyTop,bodyBottom,headerHeight,headerX,headerRows,footerY,blocks};
}
function star(c,x,y,size){
 c.beginPath();c.moveTo(x,y-size);c.quadraticCurveTo(x,y,x+size,y);c.quadraticCurveTo(x,y,x,y+size);c.quadraticCurveTo(x,y,x-size,y);c.quadraticCurveTo(x,y,x,y-size);c.fill();
}
function tracked(c,text,x,y,spacing=0){for(const ch of Array.from(text)){fillTextWithSpaces(c,ch,x,y);x+=c.measureText(ch).width+spacing;}}
function frame(c,s,width,height){
 const inset=14,notch=7;c.strokeStyle=s.frameColor;c.lineWidth=.7;c.beginPath();
 c.moveTo(inset+notch,inset);c.lineTo(width-inset-notch,inset);c.lineTo(width-inset-notch,inset+notch);c.lineTo(width-inset,inset+notch);c.lineTo(width-inset,height-inset-notch);c.lineTo(width-inset-notch,height-inset-notch);c.lineTo(width-inset-notch,height-inset);c.lineTo(inset+notch,height-inset);c.lineTo(inset+notch,height-inset-notch);c.lineTo(inset,height-inset-notch);c.lineTo(inset,inset+notch);c.lineTo(inset+notch,inset+notch);c.closePath();if(s.frame)c.stroke();
 if(s.corners){c.fillStyle=s.accent;for(const x of [inset+notch,width-inset-notch])for(const y of [inset+notch,height-inset-notch]){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillRect(-2,-2,4,4);c.restore();}}
}
function paintPart(c,b){
 c.save();c.textBaseline='alphabetic';const m=b.metrics,h=b.size*b.lineHeight;c.font='400 '+b.size+'px '+fonts[b.font];const sample=c.measureText('한글Ag'),ascent=sample.actualBoundingBoxAscent||b.size*.8,descent=sample.actualBoundingBoxDescent||b.size*.2;
 for(let i=0;i<m.lines.length;i++){
  const y=b.y+i*h+(h-ascent-descent)/2+ascent;
  const runs=positionedRuns(m.lines[i],m.textWidth,'left',(text,run)=>{c.font=(run.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];return c.measureText(text).width;});
  for(const run of runs){
   const x=b.x+run.x;c.font=(run.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];c.fillStyle=run.color||b.color;
   c.save();if(run.italic){c.translate(x,y);c.transform(1,0,-.21,1,0,0);}fillTextWithSpaces(c,run.text,run.italic?0:x,run.italic?0:y);c.restore();
   const thickness=Math.max(1,b.size/18);if(run.underline)c.fillRect(x,y+Math.max(2,descent/2),run.w,thickness);if(run.strike)c.fillRect(x,y-ascent*.38,run.w,thickness);
  }
 }
 c.restore();
}
export function paintMargin(target,state,layout,background,scale=1,editingId=null){
 const c=target.getContext('2d'),s=marginSettings(state),g=layout,hs=s.headerScale/100;
 c.save();c.setTransform(scale,0,0,scale,0,0);c.clearRect(0,0,g.width,g.height);c.drawImage(background,0,0,g.width,g.height);c.textAlign='left';c.textBaseline='top';frame(c,s,g.width,g.height);
 if(s.header){
  c.fillStyle=s.muted;c.font=(9*hs)+'px Georgia,serif';tracked(c,'CHAPTER',g.outer,g.outer+2*hs,1.6*hs);
  c.font=(62*hs)+'px Georgia,serif';c.fillText(s.chapter,g.outer,g.outer+16*hs,82*hs);
  c.fillStyle=s.accent;if(s.chapterStar)star(c,g.outer+33*hs,g.outer+99*hs,11*hs);
  c.strokeStyle=s.frameColor;c.lineWidth=.8;c.beginPath();c.moveTo(g.headerX-24*hs,g.outer);c.lineTo(g.headerX-24*hs,g.outer+g.headerHeight);c.stroke();
  for(const row of g.headerRows){c.fillStyle=row.key==='title'?s.color:s.muted;c.font='400 '+row.size+'px '+(row.key==='subtitle'?'Georgia,serif':fonts[row.font]);row.lines.forEach((text,i)=>tracked(c,text,row.x,row.y+i*row.size*row.lineHeight,row.tracking));}
 }
 if(s.guide&&g.blocks.length){c.strokeStyle=s.frameColor;c.globalAlpha=.45;c.lineWidth=.6;c.beginPath();c.moveTo(g.outer+s.marginWidth*.7,g.bodyTop);c.lineTo(g.outer+s.marginWidth*.7,g.bodyBottom);c.stroke();c.globalAlpha=1;}
 for(const b of g.blocks){
  if(b.section){
   const x=g.outer+s.marginWidth*.22,y=b.y+s.size*.3;c.fillStyle=s.numberColor;c.font='13px Georgia,serif';if(s.numbers)c.fillText(String(b.section).padStart(2,'0'),x,y);
   if(s.diamonds){c.fillStyle=s.numberColor;c.save();c.translate(x+7,y+(s.numbers?24:7));c.rotate(Math.PI/4);c.fillRect(-2.5,-2.5,5,5);c.restore();}
  }
  if(b.id!==editingId)for(const part of b.parts)paintPart(c,part);
 }
 if(s.footer){
  c.fillStyle=s.accent;c.strokeStyle=s.accent;c.lineWidth=.7;
  if(s.footerLine){c.beginPath();c.moveTo(g.outer,g.footerY);c.lineTo(g.width/2-(s.footerStar?16:0),g.footerY);c.moveTo(g.width/2+(s.footerStar?16:0),g.footerY);c.lineTo(g.width-g.outer,g.footerY);c.stroke();}
  if(s.footerStar)star(c,g.width/2,g.footerY,8);
  c.fillStyle=s.muted;c.font='11px Georgia,serif';c.textBaseline='top';
  const textY=g.footerY+(s.footerLine||s.footerStar?22:0),max=s.page?(g.width-g.outer*2)*.7:g.width-g.outer*2;
  c.save();c.beginPath();c.rect(g.outer,textY,max,20);c.clip();tracked(c,s.footerText,g.outer,textY,1.7);c.restore();
  if(s.page){c.textAlign='right';c.fillText(s.pageText,g.width-g.outer,textY);}
 }
 c.restore();
}
