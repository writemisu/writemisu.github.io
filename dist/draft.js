import {fonts} from './core.js';

export const draftKey='writemisu-draft-v1';
const number=(value,min=0)=>Number.isFinite(value)&&value>=min;
const color=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);
const quote=value=>!!value&&typeof value.enabled==='boolean'&&(value.color==null||color(value.color))&&color(value.highlight)&&number(value.highlightOpacity)&&value.highlightOpacity<=100&&['bold','italic','underline','strike'].every(key=>typeof value[key]==='boolean');

export function parseDraft(raw){
 try{
  const draft=JSON.parse(raw),s=draft?.state;
  if(draft?.version!==1||!s||!number(s.width,400)||s.width>1600||!number(s.margin)||!number(s.padding)||!number(s.noise)||!number(s.seed)||!['solid','radial'].includes(s.background)||!Array.isArray(s.colors)||s.colors.length!==2||!s.colors.every(color)||!color(s.textColor)||!Array.isArray(s.blocks))return null;
  const q=s.quoteStyle;
  if(q!==undefined&&!quote(q))return null;
  if(s.replacementRules!==undefined&&(!Array.isArray(s.replacementRules)||s.replacementRules.some(rule=>!rule||typeof rule.find!=='string'||typeof rule.replace!=='string')))return null;
  if(s.htmlSettings!==undefined&&(!s.htmlSettings||!number(s.htmlSettings.width,280)||s.htmlSettings.width>1600||!number(s.htmlSettings.padding)||s.htmlSettings.padding>120||!number(s.htmlSettings.gap)||s.htmlSettings.gap>120))return null;
  const h=s.htmlSettings;
  if(h){
   if(['background','surface','textColor','muted','accent','border'].some(key=>h[key]!==undefined&&!color(h[key])))return null;
   if(['editorial','frame','decoration'].some(key=>h[key]!==undefined&&typeof h[key]!=='boolean'))return null;
   if(h.headerDecoration!==undefined&&!['none','hairline'].includes(h.headerDecoration)||h.footerDecoration!==undefined&&!['none','hairline','editorial'].includes(h.footerDecoration))return null;
   if(h.radius!==undefined&&(!number(h.radius)||h.radius>40)||h.decorationStyle!==undefined&&!['hairline','editorial'].includes(h.decorationStyle)||h.decorationPosition!==undefined&&!['header','footer','both'].includes(h.decorationPosition)||h.decorationLabel!==undefined&&typeof h.decorationLabel!=='string'||h.quoteStyle!==undefined&&!quote(h.quoteStyle)||h.font!==undefined&&!Object.hasOwn(fonts,h.font))return null;
  }
  const tabIds=new Set();
  if(s.htmlTabs!==undefined){
   if(!Array.isArray(s.htmlTabs)||!s.htmlTabs.length)return null;
   for(const t of s.htmlTabs){if(!t||!/^t\d+$/.test(t.id)||tabIds.has(t.id)||typeof t.title!=='string'||typeof t.open!=='boolean'||typeof t.collapse!=='boolean')return null;tabIds.add(t.id);}
  }
  const ids=new Set();let counter=number(draft.counter)?draft.counter:0;
  for(const b of s.blocks){
   if(!b||!/^b\d+$/.test(b.id)||ids.has(b.id)||!['text','line'].includes(b.type)||typeof b.text!=='string'||!['x','y','padding'].every(key=>number(b[key]))||!['w','size','lineHeight'].every(key=>number(b[key],.01))||!Object.hasOwn(fonts,b.font)||!color(b.color)||!color(b.box)||!number(b.opacity)||!['left','center','right','justify'].includes(b.align))return null;
   if(b.presentation!==undefined&&!['plain','chapter','notification','chat'].includes(b.presentation))return null;
   if(b.htmlSummary!==undefined&&typeof b.htmlSummary!=='string')return null;
   if(b.htmlOpen!==undefined&&typeof b.htmlOpen!=='boolean')return null;
   if(b.htmlCollapse!==undefined&&typeof b.htmlCollapse!=='boolean')return null;
   if(b.htmlTabId!==undefined&&(!/^t\d+$/.test(b.htmlTabId)||!tabIds.has(b.htmlTabId)))return null;
   if(b.htmlStyle!==undefined){
    const style=b.htmlStyle,keys=['font','size','lineHeight','align','color','box','opacity','padding','messageColor','messageBox','messageOpacity'];
    if(!style||Array.isArray(style)||typeof style!=='object'||Object.keys(style).some(key=>!keys.includes(key)))return null;
    if(style.font!==undefined&&!Object.hasOwn(fonts,style.font)||style.align!==undefined&&!['left','center','right','justify'].includes(style.align))return null;
    if(['color','box','messageColor','messageBox'].some(key=>style[key]!==undefined&&!color(style[key])))return null;
    for(const [key,min,max] of [['size',1,200],['lineHeight',1,3],['padding',0,60],['opacity',0,100],['messageOpacity',0,100]])if(style[key]!==undefined&&(!number(style[key],min)||style[key]>max))return null;
   }
   if(['messageColor','messageBox'].some(key=>b[key]!==undefined&&!color(b[key])))return null;
   if(b.runs!==undefined&&(!Array.isArray(b.runs)||b.runs.some(run=>!run||typeof run.text!=='string')))return null;
   if(b.group!=null&&!/^g\d+$/.test(b.group))return null;
   ids.add(b.id);counter=Math.max(counter,Number(b.id.slice(1)),b.group?Number(b.group.slice(1)):0);
  }
  return {state:s,counter,...(draft.pending===true?{pending:true}:{})};
 }catch{return null;}
}

export function readDraft(getStorage){
 try{return parseDraft(getStorage().getItem(draftKey));}catch{return null;}
}
export function writeDraft(getStorage,data){
 try{getStorage().setItem(draftKey,data);return true;}catch{return false;}
}
