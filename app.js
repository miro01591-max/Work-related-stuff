const COLS = [
  { id: 'todo',         label: 'To Do' },
  { id: 'waiting',      label: 'Waiting for Response' },
  { id: 'inprogress',   label: 'In Progress' },
  { id: 'done',         label: 'Done' },
  { id: 'specialcare',  label: 'Special Care' }
];

const CARD_CLASSES = {
  'Support':   'card-support',
  'Bug':       'card-bug',
  'Feature':   'card-feature',
  'Billing':   'card-billing',
  'Follow-up': 'card-followup',
  'Check-in':  'card-checkin'
};

const COL_CLASSES = {
  'todo':        'col-todo',
  'waiting':     'col-waiting',
  'inprogress':  'col-inprogress',
  'specialcare': 'col-specialcare',
  'done':        'col-done'
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
let lastParsed = null;

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

function openTotango() {
  playSoundClick();
  window.open('https://app.totango.com/t11/planradar-prod/#/my-business/overview', '_blank');
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
  playSoundNav();
  if (tab === 'kb') renderBoard();
  if (tab === 'stats') renderStats();
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

function fileDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('file-drop').style.borderColor = 'var(--teal-text)';
  document.getElementById('file-drop').style.background = 'rgba(93,202,165,0.08)';
}

function fileDragLeave(e) {
  e.preventDefault();
  document.getElementById('file-drop').style.borderColor = '';
  document.getElementById('file-drop').style.background = '';
}

function fileDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  fileDragLeave(e);
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.match(/\.(txt|md|docx)$/i)) {
    alert('Podržava samo .txt, .md i .docx datoteke.');
    return;
  }
  processFile(file);
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  const showLoaded = (text) => {
    fileContent = text;
    document.getElementById('file-loaded').style.display = 'flex';
    document.getElementById('file-loaded-name').textContent = file.name;
    document.getElementById('file-drop').style.display = 'none';
  };
  const showError = (msg) => {
    fileContent = '';
    document.getElementById('file-loaded-name').textContent = msg;
    document.getElementById('file-loaded').style.display = 'flex';
    document.getElementById('file-drop').style.display = 'none';
  };
  if (file.name.endsWith('.docx')) {
    if (typeof mammoth === 'undefined') { showError('⚠ Reload page and try again'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      mammoth.extractRawText({ arrayBuffer: ev.target.result })
        .then(r => showLoaded(r.value))
        .catch(() => showError('⚠ Could not read .docx'));
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = ev => showLoaded(ev.target.result);
    reader.readAsText(file);
  }
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

// Renders structured touchpoint sections as editable textareas
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
    let val = parsed[s.key];
    if (!val) return;

    // Normalise next steps array to string
    if (s.key === 'nextSteps' && Array.isArray(val)) {
      val = val.map(step => `- ${step}`).join('\n');
    }

    const div = document.createElement('div');
    div.className = 'tp-section';

    const label = document.createElement('div');
    label.className = 'tp-section-label';
    label.textContent = s.label;

    const ta = document.createElement('textarea');
    ta.className = 'tp-section-textarea';
    ta.dataset.key = s.key;
    ta.value = val;
    ta.rows = s.key === 'nextSteps' ? 4 : 3;
    // Auto-resize on input
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });

    div.appendChild(label);
    div.appendChild(ta);
    container.appendChild(div);
  });
}

// Build plain text from editable textareas for Totango clipboard
function buildPlainText() {
  const sections = [
    { key: 'customerInfo',   label: 'Customer Information (Name, Role)' },
    { key: 'meetingDetails', label: 'Meeting Details (Duration, Objective)' },
    { key: 'typeContext',    label: 'Type of Request and Context' },
    { key: 'valueReal',      label: 'Value Realisation (value received from this touchpoint)' },
    { key: 'nextSteps',      label: 'Next Steps' },
  ];

  const parts = [];
  document.querySelectorAll('.tp-section-textarea').forEach(ta => {
    const key = ta.dataset.key;
    const sec = sections.find(s => s.key === key);
    if (sec && ta.value.trim()) {
      parts.push(`${sec.label}: ${ta.value.trim()}`);
    }
  });
  return parts.join('\n\n');
}

