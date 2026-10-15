import test from 'node:test';
import assert from 'node:assert/strict';
import {exportHTML,htmlSettings,htmlBlock,initializeHTML} from '../dist/html.js';
import {parseDraft} from '../dist/draft.js';
import {blockMetrics,presentationColors} from '../dist/messages.js';

const block={id:'b1',type:'text',text:'첫 문장\n다음 문장',x:117,y:409,w:219,size:16,lineHeight:1.85,font:'pretendard',padding:0,color:'#333333',box:'#ffffff',opacity:0,align:'left',auto:false,group:'g8'};
const state={width:800,height:900,margin:80,padding:0,background:'solid',colors:['#f5f5f5','#f5f5f5'],textColor:'#333333',noise:0,seed:741,blocks:[block]};
const details=html=>Array.from(html.matchAll(/<details\b([^>]*)>/g),match=>/\bopen\b/.test(match[1]));
const restore=s=>parseDraft(JSON.stringify({version:1,state:s}))?.state;

test('new HTML uses Champagne Noir with inline responsive layout and no generated metadata',()=>{
 const before=structuredClone(state),html=exportHTML(state),s=htmlSettings(state),b=htmlBlock(state,block);
 assert.deepEqual([s.width,s.padding,s.gap,s.frame,s.radius,s.decoration,s.decorationStyle],[680,44,24,false,10,false,'hairline']);
 for(const color of ['#101217','#1d2027','#e8e5e1','#bda47b'])assert.ok(html.includes(color),color);
 assert.match(html,/max-width:680px/);assert.match(html,/padding:28px 22px;padding-left:clamp\(22px,calc\(11% - 30.8px\),44px\)/);
 assert.match(html,/첫 문장<br>다음 문장/);assert.deepEqual([b.font,b.size,b.lineHeight,b.align],['pretendard',16,1.85,'left']);
 assert.doesNotMatch(html,/ONLINE|문단 1|END OF EXCERPT|<h[1-6]\b/);
 assert.doesNotMatch(html,/<(?:script|style|link|canvas|iframe)\b|\b(?:class|id|on\w+)=|position:|transform:|219px|409px|117px/);
 assert.equal(exportHTML({...state,blocks:[{...block,x:0,y:0,w:700,group:null,auto:true}]}),html);assert.deepEqual(state,before);
});

test('each excerpt has its own optional title and native open or closed state',()=>{
 const s={...state,blocks:[{...block,htmlOpen:true},{...block,id:'b2',htmlSummary:'대화 <&> "제목"',htmlOpen:false},{...block,id:'b3'}]},html=exportHTML(s);
 assert.deepEqual(details(html),[true,false,false]);assert.equal((html.match(/<summary /g)||[]).length,3);
 assert.match(html,/대화 &lt;&amp;&gt; &quot;제목&quot;/);assert.match(html,/aria-label="펼치기 \/ 접기"/);assert.deepEqual(restore(s),s);
 for(const htmlOpen of ['true','false',1,null])assert.equal(restore({...state,blocks:[{...block,htmlOpen}]}),undefined);
});

test('turning collapse off removes only that excerpt header while retaining all text and order',()=>{
 const html=exportHTML({...state,blocks:[{...block,text:'첫째',htmlCollapse:false,htmlSummary:'숨긴 제목'},{...block,id:'b2',text:'둘째',htmlOpen:true},{...block,id:'b3',text:'셋째',htmlCollapse:false}]});
 assert.deepEqual(details(html),[true]);assert.doesNotMatch(html,/숨긴 제목/);
 assert.ok(html.indexOf('첫째')<html.indexOf('둘째'));assert.ok(html.indexOf('둘째')<html.indexOf('셋째'));
 assert.deepEqual(details(exportHTML({...state,blocks:[{...block,htmlCollapse:false}]})),[]);
});

test('rich marks, quotes, indentation and reversible substitutions survive export',()=>{
 const s={...state,blocks:[{...block,htmlSummary:'미수의 대화',text:'“미수 test”\n　끝',runs:[{text:'“미수 test”',bold:true,italic:true,underline:true,strike:true},{text:'\n　끝'}]}],replacementRules:[{find:'미수',replace:'{{user}}'}],quoteStyle:{enabled:true,highlight:'#333333',highlightOpacity:8}};
 const original=structuredClone(s),html=exportHTML(s);
 for(const value of ['font-weight:700','font-style:italic','underline line-through','rgba(51,51,51,0.08)','{{user}}','width:1em'])assert.ok(html.includes(value),value);
 assert.deepEqual(s,original);assert.ok(exportHTML({...s,replacementRules:[]}).includes('미수'));assert.match(html,/>{{user}}의 대화<\/span>/);
 assert.match(exportHTML({...s,htmlSettings:{quoteStyle:{...s.quoteStyle,highlight:'#bda47b'}}}),/rgba\(189,164,123,0.08\)/);assert.deepEqual(s.quoteStyle,original.quoteStyle);
});

