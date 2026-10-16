import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {exportHTML,htmlSettings,htmlBlock} from '../dist/html.js';
import {blockRuns,sliceRuns,spliceRuns} from '../dist/richtext.js';

const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const block={id:'b1',type:'text',text:'“원문”\n그다음 문장',x:90,y:120,w:310,size:16,lineHeight:1.85,font:'noto',padding:8,color:'#333333',box:'#ffffff',opacity:0,align:'left',auto:false};
const state=()=>({width:800,height:350,margin:80,padding:8,background:'solid',colors:['#f5f5f5','#f5f5f5'],textColor:'#333333',noise:0,seed:741,blocks:[structuredClone(block)]});

test('existing formatting controls write HTML overrides without changing PNG styles',()=>{
 const s=state(),before=structuredClone(s),env={state:s,editorMode:'html',htmlBlock,htmlSettings};
 const source=app.slice(app.indexOf('function displayBlock('),app.indexOf('function fontString('));
 runInNewContext(source+'\nthis.edit=setFormat;this.view=displayBlock;',env);
 for(const [key,value] of [['font','pretendard'],['size',24],['lineHeight',2],['color','#d9c8ad'],['align','right'],['box','#41434b'],['opacity',20]])env.edit(s.blocks[0],key,value);
 assert.equal(env.view(s.blocks[0]).font,'pretendard');assert.equal(env.view(s.blocks[0]).size,24);assert.match(exportHTML(s),/font-size:18pt/);assert.match(exportHTML(s),/text-align:right/);
 const {htmlStyle,...png}=s.blocks[0];assert.deepEqual(png,before.blocks[0]);
 env.editorMode='png';env.edit(s.blocks[0],'size',20);assert.equal(s.blocks[0].size,20);assert.equal(s.blocks[0].htmlStyle.size,24);
});

test('HTML divider alignment controls move the exported line without changing PNG coordinates',()=>{
 const s=state(),line={...s.blocks[0],type:'line',text:''};s.blocks=[line];const buttons=[],tabs={textAlignTab:{setAttribute(){}},layerAlignTab:{setAttribute(){}},alignmentButtons:{replaceChildren(){buttons.length=0;},setAttribute(){},append(b){buttons.push(b);}}};
 const env={state:s,editorMode:'html',alignmentMode:'layer',htmlBlock,icons:{},$:id=>tabs[id],formatTargets:()=>[line],selection:()=>[line],bounds:()=>null,displayBlock:b=>htmlBlock(s,b),change:fn=>fn(),setFormat:(b,key,value)=>{b.htmlStyle={...b.htmlStyle,[key]:value};},document:{createElement:()=>({setAttribute(){}})}};
 const source=app.slice(app.indexOf('function renderAlignment(){'),app.indexOf('function widthLimit('));runInNewContext(source+'\nrenderAlignment();',env);
 assert.equal(buttons.length,3);assert.ok(buttons.every(b=>!b.disabled));buttons[2].onclick();assert.equal(line.htmlStyle.align,'right');assert.match(exportHTML(s),/width:33%;margin:0 0 0 auto/);
 env.alignmentMode='text';buttons[1].onclick();assert.equal(line.htmlStyle.align,'center');assert.match(exportHTML(s),/width:33%;margin:0 auto/);assert.equal(line.x,block.x);assert.equal(line.y,block.y);
});

test('preview toggles update the right excerpt when disabled collapse and divider blocks are mixed in',()=>{
 const s=state();s.blocks=[{...block,htmlCollapse:false},{...block,id:'b2',type:'line'},{...block,id:'b3'},{...block,id:'b4',htmlOpen:true}];
 let nodes=[],history=0,listRenders=0,observed=0;
 const root={getBoundingClientRect:()=>({height:400})},body={firstElementChild:root,querySelectorAll:()=>nodes,set innerHTML(html){nodes=Array.from(html.matchAll(/<details\b([^>]*)>/g),match=>({open:/\bopen\b/.test(match[1]),isConnected:true}));}};
 const elements={htmlPreview:{style:{},dataset:{ready:'true'},contentDocument:{body}},htmlCode:{},htmlSizeLabel:{}};
 const env={state:s,inlineEdit:null,htmlLineSelection:null,exportHTML,htmlSettings,$:id=>elements[id],htmlPreviewObserver:{disconnect(){},observe(node){assert.equal(node,root);observed++;}},snapshot:()=>JSON.stringify(s),endTyping(){},record(){history++;},renderList(){listRenders++;},Math};
 const source=app.slice(app.indexOf('function resizeHTMLPreview('),app.indexOf('function setHTMLView('));
 runInNewContext(source+'\nthis.preview=renderHTMLPreview;',env);env.preview();
 assert.deepEqual(nodes.map(n=>n.open),[false,true]);assert.equal(observed,1);
 nodes[1].ontoggle();assert.equal(history,0);
 nodes[0].open=true;nodes[0].ontoggle();assert.equal(s.blocks[2].htmlOpen,true);assert.equal(s.blocks[0].htmlOpen,undefined);assert.equal(s.blocks[1].htmlOpen,undefined);assert.equal(history,1);assert.equal(listRenders,1);
 assert.equal((elements.htmlCode.value.match(/<details open/g)||[]).length,2);
 nodes[0].isConnected=false;nodes[0].open=false;nodes[0].ontoggle();assert.equal(s.blocks[2].htmlOpen,true);assert.equal(history,1);
});

