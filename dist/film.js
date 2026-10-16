import {fonts} from './core.js';
import {blockMetrics} from './messages.js';
import {positionedRuns,fillTextWithSpaces} from './richtext.js';
import {replaceBlocks} from './replace.js';
import {paintFilmPlayer} from './film-player.js';

const bounded=(n,fallback,min,max)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
const ratios={'16:9':16/9,'2.39:1':2.39,'4:5':4/5};
export function filmSettings(state){
 const f=state.film||{},playerDuration=Math.round(bounded(f.playerDuration,15,1,86400)),metadataOn=f.metadataOn??(f.sceneOn!==false||f.timecodeOn!==false),leftText=f.leftText??(f.sceneOn===false?'':'SCENE '+(f.scene??'04')+' / TAKE '+(f.take??'02')),rightText=f.rightText??(f.timecodeOn===false?'':f.timecode??'00:02:17:08');
 return {width:bounded(f.width,state.width||800,400,1600),ratio:Object.hasOwn(ratios,f.ratio)?f.ratio:'16:9',background:f.background||state.colors?.[0]||'#18212b',imageId:f.imageId||null,imageName:f.imageName||'',fit:f.fit==='contain'?'contain':'cover',x:bounded(f.x,.5,0,1),y:bounded(f.y,.5,0,1),blur:bounded(f.blur,2,0,20),darken:bounded(f.darken,28,0,80),letterbox:f.letterbox!==false,barPercent:bounded(f.barPercent,9,0,25),player:f.player===true,playerDuration,playerElapsed:Math.round(bounded(f.playerElapsed,Math.min(2,playerDuration),0,playerDuration)),metadataOn,leftText,rightText,grain:bounded(f.grain,11,0,30),vignette:bounded(f.vignette,20,0,80),size:bounded(f.size,24,1,200),outline:bounded(f.outline,2,0,6),shadow:f.shadow!==false,blocks:f.blocks||{}};
}
export function filmSize(state){const s=filmSettings(state);return {width:s.width,height:Math.round(s.width/ratios[s.ratio])};}
export function filmImageRect(image,width,height,fit='cover',x=.5,y=.5){
 const scale=Math[fit==='contain'?'min':'max'](width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;
 return {x:(width-w)*x,y:(height-h)*y,w,h};
}
export function filmLayout(state,measure){
 const s=filmSettings(state),{width,height}=filmSize(state),scale=width/800,bar=s.letterbox?height*s.barPercent/100:0,playerHeight=s.player?60*scale:0,bottomInset=Math.max(bar,playerHeight),safe=width*.045;
 const metadataY=bar>=24*scale?bar/2:Math.max(height*.05,10*scale),top=Math.max(bar+safe,s.metadataOn&&(s.leftText||s.rightText)?metadataY+6.5*scale+width*.02:0);
 const sources=replaceBlocks(state.blocks,state.replacementRules||[]).blocks.filter(b=>b.type==='text');
 const blocks=sources.map((source,i)=>{
  const override=s.blocks[source.id]||{},b={...source,presentation:'plain',group:null,font:'pretendard',size:s.size*scale,lineHeight:1.3,align:'center',color:'#ffffff',box:'#000000',opacity:0,padding:0,bold:false,...override};
  b.visible=override.visible??i===0;b.w=(override.w??.78)*width;b.size=(override.size??s.size)*scale;b.padding=(override.padding??0)*scale;
  b.metrics=blockMetrics(b,(text,run)=>measure(b,text,run));b.x=override.x===undefined?(width-b.w)/2:override.x*width;
  return b;
 });
 let bottom=height-bottomInset-safe;
 for(const b of blocks.filter(b=>b.visible).reverse()){
  const override=s.blocks[b.id]||{};b.y=override.y===undefined?Math.max(top,bottom-b.metrics.h):override.y*height;
  bottom=b.y-width*.018;
 }
 for(const b of blocks)if(b.y===undefined)b.y=height-bottomInset-safe-b.metrics.h;
 const warnings=blocks.filter(b=>b.visible&&(b.metrics.lines.length>3||b.x<0||b.x+b.metrics.w>width||b.y<top||b.y+b.metrics.h>height-bottomInset-safe+1)).map(b=>({id:b.id,lines:b.metrics.lines.length}));
 return {width,height,scale,bar,playerHeight,bottomInset,metadataY,safe,blocks,warnings};
}

let backgroundCache,grainCache;
function filmBackground(state,image,layout){
 const s=filmSettings(state),{width,height}=layout,key=JSON.stringify([width,height,s.imageId,s.background,s.fit,s.x,s.y,s.blur,s.darken,s.vignette,!!image]);
 if(backgroundCache?.key===key)return backgroundCache.canvas;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');c.fillStyle=s.background;c.fillRect(0,0,width,height);
 if(image){const r=filmImageRect(image,width,height,s.fit,s.x,s.y);c.save();c.filter='blur('+s.blur+'px)';c.drawImage(image,r.x,r.y,r.w,r.h);c.restore();}
 c.fillStyle='rgba(0,0,0,'+s.darken/100+')';c.fillRect(0,0,width,height);
 if(s.vignette){const gradient=c.createRadialGradient(width/2,height/2,Math.min(width,height)*.15,width/2,height/2,Math.hypot(width,height)/2);gradient.addColorStop(0,'transparent');gradient.addColorStop(1,'rgba(0,0,0,'+s.vignette/100+')');c.fillStyle=gradient;c.fillRect(0,0,width,height);}
 backgroundCache={key,canvas};return canvas;
}
function filmGrain(state,layout){
 const s=filmSettings(state),{width,height}=layout,key=[width,height,s.grain,state.seed].join(':');
 if(grainCache?.key===key)return grainCache.canvas;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d'),pixels=c.createImageData(width,height);let random=state.seed||741;
 for(let i=0;i<pixels.data.length;i+=4){random^=random<<13;random^=random>>>17;random^=random<<5;const value=(random>>>0)/4294967295,ink=value<.5?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=ink;pixels.data[i+3]=Math.round(Math.abs(value-.5)*s.grain*1.4);}
 c.putImageData(pixels,0,0);grainCache={key,canvas};return canvas;
}
function trackedText(c,text,x,y,spacing,align='left',maxWidth=Infinity){
 const chars=Array.from(text),natural=chars.reduce((n,ch)=>n+c.measureText(ch).width,0)+Math.max(0,chars.length-1)*spacing,shrink=Math.min(1,maxWidth/Math.max(1,natural));
 c.save();c.translate(x,y);c.scale(shrink,1);let left=align==='right'?-natural:0;
 for(const ch of chars){c.fillText(ch,left,0);left+=c.measureText(ch).width+spacing;}c.restore();
}
export function paintFilm(target,state,image,layout,scale=1,editingId=null){
 const c=target.getContext('2d'),s=filmSettings(state),{width,height,bar}=layout;
 c.save();c.setTransform(scale,0,0,scale,0,0);c.clearRect(0,0,width,height);c.beginPath();c.roundRect(0,0,width,height,12*layout.scale);c.clip();c.drawImage(filmBackground(state,image,layout),0,0);
 c.textAlign='left';c.textBaseline='alphabetic';c.lineJoin='round';
 for(const b of layout.blocks){
  if(!b.visible||b.id===editingId)continue;const m=b.metrics,h=b.size*b.lineHeight;
  c.font=(b.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];const sample=c.measureText('한글Ag'),ascent=sample.actualBoundingBoxAscent||b.size*.8,descent=sample.actualBoundingBoxDescent||b.size*.2;
  for(let i=0;i<m.lines.length;i++){
   const y=b.y+m.paddingY+i*h+(h-ascent-descent)/2+ascent;
   const runs=positionedRuns(m.lines[i],m.textWidth,b.align,(text,run)=>{c.font=(run.bold||b.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];return c.measureText(text).width;});
   for(const run of runs){
    const x=b.x+m.paddingX+run.x;c.font=(run.bold||b.bold?'700':'400')+' '+b.size+'px '+fonts[b.font];c.fillStyle=run.color||b.color;
    c.save();if(run.italic){c.translate(x,y);c.transform(1,0,-.21,1,0,0);}c.strokeStyle='#000000';c.lineWidth=s.outline*layout.scale*2;
    if(s.shadow){c.shadowColor='rgba(0,0,0,.65)';c.shadowBlur=3*layout.scale;c.shadowOffsetY=2*layout.scale;}
    if(s.outline)c.strokeText(run.text,run.italic?0:x,run.italic?0:y);fillTextWithSpaces(c,run.text,run.italic?0:x,run.italic?0:y);c.restore();
    const thickness=Math.max(1,b.size/18);if(run.underline)c.fillRect(x,y+Math.max(2,descent/2),run.w,thickness);if(run.strike)c.fillRect(x,y-ascent*.38,run.w,thickness);
   }
  }
 }
 c.fillStyle='#090909';if(bar){c.fillRect(0,0,width,bar);c.fillRect(0,height-bar,width,bar);}
 c.fillStyle='#c9c1b5';c.font='600 '+(13*layout.scale)+'px '+fonts.pretendard;c.textBaseline='middle';
 const y=layout.metadataY,left=width*.045,max=s.leftText&&s.rightText?width*.44:width-left*2;
 if(bar<24*layout.scale){c.shadowColor='rgba(0,0,0,.75)';c.shadowBlur=2*layout.scale;c.shadowOffsetY=layout.scale;}
 if(s.metadataOn&&s.leftText)trackedText(c,s.leftText,left,y,1.8*layout.scale,'left',max);
 if(s.metadataOn&&s.rightText)trackedText(c,s.rightText,width-left,y,.9*layout.scale,'right',max);
 c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0;
 if(s.grain)c.drawImage(filmGrain(state,layout),0,0);if(s.player)paintFilmPlayer(c,s,layout);c.restore();
}

export function validFilm(f){
 if(!f||typeof f!=='object'||Array.isArray(f))return false;
 const numbers={width:[400,1600],barPercent:[0,25],playerElapsed:[0,86400],playerDuration:[1,86400],x:[0,1],y:[0,1],blur:[0,20],darken:[0,80],grain:[0,30],vignette:[0,80],size:[1,200],outline:[0,6]};
 for(const [key,[min,max]] of Object.entries(numbers))if(f[key]!==undefined&&(!Number.isFinite(f[key])||f[key]<min||f[key]>max))return false;
 if(['playerElapsed','playerDuration'].some(k=>f[k]!==undefined&&!Number.isInteger(f[k])))return false;
 if(f.ratio!==undefined&&!Object.hasOwn(ratios,f.ratio)||f.fit!==undefined&&!['cover','contain'].includes(f.fit))return false;
 if(['letterbox','player','metadataOn','sceneOn','timecodeOn','shadow'].some(k=>f[k]!==undefined&&typeof f[k]!=='boolean')||['leftText','rightText','scene','take','timecode','imageName'].some(k=>f[k]!==undefined&&typeof f[k]!=='string'))return false;
 if(f.imageId!=null&&typeof f.imageId!=='string'||f.background!==undefined&&!/^#[\da-f]{6}$/i.test(f.background))return false;
 if(f.blocks!==undefined){
  if(!f.blocks||typeof f.blocks!=='object'||Array.isArray(f.blocks))return false;
  for(const [id,b] of Object.entries(f.blocks)){
   if(!/^b\d+$/.test(id)||!b||typeof b!=='object'||Array.isArray(b))return false;
   for(const [key,min,max] of [['x',0,1],['y',0,1],['w',.01,1],['size',1,200],['lineHeight',1,3],['padding',0,60],['opacity',0,100]])if(b[key]!==undefined&&(!Number.isFinite(b[key])||b[key]<min||b[key]>max))return false;
   if(b.visible!==undefined&&typeof b.visible!=='boolean'||b.bold!==undefined&&typeof b.bold!=='boolean'||b.font!==undefined&&!Object.hasOwn(fonts,b.font)||b.align!==undefined&&!['left','center','right','justify'].includes(b.align))return false;
   if(['color','box'].some(k=>b[k]!==undefined&&!/^#[\da-f]{6}$/i.test(b[k])))return false;
  }
 }
 return true;
}