test('chat direction, typography and custom message colors remain editable independently',()=>{
 for(const side of ['left','right']){
  const b={...block,presentation:'chat',messageSide:side,htmlStyle:{align:'center',font:'noto',size:24,lineHeight:2,messageColor:'#ffffff',messageBox:'#41536a',messageOpacity:75}},html=exportHTML({...state,blocks:[b]});
  for(const value of [`margin:0 0 0px;text-align:${side};`,'max-width:82%','text-align:center','font-size:18pt','line-height:2','Noto Serif KR','color:#ffffff','rgba(65,83,106,0.75)'])assert.ok(html.includes(value),value);
 }
});

test('notification header and sender are safe and support replacement',()=>{
 const html=exportHTML({...state,replacementRules:[{find:'미수',replace:'{{user}}'}],blocks:[{...block,presentation:'notification',messageTitle:'미수 알림',messageSender:'미수',messageTime:'지금',text:'<img src=x onerror=alert(1)> & "대사"'}]});
 for(const value of ['<table role="presentation"','table-layout:fixed','{{user}} 알림','{{user}}: ','&lt;img src=x onerror=alert(1)&gt;','color:#92949c'])assert.ok(html.includes(value),value);assert.doesNotMatch(html,/<img/);
});

test('manual dividers and chapter blocks retain their place and formatting',()=>{
 const html=exportHTML({...state,blocks:[{...block,htmlStyle:{align:'justify'}},{...block,id:'b2',presentation:'chapter'},{...block,id:'b3',type:'line',htmlStyle:{align:'right',color:'#967952'}}]});
 assert.match(html,/text-align:justify/);assert.match(html,/■ <span[^>]*>첫 문장/);assert.match(html,/width:33%;margin:0 0 0 auto;border-top:1px solid #967952/);
 assert.equal(details(html).length,2);assert.ok(html.indexOf('■ ')<html.indexOf('border-top:1px solid #967952'));
});

test('frame and optional decorations do not change width, padding or paragraph order',()=>{
 const base={...state,htmlSettings:{width:700,padding:44,frame:false}},frame={...base,htmlSettings:{...base.htmlSettings,frame:true,radius:10,border:'#514d44'}},plain=exportHTML(base),framed=exportHTML(frame);
 assert.equal(plain.replace('border:1px solid transparent;border-radius:0px','border:1px solid #514d44;border-radius:10px'),framed);assert.doesNotMatch(framed,/box-shadow:4px|border:2px/);
 const hairline=exportHTML({...frame,htmlSettings:{...frame.htmlSettings,decoration:true}});assert.match(hairline,/width:36px;border-top:1px solid #bda47b/);assert.doesNotMatch(hairline,/END OF EXCERPT/);
 const editorial=exportHTML({...frame,htmlSettings:{...frame.htmlSettings,decoration:true,decorationStyle:'editorial',decorationPosition:'both',decorationLabel:'FIN <&>'}});
 assert.equal((editorial.match(/FIN &lt;&amp;&gt;/g)||[]).length,2);assert.equal((editorial.match(/width:36px/g)||[]).length,4);
 assert.doesNotMatch(exportHTML({...frame,htmlSettings:{...frame.htmlSettings,decoration:false,decorationStyle:'editorial'}}),/END OF EXCERPT|width:36px/);
});

test('HTML colors are adjustable and independent of PNG gradients and noise',()=>{
 const htmlSettings={background:'#fffdf5',surface:'#f6f1e6',textColor:'#292522',accent:'#82603e',muted:'#6d655e'},s={...state,background:'radial',noise:40,htmlSettings},before=structuredClone(s),html=exportHTML(s);
 for(const value of Object.values(htmlSettings).slice(0,4))assert.ok(html.includes(value),value);assert.doesNotMatch(html,/gradient|background-image|data:image/);
 assert.equal(html,exportHTML({...s,background:'solid',noise:0,colors:['#000000','#ffffff']}));assert.deepEqual(s,before);
});

test('legacy migration retains saved dimensions and block styles without changing PNG',()=>{
 const b={...block,font:'noto',size:24,lineHeight:2,align:'justify',presentation:'chat',messageSide:'right',messageBox:'#837c72'},s=structuredClone({...state,htmlSettings:{width:550,padding:18,gap:30},blocks:[b]}),before=structuredClone(s),pngMetrics=blockMetrics(b,text=>text.length*8),pngColors=presentationColors(b);
 assert.equal(initializeHTML(s,true),true);assert.deepEqual([htmlSettings(s).width,htmlSettings(s).padding,htmlSettings(s).gap,htmlSettings(s).surface],[550,18,30,'#f5f5f5']);
 const display=htmlBlock(s,s.blocks[0]);for(const key of ['font','size','lineHeight','align','color'])assert.equal(display[key],b[key],key);
 assert.deepEqual(presentationColors(display),pngColors);assert.deepEqual(blockMetrics(s.blocks[0],text=>text.length*8),pngMetrics);
 for(const key of Object.keys(b))assert.deepEqual(s.blocks[0][key],b[key],key);
 for(const key of Object.keys(state).filter(key=>key!=='blocks'))assert.deepEqual(s[key],before[key],key);
 assert.deepEqual(restore(s),s);const saved=JSON.stringify(s);assert.equal(initializeHTML(s,true),false);assert.equal(JSON.stringify(s),saved);
});

test('fresh defaults and later HTML edits preserve PNG state and original text',()=>{
 const s=structuredClone(state),before=structuredClone(s);initializeHTML(s);s.htmlSettings={...s.htmlSettings,frame:true,background:'#171822'};s.blocks[0].htmlStyle={font:'noto',size:20,color:'#aabbcc'};
 const display=htmlBlock(s,s.blocks[0]);assert.equal(display.font,'noto');assert.equal(display.size,20);assert.equal(display.color,'#aabbcc');
 const {htmlSettings,...pngState}=s,{htmlStyle,...pngBlock}=s.blocks[0];assert.deepEqual({...pngState,blocks:[pngBlock]},before);assert.deepEqual(restore(s),s);
});

test('extended settings and formatting survive drafts; malformed fields are rejected',()=>{
 const s=structuredClone(state);initializeHTML(s);s.htmlSettings={...s.htmlSettings,frame:true,radius:14,decoration:true,decorationStyle:'editorial',decorationLabel:'끝',decorationPosition:'both'};s.blocks[0].htmlCollapse=false;s.blocks[0].htmlStyle={font:'noto',size:18,align:'right',color:'#ccddee'};
 assert.deepEqual(restore(s),s);assert.ok(restore(state));
 for(const patch of [{width:0},{padding:-1},{gap:121},{surface:'red'},{frame:'yes'},{radius:41},{decorationStyle:'flower'},{decorationPosition:'left'},{decorationLabel:42},{font:'unknown'},{quoteStyle:{enabled:true}}])assert.equal(restore({...s,htmlSettings:{...s.htmlSettings,...patch}}),undefined,JSON.stringify(patch));
 for(const htmlStyle of [null,[],{font:'unknown'},{color:'red'},{size:-1},{messageOpacity:101},{text:'overwrite'}])assert.equal(restore({...s,blocks:[{...block,htmlStyle}]}),undefined);assert.equal(restore({...s,blocks:[{...block,htmlCollapse:'false'}]}),undefined);
});

test('long logs preserve emoji, quotes, blank lines, tags and full-width spaces',()=>{
 const text=('“긴 대사 👋 & <태그>.”\n　그다음 문장.\n\n').repeat(250),s={...state,blocks:[{...block,text,htmlSummary:'긴 제목 '.repeat(80)}]},html=exportHTML(s);
 assert.equal((html.match(/긴 대사 👋 &amp; &lt;태그&gt;/g)||[]).length,250);assert.equal((html.match(/<br>/g)||[]).length,750);assert.match(html,/overflow-wrap:anywhere/);assert.doesNotMatch(html,/white-space:nowrap|(?:^|[;"])width:680px/);assert.equal(s.blocks[0].text,text);
 for(const padding of [0,12,22,44,120])assert.doesNotMatch(exportHTML({...s,htmlSettings:{padding}}),/calc\([^)]*--|NaN|Infinity/);
});

test('HTML export avoids CSS and resources forbidden by the supplied Arca guide',()=>{
 const html=exportHTML({...state,htmlSettings:{frame:true,decoration:true,decorationStyle:'editorial'},blocks:['plain','chat','notification','chapter'].map((presentation,i)=>({...block,id:'b'+(i+1),presentation,htmlSummary:'길어도 줄바꿈되는 접기 제목'}))});
 const blocked=/^(?:position|z-index|overflow(?:-[xy])?|gap|grid-.*|transform|animation|transition|opacity|filter|backdrop-filter|clip-path|mask|cursor|pointer-events|user-select|resize|writing-mode|content|mix-blend-mode|isolation|outline(?:-offset)?|-webkit-.*)$/;
 for(const [,style] of html.matchAll(/style="([^"]*)"/g))for(const declaration of style.split(';')){
  const colon=declaration.indexOf(':');if(colon<0)continue;const property=declaration.slice(0,colon).trim(),value=declaration.slice(colon+1).trim();assert.ok(!blocked.test(property),property);
  if(property==='display')assert.ok(!['flex','grid','inline-grid'].includes(value),value);assert.doesNotMatch(value,/url\(|conic-gradient\(/);
 }
 assert.doesNotMatch(html,/<(?:style|script|link|button|input|svg)\b|<!--|\bon\w+=/);
});