test('restoring HTML defaults is undoable and retains source text, titles and PNG settings',()=>{
 const s=state();s.htmlSettings={...htmlSettings(s),frame:true,surface:'#ffffff'};s.blocks[0]={...s.blocks[0],htmlSummary:'입력한 제목',htmlOpen:true,htmlCollapse:false,htmlStyle:{font:'kopubBatang',size:32,color:'#445566'}};
 const before=structuredClone(s),elements={htmlReset:{}},undo=[];
 const source=app.slice(app.indexOf("$('htmlReset').onclick="),app.indexOf("\nbindSlider($('htmlGap')"));
 const env={state:s,htmlSettings,$:id=>elements[id],endTyping(){},change(fn){undo.push(JSON.stringify(s));fn();}};runInNewContext(source,env);elements.htmlReset.onclick();
 assert.deepEqual(['background','surface','textColor','muted','accent','border'].map(key=>s.htmlSettings[key]),['#101217','#1d2027','#e8e5e1','#92949c','#bda47b','#44464c']);assert.equal(s.htmlSettings.width,680);assert.equal(s.blocks[0].htmlStyle,undefined);
 for(const key of Object.keys(before.blocks[0]).filter(key=>key!=='htmlStyle'))assert.deepEqual(s.blocks[0][key],before.blocks[0][key],key);
 assert.deepEqual(JSON.parse(undo[0]),before);assert.deepEqual(s.colors,before.colors);
});

test('typing in the preview updates copied HTML without replacing the focused editor DOM',()=>{
 const s=state(),body={firstElementChild:{getBoundingClientRect:()=>({height:300})},set innerHTML(value){throw Error('Typing must keep the focused editor');}};
 const elements={htmlPreview:{style:{},dataset:{ready:'true'},contentDocument:{body}},htmlCode:{},htmlSizeLabel:{}};
 const env={state:s,inlineEdit:{id:'b1',mode:'html'},exportHTML,htmlSettings,$:id=>elements[id],htmlPreviewObserver:{disconnect(){throw Error('Typing must retain the observer');}},Math};
 const source=app.slice(app.indexOf('function resizeHTMLPreview('),app.indexOf('function setHTMLView('));
 runInNewContext(source+'\nthis.preview=renderHTMLPreview;',env);s.blocks[0].text='지면에서 수정';env.preview();
 assert.ok(elements.htmlCode.value.includes('지면에서 수정'));assert.equal(elements.htmlPreview.style.height,'300px');
 assert.ok(!elements.htmlCode.value.includes('data-block-id'));
});

test('HTML inline editing changes only the clicked occurrence and keeps neighboring rich text and blank lines',()=>{
 const s=state();s.blocks[0].text='앞\n같은 말\n\n같은 말\n끝';s.blocks[0].runs=[{text:'앞\n같은 말\n\n',bold:true},{text:'같은 말',italic:true},{text:'\n끝',underline:true}];
 let options,selector;
 const input={dataset:{},style:{},setAttribute(){},addEventListener(){},focus(){}},wrapper={dataset:{},style:{},querySelector:q=>q==='.paragraph-input'?input:{style:{}}},host={style:{},replaceChildren(){}};
 const doc={querySelector:q=>{selector=q;return host;},createRange:()=>({selectNodeContents(){},collapse(){}}),getSelection:()=>({removeAllRanges(){},addRange(){}})};
 const env={state:s,editorMode:'html',inlineEdit:null,htmlLineSelection:null,activeHTMLTab:'t1',selected:new Set(),blockRuns,sliceRuns,spliceRuns,clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),finishInlineEdit(){},endTyping(){},renderList(){},renderSelection(){},displayBlock:b=>htmlBlock(s,b),presentationColors:b=>({color:b.color}),fonts:{},$:()=>({contentDocument:doc}),document:{documentElement:{}},getComputedStyle:()=>({getPropertyValue:()=> '#8799bd'}),inlineKeyDown(){},createEditor(id,config){options=config;return wrapper;},updateText(id,runs){s.blocks[0].runs=runs;s.blocks[0].text=runs.map(r=>r.text).join('');}};
 const source=app.slice(app.indexOf('function beginInlineEdit('),app.indexOf('function inlineKeyDown('));runInNewContext(source+'\nthis.begin=beginInlineEdit;',env);env.begin('b1',undefined,3);
 assert.match(selector,/data-line-index="3"/);assert.equal(options.getBlock('b1').text,'같은 말');assert.equal(options.getBlock('b1').runs[0].italic,true);
 options.onChange('b1',[{text:'고친 말\n새 줄',italic:true}]);assert.equal(s.blocks[0].text,'앞\n같은 말\n\n고친 말\n새 줄\n끝');assert.equal(s.blocks[0].runs[0].bold,true);assert.equal(s.blocks[0].runs.at(-1).underline,true);
 options.onChange('b1',[{text:'짧게'}]);assert.equal(s.blocks[0].text,'앞\n같은 말\n\n짧게\n끝');assert.equal(options.getBlock('b1').text,'짧게');
});
