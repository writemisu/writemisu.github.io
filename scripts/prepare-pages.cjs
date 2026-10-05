const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const source=path.resolve(__dirname,'../dist'),output=path.resolve(__dirname,'../artifacts/pages');
const files=fs.readdirSync(source).filter(name=>/\.(html|css|js)$/.test(name)).sort();
const hash=createHash('sha256');
for(const name of files)hash.update(name).update(fs.readFileSync(path.join(source,name)));
const version=hash.digest('hex').slice(0,16);
fs.cpSync(source,output,{recursive:true});
for(const name of files){
 let text=fs.readFileSync(path.join(source,name),'utf8');
 if(name.endsWith('.html'))text=text.replace(/((?:src|href)=["'])([^"']+\.(?:js|css))(["'])/g,`$1$2?v=${version}$3`);
 if(name.endsWith('.js'))text=text.replace(/(\b(?:from|import)\s*["'])(\.\/[^"']+\.js)(["'])/g,`$1$2?v=${version}$3`);
 fs.writeFileSync(path.join(output,name),text);
}
console.log(`Pages assets: ${version}`);
