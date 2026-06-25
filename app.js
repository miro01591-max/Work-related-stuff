const COLS = [
  { id: 'todo',         label: 'To Do' },
  { id: 'waiting',      label: 'Waiting for Response' },
  { id: 'inprogress',   label: 'In Progress' },
  { id: 'logtotango',   label: 'Log to Totango' },
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
  'logtotango':  'col-logtotango',
  'specialcare': 'col-specialcare',
  'done':        'col-done'
};

const COL_CARD_CLASSES = {
  'todo':        'card-col-todo',
  'waiting':     'card-col-waiting',
  'inprogress':  'card-col-inprogress',
  'logtotango':  'card-col-logtotango',
  'done':        'card-col-done',
  'specialcare': 'card-col-specialcare',
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
  const todayDate = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const addDays = n => { const d = new Date(todayDate); d.setDate(d.getDate() + n); return fmt(d); };
  const ts = (daysAgo) => { const d = new Date(todayDate); d.setDate(d.getDate() - daysAgo); return d.toISOString(); };
  return [
    { id: 1, title: 'Login problem — korisnik ne može pristupiti', client: 'Acme d.o.o.', tag: 'Support', status: 'waiting', due: addDays(3), note: '', createdAt: ts(5), movedAt: ts(3) },
    { id: 2, title: 'Faktura nije stigla na mail', client: 'Beta Systems', tag: 'Billing', status: 'todo', due: addDays(1), note: '', createdAt: ts(2), movedAt: ts(2) },
    { id: 3, title: 'Export PDF greška na Firefox', client: 'Gamma Tech', tag: 'Bug', status: 'inprogress', due: addDays(7), note: '', createdAt: ts(8), movedAt: ts(6) }
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
  launchRocket(() => {
    window.open('https://app.totango.com/t11/planradar-prod/#/my-business/overview', '_blank');
  });
}

function launchRocket(callback) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99997;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';

  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 400;
  canvas.style.cssText = 'display:block';

  const msg = document.createElement('div');
  msg.style.cssText = 'font-family:-apple-system,sans-serif;font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:.08em';
  msg.textContent = 'LAUNCHING TOTANGO...';

  overlay.appendChild(canvas);
  overlay.appendChild(msg);
  document.body.appendChild(overlay);

  const ctx = canvas.getContext('2d');
  const W = 300, H = 400;
  let frame = 0;
  let rocketY = H - 80;
  let launched = false;
  let raf;

  // Stars
  const stars = Array.from({length: 60}, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 1.5 + 0.3,
    twinkle: Math.random() * Math.PI * 2
  }));

  // Flame particles
  const particles = [];

  function spawnParticles(rx, ry) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: rx + (Math.random() - 0.5) * 10,
        y: ry + 40,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3,
        life: 1,
        r: 4 + Math.random() * 6,
        color: Math.random() > 0.5 ? '#ff6600' : '#ffcc00'
      });
    }
  }

  function drawRocket(x, y) {
    // Body
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.roundRect(x - 14, y - 30, 28, 50, 5);
    ctx.fill();

    // Nose cone
    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.moveTo(x, y - 55);
    ctx.lineTo(x - 14, y - 30);
    ctx.lineTo(x + 14, y - 30);
    ctx.closePath();
    ctx.fill();

    // Window
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(x, y - 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aaccff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fins
    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 10);
    ctx.lineTo(x - 26, y + 35);
    ctx.lineTo(x - 14, y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 10);
    ctx.lineTo(x + 26, y + 35);
    ctx.lineTo(x + 14, y + 20);
    ctx.closePath();
    ctx.fill();

    // Flame
    const flameSize = 12 + Math.sin(frame * 0.4) * 4;
    const grad = ctx.createRadialGradient(x, y + 40, 0, x, y + 40, flameSize * 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ffcc00');
    grad.addColorStop(0.7, '#ff6600');
    grad.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y + 40 + flameSize * 0.4, flameSize * 0.5, flameSize, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#060612';
    ctx.fillRect(0, 0, W, H);

    // Stars
    stars.forEach(s => {
      s.twinkle += 0.04;
      ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(s.twinkle) * 0.3})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Launch countdown then go
    if (frame < 60) {
      // Countdown
      const count = 3 - Math.floor(frame / 20);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(frame * 0.2) * 0.2})`;
      ctx.font = 'bold 48px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(count > 0 ? count : '🚀', W / 2, 80);
    } else {
      launched = true;
    }

    if (launched) {
      rocketY -= 5 + (frame - 60) * 0.15;
      if (frame % 2 === 0) spawnParticles(W / 2, rocketY);
    }

    // Particles
    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) { particles.splice(i, 1); return; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Launch pad
    if (!launched || rocketY > H - 80) {
      ctx.fillStyle = '#444';
      ctx.fillRect(W / 2 - 40, H - 45, 80, 8);
      ctx.fillRect(W / 2 - 5, H - 70, 10, 30);
    }

    drawRocket(W / 2, Math.min(rocketY, H - 80));

    frame++;

    // Close after rocket exits screen
    if (rocketY < -100) {
      cancelAnimationFrame(raf);
      overlay.style.transition = 'opacity 0.4s';
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); callback(); }, 400);
      return;
    }

    raf = requestAnimationFrame(tick);
  }

  // 8-bit rocket sound
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    // Rumble
    const noise = actx.createOscillator();
    const gain  = actx.createGain();
    noise.connect(gain); gain.connect(actx.destination);
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(80, t);
    noise.frequency.linearRampToValueAtTime(200, t + 2);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.linearRampToValueAtTime(0, t + 2);
    noise.start(t); noise.stop(t + 2);
    // Ascending beeps
    [440, 550, 660, 880, 1100].forEach((f, i) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.connect(g); g.connect(actx.destination);
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.06, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.15);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.2);
    });
  } catch(e) {}

  raf = requestAnimationFrame(tick);
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
  playSoundNav();
  if (tab === 'kb') renderBoard();
  if (tab === 'stats') renderStats();
  if (tab === 'weekly') renderWeekly();
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
  "customerInfo": "Name und Rolle des Kunden (z.B. Max Mustermann, Projektleiter bei Architekturbüro Herzer)",
  "companyName": "Nur der Firmenname ohne Personen oder Rollen (z.B. Architekturbüro Herzer GmbH)",
  "meetingDetails": "Dauer und Ziel des Meetings",
  "typeContext": "Art der Anfrage und Kontext — was war das Hauptthema/Problem",
  "valueReal": "Welchen Mehrwert hat der Kunde aus diesem Touchpoint erhalten",
  "nextSteps": ["Nächster Schritt 1", "Nächster Schritt 2"]
}

Wichtig:
- Alles auf Deutsch
- companyName: NUR der Firmenname, keine Personen, keine Rollen — wenn nicht erkennbar, leerer String
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
    trackTokens(data.usage);

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

    // Show company name in result header
    const company = parsed.companyName || pendingClient || '';
    if (company) {
      document.getElementById('result-client-label').textContent = company;
    }

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

  // Extract company name — priority: manual input > parsed companyName > extracted from customerInfo
  let client = pendingClient;

  if (!client && lastParsed?.companyName) {
    client = lastParsed.companyName.trim();
  }

  if (!client && lastParsed?.customerInfo) {
    const info = lastParsed.customerInfo;

    // Strategy 1: Look for known company suffixes
    const companyMatch = info.match(/([A-ZÜÖÄ][^,\n]*(?:GmbH|AG|GmbH & Co\.?\s*KG|KG|OHG|e\.V\.|eG|Büro|büro|Studio|Group|Solutions|Services|Systems|Holding|International|GbR|UG|SE)[^,\n]*)/);
    if (companyMatch) {
      client = companyMatch[1].trim().replace(/\s+/g, ' ');
    }

    // Strategy 2: Look after "bei", "von", "at", "@"
    if (!client) {
      const beiMatch = info.match(/(?:bei|von|at|@)\s+([^,\n\-–]+)/i);
      if (beiMatch) client = beiMatch[1].trim();
    }

    // Strategy 3: Last comma-separated segment
    if (!client) {
      const parts = info.split(/,\s*|-\s*|–\s*/);
      if (parts.length >= 2) client = parts[parts.length - 1].trim();
    }

    // Clean up role words
    if (client) {
      client = client
        .replace(/^(Herr|Frau|Mr|Mrs|Ms|Dr\.?|Prof\.?)\s+/i, '')
        .replace(/\s*(Geschäftsführer|Projektleiter|Manager|Director|CEO|CTO|Architekt|Ingenieur|Bauleiter|Berater|Consultant|Owner|Inhaber)\s*/gi, '')
        .trim();
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
    status: 'logtotango',
    due,
    note,
    createdAt: new Date().toISOString(),
    movedAt:   new Date().toISOString()
  });
  saveTasks();
  updateHeaderStats();
  showFeedback('Added to board → Log to Totango!', true);
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
        t.movedAt = new Date().toISOString();
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
      const dl       = dueLabel(t.due);
      const tagCls   = TAG_CLASSES[t.tag]     || 't-support';
      const colCardCls = COL_CARD_CLASSES[col.id] || 'card-col-todo';

      // Time tracking — days in current column
      const movedAt = t.movedAt ? new Date(t.movedAt) : new Date(t.createdAt || Date.now());
      const daysInCol = Math.floor((Date.now() - movedAt) / 864e5);
      let ageCls = '', ageText = '';
      if (t.status !== 'done' && daysInCol > 0) {
        ageText = `${daysInCol}d`;
        ageCls = daysInCol >= 7 ? 'old' : daysInCol >= 3 ? 'warn' : '';
      }

      const card = document.createElement('div');
      card.className = `kanban-card ${colCardCls}`;
      card.draggable = true;
      card.dataset.taskId = t.id;
      card.innerHTML = `
        <div class="card-drag-handle" aria-hidden="true"><i class="ti ti-grip-horizontal"></i></div>
        <div class="card-title">${escHtml(t.title)}</div>
        <div class="card-client card-client-link" data-client="${escHtml(t.client || '')}">${escHtml(t.client || '')}</div>
        <div class="card-meta">
          <span class="tag ${tagCls}">${t.tag}</span>
          ${dl ? `<span class="due-tag${dl.over ? ' over' : ''}">${dl.over ? '<i class="ti ti-alert-circle" style="font-size:12px;vertical-align:-1px"></i> ' : ''}${escHtml(dl.text)}</span>` : ''}
          ${ageText ? `<span class="card-age ${ageCls}"><i class="ti ti-clock" style="font-size:10px"></i> ${ageText}</span>` : ''}
        </div>
        <div class="card-totango ${t.totango ? 'card-totango-done' : ''}" data-id="${t.id}">
          <span class="totango-check ${t.totango ? 'checked' : ''}">
            <i class="ti ${t.totango ? 'ti-circle-check' : 'ti-circle'}"></i>
          </span>
          <span class="totango-label">${t.totango ? 'In Totango ✓' : 'Add to Totango'}</span>
        </div>`;

      // Client name click → client view
      const clientEl = card.querySelector('.card-client-link');
      if (clientEl && t.client) {
        clientEl.addEventListener('click', e => {
          e.stopPropagation();
          openClientModal(t.client);
        });
      }

      // Totango checkbox click
      card.querySelector('.card-totango').addEventListener('click', e => {
        e.stopPropagation();
        const task = tasks.find(x => x.id === t.id);
        if (!task) return;
        if (!task.totango) {
          task.totango = true;
          // Auto-move to Done if coming from Log to Totango
          if (task.status === 'logtotango') {
            task.status = 'done';
          }
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
    note:   document.getElementById('new-note').value.trim(),
    createdAt: new Date().toISOString(),
    movedAt:   new Date().toISOString()
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
    const newStatus = COLS[idx].id;
    if (newStatus !== t.status) t.movedAt = new Date().toISOString();
    t.status = newStatus;
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

let activeSlice = null; // { chartId, sliceIndex, data }

function renderStats() {
  const done    = tasks.filter(t => t.status === 'done').length;
  const open    = tasks.filter(t => t.status !== 'done').length;
  const overdue = tasks.filter(t => t.status !== 'done' && t.due && new Date(t.due) < new Date(today())).length;
  const total   = tasks.length;

  // ── PIE: status breakdown ──────────────────────────────────────────
  const pieCanvas = document.getElementById('pie-chart');
  const pieCtx    = pieCanvas.getContext('2d');
  const pieData   = [
    { label: 'Done',           value: tasks.filter(t => t.status === 'done').length,        color: '#16A34A', filter: t => t.status === 'done' },
    { label: 'In Progress',    value: tasks.filter(t => t.status === 'inprogress').length,   color: '#2563EB', filter: t => t.status === 'inprogress' },
    { label: 'Waiting',        value: tasks.filter(t => t.status === 'waiting').length,      color: '#EA580C', filter: t => t.status === 'waiting' },
    { label: 'To Do',          value: tasks.filter(t => t.status === 'todo').length,         color: '#7C3AED', filter: t => t.status === 'todo' },
    { label: 'Log to Totango', value: tasks.filter(t => t.status === 'logtotango').length,   color: '#0D9488', filter: t => t.status === 'logtotango' },
    { label: 'Special Care',   value: tasks.filter(t => t.status === 'specialcare').length,  color: '#E11D48', filter: t => t.status === 'specialcare' },
  ].filter(d => d.value > 0);

  drawInteractivePie(pieCanvas, pieCtx, pieData, 'pie');
  renderInteractiveLegend('chart-legend', pieData, 'pie');

  // ── PIE: by category ───────────────────────────────────────────────
  const cats = ['Support', 'Bug', 'Feature', 'Billing', 'Follow-up'];
  const catColors = { Support: '#2563EB', Bug: '#DC2626', Feature: '#16A34A', Billing: '#D97706', 'Follow-up': '#7C3AED' };
  const barData = cats.map(c => ({
    label: c, value: tasks.filter(t => t.tag === c).length,
    color: catColors[c], filter: t => t.tag === c
  })).filter(d => d.value > 0);

  const barCanvas = document.getElementById('bar-chart');
  const barCtx    = barCanvas.getContext('2d');
  if (barData.length) {
    drawInteractivePie(barCanvas, barCtx, barData, 'bar');
    renderInteractiveLegend('bar-legend', barData, 'bar');
  } else {
    barCtx.clearRect(0, 0, barCanvas.width, barCanvas.height);
    document.getElementById('bar-legend').innerHTML = '<span style="font-size:13px;color:var(--text-3)">No tasks yet</span>';
  }

  // ── SUMMARY ────────────────────────────────────────────────────────
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('summary-grid').innerHTML = `
    <div class="summary-item highlight"><div class="summary-num">${done}</div><div class="summary-lbl">Completed</div></div>
    <div class="summary-item"><div class="summary-num">${open}</div><div class="summary-lbl">Open</div></div>
    <div class="summary-item ${overdue > 0 ? 'warn' : ''}"><div class="summary-num">${overdue}</div><div class="summary-lbl">Overdue</div></div>
    <div class="summary-item"><div class="summary-num">${total}</div><div class="summary-lbl">Total</div></div>
    <div class="summary-item ${pct >= 70 ? 'highlight' : pct >= 40 ? '' : 'warn'}"><div class="summary-num">${pct}%</div><div class="summary-lbl">Completion rate</div></div>
  `;
}

function drawInteractivePie(canvas, ctx, data, chartId, selectedIdx = -1) {
  const size  = canvas.width;
  const cx = size / 2, cy = size / 2, r = size / 2 - 12;
  const total = data.reduce((s, d) => s + d.value, 0);
  ctx.clearRect(0, 0, size, size);

  if (total === 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a28'; ctx.fill(); return;
  }

  let start = -Math.PI / 2;
  data.forEach((d, i) => {
    const slice = (d.value / total) * Math.PI * 2;
    const isSelected = selectedIdx === i;
    const isFaded = selectedIdx >= 0 && !isSelected;

    // Explode selected slice
    const explode = isSelected ? 8 : 0;
    const midAngle = start + slice / 2;
    const ex = Math.cos(midAngle) * explode;
    const ey = Math.sin(midAngle) * explode;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.globalAlpha = isFaded ? 0.25 : 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.strokeStyle = '#1c1c1a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    start += slice;
  });

  // Donut hole
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1c1a'; ctx.fill();

  // Center text
  ctx.globalAlpha = 1;
  if (selectedIdx >= 0 && data[selectedIdx]) {
    const d = data[selectedIdx];
    const pct = Math.round((d.value / total) * 100);
    ctx.fillStyle = d.color;
    ctx.font = `bold ${size * 0.12}px -apple-system, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${pct}%`, cx, cy - 8);
    ctx.fillStyle = '#606058';
    ctx.font = `${size * 0.065}px -apple-system, sans-serif`;
    const shortLabel = d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label;
    ctx.fillText(shortLabel, cx, cy + 10);
  } else {
    const done = data.find(d => d.label === 'Done');
    if (done) {
      const pct = Math.round((done.value / total) * 100);
      ctx.fillStyle = '#16A34A';
      ctx.font = `bold ${size * 0.12}px -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, cx, cy - 8);
      ctx.fillStyle = '#606058';
      ctx.font = `${size * 0.065}px -apple-system, sans-serif`;
      ctx.fillText('done', cx, cy + 10);
    }
  }

  // Add click handler (replace old one)
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX - cx;
    const my = (e.clientY - rect.top)  * scaleY - cy;
    const dist = Math.sqrt(mx * mx + my * my);
    const innerR = r * 0.52;
    if (dist < innerR || dist > r + 14) { closeDrilldown(); return; }
    let angle = Math.atan2(my, mx) - (-Math.PI / 2);
    if (angle < 0) angle += Math.PI * 2;
    const tot = data.reduce((s, d) => s + d.value, 0);
    let s2 = 0, clickedIdx = -1;
    for (let i = 0; i < data.length; i++) {
      s2 += (data[i].value / tot) * Math.PI * 2;
      if (angle <= s2) { clickedIdx = i; break; }
    }
    if (clickedIdx < 0) return;
    if (activeSlice && activeSlice.chartId === chartId && activeSlice.sliceIndex === clickedIdx) {
      closeDrilldown(); return;
    }
    activeSlice = { chartId, sliceIndex: clickedIdx, data };
    drawInteractivePie(canvas, ctx, data, chartId, clickedIdx);
    renderInteractiveLegend(chartId === 'pie' ? 'chart-legend' : 'bar-legend', data, chartId, clickedIdx);
    showDrilldown(data[clickedIdx]);
    playSoundClick();
  };
}

