import {fonts} from './core.js';

// Lucide icons (ISC). See LUCIDE-LICENSE.txt.
const paths={
 pause:'M15 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M6 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
 volume:'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z M16 9a5 5 0 0 1 0 6 M19.364 18.364a9 9 0 0 0 0-12.728',
 captions:'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 15h4M15 15h2M7 11h2M13 11h4',
 settings:'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915 M15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0',
 screen:'m10 9-3 3 3 3 m4 0 3-3-3-3 M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
 expand:'m15 15 6 6 m-6-12 6-6 M21 16v5h-5 M21 8V3h-5 M3 16v5h5 m-5 0 6-6 M3 8V3h5 M9 9 3 3',
 chevron:'m9 6 6 6-6 6'
};
const cache={};
export function playerTime(seconds){const h=Math.floor(seconds/3600),m=Math.floor(seconds/60)%60,s=seconds%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0');}
export function playerSeconds(text){const parts=text.trim().split(':');return parts.length>=2&&parts.length<=3&&/^\d+(?::[0-5]\d){1,2}$/.test(text.trim())?parts.reduce((total,n)=>total*60+Number(n),0):null;}
export function paintFilmPlayer(c,s,layout){
 const {width,height,scale}=layout,pad=15*scale,y=height-43*scale,end=width-pad,position=pad+(end-pad)*s.playerElapsed/s.playerDuration;
 c.save();
 c.lineCap='round';c.lineWidth=2.5*scale;c.strokeStyle='#666666';c.beginPath();c.moveTo(pad,y);c.lineTo(end,y);c.stroke();
 c.strokeStyle='#ff1744';c.beginPath();c.moveTo(pad,y);c.lineTo(position,y);c.stroke();c.fillStyle='#ff1744';c.beginPath();c.arc(position,y,3.5*scale,0,Math.PI*2);c.fill();
 const row=height-19*scale,size=14*scale,pillHeight=24*scale,rightWidth=154*scale,rightStart=width-pad-rightWidth;
 const pill=(x,w,opacity=.46)=>{c.fillStyle='rgba(12,14,17,'+opacity+')';c.beginPath();c.roundRect(x,row-pillHeight/2,w,pillHeight,pillHeight/2);c.fill();};
 const icon=(name,x,{fill=false,alpha=1,pixels=size,color='#ffffff'}={})=>{c.save();c.globalAlpha=alpha;c.translate(x-pixels/2,row-pixels/2);c.scale(pixels/24,pixels/24);c.strokeStyle=c.fillStyle=color;c.lineWidth=2;c.lineCap='round';c.lineJoin='round';const path=cache[name]??=new Path2D(paths[name]);if(fill)c.fill(path);else c.stroke(path);c.restore();};
 pill(pad,pillHeight);icon('pause',pad+pillHeight/2,{fill:true});
 const volumeX=pad+pillHeight+5*scale;pill(volumeX,pillHeight);icon('volume',volumeX+pillHeight/2);
 c.save();c.translate(volumeX+pillHeight/2-size/2,row-size/2);c.scale(size/24,size/24);c.fillStyle='#ffffff';c.fill(cache.speaker??=new Path2D(paths.volume.split(' M16')[0]));c.restore();
 c.font='600 '+(9*scale)+'px '+fonts.pretendard;c.textBaseline='middle';c.textAlign='left';
 const time=playerTime(s.playerElapsed)+' / '+playerTime(s.playerDuration),timeStart=volumeX+pillHeight+5*scale,timeWidth=c.measureText(time).width+20*scale;
 pill(timeStart,timeWidth);c.fillStyle='#ffffff';c.fillText(time,timeStart+10*scale,row);
 const titleStart=timeStart+timeWidth+5*scale,available=rightStart-titleStart-8*scale;
 if(s.playerTitle&&available>=60*scale){
  const titleWidth=Math.min(c.measureText(s.playerTitle).width+30*scale,available,240*scale),chars=Array.from(s.playerTitle);let title=chars.join('');
  while(chars.length&&c.measureText(title).width>titleWidth-30*scale){chars.pop();title=chars.join('')+'…';}
  pill(titleStart,titleWidth);c.fillStyle='#ffffff';c.fillText(title,titleStart+10*scale,row);icon('chevron',titleStart+titleWidth-11*scale,{pixels:11*scale});
 }
 pill(rightStart,rightWidth,.38);
 const autoplayX=rightStart+15*scale;c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.roundRect(autoplayX-9.5*scale,row-5.5*scale,19*scale,11*scale,5.5*scale);c.fill();
 c.fillStyle='#ffffff';c.beginPath();c.arc(autoplayX-3.5*scale,row,4.5*scale,0,Math.PI*2);c.fill();icon('pause',autoplayX-3.5*scale,{fill:true,pixels:6*scale,color:'#141619'});
 icon('captions',rightStart+46*scale,{alpha:.48});icon('settings',rightStart+77*scale);icon('screen',rightStart+108*scale);icon('expand',rightStart+139*scale);c.restore();
}
