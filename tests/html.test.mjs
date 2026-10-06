import test from 'node:test';
import assert from 'node:assert/strict';
import {exportHTML,htmlSettings} from '../dist/html.js';
import {parseDraft} from '../dist/draft.js';

const block={id:'b1',type:'text',text:'첫 문장\n다음 문장',x:117,y:409,w:219,size:16,lineHeight:1.85,font:'pretendard',padding:0,color:'#333333',box:'#ffffff',opacity:0,align:'left',auto:false,group:'g8'};
const state={width:800,height:900,margin:80,padding:0,background:'solid',colors:['#f5f5f5','#f5f5f5'],textColor:'#333333',noise:0,seed:741,blocks:[block]};

test('HTML is a responsive inline fragment, independent of PNG positions, widths and groups',()=>{
 const before=structuredClone(state),html=exportHTML(state);
 assert.match(html,/max-width:500px/);assert.match(html,/첫 문장<br>다음 문장/);
 assert.doesNotMatch(html,/<(?:script|style|link|canvas|iframe)\b|\b(?:class|id|on\w+)=|position:|transform:|(?:[;"\x27])(?:left|top):|219px|409px|117px/);
 assert.equal(exportHTML({...state,blocks:[{...block,x:0,y:0,w:700,group:null,auto:true}]}),html);
 assert.deepEqual(state,before);
});

test('each paragraph becomes a closed details with an editable, escaped summary',()=>{
 const html=exportHTML({...state,blocks:[block,{...block,id:'b2',htmlSummary:'대화 <&> "제목"'}]});
 assert.equal((html.match(/<details /g)||[]).length,2);assert.equal((html.match(/<summary /g)||[]).length,2);
 assert.match(html,/>ONLINE<\/span>/);assert.match(html,/대화 &lt;&amp;&gt; &quot;제목&quot;/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
});

test('rich marks, quotes and reversible substitutions survive export as inline formatting',()=>{
 const s={...state,blocks:[{...block,htmlSummary:'미수의 대화',text:'“미수 test”\n　끝',runs:[{text:'“미수 test”',bold:true,italic:true,underline:true,strike:true},{text:'\n　끝'}]}],replacementRules:[{find:'미수',replace:'{{user}}'}],quoteStyle:{enabled:true,highlight:'#333333',highlightOpacity:8}};
 const original=structuredClone(s),html=exportHTML(s);
 for(const value of ['font-weight:700','font-style:italic','underline line-through','rgba(51,51,51,0.08)','{{user}}','width:1em'])assert.ok(html.includes(value),value);
 assert.deepEqual(s,original);assert.ok(exportHTML({...s,replacementRules:[]}).includes('미수'));
 assert.match(html,/>{{user}}의 대화<\/span>/);
});

test('chat direction controls the bubble row independently of text alignment',()=>{
 for(const side of ['left','right']){
  const html=exportHTML({...state,blocks:[{...block,presentation:'chat',messageSide:side,align:'center'}]});
  assert.ok(html.includes(`margin:0 0 0px;text-align:${side};`));assert.match(html,/max-width:82%/);assert.match(html,/text-align:center/);
 }
});

test('notification header and sender use safe text and retain replacements',()=>{
 const html=exportHTML({...state,replacementRules:[{find:'미수',replace:'{{user}}'}],blocks:[{...block,presentation:'notification',messageTitle:'미수 알림',messageSender:'미수',messageTime:'지금',text:'<img src=x onerror=alert(1)>'}]});
 assert.match(html,/<table role="presentation"/);assert.match(html,/{{user}} 알림/);assert.match(html,/{{user}}: /);assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img/);
});

test('plain, chapter and dividers support alignment without layer coordinates',()=>{
 const html=exportHTML({...state,blocks:[{...block,align:'justify'},{...block,id:'b2',presentation:'chapter'},{...block,id:'b3',type:'line',align:'right'}]});
 assert.match(html,/text-align:justify/);assert.match(html,/■ <span[^>]*>첫 문장/);assert.match(html,/width:33%;margin:0 0 0 auto;border-top:1px/);
 assert.equal((html.match(/<details /g)||[]).length,2);
});

test('HTML settings and titles round trip in drafts while legacy drafts remain valid',()=>{
 const html={width:700,padding:12,gap:40},s={...state,htmlSettings:html,blocks:[{...block,htmlSummary:'대화'}]};
 assert.deepEqual(parseDraft(JSON.stringify({version:1,state:s})).state,s);
 assert.deepEqual(htmlSettings(state),{width:500,padding:28,gap:24});assert.deepEqual(htmlSettings(s),html);
 for(const invalid of [{width:0,padding:0,gap:0},{width:500,padding:-1,gap:24},{width:500,padding:28,gap:121}])assert.equal(parseDraft(JSON.stringify({version:1,state:{...state,htmlSettings:invalid}})),null);
});

test('HTML has a transparent exterior and solid cards regardless of PNG gradients and noise',()=>{
 const s={...state,background:'radial',colors:['#2d3643','#57545f'],noise:40},before=structuredClone(s),html=exportHTML(s);
 assert.doesNotMatch(html.match(/^<div[^>]+>/)[0],/background/);
 assert.doesNotMatch(html,/gradient|background-image|data:image/);
 assert.match(html,/<div[^>]+background-color:#2d3643;/);
 assert.equal(html,exportHTML({...s,background:'solid',noise:0,colors:['#2d3643','#ffffff']}));
 assert.deepEqual(s,before);
});

test('HTML export avoids CSS forbidden by the supplied Arca guide',()=>{
 const html=exportHTML({...state,blocks:['plain','chat','notification','chapter'].map((presentation,i)=>({...block,id:'b'+(i+1),presentation,htmlSummary:'길어도 줄바꿈되는 접기 제목'}))});
 const blocked=/^(?:position|z-index|overflow(?:-[xy])?|gap|grid-.*|transform|animation|transition|opacity|filter|backdrop-filter|clip-path|mask|cursor|pointer-events|user-select|resize|writing-mode|content|mix-blend-mode|isolation|outline(?:-offset)?|-webkit-.*)$/;
 for(const [,style] of html.matchAll(/style="([^"]*)"/g))for(const declaration of style.split(';')){
  const colon=declaration.indexOf(':');if(colon<0)continue;
  const property=declaration.slice(0,colon).trim(),value=declaration.slice(colon+1).trim();
  assert.ok(!blocked.test(property),property);
  if(property==='display')assert.ok(!['flex','grid','inline-grid'].includes(value),value);
  assert.doesNotMatch(value,/url\(|conic-gradient\(/);
 }
 assert.doesNotMatch(html,/<(?:style|script|link|button|input|svg)\b|<!--|\bon\w+=/);
});