function renderInteractiveLegend(containerId, data, chartId, selectedIdx = -1) {
  const total = data.reduce((s, d) => s + d.value, 0);
  document.getElementById(containerId).innerHTML = data.map((d, i) => `
    <div class="legend-item ${selectedIdx >= 0 && selectedIdx !== i ? 'faded' : ''}"
         onclick="legendClick('${chartId}', ${i})">
      <div class="legend-dot" style="background:${d.color}"></div>
      <span class="legend-label">${d.label}</span>
      <span class="legend-val">${d.value} <span style="font-weight:400;color:var(--text-3)">(${Math.round(d.value/total*100)}%)</span></span>
    </div>`).join('');
}

function legendClick(chartId, idx) {
  const canvasId = chartId === 'pie' ? 'pie-chart' : 'bar-chart';
  const legendId = chartId === 'pie' ? 'chart-legend' : 'bar-legend';
  const canvas   = document.getElementById(canvasId);
  const ctx      = canvas.getContext('2d');

  // Rebuild data
  const data = chartId === 'pie'
    ? [
        { label: 'Done',           value: tasks.filter(t => t.status === 'done').length,        color: '#16A34A', filter: t => t.status === 'done' },
        { label: 'In Progress',    value: tasks.filter(t => t.status === 'inprogress').length,   color: '#2563EB', filter: t => t.status === 'inprogress' },
        { label: 'Waiting',        value: tasks.filter(t => t.status === 'waiting').length,      color: '#EA580C', filter: t => t.status === 'waiting' },
        { label: 'To Do',          value: tasks.filter(t => t.status === 'todo').length,         color: '#7C3AED', filter: t => t.status === 'todo' },
        { label: 'Log to Totango', value: tasks.filter(t => t.status === 'logtotango').length,   color: '#0D9488', filter: t => t.status === 'logtotango' },
        { label: 'Special Care',   value: tasks.filter(t => t.status === 'specialcare').length,  color: '#E11D48', filter: t => t.status === 'specialcare' },
      ].filter(d => d.value > 0)
    : ['Support','Bug','Feature','Billing','Follow-up'].map(c => ({
        label: c, value: tasks.filter(t => t.tag === c).length,
        color: {Support:'#2563EB',Bug:'#DC2626',Feature:'#16A34A',Billing:'#D97706','Follow-up':'#7C3AED'}[c],
        filter: t => t.tag === c
      })).filter(d => d.value > 0);

  if (activeSlice && activeSlice.chartId === chartId && activeSlice.sliceIndex === idx) {
    closeDrilldown(); return;
  }
  activeSlice = { chartId, sliceIndex: idx, data };
  drawInteractivePie(canvas, ctx, data, chartId, idx);
  renderInteractiveLegend(legendId, data, chartId, idx);
  showDrilldown(data[idx]);
  playSoundClick();
}

