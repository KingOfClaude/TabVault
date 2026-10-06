const $ = s => document.querySelector(s);
const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = s => s.enc ? s.count : s.windows.reduce((a, w) => a + w.tabs.length, 0);
const wc = s => s.enc ? s.wn : s.windows.length;
const ago = t => { const m = (Date.now() - t) / 6e4; return m < 60 ? ~~m + 'm ago' : m < 1440 ? ~~(m / 60) + 'h ago' : ~~(m / 1440) + 'd ago'; };
const host = u => { try { return new URL(u).hostname; } catch { return ''; } };
const key = u => u.split('#')[0];
let S = [], ST, cur = null, filter = 'all', q = '', now = null;
const sel = new Set(), open = {}; // open: decrypted windows of unlocked sessions, memory only
function askPw(title, confirm, hint = '') {
  return new Promise(res => {
    const d = $('#pw'); $('#pwt').textContent = title; $('#pwh').textContent = hint; $('#pwe').textContent = '';
    $('#p1').value = $('#p2').value = ''; $('#p2row').hidden = !confirm; d.showModal(); $('#p1').focus();
    const done = v => { d.close(); res(v); };
    $('#pwok').onclick = () => {
      if (!$('#p1').value) return $('#pwe').textContent = 'Enter a password.';
      if (confirm && $('#p1').value !== $('#p2').value) return $('#pwe').textContent = 'Passwords do not match.';
      done($('#p1').value);
    };
    $('#pwcx').onclick = () => done(null); d.oncancel = () => res(null);
    d.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('#pwok').click(); } };
  });
}

async function load() { S = await L.sessions(); ST = await L.settings(); document.documentElement.dataset.theme = ST.theme; draw();
  if (!now) L.env({}).then(x => { now = x; draw(); }); }
const tabHit = t => !q || (t.title + ' ' + t.url).toLowerCase().includes(q);
const hit = s => !q || (s.name + ' ' + s.tags.join(' ') + ' ' + s.note).toLowerCase().includes(q) || s.windows.some(w => w.tabs.some(tabHit));

function draw() {
  $('#tabs').innerHTML = ['all', 'manual', 'auto', 'closed', 'pinned'].map(f =>
    `<button data-f="${f}" class="${f === filter ? 'on' : ''}">${f}</button>`).join('');
  const list = S.filter(s => (filter === 'all' || (filter === 'pinned' ? s.pinned : s.type === filter)) && hit(s))
    .sort((a, b) => b.pinned - a.pinned);
  $('#list').innerHTML = list.map(s => `<div class="item ${s.id === cur ? 'on' : ''}" tabindex="0" data-id="${s.id}">
    <b>${s.enc ? '🔒 ' : ''}${s.pinned ? '📌 ' : ''}${e(s.name)}${ST.warn && now && L.diff(s.env, now).length ? ' <span title="Saved in a different browser, system or IP than you are using now">⚠</span>' : ''}</b><small>${n(s)} tabs, ${wc(s)} window${wc(s) > 1 ? 's' : ''}, ${ago(s.created)}, ${s.type}</small>
    ${s.tags.map(t => `<span class="chip" data-tag="${e(t)}">${e(t)}</span>`).join('')}</div>`).join('') || '<p class="empty">No sessions match. Save your open tabs to create one.</p>';
  detail();
}

