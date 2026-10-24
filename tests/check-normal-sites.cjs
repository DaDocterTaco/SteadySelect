const {start,sites,project}=require('./sites-helper.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {ctx,command,version}=await start(),passed=[],failures=[],siteCounts=[];
 try{for(const site of sites){
  const p=await ctx.newPage();p.setDefaultTimeout(10000);
  const ui=p.locator('[data-steadyselect-root]'),dialog=ui.locator('dialog'),primary=ui.locator('.primary');
  const check=async(name,fn)=>{try{await fn();passed.push(site.name+': '+name);console.log('PASS '+site.name+': '+name);}catch(e){failures.push({site:site.name,name,error:e.message});console.log('FAIL '+site.name+': '+name+' '+e.message.slice(0,200));await p.screenshot({path:path.join(project,`sites-failure-${site.name}.png`)}).catch(()=>{});throw e;}};
  const near=async(target,label,key=true)=>{await target.scrollIntoViewIfNeeded();const b=await target.boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);if(key)await p.keyboard.press('k');else assert.equal((await command(p,'near')).mode,'near');await primary.waitFor();assert.equal(await primary.textContent(),label);};
  const activate=async()=>{await p.waitForTimeout(450);await primary.click();await dialog.waitFor({state:'hidden'});assert.equal(await ui.locator('.note').isVisible(),false);};
  const list=async(query)=>{assert.equal((await command(p,'list')).mode,'list');await ui.locator('.search').fill(query);};
  try{
   await p.goto(site.url,{waitUntil:'load',timeout:35000});assert.equal((await command(p,'enable')).enabled,true);
   await check('large searchable action list loads and Show more expands it',async()=>{
    await list('');await dialog.getByRole('button',{name:'Whole page',exact:true}).click();const count=await ui.locator('.count').textContent();siteCounts.push({site:site.name,count});assert.ok(parseInt(count)>50);assert.equal(await ui.locator('.choice').count(),20);await ui.getByRole('button',{name:'Show more',exact:true}).click();assert.equal(await ui.locator('.choice').count(),40);await p.keyboard.press('Escape');
   });
   if(site.name==='wikipedia'){
    const menu=p.locator('#vector-main-menu-dropdown-checkbox'),menuLabel=p.locator('#vector-main-menu-dropdown-label');
    await check('transparent native menu input is highlighted through its visible label; K cancels safely',async()=>{
     await near(menuLabel,'Main menu');assert.equal(await menu.isChecked(),false);assert.equal(await ui.locator('dialog .ring').isVisible(),true);await p.screenshot({path:path.join(project,'sites-wikipedia-near.png')});await p.keyboard.press('Escape');assert.equal(await menu.isChecked(),false);
    });
    await check('enlarged Main menu button opens the actual menu; a focus-dismissed selection is cancelled safely',async()=>{
     await near(menuLabel,'Main menu');await activate();assert.equal(await menu.isChecked(),true);await near(menuLabel,'Main menu');await p.waitForFunction(()=>document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.primary').disabled);assert.equal(await menu.isChecked(),false);await p.keyboard.press('Enter');assert.equal(await menu.isChecked(),false);await p.keyboard.press('Escape');
    });
    await check('styled text-size radio activates through its visible Large label',async()=>{
     const large=p.locator('label[for="skin-client-pref-vector-feature-custom-font-size-value-2"]');await large.waitFor();await near(large,'Large');await activate();assert.equal(await p.locator('#skin-client-pref-vector-feature-custom-font-size-value-2').isChecked(),true);
     await p.waitForTimeout(450);await p.locator('label[for="skin-client-pref-vector-feature-custom-font-size-value-1"]').click();assert.equal(await p.locator('#skin-client-pref-vector-feature-custom-font-size-value-1').isChecked(),true);
    });
    await check('Wikipedia search field accepts K and L without opening assistance',async()=>{
     const input=p.locator('#searchInput');await input.fill('');await input.pressSequentially('kl');assert.equal(await input.inputValue(),'kl');assert.equal(await dialog.isVisible(),false);await input.fill('');await p.keyboard.press('Escape');
    });
   }
   if(site.name==='github'){
    const code=p.locator('button').filter({hasText:/^Code$/}).first();
    await check('Code menu opens from the enlarged action',async()=>{
     await near(code,'Code');await activate();await p.getByRole('list',{name:'Remote URL selector'}).waitFor();assert.equal(await code.getAttribute('aria-expanded'),'true');
    });
    await check('nested clone-method button changes the actual selected option',async()=>{
     const cli=p.getByRole('list',{name:'Remote URL selector'}).getByRole('button',{name:'Clone with GitHub CLI',exact:true});await near(cli,'Clone with GitHub CLI',false);await p.screenshot({path:path.join(project,'sites-github-near.png')});await activate();assert.equal(await cli.getAttribute('aria-pressed'),'true');
     const https=p.getByRole('list',{name:'Remote URL selector'}).getByRole('button',{name:'Clone with HTTPS',exact:true});await near(https,'Clone with HTTPS',false);await activate();assert.equal(await https.getAttribute('aria-pressed'),'true');await p.keyboard.press('Escape');
    });
    await check('list search excludes its own assistance controls and finds a repository action once',async()=>{
     await list('Clone with GitHub CLI');assert.equal(await ui.locator('.choice').count(),0);await ui.locator('.search').fill('Open commit details');assert.equal(await ui.locator('.choice').count(),1);await ui.locator('.search').fill('Settings & help');assert.equal(await ui.locator('.choice').count(),0);await p.keyboard.press('Escape');
    });
   }
   if(site.name==='mdn'){
    const html=p.locator('mdn-dropdown').getByRole('button',{name:'HTML',exact:true}),theme=p.locator('mdn-color-theme').getByRole('button',{name:'Switch color theme',exact:true});
    await check('HTML navigation stays open after clicking the enlarged button',async()=>{
     await near(html,'HTML');await activate();assert.equal(await html.getAttribute('aria-expanded'),'true');await p.waitForTimeout(450);await html.click();assert.equal(await html.getAttribute('aria-expanded'),'false');
    });
    await check('shadow-root theme menu opens and its nested Dark option changes the site',async()=>{
     await near(theme,'Switch color theme');await p.screenshot({path:path.join(project,'sites-mdn-near.png')});await activate();assert.equal(await theme.getAttribute('aria-expanded'),'true');
     const dark=p.locator('mdn-color-theme').getByRole('button',{name:'Dark',exact:true});await near(dark,'Dark');await activate();assert.equal(await theme.getAttribute('data-mode'),'dark');
     await near(theme,'Switch color theme');await activate();const os=p.locator('mdn-color-theme').getByRole('button',{name:'OS default',exact:true});await near(os,'OS default');await activate();assert.equal(await theme.getAttribute('data-mode'),'light dark');
    });
    await check('L finds shadow controls once and resolves a component-scoped language label',async()=>{
     await list('Switch color theme');assert.equal(await ui.locator('.choice').count(),1);await ui.locator('.search').fill('English (US)');assert.equal(await ui.locator('.choice').count(),1);await p.keyboard.press('Escape');
    });
    await check('shadow-root Search opens the actual search dialog; typing K/L is preserved',async()=>{
     const search=p.locator('mdn-search-button').getByRole('button',{name:'Search the site',exact:true});await near(search,'Search the site');await activate();
     const input=p.locator('input:visible').first();await input.fill('');await input.pressSequentially('kl');assert.equal(await input.inputValue(),'kl');assert.equal(await dialog.isVisible(),false);await input.fill('');await p.keyboard.press('Escape');
     await near(theme,'Switch color theme');await p.keyboard.press('Escape');
    });
   }
  }catch(e){if(!failures.some(f=>f.site===site.name))failures.push({site:site.name,name:'page setup',error:e.message});}
  await p.close();
 }}finally{
  const report={testedAt:new Date().toISOString(),version,browser:'Isolated Chromium '+ctx.browser().version()+', unsigned-in temporary profile',sites,siteCounts,passed,failures,knownLimitations:['Wikipedia closes an already-open Main menu when assistance takes focus; the changed checkbox state invalidates the selection, so SteadySelect cancels it safely.','Some website controls focus a text field; use Alt+Shift+K/L or the on-page controls there because plain K/L intentionally preserve typing.'],scope:'Actual public-page controls and handlers, with a test-only copy granted access to these three origins. Production remains activeTab/scripting/storage only. No user accounts, submissions, repository changes, print jobs, or purchases.'};
  fs.writeFileSync(path.join(project,'normal-sites-check-results.json'),JSON.stringify(report,null,2));await ctx.close();console.log(JSON.stringify({version,passed:passed.length,failures},null,2));if(failures.length)process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1});
