const COLS = [
  { id: 'todo',       label: 'To do' },
  { id: 'waiting',    label: 'Čeka odgovor' },
  { id: 'inprogress', label: 'U tijeku' },
  { id: 'done',       label: 'Riješeno' }
];

const TAG_CLASSES = {
  'Support':   't-support',
  'Bug':       't-bug',
  'Feature':   't-feature',
  'Billing':   't-billing',
  'Follow-up': 't-followup',
  'Check-in':  't-checkin'
};

const STORAGE_KEY = 'cs_dashboard_tasks_v1';
const API_KEY_STORAGE = 'cs_dashboard_apikey';

let tasks = [];
let nextId = 1;
let addColId = 'todo';
let detailId = null;
let generatedText = '';
let pendingClient = '';
let pendingType = '';

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : getSampleTasks();
  } catch (e) {
    tasks = getSampleTasks();
  }
  nextId = tasks.length ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
}

function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) {}
}

function getSampleTasks() {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const addDays = n => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };
  return [
    { id: 1, title: 'Login problem — korisnik ne može pristupiti', client: 'Acme d.o.o.', tag: 'Support', status: 'waiting', due: addDays(3), note: 'Poslao mail supportu 14.6. Ticket #4421. Pratiti do kraja tjedna.' },
    { id: 2, title: 'Faktura nije stigla na mail', client: 'Beta Systems', tag: 'Billing', status: 'todo', due: addDays(1), note: '' },
    { id: 3, title: 'Export PDF greška na Firefox', client: 'Gamma Tech', tag: 'Bug', status: 'inprogress', due: addDays(7), note: 'Repro: klik Export > PDF na Firefox 126. Dev tim informiran.' }
  ];
}

function today() { return new Date().toISOString().split('T')[0]; }

function dueLabel(due) {
  if (!due) return null;
  const d = new Date(due), t = new Date(today());
  const diff = Math.round((d - t) / 864e5);
  if (diff < 0)  return { text: `${-diff}d zakašnjelo`, over: true };
  if (diff === 0) return { text: 'Danas', over: false };
  if (diff <= 3)  return { text: `Za ${diff}d`, over: false };
  return { text: due.split('-').reverse().join('.'), over: false };
}

function updateHeaderStats() {
  const open = tasks.filter(t => t.status !== 'done').length;
  const over = tasks.filter(t => t.status !== 'done' && t.due && new Date(t.due) < new Date(today())).length;
  document.getElementById('hdr-open').textContent = open;
  document.getElementById('hdr-over').textContent = over;
  const badge = document.getElementById('kb-badge');
  if (open > 0) { badge.textContent = open; badge.style.display = 'inline'; }
  else badge.style.display = 'none';
}

// ── TABS ────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
  if (tab === 'kb') renderBoard();
}

// ── TOUCHPOINT GENERATOR ────────────────────────────────────────────────────

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

function saveApiKey() {
  const key = document.getElementById('apikey-input').value.trim();
  if (!key) return;
  localStorage.setItem(API_KEY_STORAGE, key);
  document.getElementById('apikey-modal').classList.remove('open');
  generateTP();
}