function envBox(s) {
  const v = s.env; if (!v) return '<p class="env mut">Origin unknown (saved before origin tracking).</p>';
  const d = ST.warn && now ? L.diff(v, now) : [];
  return `<p class="env mut" title="${e(v.ua)}">Saved in ${e(v.browser)} ${e(v.version)} on ${e(v.os)}${v.ip ? ', IP ' + e(v.ip) : ', IP not recorded'}</p>` +
    (d.length ? `<div class="warn"><b>Different from your current setup</b><br>${d.map(x => e(x)).join('<br>')}<br><span class="mut">Sites may sign you out or block requests after restoring.</span></div>` : '');
}
function detail() {
  const s0 = S.find(x => x.id === cur), d = $('#detail');
  if (!s0) { d.innerHTML = '<p class="empty">Select a session to view, edit, or restore it.</p>'; return; }
  const head = `<div class="bar"><input id="nm" value="${e(s0.name)}"><button data-a="pin">${s0.pinned ? 'Unpin' : 'Pin'}</button><button class="danger" data-a="del">Delete</button></div>
  <div class="bar"><input id="tg" placeholder="Tags, comma separated" value="${e(s0.tags.join(', '))}"><input id="nt" placeholder="Notes" value="${e(s0.note)}"></div>${envBox(s0)}`;
  if (s0.enc && !open[s0.id]) {
    d.innerHTML = head + `<div class="lock"><b>🔒 This session is locked</b>
      <p class="mut">${n(s0)} tabs in ${wc(s0)} window${wc(s0) > 1 ? 's' : ''}. Tab titles and URLs are encrypted and can't be searched. The name, tags and notes above are not encrypted.</p>
      <button class="pri" data-a="unlock">Unlock</button></div>`;
    return;
  }
  const locked = !!s0.enc, s = locked ? { ...s0, windows: open[s0.id] } : s0;
  const seen = new Set(); let dups = 0;
  s.windows.forEach(w => w.tabs.forEach(t => { seen.has(key(t.url)) ? dups++ : seen.add(key(t.url)); }));
  d.innerHTML = head + `
  <div class="bar"><button class="pri" data-a="rall">Restore all</button><button data-a="rsel">Restore selected (${sel.size})</button>
    <label><input type="checkbox" id="lz" ${ST.lazy ? 'checked' : ''}> Lazy load</label><label><input type="checkbox" id="cw"> In current window</label></div>
  <div class="bar">${locked ? `<button data-a="relock">Hide contents</button><button data-a="unprot">Remove password</button>` :
    `<button data-a="lock">Lock with password</button><button data-a="dd">Remove duplicates (${dups})</button>
    <select id="mg"><option value="">Merge into…</option>${S.filter(x => x.id !== s.id && !x.enc).map(x => `<option value="${x.id}">${e(x.name)}</option>`).join('')}</select>`}
    <button data-a="md">Copy as Markdown</button><button data-a="js">Export${locked ? ' (encrypted)' : ''}</button><button data-a="all">Select all</button><button data-a="none">Clear</button></div>
  ${s.windows.map((w, wi) => `<div class="win">Window ${wi + 1} <small style="display:inline">${w.tabs.length} tabs</small></div>` +
    w.tabs.map((t, ti) => !tabHit(t) ? '' : `<div class="tab"><input type="checkbox" data-k="${wi}:${ti}" ${sel.has(wi + ':' + ti) ? 'checked' : ''}>
      ${t.fav ? `<img src="${e(t.fav)}" alt="">` : '<i></i>'}
      ${t.pinned ? '📌' : ''}${t.group >= 0 && w.groups[t.group] ? `<span class="chip" style="border-color:${w.groups[t.group].color}">${e(w.groups[t.group].title || 'group')}</span>` : ''}
      <a data-o="${e(t.url)}" title="${e(t.url)}">${e(t.title)}</a><small>${e(host(t.url))}</small>
      ${locked ? '' : `<button class="x" data-a="x" data-k="${wi}:${ti}" aria-label="Remove tab">✕</button>`}</div>`).join('')).join('')}`;
}

const edit = async fn => { const s = S.find(x => x.id === cur); fn(s); await L.put(S); };
const dl = (name, text, type = 'application/json') => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
};
const md = s => `# ${s.name}\n\n` + s.windows.map((w, i) => `## Window ${i + 1}\n` + w.tabs.map(t => `- [${t.title.replace(/[\[\]]/g, '')}](${t.url})`).join('\n')).join('\n\n');
const restore = async (id, keys) => {
  const opts = { sel: keys, lazy: $('#lz')?.checked, mode: $('#cw')?.checked ? 'current' : 'new' };
  const s = S.find(x => x.id === id);
  if (ST.warn && s?.env) {
    now = await L.env({ fresh: true }); const d = L.diff(s.env, now);
    if (d.length && !confirm('This session was saved in a different environment:\n\n• ' + d.join('\n• ') + '\n\nSites may sign you out or block requests. Restore anyway?')) return;
  }
  L.send({ cmd: 'restore', id, session: open[id] ? { windows: open[id] } : undefined, opts });
};

