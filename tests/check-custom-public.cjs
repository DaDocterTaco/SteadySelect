const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..'),source=path.join(project,'extension'),harness=path.join(__dirname,'.generated-harness');
fs.mkdirSync(harness,{recursive:true});for(const file of fs.readdirSync(source))fs.copyFileSync(path.join(source,file),path.join(harness,file));
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);assert.equal(manifest.host_permissions,undefined);
manifest.host_permissions=['https://www.w3.org/*'];fs.writeFileSync(path.join(harness,'manifest.json'),JSON.stringify(manifest,null,2));
(async()=>{
 const ctx=await chromium.launchPersistentContext('',{...(process.env.STEADY_BROWSER_EXECUTABLE ? {executablePath:process.env.STEADY_BROWSER_EXECUTABLE} : {channel:'chromium'}),headless:true,viewport:{width:1280,height:1000},args:[`--disable-extensions-except=${harness}`,`--load-extension=${harness}`]});
 const report={date:new Date().toISOString(),version:manifest.version,url:'https://www.w3.org/WAI/ARIA/apg/patterns/button/examples/button/',passed:[],scope:'Installed isolated Chromium test copy with access only to w3.org. Original W3C click handlers retained; window.print replaced with a counter to prevent a print job. No user profile used.'};
 try{
  let [worker]=ctx.serviceWorkers();if(!worker)worker=await ctx.waitForEvent('serviceworker');
  const page=await ctx.newPage();page.setDefaultTimeout(8000);await page.goto(report.url,{waitUntil:'load',timeout:30000});await page.evaluate(()=>document.fonts.ready);
  await worker.evaluate(()=>chrome.storage.local.set({preferences:{singleKeys:true,liveHighlight:true,nearKey:'k',listKey:'l',radius:160}}));
  const enabled=await worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).find(t=>t.url===url);return control(tab.id,'enable');},page.url());assert.equal(enabled.enabled,true);
  await page.evaluate(()=>{window.__steadyPrintCalls=0;window.print=()=>{window.__steadyPrintCalls++;};});
  const ui=page.locator('[data-steadyselect-root]'),dialog=ui.locator('dialog'),primary=dialog.locator('.primary'),search=dialog.locator('input');
  async function near(selector){await page.locator(selector).hover();await ui.locator('.badge').first().waitFor({state:'visible'});await page.keyboard.press('k');await primary.waitFor();}
  const pass=name=>{report.passed.push(name);console.log('PASS '+name);};
  await near('#toggle');assert.equal(await primary.textContent(),'Mute');assert.equal(await page.locator('#toggle').getAttribute('aria-pressed'),'false');assert.match(await dialog.locator('.context').textContent(),/Not pressed/);
  const bounds=await dialog.locator('.panel').boundingBox();await page.mouse.move(10,10);assert.deepEqual(await dialog.locator('.panel').boundingBox(),bounds);assert.equal(await primary.textContent(),'Mute');
  await page.screenshot({path:path.join(project,'custom-public-mute.png')});pass('W3C custom Mute is highlighted and enlarged without activation; selection stays fixed');
  await page.keyboard.press('Enter');const toggleState=await page.locator('#toggle').getAttribute('aria-pressed');if(toggleState!=='true'){await page.screenshot({path:path.join(project,'custom-public-failure.png')});console.log('DIAGNOSTIC '+await ui.textContent());}assert.equal(toggleState,'true');pass('Enter invokes W3C Mute click handler and changes aria-pressed to true');
  await page.waitForTimeout(450);await near('#toggle');assert.match(await dialog.locator('.context').textContent(),/Pressed/);await primary.click();assert.equal(await page.locator('#toggle').getAttribute('aria-pressed'),'false');pass('Enlarged mouse button toggles W3C Mute off again');
  await page.waitForTimeout(450);await near('#action');assert.equal(await primary.textContent(),'Print Page');assert.equal(await page.evaluate(()=>window.__steadyPrintCalls),0);assert.match(await dialog.locator('.context').textContent(),/Example|Button/);
  await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.equal(await page.evaluate(()=>window.__steadyPrintCalls),1);pass('W3C Print Page handler calls window.print exactly once, including held Enter');
  await page.waitForTimeout(450);await page.keyboard.press('l');await search.fill('Mute');assert.equal(await dialog.locator('.choice').count(),1);assert.match(await dialog.locator('.choice').textContent(),/Not pressed/);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#toggle').getAttribute('aria-pressed'),'true');pass('L search finds custom Mute once and keyboard list activation works');
  await page.waitForTimeout(450);await page.keyboard.press('l');await search.fill('Print Page');assert.equal(await dialog.locator('.choice').count(),1);await dialog.locator('.choice').click();assert.equal(await page.evaluate(()=>window.__steadyPrintCalls),2);pass('L search finds custom Print Page once and enlarged list activation invokes its handler');
  await page.waitForTimeout(450);await near('#toggle');await page.keyboard.press('Escape');assert.equal(await page.locator('#toggle').getAttribute('aria-pressed'),'true');assert.equal(await dialog.isVisible(),false);pass('Escape cancels a custom toggle without changing its state');
  // Restore the public demo toggle's starting state.
  await near('#toggle');await primary.click();assert.equal(await page.locator('#toggle').getAttribute('aria-pressed'),'false');
  await page.waitForTimeout(450);await page.keyboard.press('l');await search.fill('Print Page');await page.screenshot({path:path.join(project,'custom-public-list.png')});
  report.result='passed';
 }catch(error){report.result='failed';report.error=error.message;throw error;}
 finally{fs.writeFileSync(path.join(project,'custom-public-check-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
