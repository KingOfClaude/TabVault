const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = t => $('#msg').textContent = t;
let S = [];
async function recent() {
  S = await L.sessions(); const s = S.slice(0, 5);
  $('#r').innerHTML = s.map(x => `<div class="item" data-id="${x.id}"><b>${x.enc ? '🔒 ' : ''}${esc(x.name)}</b>
    <small>${x.enc ? x.count : x.windows.reduce((a, w) => a + w.tabs.length, 0)} tabs, ${x.enc ? 'locked: opens manager' : 'click to restore'}</small></div>`).join('');
}
const save = async scope => {
  const r = await L.send({ cmd: 'save', scope, name: $('#nm').value.trim() });
  say(r.ok ? `Saved ${r.n} tabs` : 'No savable tabs found'); $('#nm').value = ''; recent();
};
$('#all').onclick = () => save('all');
$('#win').onclick = () => save('window');
$('#dd').onclick = async () => say(`Closed ${(await L.send({ cmd: 'dedupe' })).n} duplicate tabs`);
$('#mg').onclick = () => { chrome.tabs.create({ url: 'manager.html' }); close(); };
$('#r').onclick = async e => { const i = e.target.closest('.item'); if (!i) return;
  if (S.find(x => x.id === i.dataset.id)?.enc) { chrome.tabs.create({ url: 'manager.html' }); return close(); }
  const s = S.find(x => x.id === i.dataset.id);
  if (s?.env && (await L.settings()).warn && L.diff(s.env, await L.env({})).length) { chrome.tabs.create({ url: 'manager.html' }); return close(); }
  L.send({ cmd: 'restore', id: i.dataset.id, opts: { lazy: true } }); close(); };
recent();