// Build HTML for rich text clipboard (bold headings, Totango supports it)
function buildHtmlText() {
  const sections = [
    { key: 'customerInfo',   label: 'Customer Information (Name, Role)' },
    { key: 'meetingDetails', label: 'Meeting Details (Duration, Objective)' },
    { key: 'typeContext',    label: 'Type of Request and Context' },
    { key: 'valueReal',      label: 'Value Realisation (value received from this touchpoint)' },
    { key: 'nextSteps',      label: 'Next Steps' },
  ];

  const parts = [];
  document.querySelectorAll('.tp-section-textarea').forEach(ta => {
    const key = ta.dataset.key;
    const sec = sections.find(s => s.key === key);
    if (sec && ta.value.trim()) {
      // Convert newlines to <br>, preserve bullet points
      const content = ta.value.trim()
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\n/g, '<br>');
      parts.push(`<p><strong>${sec.label}:</strong> ${content}</p>`);
    }
  });
  return parts.join('\n');
}

async function generateTP() {
  const transcript = getTranscriptText();
  if (!transcript) {
    const ta = document.getElementById('tp-raw');
    ta.focus();
    ta.style.borderColor = '#E11D48';
    ta.placeholder = '⚠ Paste or type a transcript first...';
    setTimeout(() => {
      ta.style.borderColor = '';
      ta.placeholder = 'Paste transcript here — Teams/Zoom summary, key points, or free description...';
    }, 3000);
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    document.getElementById('apikey-modal').classList.add('open');
    setTimeout(() => document.getElementById('apikey-input').focus(), 100);
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
  playSoundGenerate();
  showCharizard('Generating touchpoint...');

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

    generatedText = 'ready';
    lastParsed = parsed;
    renderSections(parsed);

  } catch (e) {
    container.innerHTML = '<div class="tp-section-content loading">Greška pri pozivu API-ja. Provjeri internet vezu.</div>';
    generatedText = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-sparkles"></i> Generiraj touchpoint';
    hideCharizard();
  }
}

