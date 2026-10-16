import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {paragraphFormat,applyParagraphFormat} from '../dist/paragraph-format.js';
import {htmlBlock} from '../dist/html.js';

const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const base={id:'b1',type:'text',text:'원문',runs:[{text:'원문',italic:true}],font:'noto',size:24,lineHeight:2.15,align:'justify',color:'#112233',box:'#ddeeff',opacity:35,padding:10,w:320,x:80,y:90,htmlTabId:'t1',auto:false};
function setup(blocks){
 const state={width:800,blocks,htmlSettings:{textColor:'#e8e5e1'},htmlTabs:[{id:'t1'},{id:'t2'}]},undo=[],env={state,editorMode:'png',activeHTMLTab:'t1',selected:new Set(['b1']),copiedParagraphFormats:{png:null,html:null},paragraphFormat,applyParagraphFormat,selection:()=>state.blocks.filter(b=>env.selected.has(b.id)),finishInlineEdit(){},endTyping(){},renderTypography(){},notify(){},renderList(){},renderOverlays(){},renderSelection(){},change(fn){undo.push(JSON.stringify(state));fn();}};
 const source=app.slice(app.indexOf('function select('),app.indexOf('function quoteSettings('));runInNewContext(source+'\nthis.inherit=inheritParagraphFormat;this.copy=copyParagraphFormat;this.paste=pasteParagraphFormat;this.choose=select;',env);
 return {env,state,undo};
}

test('new paragraphs inherit the selected text format, or the last paragraph when none is selected',()=>{
 const source=structuredClone(base),last={...base,id:'b2',size:18,w:250},h=setup([source,last]);
 const fresh={...base,id:'b3',text:'',runs:[],x:150,y:300,group:null};h.env.inherit(fresh);
 assert.deepEqual(paragraphFormat(h.state,fresh,'png'),paragraphFormat(h.state,source,'png'));assert.equal(fresh.text,'');assert.deepEqual(fresh.runs,[]);assert.equal(fresh.x,150);assert.equal(fresh.y,300);assert.equal(fresh.group,null);
 h.env.selected.clear();h.env.inherit(fresh);assert.equal(fresh.size,18);assert.equal(fresh.w,250);
});

test('HTML inheritance stays within the current tab and captures the visible HTML format',()=>{
 const source={...base,htmlStyle:{size:31,color:'#aabbcc',lineHeight:1.4}},other={...base,id:'b2',htmlTabId:'t2',htmlStyle:{size:55}},h=setup([source,other]);h.env.editorMode='html';h.env.selected=new Set(['b2']);
 const fresh={...base,id:'b3',text:'',htmlStyle:{size:16},w:240,x:140},before=structuredClone(fresh);h.env.inherit(fresh);
 assert.equal(htmlBlock(h.state,fresh).size,31);assert.equal(htmlBlock(h.state,fresh).color,'#aabbcc');
 const {htmlStyle,...png}=fresh,{htmlStyle:previous,...oldPNG}=before;assert.deepEqual(png,oldPNG);assert.equal(source.htmlStyle.size,31);
 h.env.activeHTMLTab='empty';const empty=structuredClone(fresh);h.env.inherit(fresh);assert.deepEqual(fresh,empty);
});

test('one copied format pastes onto multiple targets in one undo step while preserving their content and positions',()=>{
 const source=structuredClone(base),plain={...base,id:'b2',text:'다른 글',runs:[{text:'다른 글',bold:true}],x:190,y:260,size:16},chat={...base,id:'b3',text:'대화',presentation:'chat',messageSide:'right',messagePinned:false,x:650,y:360,size:15},line={...base,id:'b4',type:'line'},h=setup([source,plain,chat,line]);
 h.env.copy();source.size=42;h.env.selected=new Set(['b2','b3','b4']);const before=structuredClone(h.state);h.env.paste();
 assert.equal(h.undo.length,1);assert.deepEqual(JSON.parse(h.undo[0]),before);
 assert.equal(plain.size,24);assert.equal(chat.size,24);assert.equal(chat.messageColor,'#112233');assert.equal(chat.messageBox,'#ddeeff');assert.equal(chat.messageOpacity,35);assert.equal(chat.w,150);
 assert.equal(chat.messageSide,'right');assert.equal(chat.messagePinned,false);assert.equal(line.size,base.size);
 for(const b of [plain,chat])for(const key of ['text','runs','x','y','auto','htmlTabId'])assert.deepEqual(b[key],before.blocks.find(x=>x.id===b.id)[key]);
 h.env.selected=new Set(['b2','b3']);const saved=h.env.copiedParagraphFormats.png;h.env.copy();assert.equal(h.env.copiedParagraphFormats.png,saved);
});

test('Shift selection and multi-paste work in HTML without changing PNG settings or another tab',()=>{
 const source={...base,htmlStyle:{font:'pretendard',size:28,messageBox:'#445566'}},target={...base,id:'b2',presentation:'chat',messageSide:'right',htmlStyle:{size:16}},other={...base,id:'b3',htmlTabId:'t2'},h=setup([source,target,other]);h.env.editorMode='html';h.env.copy();
 h.env.choose('b2',true);assert.equal(h.env.selected.size,2);const before=structuredClone(h.state);h.env.paste();
 assert.equal(target.htmlStyle.size,28);assert.equal(target.htmlStyle.font,'pretendard');assert.equal(target.messageSide,'right');
 for(const b of [source,target]){const {htmlStyle,...png}=b,{htmlStyle:oldStyle,...oldPNG}=before.blocks.find(x=>x.id===b.id);assert.deepEqual(png,oldPNG);}
 assert.deepEqual(other,before.blocks[2]);assert.equal(h.env.copiedParagraphFormats.png,null);assert.ok(h.env.copiedParagraphFormats.html);
 h.env.editorMode='png';const unchanged=structuredClone(h.state);h.env.paste();assert.deepEqual(h.state,unchanged);
});