document.addEventListener('click', async ev => {
  const t = ev.target, f = t.closest('[data-f]'), it = t.closest('.item'), ch = t.closest('[data-tag]'), a = t.closest('[data-a]')?.dataset.a;
  if (ch) { $('#q').value = q = ch.dataset.tag.toLowerCase(); return draw(); }
  if (f) { filter = f.dataset.f; return draw(); }
  if (it) { cur = it.dataset.id; sel.clear(); return draw(); }
  if (t.dataset.o) return chrome.tabs.create({ url: t.dataset.o, active: false });
  if (t.dataset.k && t.type === 'checkbox') { t.checked ? sel.add(t.dataset.k) : sel.delete(t.dataset.k); return detail(); }
  const s = S.find(x => x.id === cur);
  switch (a) {
    case 'rall': restore(s.id, null); break;
    case 'rsel': if (sel.size) restore(s.id, [...sel]); break;
    case 'pin': await edit(s => s.pinned = !s.pinned); break;
    case 'del': if (confirm(`Delete "${s.name}"?`)) { S = S.filter(x => x !== s); cur = null; await L.put(S); } break;
    case 'x': { const [wi, ti] = t.dataset.k.split(':').map(Number);
      await edit(s => { s.windows[wi].tabs.splice(ti, 1); s.windows = s.windows.filter(w => w.tabs.length); });
      if (!s.windows.length) { S = S.filter(x => x !== s); cur = null; await L.put(S); } sel.clear(); break; }
    case 'dd': await edit(s => { const seen = new Set(); s.windows.forEach(w => w.tabs = w.tabs.filter(t => !seen.has(key(t.url)) && seen.add(key(t.url)))); }); break;
    case 'md': await navigator.clipboard.writeText(md(s.enc ? { ...s, windows: open[s.id] } : s)); t.textContent = 'Copied'; break;
    case 'lock': { const pw = await askPw('Lock "' + s.name + '"', true, 'Contents are encrypted with this password. It cannot be recovered if you forget it.'); if (!pw) break;
      const count = n(s), wn = s.windows.length, enc = await L.seal(s.windows, pw);
      await edit(s => { s.enc = enc; s.count = count; s.wn = wn; s.windows = []; }); delete open[s.id]; sel.clear(); break; }
    case 'unlock': { const pw = await askPw('Unlock "' + s.name + '"'); if (!pw) break;
      try { open[s.id] = await L.unseal(s.enc, pw); const id = s.id; setTimeout(() => { delete open[id]; detail(); }, 5 * 60e3); draw(); }
      catch { alert('Wrong password.'); } break; }
    case 'relock': delete open[s.id]; sel.clear(); draw(); break;
    case 'unprot': { const pw = await askPw('Remove password from "' + s.name + '"'); if (!pw) break;
      try { const w = await L.unseal(s.enc, pw); delete open[s.id]; await edit(s => { s.windows = w; delete s.enc; delete s.count; delete s.wn; }); }
      catch { alert('Wrong password.'); } break; }
    case 'js': dl(s.name.replace(/\W+/g, '-') + '.json', JSON.stringify([s], null, 1)); break;
    case 'all': s.windows.forEach((w, wi) => w.tabs.forEach((_, ti) => sel.add(wi + ':' + ti))); detail(); break;
    case 'none': sel.clear(); detail(); break;
  }
});
document.addEventListener('change', async ev => {
  const t = ev.target; if (!cur) return;
  if (t.id === 'nm') await edit(s => s.name = t.value.trim() || s.name);
  if (t.id === 'tg') await edit(s => s.tags = t.value.split(',').map(x => x.trim()).filter(Boolean));
  if (t.id === 'nt') await edit(s => s.note = t.value);
  if (t.id === 'mg' && t.value && confirm('Merge this session into the selected one and delete this one?')) {
    const tgt = S.find(x => x.id === t.value), s = S.find(x => x.id === cur);
    tgt.windows.push(...s.windows); S = S.filter(x => x !== s); cur = tgt.id; await L.put(S);
  }
});
$('#q').oninput = ev => { q = ev.target.value.toLowerCase(); draw(); };
document.addEventListener('keydown', ev => { if (ev.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { ev.preventDefault(); $('#q').focus(); } });
$('#save').onclick = async () => L.send({ cmd: 'save', scope: 'all' });
$('#exp').onclick = () => dl('tabvault-backup.json', JSON.stringify(S, null, 1));
$('#imp').onclick = () => $('#file').click();
$('#file').onchange = async ev => {
  try {
    const arr = [].concat(JSON.parse(await ev.target.files[0].text())).filter(x => x.windows);
    S = [...arr.map(x => ({ ...x, id: L.uid() })), ...S]; await L.put(S);
  } catch { alert('That file is not a Tab Vault export.'); }
};
$('#set').onclick = () => {
  [ST.autoMin, ST.autoKeep, ST.closedKeep].forEach((v, i) => $('#s' + (i + 1)).value = v);
  $('#s4').checked = ST.saveClosed; $('#s5').checked = ST.lazy; $('#s6').value = ST.theme; $('#s7').checked = ST.saveIp; $('#s8').checked = ST.warn; $('#dlg').showModal();
};
$('#cx').onclick = () => $('#dlg').close();
$('#ok').onclick = async () => {
  await chrome.storage.local.set({ settings: { autoMin: +$('#s1').value || 5, autoKeep: +$('#s2').value || 10, closedKeep: +$('#s3').value || 20,
    saveClosed: $('#s4').checked, lazy: $('#s5').checked, theme: $('#s6').value, saveIp: $('#s7').checked, warn: $('#s8').checked } });
  await L.send({ cmd: 'alarm' }); $('#dlg').close(); now = null; load();
};
chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.sessions) load(); });
load();
