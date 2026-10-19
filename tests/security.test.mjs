import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the page restricts scripts and outbound connections while retaining a scriptless HTML preview',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const meta=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
 assert.ok(meta);assert.ok(html.indexOf(meta[0])<html.indexOf('<script'));
 const directives=Object.fromEntries(meta[1].split(';').map(s=>s.trim().split(/\s+/)).map(([key,...values])=>[key,values]));
 assert.deepEqual(directives['script-src'],["'self'"]);
 for(const name of ['connect-src','object-src','base-uri','form-action'])assert.deepEqual(directives[name],["'none'"]);
 const preview=html.match(/<iframe\b[^>]+id="htmlPreview"[^>]+>/)[0];
 assert.match(preview,/sandbox="allow-same-origin"/);assert.doesNotMatch(preview,/allow-scripts/);
});

test('external GitHub font URLs are pinned to a release or immutable commit',()=>{
 const css=readFileSync(new URL('../dist/fonts.css',import.meta.url),'utf8');
 const urls=[...css.matchAll(/https:\/\/cdn\.jsdelivr\.net\/gh\/[^']+/g)].map(m=>m[0]);
 assert.equal(urls.length,8);
 for(const url of urls)assert.match(url,/\/(?:KoPubBatang|KoPubDotum|mona-font|pretendard)@(?:[a-f0-9]{40}|v\d+\.\d+\.\d+)\//);
});
