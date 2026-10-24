(() => {
  if (globalThis.SteadySelectCore) return;
  const defaults = { liveHighlight: true, singleKeys: false, nearKey: 'k', listKey: 'l', textScale: 1, largeControls: false, radius: 160 };
  const nativeSelector = 'button,a[href],input[type="button"],input[type="submit"],input[type="reset"],input[type="checkbox"],input[type="radio"]';
  const selector = nativeSelector + ',[role~="button" i]';
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const customButton = el => clean(el.getAttribute('role')).toLowerCase().split(' ')[0] === 'button';
  const parent = el => el.assignedSlot || el.parentElement || el.getRootNode()?.host;
  function closest(el, selector) {
    for (let node = el; node instanceof Element; node = parent(node)) if (node.matches(selector)) return node;
    return null;
  }
  function contains(el, child) {
    for (let node = child; node instanceof Element; node = parent(node)) if (node === el) return true;
    return false;
  }
  function* elements() {
    const pending = [document.documentElement];
    while (pending.length) {
      const node = pending.pop();
      if (node.matches('[data-steadyselect-root]')) continue;
      yield node;
      const children = [...node.children, ...(node.shadowRoot?.children || [])];
      for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
    }
  }
  function activeElement() {
    let node = document.activeElement;
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    return node;
  }
  function visible(el) {
    if (!el.checkVisibility({ checkOpacity:true, checkVisibilityCSS:true, contentVisibilityAuto:true })) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  function surface(el) {
    if (el.matches('input[type="checkbox"],input[type="radio"]') && !visible(el)) {
      // Styled inputs often use a visible associated label as their mouse target.
      return [...(el.labels || [])].find(l => visible(l) && !closest(l, '[data-steadyselect-root],[inert],[hidden],[aria-disabled="true"]')) || el;
    }
    return el;
  }
  function stateHint(el) {
    if (el.matches('input[type="checkbox"],input[type="radio"]')) return el.checked ? 'Checked' : 'Not checked';
    return { true:'Pressed', false:'Not pressed', mixed:'Mixed' }[el.getAttribute('aria-pressed')] || '';
  }
  function controlHint(el) {
    if (customButton(el) || el.matches('button,input[type="button"],input[type="submit"],input[type="reset"]')) return stateHint(el) ? 'Toggle button' : 'Button on this page';
    return el.matches('a') ? 'Link on this page' : 'Control on this page';
  }
  function settings(value = {}) {
    const s = { ...defaults };
    for (const k of ['liveHighlight', 'singleKeys', 'largeControls']) if (typeof value[k] === 'boolean') s[k] = value[k];
    if ([1, 1.25, 1.5].includes(value.textScale)) s.textScale = value.textScale;
    if ([100, 160, 240].includes(value.radius)) s.radius = value.radius;
    if (/^[a-z0-9]$/i.test(value.nearKey || '') && /^[a-z0-9]$/i.test(value.listKey || '') && value.nearKey.toLowerCase() !== value.listKey.toLowerCase()) {
      s.nearKey = value.nearKey.toLowerCase(); s.listKey = value.listKey.toLowerCase();
    }
    return s;
  }
  function label(el) {
    const scope = el.getRootNode();
    const by = clean(el.getAttribute('aria-labelledby')).split(' ').filter(Boolean).map(id => clean(scope.getElementById?.(id)?.textContent)).filter(Boolean).join(' ');
    return by || clean(el.getAttribute('aria-label')) || [...(el.labels || [])].map(l => clean(l.innerText)).filter(Boolean).join(' ') || clean(el.innerText) || [...el.querySelectorAll('img[alt]')].map(img => clean(img.alt)).join(' ') || (el.matches('input[type="button"],input[type="submit"],input[type="reset"]') ? clean(el.value) || (el.type === 'submit' ? 'Submit' : el.type === 'reset' ? 'Reset' : '') : '') || clean(el.getAttribute('title'));
  }
  function context(el) {
    const row = closest(el, 'tr');
    if (row) return clean(row.querySelector('th,td')?.innerText).slice(0, 180);
    const group = closest(el, 'fieldset,section,article,[role="group"],[role="region"],[data-steady-context]');
    if (!group) return '';
    return clean(group.getAttribute('data-steady-context') || group.getAttribute('aria-label') || group.querySelector('legend,h1,h2,h3,h4')?.innerText).slice(0, 180);
  }
  function eligible(el) {
    if (!(el instanceof HTMLElement) || !el.isConnected || (!el.matches(nativeSelector) && !customButton(el)) || closest(el, '[data-steadyselect-root],[inert],[hidden],[aria-hidden="true"],[aria-disabled="true"]') || el.matches(':disabled')) return false;
    if (el.matches('a') && ((!el.getAttribute('href') && !customButton(el)) || /^javascript:/i.test((el.getAttribute('href') || '').trim()))) return false;
    if (closest(el, 'details:not([open])') && !closest(el, 'summary')) return false;
    return visible(surface(el));
  }
  function inView(el) {
    const r = surface(el).getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }
  function exposed(el) {
    if (!eligible(el) || !inView(el)) return false;
    const visual = surface(el), r = visual.getBoundingClientRect();
    const left = Math.max(0, r.left), right = Math.min(innerWidth, r.right), top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    for (const [x, y] of [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]]) {
      const stack = document.elementsFromPoint(left + (right - left) * x, top + (bottom - top) * y);
      let hit = stack.find(e => !closest(e, '[data-steadyselect-root]'));
      const visited = new Set();
      while (hit?.shadowRoot && !visited.has(hit.shadowRoot)) {
        const scope = hit.shadowRoot; visited.add(scope);
        const inner = scope.elementsFromPoint(left + (right - left) * x, top + (bottom - top) * y)
          .find(e => e !== hit && !contains(e, hit) && !closest(e, '[data-steadyselect-root]'));
        if (!inner) break;
        hit = inner;
      }
      if (hit && (contains(el, hit) || contains(visual, hit))) return true;
    }
    return false;
  }
  function distance(el, point) {
    const r = surface(el).getBoundingClientRect();
    return Math.hypot(Math.max(r.left - point.x, 0, point.x - r.right), Math.max(r.top - point.y, 0, point.y - r.bottom));
  }
  function signature(el) {
    return JSON.stringify([label(el), context(el), el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('href'), el.href, el.getAttribute('target'), el.getAttribute('type'), el.getAttribute('name'), el.getAttribute('formaction'), el.formAction, el.form?.action, el.form?.method, el.getAttribute('aria-pressed'), el.getAttribute('aria-checked'), el.matches('input') ? [el.checked, el.value] : null]);
  }
  function snapshot(el) {
    const visual = surface(el), r = visual.getBoundingClientRect();
    return { el, visual, label: label(el), context: context(el), signature: signature(el), rect: [r.x, r.y, r.width, r.height] };
  }
  function unchanged(item, geometry = true) {
    if (!eligible(item.el) || surface(item.el) !== item.visual || signature(item.el) !== item.signature) return false;
    const r = item.visual.getBoundingClientRect();
    return !geometry || [r.x, r.y, r.width, r.height].every((v, i) => Math.abs(v - item.rect[i]) <= 2);
  }
  function editing(event) {
    return event.composedPath().some(el => el instanceof Element && (el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]),textarea,select,[role="textbox"],[role="searchbox"],[role="combobox"],[role="spinbutton"]') || el.isContentEditable));
  }
  globalThis.SteadySelectCore = { defaults, settings, selector, clean, closest, contains, elements, activeElement, surface, label, context, stateHint, controlHint, eligible, inView, exposed, distance, snapshot, unchanged, editing };
})();
