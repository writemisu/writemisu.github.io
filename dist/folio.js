import {fonts,wrapText} from './core.js';
import {blockMetrics} from './messages.js';
import {blockRuns,fillTextWithSpaces} from './richtext.js';
import {replaceBlocks} from './replace.js';
import {paintPrintText,alignPrintBlock,validPrintOptions} from './print.js';

const defaults={width:1080,paper:'#e4e3df',color:'#252622',font:'pretendard',size:26,lineHeight:1.7,infoOn:true,project:'봇 이름',code:'ARCHIVE / 001'};
const defaultQuoteStyle={enabled:true,color:null,highlight:'#888888',highlightOpacity:10,bold:false,italic:false,underline:false,strike:false};
const limits={width:[400,1600],size:[12,100],lineHeight:[1,3]};
export function folioSettings(state){
 const {name,heading,tag,note,...stored}=state.folioLayout||{},s={...defaults,quoteStyle:{...defaultQuoteStyle},...(state.quoteStyle?{quoteStyle:state.quoteStyle}:{}),...stored,blocks:stored.blocks||{}};
 for(const [key,[min,max]] of Object.entries(limits))s[key]=Number.isFinite(s[key])?Math.max(min,Math.min(max,s[key])):defaults[key];
 return s;
}
export function validFolio(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 for(const [key,[min,max]] of Object.entries(limits))if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max))return false;
 if(['paper','color'].some(key=>s[key]!==undefined&&!/^#[\da-f]{6}$/i.test(s[key]))||['name','heading','tag','note','project','code'].some(key=>s[key]!==undefined&&typeof s[key]!=='string'))return false;
 return (s.infoOn===undefined||typeof s.infoOn==='boolean')&&(s.font===undefined||Object.hasOwn(fonts,s.font))&&validPrintOptions(s);
}
export function folioLayout(state,measure){
 const s=folioSettings(state),width=s.width,k=width/1080,outer=50*k,inset=60*k,bodyX=outer+inset,bodyWidth=width-bodyX*2,bodyTop=100*k,blocks=[];
 let y=bodyTop;
 for(const source of replaceBlocks(state.blocks,state.replacementRules||[]).blocks){
  if(source.type==='line')continue;
  const options=s.blocks[source.id]||{},blockWidth=Math.min(bodyWidth,Math.max(20,options.w??bodyWidth));
  const b={...source,type:'text',presentation:'plain',font:s.font,size:s.size,lineHeight:s.lineHeight,color:s.color,align:options.align||'left',layerAlign:options.layerAlign,bold:false,padding:0,opacity:0,group:null,runs:blockRuns(source),x:bodyX,y,w:blockWidth};
  b.metrics=blockMetrics(b,(text,run)=>measure(b,text,run),s.quoteStyle);alignPrintBlock(b,bodyX,bodyWidth,b.layerAlign,options.w===undefined?undefined:blockWidth,options.x);blocks.push(b);y+=b.metrics.h+30*k;
 }
 const barSplit=outer+(width-outer*2)*.68;
 const rows=(key,w)=>s.infoOn&&s[key]?wrapText(s[key],w,text=>measure({font:'mona12',size:20*k,bold:false},text)):[];
 const projectLines=rows('project',(s.code?barSplit-outer:width-outer*2)-40*k),codeLines=rows('code',(s.project?width-outer-barSplit:width-outer*2)-40*k);
 const barHeight=projectLines.length||codeLines.length?Math.max(56*k,Math.max(projectLines.length,codeLines.length)*26*k+30*k):0,barGap=barHeight?34*k:0;
 const bodyBottom=blocks.length?y-30*k:bodyTop,height=Math.ceil(Math.max(width*1.25,bodyBottom+80*k+barGap+barHeight+outer));
 const mainBottom=height-outer-barHeight-barGap,barY=height-outer-barHeight;
 return {width,height,k,outer,bodyX,bodyWidth,bodyTop,bodyBottom,mainBottom,barY,barHeight,barSplit,projectLines,codeLines,blocks};
}
export function paintFolio(target,state,g,scale=1,editingId=null){
 const c=target.getContext('2d'),s=folioSettings(state),{width,height,k,outer,mainBottom,barY,barHeight,barSplit}=g;
 c.save();c.setTransform(scale,0,0,scale,0,0);c.clearRect(0,0,width,height);c.fillStyle=s.paper;c.fillRect(0,0,width,height);
 c.strokeStyle=s.color;c.globalAlpha=.7;c.lineWidth=.85*k;c.strokeRect(outer,outer,width-outer*2,mainBottom-outer);
 if(barHeight){c.strokeRect(outer,barY,width-outer*2,barHeight);if(g.projectLines.length&&g.codeLines.length){c.beginPath();c.moveTo(barSplit,barY);c.lineTo(barSplit,barY+barHeight);c.stroke();}}
 c.globalAlpha=1;c.textBaseline='top';c.textAlign='left';
 c.fillStyle=s.color;
 if(barHeight){
  c.save();c.font='400 '+(20*k)+'px '+fonts.mona12;c.textBaseline='alphabetic';
  for(const [lines,x] of [[g.projectLines,outer+20*k],[g.codeLines,(g.projectLines.length?barSplit:outer)+20*k]]){
   const lineHeight=26*k,top=barY+(barHeight-lines.length*lineHeight)/2;
   lines.forEach((line,i)=>{const sample=c.measureText(line),ascent=sample.actualBoundingBoxAscent??16*k,descent=sample.actualBoundingBoxDescent??4*k;fillTextWithSpaces(c,line,x,top+(i+.5)*lineHeight+(ascent-descent)/2);});
  }
  c.restore();
 }
 for(const b of g.blocks)if(b.id!==editingId)paintPrintText(c,b);
 c.restore();
}
