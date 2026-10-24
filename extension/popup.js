const $ = id => document.getElementById(id);
let tabId, enabled = false, currentSettings = SteadySelectCore.settings();
function applySize(s) {document.documentElement.style.setProperty('--scale',s.textScale);document.documentElement.style.setProperty('--height',s.largeControls?'68px':'52px');$('single-label').firstChild.textContent=`Use ${s.nearKey.toUpperCase()} and ${s.listKey.toUpperCase()}`;}
function showSettings(s) {
  currentSettings=s;applySize(s);
  $('live').checked = s.liveHighlight; $('single').checked = s.singleKeys; $('large').checked = s.largeControls;
  $('scale').value = s.textScale; $('radius').value = s.radius; $('nearKey').value = s.nearKey.toUpperCase(); $('listKey').value = s.listKey.toUpperCase();
}
async function send(action) {
  const result = await chrome.runtime.sendMessage({ type: 'steady-control', tabId, action });
  if (result.error) { $('status').textContent = result.error; return false; }
  enabled = result.enabled; $('enable').textContent = enabled ? 'Turn off for this page' : 'Turn on for this page';
  $('enable').classList.toggle('primary',!enabled);$('status').dataset.on=String(enabled);
  $('status').textContent = enabled ? 'On this page · Ready to help' : 'Off on this page. Turn on to get started.';
  return true;
}
async function save(keys=false) {
  const nearKey = keys?$('nearKey').value.toLowerCase():currentSettings.nearKey, listKey = keys?$('listKey').value.toLowerCase():currentSettings.listKey;
  if (!/^[a-z0-9]$/.test(nearKey) || !/^[a-z0-9]$/.test(listKey) || nearKey === listKey) { $('saved').textContent = 'Choose two different single letters or numbers.'; return; }
  const preferences = SteadySelectCore.settings({ liveHighlight: $('live').checked, singleKeys: $('single').checked, largeControls: $('large').checked, textScale: Number($('scale').value), radius: Number($('radius').value), nearKey, listKey });
  try {await chrome.storage.local.set({ preferences });currentSettings=preferences;applySize(preferences);$('saved').textContent='Settings saved.';}catch{$('saved').textContent='Could not save. Please try again.';}
}
$('enable').onclick = async () => {try {const starting=!enabled;if(await send(starting?'enable':'disable')&&starting)window.close();}catch{$('status').textContent='Unable to reach this page. Refresh the webpage and try again.';}};
for (const action of ['near', 'list']) $(action).onclick = async () => {try{if(await send(action))window.close();}catch{$('status').textContent='Unable to open this tool. Refresh the webpage and try again.';}};
$('help').onclick=async()=>{try{if(await send('settings'))window.close();}catch{$('status').textContent='Open a webpage to use on-page help.';}};
$('practice').onclick=async()=>{try{const result=await chrome.runtime.sendMessage({type:'steady-practice-open'});if(result?.error)throw new Error(result.error);window.close();}catch{$('status').textContent='Could not open practice. Reload SteadySelect and try again.';}};
$('save').onclick = ()=>save(true);
for (const id of ['live', 'single', 'large', 'scale', 'radius']) $(id).onchange = ()=>save();
$('change').onclick = () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); tabId = tab?.id;
  showSettings(SteadySelectCore.settings((await chrome.storage.local.get('preferences')).preferences));
  $('single-label').firstChild.textContent=`Use ${currentSettings.nearKey.toUpperCase()} and ${currentSettings.listKey.toUpperCase()}`;
  $('version').textContent=`Version ${chrome.runtime.getManifest().version} · Settings stay on this device.`;
  const commands = await chrome.commands.getAll();
  $('bindings').textContent = commands.map(c => `${c.description}: ${c.shortcut || 'Not assigned'}`).join('\n');
  await send('status');
})().catch(() => $('status').textContent = 'Open a webpage, then reopen SteadySelect.');
