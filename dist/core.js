import {blockRuns,runCSS} from './richtext.js';
export const radialCenter={x:.5-Math.sin(130*Math.PI/180)*.3,y:.5+Math.cos(130*Math.PI/180)*.3};
export function radialGeometry(width,height){const x=width*radialCenter.x,y=height*radialCenter.y;return {x,y,radius:Math.hypot(Math.max(x,width-x),Math.max(y,height-y))};}
export function gradientCSS(colors){return `radial-gradient(circle farthest-corner at ${radialCenter.x*100}% ${radialCenter.y*100}%,${colors.join(',')})`;}
export function splitParagraphs(text,eachLine=false){return String(text).replace(/\r\n?/g,'\n').split(eachLine?/\n+/:/\n[\t \u3000]*\n+/).map(p=>p.replace(/^\n+|\n+$/g,'')).filter(p=>p.trim());}
export const fonts={kopubDotum:"'KoPub Dotum','Malgun Gothic',sans-serif",kopubBatang:"'KoPub Batang',Batang,serif",freesentation:"'Freesentation','Pretendard','Malgun Gothic',sans-serif",pretendard:"'Pretendard','Malgun Gothic',sans-serif",noto:"'Noto Serif KR',Batang,serif",serif:"Batang,'AppleMyungjo',serif",sans:"'Malgun Gothic','Apple SD Gothic Neo',sans-serif"};
export function wrapText(text,width,measure){const result=[];const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ko',{granularity:'grapheme'}):null;for(const paragraph of String(text).split('\n')){const chars=segmenter?Array.from(segmenter.segment(paragraph),x=>x.segment):Array.from(paragraph);let line='';for(const ch of chars){if(line&&measure(line+ch)>width){const space=line.lastIndexOf(' ');if(space>0&&measure(line.slice(0,space))>width*.6){result.push(line.slice(0,space));line=line.slice(space+1)+ch;}else if(/^[,.!?，。！？、”’」』)\]]$/.test(ch)){const tail=segmenter?Array.from(segmenter.segment(line),x=>x.segment):Array.from(line);const last=tail.pop();if(tail.length)result.push(tail.join(''));line=last+ch;}else{result.push(line);line=ch===' '?'':ch;}}else line+=ch;}result.push(line);}return result.length?result:[''];}
export function constrainDelta(rect,dx,dy,width){return {x:Math.max(-rect.x,Math.min(width-rect.x-rect.w,dx)),y:Math.max(-rect.y,dy)};}
export function alignedX(align,blockWidth,pageWidth,margin){return Math.max(0,Math.min(pageWidth-blockWidth,align==='center'?(pageWidth-blockWidth)/2:align==='right'?pageWidth-margin-blockWidth:margin));}
export function textLines(text,width,measure){return String(text).split('\n').flatMap(paragraph=>{const lines=wrapText(paragraph,width,measure);return lines.map((text,i)=>({text,justify:i<lines.length-1}));});}
export function justifyLine(text,width,measure){
 const indent=text.match(/^\s*/)[0],body=text.slice(indent.length).trimEnd(),parts=body.split(/(\s+)/),spaces=parts.filter(s=>/^\s+$/.test(s)).length;
 let x=measure(indent);const result=indent?[{text:indent,x:0}]:[],extra=Math.max(0,width-x-measure(body));
 if(spaces){for(const part of parts){result.push({text:part,x});x+=measure(part)+(/^\s+$/.test(part)?extra/spaces:0);}}
 else{const chars=Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(body),s=>s.segment),gap=chars.length>1?extra/(chars.length-1):0;for(const ch of chars){result.push({text:ch,x});x+=measure(ch)+gap;}}
 return result;
}
export function escapeHTML(text){return String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
export function styledHTML(block,lineBreaks=true){return blockRuns(block).map(run=>{const css=runCSS(run),text=escapeHTML(run.text),body=lineBreaks?text.replace(/\n/g,'<br>'):text;return css?`<span style="${css}">${body}</span>`:body;}).join('');}

export function resizeWidths(items,delta){
 const min=Math.max(...items.map(b=>b.minWidth-b.w)),max=Math.min(...items.map(b=>b.maxWidth-b.w));
 const amount=Math.max(min,Math.min(max,delta));
 return items.map(b=>({id:b.id,w:b.w+amount}));
}
export function verticalPositions(items,gap){
 const sorted=[...items].sort((a,b)=>a.y-b.y);if(sorted.length<2)return sorted.map(({id,y})=>({id,y}));
 const top=sorted[0].y,bottom=Math.max(...sorted.map(b=>b.y+b.h));
 const spacing=gap??Math.max(0,(bottom-top-sorted.reduce((sum,b)=>sum+b.h,0))/(sorted.length-1));
 let y=top;return sorted.map(b=>{const position={id:b.id,y};y+=b.h+spacing;return position;});
}
export function snapEdge(edge,targets,distance){
 let nearest=null;for(const target of targets){const delta=target-edge;if(Math.abs(delta)<distance){distance=Math.abs(delta);nearest={pos:target,delta};}}return nearest;
}
