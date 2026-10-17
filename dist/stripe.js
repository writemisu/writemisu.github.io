import {fonts,wrapText} from './core.js';
import {blockMetrics} from './messages.js';
import {blockRuns,positionedRuns,fillTextWithSpaces} from './richtext.js';
import {replaceBlocks} from './replace.js';

const defaults={width:1080,paper:'#efe5cf',panel:'#23221e',color:'#28251f',red:'#b63425',orange:'#df702b',yellow:'#e7af43',infoOn:true,infoLabel:'STP / 001',infoText:'서윤 × 해준',titleOn:true,title:'비가 그친 자리',font:'kopubBatang',size:28,lineHeight:1.8,texture:24};
const limits={width:[400,1600],size:[12,100],lineHeight:[1,3],texture:[0,60]};
export function stripeSettings(state){
 const s={...defaults,...state.stripeLayout};
 for(const [key,[min,max]] of Object.entries(limits))s[key]=Number.isFinite(s[key])?Math.max(min,Math.min(max,s[key])):defaults[key];
 return s;
}
export function validStripe(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 for(const [key,[min,max]] of Object.entries(limits))if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max))return false;
 if(['paper','panel','color','red','orange','yellow'].some(key=>s[key]!==undefined&&!/^#[\da-f]{6}$/i.test(s[key])))return false;
 if(['infoOn','titleOn'].some(key=>s[key]!==undefined&&typeof s[key]!=='boolean')||['infoLabel','infoText','title'].some(key=>s[key]!==undefined&&typeof s[key]!=='string'))return false;
 return s.font===undefined||Object.hasOwn(fonts,s.font);
}
export function stripeLayout(state,measure){
 const s=stripeSettings(state),width=s.width,k=width/1080,stripWidth=width*.2,bodyX=stripWidth+72*k,bodyWidth=width-bodyX-56*k;
 const infoWidth=stripWidth-68*k,infoFont={font:'pretendard',size:28*k,bold:false},labelFont={font:'pretendard',size:12*k,bold:false};
 const infoLines=s.infoOn&&s.infoText?wrapText(s.infoText,infoWidth,text=>measure(infoFont,text)):[];
 const labelLines=s.infoOn&&s.infoLabel?wrapText(s.infoLabel,infoWidth,text=>measure(labelFont,text)):[];
 const labelY=354*k,infoY=labelY+Math.max(0,labelLines.length*18*k)+(labelLines.length?28*k:0),infoBottom=infoY+infoLines.length*42*k;
 const graphicTop=Math.max(590*k,infoBottom+64*k),graphicBottom=graphicTop+500*k;
 const titleFont={font:s.font,size:30*k,bold:false},titleLines=s.titleOn&&s.title?wrapText(s.title,bodyWidth,text=>measure(titleFont,text)):[];
 const top=70*k,titleHeight=titleLines.length*42*k,bodyTop=top+(titleLines.length?titleHeight+40*k:28*k),blocks=[];
 let y=bodyTop;
 for(const source of replaceBlocks(state.blocks,state.replacementRules||[]).blocks){
  if(source.type==='line')continue;
  const b={...source,type:'text',presentation:'plain',font:s.font,size:s.size,lineHeight:s.lineHeight,color:s.color,align:'left',bold:false,padding:0,opacity:0,group:null,runs:blockRuns(source),x:bodyX,y,w:bodyWidth};
  b.metrics=blockMetrics(b,(text,run)=>measure(b,text,run));blocks.push(b);y+=b.metrics.h+28*k;
 }
 const bodyBottom=blocks.length?y-28*k:bodyTop,height=Math.ceil(Math.max(width*1.25,bodyBottom+72*k,graphicBottom+220*k));
 return {width,height,k,stripWidth,bodyX,bodyWidth,bodyTop,bodyBottom,top,titleLines,titleHeight,labelLines,labelY,infoLines,infoY,graphicTop,graphicBottom,blocks};
}
function hash(x,y,seed){let n=Math.imul(x,374761393)+Math.imul(y,668265263)+seed*1447;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function polygon(c,points,color){c.fillStyle=color;c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();c.fill();}
function tracked(c,text,x,y,spacing){for(const ch of Array.from(text)){fillTextWithSpaces(c,ch,x,y);x+=c.measureText(ch).width+spacing;}}
function graphics(c,state,g,s){
 const {width,height,k,stripWidth:w,graphicTop:top,graphicBottom:bottom}=g,left=9*k,right=w-9*k;
 c.fillStyle=s.panel;c.fillRect(left,9*k,right-left,310*k);
 c.strokeStyle=s.paper;c.globalAlpha=.55;c.lineWidth=.7*k;c.strokeRect(17*k,17*k,w-34*k,294*k);c.globalAlpha=1;
 c.fillStyle=s.paper;c.font='400 '+(17*k)+'px monospace';
 for(const [i,line] of ['STRIPE','STORY','SERIES'].entries())tracked(c,line,35*k,(61+i*31)*k,3.6*k);
 c.fillRect(35*k,183*k,34*k,3*k);
 for(let i=0;i<24;i++){c.globalAlpha=i%5===0?.8:.4;c.fillRect((35+i*5)*k,226*k,(i%3===0?2:1)*k,(i%4===0?22:16)*k);}c.globalAlpha=1;
 c.strokeStyle=s.paper;c.globalAlpha=.45;c.beginPath();c.moveTo(35*k,267*k);c.lineTo(w-35*k,267*k);c.stroke();c.globalAlpha=1;
 for(let i=0;i<3;i++){c.fillStyle=[s.red,s.orange,s.yellow][i];c.fillRect((35+i*32)*k,287*k,23*k,5*k);}
 c.fillStyle=s.panel;c.font='400 '+(12*k)+'px '+fonts.pretendard;
 if(g.labelLines.length){const h=(g.labelLines.length*18+14)*k;c.lineWidth=.8*k;c.strokeStyle=s.panel;c.strokeRect(34*k,g.labelY-7*k,w-68*k,h);g.labelLines.forEach((line,i)=>fillTextWithSpaces(c,line,40*k,g.labelY+i*18*k));}
 c.font='400 '+(28*k)+'px '+fonts.pretendard;g.infoLines.forEach((line,i)=>fillTextWithSpaces(c,line,34*k,g.infoY+i*42*k));
 c.strokeStyle=s.panel;c.globalAlpha=.65;c.lineWidth=.7*k;c.beginPath();c.moveTo(34*k,top-48*k);c.lineTo(w-34*k,top-48*k);c.stroke();c.globalAlpha=1;
 c.fillStyle=s.panel;c.fillRect(left,top,right-left,bottom-top);
 polygon(c,[[left,top],[right,top],[left,top+166*k]],s.paper);
 for(const [a,b,color] of [[0,146,s.red],[146,236,s.orange],[236,326,s.yellow]])polygon(c,[[left,top+(166+a)*k],[right,top+a*k],[right,top+b*k],[left,top+(166+b)*k]],color);
 c.strokeStyle=s.panel;c.lineWidth=.8*k;c.beginPath();c.moveTo(w,0);c.lineTo(w,height);c.moveTo(w+17*k,0);c.lineTo(w+17*k,height);c.stroke();
 c.font='400 '+(11*k)+'px monospace';c.fillStyle=s.panel;
 for(const [i,line] of ['A STORY','OF UNSAID','THINGS'].entries())tracked(c,line,35*k,bottom+(35+i*21)*k,1.4*k);
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){c.fillStyle=[s.red,s.red,s.orange,s.yellow,s.red,s.orange,s.yellow,s.panel,s.red,s.yellow,s.panel,s.panel][row*4+col];c.beginPath();c.arc((42+col*17)*k,bottom+(121+row*17)*k,5.3*k,0,Math.PI*2);c.fill();}
 c.strokeStyle=s.panel;c.globalAlpha=.45;c.lineWidth=.7*k;c.strokeRect(7*k,7*k,width-14*k,height-14*k);c.globalAlpha=1;
 if(!s.texture)return;
 const ink=s.texture/60,seed=state.seed||741;
 c.save();c.beginPath();c.rect(left,9*k,right-left,height-18*k);c.clip();
 for(let y=14;y<height/k-10;y+=4)for(let x=12;x<w/k-10;x+=4){const n=hash(x,y,seed);if(n<.62)continue;c.fillStyle=s.paper;c.globalAlpha=(n-.6)*ink*.8;c.fillRect((x+hash(y,x,seed)*3)*k,(y+hash(x+1,y,seed)*3)*k,(.6+n*1.7)*k,(.5+n)*k);}
 c.strokeStyle=s.paper;c.lineWidth=.6*k;c.globalAlpha=ink*.4;
 for(let i=0;i<17;i++){const x=hash(i,1,seed)*w,y=hash(i,2,seed)*Math.min(height,bottom);c.beginPath();c.moveTo(x-50*k,y-80*k);c.lineTo(x+70*k,y+55*k);c.stroke();}
 c.restore();
 c.strokeStyle=s.panel;c.globalAlpha=ink*.35;c.lineWidth=1.6*k;
 for(const x of [3*k,width-3*k]){c.beginPath();for(let y=0;y<height;y+=7*k){const px=x+(hash(Math.round(x),Math.round(y/k),seed)-.5)*5*k;if(y===0)c.moveTo(px,y);else c.lineTo(px,y);}c.stroke();}
 c.globalAlpha=1;
}
export function paintPrintText(c,b){
 const m=b.metrics,h=b.size*b.lineHeight;c.save();c.textBaseline='alphabetic';c.font='400 '+b.size+'px '+fonts[b.font];
 const sample=c.measureText('한글Ag'),ascent=sample.actualBoundingBoxAscent||b.size*.8,descent=sample.actualBoundingBoxDescent||b.size*.2;
 for(let i=0;i<m.lines.length;i++){
  const y=b.y+i*h+(h-ascent-descent)/2+ascent,runs=positionedRuns(m.lines[i],m.textWidth,'left',(text,run)=>{c.font=(run.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];return c.measureText(text).width;});
  for(const run of runs){const x=b.x+run.x;c.font=(run.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];c.fillStyle=run.color||b.color;c.save();if(run.italic){c.translate(x,y);c.transform(1,0,-.21,1,0,0);}fillTextWithSpaces(c,run.text,run.italic?0:x,run.italic?0:y);c.restore();const thickness=Math.max(1,b.size/18);if(run.underline)c.fillRect(x,y+Math.max(2,descent/2),run.w,thickness);if(run.strike)c.fillRect(x,y-ascent*.38,run.w,thickness);}
 }
 c.restore();
}
let paperCache;
export function paintStripe(target,state,g,paper,scale=1,editingId=null){
 const c=target.getContext('2d'),s=stripeSettings(state),ratio=Math.min(scale,12000/g.height,Math.sqrt(12000000/(g.width*g.height))),key=JSON.stringify([g.width,g.height,g.graphicTop,g.labelLines,g.infoLines,s.paper,s.panel,s.red,s.orange,s.yellow,s.infoOn,s.infoLabel,s.infoText,s.texture,state.seed,ratio,document.fonts?.check('400 28px '+fonts.pretendard,s.infoText+s.infoLabel)]);
 if(paperCache?.key!==key){const layer=document.createElement('canvas');layer.width=Math.ceil(g.width*ratio);layer.height=Math.ceil(g.height*ratio);const ink=layer.getContext('2d');ink.setTransform(ratio,0,0,ratio,0,0);ink.drawImage(paper,0,0,g.width,g.height);ink.textBaseline='top';graphics(ink,state,g,s);paperCache={key,layer};}
 c.save();c.setTransform(scale,0,0,scale,0,0);c.clearRect(0,0,g.width,g.height);c.drawImage(paperCache.layer,0,0,g.width,g.height);c.textAlign='left';c.textBaseline='top';
 if(g.titleLines.length){c.fillStyle=s.color;c.font='400 '+(30*g.k)+'px '+fonts[s.font];g.titleLines.forEach((line,i)=>fillTextWithSpaces(c,line,g.bodyX,g.top+i*42*g.k));}
 else{c.fillStyle=s.red;c.fillRect(g.bodyX,g.top,36*g.k,3*g.k);}
 for(const b of g.blocks)if(b.id!==editingId)paintPrintText(c,b);
 c.restore();
}
