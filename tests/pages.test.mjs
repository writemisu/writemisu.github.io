import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('deployment versions every browser entry and transitive module without altering source',()=>{
 const root=new URL('../',import.meta.url),source=new URL('dist/',root),output=new URL('artifacts/pages/',root);
 const files=readdirSync(source).filter(name=>/\.(html|css|js)$/.test(name)),before=new Map(files.map(name=>[name,readFileSync(new URL(name,source),'utf8')]));
 execFileSync(process.execPath,['scripts/prepare-pages.cjs'],{cwd:fileURLToPath(root)});
 const html=readFileSync(new URL('index.html',output),'utf8'),assets=Array.from(html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g),m=>m[1]);
 assert.equal(assets.length,3);const versions=new Set();
 for(const asset of assets){assert.match(asset,/\?v=[a-f0-9]{16}$/);versions.add(asset.split('?v=')[1]);}
 let imports=0;
 for(const name of files){
  assert.equal(readFileSync(new URL(name,source),'utf8'),before.get(name));
  if(!name.endsWith('.js'))continue;
  const text=readFileSync(new URL(name,output),'utf8');
  for(const match of text.matchAll(/(?:from|import)\s*["'](\.\/[^"']+)["']/g)){
   const [module,query]=match[1].split('?');assert.match(query||'',/^v=[a-f0-9]{16}$/);versions.add(query.slice(2));
   assert.ok(readFileSync(new URL(module,output)).length);imports++;
  }
 }
 assert.ok(imports>=10);assert.equal(versions.size,1);
 assert.deepEqual(readFileSync(new URL('fonts/Freesentation-Regular.woff2',output)),readFileSync(new URL('fonts/Freesentation-Regular.woff2',source)));
});