function copyTP() {
  if (!generatedText) return;
  playSoundCopy();
  const html = buildHtmlText();
  const plain = buildPlainText();

  // Try rich text copy first (works in Chrome)
  if (window.ClipboardItem) {
    const item = new ClipboardItem({
      'text/html':  new Blob([html],  { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    });
    navigator.clipboard.write([item]).then(() => {
      showFeedback('Copied! Paste into Totango — headings will be bold.', false);
    }).catch(() => {
      // Fallback to plain text
      navigator.clipboard.writeText(plain).then(() => {
        showFeedback('Copied as plain text.', false);
      });
    });
  } else {
    navigator.clipboard.writeText(plain).then(() => {
      showFeedback('Copied! Paste into Totango.', false);
    });
  }
}

function addToBoard() {
  if (!generatedText) return;

  // Extract title from typeContext section
  const sections = document.querySelectorAll('.tp-section-content');
  let title = '';
  sections.forEach((el, i) => {
    if (i === 2 && !title) title = el.textContent.trim().slice(0, 65);
  });
  if (!title) {
    const raw = transcriptMode === 'paste' ? document.getElementById('tp-raw').value.trim() : fileContent;
    title = raw.slice(0, 65);
  }
  if (title.length >= 65) title = title.slice(0, 62) + '...';

  // Extract company/client name from parsed customerInfo
  // customerInfo is typically "Name, Role — Company" or "Name, Company"
  let client = pendingClient; // use manually entered client if available
  if (!client && lastParsed?.customerInfo) {
    const info = lastParsed.customerInfo;
    // Try to extract company after comma, dash, or "von"/"bei"/"from"
    const companyMatch = info.match(/(?:,\s*|-\s*|–\s*|bei\s+|von\s+|from\s+|@\s*)([^,\-–]+)$/i);
    if (companyMatch) {
      client = companyMatch[1].trim();
    } else {
      // Just take the whole customerInfo if short enough, strip role
      const parts = info.split(',');
      client = parts[0].trim(); // Take first part (usually name or company)
    }
  }
  if (!client) client = '';

  const due = document.getElementById('tp-due').value;
  const tag = pendingType === 'Check-in' ? 'Follow-up' : pendingType;

  const note = buildPlainText();
  tasks.push({
    id: nextId++,
    title,
    client,
    tag,
    status: 'todo',
    due,
    note
  });
  saveTasks();
  updateHeaderStats();
  showFeedback('Added to board!', true);
  playAddSound();
}

function createTasksFromNextSteps() {
  // Find the Next Steps textarea
  const nextStepsTa = [...document.querySelectorAll('.tp-section-textarea')]
    .find(ta => ta.dataset.key === 'nextSteps');

  if (!nextStepsTa || !nextStepsTa.value.trim()) {
    showFeedback('No next steps found to create tasks from.', false);
    return;
  }

  const raw = nextStepsTa.value.trim();
  const client = pendingClient || '';
  const due = document.getElementById('tp-due').value;

  // Split by lines starting with - or • or numbers, or by sentence
  const lines = raw
    .split(/\n|(?<=\.)\s+(?=[A-ZÜÖÄ-])|(?<=\.)(?=\s*-)|^-\s*/m)
    .map(l => l.replace(/^[-•\d\.]+\s*/, '').trim())
    .filter(l => l.length > 10);

  if (lines.length === 0) {
    showFeedback('Could not parse next steps.', false);
    return;
  }

  let created = 0;
  lines.forEach(step => {
    if (step.length < 10) return;
    const title = step.length > 65 ? step.slice(0, 62) + '...' : step;

    // Auto-detect tag
    const lower = step.toLowerCase();
    let tag = 'Follow-up';
    if (lower.includes('bug') || lower.includes('fehler') || lower.includes('problem')) tag = 'Bug';
    else if (lower.includes('rechnung') || lower.includes('billing') || lower.includes('zahlung')) tag = 'Billing';
    else if (lower.includes('support') || lower.includes('ticket')) tag = 'Support';

    tasks.push({
      id: nextId++,
      title,
      client,
      tag,
      status: 'todo',
      due,
      note: step
    });
    created++;
  });

  saveTasks();
  updateHeaderStats();
  playAddSound();
  showFeedback(`✓ Created ${created} task${created !== 1 ? 's' : ''} on the board!`, true);
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
  generatedText = ''; pendingClient = ''; pendingType = ''; lastParsed = null;
}

const TAG_CLASSES = {
  'Support':   't-support',
  'Bug':       't-bug',
  'Feature':   't-feature',
  'Billing':   't-billing',
  'Follow-up': 't-followup',
  'Check-in':  't-checkin'
};

// ── KANBAN ──────────────────────────────────────────────────────────────────

let dragId = null;

function renderBoard() {
  const filter = document.getElementById('kb-filter').value;
  const board  = document.getElementById('board');
  board.innerHTML = '';

  COLS.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.id && (!filter || t.tag === filter));

    const colEl = document.createElement('div');
    colEl.className = `col ${COL_CLASSES[col.id] || ''}`;
    colEl.dataset.colId = col.id;
    colEl.innerHTML = `
      <div class="col-header">
        <span class="col-title">${col.label}</span>
        <span class="col-count">${colTasks.length}</span>
      </div>`;

    // Drop zone events on column
    colEl.addEventListener('dragover', e => {
      e.preventDefault();
      colEl.classList.add('drag-over');
    });
    colEl.addEventListener('dragleave', e => {
      if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('drag-over');
    });
    colEl.addEventListener('drop', e => {
      e.preventDefault();
      colEl.classList.remove('drag-over');
      if (dragId === null) return;
      const t = tasks.find(x => x.id === dragId);
      if (t && t.status !== col.id) {
        const prevStatus = t.status;
        t.status = col.id;
        saveTasks();
        renderBoard();
        if (col.id === 'done' && prevStatus !== 'done') {
          playDoneSound();
          launchConfetti();
        }
      }
      dragId = null;
    });

    colTasks.forEach(t => {
      const dl      = dueLabel(t.due);
      const tagCls  = TAG_CLASSES[t.tag]  || 't-support';
      const cardCls = CARD_CLASSES[t.tag] || 'card-support';

      const card = document.createElement('div');
      card.className = `kanban-card ${cardCls}`;
      card.draggable = true;
      card.dataset.taskId = t.id;
      card.innerHTML = `
        <div class="card-drag-handle" aria-hidden="true"><i class="ti ti-grip-horizontal"></i></div>
        <div class="card-title">${escHtml(t.title)}</div>
        <div class="card-client">${escHtml(t.client || '')}</div>
        <div class="card-meta">
          <span class="tag ${tagCls}">${t.tag}</span>
          ${dl ? `<span class="due-tag${dl.over ? ' over' : ''}">${dl.over ? '<i class="ti ti-alert-circle" style="font-size:12px;vertical-align:-1px"></i> ' : ''}${escHtml(dl.text)}</span>` : ''}
        </div>
        <div class="card-totango ${t.totango ? 'card-totango-done' : ''}" data-id="${t.id}">
          <span class="totango-check ${t.totango ? 'checked' : ''}">
            <i class="ti ${t.totango ? 'ti-circle-check' : 'ti-circle'}"></i>
          </span>
          <span class="totango-label">${t.totango ? 'In Totango ✓' : 'Add to Totango'}</span>
        </div>`;

      // Totango checkbox click
      card.querySelector('.card-totango').addEventListener('click', e => {
        e.stopPropagation();
        const task = tasks.find(x => x.id === t.id);
        if (!task) return;
        if (!task.totango) {
          task.totango = true;
          saveTasks();
          renderBoard();
          playDoneSound();
          launchConfetti();
        }
      });

      card.addEventListener('dragstart', e => {
        dragId = t.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      card.addEventListener('click', () => {
        if (dragId === null) openDetail(t.id);
      });

      colEl.appendChild(card);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn';
    addBtn.innerHTML = '<i class="ti ti-plus"></i> Add';
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
  playSoundOpen();
  setTimeout(() => document.getElementById('new-title').focus(), 50);
}

function closeAdd() {
  document.getElementById('add-modal').classList.remove('open');
  playSoundClose();
}

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
  playAddSound();
}

// ── DETAIL MODAL ─────────────────────────────────────────────────────────────

function openDetail(id) {
  detailId = id;
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  document.getElementById('det-title').value        = t.title;
  document.getElementById('det-client-input').value = t.client || '';
  document.getElementById('det-note').value         = t.note  || '';
  document.getElementById('det-due').value          = t.due   || '';

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
  playSoundOpen();
  setTimeout(() => document.getElementById('det-title').focus(), 50);
}

function closeDetail() {
  document.getElementById('det-modal').classList.remove('open');
  playSoundClose();
}

function saveDetail() {
  const t = tasks.find(x => x.id === detailId);
  if (!t) return;
  const prevStatus = t.status;
  const active = document.querySelector('#det-status-row .sbtn.active');
  if (active) {
    const idx = [...document.querySelectorAll('#det-status-row .sbtn')].indexOf(active);
    t.status = COLS[idx].id;
  }
  const newTitle = document.getElementById('det-title').value.trim();
  if (newTitle) t.title = newTitle;
  t.client = document.getElementById('det-client-input').value.trim();
  t.note   = document.getElementById('det-note').value;
  t.due    = document.getElementById('det-due').value;
  saveTasks();
  closeDetail();
  renderBoard();
  if (t.status === 'done' && prevStatus !== 'done') {
    playDoneSound();
    launchConfetti();
  }
}

function deleteTask() {
  tasks = tasks.filter(x => x.id !== detailId);
  saveTasks();
  closeDetail();
  renderBoard();
  playSoundDelete();
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

// ── STATS ────────────────────────────────────────────────────────────────────

function renderStats() {
  const done    = tasks.filter(t => t.status === 'done').length;
  const open    = tasks.filter(t => t.status !== 'done').length;
  const overdue = tasks.filter(t => t.status !== 'done' && t.due && new Date(t.due) < new Date(today())).length;
  const total   = tasks.length;

  // ── PIE: done vs open ──────────────────────────────────────────────
  const pieCanvas = document.getElementById('pie-chart');
  const pieCtx    = pieCanvas.getContext('2d');
  const pieData   = [
    { label: 'Done',     value: done, color: '#16A34A' },
    { label: 'In Progress / Waiting', value: tasks.filter(t => t.status === 'inprogress' || t.status === 'waiting').length, color: '#2563EB' },
    { label: 'To Do',    value: tasks.filter(t => t.status === 'todo').length, color: '#7C3AED' },
    { label: 'Special Care', value: tasks.filter(t => t.status === 'specialcare').length, color: '#E11D48' },
  ].filter(d => d.value > 0);

  drawPie(pieCtx, pieCanvas.width, pieData);
  renderLegend('chart-legend', pieData);

  // ── BAR: by category ───────────────────────────────────────────────
  const cats = ['Support', 'Bug', 'Feature', 'Billing', 'Follow-up'];
  const catColors = { Support: '#2563EB', Bug: '#DC2626', Feature: '#16A34A', Billing: '#D97706', 'Follow-up': '#7C3AED' };
  const barData = cats.map(c => ({
    label: c,
    value: tasks.filter(t => t.tag === c).length,
    color: catColors[c]
  })).filter(d => d.value > 0);

  const barCanvas = document.getElementById('bar-chart');
  const barCtx    = barCanvas.getContext('2d');
  if (barData.length) {
    drawPie(barCtx, barCanvas.width, barData);
    renderLegend('bar-legend', barData);
  } else {
    barCtx.clearRect(0, 0, barCanvas.width, barCanvas.height);
    document.getElementById('bar-legend').innerHTML = '<span style="font-size:13px;color:var(--color-text-tertiary)">No tasks yet</span>';
  }

  // ── SUMMARY ────────────────────────────────────────────────────────
  const grid = document.getElementById('summary-grid');
  const pct  = total ? Math.round((done / total) * 100) : 0;
  grid.innerHTML = `
    <div class="summary-item highlight">
      <div class="summary-num">${done}</div>
      <div class="summary-lbl">Completed</div>
    </div>
    <div class="summary-item">
      <div class="summary-num">${open}</div>
      <div class="summary-lbl">Open</div>
    </div>
    <div class="summary-item ${overdue > 0 ? 'warn' : ''}">
      <div class="summary-num">${overdue}</div>
      <div class="summary-lbl">Overdue</div>
    </div>
    <div class="summary-item">
      <div class="summary-num">${total}</div>
      <div class="summary-lbl">Total</div>
    </div>
    <div class="summary-item ${pct >= 70 ? 'highlight' : pct >= 40 ? '' : 'warn'}">
      <div class="summary-num">${pct}%</div>
      <div class="summary-lbl">Completion rate</div>
    </div>
  `;
}

function drawPie(ctx, size, data) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;
  const total = data.reduce((s, d) => s + d.value, 0);
  ctx.clearRect(0, 0, size, size);

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a28';
    ctx.fill();
    return;
  }

  let start = -Math.PI / 2;
  data.forEach(d => {
    const slice = (d.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    // white gap between slices
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    start += slice;
  });

  // donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1c1a';
  ctx.fill();

  // center text
  const done = data.find(d => d.label === 'Done');
  if (done) {
    const pct = Math.round((done.value / total) * 100);
    ctx.fillStyle = '#16A34A';
    ctx.font = `bold ${size * 0.13}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pct}%`, cx, cy - 8);
    ctx.fillStyle = '#606058';
    ctx.font = `${size * 0.07}px -apple-system, sans-serif`;
    ctx.fillText('done', cx, cy + 12);
  }
}

function renderLegend(containerId, data) {
  const total = data.reduce((s, d) => s + d.value, 0);
  document.getElementById(containerId).innerHTML = data.map(d => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${d.color}"></div>
      <span class="legend-label">${d.label}</span>
      <span class="legend-val">${d.value} <span style="font-weight:400;color:var(--text-3)">(${Math.round(d.value/total*100)}%)</span></span>
    </div>
  `).join('');
}

// ── SPEECH TO TEXT ──────────────────────────────────────────────────────────

let recognition = null;
let isRecording = false;

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.continuous = false;
  r.interimResults = true;
  r.lang = 'en-US';

  r.onstart = () => {
    console.log('[Speech] Started listening');
    document.getElementById('speech-input').placeholder = '🎤 Listening... speak now';
  };

  r.onspeechstart = () => {
    console.log('[Speech] Speech detected');
    document.getElementById('speech-input').placeholder = '🎤 Speech detected...';
  };

  r.onresult = e => {
    console.log('[Speech] Got result', e.results);
    const transcript = [...e.results].map(r => r[0].transcript).join('');
    console.log('[Speech] Transcript:', transcript);
    document.getElementById('speech-input').value = transcript;
  };

  r.onnomatch = () => {
    console.log('[Speech] No match');
    document.getElementById('speech-input').placeholder = 'No match — try speaking more clearly';
    setTimeout(() => { document.getElementById('speech-input').placeholder = 'Type or speak a task...'; }, 3000);
  };

  r.onend = () => {
    console.log('[Speech] Ended');
    isRecording = false;
    updateMicBtn();
    const val = document.getElementById('speech-input').value.trim();
    if (val) {
      // Auto-submit to Claude after a short delay
      setTimeout(() => speechAddTask(), 400);
    } else {
      document.getElementById('speech-input').placeholder = 'Type or speak a task...';
    }
  };

  r.onerror = e => {
    console.log('[Speech] Error:', e.error, e.message);
    isRecording = false;
    updateMicBtn();
    const input = document.getElementById('speech-input');
    if (e.error === 'not-allowed') {
      input.placeholder = '⚠ Microphone access denied — allow it in your browser settings';
    } else if (e.error === 'no-speech') {
      input.placeholder = 'No speech detected — try again';
      setTimeout(() => { input.placeholder = 'Type or speak a task...'; }, 3000);
    } else {
      input.placeholder = `Error: ${e.error} — try again`;
      setTimeout(() => { input.placeholder = 'Type or speak a task...'; }, 3000);
    }
  };

  return r;
}

function updateMicBtn() {
  const btn  = document.getElementById('mic-btn');
  const icon = document.getElementById('mic-icon');
  if (isRecording) {
    btn.classList.add('recording');
    icon.className = 'ti ti-microphone-off';
    btn.title = 'Stop recording';
  } else {
    btn.classList.remove('recording');
    icon.className = 'ti ti-microphone';
    btn.title = 'Click to speak';
  }
}

async function toggleMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('speech-input').placeholder = '⚠ Speech not supported — use Chrome or Edge';
    return;
  }

  if (isRecording) {
    recognition?.stop();
    isRecording = false;
    updateMicBtn();
    playSoundMicOff();
    return;
  }

  recognition = initSpeech();
  if (!recognition) return;
  isRecording = true;
  updateMicBtn();
  playSoundMicOn();
  document.getElementById('speech-input').placeholder = '🎤 Listening...';

  try {
    recognition.start();
  } catch(e) {
    console.log('[Speech] Start error:', e);
    isRecording = false;
    updateMicBtn();
  }
}

async function speechAddTask() {
  const input = document.getElementById('speech-input');
  const text  = input.value.trim();
  if (!text) { input.focus(); return; }

  const apiKey = getApiKey();
  if (!apiKey) {
    document.getElementById('apikey-modal').classList.add('open');
    setTimeout(() => document.getElementById('apikey-input').focus(), 100);
    return;
  }

  const addBtn = document.querySelector('.speech-add-btn');
  addBtn.disabled = true;
  addBtn.innerHTML = '<i class="ti ti-loader"></i> Thinking...';
  input.placeholder = '⏳ Claude is parsing your task...';
  input.value = '';

  const todayStr = today();
  const prompt = `You are a Customer Success assistant. Parse the following voice input into a task.

Voice input: "${text}"
Today's date: ${todayStr}

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "title": "short task title (max 60 chars)",
  "client": "company or client name, empty string if not mentioned",
  "tag": "one of: Support, Bug, Feature, Billing, Follow-up",
  "status": "one of: todo, waiting, inprogress, done, specialcare",
  "due": "YYYY-MM-DD date if mentioned (e.g. 'Friday', 'next week', 'tomorrow'), empty string if not mentioned",
  "note": "any additional context from the voice input"
}

Rules:
- status is 'waiting' if they mention waiting for a response, 'specialcare' if urgent/critical/escalated, otherwise 'todo'
- tag: Support if issue/problem/ticket, Bug if error/broken/crash, Feature if request/enhancement, Billing if invoice/payment, Follow-up for everything else
- due: calculate from today (${todayStr}), e.g. "tomorrow" = next day, "Friday" = next Friday`;

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    const raw  = data.content?.[0]?.text || '';

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch(e) {
      throw new Error('Could not parse response');
    }

    tasks.push({
      id:     nextId++,
      title:  parsed.title  || text.slice(0, 60),
      client: parsed.client || '',
      tag:    parsed.tag    || 'Follow-up',
      status: parsed.status || document.getElementById('speech-col').value,
      due:    parsed.due    || '',
      note:   parsed.note   || ''
    });
    saveTasks();
    renderBoard();
    updateHeaderStats();
    playAddSound();

    input.placeholder = `✓ "${parsed.title}" added!`;
    setTimeout(() => { input.placeholder = 'Type or speak a task...'; }, 3000);

  } catch(e) {
    input.placeholder = '⚠ Error — try again';
    setTimeout(() => { input.placeholder = 'Type or speak a task...'; }, 3000);
  } finally {
    addBtn.disabled = false;
    addBtn.innerHTML = '<i class="ti ti-circle-plus"></i> Add';
  }
}

// Enter key in speech input
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('speech-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') speechAddTask();
  });
});

// ── 8-BIT SOUND SYSTEM ───────────────────────────────────────────────────────

function play8bit(freqs, durations, vol = 0.12) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    let offset = 0;
    freqs.forEach((freq, i) => {
      const dur = durations[i] || 0.08;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t + offset);
      gain.gain.setValueAtTime(vol, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + dur);
      osc.start(t + offset);
      osc.stop(t + offset + dur + 0.02);
      offset += dur;
    });
  } catch(e) {}
}

// Click — short blip
function playSoundClick()  { play8bit([440], [0.06], 0.08); }
// Tab switch — two-note up
function playSoundNav()    { play8bit([330, 440], [0.06, 0.08], 0.08); }
// Open modal — quick chord rise
function playSoundOpen()   { play8bit([262, 330, 392], [0.05, 0.05, 0.08], 0.1); }
// Close/cancel — down blip
function playSoundClose()  { play8bit([330, 220], [0.06, 0.08], 0.08); }
// Add task — upbeat pop
function playAddSound()    { play8bit([523, 659, 784], [0.07, 0.07, 0.1], 0.12); }
// Delete — descending blip
function playSoundDelete()  { play8bit([440, 330, 220, 165], [0.05, 0.05, 0.05, 0.1], 0.1); }
// Copy — camera shutter click
function playSoundCopy()   { play8bit([880, 440], [0.04, 0.06], 0.08); }
// Generate — loading beeps
function playSoundGenerate(){ play8bit([262, 294, 330, 349], [0.07, 0.07, 0.07, 0.07], 0.08); }
// Done/celebrate — fanfare
function playDoneSound()   { play8bit([523, 659, 784, 1047], [0.08, 0.08, 0.08, 0.18], 0.15); }
// Error — descending sad
function playSoundError()  { play8bit([330, 262, 196], [0.1, 0.1, 0.15], 0.12); }
// Mic on — blip up
function playSoundMicOn()  { play8bit([440, 880], [0.05, 0.08], 0.1); }
// Mic off — blip down
function playSoundMicOff() { play8bit([880, 440], [0.05, 0.08], 0.1); }

function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const colors = ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899'];
  const pieces = Array.from({length: 80}, () => ({
    x:     Math.random() * canvas.width,
    y:     -10 - Math.random() * 100,
    r:     4 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx:    (Math.random() - 0.5) * 4,
    vy:    3 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.2,
    shape: Math.random() > 0.5 ? 'rect' : 'circle'
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / 90);
      if (p.shape === 'rect') {
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    frame++;
    if (frame < 100) requestAnimationFrame(draw);
    else canvas.remove();
  }
  draw();
}

// ── PAC-MAN LOADING ANIMATION ────────────────────────────────────────────────

let pacRaf = null;
let pacMsgInterval = null;

function showCharizard(msg) {
  const overlay = document.getElementById('charizard-overlay');
  overlay.style.display = 'flex';
  startPacmanAnim();
}

function hideCharizard() {
  document.getElementById('charizard-overlay').style.display = 'none';
  if (pacRaf) { cancelAnimationFrame(pacRaf); pacRaf = null; }
  if (pacMsgInterval) { clearInterval(pacMsgInterval); pacMsgInterval = null; }
}

function startPacmanAnim() {
  if (pacRaf) cancelAnimationFrame(pacRaf);
  const canvas = document.getElementById('charizard-canvas');
  canvas.width  = 360;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  const W = 360, H = 80, CY = 38;

  let frame = 0;
  let pacX  = -30;
  let dir   = 1;
  let score = 0;

  const dots = Array.from({length: 13}, (_, i) => ({
    x: 28 + i * 24, eaten: false, big: i % 4 === 0
  }));

  const ghosts = [
    { x: W+60,  color:'#ff0000' },
    { x: W+100, color:'#ffb8ff' },
    { x: W+140, color:'#00ffff' },
  ];

  const msgs = ['GENERATING...', 'WAKA WAKA...', 'ALMOST DONE...', 'CLAUDE IS THINKING...'];
  let mi = 0;
  document.getElementById('charizard-msg').textContent = msgs[0];
  pacMsgInterval = setInterval(() => {
    mi = (mi+1) % msgs.length;
    const el = document.getElementById('charizard-msg');
    if (el) el.textContent = msgs[mi];
  }, 1800);

  function drawPacman(x, mouthAngle, left) {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    const s = left ? Math.PI + mouthAngle : mouthAngle;
    const e = left ? Math.PI - mouthAngle : -mouthAngle;
    ctx.moveTo(x, CY);
    ctx.arc(x, CY, 16, s, e);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f0f13';
    ctx.beginPath();
    ctx.arc(left ? x-5 : x+5, CY-7, 2.5, 0, Math.PI*2);
    ctx.fill();
  }

  function drawGhost(x, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, CY-4, 12, Math.PI, 0);
    ctx.lineTo(x+12, CY+14);
    for (let i=3; i>=0; i--) {
      ctx.lineTo(x - 12 + i*8, i%2===0 ? CY+14 : CY+8);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle='white';
    ctx.beginPath(); ctx.arc(x-4,CY-5,3.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+4,CY-5,3.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#0000cc';
    ctx.beginPath(); ctx.arc(x-3,CY-4,1.8,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+5,CY-4,1.8,0,Math.PI*2); ctx.fill();
  }

  function tick() {
    ctx.fillStyle = '#0f0f13';
    ctx.fillRect(0, 0, W, H);

    // Dashed ground line
    ctx.strokeStyle = '#1a6bc4'; ctx.lineWidth = 2;
    ctx.setLineDash([8,4]);
    ctx.beginPath(); ctx.moveTo(0,CY+20); ctx.lineTo(W,CY+20); ctx.stroke();
    ctx.setLineDash([]);

    pacX += 2.2 * dir;
    const mouth = Math.abs(Math.sin(frame*0.28)) * 0.38;

    // Eat dots
    dots.forEach(d => {
      if (d.eaten) return;
      if (Math.abs(pacX - d.x) < 15) { d.eaten=true; score += d.big?50:10; }
    });

    // Draw dots
    dots.forEach(d => {
      if (d.eaten) return;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(d.x, CY, d.big ? 6 : 3, 0, Math.PI*2);
      ctx.fill();
    });

    // Move & draw ghosts
    ghosts.forEach(g => { g.x -= 2.0; drawGhost(g.x, g.color); });

    drawPacman(pacX, mouth, dir===-1);

    // Score
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.font='8px monospace';
    ctx.fillText(score, W-50, 14);

    // Reset
    if (pacX > W+40 || pacX < -40) {
      dir *= -1;
      dots.forEach(d => d.eaten=false);
      pacX = dir===1 ? -30 : W+30;
      ghosts[0].x = dir===1 ? W+60  : -60;
      ghosts[1].x = dir===1 ? W+100 : -100;
      ghosts[2].x = dir===1 ? W+140 : -140;
    }

    frame++;
    pacRaf = requestAnimationFrame(tick);
  }

  tick();
}

let floatAnim = null;

function startFloating() {
  const btn  = document.getElementById('go-btn');
  const wrap = document.getElementById('btn-wrap');
  if (!btn || !wrap) return;

  const bw = btn.offsetWidth;
  const bh = btn.offsetHeight;
  const ww = wrap.offsetWidth;
  const wh = wrap.offsetHeight;

  let x  = (ww - bw) / 2;
  let y  = (wh - bh) / 2;
  let vx = 1.4 + Math.random() * 0.8;
  let vy = 1.2 + Math.random() * 0.8;

  // Remove mouse interaction
  btn.onmouseenter = null;

  function animate() {
    x += vx;
    y += vy;

    // Bounce off walls
    if (x <= 0)        { x = 0;        vx = Math.abs(vx); }
    if (x >= ww - bw)  { x = ww - bw;  vx = -Math.abs(vx); }
    if (y <= 0)        { y = 0;        vy = Math.abs(vy); }
    if (y >= wh - bh)  { y = wh - bh;  vy = -Math.abs(vy); }

    btn.style.left      = x + 'px';
    btn.style.top       = y + 'px';
    btn.style.transform = 'none';
    btn.style.transition = 'none';

    floatAnim = requestAnimationFrame(animate);
  }

  floatAnim = requestAnimationFrame(animate);
}

function stopFloating() {
  if (floatAnim) cancelAnimationFrame(floatAnim);
  floatAnim = null;
}

// Keep runAway as no-op (mouse no longer chases)
function runAway(e) {}

function closeWelcome() {
  stopFloating();
  playSoundNav();
  const el = document.getElementById('welcome-modal');
  el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  el.style.opacity = '0';
  el.style.transform = 'scale(1.03)';
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

function initWelcome() {
  const open    = tasks.filter(t => t.status !== 'done').length;
  const overdue = tasks.filter(t => t.status !== 'done' && t.due && new Date(t.due) < new Date(today())).length;
  const done    = tasks.filter(t => t.status === 'done').length;

  const statStyle = 'flex:1;background:#242422;border-radius:10px;padding:14px 10px;border:0.5px solid rgba(255,255,255,0.08);text-align:center';
  document.getElementById('welcome-stats').innerHTML = `
    <div style="${statStyle}">
      <div style="font-size:26px;font-weight:700;color:#f0f0ec;line-height:1">${open}</div>
      <div style="font-size:11px;color:#505048;margin-top:4px;text-transform:uppercase;letter-spacing:.06em">Open</div>
    </div>
    <div style="${statStyle}">
      <div style="font-size:26px;font-weight:700;color:${overdue > 0 ? '#f87171' : '#f0f0ec'};line-height:1">${overdue}</div>
      <div style="font-size:11px;color:#505048;margin-top:4px;text-transform:uppercase;letter-spacing:.06em">Overdue</div>
    </div>
    <div style="${statStyle}">
      <div style="font-size:26px;font-weight:700;color:#5DCAA5;line-height:1">${done}</div>
      <div style="font-size:11px;color:#505048;margin-top:4px;text-transform:uppercase;letter-spacing:.06em">Done</div>
    </div>
  `;
  // Start floating after a short delay so the button is rendered
  setTimeout(startFloating, 300);
}

// ── AVATAR ───────────────────────────────────────────────────────────────────

function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const dataUrl = ev.target.result;
    localStorage.setItem('cs_dashboard_avatar', dataUrl);
    setAvatar(dataUrl);
  };
  reader.readAsDataURL(file);
}

function setAvatar(dataUrl) {
  const img = document.getElementById('avatar-img');
  const placeholder = document.getElementById('avatar-placeholder');
  img.src = dataUrl;
  img.style.display = 'block';
  placeholder.style.display = 'none';
}

function loadAvatar() {
  const saved = localStorage.getItem('cs_dashboard_avatar');
  if (saved) setAvatar(saved);
}

// ── INIT ──────────────────────────────────────────────────────────────────────

loadTasks();
updateHeaderStats();
loadAvatar();
initWelcome();
