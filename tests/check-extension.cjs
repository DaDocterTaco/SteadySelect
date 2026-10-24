const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..'),source=path.join(project,'extension'),harness=path.join(__dirname,'.generated-harness');
fs.mkdirSync(path.join(project,'usability'),{recursive:true});
fs.mkdirSync(harness,{recursive:true});for(const name of fs.readdirSync(source))fs.copyFileSync(path.join(source,name),path.join(harness,name));
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);assert.equal(manifest.host_permissions,undefined);
manifest.host_permissions=['http://127.0.0.1/*','https://example.com/*','https://www.w3.org/*'];
fs.writeFileSync(path.join(harness,'manifest.json'),JSON.stringify(manifest,null,2));
const server=http.createServer((req,res)=>{const name=req.url.startsWith('/demo.js')?'demo.js':'index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(project,'demo',name)));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const ctx=await chromium.launchPersistentContext('',{...(process.env.STEADY_BROWSER_EXECUTABLE ? {executablePath:process.env.STEADY_BROWSER_EXECUTABLE} : {channel:'chromium'}),headless:true,viewport:{width:1280,height:1000},args:[`--disable-extensions-except=${harness}`,`--load-extension=${harness}`]});
 const passed=[],errors=[],publicChecks=[];
 try{
  let [worker]=ctx.serviceWorkers();if(!worker)worker=await ctx.waitForEvent('serviceworker');
  const extensionId=new URL(worker.url()).host;
  const page=await ctx.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}/`;
  async function tabId(){return worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url)?.id,page.url());}
  async function command(action){const id=await tabId();return worker.evaluate(({id,action})=>control(id,action),{id,action});}
  async function preferences(p){await worker.evaluate(p=>chrome.storage.local.set({preferences:{liveHighlight:true,singleKeys:true,nearKey:'k',listKey:'l',textScale:1,largeControls:false,radius:160,...p}}),p);}
  const ui=page.locator('[data-steadyselect-root]'),dialog=ui.locator('dialog'),primary=dialog.locator('.primary');
  const count=()=>page.locator('#count').textContent();
  async function fresh(){await worker.evaluate(()=>chrome.storage.local.remove('toolbarLayout'));await page.goto(url);await preferences({});const r=await command('enable');assert.equal(r.enabled,true,JSON.stringify(r));await ui.waitFor();}
  async function near(id='#start-basics'){await page.locator(id).hover();await page.keyboard.press('k');await dialog.waitFor({state:'visible'});}
  async function test(name,fn){if(process.env.STEADY_TEST_FILTER&&!name.includes(process.env.STEADY_TEST_FILTER))return;await fresh();await fn();passed.push(name);console.log('PASS '+name);}
  async function customControls(){
   await page.evaluate(()=>{
    const group=document.createElement('section');group.id='custom-fixture';
    group.innerHTML='<h2>Custom buttons</h2><div id="custom-command" role="button" tabindex="0"><span>Print practice</span></div><a id="custom-toggle" role="button" tabindex="0" aria-pressed="false">Mute practice</a><div role="button" aria-disabled="true" tabindex="0">Disabled custom action</div><div aria-disabled="true"><div role="button" tabindex="0">Disabled group action</div></div><div role="button" hidden>Hidden custom action</div><div role="button" tabindex="0" id="unlabeled-custom"></div><div tabindex="0" id="unmarked-custom">Unmarked click handler</div><button role="button" id="native-role-button">Native role action</button>';
    group.querySelectorAll('[role="button"]').forEach(e=>{e.style.cssText='padding:10px;margin:10px;min-height:20px;border:1px solid;display:inline-block';});
    group.querySelector('[hidden]').style.display='none';
    document.querySelector('main').prepend(group);
    document.getElementById('custom-command').addEventListener('click',()=>record('Custom command activated'));
    const toggle=document.getElementById('custom-toggle');toggle.addEventListener('click',()=>{toggle.setAttribute('aria-pressed',toggle.getAttribute('aria-pressed')==='true'?'false':'true');record('Custom toggle activated');});
    group.querySelectorAll('#custom-command,#custom-toggle').forEach(e=>e.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();e.click();}}));
    document.getElementById('unmarked-custom').addEventListener('click',()=>record('Unmarked handler'));
   });
  }
  async function componentControls(){
   await page.evaluate(()=>{
    const host=document.createElement('section');host.id='component-fixture';host.setAttribute('data-steady-context','Component settings');
    const root=host.attachShadow({mode:'open'});
    root.innerHTML='<style>button,input{font:18px system-ui;margin:10px;padding:12px} :host{display:block}</style><span id="component-name">Component action</span><button id="component-action" aria-labelledby="component-name"><span>Icon</span></button><input id="component-typing" aria-label="Component typing"><div id="nested-host"></div><slot></slot>';
    const nested=root.querySelector('#nested-host').attachShadow({mode:'open'});nested.innerHTML='<button id="nested-action" style="padding:12px" aria-pressed="false">Nested toggle</button>';
    const nestedAction=nested.querySelector('button');nestedAction.onclick=()=>{nestedAction.setAttribute('aria-pressed',nestedAction.getAttribute('aria-pressed')==='true'?'false':'true');record('Nested action');};
    root.querySelector('#component-action').onclick=()=>record('Component action');
    host.innerHTML='<button id="slotted-action">Slotted action</button>';host.querySelector('button').onclick=()=>record('Slotted action');
    document.querySelector('main').prepend(host);
    const duplicate=document.createElement('span');duplicate.id='component-name';duplicate.textContent='Wrong document label';document.body.append(duplicate);
   });
  }
  async function styledControls(){
   await page.evaluate(()=>{
    const section=document.createElement('section');section.id='styled-fixture';section.setAttribute('data-steady-context','Display settings');
    section.innerHTML='<input id="styled-check" type="checkbox" style="opacity:0;position:absolute;width:20px;height:20px"><label for="styled-check" style="display:inline-block;padding:20px;border:1px solid">Styled reminders</label><input id="styled-disabled" type="checkbox" disabled style="opacity:0"><label for="styled-disabled">Disabled styled action</label><input id="styled-hidden" type="checkbox" hidden><label for="styled-hidden">Hidden styled action</label>';
    document.querySelector('main').prepend(section);section.querySelector('#styled-check').onclick=()=>record('Styled checkbox');
   });
  }
  await test('Installed worker injects once; live preview identifies the future K target without activating',async()=>{
   await page.locator('#start-basics').hover();await ui.locator(':scope > .ring').waitFor({state:'visible'}).catch(()=>{});
   const text=await ui.locator('.badge').first().textContent();assert.match(text,/K selects/);assert.equal(await count(),'0 activations');
   await command('enable');assert.equal(await page.locator('[data-steadyselect-root]').count(),1);
   await page.keyboard.press('k');assert.equal(await primary.textContent(),'Start');assert.match(await dialog.locator('.context').textContent(),/Getting started/);
   assert.equal(await count(),'0 activations');
  });
  await test('Live preview can turn off; K still shows the selected outline and deliberate activation',async()=>{
   await preferences({liveHighlight:false});await near();assert.equal(await dialog.locator('.ring').isVisible(),true);
   const box=await dialog.locator('.panel').boundingBox();await page.mouse.move(20,20);assert.deepEqual(await dialog.locator('.panel').boundingBox(),box);
   await page.keyboard.press('Enter');assert.equal(await count(),'1 activations');assert.equal(await page.locator('#status-basics').textContent(),'In progress');
  });
  await test('Escape cancels and restores focus without activation',async()=>{
   await page.locator('#details-basics').focus();await near();await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await count(),'0 activations');assert.equal(await page.evaluate(()=>document.activeElement.id),'details-basics');
  });
  await test('L searches contextual repeated labels; arrows and Enter activate only the chosen row',async()=>{
   await page.locator('h1').click();await page.keyboard.press('l');const search=dialog.locator('input');await search.fill('Writing clear updates');assert.equal(await dialog.locator('.choice').count(),2);
   await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await count(),'1 activations');assert.match(await page.locator('#result').textContent(),/Details: Writing clear updates/);
  });
  await test('Page typing and search typing preserve K and L',async()=>{
   await page.locator('#typing').fill('');await page.locator('#typing').pressSequentially('kl');assert.equal(await page.locator('#typing').inputValue(),'kl');assert.equal(await dialog.isVisible(),false);
   await command('list');await dialog.locator('input').fill('kl');assert.equal(await dialog.locator('input').inputValue(),'kl');assert.equal(await dialog.locator('.choice').count(),0);
  });
  for(const [name,mutation] of [
   ['removed',()=>document.getElementById('start-basics').remove()],
   ['renamed',()=>document.getElementById('start-basics').textContent='Different action'],
   ['disabled',()=>document.getElementById('start-basics').disabled=true],
   ['replaced',()=>{const b=document.getElementById('start-basics');b.replaceWith(b.cloneNode(true));}],
   ['context changed',()=>document.querySelector('tbody th').textContent='Different lesson']
  ]) await test('Stale '+name+' target cannot activate',async()=>{await near();await page.evaluate(mutation);await primary.waitFor();assert.equal(await primary.isDisabled(),true);await page.keyboard.press('Enter');assert.equal(await count(),'0 activations');});
  await test('Unrelated changes preserve the selection',async()=>{await near();await page.evaluate(()=>document.querySelector('h1').textContent='Course desk · updated');assert.equal(await primary.isDisabled(),false);await primary.click();assert.equal(await count(),'1 activations');});
  await test('Focus handlers cannot retarget an armed control',async()=>{
   await page.evaluate(()=>document.getElementById('start-basics').addEventListener('focus',e=>{e.target.textContent='Different action';}));await near();await primary.click();assert.equal(await count(),'0 activations');
  });
  await test('Native checkbox and form actions work once',async()=>{
   await near('#reminders');await primary.click();assert.equal(await page.locator('#reminders').isChecked(),true);assert.equal(await count(),'1 activations');
   await page.waitForTimeout(450);await near('#submit-demo');await primary.click();assert.equal(await count(),'2 activations');assert.match(await page.locator('#result').textContent(),/Nickname saved/);
  });
  await test('Offscreen list action reveals first and requires a second confirmation',async()=>{
   await command('list');await dialog.getByRole('button',{name:'Whole page',exact:true}).click();await dialog.locator('input').fill('advanced');await dialog.locator('.choice').click();assert.equal(await count(),'0 activations');await primary.waitFor();assert.equal(await primary.textContent(),'Start advanced lesson');await primary.click();assert.equal(await count(),'1 activations');
  });
  await test('Held Enter cannot trigger the original twice',async()=>{
   await near();await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.equal(await count(),'1 activations');
  });
  await test('Disabled, hidden and covered controls are not nearby actions',async()=>{
   await page.evaluate(()=>{const t=document.getElementById('start-basics'),r=t.getBoundingClientRect(),cover=document.createElement('div');cover.style.cssText=`position:fixed;left:${r.left-2}px;top:${r.top-2}px;width:${r.width+4}px;height:${r.height+4}px;background:black;z-index:99`;document.body.append(cover);});
   const r=await page.locator('#start-basics').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.keyboard.press('k');assert.notEqual(await primary.getAttribute('aria-label'),'Start — Getting started');
   await page.keyboard.press('Escape');await command('list');const text=await dialog.textContent();assert.ok(!text.includes('Unavailable lesson')&&!text.includes('Hidden action'));
  });
  await test('Remapped single keys, extra-large sizing and disable/re-enable work',async()=>{
   await preferences({nearKey:'n',listKey:'m',textScale:1.5,largeControls:true});await page.locator('#start-basics').hover();await page.keyboard.press('k');assert.equal(await dialog.isVisible(),false);
   await page.keyboard.press('n');assert.equal(await primary.evaluate(e=>getComputedStyle(e).fontSize),'42px');await page.keyboard.press('Escape');
   await command('disable');assert.equal(await page.locator('[data-steadyselect-root]').count(),0);await command('enable');assert.equal(await page.locator('[data-steadyselect-root]').count(),1);
  });
  await test('Popup saves the live toggle and rejects duplicate shortcuts',async()=>{
   const popup=await ctx.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);await popup.locator('#live').uncheck();
   await popup.waitForFunction(()=>document.getElementById('saved').textContent==='Settings saved.');
   assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('preferences')).preferences.liveHighlight),false);
   await popup.getByText('Change shortcuts & distance',{exact:true}).click();await popup.locator('#nearKey').fill('Q');await popup.locator('#listKey').fill('Q');await popup.locator('#save').click();assert.match(await popup.locator('#saved').textContent(),/different/);await popup.close();
  });
  await test('Custom div button previews its nested label and activates once with held Enter',async()=>{
   await customControls();await page.locator('#custom-command span').hover();await ui.locator('.badge').first().waitFor({state:'visible'});assert.match(await ui.locator('.badge').first().textContent(),/K selects/);
   await page.keyboard.press('k');await primary.waitFor();assert.equal(await primary.textContent(),'Print practice');assert.equal(await count(),'0 activations');
   await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.equal(await count(),'1 activations');assert.match(await page.locator('#result').textContent(),/Custom command/);
  });
  await test('Href-less custom toggle activates once in each direction and displays pressed state',async()=>{
   await customControls();await near('#custom-toggle');assert.match(await dialog.locator('.context').textContent(),/Not pressed/);await primary.click();assert.equal(await page.locator('#custom-toggle').getAttribute('aria-pressed'),'true');assert.equal(await count(),'1 activations');
   await page.waitForTimeout(450);await near('#custom-toggle');assert.match(await dialog.locator('.context').textContent(),/Pressed/);await page.keyboard.press('Enter');assert.equal(await page.locator('#custom-toggle').getAttribute('aria-pressed'),'false');assert.equal(await count(),'2 activations');
  });
  await test('Custom controls appear once in L; disabled, hidden, unlabeled and unmarked controls stay excluded',async()=>{
   await customControls();await command('list');const text=await dialog.textContent();assert.ok(text.includes('Print practice')&&text.includes('Mute practice'));
   for(const name of ['Disabled custom action','Disabled group action','Hidden custom action','Unmarked click handler'])assert.ok(!text.includes(name));
   await dialog.locator('input').fill('Native role action');assert.equal(await dialog.locator('.choice').count(),1);
   await dialog.locator('input').fill('Mute practice');assert.equal(await dialog.locator('.choice').count(),1);assert.match(await dialog.locator('.choice').textContent(),/Not pressed/);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#custom-toggle').getAttribute('aria-pressed'),'true');assert.equal(await count(),'1 activations');
  });
  for(const [name,attribute,value] of [['role','role','link'],['toggle state','aria-pressed','true'],['disabled state','aria-disabled','true'],['focusability','tabindex','-1']])await test('Changed custom '+name+' invalidates an armed selection',async()=>{
   await customControls();await near('#custom-toggle');await page.locator('#custom-toggle').evaluate((e,{attribute,value})=>e.setAttribute(attribute,value),{attribute,value});await page.waitForFunction(()=>document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.primary').disabled);await page.keyboard.press('Enter');assert.equal(await count(),'0 activations');
  });
  await test('Custom-button focus-time changes cannot activate stale semantics',async()=>{
   await customControls();await page.locator('#custom-command').evaluate(e=>e.addEventListener('focus',()=>e.setAttribute('role','link')));await near('#custom-command');await primary.click();assert.equal(await count(),'0 activations');
  });
  await test('Open-component buttons use scoped labels, live highlighting and one activation',async()=>{
   await componentControls();await near('#component-action');assert.equal(await primary.textContent(),'Component action');assert.match(await dialog.locator('.context').textContent(),/Component settings/);await page.keyboard.press('Enter');assert.equal(await count(),'1 activations');
  });
  await test('Nested shadow and slotted buttons work in Nearby and the action list',async()=>{
   await componentControls();await near('#nested-action');assert.equal(await primary.textContent(),'Nested toggle');await primary.click();assert.equal(await page.locator('#nested-action').getAttribute('aria-pressed'),'true');assert.equal(await count(),'1 activations');
   await page.waitForTimeout(450);await command('list');await dialog.locator('input').fill('Slotted action');assert.equal(await dialog.locator('.choice').count(),1);await dialog.locator('.choice').click();assert.equal(await count(),'2 activations');
  });
  await test('Shadow mutations invalidate armed labels and composed disabled ancestors',async()=>{
   await componentControls();await near('#component-action');await page.locator('#component-fixture').evaluate(e=>e.shadowRoot.querySelector('#component-name').textContent='Changed component action');await page.waitForFunction(()=>document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.primary').disabled);assert.equal(await count(),'0 activations');
   await page.keyboard.press('Escape');await near('#nested-action');await page.locator('#component-fixture').evaluate(e=>e.setAttribute('aria-disabled','true'));await page.waitForFunction(()=>document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.primary').disabled);await page.keyboard.press('Enter');assert.equal(await count(),'0 activations');
  });
  await test('Shadow text fields preserve K/L and Escape restores their actual focus',async()=>{
   await componentControls();await page.locator('#component-typing').pressSequentially('kl');assert.equal(await page.locator('#component-typing').inputValue(),'kl');assert.equal(await dialog.isVisible(),false);await command('list');await page.keyboard.press('Escape');assert.equal(await page.locator('#component-typing').evaluate(e=>e.getRootNode().activeElement===e),true);
  });
  await test('Late attached shadow roots enter the live preview on pointer movement',async()=>{
   await page.evaluate(()=>{const host=document.createElement('div');host.id='late-host';document.querySelector('main').prepend(host);});await command('list');await page.keyboard.press('Escape');
   await page.locator('#late-host').evaluate(e=>{e.attachShadow({mode:'open'}).innerHTML='<button id="late-action" style="padding:20px">Late component action</button>';e.shadowRoot.querySelector('button').onclick=()=>record('Late action');});
   await page.locator('#late-action').hover();await page.waitForFunction(()=>{const r=document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.ring'),b=document.querySelector('#late-host').shadowRoot.querySelector('button').getBoundingClientRect();return !r.hidden&&Math.abs(parseFloat(r.style.left)-(b.left-5))<1;});await page.keyboard.press('k');await primary.waitFor();assert.equal(await primary.textContent(),'Late component action');await primary.click();assert.equal(await count(),'1 activations');
  });
  await test('Covered shadow controls are excluded and changed shadow toggle state is rejected',async()=>{
   await componentControls();await near('#nested-action');await page.locator('#nested-action').evaluate(e=>e.setAttribute('aria-pressed','true'));await page.waitForFunction(()=>document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.primary').disabled);await page.keyboard.press('Escape');
   const b=await page.locator('#component-action').boundingBox();await page.evaluate(b=>{const cover=document.createElement('div');cover.style.cssText=`position:fixed;left:${b.x-2}px;top:${b.y-2}px;width:${b.width+4}px;height:${b.height+4}px;background:black;z-index:99`;document.body.append(cover);},b);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await command('near');assert.notEqual(await primary.textContent(),'Component action');assert.equal(await count(),'0 activations');
  });
  await test('Styled checkbox uses its visible label, activates once, and is listed once',async()=>{
   await styledControls();await near('label[for="styled-check"]');assert.equal(await primary.textContent(),'Styled reminders');const b=await page.locator('label[for="styled-check"]').boundingBox();assert.ok(Math.abs(await dialog.locator('.ring').evaluate(e=>parseFloat(e.style.width))-(b.width+10))<0.01);await primary.click();assert.equal(await page.locator('#styled-check').isChecked(),true);assert.equal(await count(),'1 activations');
   await command('list');await dialog.locator('input').fill('Styled reminders');assert.equal(await dialog.locator('.choice').count(),1);assert.match(await dialog.locator('.choice').textContent(),/Checked/);await dialog.locator('input').fill('styled action');assert.equal(await dialog.locator('.choice').count(),0);
  });
  await test('Changing a styled label association cannot activate the original or replacement control',async()=>{
   await styledControls();await near('label[for="styled-check"]');await page.locator('label[for="styled-check"]').evaluate(e=>e.htmlFor='styled-disabled');await page.waitForFunction(()=>document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.primary').disabled);await page.keyboard.press('Enter');assert.equal(await count(),'0 activations');assert.equal(await page.locator('#styled-check').isChecked(),false);
  });
  await test('Proxy clicks do not dismiss the menu opened by the original control',async()=>{
   await page.evaluate(()=>{const b=document.getElementById('details-basics'),menu=document.createElement('div');menu.id='outside-dismiss-menu';menu.hidden=true;menu.textContent='Menu opened';document.body.append(menu);b.addEventListener('click',()=>menu.hidden=false);document.addEventListener('click',e=>{if(!b.contains(e.target))menu.hidden=true;});});
   await near('#details-basics');await primary.click();assert.equal(await page.locator('#outside-dismiss-menu').isVisible(),true);assert.equal(await count(),'1 activations');
  });
  await test('Opening L during a large page update finishes scanning and displays actions',async()=>{
   await page.evaluate(()=>{const fragment=document.createDocumentFragment();for(let i=0;i<6000;i++){const n=document.createElement('span');n.textContent='';fragment.append(n);}document.querySelector('main').append(fragment);});
   await command('list');assert.match(await dialog.locator('.count').textContent(),/buttons and links/);await dialog.locator('input').fill('Getting started');assert.equal(await dialog.locator('.choice').count(),2);
  });
  await test('Document capture listeners cannot dismiss a menu when pressing an assistance button',async()=>{
   await page.evaluate(()=>{const group=document.createElement('div');group.id='capture-menu';group.innerHTML='<button id="capture-item" style="padding:20px">Menu option</button>';document.querySelector('main').prepend(group);group.querySelector('button').onclick=()=>record('Menu option activated');for(const type of ['pointerdown','mousedown'])document.addEventListener(type,e=>{if(!group.contains(e.target))group.hidden=true;},true);});
   await near('#capture-item');await primary.click();assert.equal(await count(),'1 activations');assert.equal(await page.locator('#capture-menu').isVisible(),true);
  });
  await test('Cancelling a focus-dismissed menu does not reopen it through automatic focus restoration',async()=>{
   await page.evaluate(()=>{const b=document.createElement('button');b.id='focus-menu';b.textContent='Focus menu';b.setAttribute('aria-pressed','false');b.onfocus=()=>b.setAttribute('aria-pressed','true');b.onblur=()=>b.setAttribute('aria-pressed','false');document.querySelector('main').prepend(b);});await page.locator('#focus-menu').focus();assert.equal(await page.locator('#focus-menu').getAttribute('aria-pressed'),'true');await near('#focus-menu');assert.equal(await primary.isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#focus-menu').getAttribute('aria-pressed'),'false');assert.equal(await count(),'0 activations');
  });
  await test('Find a button starts on screen; Whole page reveals matching offscreen results',async()=>{
   await command('list');assert.equal(await dialog.getByRole('button',{name:'On screen',exact:true}).getAttribute('aria-pressed'),'true');await dialog.locator('.search').fill('advanced');assert.equal(await dialog.locator('.choice').count(),0);assert.match(await dialog.locator('.choices').textContent(),/Whole page/);await dialog.getByRole('button',{name:'Whole page',exact:true}).click();assert.equal(await dialog.locator('.choice').count(),1);assert.match(await dialog.locator('.choice').textContent(),/Scroll to this, then confirm/);assert.equal(await count(),'0 activations');
  });
  await test('On-page settings save the highlight switch without closing or activating page controls',async()=>{
   await ui.getByRole('button',{name:'Settings & help',exact:true}).click();await dialog.locator('#ss-live').uncheck();await dialog.locator('.save-status').filter({hasText:'Saved.'}).waitFor();assert.equal(await dialog.isVisible(),true);assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('preferences')).preferences.liveHighlight),false);await page.screenshot({path:path.join(project,'usability/06-settings-after.png')});await page.keyboard.press('Escape');await near();assert.equal(await dialog.locator('.ring').isVisible(),true);assert.equal(await count(),'0 activations');
  });
  await test('Settings preserve native select arrows and apply larger text and buttons immediately',async()=>{
   await command('settings');await dialog.locator('#ss-scale').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.panel')).fontSize==='20px');await dialog.locator('#ss-large').check();await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('header button')).minHeight==='68px');assert.equal(await dialog.isVisible(),true);assert.equal(await count(),'0 activations');
  });
  await test('On-page shortcut toggle keeps typing untouched and offers a mouse route to the list',async()=>{
   await command('settings');await dialog.locator('#ss-single').uncheck();await dialog.locator('.save-status').filter({hasText:'Saved.'}).waitFor();await page.keyboard.press('Escape');await page.locator('h1').click();await page.keyboard.press('l');assert.equal(await dialog.isVisible(),false);await ui.getByRole('button',{name:'Find a button',exact:true}).click();await dialog.locator('.search').fill('kl');assert.equal(await dialog.locator('.search').inputValue(),'kl');assert.equal(await count(),'0 activations');
  });
  await test('Successive on-page setting changes are both retained; Turn off removes assistance',async()=>{
   await command('settings');await dialog.locator('#ss-live').uncheck();await dialog.locator('#ss-large').check();await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('header button')).minHeight==='68px');const prefs=await worker.evaluate(async()=>(await chrome.storage.local.get('preferences')).preferences);assert.equal(prefs.liveHighlight,false);assert.equal(prefs.largeControls,true);await dialog.getByRole('button',{name:'Turn off for this page',exact:true}).click();assert.equal(await ui.count(),0);await command('enable');assert.equal(await ui.count(),1);assert.equal(await count(),'0 activations');
  });
  await test('Long lists keep Close and search reachable while results scroll',async()=>{
   await page.evaluate(()=>{const group=document.createElement('section');for(let i=0;i<65;i++){const b=document.createElement('button');b.textContent='Practice action '+i;group.append(b);}document.querySelector('main').append(group);});await command('list');await dialog.getByRole('button',{name:'Whole page',exact:true}).click();await dialog.locator('.search').fill('Practice action');assert.equal(await dialog.locator('.choice').count(),20);await dialog.getByRole('button',{name:'Show more',exact:true}).click();assert.equal(await dialog.locator('.choice').count(),40);await dialog.locator('.choice').last().scrollIntoViewIfNeeded();const closeBox=await dialog.getByRole('button',{name:'Close',exact:true}).boundingBox(),searchBox=await dialog.locator('.search').boundingBox();assert.ok(closeBox.y>=0&&closeBox.y+closeBox.height<=1000);assert.ok(searchBox.y>=0&&searchBox.y+searchBox.height<=1000);await page.keyboard.press('Escape');assert.equal(await count(),'0 activations');
  });
  await test('New panels start at the top after scrolling another mode or reopening settings',async()=>{
   await page.setViewportSize({width:921,height:821});
   await command('list');await dialog.getByRole('button',{name:'Whole page',exact:true}).click();await dialog.locator('.choice').last().scrollIntoViewIfNeeded();assert.ok(await dialog.locator('.content').evaluate(e=>e.scrollTop)>0);
   await page.keyboard.press('Escape');await command('settings');assert.equal(await dialog.locator('.content').evaluate(e=>e.scrollTop),0);
   await dialog.getByRole('button',{name:'Turn off for this page',exact:true}).scrollIntoViewIfNeeded();assert.ok(await dialog.locator('.content').evaluate(e=>e.scrollTop)>0);
   await page.keyboard.press('Escape');await command('settings');assert.equal(await dialog.locator('.content').evaluate(e=>e.scrollTop),0);
   await page.setViewportSize({width:1280,height:1000});assert.equal(await count(),'0 activations');
  });
  await test('Popup size settings apply to its own text and do not depend on unsaved shortcut edits',async()=>{
   const popup=await ctx.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);await popup.getByText('Change shortcuts & distance',{exact:true}).click();await popup.locator('#nearKey').fill('Q');await popup.locator('#listKey').fill('Q');await popup.locator('#scale').selectOption('1.25');await popup.waitForFunction(()=>document.getElementById('saved').textContent==='Settings saved.');assert.equal(await popup.locator('body').evaluate(e=>getComputedStyle(e).fontSize),'20px');assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('preferences')).preferences.nearKey),'k');await popup.locator('#scale').selectOption('1');await popup.getByText('Change shortcuts & distance',{exact:true}).click();await popup.screenshot({path:path.join(project,'usability/07-popup-after.png')});await popup.close();
  });
  await test('Collapsed toolbar keeps highlighting and K/L available; expansion restores usable focus',async()=>{
   await ui.getByRole('button',{name:'Collapse tools',exact:true}).click();assert.equal(await ui.locator('.launcher button:visible').count(),1);assert.equal(await ui.locator('.expand').evaluate(e=>e.getRootNode().activeElement===e),true);
   await page.locator('#start-basics').hover();await page.keyboard.press('k');assert.equal(await primary.textContent(),'Start');await page.keyboard.press('Escape');assert.equal(await ui.locator('.expand').isVisible(),true);
   await page.keyboard.press('l');await dialog.locator('.choice').first().waitFor();await page.keyboard.press('Escape');await ui.locator('.expand').click();assert.equal(await ui.locator('.launch-main').evaluate(e=>e.getRootNode().activeElement===e),true);assert.equal(await count(),'0 activations');
  });
  await test('Toolbar moves without dragging, remembers its corner and collapsed state after reload',async()=>{
   await ui.getByRole('button',{name:'Move to other corner',exact:true}).click();assert.equal(await ui.locator('.launcher').evaluate(e=>Math.round(e.getBoundingClientRect().left)),16);
   await ui.getByRole('button',{name:'Collapse tools',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-steadyselect-root]').shadowRoot.querySelector('.launcher').classList.contains('compact'));
   await worker.evaluate(async()=>{for(let n=0;n<50;n++){const v=(await chrome.storage.local.get('toolbarLayout')).toolbarLayout;if(v?.collapsed&&v.side==='left')return;await new Promise(r=>setTimeout(r,20));}throw new Error('Layout not saved');});
   await page.reload();await command('enable');assert.equal(await ui.locator('.expand').isVisible(),true);assert.equal(await ui.locator('.launcher').evaluate(e=>Math.round(e.getBoundingClientRect().left)),16);
   await page.screenshot({path:path.join(project,'usability/17-collapsed-toolbar-015.png')});await page.setViewportSize({width:400,height:800});await preferences({textScale:1.5,largeControls:true});const b=await ui.locator('.launcher').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=400&&b.y+b.height<=800);await page.setViewportSize({width:1280,height:1000});
  });
  await test('On-page Try it safely opens a separate practice tab and completes real mouse-assisted interactions',async()=>{
   await command('settings');const opened=ctx.waitForEvent('page');await dialog.getByRole('button',{name:'Try it safely',exact:true}).click();const practice=await opened;await practice.waitForLoadState('load');assert.equal(practice.url(),`chrome-extension://${extensionId}/practice.html`);
   const pui=practice.locator('[data-steadyselect-root]'),pd=pui.locator('dialog');await practice.locator('#lesson-action').waitFor({state:'visible'});await practice.waitForFunction(()=>!document.getElementById('lesson-action').disabled);
   await practice.locator('#lesson-action').click();await practice.locator('#step-count').filter({hasText:'Step 2'}).waitFor();assert.equal(await pui.locator('.ring').first().isVisible(),true);await practice.screenshot({path:path.join(project,'usability/15-practice-outline-015.png')});
   await practice.locator('#lesson-action').click();assert.equal(await pd.locator('.primary').textContent(),'Start lesson');await practice.screenshot({path:path.join(project,'usability/16-practice-card-015.png')});await pd.locator('.primary').click();assert.match(await practice.locator('#step-count').textContent(),/Step 3/);
   await practice.waitForTimeout(450);await practice.locator('#lesson-action').click();await pd.locator('.search').fill('Save reminder');assert.equal(await pd.locator('.choice').count(),1);await pd.locator('.choice').click();assert.equal(await practice.locator('#step-count').textContent(),'Practice complete');assert.match(await practice.locator('#sample-result').textContent(),/Sample reminder saved/);assert.equal(await count(),'0 activations');
   await practice.screenshot({path:path.join(project,'usability/18-practice-complete-015.png')});const closed=practice.waitForEvent('close');await practice.locator('#lesson-action').click();await closed;
  });
  await test('Practice supports remapped keyboard shortcuts without changing saved preferences',async()=>{
   await preferences({singleKeys:false,liveHighlight:false,nearKey:'q',listKey:'w'});const saved=await worker.evaluate(async()=>(await chrome.storage.local.get('preferences')).preferences);
   const practice=await ctx.newPage();await practice.goto(`chrome-extension://${extensionId}/practice.html`);await practice.waitForFunction(()=>!document.getElementById('lesson-action').disabled);
   await practice.locator('#practice-start').hover();await practice.locator('#step-count').filter({hasText:'Step 2'}).waitFor();assert.match(await practice.locator('#instruction').textContent(),/Press Q/);await practice.keyboard.press('q');const pd=practice.locator('[data-steadyselect-root] dialog');await pd.locator('.primary').waitFor();await practice.keyboard.press('Enter');assert.match(await practice.locator('#instruction').textContent(),/Press W/);
   await practice.waitForTimeout(450);await practice.keyboard.press('w');await pd.locator('.search').fill('Save reminder');await practice.keyboard.press('ArrowDown');await practice.keyboard.press('Enter');assert.equal(await practice.locator('#step-count').textContent(),'Practice complete');assert.deepEqual(await worker.evaluate(async()=>(await chrome.storage.local.get('preferences')).preferences),saved);await practice.close();
  });
  await test('Practice cancellation, direct clicks and restart do not falsely complete assisted steps',async()=>{
   const practice=await ctx.newPage();await practice.goto(`chrome-extension://${extensionId}/practice.html`);await practice.waitForFunction(()=>!document.getElementById('lesson-action').disabled);
   await practice.locator('#practice-start').hover();await practice.locator('#practice-start').click();assert.match(await practice.locator('#step-count').textContent(),/Step 2/);
   await practice.locator('#lesson-action').click();const pd=practice.locator('[data-steadyselect-root] dialog');await pd.locator('.primary').waitFor();await practice.keyboard.press('Escape');assert.match(await practice.locator('#step-count').textContent(),/Step 2/);
   await practice.locator('#restart').click();assert.match(await practice.locator('#step-count').textContent(),/Step 1/);assert.match(await practice.locator('#sample-result').textContent(),/only change this message/);
   await practice.setViewportSize({width:400,height:800});await practice.locator('#lesson-action').click();await practice.locator('#lesson-action').click();await pd.locator('.primary').waitFor();const b=await pd.locator('.panel').boundingBox();await practice.screenshot({path:path.join(project,'usability/19-practice-narrow-015.png')});assert.ok(b.x>=0&&b.x+b.width<=400&&b.y>=0&&b.y+b.height<=800,JSON.stringify(b));assert.equal(await pd.locator('.primary').isEnabled(),true);await pd.locator('.primary').click();assert.match(await practice.locator('#step-count').textContent(),/Step 3/);const closed=practice.waitForEvent('close');await practice.locator('#skip').click();await closed;
  });
  await test('Popup Try it safely opens practice without requiring an ordinary webpage',async()=>{
   const popup=await ctx.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);const opened=ctx.waitForEvent('page');await popup.locator('#practice').click();const practice=await opened;await practice.waitForLoadState('load');assert.equal(practice.url(),`chrome-extension://${extensionId}/practice.html`);await practice.waitForFunction(()=>!document.getElementById('lesson-action').disabled);await practice.close();if(!popup.isClosed())await popup.close();
  });
  await fresh();await near();await page.screenshot({path:path.join(project,'extension-near.png'),fullPage:false});
  await page.keyboard.press('Escape');await command('list');await page.screenshot({path:path.join(project,'extension-list.png'),fullPage:false});
  await page.keyboard.press('Escape');await page.setViewportSize({width:400,height:800});await preferences({textScale:1.5,largeControls:true});await command('list');
  const bounds=await dialog.locator('.panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=400&&bounds.y>=0&&bounds.y+bounds.height<=800);passed.push('Large assistance controls remain within a narrow viewport');
  await page.setViewportSize({width:1280,height:1000});
  for(const publicUrl of process.env.STEADY_SKIP_PUBLIC ? [] : ['https://example.com/','https://www.w3.org/WAI/ARIA/apg/patterns/button/examples/button/']){
   try{
    await page.goto(publicUrl,{waitUntil:'domcontentloaded',timeout:20000});await preferences({});const result=await command('enable');assert.equal(result.enabled,true,JSON.stringify(result));await command('list');await dialog.locator('.choice').first().waitFor();
    publicChecks.push({url:publicUrl,result:'Installed extension detected and displayed actions; no public-page action activated',count:await dialog.locator('.choice').count()});
   }catch(e){publicChecks.push({url:publicUrl,result:'Not verified',reason:e.message.slice(0,250)});}
  }
  assert.deepEqual(errors,[]);
  const report={testedAt:new Date().toISOString(),browser:'Isolated Chromium '+ctx.browser().version(),passed,errors,publicChecks,limitations:['Production manifest loaded separately, but automated input could not grant activeTab. Interaction tests use an otherwise identical extension copy with explicit permissions only for loopback, example.com and w3.org.','Default Chrome modifier commands registered; OS-level dispatch and first-use toolbar permission grant require a manual Chrome check.','No testing with intended users; these results do not establish accessibility efficacy.']};
  report.version=manifest.version;report.testFilter=process.env.STEADY_TEST_FILTER||null;fs.writeFileSync(path.join(project,'extension-check-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await ctx.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
