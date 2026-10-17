import {fonts,wrapText} from './core.js';
import {blockMetrics} from './messages.js';
import {blockRuns,fillTextWithSpaces} from './richtext.js';
import {replaceBlocks} from './replace.js';
import {paintPrintText} from './stripe.js';

const defaults={width:1080,paper:'#e4e3df',color:'#252622',font:'pretendard',size:26,lineHeight:1.7,infoOn:true,name:'UNSAID',heading:'비가 그친 자리',tag:'RECORD / 001',note:'말하지 못한 마음들이\n아직 여기에 남아 있다.',project:'THE THINGS WE NEVER SAID',code:'ARCHIVE / 001'};
const limits={width:[400,1600],size:[12,100],lineHeight:[1,3]};
export function folioSettings(state){
 const s={...defaults,...state.folioLayout};
 for(const [key,[min,max]] of Object.entries(limits))s[key]=Number.isFinite(s[key])?Math.max(min,Math.min(max,s[key])):defaults[key];
 return s;
}
export function validFolio(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 for(const [key,[min,max]] of Object.entries(limits))if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max))return false;
 if(['paper','color'].some(key=>s[key]!==undefined&&!/^#[\da-f]{6}$/i.test(s[key]))||['name','heading','tag','note','project','code'].some(key=>s[key]!==undefined&&typeof s[key]!=='string'))return false;
 return (s.infoOn===undefined||typeof s.infoOn==='boolean')&&(s.font===undefined||Object.hasOwn(fonts,s.font));
}
export function folioLayout(state,measure){
 const s=folioSettings(state),width=s.width,k=width/1080,outer=50*k,inset=60*k,bodyX=outer+inset,bodyWidth=width-bodyX*2,bodyTop=100*k,blocks=[];
 let y=bodyTop;
 for(const source of replaceBlocks(state.blocks,state.replacementRules||[]).blocks){
  if(source.type==='line')continue;
  const b={...source,type:'text',presentation:'plain',font:s.font,size:s.size,lineHeight:s.lineHeight,color:s.color,align:'left',bold:false,padding:0,opacity:0,group:null,runs:blockRuns(source),x:bodyX,y,w:bodyWidth};
  b.metrics=blockMetrics(b,(text,run)=>measure(b,text,run));blocks.push(b);y+=b.metrics.h+30*k;
 }
 const columnWidth=(width-outer*2)/2-56*k,barSplit=outer+(width-outer*2)*.68;
 const rows=(key,size,w,bold=false,tracking=0)=>s.infoOn&&s[key]?wrapText(s[key],w,text=>measure({font:'pretendard',size:size*k,bold},text)+Math.max(0,Array.from(text).length-1)*tracking*k):[];
 const nameLines=rows('name',40,width-outer*2-56*k,false,3.2),headingLines=rows('heading',24,columnWidth,true),tagLines=rows('tag',22,columnWidth,true),noteLines=rows('note',18,columnWidth);
 const projectLines=rows('project',20,(s.code?barSplit-outer:width-outer*2)-40*k,true),codeLines=rows('code',20,(s.project?width-outer-barSplit:width-outer*2)-40*k,true);
 const nameHeight=nameLines.length?nameLines.length*52*k+30*k:0,leftHeight=headingLines.length*34*k+tagLines.length*30*k+(headingLines.length&&tagLines.length?26*k:0);
 const infoHeight=headingLines.length||tagLines.length||noteLines.length?Math.max(172*k,leftHeight+48*k,noteLines.length*28*k+48*k):0;
 const barHeight=projectLines.length||codeLines.length?Math.max(56*k,Math.max(projectLines.length,codeLines.length)*26*k+30*k):0,barGap=barHeight?34*k:0;
 const bodyBottom=blocks.length?y-30*k:bodyTop,height=Math.ceil(Math.max(width*1.25,bodyBottom+80*k+nameHeight+infoHeight+barGap+barHeight+outer));
 const mainBottom=height-outer-barHeight-barGap,infoY=mainBottom-infoHeight,nameY=infoY-nameHeight,barY=height-outer-barHeight;
 return {width,height,k,outer,bodyX,bodyWidth,bodyTop,bodyBottom,mainBottom,nameY,nameHeight,infoY,infoHeight,barY,barHeight,barSplit,nameLines,headingLines,tagLines,noteLines,projectLines,codeLines,blocks};
}
export function paintFolio(target,state,g,scale=1,editingId=null){
 const c=target.getContext('2d'),s=folioSettings(state),{width,height,k,outer,mainBottom,nameY,nameHeight,infoY,infoHeight,barY,barHeight,barSplit}=g;
 c.save();c.setTransform(scale,0,0,scale,0,0);c.clearRect(0,0,width,height);c.fillStyle=s.paper;c.fillRect(0,0,width,height);
 c.strokeStyle=s.color;c.globalAlpha=.7;c.lineWidth=.85*k;c.strokeRect(outer,outer,width-outer*2,mainBottom-outer);
 if(nameHeight){c.beginPath();c.moveTo(outer,nameY);c.lineTo(width-outer,nameY);c.stroke();}
 if(infoHeight){c.beginPath();c.moveTo(outer,infoY);c.lineTo(width-outer,infoY);c.moveTo(width/2,infoY);c.lineTo(width/2,mainBottom);c.stroke();}
 if(barHeight){c.strokeRect(outer,barY,width-outer*2,barHeight);if(g.projectLines.length&&g.codeLines.length){c.beginPath();c.moveTo(barSplit,barY);c.lineTo(barSplit,barY+barHeight);c.stroke();}}
 c.globalAlpha=1;c.textBaseline='top';c.textAlign='left';
 c.fillStyle=s.color;
 if(nameHeight){c.font='400 '+(40*k)+'px '+fonts.pretendard;g.nameLines.forEach((line,i)=>{const chars=Array.from(line),spacing=3.2*k,natural=c.measureText(line).width+Math.max(0,chars.length-1)*spacing;let x=(width-natural)/2;for(const ch of chars){fillTextWithSpaces(c,ch,x,nameY+15*k+i*52*k);x+=c.measureText(ch).width+spacing;}});}
 if(infoHeight){
  c.font='700 '+(24*k)+'px '+fonts.pretendard;g.headingLines.forEach((line,i)=>fillTextWithSpaces(c,line,outer+28*k,infoY+24*k+i*34*k));
  c.font='700 '+(22*k)+'px '+fonts.pretendard;const tagY=infoY+24*k+g.headingLines.length*34*k+(g.headingLines.length&&g.tagLines.length?26*k:0);g.tagLines.forEach((line,i)=>fillTextWithSpaces(c,line,outer+28*k,tagY+i*30*k));
  c.font='400 '+(18*k)+'px '+fonts.pretendard;g.noteLines.forEach((line,i)=>fillTextWithSpaces(c,line,width/2+28*k,infoY+24*k+i*28*k));
 }
 if(barHeight){c.font='700 '+(20*k)+'px '+fonts.pretendard;g.projectLines.forEach((line,i)=>fillTextWithSpaces(c,line,outer+20*k,barY+15*k+i*26*k));g.codeLines.forEach((line,i)=>fillTextWithSpaces(c,line,(g.projectLines.length?barSplit:outer)+20*k,barY+15*k+i*26*k));}
 for(const b of g.blocks)if(b.id!==editingId)paintPrintText(c,b);
 c.restore();
}
