import {blockRuns,richTextLines} from './richtext.js';

export function blockMetrics(b,measure){
 if(b.type==='line')return {lines:[],w:b.w,h:24};
 const chat=b.presentation==='chat',notification=b.presentation==='notification',chapter=b.presentation==='chapter',inset=chat||chapter?18:notification?20:0;
 const markerSize=chapter?Math.min(b.size*.45,Math.max(0,(b.w-32)/2)):0,textOffset=chapter?markerSize+10:0;
 const paddingX=Math.min(b.padding+inset,Math.max(0,(b.w-20-textOffset)/2)),paddingY=chat?10:notification?16:chapter?12:0;
 const headerSize=Math.max(11,b.size*.72),headerHeight=notification?headerSize*1.4+10:0;
 const runs=notification&&b.messageSender?[{text:b.messageSender+': ',bold:true},...blockRuns(b)]:chapter?blockRuns(b).map(run=>({...run,bold:true})):blockRuns(b);
 const lines=richTextLines(runs,Math.max(20,b.w-paddingX*2-textOffset),measure);
 const w=chat?Math.min(b.w,Math.max(48,...lines.map(line=>line.width+paddingX*2))):b.w;
 return {lines,w,h:Math.max(1,lines.length)*b.size*b.lineHeight+paddingY*2+headerHeight,paddingX,paddingY,headerSize,headerHeight,markerSize,textOffset,textWidth:Math.max(20,w-paddingX*2-textOffset)};
}

export function presentationColors(b){
 return b.presentation&&b.presentation!=='plain'?{color:b.messageColor||(b.presentation==='chapter'?'#222222':'#333333'),box:b.messageBox||(b.presentation==='chapter'?'#c5c3c3':b.presentation==='chat'&&b.messageSide==='right'?'#dedede':'#ededed'),opacity:b.messageOpacity??100}:{color:b.color,box:b.box,opacity:b.opacity};
}

export function messageX(side,width,pageWidth,columnWidth){return (pageWidth-columnWidth)/2+(side==='right'?columnWidth-width:0);}
