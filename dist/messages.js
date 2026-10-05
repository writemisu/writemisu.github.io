import {blockRuns,richTextLines} from './richtext.js';

export function blockMetrics(b,measure){
 if(b.type==='line')return {lines:[],w:b.w,h:24};
 const chat=b.presentation==='chat',notification=b.presentation==='notification',chapter=b.presentation==='chapter',inset=chat?14:chapter?18:notification?20:0;
 const tailWidth=chat?8:0,markerSize=chapter?Math.min(b.size*.45,Math.max(0,(b.w-32)/2)):0,markerOffset=chapter?markerSize+10:0;
 const textOffset=markerOffset+(chat&&b.messageSide!=='right'?tailWidth:0);
 const paddingX=Math.min(b.padding+inset,Math.max(0,(b.w-20-markerOffset-tailWidth)/2)),paddingY=chat?11:notification?16:chapter?12:0;
 const headerSize=Math.max(11,b.size*.72),headerHeight=notification?headerSize*1.4+10:0;
 const runs=notification&&b.messageSender?[{text:b.messageSender+': ',bold:true},...blockRuns(b)]:chapter?blockRuns(b).map(run=>({...run,bold:true})):blockRuns(b);
 const lines=richTextLines(runs,Math.max(20,b.w-paddingX*2-markerOffset-tailWidth),measure);
 const w=chat&&b.messageFit!==false?Math.min(b.w,Math.max(52,...lines.map(line=>line.width+paddingX*2+tailWidth))):b.w;
 return {lines,w,h:Math.max(1,lines.length)*b.size*b.lineHeight+paddingY*2+headerHeight,paddingX,paddingY,headerSize,headerHeight,markerSize,textOffset,tailWidth,textWidth:Math.max(20,w-paddingX*2-markerOffset-tailWidth)};
}

export function presentationColors(b){
 return b.presentation&&b.presentation!=='plain'?{color:b.messageColor||(b.presentation==='chapter'?'#222222':'#333333'),box:b.messageBox||(b.presentation==='chapter'?'#c5c3c3':b.presentation==='chat'?b.messageSide==='right'?'#dfe6ed':'#ffffff':'#ededed'),opacity:b.messageOpacity??100}:{color:b.color,box:b.box,opacity:b.opacity};
}

export function messageX(side,width,pageWidth,columnWidth){return (pageWidth-columnWidth)/2+(side==='right'?columnWidth-width:0);}

export function chatPath(c,x,y,m,side){
 const right=side==='right',tail=m.tailWidth,boxX=x+(right?0:tail),boxW=m.w-tail;
 c.beginPath();c.roundRect(boxX,y,boxW,m.h,Math.min(13,m.h/2));
 const edge=right?boxX+boxW:boxX;
 // Match the rounded rectangle's winding so the overlapping tail stays filled.
 if(right){c.moveTo(edge-5,y+12);c.quadraticCurveTo(edge+1,y+12,edge+tail,y+7);c.quadraticCurveTo(edge+tail-1,y+20,edge-3,y+27);}
 else{c.moveTo(edge+3,y+27);c.quadraticCurveTo(edge-tail+1,y+20,edge-tail,y+7);c.quadraticCurveTo(edge-1,y+12,edge+5,y+12);}
 c.closePath();
}
