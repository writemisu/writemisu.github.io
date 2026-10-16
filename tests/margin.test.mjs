import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {marginSettings,marginSegments,marginLayout,paintMargin,validMargin} from '../dist/margin.js';
import {parseDraft} from '../dist/draft.js';
import {exportHTML} from '../dist/html.js';

const block=(id,text)=>({id,type:'text',text,x:90,y:120,w:320,font:'pretendard',size:16,lineHeight:1.5,color:'#333333',box:'#ffffff',opacity:0,padding:0,align:'left',bold:false});
const state=()=>({width:800,height:741,margin:80,padding:0,noise:0,seed:741,background:'solid',colors:['#f5f5f5','#ffffff'],textColor:'#333333',blocks:[block('b1','비가 그친 자리.\n“기다린 건 아니야.”'),block('b2','그는 창밖을 바라보았다.\n\n“그럼 왜 아직 여기 있어?”')]});
const measure=(b,text)=>Array.from(text).length*b.size*.52;

test('MARGIN fixes spacing and persistent decorations while linking frame and section switches',()=>{
 for(const enabled of [false,true]){
  const s=state();s.marginLayout={texture:3,paragraphGap:60,dialogueIndent:30,dialogueGap:20,marginWidth:100,frame:enabled,corners:!enabled,numbers:enabled,diamonds:!enabled,chapterStar:false,footerStar:false,page:false};const before=structuredClone(s),m=marginSettings(s);
  assert.deepEqual([m.texture,m.paragraphGap,m.dialogueIndent,m.dialogueGap,m.marginWidth],[15,22,8,2,62]);
  assert.equal(m.corners,enabled);assert.equal(m.diamonds,enabled);assert.ok(m.chapterStar&&m.footerStar&&m.page);assert.deepEqual(s,before);
 }
});

test('MARGIN shares body type across narration and dialogue without altering source or HTML output',()=>{
 const s=state(),before=structuredClone(s),html=exportHTML(s);s.pngLayout='margin';s.marginLayout=marginSettings(s);
 const g=marginLayout(s,measure),parts=g.blocks.flatMap(b=>b.parts);
 assert.ok(parts.length>=4);assert.deepEqual([...new Set(parts.map(b=>b.size))],[20]);assert.deepEqual([...new Set(parts.map(b=>b.font))],['kopubBatang']);assert.deepEqual([...new Set(parts.map(b=>b.color))],['#383027']);
 assert.deepEqual(s.blocks,before.blocks);assert.equal(exportHTML(s),html);assert.equal(s.width,before.width);assert.equal(s.height,before.height);
 assert.equal(g.blocks[0].parts[1].text,'“기다린 건 아니야.”');assert.ok(g.blocks[0].parts[1].x>=g.bodyX);assert.equal(g.blocks[1].parts[0].x,g.bodyX);
});

test('section starts label paragraph groups while explicit roles retain the original quotes and column',()=>{
 const s=state();s.blocks.push(block('b3','“이번에는 네가 먼저 가.”'));s.marginLayout={blocks:{b1:{role:'narration'},b2:{sectionStart:true},b3:{role:'dialogue'}}};
 const g=marginLayout(s,measure);assert.deepEqual(g.blocks.map(b=>b.section),[1,2,null]);assert.equal(g.blocks[0].parts[1].x,g.bodyX);assert.equal(g.blocks[2].parts[0].x,g.bodyX+8);
 for(let i=1;i<g.blocks.length;i++)assert.ok(g.blocks[i].y>=g.blocks[i-1].y+g.blocks[i-1].metrics.h);
});

