const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(process.execPath,[path.join(__dirname,'check-extension.cjs')],{stdio:'inherit',env:{...process.env,STEADY_SKIP_PUBLIC:'1'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