function showDrilldown(slice) {
  const matchingTasks = tasks.filter(slice.filter);
  document.getElementById('drilldown-title').textContent = slice.label;
  document.getElementById('drilldown-count').textContent = `${matchingTasks.length} task${matchingTasks.length !== 1 ? 's' : ''}`;

  const container = document.getElementById('drilldown-tasks');
  if (matchingTasks.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:8px 0">No tasks in this group</div>';
  } else {
    container.innerHTML = matchingTasks.map(t => `
      <div class="drilldown-task" onclick="closeDrilldown();openDetail(${t.id})">
        <span class="tag ${TAG_CLASSES[t.tag] || 't-support'}">${t.tag}</span>
        <div class="drilldown-task-info">
          <div class="drilldown-task-title">${escHtml(t.title)}</div>
          ${t.client ? `<div class="drilldown-task-client">${escHtml(t.client)}</div>` : ''}
        </div>
      </div>`).join('');
  }

  // Show drilldown panel with color accent
  const scrollEl = document.getElementById('drilldown-tasks');
  scrollEl.style.scrollbarColor = '#e879a0 #0f0a14';
  scrollEl.style.scrollbarWidth = 'thin';

  if (!document.getElementById('dd-scrollbar-style')) {
    const s = document.createElement('style');
    s.id = 'dd-scrollbar-style';
    s.textContent = '#drilldown-tasks::-webkit-scrollbar{width:8px!important}#drilldown-tasks::-webkit-scrollbar-track{background:#0f0a14!important;border-radius:999px!important}#drilldown-tasks::-webkit-scrollbar-thumb{background:#e879a0!important;border-radius:999px!important;border:2px solid #0f0a14!important}#drilldown-tasks::-webkit-scrollbar-button{display:none!important}';
    document.head.appendChild(s);
  }

  const panel = document.getElementById('stats-drilldown');
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  const card = panel.querySelector('.drilldown-card');
  card.style.borderTopColor = slice.color;
  document.querySelector('.stats-layout').classList.add('with-drilldown');
}

