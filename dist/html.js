import {escapeHTML,fonts} from './core.js';
import {blockRuns,quoteRuns,runCSS} from './richtext.js';
import {presentationColors} from './messages.js';
import {replaceBlocks} from './replace.js';

const number=(value,fallback,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
const color=(value,fallback='#333333')=>/^#[\da-f]{6}$/i.test(value)?value:fallback;
function rgba(hex,opacity){const c=color(hex);return `rgba(${[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)).join(',')},${number(opacity,0,0,100)/100})`;}
export function htmlSettings(state){const s=state.htmlSettings||{};return {width:number(s.width,500,280,1600),padding:number(s.padding,28,0,120),gap:number(s.gap,24,0,120)};}
function textHTML(text){return escapeHTML(text).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>').replace(/\u3000/g,'<span style="display:inline-block;width:1em;white-space:pre;"> </span>');}
function runsHTML(runs){return runs.map(run=>{
 const style=runCSS(run)+(run.color?'color:'+color(run.color)+';':'')+(run.highlight&&run.highlightOpacity?'background-color:'+rgba(run.highlight,run.highlightOpacity)+';':'');
 const text=textHTML(run.text);return style?`<span style="${style}">${text}</span>`:text;
}).join('');}

export function exportHTML(state){
 const {width,padding,gap}=htmlSettings(state),blocks=replaceBlocks(state.blocks,state.replacementRules||[]).blocks;
 const surface=color(state.colors[0],'#f5f5f5'),ink=color(state.textColor),header='#'+[1,3,5].map(i=>Math.round(parseInt(surface.slice(i,i+2),16)*.94+parseInt(ink.slice(i,i+2),16)*.06).toString(16).padStart(2,'0')).join('');
 const content=blocks.map((b,i)=>{
  const align=['left','center','right','justify'].includes(b.align)?b.align:'left',gapAfter=i<blocks.length-1?gap:0,space=b.type==='line'?gapAfter:0;
  if(b.type==='line')return `<div style="margin:0 0 ${space}px;padding:11px 0;"><div style="width:33%;margin:${align==='right'?'0 0 0 auto':align==='center'?'0 auto':'0'};border-top:1px solid ${color(b.color)};"></div></div>`;
  const chat=b.presentation==='chat',notification=b.presentation==='notification',chapter=b.presentation==='chapter',right=b.messageSide==='right',c=presentationColors(b);
  const size=number(b.size,16,1,200),lineHeight=number(b.lineHeight,1.85,1,3),inset=number(b.padding,0,0,60);
  const type=`font-family:${escapeHTML(fonts[b.font]||fonts.sans)};font-size:${Math.round(size*75)/100}pt;line-height:${lineHeight};font-weight:${chapter||b.bold?700:400};font-style:normal;font-synthesis:style;color:${color(c.color)};text-align:${align};overflow-wrap:anywhere;white-space:pre-wrap;`;
  const box=`background-color:${rgba(c.box,c.opacity)};`,runs=quoteRuns(blockRuns(b),state.quoteStyle);
  let body=runsHTML(chapter?runs.map(r=>({...r,bold:true})):runs)||'<br>';
  if(notification&&b.messageSender)body='<strong style="font-weight:700;">'+textHTML(b.messageSender)+': </strong>'+body;
  let html;
  if(chat){
   const bubble=`display:inline-block;box-sizing:border-box;max-width:82%;padding:11px ${14+inset}px;border-radius:${right?'14px 4px 14px 14px':'4px 14px 14px 14px'};vertical-align:top;${box}${type}`;
   html=`<div style="margin:0 0 ${space}px;text-align:${right?'right':'left'};"><div style="${bubble}">${body}</div></div>`;
  }else if(notification){
   const headerSize=Math.max(11,size*.72),header=`font-size:${headerSize}px;font-weight:400;line-height:1.4;white-space:normal;overflow-wrap:anywhere;`;
   html=`<div style="box-sizing:border-box;margin:0 0 ${space}px;padding:16px ${20+inset}px;border-radius:14px;${box}${type}"><table role="presentation" style="width:100%;border:0;border-collapse:collapse;margin:0 0 10px;${header}"><tbody><tr style="border:0;"><td style="padding:0 12px 0 0;border:0;text-align:left;vertical-align:top;">${textHTML(b.messageTitle??'메시지')}</td><td style="width:30%;padding:0;border:0;text-align:right;vertical-align:top;color:${rgba(c.color,55)};">${textHTML(b.messageTime??'지금')}</td></tr></tbody></table><div style="${type}">${body}</div></div>`;
  }else html=`<div style="box-sizing:border-box;margin:0 0 ${space}px;padding:${chapter?'12px '+(18+inset)+'px':'0 '+inset+'px'};${box}${type}">${chapter?'■ ':''}${body}</div>`;
  const title=b.htmlSummary||'ONLINE';
  // Rounded backgrounds do not need overflow clipping. The open-state shadow paints
  // a minus above its own hit box, so the summary remains clickable without pointer-events.
  return `<div style="margin:0 4px ${gapAfter}px 0;border:2px solid #34362f;border-radius:14px;background-color:${header};box-shadow:4px 4px 0 #34362f;"><details style="display:block;margin:0;padding:0;border:0;background:transparent;box-shadow:none;"><summary title="${escapeHTML(title)}" style="display:block;margin:0;padding:12px 16px;border:0;background:transparent;list-style:none;font-family:${escapeHTML(fonts[b.font]||fonts.sans)};font-size:12pt;font-weight:500;line-height:24px;color:${ink};text-align:left;"><span style="display:table;width:100%;border:0;border-collapse:collapse;"><span style="display:table-cell;padding-right:12px;vertical-align:middle;overflow-wrap:anywhere;">${textHTML(title)}</span><span aria-hidden="true" style="display:table-cell;width:28px;vertical-align:bottom;text-align:center;font-family:Arial,sans-serif;font-size:22px;font-weight:400;line-height:24px;color:${ink};">+</span></span></summary><div aria-hidden="true" style="height:0;margin:0 16px;text-align:right;font-size:0;line-height:0;"><span style="display:inline-block;width:10px;height:2px;margin-right:9px;vertical-align:top;box-shadow:0 -25px 0 ${ink},0 -25px 0 10px ${header};">&nbsp;</span></div><div style="margin:0;padding:20px 18px 22px;border-top:2px solid #34362f;border-radius:0 0 12px 12px;background-color:${surface};">${html}</div></details></div>`;

 }).join('\n');
 return `<div lang="ko" style="box-sizing:border-box;width:100%;max-width:${width}px;margin:0 auto;padding:${padding}px;color:${ink};">${content}</div>`;
}