test('MARGIN puts inline dialogue on separate lines while preserving source text and rich-text ranges',()=>{
 const s=state(),text='그가 말했다. "기다려." 문이 닫혔다. “다시 올게.”';s.blocks=[block('b1',text)];
 const quoteStart=text.indexOf('"'),quoteEnd=text.indexOf('"',quoteStart+1)+1;
 s.blocks[0].runs=[{text:text.slice(0,quoteStart)},{text:text.slice(quoteStart,quoteEnd),italic:true},{text:text.slice(quoteEnd)}];const before=structuredClone(s);
 const g=marginLayout(s,measure),parts=g.blocks[0].parts;
 assert.deepEqual(parts.map(p=>p.text),['그가 말했다.','"기다려."','문이 닫혔다.','“다시 올게.”']);
 assert.equal(parts[0].x,g.bodyX);assert.equal(parts[1].x,g.bodyX+8);assert.equal(parts[2].x,g.bodyX);assert.ok(parts[1].runs.every(r=>r.italic));assert.ok(parts[2].runs.every(r=>!r.italic));
 for(let i=1;i<parts.length;i++)assert.ok(parts[i].y>=parts[i-1].y+parts[i-1].metrics.h);
 assert.ok(parts.every(p=>p.size===20));assert.deepEqual(s,before);
});

test('dialogue segmentation handles nested quotes, multiline dialogue, blank lines and explicit roles',()=>{
 const text='지문 “그는 "안녕"이라 했다.\n다시 만났다.” 뒤의 지문\n\n「다음 대사」';
 const parts=marginSegments(text),visible=parts.filter(p=>!p.blank);
 assert.deepEqual(visible.map(p=>text.slice(p.start,p.end)),['지문','“그는 "안녕"이라 했다.','다시 만났다.”','뒤의 지문','「다음 대사」']);
 assert.deepEqual(visible.map(p=>p.dialogue),[false,true,true,false,true]);assert.equal(parts.filter(p=>p.blank).length,1);
 assert.equal(marginSegments('말했다. "대사" 지문','narration').length,1);assert.equal(marginSegments('"닫히지 않은 대사')[0].dialogue,false);
 const escaped='그는 \\"인용\\"이라고 적었다.';assert.equal(marginSegments(escaped).length,1);assert.equal(marginSegments(escaped)[0].dialogue,false);
});

test('narration and dialogue transitions use one body line plus 2px once',()=>{
 for(const [size,lineHeight,gap] of [[20,1.85,8],[24,2,0]]){
  const s=state();s.blocks=[block('b1','앞의 지문. "대사." 뒤의 지문.')];s.marginLayout={size,lineHeight,dialogueGap:gap};const before=structuredClone(s);
  const [first,dialogue,last]=marginLayout(s,measure).blocks[0].parts,expected=size*lineHeight+2;
  assert.ok(Math.abs(dialogue.y-first.y-first.metrics.h-expected)<1e-8);assert.ok(Math.abs(last.y-dialogue.y-dialogue.metrics.h-expected)<1e-8);assert.deepEqual(s,before);
 }
});

test('adjacent dialogue uses 22px within and across source paragraphs without exterior padding',()=>{
 for(const texts of [['"첫 대사." "다음 대사."'],['"첫 대사."\n"다음 대사."'],['"첫 대사."','"다음 대사."']]){
  const s=state();s.blocks=texts.map((text,i)=>block('b'+(i+1),text));const before=structuredClone(s),g=marginLayout(s,measure),[first,last]=g.blocks.flatMap(b=>b.parts);
  assert.ok(Math.abs(last.y-first.y-first.metrics.h-22)<1e-8);assert.equal(first.y,g.bodyTop);assert.equal(g.bodyBottom,last.y+last.metrics.h);assert.deepEqual(s,before);
 }
});

