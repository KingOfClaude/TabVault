const DEF = { autoMin: 5, autoKeep: 10, closedKeep: 20, saveClosed: true, theme: 'auto', lazy: true, saveIp: false, warn: true };
const L = {
  async settings() {
    const st = (await chrome.storage.local.get('settings')).settings || {};
    const out = { ...DEF, ...st };
    if (st.saveIp === undefined && st.ipMode === 'always') out.saveIp = true; // migrate the old Ask/Always/Never setting
    return out;
  },
  async sessions() { return (await chrome.storage.local.get('sessions')).sessions || []; },
  put(sessions) { return chrome.storage.local.set({ sessions }); },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  ok(u) { return u && !/^(chrome:\/\/newtab|chrome-extension:|devtools:|about:blank)/.test(u); },
  pack(tabs, gm = {}) {
    const list = tabs.filter(t => L.ok(t.url || t.pendingUrl)).map(t => ({
      url: t.url || t.pendingUrl, title: t.title || t.url, pinned: !!t.pinned,
      fav: (t.favIconUrl || '').startsWith('http') ? t.favIconUrl : '',
      group: t.groupId >= 0 ? t.groupId : -1
    }));
    const used = new Set(list.map(t => t.group));
    return { tabs: list, groups: Object.fromEntries(Object.entries(gm).filter(([k]) => used.has(+k))) };
  },
  async capture(winId) {
    const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const gm = Object.fromEntries((await chrome.tabGroups.query({})).map(g => [g.id, { title: g.title, color: g.color }]));
    return wins.filter(w => winId == null || w.id === winId)
      .map(w => ({ id: w.id, ...L.pack(w.tabs, gm) })).filter(w => w.tabs.length);
  },
  sig: wins => wins.map(w => w.tabs.map(t => t.url).join('\n')).join('||'),
  async add(windows, o = {}) {
    if (!windows.length) return null;
    const env = await L.env(o);
    const s = await L.sessions();
    const n = { id: L.uid(), name: o.name || new Date().toLocaleString(), created: Date.now(),
      type: o.type || 'manual', pinned: false, tags: [], note: '', windows, env };
    s.unshift(n); await L.put(s); return n;
  },
  async prune() {
    const st = await L.settings(); let s = await L.sessions();
    for (const [type, keep] of [['auto', st.autoKeep], ['closed', st.closedKeep]]) {
      let c = 0; s = s.filter(x => x.type !== type || x.pinned || ++c <= keep);
    }
    await L.put(s);
  },
  async _key(pw, salt) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, k,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  _b64: b => { let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  _un: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)),
  async seal(windows, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await L._key(pw, salt), new TextEncoder().encode(JSON.stringify(windows)));
    return { salt: L._b64(salt), iv: L._b64(iv), ct: L._b64(ct) };
  },
  async unseal(e, pw) { // throws if the password is wrong
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: L._un(e.iv) }, await L._key(pw, L._un(e.salt)), L._un(e.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  },
  parseUA(ua) {
    const rules = [['Edge', /Edg\/(\d+)/], ['Opera', /OPR\/(\d+)/], ['Firefox', /Firefox\/(\d+)/], ['Chrome', /Chrome\/(\d+)/], ['Safari', /Version\/(\d+).*Safari/]];
    let browser = 'Unknown', version = '';
    for (const [name, re] of rules) { const m = ua.match(re); if (m) { browser = name; version = m[1]; break; } }
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS'
      : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
    return { browser, version, os };
  },
  async ip(o = {}) { // public IP via api64.ipify.org, only when the "Store public IP address" setting is on
    if (!(await L.settings()).saveIp) return null;
    const { ipc } = await chrome.storage.session.get('ipc');
    if (!o.fresh && ipc && Date.now() - ipc.t < 6e5) return ipc.ip;
    try {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 4000);
      const r = await fetch('https://api64.ipify.org?format=json', { signal: ac.signal, cache: 'no-store' });
      clearTimeout(tm);
      const ip = (await r.json()).ip;
      await chrome.storage.session.set({ ipc: { ip, t: Date.now() } });
      return ip;
    } catch { return ipc && Date.now() - ipc.t < 36e5 ? ipc.ip : null; }
  },
  async env(o = {}) { const ua = navigator.userAgent; return { ua, ...L.parseUA(ua), ip: await L.ip(o) }; },
  diff(a, b) { // human-readable differences between a saved env and the current one
    if (!a || !b) return [];
    const d = [];
    if (a.browser !== b.browser) d.push(`Browser: saved in ${a.browser}, now ${b.browser}`);
    if (a.os !== b.os) d.push(`System: saved on ${a.os}, now ${b.os}`);
    if (a.ip && b.ip && a.ip !== b.ip) d.push(`IP address: saved with ${a.ip}, now ${b.ip}`);
    return d;
  },
  send: m => chrome.runtime.sendMessage(m)
};
