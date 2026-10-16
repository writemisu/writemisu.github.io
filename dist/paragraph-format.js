import {htmlBlock} from './html.js';
import {presentationColors} from './messages.js';

const textKeys=['font','size','lineHeight','align','padding'];

export function paragraphFormat(state,block,mode){
 const view=mode==='html'?htmlBlock(state,block):block,colors=presentationColors(view);
 return {...Object.fromEntries(textKeys.map(key=>[key,view[key]])),...colors,...(mode==='png'?{w:block.w}:{})};
}

export function applyParagraphFormat(block,format,mode){
 const values=Object.fromEntries(textKeys.filter(key=>format[key]!==undefined).map(key=>[key,format[key]]));
 const message=block.presentation&&block.presentation!=='plain';
 for(const key of ['color','box','opacity'])values[message?{color:'messageColor',box:'messageBox',opacity:'messageOpacity'}[key]:key]=format[key];
 if(mode==='html')block.htmlStyle={...block.htmlStyle,...values};
 else{Object.assign(block,values);block.w=format.w;}
}
