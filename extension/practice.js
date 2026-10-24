(() => {
  const $=id=>document.getElementById(id), practice=globalThis.SteadySelectPractice;
  let step=1, busy=false;
  async function finish() {
    try {const tab=await chrome.tabs.getCurrent();if(tab?.id)await chrome.tabs.remove(tab.id);}
    catch {$('feedback').textContent='Practice is finished. You can close this tab and return to your webpage.';}
  }
  function render() {
    const keys=practice.keys();
    const copy={
      1:['See which button is selected','Move your pointer close to Start lesson in the sample webpage. Watch for the green outline.','Show the outline for me','You can use this large button if pointing is difficult.'],
      2:['Enlarge Start lesson',`Press ${keys.near}, check the name on the enlarged button, then click it or press Enter.`,'Enlarge Start lesson',`Keyboard: ${keys.near} opens the card. Enter uses it. Esc cancels.`],
      3:['Find Save reminder',`Press ${keys.list}, type “Save reminder”, then click the result or press Enter.`,'Find a button',`Keyboard: ${keys.list} opens the list. You can type normally in its search box.`],
      4:['You’re ready to try a webpage','You used an outline, an enlarged button, and the searchable list. On a webpage, turn on SteadySelect from its Chrome icon.','Finish & close','You can repeat this practice anytime from Settings & help.']
    }[step];
    $('step-count').textContent=step===4?'Practice complete':`Step ${step} of 3`;
    [$('step-title').textContent,$('instruction').textContent,$('lesson-action').textContent,$('keyboard-help').textContent]=copy;
    $('lesson-action').disabled=busy;
    for(let n=1;n<=3;n++){const node=$('progress-'+n);node.classList.toggle('done',n<step);if(n===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');}
  }
  function next(message) {step++;render();$('feedback').textContent=message;}
  document.addEventListener('steadyselect-practice',event=>{
    const {kind,id,source}=event.detail;
    if(kind==='settings' && practice)render();
    if(kind==='preview' && step===1 && id==='practice-start')next('Step 1 complete. The outline shows the button that will be enlarged.');
    if(kind==='activated' && step===2 && id==='practice-start' && source==='near')next('Step 2 complete. You activated the sample lesson through its larger button.');
    else if(kind==='activated' && step===3 && id==='practice-save' && source==='list'){next('All three steps complete. The sample reminder was saved.');$('lesson-action').focus({preventScroll:true});}
  });
  $('lesson-action').addEventListener('click',async()=>{
    if(busy)return;busy=true;render();
    try {
      if(step===1){$('practice-start').scrollIntoView({block:'center',behavior:'instant'});await practice.pointStart();}
      else if(step===2){$('practice-start').scrollIntoView({block:'center',behavior:'instant'});await practice.nearStart();}
      else if(step===3){$('practice-save').scrollIntoView({block:'center',behavior:'instant'});await practice.list();}
      else await finish();
    }catch{$('feedback').textContent='Practice could not open. Reload this practice tab and try again.';}
    finally{busy=false;render();}
  });
  $('practice-start').addEventListener('click',()=>{$('sample-result').textContent='Sample lesson started.';});
  $('practice-save').addEventListener('click',()=>{$('sample-result').textContent='Sample reminder saved in this practice.';});
  $('restart').addEventListener('click',async()=>{await practice.reset();step=1;$('sample-result').textContent='These sample buttons only change this message.';$('feedback').textContent='Practice restarted.';render();$('lesson-action').focus({preventScroll:true});});
  $('skip').addEventListener('click',finish);
  function applySize(value) {const p=SteadySelectCore.settings(value);document.documentElement.style.setProperty('--scale',p.textScale);document.documentElement.style.setProperty('--height',p.largeControls?'68px':'52px');}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.preferences)applySize(changes.preferences.newValue);});
  practice.ready.then(async()=>{applySize((await chrome.storage.local.get('preferences')).preferences);$('version').textContent='SteadySelect '+chrome.runtime.getManifest().version;render();}).catch(()=>{$('feedback').textContent='Practice could not start. Reload SteadySelect and try again.';});
})();
