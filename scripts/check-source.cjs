const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));
assert.equal(manifest.version,'0.1.5');assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);assert.equal(manifest.host_permissions,undefined);
for(const dir of ['extension','demo'])for(const file of fs.readdirSync(path.join(root,dir))){
 if(!file.endsWith('.js'))continue;
 const result=spawnSync(process.execPath,['--check',path.join(root,dir,file)],{stdio:'inherit'});
 assert.equal(result.status,0,file+' syntax check failed');
}
console.log('Production permissions and JavaScript syntax checks passed.');