test('blank lines collapse with automatic spacing instead of adding to it across paragraphs',()=>{
 for(const [first,last,gap] of [['지문.','"대사."',39],['"대사."','지문.',39],['"대사."','"다음 대사."',22],['지문.','다음 지문.',22]]){
  for(const blanks of [0,1,2])for(const separate of [false,true]){
   const s=state();s.blocks=separate?[block('b1',first+'\n'.repeat(blanks)),block('b2',last)]:[block('b1',first+'\n'.repeat(blanks+1)+last)];
   const g=marginLayout(s,measure),[a,b]=g.blocks.flatMap(block=>block.parts),base=first==='지문.'&&last==='다음 지문.'&&!separate?0:gap;
   assert.ok(Math.abs(b.y-a.y-a.metrics.h-Math.max(base,blanks*22))<1e-8);
  }
 }
 const s=state();s.blocks=[block('b1','"대사."'),block('b2',' '),block('b3','"다음 대사."')];
 const g=marginLayout(s,measure),[a,b]=g.blocks.flatMap(block=>block.parts);assert.equal(g.blocks.length,2);assert.ok(Math.abs(b.y-a.y-a.metrics.h-22)<1e-8);
});

test('long logs grow the page without shrinking type or overlapping header, paragraphs and footer',()=>{
 const s=state(),short=marginLayout(s,measure);s.blocks=Array.from({length:60},(_,i)=>block('b'+(i+1),'짧은 침묵이 흘렀다. '.repeat(15)));
 const long=marginLayout(s,measure);assert.ok(long.height>short.height*5);assert.ok(long.bodyTop>=long.outer+long.headerHeight);assert.ok(long.footerY>long.bodyBottom);assert.ok(long.footerY<long.height);
 for(let i=1;i<long.blocks.length;i++)assert.ok(long.blocks[i].y>=long.blocks[i-1].y+long.blocks[i-1].metrics.h);
 assert.ok(long.blocks.every(b=>b.size===20));
 for(const width of [400,800,1600]){s.marginLayout={width,outer:160,marginWidth:180};const g=marginLayout(s,measure);assert.ok(g.bodyX>=g.outer);assert.ok(g.bodyX+g.bodyWidth<=width-g.outer+1);}
});

test('MARGIN settings round-trip through drafts alongside existing layouts',()=>{
 const s=state();s.pngLayout='margin';s.marginLayout={...marginSettings(s),title:'사용자 제목',numbers:false,texture:7,blocks:{b2:{sectionStart:true,role:'dialogue'}}};
 assert.equal(validMargin(s.marginLayout),true);assert.deepEqual(parseDraft(JSON.stringify({version:1,state:s})).state,s);
 for(const patch of [{font:'missing'},{size:0},{background:'bad'},{header:'yes'},{blocks:{b1:{role:'chat'}}}])assert.equal(validMargin({...s.marginLayout,...patch}),false);
});

test('shared font and color controls update MARGIN without rewriting original paragraph styles',()=>{
 const s=state();s.pngLayout='margin';s.blocks[0].presentation='chat';const before=structuredClone(s.blocks),app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const format=app.slice(app.indexOf('function setFormat('),app.indexOf('function setHTMLSetting(')),settings=app.slice(app.indexOf('function setMarginSetting('),app.indexOf('function renderMarginSettings('));
 const env={state:s,editorMode:'png',marginSettings,marginGeometry:null};runInNewContext(settings+'\n'+format+'\nthis.format=setFormat;',env);
 env.format(s.blocks[0],'font','noto');env.format(s.blocks[0],'messageColor','#552233');env.format(s.blocks[1],'size',24);
 assert.deepEqual(s.blocks,before);const g=marginLayout(s,measure);assert.ok(g.blocks.every(b=>b.font==='noto'&&b.size===24&&b.color==='#552233'));
});

test('MARGIN uses the same geometry for preview and scaled PNG rendering',()=>{
 const s=state(),g=marginLayout(s,measure),events=[],c=new Proxy({measureText:text=>({width:Array.from(text).length*10,actualBoundingBoxAscent:15,actualBoundingBoxDescent:4})},{get:(target,key)=>key in target?target[key]:(...args)=>events.push({key,args}),set:(target,key,value)=>{target[key]=value;return true;}}),target={getContext:()=>c};
 paintMargin(target,s,g,{},1);paintMargin(target,s,g,{},2);assert.deepEqual(events.filter(e=>e.key==='setTransform').map(e=>e.args[0]),[1,2]);assert.equal(g.blocks[0].size,20);
});
