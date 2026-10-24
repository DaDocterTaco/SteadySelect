const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'release','SteadySelect-v0.1.5');
fs.mkdirSync(out,{recursive:true});
for(const name of ['extension','demo','docs'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
for(const name of ['README.md','CHANGELOG.md','PRIVACY.md','CONTRIBUTING.md','LICENSE'])fs.copyFileSync(path.join(root,name),path.join(out,name));
console.log('Installable release folder: '+out);
console.log('Load its extension folder in Chrome. No build step is required.');
