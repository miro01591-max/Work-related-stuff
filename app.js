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

let transcriptMode = 'paste'; // 'paste' | 'file'
let fileContent = '';

function switchTranscriptTab(mode) {
  transcriptMode = mode;
  document.getElementById('ttab-paste').classList.toggle('active', mode === 'paste');
  document.getElementById('ttab-file').classList.toggle('active', mode === 'file');
  document.getElementById('tt-paste').style.display = mode === 'paste' ? 'block' : 'none';
  document.getElementById('tt-file').style.display  = mode === 'file'  ? 'block' : 'none';
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    fileContent = ev.target.result;
    document.getElementById('file-loaded').style.display = 'flex';
    document.getElementById('file-loaded-name').textContent = file.name;
    document.getElementById('file-drop').style.display = 'none';
  };
  reader.readAsText(file);
}

function clearFile() {
  fileContent = '';
  document.getElementById('tp-file').value = '';
  document.getElementById('file-loaded').style.display = 'none';
  document.getElementById('file-drop').style.display = 'flex';
}

function getTranscriptText() {
  if (transcriptMode === 'file') return fileContent;
  return document.getElementById('tp-raw').value.trim();
}

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

// Renders structured touchpoint sections into the result card
function renderSections(parsed) {
  const container = document.getElementById('tp-sections');
  container.innerHTML = '';

  const sections = [
    { key: 'customerInfo',   label: 'Customer Information (Name, Role)' },
    { key: 'meetingDetails', label: 'Meeting Details (Duration, Objective)' },
    { key: 'typeContext',    label: 'Type of Request and Context' },
    { key: 'valueReal',      label: 'Value Realisation' },
    { key: 'nextSteps',      label: 'Next Steps' },
  ];

  sections.forEach(s => {
    const val = parsed[s.key];
    if (!val) return;
    const div = document.createElement('div');
    div.className = 'tp-section';
    div.innerHTML = `<div class="tp-section-label">${s.label}</div>`;

    if (s.key === 'nextSteps' && Array.isArray(val)) {
      const ul = document.createElement('ul');
      ul.className = 'tp-next-steps tp-section-content';
      val.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        ul.appendChild(li);
      });
      div.appendChild(ul);
    } else {
      const p = document.createElement('div');
      p.className = 'tp-section-content';
      p.textContent = val;
      div.appendChild(p);
    }
    container.appendChild(div);
  });
}

// Build plain text for clipboard (Totango copy)
function buildPlainText(parsed) {
  const lines = [];
  if (parsed.customerInfo)   lines.push(`Customer Information (Name, Role):\n${parsed.customerInfo}`);
  if (parsed.meetingDetails) lines.push(`Meeting Details (Duration, Objective):\n${parsed.meetingDetails}`);
  if (parsed.typeContext)    lines.push(`Type of Request and Context:\n${parsed.typeContext}`);
  if (parsed.valueReal)      lines.push(`Value Realisation:\n${parsed.valueReal}`);
  if (parsed.nextSteps) {
    const steps = Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.map(s => `- ${s}`).join('\n')
      : parsed.nextSteps;
    lines.push(`Next Steps:\n${steps}`);
  }
  return lines.join('\n\n');
}

async function generateTP() {
  const transcript = getTranscriptText();
  if (!transcript) {
    if (transcriptMode === 'paste') document.getElementById('tp-raw').focus();
    return;
  }

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

  const wrap = document.getElementById('tp-result-wrap');
  const btn  = document.getElementById('btn-generate');
  const container = document.getElementById('tp-sections');

  wrap.style.display = 'block';
  container.innerHTML = '<div class="tp-section-content loading">Generiram touchpoint...</div>';
  document.getElementById('feedback-msg').textContent = '';
  document.getElementById('result-client-label').textContent = client || '';
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader"></i> Generiram...';

  const prompt = `Du bist ein Customer Success Manager bei PlanRadar und schreibst Touchpoint-Notizen für Totango auf Deutsch.

Fülle das folgende Template basierend auf dem gegebenen Transcript aus. Antworte NUR mit einem validen JSON-Objekt, ohne Markdown, ohne Erklärungen.

Transcript:
${transcript}

Klient: ${client || '(nicht angegeben)'}
Art der Interaktion: ${type}

Fülle dieses JSON aus (alle Felder auf Deutsch):
{
  "customerInfo": "Name und Rolle des Kunden (z.B. Max Mustermann, Projektleiter)",
  "meetingDetails": "Dauer und Ziel des Meetings",
  "typeContext": "Art der Anfrage und Kontext — was war das Hauptthema/Problem",
  "valueReal": "Welchen Mehrwert hat der Kunde aus diesem Touchpoint erhalten",
  "nextSteps": ["Nächster Schritt 1", "Nächster Schritt 2"]
}

Wichtig:
- Alles auf Deutsch
- nextSteps als Array von konkreten Aktionen mit Verantwortlichem (z.B. "Ilija sendet Einladung für KI-Demo bis 20.06.")
- Keine Platzhalter lassen — wenn Information fehlt, sinnvoll interpolieren
- Nur reines JSON zurückgeben`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (res.status === 401) {
      localStorage.removeItem(API_KEY_STORAGE);
      container.innerHTML = '<div class="tp-section-content loading">Neispravan API ključ. Pokušaj ponovo.</div>';
      setTimeout(() => {
        document.getElementById('apikey-modal').classList.add('open');
        document.getElementById('apikey-input').value = '';
        document.getElementById('apikey-input').focus();
      }, 800);
      return;
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text || '';

    let parsed;
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      container.innerHTML = `<div class="tp-section-content">${raw}</div>`;
      generatedText = raw;
      return;
    }

    generatedText = buildPlainText(parsed);
    renderSections(parsed);

  } catch (e) {
    container.innerHTML = '<div class="tp-section-content loading">Greška pri pozivu API-ja. Provjeri internet vezu.</div>';
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

  // Try to extract a meaningful title from typeContext or first next step
  const sections = document.querySelectorAll('.tp-section-content');
  let title = '';
  sections.forEach((el, i) => {
    if (i === 2 && !title) title = el.textContent.trim().slice(0, 65); // typeContext
  });
  if (!title) {
    const raw = transcriptMode === 'paste' ? document.getElementById('tp-raw').value.trim() : fileContent;
    title = raw.slice(0, 65);
  }
  if (title.length >= 65) title = title.slice(0, 62) + '...';

  const due = document.getElementById('tp-due').value;
  const tag = pendingType === 'Check-in' ? 'Follow-up' : pendingType;

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
  clearFile();
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
