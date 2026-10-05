import {normalizeRuns,blockRuns,toggleMark,rangeHasMark} from './richtext.js';
import {styledHTML} from './core.js';
import {icons} from './icons.js';

const formats=[['bold','굵게'],['italic','기울임'],['underline','밑줄'],['strike','취소선']];
const selectionUpdates=new WeakMap();
document.addEventListener('selectionchange',()=>selectionUpdates.get(document.activeElement)?.());
export function readEditor(input){
 const runs=[];
 function walk(node,style={}){
  if(node.nodeType===3){runs.push({...style,text:node.data});return;}
  if(node.nodeType!==1||node.dataset.caret)return;
  if(node.tagName==='BR'){runs.push({...style,text:'\n'});return;}
  const next={...style},css=node.style;
  if(['B','STRONG'].includes(node.tagName)||Number(css.fontWeight)>=600)next.bold=true;
  if(['I','EM'].includes(node.tagName)||css.fontStyle==='italic')next.italic=true;
  if(node.tagName==='U'||css.textDecoration.includes('underline'))next.underline=true;
  if(['S','STRIKE'].includes(node.tagName)||css.textDecoration.includes('line-through'))next.strike=true;
  for(const child of node.childNodes)walk(child,next);
 }
 for(const child of input.childNodes)walk(child);
 return normalizeRuns(runs);
}
function selectionOffsets(input){
 const selection=window.getSelection();if(!selection.rangeCount)return null;
 const range=selection.getRangeAt(0);if(!input.contains(range.startContainer)||!input.contains(range.endContainer))return null;
 const before=range.cloneRange();before.selectNodeContents(input);before.setEnd(range.startContainer,range.startOffset);
 return {start:before.toString().length,end:before.toString().length+range.toString().length};
}
function restoreSelection(input,start,end){
 const walker=document.createTreeWalker(input,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 const point=offset=>{for(const node of nodes){if(offset<=node.length)return [node,offset];offset-=node.length;}return nodes.length?[nodes.at(-1),nodes.at(-1).length]:[input,0];};
 const range=document.createRange();range.setStart(...point(start));range.setEnd(...point(end));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
}
function caretLine(input,text){input.querySelectorAll('[data-caret]').forEach(n=>n.remove());if(text.endsWith('\n')){const br=document.createElement('br');br.dataset.caret='true';input.append(br);}}
export function syncEditor(input,block){
 const key=JSON.stringify(blockRuns(block));if(input.dataset.value===key)return;
 input.innerHTML=styledHTML(block,false);input.dataset.value=key;caretLine(input,block.text);
}
export function createEditor(id,{getBlock,select,onChange,onKeyDown,onBlur}){
 const wrapper=document.createElement('div'),toolbar=document.createElement('div'),input=document.createElement('div');
 toolbar.className='text-formatting';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','선택 글자 서식');
 input.className='paragraph-input';input.contentEditable='true';input.setAttribute('role','textbox');input.setAttribute('aria-multiline','true');input.spellcheck=false;
 let savedRange=null,composing=false;
 const update=()=>{const runs=readEditor(input);input.dataset.value=JSON.stringify(runs);onChange(id,runs);caretLine(input,runs.map(r=>r.text).join(''));refresh();};
 const refresh=()=>{const range=selectionOffsets(input);if(range)savedRange=range;const block=getBlock(id);if(!block)return;const runs=blockRuns(block);for(const button of toolbar.children){button.disabled=!savedRange||savedRange.start===savedRange.end;button.setAttribute('aria-pressed',!!savedRange&&rangeHasMark(runs,savedRange.start,savedRange.end,button.dataset.mark));}};
 const format=key=>{if(composing)return;const range=selectionOffsets(input)||savedRange;if(!range||range.start===range.end)return;onBlur();const runs=toggleMark(blockRuns(getBlock(id)),range.start,range.end,key);onChange(id,runs);syncEditor(input,getBlock(id));input.focus({preventScroll:true});restoreSelection(input,range.start,range.end);savedRange=range;onBlur();refresh();};
 const insert=text=>{const selection=window.getSelection();if(!selection.rangeCount||!selectionOffsets(input))return;const range=selection.getRangeAt(0);range.deleteContents();const node=document.createTextNode(text.replace(/\r\n?/g,'\n'));range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);update();};
 for(const [key,label] of formats){const button=document.createElement('button');button.type='button';button.dataset.mark=key;button.title=label;button.setAttribute('aria-label',label);button.disabled=true;button.innerHTML=icons[key==='strike'?'strikethrough':key];button.onpointerdown=e=>e.preventDefault();button.onclick=()=>format(key);toolbar.append(button);}
 input.onfocus=()=>{select(id);refresh();};input.onblur=onBlur;
 input.oninput=()=>{if(!composing)update();};input.oncompositionstart=()=>composing=true;input.oncompositionend=()=>{composing=false;update();};
 input.onbeforeinput=e=>{if(['insertParagraph','insertLineBreak'].includes(e.inputType)){e.preventDefault();insert('\n');}};
 input.onpaste=e=>{e.preventDefault();insert(e.clipboardData.getData('text/plain'));};input.ondrop=e=>e.preventDefault();
 input.onkeydown=e=>{if(e.isComposing)return;const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(key)){e.preventDefault();format({b:'bold',i:'italic',u:'underline'}[key]);return;}onKeyDown(e);};
 input.onkeyup=refresh;input.onpointerup=refresh;input.addEventListener('focusout',refresh);
 // selectionchange also covers keyboard and touch selection handles.
 selectionUpdates.set(input,refresh);
 wrapper.append(toolbar,input);syncEditor(input,getBlock(id));return wrapper;
}