async function generateTP() {
  const raw = document.getElementById('tp-raw').value.trim();
  if (!raw) { document.getElementById('tp-raw').focus(); return; }

  const apiKey = getApiKey();
  if (!apiKey) {
    document.getElementById('apikey-modal').classList.add('open');
    document.getElementById('apikey-input').focus();
    return;
  }

  const client = document.getElementById('tp-client').value.trim();
  const type   = document.getElementById('tp-type').value;
  pendingClient = client;
  pendingType   = type;

  const wrap   = document.getElementById('tp-result-wrap');
  const output = document.getElementById('tp-result');
  const btn    = document.getElementById('btn-generate');

  wrap.style.display = 'block';
  output.className = 'tp-output loading';
  output.textContent = 'Generiram touchpoint...';
  document.getElementById('feedback-msg').textContent = '';
  document.getElementById('result-client-label').textContent = client || '';
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader"></i> Generiram...';

  const prompt = `Ti si Customer Success Manager koji piše touchpoint zabilješke za Totango.

Klijent: ${client || '(nije naveden)'}
Vrsta interakcije: ${type}
Opis situacije: ${raw}

Napiši strukturiran touchpoint na hrvatskom jeziku u 4-6 rečenica. Obuhvati:
- Što se dogodilo / kontekst
- Akcija koja je poduzeta
- Sljedeći korak / follow-up (ako postoji)

Piši profesionalno ali jasno. Bez naslova, bez bullet točaka — samo čisti tekst koji se direktno kopira u Totango. Bez markdown formatiranja.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (res.status === 401) {
      localStorage.removeItem(API_KEY_STORAGE);
      output.className = 'tp-output loading';
      output.textContent = 'Neispravan API ključ. Pokušaj ponovo.';
      setTimeout(() => {
        document.getElementById('apikey-modal').classList.add('open');
        document.getElementById('apikey-input').value = '';
        document.getElementById('apikey-input').focus();
      }, 800);
      return;
    }

    const data = await res.json();
    generatedText = data.content?.[0]?.text || 'Greška pri generiranju.';
    output.className = 'tp-output';
    output.textContent = generatedText;
  } catch (e) {
    output.className = 'tp-output loading';
    output.textContent = 'Greška pri pozivu API-ja. Provjeri internet vezu.';
    generatedText = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-sparkles"></i> Generiraj touchpoint';
  }
}

function copyTP() {
  if (!generatedText) return;
  navigator.clipboard.writeText(generatedText).then(() => {
    showFeedback('Kopirano! Zalijepi u Totango.', false);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = generatedText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showFeedback('Kopirano! Zalijepi u Totango.', false);
  });
}

function addToBoard() {
  if (!generatedText) return;
  const rawVal = document.getElementById('tp-raw').value.trim();
  const title  = rawVal.length > 65 ? rawVal.slice(0, 62) + '...' : rawVal;
  const due    = document.getElementById('tp-due').value;
  const tag    = pendingType === 'Check-in' ? 'Follow-up' : pendingType;

  tasks.push({
    id: nextId++,
    title,
    client: pendingClient || 'Klijent',
    tag,
    status: 'todo',
    due,
    note: generatedText
  });
  saveTasks();
  updateHeaderStats();
  showFeedback('Dodano u board! Prebaci se na Board tab.', true);
}

function showFeedback(msg, success) {
  const el = document.getElementById('feedback-msg');
  el.textContent = msg;
  el.style.color = success ? 'var(--teal-text)' : 'var(--text-2)';
  setTimeout(() => { el.textContent = ''; }, 3500);
}

function resetTP() {
  document.getElementById('tp-raw').value    = '';
  document.getElementById('tp-client').value = '';
  document.getElementById('tp-due').value    = '';
  document.getElementById('tp-result-wrap').style.display = 'none';
  document.getElementById('feedback-msg').textContent     = '';
  generatedText = ''; pendingClient = ''; pendingType = '';
}

// ── KANBAN ──────────────────────────────────────────────────────────────────

function renderBoard() {
  const filter = document.getElementById('kb-filter').value;
  const board  = document.getElementById('board');
  board.innerHTML = '';

  COLS.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.id && (!filter || t.tag === filter));

    const colEl = document.createElement('div');
    colEl.className = 'col';
    colEl.innerHTML = `
      <div class="col-header">
        <span class="col-title">${col.label}</span>
        <span class="col-count">${colTasks.length}</span>
      </div>`;

    colTasks.forEach(t => {
      const dl  = dueLabel(t.due);
      const cls = TAG_CLASSES[t.tag] || 't-support';

      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.innerHTML = `
        <div class="card-title">${escHtml(t.title)}</div>
        <div class="card-client">${escHtml(t.client || '')}</div>
        <div class="card-meta">
          <span class="tag ${cls}">${t.tag}</span>
          ${dl ? `<span class="due-tag${dl.over ? ' over' : ''}">${dl.over ? '<i class="ti ti-alert-circle" style="font-size:12px;vertical-align:-1px"></i> ' : ''}${escHtml(dl.text)}</span>` : ''}
        </div>`;
      card.onclick = () => openDetail(t.id);
      colEl.appendChild(card);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn';
    addBtn.innerHTML = '<i class="ti ti-plus"></i> Dodaj';
    addBtn.onclick = () => openAdd(col.id);
    colEl.appendChild(addBtn);

    board.appendChild(colEl);
  });

  updateHeaderStats();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── ADD MODAL ────────────────────────────────────────────────────────────────

function openAdd(colId) {
  addColId = colId;
  ['new-title', 'new-client', 'new-note'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('new-due').value = '';
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-title').focus(), 50);
}

function closeAdd() { document.getElementById('add-modal').classList.remove('open'); }

function saveNew() {
  const title = document.getElementById('new-title').value.trim();
  if (!title) { document.getElementById('new-title').focus(); return; }
  tasks.push({
    id: nextId++,
    title,
    client: document.getElementById('new-client').value.trim(),
    tag:    document.getElementById('new-tag').value,
    status: addColId,
    due:    document.getElementById('new-due').value,
    note:   document.getElementById('new-note').value.trim()
  });
  saveTasks();
  closeAdd();
  renderBoard();
}

// ── DETAIL MODAL ─────────────────────────────────────────────────────────────

function openDetail(id) {
  detailId = id;
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  document.getElementById('det-title').textContent  = t.title;
  document.getElementById('det-client').textContent = t.client || '';
  document.getElementById('det-note').value         = t.note || '';
  document.getElementById('det-due').value          = t.due  || '';

  const row = document.getElementById('det-status-row');
  row.innerHTML = '';
  COLS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'sbtn' + (t.status === c.id ? ' active' : '');
    btn.textContent = c.label;
    btn.onclick = () => {
      row.querySelectorAll('.sbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    row.appendChild(btn);
  });

  document.getElementById('det-modal').classList.add('open');
}

function closeDetail() { document.getElementById('det-modal').classList.remove('open'); }

function saveDetail() {
  const t = tasks.find(x => x.id === detailId);
  if (!t) return;
  const active = document.querySelector('#det-status-row .sbtn.active');
  if (active) {
    const idx = [...document.querySelectorAll('#det-status-row .sbtn')].indexOf(active);
    t.status = COLS[idx].id;
  }
  t.note = document.getElementById('det-note').value;
  t.due  = document.getElementById('det-due').value;
  saveTasks();
  closeDetail();
  renderBoard();
}

function deleteTask() {
  tasks = tasks.filter(x => x.id !== detailId);
  saveTasks();
  closeDetail();
  renderBoard();
}

// ── KEYBOARD / CLICK OUTSIDE ─────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetail(); closeAdd();
    document.getElementById('apikey-modal').classList.remove('open');
  }
});

['det-modal', 'add-modal', 'apikey-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      closeDetail(); closeAdd();
      document.getElementById('apikey-modal').classList.remove('open');
    }
  });
});

// Enter to submit forms
document.getElementById('new-title').addEventListener('keydown', e => { if (e.key === 'Enter') saveNew(); });
document.getElementById('apikey-input').addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });

// ── INIT ──────────────────────────────────────────────────────────────────────

loadTasks();
updateHeaderStats();
