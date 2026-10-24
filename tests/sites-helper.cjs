const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const sites=[{name:'wikipedia',url:'https://en.wikipedia.org/wiki/Main_Page'},{name:'github',url:'https://github.com/microsoft/vscode'},{name:'mdn',url:'https://developer.mozilla.org/en-US/'}];
async function start(){
 const source=path.join(project,'extension'),harness=path.join(__dirname,'.generated-sites-harness');
 fs.mkdirSync(harness,{recursive:true});for(const f of fs.readdirSync(source))fs.copyFileSync(path.join(source,f),path.join(harness,f));
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
 assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);assert.equal(manifest.host_permissions,undefined);
 manifest.host_permissions=sites.map(s=>new URL(s.url).origin+'/*');fs.writeFileSync(path.join(harness,'manifest.json'),JSON.stringify(manifest,null,2));
 const ctx=await chromium.launchPersistentContext('',{...(process.env.STEADY_BROWSER_EXECUTABLE ? {executablePath:process.env.STEADY_BROWSER_EXECUTABLE} : {channel:'chromium'}),headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${harness}`,`--load-extension=${harness}`]});
 let [worker]=ctx.serviceWorkers();if(!worker)worker=await ctx.waitForEvent('serviceworker');
 await worker.evaluate(()=>chrome.storage.local.set({preferences:{singleKeys:true,liveHighlight:true,nearKey:'k',listKey:'l',radius:160}}));
 async function command(page,action){return worker.evaluate(async({url,action})=>{const tab=(await chrome.tabs.query({})).find(t=>t.url===url);return control(tab.id,action);},{url:page.url(),action});}
 return {ctx,worker,command,version:manifest.version};
}
module.exports={start,sites,project};
if(require.main===module)(async()=>{
 const {ctx,command,version}=await start(),results=[];
 try{for(const site of sites){const page=await ctx.newPage();page.setDefaultTimeout(8000);const result={...site,version};
  try{await page.goto(site.url,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('h1').first().waitFor({state:'attached',timeout:15000});
   result.title=await page.title();result.controls=await page.locator('button,summary,[role="button"],input[type="checkbox"],input[type="radio"]').evaluateAll(es=>es.filter(e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&e.getBoundingClientRect().width>0).map(e=>({tag:e.tagName,id:e.id,role:e.getAttribute('role'),label:e.getAttribute('aria-label')||e.innerText?.trim().slice(0,120)||e.title,type:e.getAttribute('type'),expanded:e.getAttribute('aria-expanded'),shadowHost:e.getRootNode().host?.tagName,html:e.outerHTML.slice(0,450),inView:e.getBoundingClientRect().top<innerHeight&&e.getBoundingClientRect().bottom>0})).slice(0,90));
   result.enabled=await command(page,'enable');await command(page,'list');const ui=page.locator('[data-steadyselect-root]');result.count=await ui.locator('.count').textContent();result.actions=await ui.locator('.choice .label').allTextContents();await page.screenshot({path:path.join(project,`sites-before-${site.name}.png`)});
  }catch(e){result.error=e.message;}results.push(result);console.log(JSON.stringify(result));await page.close();
 }}finally{fs.writeFileSync(path.join(project,'sites-initial-inspection.json'),JSON.stringify(results,null,2));await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
