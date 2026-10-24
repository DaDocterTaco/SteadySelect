async function control(tabId, action) {
  if (!Number.isInteger(tabId)) throw new Error('Open a webpage first.');
  let result;
  try { result = await chrome.tabs.sendMessage(tabId, { steadyselect: true, action }); }
  catch {
    if (action === 'status' || action === 'disable') return { enabled: false };
    await chrome.scripting.executeScript({ target: { tabId }, files: ['core.js', 'content.js'] });
    result = await chrome.tabs.sendMessage(tabId, { steadyselect: true, action });
  }
  await chrome.action.setBadgeText({ tabId, text: result.enabled ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#15665d' });
  return result;
}
chrome.commands.onCommand.addListener(async (action, tab) => {
  try { await control(tab?.id ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id, action); }
  catch { await chrome.action.setBadgeText({ tabId: tab?.id, text: '!' }); }
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if(message.type==='steady-practice-open') {
    chrome.tabs.create({url:chrome.runtime.getURL('practice.html'),...(sender.tab?.id?{openerTabId:sender.tab.id}:{})})
      .then(()=>reply({opened:true}),()=>reply({error:'Could not open practice.'}));return true;
  }
  if(message.type !== 'steady-control') return;
  if (!['enable', 'disable', 'near', 'list', 'settings', 'toggle', 'status'].includes(message.action)) return;
  control(message.tabId, message.action).then(reply, () => reply({ error: 'Chrome cannot use SteadySelect here. Try an ordinary webpage; internal pages and the extension store are restricted.' }));
  return true;
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
});
