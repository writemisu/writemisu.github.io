import {escapeHTML,fonts} from './core.js';
import {blockRuns,quoteRuns,runCSS} from './richtext.js';
import {presentationColors} from './messages.js';
import {replaceBlocks} from './replace.js';

const number=(value,fallback,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
const color=(value,fallback='#333333')=>/^#[\da-f]{6}$/i.test(value)?value:fallback;
function rgba(hex,opacity){const c=color(hex);return `rgba(${[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)).join(',')},${number(opacity,0,0,100)/100})`;}
export function htmlSettings(state){const s=state.htmlSettings||{};return {editorial:true,font:Object.hasOwn(fonts,s.font)?s.font:'pretendard',width:number(s.width,680,280,1600),padding:number(s.padding,44,0,120),gap:number(s.gap,24,0,120),background:color(s.background,'#101217'),surface:color(s.surface,'#1d2027'),textColor:color(s.textColor,'#e8e5e1'),muted:color(s.muted,'#92949c'),accent:color(s.accent,'#bda47b'),border:color(s.border,'#44464c'),frame:s.frame===true,radius:number(s.radius,10,0,40),decoration:s.decoration===true,decorationStyle:s.decorationStyle==='editorial'?'editorial':'hairline',decorationPosition:['header','both'].includes(s.decorationPosition)?s.decorationPosition:'footer',decorationLabel:typeof s.decorationLabel==='string'?s.decorationLabel:'END OF EXCERPT',...(s.quoteStyle?{quoteStyle:s.quoteStyle}:{})};}
const styleKeys=['font','size','lineHeight','align','color','box','opacity','padding','messageColor','messageBox','messageOpacity'];
export function initializeHTML(state,legacy=false){
 if(state.htmlSettings?.editorial===true)return false;
 const previous=state.htmlSettings;
 state.htmlSettings=htmlSettings({...state,htmlSettings:legacy?{width:500,padding:28,background:state.colors[0],surface:state.colors[0],textColor:state.textColor,...previous}:previous});
 if(legacy)for(const b of state.blocks){b.htmlStyle=Object.fromEntries(styleKeys.filter(key=>b[key]!==undefined).map(key=>[key,b[key]]));if(b.presentation&&b.presentation!=='plain'){const c=presentationColors(b);Object.assign(b.htmlStyle,{messageColor:c.color,messageBox:c.box,messageOpacity:c.opacity});}}
 return true;
}
function mix(a,b,ratio){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-ratio)+parseInt(b.slice(i,i+2),16)*ratio).toString(16).padStart(2,'0')).join('');}
export function htmlBlock(state,block){
 const s=htmlSettings(state);
 return {...block,font:'pretendard',size:16,lineHeight:1.85,align:'left',color:s.textColor,box:s.surface,opacity:0,padding:0,messageColor:s.textColor,messageBox:mix(s.surface,s.textColor,block.messageSide==='right'?.1:.05),messageOpacity:100,...block.htmlStyle};
}
function decorationHTML(s,position){
 if(!s.decoration||![position,'both'].includes(s.decorationPosition))return '';
 if(position==='header')return `<div aria-hidden="true" style="width:36px;margin:0 0 14px;border-top:1px solid ${s.accent};font-size:0;line-height:0;">&nbsp;</div>`;
 const label=s.decorationStyle==='editorial'?s.decorationLabel:'';
 if(!label)return `<div aria-hidden="true" style="margin:28px 0 0;border-top:1px solid ${s.accent};font-size:0;line-height:0;">&nbsp;</div>`;
 const line=width=>`display:inline-block;width:${width}%;border-top:1px solid ${s.accent};vertical-align:middle;font-size:0;line-height:0;`;
 return `<div aria-hidden="true" style="display:table;table-layout:fixed;width:100%;margin:28px 0 0;border:0;border-collapse:collapse;color:${s.accent};font-family:Georgia,serif;font-size:10px;line-height:1.8;letter-spacing:1.8px;overflow-wrap:anywhere;"><span style="display:table-cell;vertical-align:middle;"><span style="${line(76)}">&nbsp;</span><span style="${line(16)}margin-left:8%;">&nbsp;</span></span><span style="display:table-cell;box-sizing:border-box;width:32%;padding:0 2%;text-align:center;vertical-align:middle;">${textHTML(label)}</span><span style="display:table-cell;vertical-align:middle;"><span style="${line(16)}margin-right:8%;">&nbsp;</span><span style="${line(76)}">&nbsp;</span></span></div>`;
}
function textHTML(text){return escapeHTML(text).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>').replace(/\u3000/g,'<span style="display:inline-block;width:1em;white-space:pre;"> </span>');}
function runsHTML(runs){return runs.map(run=>{
 const style=runCSS(run)+(run.color?'color:'+color(run.color)+';':'')+(run.highlight&&run.highlightOpacity?'background-color:'+rgba(run.highlight,run.highlightOpacity)+';':'');
 const text=textHTML(run.text);return style?`<span style="${style}">${text}</span>`:text;
}).join('');}

export function exportHTML(state){
 const s=htmlSettings(state),{width,padding,gap,surface}=s,blocks=replaceBlocks(state.blocks,state.replacementRules||[]).blocks;
 const mobile=Math.min(22,padding),start=Math.min(480,width-160),slope=(padding-mobile)/(width-start),fluid=padding===mobile?padding+'px':`clamp(${mobile}px,calc(${Math.round(slope*100000)/1000}% - ${Math.round((slope*start-mobile)*1000)/1000}px),${padding}px)`;
 const insetCSS=`padding-left:${fluid};padding-right:${fluid};`;
 const content=blocks.map((source,i)=>{
  const b=htmlBlock(state,source);
  const align=['left','center','right','justify'].includes(b.align)?b.align:'left',gapAfter=i<blocks.length-1?gap:0,space=b.type==='line'?gapAfter:0;
  if(b.type==='line')return `<div style="margin:0 0 ${space}px;padding:11px ${mobile}px;${insetCSS}"><div style="width:33%;margin:${align==='right'?'0 0 0 auto':align==='center'?'0 auto':'0'};border-top:1px solid ${color(b.color)};"></div></div>`;
  const chat=b.presentation==='chat',notification=b.presentation==='notification',chapter=b.presentation==='chapter',right=b.messageSide==='right',c=presentationColors(b);
  const size=number(b.size,16,1,200),lineHeight=number(b.lineHeight,1.85,1,3),inset=number(b.padding,0,0,60);
  const family=b.font==='pretendard'?"'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic',sans-serif":fonts[b.font]||fonts.sans;
  const type=`font-family:${escapeHTML(family)};font-size:${Math.round(size*75)/100}pt;line-height:${lineHeight};font-weight:${chapter||b.bold?700:400};font-style:normal;font-synthesis:style;color:${color(c.color)};text-align:${align};overflow-wrap:anywhere;white-space:pre-wrap;`;
  const box=`background-color:${rgba(c.box,c.opacity)};`,runs=quoteRuns(blockRuns(b),s.quoteStyle??state.quoteStyle);
  let body=runsHTML(chapter?runs.map(r=>({...r,bold:true})):runs)||'<br>';
  if(notification&&b.messageSender)body='<strong style="font-weight:700;">'+textHTML(b.messageSender)+': </strong>'+body;
  let html;
  if(chat){
   const bubble=`display:inline-block;box-sizing:border-box;max-width:82%;padding:11px ${14+inset}px;border-radius:${right?'14px 4px 14px 14px':'4px 14px 14px 14px'};vertical-align:top;${box}${type}`;
   html=`<div style="margin:0 0 ${space}px;text-align:${right?'right':'left'};"><div style="${bubble}">${body}</div></div>`;
  }else if(notification){
   const headerSize=Math.max(11,size*.72),header=`font-size:${headerSize}px;font-weight:400;line-height:1.4;white-space:normal;overflow-wrap:anywhere;`;
   html=`<div style="box-sizing:border-box;margin:0 0 ${space}px;padding:16px ${20+inset}px;border-radius:10px;${box}${type}"><table role="presentation" style="width:100%;table-layout:fixed;border:0;border-collapse:collapse;margin:0 0 10px;${header}"><tbody><tr style="border:0;"><td style="padding:0 12px 0 0;border:0;text-align:left;vertical-align:top;">${textHTML(b.messageTitle??'메시지')}</td><td style="width:30%;padding:0;border:0;text-align:right;vertical-align:top;color:${s.muted};">${textHTML(b.messageTime??'지금')}</td></tr></tbody></table><div style="${type}">${body}</div></div>`;
  }else html=`<div style="box-sizing:border-box;margin:0 0 ${space}px;padding:${chapter?'12px '+(18+inset)+'px':'0 '+inset+'px'};${box}${type}">${chapter?'■ ':''}${body}</div>`;
  const title=b.htmlSummary||'',frame=`box-sizing:border-box;width:100%;margin:0 0 ${gapAfter}px;border:1px solid ${s.frame?s.border:'transparent'};border-radius:${s.frame?s.radius:b.htmlCollapse===false?0:10}px;background-color:${surface};`;
  const bodyHTML=`<div style="box-sizing:border-box;margin:0;padding:${b.htmlCollapse===false?28:12}px ${mobile}px 28px;${insetCSS}border:0;">${decorationHTML(s,'header')}${html}${decorationHTML(s,'footer')}</div>`;
  if(b.htmlCollapse===false)return `<div style="${frame}">${bodyHTML}</div>`;
  // Shadow strokes keep the chevrons font-independent and the summary fully clickable.
  const chevron=(offset,up=false)=>Array.from({length:25},(_,j)=>{
   const x=j/2,y=j<=12?x:12-x;
   return `${x}px ${offset+(up?6-y:y)}px .25px .1px ${color(b.color)}`;
  }).join(',');
  const edge=s.frame?0:1,headerPadding=s.frame?15:14,radius=s.frame?s.radius:10,rise=headerPadding+edge+22;
  const mark='display:inline-block;width:1px;height:1px;margin:0 12px 0 0;font-size:0;line-height:0;vertical-align:top;';
  const titleStyle=/^[A-Z0-9 /]+$/.test(title)?`font-family:Georgia,serif;font-size:10px;letter-spacing:2px;color:${s.accent};`:`font-size:10.5pt;letter-spacing:.2px;color:${color(b.color)};`;
  return `<div style="${frame}"><details${b.htmlOpen===true?' open':''} style="display:block;margin:0;padding:0;border:0;background:transparent;box-shadow:none;"><summary aria-label="${escapeHTML(title||'펼치기 / 접기')}" style="display:block;box-sizing:border-box;margin:0;padding:${headerPadding}px 20px;border:${edge}px solid ${s.border};border-radius:${radius}px;background-color:${surface};box-shadow:inset 0 1px 0 ${rgba(s.textColor,3)};list-style:none;font-family:${escapeHTML(family)};font-weight:400;line-height:22px;text-align:left;"><span style="display:table;width:100%;table-layout:fixed;border:0;border-collapse:collapse;"><span style="display:table-cell;padding-right:20px;vertical-align:middle;overflow-wrap:anywhere;${titleStyle}">${title?textHTML(title):'<span aria-hidden="true">&nbsp;</span>'}</span><span aria-hidden="true" style="display:table-cell;width:14px;vertical-align:bottom;font-size:0;line-height:22px;"><span style="${mark}margin-top:9px;box-shadow:${chevron(0)};">&nbsp;</span></span></span></summary><div aria-hidden="true" style="box-sizing:border-box;height:0;margin:0;padding:0 ${20+edge}px;text-align:right;font-size:0;line-height:0;"><span style="display:inline-block;width:14px;height:22px;vertical-align:top;box-shadow:0 -${rise}px 0 ${surface};"><span style="${mark}box-shadow:${chevron(-rise+9,true)};">&nbsp;</span></span></div>${bodyHTML}</details></div>`;

 }).join('\n');
 return `<div lang="ko" style="box-sizing:border-box;width:100%;max-width:${width}px;margin:0 auto;padding:0;border-radius:10px;background-color:${s.background};color:${s.textColor};">${content}</div>`;
}
