import {fonts} from './core.js';

// Lucide icons (ISC). See LUCIDE-LICENSE.txt.
const paths={
 play:'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z',
 volume:'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z M16 9a5 5 0 0 1 0 6 M19.364 18.364a9 9 0 0 0 0-12.728',
 captions:'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 15h4M15 15h2M7 11h2M13 11h4',
 settings:'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915 M15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0',
 maximize:'M8 3H5a2 2 0 0 0-2 2v3 M21 8V5a2 2 0 0 0-2-2h-3 M3 16v3a2 2 0 0 0 2 2h3 M16 21h3a2 2 0 0 0 2-2v-3'
};
const cache={};
export function playerTime(seconds){const h=Math.floor(seconds/3600),m=Math.floor(seconds/60)%60,s=seconds%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0');}
export function playerSeconds(text){const parts=text.trim().split(':');return parts.length>=2&&parts.length<=3&&/^\d+(?::[0-5]\d){1,2}$/.test(text.trim())?parts.reduce((total,n)=>total*60+Number(n),0):null;}
export function paintFilmPlayer(c,s,layout){
 const {width,height,scale}=layout,pad=15*scale,y=height-43*scale,end=width-pad,position=pad+(end-pad)*s.playerElapsed/s.playerDuration;
 c.save();
 c.lineCap='round';c.lineWidth=2.5*scale;c.strokeStyle='#666666';c.beginPath();c.moveTo(pad,y);c.lineTo(end,y);c.stroke();
 c.strokeStyle='#ff1744';c.beginPath();c.moveTo(pad,y);c.lineTo(position,y);c.stroke();c.fillStyle='#ff1744';c.beginPath();c.arc(position,y,3.5*scale,0,Math.PI*2);c.fill();
 const row=height-22*scale,size=17*scale;
 const icon=(name,x)=>{c.save();c.translate(x-size/2,row-size/2);c.scale(size/24,size/24);c.strokeStyle='#ffffff';c.lineWidth=2;c.lineCap='round';c.lineJoin='round';c.stroke(cache[name]??=new Path2D(paths[name]));c.restore();};
 icon('play',24*scale);icon('volume',55*scale);
 c.fillStyle='#ffffff';c.font='500 '+(11*scale)+'px '+fonts.pretendard;c.textBaseline='middle';c.textAlign='left';c.fillText(playerTime(s.playerElapsed)+' / '+playerTime(s.playerDuration),81*scale,row);
 icon('captions',width-101*scale);icon('settings',width-65*scale);icon('maximize',width-29*scale);c.restore();
}