function closeDrilldown() {
  activeSlice = null;
  document.getElementById('stats-drilldown').style.display = 'none';
  document.querySelector('.stats-layout').classList.remove('with-drilldown');
  renderStats();
}

// Keep old drawPie and renderLegend as no-ops for safety
function drawPie() {}
function renderLegend() {}

// ── WEEKLY VIEW ───────────────────────────────────────────────────────────────

function renderWeekly() {
  const todayStr = today();
  const todayDate = new Date(todayStr);
  const dayOfWeek = todayDate.getDay();
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = d => d.toISOString().split('T')[0];
  const sundayStr = fmt(sunday);

  const weekLabel = `${monday.toLocaleDateString('en-GB', { day:'numeric', month:'short' })} – ${sunday.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`;
  document.getElementById('weekly-title').textContent = `Week of ${weekLabel}`;

  const overdue    = tasks.filter(t => t.status !== 'done' && t.due && t.due < todayStr);
  const thisWeek   = tasks.filter(t => t.status !== 'done' && t.due && t.due >= todayStr && t.due <= sundayStr);
  const logTotango = tasks.filter(t => t.status === 'logtotango');
  const stuck      = tasks.filter(t => {
    if (t.status === 'done') return false;
    const moved = t.movedAt ? new Date(t.movedAt) : new Date(t.createdAt || 0);
    return Math.floor((Date.now() - moved) / 864e5) >= 5;
  }).sort((a, b) => {
    const daysA = Math.floor((Date.now() - new Date(a.movedAt || a.createdAt || 0)) / 864e5);
    const daysB = Math.floor((Date.now() - new Date(b.movedAt || b.createdAt || 0)) / 864e5);
    return daysB - daysA; // most stuck first
  });

  const grid = document.getElementById('weekly-grid');
  grid.innerHTML = '';

  // Top summary row
  const summary = document.createElement('div');
  summary.className = 'weekly-summary-row';
  summary.innerHTML = `
    <div class="weekly-summary-card ${overdue.length > 0 ? 'ws-red' : 'ws-green'}">
      <div class="ws-num">${overdue.length}</div>
      <div class="ws-lbl">Overdue</div>
    </div>
    <div class="weekly-summary-card ws-amber">
      <div class="ws-num">${thisWeek.length}</div>
      <div class="ws-lbl">Due this week</div>
    </div>
    <div class="weekly-summary-card ws-teal">
      <div class="ws-num">${logTotango.length}</div>
      <div class="ws-lbl">To log in Totango</div>
    </div>
    <div class="weekly-summary-card ws-purple">
      <div class="ws-num">${stuck.length}</div>
      <div class="ws-lbl">Stuck 5+ days</div>
    </div>
  `;
  grid.appendChild(summary);

  // Sections — only show non-empty or with clear message
  const sections = [
    { title: 'Overdue', icon: 'ti-alert-circle', color: '#f87171', items: overdue, limit: 10 },
    { title: 'Due this week', icon: 'ti-calendar-due', color: '#EF9F27', items: thisWeek, limit: 10 },
    { title: 'To log in Totango', icon: 'ti-external-link', color: '#0D9488', items: logTotango, limit: 10 },
    { title: 'Stuck 5+ days', icon: 'ti-clock', color: '#9060ee', items: stuck, limit: 5 },
  ];

  sections.forEach(sec => {
    if (sec.items.length === 0) return; // skip empty sections

    const div = document.createElement('div');
    div.className = 'weekly-section';

    // Header
    div.innerHTML = `
      <div class="weekly-section-title">
        <i class="ti ${sec.icon}" style="color:${sec.color}" aria-hidden="true"></i>
        ${sec.title}
        <span class="ws-count" style="background:${sec.color}22;color:${sec.color}">${sec.items.length}</span>
      </div>`;

    // Show items — flat list, no client grouping for cleaner look
    const shown = sec.items.slice(0, sec.limit);
    shown.forEach(t => {
      const dl = dueLabel(t.due);
      const moved = t.movedAt ? new Date(t.movedAt) : new Date(t.createdAt || 0);
      const daysStuck = Math.floor((Date.now() - moved) / 864e5);
      const row = document.createElement('div');
      row.className = 'weekly-task-row';
      row.innerHTML = `
        <span class="tag ${TAG_CLASSES[t.tag] || 't-support'}">${t.tag}</span>
        <div class="weekly-task-info">
          <div class="weekly-task-title">${escHtml(t.title.slice(0, 55))}${t.title.length > 55 ? '...' : ''}</div>
          ${t.client ? `<div class="weekly-task-client">${escHtml(t.client)}</div>` : ''}
        </div>
        ${sec.title.includes('Stuck') ? `<span class="weekly-stuck-days">${daysStuck}d</span>` : ''}
        ${dl ? `<span class="weekly-due${dl.over ? ' over' : ''}">${dl.text}</span>` : ''}
      `;
      row.onclick = () => { openDetail(t.id); playSoundClick(); };
      div.appendChild(row);
    });

    // Show more button if truncated
    if (sec.items.length > sec.limit) {
      const more = document.createElement('div');
      more.className = 'weekly-show-more';
      more.textContent = `+ ${sec.items.length - sec.limit} more`;
      more.onclick = () => {
        sec.items.slice(sec.limit).forEach(t => {
          const dl = dueLabel(t.due);
          const moved = t.movedAt ? new Date(t.movedAt) : new Date(t.createdAt || 0);
          const daysStuck = Math.floor((Date.now() - moved) / 864e5);
          const row = document.createElement('div');
          row.className = 'weekly-task-row';
          row.innerHTML = `
            <span class="tag ${TAG_CLASSES[t.tag] || 't-support'}">${t.tag}</span>
            <div class="weekly-task-info">
              <div class="weekly-task-title">${escHtml(t.title.slice(0, 55))}${t.title.length > 55 ? '...' : ''}</div>
              ${t.client ? `<div class="weekly-task-client">${escHtml(t.client)}</div>` : ''}
            </div>
            ${sec.title.includes('Stuck') ? `<span class="weekly-stuck-days">${daysStuck}d</span>` : ''}
            ${dl ? `<span class="weekly-due${dl.over ? ' over' : ''}">${dl.text}</span>` : ''}
          `;
          row.onclick = () => { openDetail(t.id); playSoundClick(); };
          div.insertBefore(row, more);
        });
        more.remove();
      };
      div.appendChild(more);
    }

    grid.appendChild(div);
  });

  // If everything is clear
  if (overdue.length === 0 && thisWeek.length === 0 && logTotango.length === 0 && stuck.length === 0) {
    const clear = document.createElement('div');
    clear.className = 'weekly-all-clear';
    clear.innerHTML = `<i class="ti ti-circle-check" style="font-size:32px;color:#16A34A" aria-hidden="true"></i><div>All clear — great week! 🎉</div>`;
    grid.appendChild(clear);
  }
}

