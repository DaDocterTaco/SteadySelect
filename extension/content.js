(() => {
  if (globalThis.__steadySelectV1) return;
  globalThis.__steadySelectV1 = true;
  const C = SteadySelectCore;
  const practicePage = location.href.split(/[?#]/)[0] === chrome.runtime.getURL('practice.html');
  const readPreferences = value => C.settings(practicePage ? {...value, liveHighlight:true, singleKeys:true} : value);
  let prefs = C.settings(), enabled = false, pointer = null, overUI = false, mode = 'idle';
  let toolbarCollapsed = false, toolbarSide = 'right', layoutWrites = Promise.resolve();
  let inventory = [], items = [], selected = 0, filtered = [], shown = 20, listScope = 'screen', previousFocus = null, previousFocusSnapshot = null;
  let scanToken = 0, session = 0, frame = 0, refreshTimer = 0, guardUntil = 0, dispatching = false, alive = true;
  let observedRoots = new WeakSet();
  let settingsWrites = Promise.resolve();
  const ready = chrome.storage.local.get(['preferences','toolbarLayout']).then(v => {
    prefs = readPreferences(v.preferences);
    toolbarCollapsed = v.toolbarLayout?.collapsed === true;
    toolbarSide = v.toolbarLayout?.side === 'left' ? 'left' : 'right';
  });
  const host = document.createElement('div');
  host.setAttribute('data-steadyselect-root', ''); host.setAttribute('popover', 'manual');
  host.dataset.steadyselectVersion=chrome.runtime.getManifest().version;
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;margin:0!important;padding:0!important;border:0!important;width:100%!important;height:100%!important;background:transparent!important;pointer-events:none!important;z-index:2147483647!important;';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { --brand:#15665d; --ink:#172b3c; --muted:#465a6b; --line:#adbdc5; --soft:#e9f5ef; --scale:1; --height:52px; color-scheme:light; }
    * { box-sizing:border-box; } [hidden] { display:none!important; }
    button,input { font:inherit; } button { cursor:pointer; } button:disabled { opacity:.55; cursor:default; }
    button:focus-visible,input:focus-visible { outline:3px solid #0b7163; outline-offset:3px; }
    .launcher,.note,dialog { font:calc(16px * var(--scale))/1.45 system-ui,sans-serif; color:var(--ink); }
    .launcher { position:fixed; right:16px; bottom:16px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; max-width:min(620px,calc(100vw - 32px)); background:#fff; border:2px solid var(--brand); border-radius:14px; box-shadow:0 4px 20px #17324525; padding:12px; pointer-events:auto; font-size:calc(16px * var(--scale)); }
    .brand { font-size:14px; color:var(--brand); font-weight:700; }
    .launcher-head { display:flex; gap:12px; justify-content:space-between; width:100%; align-items:center; }
    .launcher-head { flex-wrap:wrap; }
    .launcher-tools,.launcher-body { display:flex; flex-wrap:wrap; gap:8px; }
    .launcher-body { width:100%; }
    .launcher.left { left:16px; right:auto; }
    .launcher.compact { padding:0; }
    .launcher .expand { border:0; font-weight:650; }
    .launcher-hint { width:100%; margin:0; font-size:14px; color:var(--muted); }
    .launcher .launch-main { flex:1; background:var(--brand); color:#fff; }
    button { border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--ink); padding:10px 13px; min-height:var(--height); }
    button:hover:not(:disabled) { background:var(--soft); }
    .note { position:fixed; right:16px; bottom:90px; max-width:min(400px,calc(100vw - 32px)); border:1px solid var(--line); border-radius:10px; background:white; padding:14px; pointer-events:auto; box-shadow:0 4px 20px #17324520; }
    .note p { margin:0 0 10px; }
    .ring { position:fixed; border:4px solid var(--brand); box-shadow:0 0 0 3px white; border-radius:9px; pointer-events:none; }
    .badge { position:fixed; background:var(--brand); color:#fff; font:600 13px/1.4 system-ui,sans-serif; padding:3px 8px; border-radius:5px; max-width:calc(100vw - 16px); pointer-events:none; }
    dialog { inset:0; width:100vw; height:100vh; max-width:none; max-height:none; margin:0; padding:0; border:0; background:transparent; pointer-events:none; overflow:hidden; }
    dialog::backdrop { background:#172b3c18; }
    .panel { position:fixed; pointer-events:auto; width:min(400px,calc(100vw - 24px)); max-height:calc(100vh - 24px); overflow:auto; background:white; border:2px solid var(--brand); border-radius:15px; padding:20px; box-shadow:0 12px 34px #17324535; font-size:calc(16px * var(--scale)); }
    .panel.list,.panel.settings { width:min(590px,calc(100vw - 24px)); left:50%; top:50%; transform:translate(-50%,-50%); display:flex; flex-direction:column; overflow:hidden; }
    .panel.list .content,.panel.settings .content { min-height:0; overflow:auto; padding:4px; }
    header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
    h2 { font-size:calc(20px * var(--scale)); margin:0; font-weight:600; }
    header { flex-shrink:0; } header button { flex-shrink:0; font-size:16px; min-width:88px; }
    .context { color:var(--muted); overflow-wrap:anywhere; margin:8px 0 12px; }
    .primary { width:100%; font-size:calc(28px * var(--scale)); min-height:calc(var(--height) + 36px); font-weight:600; background:var(--brand); color:white; overflow-wrap:anywhere; }
    .primary:hover:not(:disabled) { background:#104f48; }
    .navigation { display:flex; gap:8px; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap:wrap; }
    .navigation output { color:var(--muted); font-size:14px; }
    .help,.count { font-size:calc(14px * var(--scale)); color:var(--muted); margin:12px 0 0; }
    .instruction { margin:0 0 14px; color:var(--muted); }
    .error { color:#963a20; font-size:calc(14px * var(--scale)); margin:8px 0; }
    .search { display:block; width:100%; min-height:var(--height); border:1px solid var(--line); border-radius:8px; padding:10px 12px; background:#fff; color:var(--ink); margin:6px 0 12px; font-size:calc(16px * var(--scale)); }
    .list-tools { position:sticky; top:-4px; z-index:2; background:white; padding:0 0 12px; border-bottom:1px solid var(--line); }
    .scopes { display:flex; gap:8px; } .scopes button { flex:1; }
    button[aria-pressed="true"] { background:var(--soft); border:2px solid var(--brand); font-weight:650; }
    .choices { display:grid; gap:10px; margin-top:12px; } .choice { text-align:start; width:100%; min-height:calc(var(--height) + 20px); overflow-wrap:anywhere; }
    .choice.current { background:var(--soft); border-color:var(--brand); box-shadow:inset 3px 0 var(--brand); }
    .label { font-size:calc(21px * var(--scale)); font-weight:600; display:block; } .sub { color:var(--muted); font-size:calc(14px * var(--scale)); display:block; }
    .footer { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--line); }
    .settings h3 { font-size:calc(18px * var(--scale)); margin:20px 0 8px; }
    .setting { display:grid; grid-template-columns:28px 1fr; column-gap:12px; padding:16px 0; border-bottom:1px solid var(--line); cursor:pointer; }
    .setting input { width:26px; height:26px; accent-color:var(--brand); margin:2px 0; }
    .setting small { display:block; color:var(--muted); font-size:calc(14px * var(--scale)); margin-top:4px; }
    .size-label { display:block; margin:16px 0; }
    select { display:block; width:100%; min-height:var(--height); margin-top:8px; font:inherit; border:1px solid var(--line); border-radius:8px; padding:10px; background:#fff; color:var(--ink); }
    .steps { padding-left:26px; } .steps li { padding:5px 0 10px 4px; }
    .save-status { color:var(--brand); min-height:1.5em; }
    @media(max-height:600px) { .panel { padding:12px; } .list-tools { position:static; } }
    .guide { position:fixed; inset:0; width:100vw; height:100vh; overflow:visible; pointer-events:none; } .guide path { fill:none; stroke:var(--brand); stroke-width:2; }
    .sr { position:absolute; width:1px; height:1px; padding:0; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
    @media(prefers-reduced-motion:reduce) { * { scroll-behavior:auto!important; } }
  `;
  root.append(style);
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; };
  const button = (text, fn, cls = '') => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const liveRing = el('div', 'ring'), liveBadge = el('div', 'badge');
  liveRing.setAttribute('aria-hidden', 'true'); liveBadge.setAttribute('aria-hidden', 'true');
  const launcher = el('div', 'launcher'); launcher.setAttribute('role', 'region'); launcher.setAttribute('aria-label', 'SteadySelect controls');
  const launcherHead=el('div','launcher-head'), launcherHint=el('p','launcher-hint');
  launcherHead.append(el('span','brand','SteadySelect · On'));
  const launchNear=button('Enlarge nearby',()=>openNear(),'launch-main'),launchList=button('Find a button',()=>openList());
  const launcherBody=el('div','launcher-body'),launcherTools=el('div','launcher-tools');
  const expandToolbar=button('SteadySelect tools',()=>setToolbar({collapsed:false},launchNear),'expand');
  expandToolbar.setAttribute('aria-expanded','false');
  const collapseToolbar=button('Collapse tools',()=>setToolbar({collapsed:true},expandToolbar));
  const moveToolbar=button('Move to other corner',()=>setToolbar({side:toolbarSide==='right'?'left':'right'}));
  launcherTools.append(moveToolbar,collapseToolbar);launcherHead.append(launcherTools);
  launcherBody.append(launchNear,launchList,button('Settings & help',()=>openSettings()));
  launcher.append(expandToolbar,launcherHead,launcherBody,launcherHint);
  const note = el('div', 'note'); note.hidden = true; const noteText = el('p'); noteText.setAttribute('role', 'status');
  note.append(noteText, button('Dismiss', () => note.hidden = true));
  const dialog = document.createElement('dialog'); dialog.setAttribute('aria-labelledby', 'ss-title');
  const ring = el('div', 'ring'), badge = el('div', 'badge'); ring.setAttribute('aria-hidden','true'); badge.setAttribute('aria-hidden','true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('guide'); svg.setAttribute('aria-hidden','true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); svg.append(path);
  const panel = el('section', 'panel'), heading = el('h2'); heading.id = 'ss-title';
  const header = el('header'); header.append(heading, button('Close', () => close()));
  const content = el('div','content'), error = el('p', 'error'), announcement = el('p', 'sr');
  error.setAttribute('role','status'); announcement.setAttribute('aria-live','polite');
  panel.append(header, error, content, announcement); dialog.append(svg, ring, badge, panel);
  root.append(liveRing, liveBadge, launcher, note, dialog);
  // The assistance click must not reach a site's outside-click dismissal handler
  // after the deliberate click on the original control opens its menu.
  for (const type of ['pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchend']) root.addEventListener(type,e=>e.stopPropagation());
  // Preserve the browser's normal focus/click defaults, but keep presses on our
  // controls away from document capture listeners that dismiss site menus.
  for (const type of ['pointerdown','pointerup','mousedown','mouseup']) window.addEventListener(type,e=>{
    if(enabled && e.composedPath().includes(host)) e.stopPropagation();
  },true);
  let primary, choices, search, counter;
  function applyToolbar() {
    launcher.classList.toggle('compact',toolbarCollapsed);launcher.classList.toggle('left',toolbarSide==='left');
    expandToolbar.hidden=!toolbarCollapsed;
    launcherHead.hidden=launcherBody.hidden=launcherHint.hidden=toolbarCollapsed;
    moveToolbar.title=`Move toolbar to the bottom ${toolbarSide==='right'?'left':'right'}`;
    launcher.hidden=!enabled || mode!=='idle' || practicePage;
  }
  function setToolbar(patch,focusTarget) {
    if('collapsed' in patch)toolbarCollapsed=patch.collapsed;
    if('side' in patch)toolbarSide=patch.side;
    applyToolbar();hideLive();focusTarget?.focus({preventScroll:true});
    const layout={collapsed:toolbarCollapsed,side:toolbarSide};
    layoutWrites=layoutWrites.then(()=>chrome.storage.local.set({toolbarLayout:layout})).catch(()=>tell('Toolbar moved for this page, but its position could not be saved.'));
  }
  function practiceEvent(kind,item,source) {
    if(practicePage)document.dispatchEvent(new CustomEvent('steadyselect-practice',{detail:{kind,id:item?.el?.id,source,nearKey:prefs.nearKey,listKey:prefs.listKey}}));
  }
  async function openPractice() {
    try {const result=await chrome.runtime.sendMessage({type:'steady-practice-open'});if(result?.error)throw new Error(result.error);}
    catch {tell('Could not open practice. Reload SteadySelect and try again.');}
  }
  function hideLive() { liveRing.hidden = true; liveBadge.hidden = true; }
  function outline(target, ringEl, badgeEl, text) {
    const r = C.surface(target).getBoundingClientRect();
    if (!C.inView(target)) { ringEl.hidden = true; badgeEl.hidden = true; return; }
    ringEl.hidden = false; badgeEl.hidden = false; badgeEl.textContent = text;
    Object.assign(ringEl.style, { left:r.left - 5 + 'px', top:r.top - 5 + 'px', width:r.width + 10 + 'px', height:r.height + 10 + 'px' });
    badgeEl.style.left = Math.max(8, Math.min(r.left - 5, innerWidth - badgeEl.offsetWidth - 8)) + 'px';
    badgeEl.style.top = Math.max(8, r.top - badgeEl.offsetHeight - 10) + 'px';
  }
  function nearest() {
    if (!pointer) return [];
    const ranked = inventory.filter(s => C.inView(s.el)).map(s => ({ s, d:C.distance(s.el,pointer) })).filter(x => x.d <= prefs.radius).sort((a,b) => a.d - b.d);
    return ranked.filter(x => C.exposed(x.s.el) && C.label(x.s.el)).slice(0,6).map(x => C.snapshot(x.s.el));
  }
  function preview() {
    frame = 0; if (!enabled || mode !== 'idle' || !prefs.liveHighlight || overUI || !pointer) { hideLive(); return; }
    const item = nearest()[0];
    if (!item) { hideLive(); return; }
    outline(item.el, liveRing, liveBadge, prefs.singleKeys ? prefs.nearKey.toUpperCase() + ' selects this' : 'Nearby action');
    practiceEvent('preview',item);
  }
  function queuePreview() { if (!frame) frame = requestAnimationFrame(preview); }
  async function scan() {
    const token = ++scanToken, next = []; let visited = 0;
    for (const node of C.elements()) {
      if (token !== scanToken || !enabled) return false;
      if (node.shadowRoot) observeRoot(node.shadowRoot);
      if ((!practicePage || document.getElementById('practice-area')?.contains(node)) && node.matches(C.selector) && C.eligible(node) && C.label(node)) next.push(C.snapshot(node));
      if (++visited % 150 === 0) await new Promise(r => setTimeout(r,0));
    }
    if (token !== scanToken || !enabled) return false;
    inventory = next; if (mode === 'idle') queuePreview(); return true;
  }
  function applySettings() {
    host.style.setProperty('--scale', prefs.textScale); host.style.setProperty('--height', prefs.largeControls ? '68px' : '52px');
    launcherHint.textContent=prefs.singleKeys ? `Point near a button → press ${prefs.nearKey.toUpperCase()} to enlarge. Press ${prefs.listKey.toUpperCase()} to find a button.` : 'Point near a button, then choose Enlarge nearby. Or use Find a button.';
    applyToolbar();practiceEvent('settings');
    if (!prefs.liveHighlight) hideLive(); else queuePreview();
  }
  function tell(text) { noteText.textContent = text; note.hidden = false; }
  function invalid(text = 'This button changed. Nothing was clicked. Close and choose it again.') {
    error.textContent = text;
    if (primary) primary.disabled = true;
    ring.hidden = true; badge.hidden = true; svg.style.display = 'none';
    if(mode==='near')panel.style.top=Math.max(12,Math.min(parseFloat(panel.style.top)||12,innerHeight-panel.getBoundingClientRect().height-12))+'px';
  }
  function marker() {
    const item = items[selected]; ring.hidden = true; badge.hidden = true; svg.style.display = 'none';
    if (!item || !C.unchanged(item, mode === 'near')) { if (item) invalid(); return; }
    outline(item.el, ring, badge, 'Selected');
    if (mode !== 'near' || ring.hidden) return;
    const r = C.surface(item.el).getBoundingClientRect(), b = panel.getBoundingClientRect();
    let x1,y1,x2,y2;
    if (b.right < r.left) { x1=b.right; y1=Math.max(b.top+25,Math.min(r.top+r.height/2,b.bottom-25)); x2=r.left-7; y2=r.top+r.height/2; }
    else if (b.left > r.right) { x1=b.left; y1=Math.max(b.top+25,Math.min(r.top+r.height/2,b.bottom-25)); x2=r.right+7; y2=r.top+r.height/2; }
    else if (b.top > r.bottom) { x1=Math.max(b.left+25,Math.min(r.left+r.width/2,b.right-25));y1=b.top;x2=r.left+r.width/2;y2=r.bottom+7; }
    else if (b.bottom < r.top) { x1=Math.max(b.left+25,Math.min(r.left+r.width/2,b.right-25));y1=b.bottom;x2=r.left+r.width/2;y2=r.top-7; }
    else return;
    path.setAttribute('d',`M ${x1} ${y1} L ${x2} ${y2}`); svg.style.display = '';
  }
  function close(restore = true) {
    session++; scanToken++; clearTimeout(refreshTimer); mode = 'idle'; primary = null; error.textContent = ''; hideLive();
    if (dialog.open) dialog.close();
    applyToolbar(); ring.hidden = true; badge.hidden = true; svg.style.display = 'none';
    if (restore && previousFocus?.isConnected && (!previousFocusSnapshot || C.unchanged(previousFocusSnapshot,false))) previousFocus.focus({ preventScroll:true });
  }
  function begin(kind, title) {
    if (dialog.open) close(false);
    previousFocus = C.activeElement(); previousFocusSnapshot = C.eligible(previousFocus) ? C.snapshot(previousFocus) : null;
    // Own restoration explicitly: native dialog restoration can reopen a menu
    // whose focus handler changed it while assistance was open.
    previousFocus?.blur();
    mode = kind; session++; hideLive(); note.hidden = true; launcher.hidden = true;
    content.replaceChildren(); error.textContent = ''; announcement.textContent = ''; panel.className = 'panel' + (kind === 'list' || kind === 'settings' ? ' '+kind : '');
    panel.style.left = ''; panel.style.top = ''; panel.style.transform = ''; heading.textContent = title;
  }
  function placeNear() {
    const rects = items.map(s => C.surface(s.el).getBoundingClientRect()), w = panel.offsetWidth, h = panel.offsetHeight;
    const a = { left:Math.min(...rects.map(r=>r.left)), right:Math.max(...rects.map(r=>r.right)), top:Math.min(...rects.map(r=>r.top)), bottom:Math.max(...rects.map(r=>r.bottom)) };
    const anchor = C.surface(items[selected].el).getBoundingClientRect(); const gap=24;
    let x,y;
    if (a.left - w - gap >= 12) { x=a.left-w-gap; y=anchor.top-50; }
    else if (a.right + gap + w <= innerWidth-12) { x=a.right+gap; y=anchor.top-50; }
    else if (a.bottom+gap+h <= innerHeight-12) { x=anchor.left; y=a.bottom+gap; }
    else if (a.top-gap-h >= 12) { x=anchor.left; y=a.top-gap-h; }
    else { x=(innerWidth-w)/2; y=anchor.top > innerHeight/2 ? 12 : innerHeight-h-12; }
    panel.style.left = Math.max(12,Math.min(x,innerWidth-w-12))+'px'; panel.style.top=Math.max(12,Math.min(y,innerHeight-h-12))+'px';
    marker();
  }
  function showPanel() {
    dialog.showModal();
    // The same scroll containers serve all modes. Reset after they are visible.
    content.scrollTop=0; panel.scrollTop=0;
  }
  function updateNear() {
    const item = items[selected]; error.textContent=''; primary.disabled=false;
    primary.textContent = item.label; primary.setAttribute('aria-label', item.label + (item.context ? ' — '+item.context : ''));
    content.querySelector('.context').textContent = [item.context || C.controlHint(item.el), C.stateHint(item.el)].filter(Boolean).join(' · ');
    counter.textContent=(selected+1)+' of '+items.length+' nearby'; announcement.textContent = item.label + '. ' + item.context;
    marker();
  }
  function showNear(found) {
    begin('near','Enlarge nearby'); items=found;selected=0;
    const context=el('p','context'); primary=button('',()=>activate(items[selected]),'primary');
    const nav=el('div','navigation'); counter=el('output');
    nav.append(button('Previous',()=>move(-1)),counter,button('Next',()=>move(1)));
    content.append(el('p','instruction','Check the outline. Click the large button below to use it.'),context,primary,nav,el('p','help','↑ ↓ choose · Enter clicks · Esc cancels'),button('Find another button',()=>openList()));
    showPanel(); updateNear(); placeNear(); primary.focus({preventScroll:true});
  }
  async function openNear() {
    if (!enabled) await enable();
    if (mode === 'near') { move(1); return; }
    if (!pointer) { tell('Move your mouse near a button on the webpage, then try Enlarge nearby again. You can also use Find a button without pointing.'); return; }
    close(false); const token=session;
    if (!await scan() || token!==session) return;
    const found=nearest();
    if (!found.length) { tell('No button found nearby. Move closer, or choose Find a button to search the page.'); return; }
    showNear(found);
  }
  function renderList() {
    const query=search.value.toLocaleLowerCase().trim();
    filtered=inventory.filter(s=>(listScope==='page'||C.inView(s.el))&&(s.label+' '+s.context).toLocaleLowerCase().includes(query));
    items=filtered.slice(0,shown); selected=Math.min(selected,Math.max(0,items.length-1)); choices.replaceChildren();
    items.forEach((item,index)=>{
      const b=button('',()=>activate(item),'choice');
      b.append(el('span','label',item.label),el('span','sub',[item.context!==item.label?item.context:'',C.stateHint(item.el),C.inView(item.el)?'':'Scroll to this, then confirm'].filter(Boolean).join(' · ')));
      b.addEventListener('focus',()=>{selected=index;for(const [i,n] of [...choices.children].entries())n.classList.toggle('current',i===selected);error.textContent='';marker();});
      choices.append(b);
    });
    if (!items.length) choices.append(el('p','context',listScope==='screen'?'No matches on screen. Try Whole page or a shorter search.':'No matches. Try another word. Some website controls may not appear.'));
    counter.textContent=`${filtered.length} ${filtered.length===1?'button or link':'buttons and links'} ${listScope==='screen'?'on screen':'on this page'}${filtered.length>shown?' · showing '+shown:''}`;
    content.querySelector('[data-more]').hidden=filtered.length<=shown;
    announcement.textContent=counter.textContent; marker();
  }
  async function openList() {
    if (!enabled) await enable();
    close(false); begin('list','Find a button'); items=[];selected=0;shown=20;listScope='screen';
    const label=el('label','','Search buttons and links'); search=el('input','search'); search.type='search'; search.id='ss-search';label.htmlFor=search.id;
    search.autocomplete='off';search.placeholder='For example: Search, Menu, Save';
    choices=el('div','choices');counter=el('p','count','Scanning…');
    const more=button('Show more',()=>{shown+=20;renderList();});more.setAttribute('data-more','');more.hidden=true;
    const scopes=el('div','scopes');scopes.setAttribute('role','group');scopes.setAttribute('aria-label','Where to look');
    for(const [value,text] of [['screen','On screen'],['page','Whole page']]){const b=button(text,()=>{listScope=value;shown=20;selected=0;for(const n of scopes.children)n.setAttribute('aria-pressed',String(n===b));renderList();});b.setAttribute('aria-pressed',String(value===listScope));scopes.append(b);}
    const tools=el('div','list-tools');tools.append(label,search,scopes,counter,el('p','help','Click a result to use it. Or use ↑ ↓, then Enter.'));
    const footer=el('div','footer');footer.append(more,button('Scan again',()=>openList()),button('Settings & help',()=>openSettings()));
    content.append(tools,choices,footer);
    search.addEventListener('input',()=>{selected=0;shown=20;renderList();});
    showPanel();search.focus();const token=session;
    if (await scan() && token===session && mode==='list') renderList();
  }
  async function openSettings() {
    if(!enabled)await enable();close(false);begin('settings','Settings & help');items=[];
    content.append(el('p','instruction','Make SteadySelect comfortable for you. Changes save automatically.'));
    content.append(button('Try it safely',()=>openPractice()),el('p','help','Opens a practice tab with harmless sample buttons.'));
    const status=el('p','save-status');status.setAttribute('role','status');
    const save=patch=>{status.textContent='Saving…';settingsWrites=settingsWrites.then(async()=>{const saved=await chrome.storage.local.get('preferences');prefs=C.settings({...saved.preferences,...patch});await chrome.storage.local.set({preferences:prefs});applySettings();status.textContent='Saved.';}).catch(()=>{status.textContent='Could not save. Please try again.';});return settingsWrites;};
    function toggle(id,title,description,key){const label=el('label','setting'),input=el('input');input.type='checkbox';input.id=id;input.checked=prefs[key];const text=el('span','',title);text.append(el('small','',description));label.append(input,text);input.addEventListener('change',()=>save({[key]:input.checked}));content.append(label);}
    toggle('ss-live','Highlight the button near my pointer','See which button Enlarge nearby will choose.','liveHighlight');
    const sizeLabel=el('label','size-label','Text size'),size=el('select');size.id='ss-scale';for(const [value,text]of [[1,'Standard'],[1.25,'Large'],[1.5,'Extra large']]){const o=el('option','',text);o.value=value;size.append(o);}size.value=prefs.textScale;sizeLabel.append(size);size.addEventListener('change',()=>save({textScale:Number(size.value)}));content.append(sizeLabel);
    toggle('ss-large','Extra-large buttons','More space to click comfortably.','largeControls');
    toggle('ss-single',`Use ${prefs.nearKey.toUpperCase()} and ${prefs.listKey.toUpperCase()} without other keys`,'Your letters still type normally in text boxes.','singleKeys');
    content.append(status,el('h3','','How to use SteadySelect'));
    const steps=el('ol','steps');for(const text of ['Point near the button you want. The outline shows the current choice.','Choose Enlarge nearby. Check the name on the large button.','Click that large button, or press Enter. Close or Esc cancels.'])steps.append(el('li','',text));content.append(steps,el('p','help','Prefer a list? Choose Find a button, type a word, then click a result. Whole page also finds buttons below the screen.'),el('p','help','Enable SteadySelect again after a page reload. It helps with buttons and links; it does not enlarge all webpage text.'),el('p','help',`SteadySelect ${chrome.runtime.getManifest().version} · Settings stay on this device.`),button('Find a button',()=>openList()));
    content.append(el('p','help','To turn it on again, use the SteadySelect icon in Chrome.'),button('Turn off for this page',()=>disable()));
    showPanel();header.querySelector('button').focus({preventScroll:true});
  }
  function move(delta) {
    if (!items.length) return;
    selected=(selected+delta+items.length)%items.length;
    if(mode==='near'){updateNear();primary.focus({preventScroll:true});}
    else { const b=choices.children[selected];b.focus({preventScroll:true});b.scrollIntoView({block:'nearest',behavior:'instant'}); }
  }
  async function activate(item) {
    if (!item || mode==='idle' || performance.now()<guardUntil) return;
    if (!C.unchanged(item, C.inView(item.el))) { invalid(); return; }
    const target=item.el, activationMode=mode;
    if (!C.inView(target)) {
      close(false); const token=session;
      C.surface(target).scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      if (token!==session || !enabled) return;
      if (!C.unchanged(item,false) || !C.exposed(target)) { tell('This action is not available to select. Check the original page.');return; }
      showNear([C.snapshot(target)]);announcement.textContent='Revealed on page. Confirm to activate.';return;
    }
    close(false);
    if (!C.unchanged(item) || !C.exposed(target)) {tell('This action moved or is covered. Choose it again.');return;}
    target.focus({preventScroll:true});
    if (!C.unchanged(item) || !C.exposed(target)) {tell('The page changed when focused. Choose the action again.');return;}
    guardUntil=performance.now()+400;dispatching=true;
    try { target.click(); } finally {dispatching=false;}
    practiceEvent('activated',item,activationMode);
    if (enabled) scan();
  }
  const observer=new MutationObserver(records=>{
    if (!enabled || !records.some(r=>!C.contains(host,r.target instanceof Element ? r.target : r.target.parentElement))) return;
    if(mode==='near' && items[selected] && !C.unchanged(items[selected]))invalid();
    clearTimeout(refreshTimer);
    if(mode==='idle')refreshTimer=setTimeout(()=>scan(),90);
  });
  function observeRoot(scope) {
    if (observedRoots.has(scope)) return false;
    observer.observe(scope,{subtree:true,childList:true,attributes:true,characterData:true});
    observedRoots.add(scope); return true;
  }
  async function enable() {
    await ready;
    if(enabled)return;
    enabled=true;if(!host.isConnected)document.documentElement.append(host);
    host.showPopover();applySettings();hideLive();
    observeRoot(document.documentElement);
    await scan();
  }
  function disable() {
    enabled=false;scanToken++;clearTimeout(refreshTimer);observer.disconnect();observedRoots=new WeakSet();close(false);hideLive();note.hidden=true;
    if(host.isConnected){host.hidePopover();host.remove();}inventory=[];
  }
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  document.addEventListener('pointermove',e=>{
    if(!enabled)return;overUI=e.composedPath().includes(host);
    if(!overUI)pointer={x:e.clientX,y:e.clientY};
    if(!overUI && mode==='idle' && e.composedPath().some(node=>node instanceof ShadowRoot && observeRoot(node))) scan();
    if(mode==='idle')queuePreview();
  },{passive:true,capture:true});
  document.addEventListener('pointerout',e=>{if(!e.relatedTarget){overUI=true;hideLive();}},true);
  document.addEventListener('click',e=>{if(enabled && !dispatching && performance.now()<guardUntil && !e.composedPath().includes(host) && (!practicePage || document.getElementById('practice-area')?.contains(e.target))){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',e=>{
    if(!enabled || e.isComposing)return;
    const typing=C.editing(e), key=e.key.toLowerCase();
    if (e.repeat && (e.key==='Enter'||e.key===' ' || (!typing && prefs.singleKeys && [prefs.nearKey,prefs.listKey].includes(key)))) {if(!typing){e.preventDefault();e.stopImmediatePropagation();}return;}
    if(mode!=='idle') {
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
      if((mode==='near'||mode==='list')&&(e.key==='ArrowDown'||e.key==='ArrowUp')) {e.preventDefault();e.stopImmediatePropagation();move(mode==='list' && e.composedPath().includes(search) && e.key==='ArrowDown'?0:e.key==='ArrowDown'?1:-1);return;}
      if(!typing && (e.key==='Home'||e.key==='End')) {e.preventDefault();selected=e.key==='Home'?0:items.length-1;move(0);return;}
      if(e.key==='Enter' && mode==='list' && e.composedPath().includes(search)){e.preventDefault();e.stopImmediatePropagation();activate(items[selected]);return;}
      if(key==='/' && !typing && mode==='list'){e.preventDefault();search.focus();return;}
    }
    if(typing || !prefs.singleKeys || e.altKey || e.ctrlKey || e.metaKey)return;
    if(key===prefs.nearKey || key===prefs.listKey){e.preventDefault();e.stopImmediatePropagation();key===prefs.nearKey?openNear():openList();}
  },true);
  const viewportChanged=e=>{
    if(!enabled || (e && e.composedPath().includes(host)))return;
    if(mode==='near')invalid('The page moved. Close and choose the action again.');
    else if(mode==='idle')queuePreview();
  };
  document.addEventListener('scroll',viewportChanged,{passive:true,capture:true});window.addEventListener('resize',viewportChanged);
  window.addEventListener('blur',()=>hideLive());
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local' && changes.preferences){prefs=readPreferences(changes.preferences.newValue);if(mode!=='idle'&&mode!=='settings')close();applySettings();}
    if(area==='local' && changes.toolbarLayout){const layout=changes.toolbarLayout.newValue;toolbarCollapsed=layout?.collapsed===true;toolbarSide=layout?.side==='left'?'left':'right';applyToolbar();}
  });
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(sender.id!==chrome.runtime.id || !message.steadyselect)return;
    (async()=>{
      await ready;
      if(message.action==='disable'||(message.action==='toggle'&&enabled))disable();
      else if(message.action==='enable'||message.action==='toggle')await enable();
      else if(message.action==='near')await openNear();
      else if(message.action==='list')await openList();
      else if(message.action==='settings')await openSettings();
      return {enabled,mode,count:inventory.length};
    })().then(reply,()=>reply({enabled,error:'Could not open assistance on this page.'}));return true;
  });
  if(practicePage) {
    const practiceReady=enable();
    const pointStart=async()=>{await practiceReady;close(false);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const target=document.getElementById('practice-start'),r=target.getBoundingClientRect();pointer={x:r.left+r.width/2,y:r.top+r.height/2};overUI=false;await scan();preview();};
    globalThis.SteadySelectPractice=Object.freeze({
      ready:practiceReady,
      pointStart,
      nearStart:async()=>{await pointStart();await openNear();},
      list:()=>openList(),
      reset:async()=>{await practiceReady;close(false);pointer=null;overUI=true;hideLive();await scan();},
      keys:()=>({near:prefs.nearKey.toUpperCase(),list:prefs.listKey.toUpperCase()})
    });
  }
})();
