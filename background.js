importScripts('lib.js');

async function setAlarm() {
  const st = await L.settings();
  chrome.alarms.create('auto', { periodInMinutes: Math.max(1, st.autoMin) });
}
async function autoSave() {
  const w = await L.capture(); if (!w.length) return;
  const last = (await L.sessions()).find(x => x.type === 'auto');
  if (last && L.sig(last.windows) === L.sig(w)) return; // nothing changed
  await L.add(w, { type: 'auto', name: 'Auto-save ' + new Date().toLocaleString() });
  await L.prune();
}
function flash() { chrome.action.setBadgeText({ text: '✓' }); setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500); }

// Cache open windows so a closed window can be recovered after it is gone.
let timer;
const cache = () => { clearTimeout(timer); timer = setTimeout(async () =>
  chrome.storage.session.set({ cache: await L.capture() }), 1500); };
['onCreated', 'onUpdated', 'onMoved', 'onAttached', 'onDetached'].forEach(e => chrome.tabs[e].addListener(cache));
chrome.tabs.onRemoved.addListener((_, i) => { if (!i.isWindowClosing) cache(); });
chrome.tabGroups.onUpdated.addListener(cache);
chrome.windows.onRemoved.addListener(async id => {
  const st = await L.settings(); if (!st.saveClosed) return;
  const { cache: c = [] } = await chrome.storage.session.get('cache');
  const w = c.find(x => x.id === id);
  if (w && w.tabs.length >= 2) {
    await L.add([w], { type: 'closed', name: 'Closed window ' + new Date().toLocaleString() });
    await L.prune();
  }
  cache();
});

chrome.alarms.onAlarm.addListener(a => a.name === 'auto' && autoSave());
chrome.runtime.onInstalled.addListener(() => {
  setAlarm(); cache();
  chrome.contextMenus.create({ id: 'stash', title: 'Stash this tab (save and close)', contexts: ['page', 'action'] });
});
chrome.runtime.onStartup.addListener(() => { setAlarm(); cache(); });
chrome.commands.onCommand.addListener(async c => {
  if (c === 'save-all') { await L.add(await L.capture(), { fresh: true }); flash(); }
});
chrome.contextMenus.onClicked.addListener(async (i, tab) => {
  if (i.menuItemId !== 'stash' || !tab) return;
  const { tabs } = L.pack([tab]); if (!tabs.length) return;
  const s = await L.sessions();
  const st = s.find(x => x.name === 'Stash' && x.type === 'manual' && !x.enc);
  if (st) { st.windows[0].tabs.push(...tabs); await L.put(s); }
  else await L.add([{ tabs, groups: {} }], { name: 'Stash' });
  chrome.tabs.remove(tab.id); flash();
});

async function restore(s, o = {}) {
  for (let wi = 0; wi < s.windows.length; wi++) {
    const w = s.windows[wi];
    const items = w.tabs.filter((_, i) => !o.sel || o.sel.includes(wi + ':' + i));
    if (!items.length) continue;
    const cur = o.mode === 'current';
    const win = cur ? await chrome.windows.getLastFocused({ windowTypes: ['normal'] })
                    : await chrome.windows.create({ url: items[0].url });
    const ids = [];
    for (let k = 0; k < items.length; k++) {
      const t = items[k]; let tab;
      if (k === 0 && !cur) { tab = win.tabs[0]; if (t.pinned) await chrome.tabs.update(tab.id, { pinned: true }); }
      else tab = await chrome.tabs.create({ windowId: win.id, url: t.url, pinned: t.pinned, active: false });
      ids.push(tab.id);
    }
    const by = {};
    items.forEach((t, k) => { if (t.group >= 0 && !t.pinned) (by[t.group] ||= []).push(ids[k]); });
    for (const g in by) {
      const gid = await chrome.tabs.group({ tabIds: by[g], createProperties: { windowId: win.id } });
      const m = w.groups[g] || {};
      await chrome.tabGroups.update(gid, { title: m.title || '', color: m.color || 'grey' });
    }
    if (o.lazy) ids.slice(cur ? 0 : 1).forEach(id => chrome.tabs.discard(id).catch(() => {}));
  }
}
async function dedupe() {
  const tabs = (await chrome.tabs.query({})).sort((a, b) => (b.pinned - a.pinned) || (b.active - a.active));
  const seen = new Set(), rm = [];
  for (const t of tabs) {
    if (!/^https?:/.test(t.url || '')) continue;
    const k = t.url.split('#')[0];
    seen.has(k) ? rm.push(t.id) : seen.add(k);
  }
  await chrome.tabs.remove(rm); return rm.length;
}

chrome.runtime.onMessage.addListener((m, _, res) => {
  (async () => {
    if (m.cmd === 'save') {
      const id = m.scope === 'window' ? (await chrome.windows.getLastFocused({ windowTypes: ['normal'] })).id : null;
      const w = await L.capture(id);
      res({ n: w.reduce((a, x) => a + x.tabs.length, 0), ok: !!(await L.add(w, { name: m.name || undefined, fresh: true })) });
    } else if (m.cmd === 'restore') {
      const s = m.session || (await L.sessions()).find(x => x.id === m.id); if (s) await restore(s, m.opts); res({ ok: true });
    } else if (m.cmd === 'dedupe') res({ n: await dedupe() });
    else if (m.cmd === 'alarm') { await setAlarm(); res({ ok: true }); }
  })();
  return true;
});