// ── CLIENT VIEW ───────────────────────────────────────────────────────────────

function openClientModal(clientName) {
  const clientTasks = tasks.filter(t => t.client === clientName && t.status !== 'done');
  const doneTasks   = tasks.filter(t => t.client === clientName && t.status === 'done');

  document.getElementById('client-modal-name').textContent = clientName;

  const colBadge = {
    todo: 'col-badge-todo', waiting: 'col-badge-waiting',
    inprogress: 'col-badge-inprogress', logtotango: 'col-badge-logtotango',
    done: 'col-badge-done', specialcare: 'col-badge-specialcare'
  };
  const colLabel = {
    todo: 'To Do', waiting: 'Waiting', inprogress: 'In Progress',
    logtotango: 'Log to Totango', done: 'Done', specialcare: 'Special Care'
  };

  const renderTaskList = (list) => list.map(t => `
    <div class="client-task-item" onclick="closeClientModal();openDetail(${t.id})">
      <span class="tag ${TAG_CLASSES[t.tag] || 't-support'}">${t.tag}</span>
      <span class="client-task-title">${escHtml(t.title)}</span>
      <span class="client-col-badge ${colBadge[t.status] || ''}">${colLabel[t.status] || t.status}</span>
    </div>`).join('');

  document.getElementById('client-modal-tasks').innerHTML = `
    ${clientTasks.length ? `<div style="font-size:12px;color:var(--text-3);margin-bottom:8px;font-weight:600">OPEN (${clientTasks.length})</div>${renderTaskList(clientTasks)}` : '<div style="font-size:13px;color:var(--text-3);padding:8px 0">No open tasks ✓</div>'}
    ${doneTasks.length ? `<div style="font-size:12px;color:var(--text-3);margin:14px 0 8px;font-weight:600">DONE (${doneTasks.length})</div>${renderTaskList(doneTasks)}` : ''}
  `;

  document.getElementById('client-modal').classList.add('open');
  playSoundOpen();
}

