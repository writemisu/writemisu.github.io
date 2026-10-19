import {fonts,radialGeometry} from './core.js';
import {positionedRuns,fillTextWithSpaces,lineHighlights} from './richtext.js';
import {presentationColors,chatPath} from './messages.js';

// A deterministic texture keeps preview and export identical.
export function createBackgroundRenderer(){
 let bgKey='',background=null,seed=0;
function hash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263)+seed*1447;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function smoothNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;}
function getBackground(page){seed=page.seed;const key=JSON.stringify([page.width,page.height,page.background,page.colors,page.noise,page.seed]);if(key===bgKey)return background;const c=document.createElement('canvas');const scale=Math.min(1,12000/page.height);c.width=Math.max(1,Math.round(page.width*scale));c.height=Math.round(page.height*scale);const g=c.getContext('2d'),{x,y,radius}=radialGeometry(c.width,c.height);
  const gradient=g.createRadialGradient(x,y,0,x,y,radius);page.colors.forEach((color,i)=>gradient.addColorStop(i/(page.colors.length-1),color));g.fillStyle=page.background==='solid'?page.colors[0]:gradient;g.fillRect(0,0,c.width,c.height);
  if(page.noise){const pixels=g.getImageData(0,0,c.width,c.height),data=pixels.data;let random=page.seed;const fw=Math.ceil(c.width/8)+1,fh=Math.ceil(c.height/8)+1,field=new Float32Array(fw*fh);for(let y=0;y<fh;y++)for(let x=0;x<fw;x++)field[y*fw+x]=smoothNoise(x/12,y/12)*.6+smoothNoise(x/6,y/6)*.27+smoothNoise(x/3,y/3)*.13-.5;for(let y=0;y<c.height;y++){const row=Math.floor(y/8)*fw;for(let x=0;x<c.width;x++){random^=random<<13;random^=random>>>17;random^=random<<5;const value=(((random>>>0)/4294967295-.5)*.75+field[row+Math.floor(x/8)]*.65)*page.noise,i=(y*c.width+x)*4;data[i]+=value;data[i+1]+=value;data[i+2]+=value;}}g.putImageData(pixels,0,0);}background=c;bgKey=key;return c;}
 return getBackground;
}

function paintMessageHeader(c,b,m){
 c.font=`400 ${m.headerSize}px ${fonts[b.font]}`;
 const fit=(text,width)=>{const chars=Array.from(text);if(c.measureText(text).width<=width)return text;while(chars.length&&c.measureText(chars.join('')+'…').width>width)chars.pop();return chars.length?chars.join('')+'…':'';};
 const width=m.textWidth,time=fit(m.messageTime??'지금',width*.4),timeWidth=c.measureText(time).width,title=fit(m.messageTitle??'메시지',width-(time?timeWidth+12:0)),y=b.y+m.paddingY+m.headerSize;
 fillTextWithSpaces(c,title,b.x+m.paddingX,y);c.globalAlpha=.55;fillTextWithSpaces(c,time,b.x+m.w-m.paddingX-timeWidth,y);c.globalAlpha=1;
}

export function paintBasic(target,state,background,scale,editingId,{metrics,measureRun,fontString}){
 const c=target.getContext('2d');c.setTransform(scale,0,0,scale,0,0);c.drawImage(background,0,0,state.width,state.height);for(const b of state.blocks){const m=metrics(b),colors=presentationColors(b);if(colors.opacity>0){c.globalAlpha=colors.opacity/100;c.fillStyle=colors.box;if(b.presentation==='chat'){chatPath(c,b.x,b.y,m,b.messageSide);c.fill();}else if(b.presentation==='notification'){c.beginPath();c.roundRect(b.x,b.y,m.w,m.h,14);c.fill();}else c.fillRect(b.x,b.y,m.w,m.h);c.globalAlpha=1;}c.fillStyle=colors.color;if(b.type==='line'){c.fillRect(b.x,b.y+11,b.w,1);continue;}if(m.markerSize)c.fillRect(b.x+m.paddingX,b.y+m.paddingY+(b.size*b.lineHeight-m.markerSize)/2,m.markerSize,m.markerSize);c.textBaseline='alphabetic';c.textAlign='left';if(b.presentation==='notification')paintMessageHeader(c,b,m);if(b.id===editingId)continue;c.font=fontString(b);const h=b.size*b.lineHeight,sample=c.measureText('한글Ag'),ascent=sample.actualBoundingBoxAscent||b.size*.8,descent=sample.actualBoundingBoxDescent||b.size*.2,width=m.textWidth;for(let i=0;i<m.lines.length;i++){const y=b.y+m.paddingY+m.headerHeight+i*h+(h-ascent-descent)/2+ascent;const runs=positionedRuns(m.lines[i],width,b.align,(text,style)=>measureRun(b,text,style));for(const run of lineHighlights(runs)){c.fillStyle=run.highlight;c.globalAlpha=run.highlightOpacity/100;c.fillRect(b.x+m.paddingX+m.textOffset+run.x,y-ascent-2,run.w,Math.min(h,ascent+descent+4));c.globalAlpha=1;}for(const run of runs){c.fillStyle=run.color||colors.color;c.font=fontString(b,run);const x=b.x+m.paddingX+m.textOffset+run.x;if(run.italic){c.save();c.translate(x,y);c.transform(1,0,-.21,1,0,0);fillTextWithSpaces(c,run.text,0,0);c.restore();}else fillTextWithSpaces(c,run.text,x,y);const thickness=Math.max(1,b.size/18);if(run.underline)c.fillRect(x,y+Math.max(2,descent/2),run.w,thickness);if(run.strike)c.fillRect(x,y-ascent*.38,run.w,thickness);}}}c.setTransform(1,0,0,1,0,0);}