function closeClientModal() {
  document.getElementById('client-modal').classList.remove('open');
  playSoundClose();
}

// ── BROWSER NOTIFICATIONS ────────────────────────────────────────────────────

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function checkDueNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const todayStr = today();
  const dueTodayOrOver = tasks.filter(t =>
    t.status !== 'done' && t.due && t.due <= todayStr
  );
  if (dueTodayOrOver.length > 0) {
    new Notification('CS Dashboard', {
      body: `${dueTodayOrOver.length} task${dueTodayOrOver.length > 1 ? 's' : ''} due today or overdue!`,
      icon: 'https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/layout-kanban.svg'
    });
  }
}

function scheduleMorningNotification() {
  requestNotificationPermission();
  const now = new Date();
  const next9am = new Date(now);
  next9am.setHours(9, 0, 0, 0);
  if (now >= next9am) next9am.setDate(next9am.getDate() + 1);
  const msUntil9am = next9am - now;
  setTimeout(() => {
    checkDueNotifications();
    setInterval(checkDueNotifications, 24 * 60 * 60 * 1000);
  }, msUntil9am);
}

// ── TOKEN TRACKER ────────────────────────────────────────────────────────────

let sessionTokens = { input: 0, output: 0 };

function trackTokens(usage) {
  if (!usage) return;
  sessionTokens.input  += usage.input_tokens  || 0;
  sessionTokens.output += usage.output_tokens || 0;
  updateTokenDisplay();
}

function updateTokenDisplay() {
  const total = sessionTokens.input + sessionTokens.output;
  const cost = (sessionTokens.input / 1_000_000 * 3) + (sessionTokens.output / 1_000_000 * 15);

  let color = '#5DCAA5';
  if (cost > 0.10) color = '#EF9F27';
  if (cost > 0.50) color = '#f87171';

  const counter = document.getElementById('token-display');
  const numEl   = document.getElementById('token-num');
  const costEl  = document.getElementById('token-cost');
  if (!counter || !numEl || !costEl) return;

  counter.style.color = color;
  numEl.textContent   = total.toLocaleString();
  costEl.textContent  = `$${cost.toFixed(3)}`;
}

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
    trackTokens(data.usage);
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
scheduleMorningNotification();

document.getElementById('client-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeClientModal();
});
