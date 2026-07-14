/* RTO Practice Portal */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut, deleteUser, applyActionCode } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

(() => {
'use strict';

const CATS = {
  signs:    { name: 'Traffic Signs',      tag: 'SIGNS' },
  signals:  { name: 'Signals & Police',   tag: 'SIGNALS' },
  markings: { name: 'Road Markings',      tag: 'MARKINGS' },
  rules:    { name: 'Rules of the Road',  tag: 'RULES' },
  safety:   { name: 'Safe Driving',       tag: 'SAFETY' },
  fines:    { name: 'Fines & Penalties',  tag: 'FINES' },
  law:      { name: 'Licence & Documents',tag: 'LAW' },
};
const MOCK_N = 30, MOCK_PASS = 18, MOCK_Q_SECS = 30;

const authDomain = 'fir-4cdbf.firebaseapp.com';
const localPreviewUrl = 'http://localhost:8000/rto-cracker/';
const siteUrl = 'https://rto-cracker.vercel.app/';
const actionCodeSettings = { url: siteUrl, handleCodeInApp: false };

function ensureLocalPreviewHost() {
  if (window.location.hostname === '127.0.0.1' && !window.location.href.includes('localhost')) {
    window.location.replace(localPreviewUrl);
    return true;
  }
  return false;
}

const firebaseConfig = {
  apiKey: "AIzaSyBSAQOlqHnkcWCtwOFMeBIVqyjWiHR0zcQ",
  authDomain: authDomain,
  projectId: "fir-4cdbf",
  storageBucket: "fir-4cdbf.firebasestorage.app",
  messagingSenderId: "858814965234",
  appId: "1:858814965234:web:86b3a9ecf86ee975daf76b",
  measurementId: "G-FWMS8R6FVN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

let BANK = [];
let byId = new Map();
let verificationTimer = null;
let lastResults = null;

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem('rto_' + k)); return v === null ? d : v; } catch { return d; } },
  set(k, v) { localStorage.setItem('rto_' + k, JSON.stringify(v)); }
};
let state = {
  name: store.get('name', ''),
  answered: store.get('answered', {}),   // id -> true(correct)/false
  saved: store.get('saved', []),
  mocks: store.get('mocks', []),         // {score, total, pass, date}
  sessions: store.get('sessions', {})    // topic-session results keyed by `${cat}:${i}`
};
const persist = () => { store.set('answered', state.answered); store.set('saved', state.saved); store.set('mocks', state.mocks); store.set('sessions', state.sessions); store.set('studied', state.studied || []); saveUserState(); };

async function saveUserState() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, {
      name: state.name || user.displayName || '',
      email: user.email || '',
      answered: state.answered,
      saved: state.saved,
      mocks: state.mocks,
      sessions: state.sessions,
      studied: state.studied || [],
      updatedAt: Date.now()
    }, { merge: true });
    console.log('saveUserState: synced to Firestore for', uid);
  } catch (e) { console.warn('saveUserState failed', e); }
}

// Pull the signed-in user's saved progress from Firestore and merge it with
// whatever is in this browser, so a Google account carries progress across
// devices and browsers. Union everything; never drop a completed question.
let userStateLoaded = false;
async function loadUserState(user) {
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { userStateLoaded = true; await saveUserState(); return; }
    const remote = snap.data() || {};

    // answered: union of both; a question answered anywhere stays answered.
    // Keep "correct" if it was ever correct on either device.
    const mergedAnswered = { ...(remote.answered || {}) };
    for (const [id, ok] of Object.entries(state.answered || {})) {
      mergedAnswered[id] = mergedAnswered[id] === true || ok === true ? (mergedAnswered[id] === true || ok === true) : false;
    }
    state.answered = mergedAnswered;

    state.saved = [...new Set([...(remote.saved || []), ...(state.saved || [])])];
    state.studied = [...new Set([...(remote.studied || []), ...(state.studied || [])])];

    // mocks: union, de-duplicated by timestamp, chronological
    const mockMap = new Map();
    [...(remote.mocks || []), ...(state.mocks || [])].forEach(m => m && mockMap.set(m.date, m));
    state.mocks = [...mockMap.values()].sort((a, b) => a.date - b.date);

    // sessions: prefer whichever record has more attempts for each key
    const mergedSessions = { ...(remote.sessions || {}) };
    for (const [k, local] of Object.entries(state.sessions || {})) {
      if (k === 'inprogress') { mergedSessions[k] = local; continue; }
      const rem = mergedSessions[k];
      if (!rem) { mergedSessions[k] = local; continue; }
      const localAtt = (local.answers && local.answers.length) || local.total || 0;
      const remAtt = (rem.answers && rem.answers.length) || rem.total || 0;
      mergedSessions[k] = localAtt >= remAtt ? local : rem;
    }
    state.sessions = mergedSessions;

    if (!state.name) state.name = remote.name || '';
    userStateLoaded = true;
    persist(); // writes the merged result back to localStorage + Firestore
    console.log('loadUserState: merged remote progress for', user.uid);
  } catch (e) { console.warn('loadUserState failed', e); userStateLoaded = true; }
}

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };const fmtSecs = ms => `${(ms / 1000).toFixed(2)}s`;

function showTimingToast(message) {
  const toast = $('#timing-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showTimingToast._timer);
  showTimingToast._timer = setTimeout(() => toast.classList.add('hidden'), 1600);
}

/* ---------- sound effects (Web Audio, no external files) ---------- */
let audioCtx = null;
function isMuted() { return store.get('muted', false); }
function tone(freqs, dur, type = 'sine', vol = 0.14) {
  if (isMuted()) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    freqs.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = f;
      o.connect(g); g.connect(audioCtx.destination);
      const start = now + i * dur;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.start(start); o.stop(start + dur + 0.02);
    });
  } catch (e) { /* ignore */ }
}
function playSound(kind) {
  switch (kind) {
    case 'select':  tone([440], 0.09, 'triangle', 0.12); break;
    case 'tick':    tone([900], 0.05, 'square', 0.07); break;
    case 'timeup':  tone([320, 220], 0.16, 'sawtooth', 0.14); break;
    case 'start':   tone([523, 659], 0.1, 'sine', 0.12); break;
    case 'pass':    tone([523, 659, 784, 1047], 0.15, 'sine', 0.16); break;
    case 'fail':    tone([392, 330, 262], 0.2, 'sine', 0.14); break;
  }
}
function updateMuteButtons() {
  const muted = isMuted();
  $$('.mute-btn').forEach(b => { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-label', muted ? 'Unmute sounds' : 'Mute sounds'); b.classList.toggle('is-muted', muted); });
}
function toggleMute() { store.set('muted', !isMuted()); updateMuteButtons(); if (!isMuted()) playSound('select'); }
/* ---------- views ---------- */
function show(view) {
  const protectedViews = ['home','mock','saved','wrong','topic','session-detail'];
  const isGuest = store.get('guest', false);
  const curUser = auth.currentUser;
  if (protectedViews.includes(view)) {
    if (!curUser && !isGuest) { show('welcome'); return; }
    if (curUser && !curUser.emailVerified) { show('verification'); return; }
  }
  $$('.view').forEach(v => v.classList.add('hidden'));
  const shell = $('#app-shell');
  if (['home', 'mock', 'saved', 'wrong', 'topic', 'session-detail', 'profile'].includes(view)) {
    shell.classList.remove('hidden');
    $$('#view-home,#view-mock,#view-saved,#view-wrong,#view-topic,#view-session-detail,#view-profile').forEach(v => v.classList.add('hidden'));
    const target = $('#view-' + view);
    if (target) target.classList.remove('hidden');
    $$('.nav-item,.tnav').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
    console.log('show view', view);
    // call renderers safely so a runtime error doesn't leave a blank view
    try { if (view === 'home') renderDashboard(); } catch (e) { console.error('renderDashboard failed', e); if ($('#view-home')) $('#view-home').innerHTML = '<div class="card">Error rendering dashboard — check console.</div>'; }
    try { if (view === 'mock') renderMockLanding(); } catch (e) { console.error('renderMockLanding failed', e); if ($('#view-mock')) $('#view-mock').innerHTML = '<div class="card">Error rendering mock landing — check console.</div>'; }
    try { if (view === 'saved') renderSaved(); } catch (e) { console.error('renderSaved failed', e); if ($('#view-saved')) $('#view-saved').innerHTML = '<div class="card">Error rendering saved list — check console.</div>'; }
    try { if (view === 'wrong') renderWrong(); } catch (e) { console.error('renderWrong failed', e); if ($('#view-wrong')) $('#view-wrong').innerHTML = '<div class="card">Error rendering mistakes — check console.</div>'; }
    // safety fallback: if target view has no visible content, insert a placeholder
    try {
      const tEl = $('#view-' + view);
      if (tEl && !tEl.innerHTML.trim()) {
        console.warn('show(): view', view, 'has no content — inserting placeholder');
        tEl.innerHTML = '<div class="card">Nothing to display for this view right now.</div>';
      }
    } catch (e) { console.error('show(): fallback insertion failed', e); }
    window.scrollTo(0, 0);
  } else {
    shell.classList.add('hidden');
    $('#view-' + view).classList.remove('hidden');
  }
}

function setAuthMessage(message, type = 'success') {
  const box = $('#auth-message');
  if (!box) return;
  box.textContent = message;
  box.className = `auth-message ${type}`;
  if (!message) box.classList.add('hidden');
  else box.classList.remove('hidden');
}

function setActiveAuthTab(tab) {
  $$('.auth-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
  $('#signup-form').classList.toggle('hidden', tab !== 'signup');
  $('#login-form').classList.toggle('hidden', tab !== 'login');
  $('#reset-panel').classList.add('hidden');
}

function updatePasswordStrength(password) {
  const fill = $('#strength-fill');
  const text = $('#strength-text');
  if (!fill || !text) return;
  if (!password) {
    fill.style.width = '0%';
    fill.style.background = 'var(--outline)';
    text.textContent = 'Enter a password';
    return;
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (password.length < 8) {
    fill.style.width = '30%';
    fill.style.background = '#dc2626';
    text.textContent = 'Weak 😟';
  } else if (hasUpper && hasNumber && hasSpecial) {
    fill.style.width = '100%';
    fill.style.background = '#16a34a';
    text.textContent = 'Strong 💪';
  } else if (hasUpper && hasNumber) {
    fill.style.width = '70%';
    fill.style.background = '#f59e0b';
    text.textContent = 'Medium 🙂';
  } else {
    fill.style.width = '50%';
    fill.style.background = '#f59e0b';
    text.textContent = 'Medium 🙂';
  }
}

function togglePasswordVisibility(inputId) {
  const input = $('#' + inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  $('#greeting').textContent = `Good ${part}${state.name ? ', ' + state.name : ''}!`;

  const ids = Object.keys(state.answered);
  const correct = ids.filter(id => state.answered[id]).length;
  const pct = Math.round(100 * ids.length / BANK.length);
  $('#greeting-sub').textContent = ids.length
    ? `You've covered ${pct}% of the question bank. Keep going!`
    : `Let's get you ready for the learner's test.`;
  $('#ring-pct').textContent = pct + '%';
  $('#ring-fg').style.strokeDashoffset = 213.6 * (1 - pct / 100);

  $('#stat-accuracy').textContent = ids.length ? Math.round(100 * correct / ids.length) + '%' : '—';
  $('#stat-attempted').textContent = ids.length + ' Qs';
  const passed = state.mocks.filter(m => m.pass).length;
  $('#stat-mocks').textContent = `${passed} / ${state.mocks.length}`;
  const best = state.mocks.reduce((b, m) => Math.max(b, m.score), 0);
  $('#stat-best').textContent = state.mocks.length ? `${best} / ${MOCK_N}` : '—';
  $('#bank-size').textContent = BANK.length + ' questions';

  const grid = $('#category-grid');
  grid.innerHTML = '';
  for (const [key, meta] of Object.entries(CATS)) {
    const qs = BANK.filter(q => q.cat === key);
    if (!qs.length) continue;
    const done = qs.filter(q => q.id in state.answered);
    const good = done.filter(q => state.answered[q.id]).length;
    const p = Math.round(100 * done.length / qs.length);
    const stateTxt = !done.length ? '○ Not started' : p === 100 ? '✓ Completed' : `◐ ${p}% done`;
    // count completed sessions for this topic
    const completedSessions = Object.keys(state.sessions || {}).filter(k => k.startsWith(key + ':') && state.sessions[k] && state.sessions[k].score !== undefined).length;
    const btn = document.createElement('button');
    btn.className = 'session-card';
    const inprogTopic = state.sessions && state.sessions.inprogress && String(state.sessions.inprogress.key).startsWith(key + ':');
    btn.innerHTML = `
      <div class="sc-top"><h4>${meta.name}</h4><span class="sc-tag">${meta.tag}</span></div>
      <div class="sc-meta">${qs.length} questions${done.length ? ` · ${good}/${done.length} correct` : ''}</div>
      <div class="sc-bar"><i style="width:${p}%"></i></div>
      <div class="sc-state">${stateTxt}</div>
      <div class="sc-footer">${completedSessions ? `<small>${completedSessions} sessions completed</small>` : ''}${inprogTopic ? ' <span class="resume-badge">Resume available</span>' : ''}</div>`;
    btn.addEventListener('click', () => showTopicSessions(key));
    grid.appendChild(btn);
  }
}

function chunkArray(a, size) {
  const out = [];
  for (let i = 0; i < a.length; i += size) out.push(a.slice(i, i + size));
  return out;
}

function showTopicSessions(cat) {
  const qs = BANK.filter(q => q.cat === cat);
  if (!qs.length) return;
  const chunks = chunkArray(qs, 15);
  $('#topic-title').textContent = CATS[cat].name;
  $('#topic-sub').textContent = `${qs.length} questions · ${chunks.length} sessions`;
  const container = $('#topic-sessions');
  container.innerHTML = '';
  chunks.forEach((chunk, i) => {
    const key = `${cat}:${i}`;
    const sess = state.sessions[key];
    const attemptedCount = sess ? (sess.attemptedCount || sess.total || 0) : chunk.filter(q => q.id in state.answered).length;
    const correct = sess ? sess.score : chunk.filter(q => state.answered[q.id]).length;
    const wrong = Math.max(0, attemptedCount - correct);
    const pct = Math.round(100 * attemptedCount / chunk.length);
    const notStarted = attemptedCount === 0;
    const fullyDone = attemptedCount >= chunk.length;
    const div = document.createElement('div');
    div.className = 'topic-session' + (fullyDone ? ' completed' : '') + (fullyDone && pct === 100 ? ' perfect' : '');
    // show resume button if there's an inprogress session matching this key
    const inprog = state.sessions && state.sessions.inprogress && state.sessions.inprogress.key === key;
    div.innerHTML = `
      <div class="ts-top"><div><strong>Session ${i + 1}</strong><div class="ts-meta">${chunk.length} questions${notStarted ? '' : ` · ${attemptedCount}/${chunk.length} done`}</div></div><div class="ts-badge">${notStarted ? 'New' : pct + '%'}</div></div>
      <div class="ts-meta">${notStarted ? 'Not attempted yet' : `${correct} correct · ${wrong} wrong`}</div>
      <div class="ts-actions">
        <button class="btn btn-primary" data-start-session="${i}">${inprog ? 'Resume' : (notStarted ? 'Start' : 'Restart')}</button>
        <button class="btn btn-ghost" data-retry-session="${i}"${notStarted ? ' disabled' : ''}>Retry wrong</button>
        <button class="btn btn-ghost" data-detail-session="${i}"${notStarted ? ' disabled' : ''}>Details</button>
      </div>`;
    container.appendChild(div);
  });
  // wire controls
  $$('#topic-sessions [data-start-session]').forEach(b => b.addEventListener('click', () => {
    const idx = +b.dataset.startSession;
    const key = `${cat}:${idx}`;
    const inprog = state.sessions && state.sessions.inprogress && state.sessions.inprogress.key === key;
    if (inprog) resumeTopicSession(cat, idx);
    else startTopicSession(cat, idx, false);
  }));
  $$('#topic-sessions [data-retry-session]').forEach(b => b.addEventListener('click', () => startTopicSession(cat, +b.dataset.retrySession, true)));
  $$('#topic-sessions [data-detail-session]').forEach(b => b.addEventListener('click', () => renderSessionDetail(cat, +b.dataset.detailSession)));
  $('#btn-topic-practice-all').onclick = () => startTopicSession(cat, null, false);
  $('#btn-topic-practice-wrong').onclick = () => startTopicSession(cat, null, true);
  $('#btn-topic-back').onclick = () => show('home');
  show('topic');
}

function startTopicSession(cat, sessionIndex = null, wrongOnly = false) {
  const pool = BANK.filter(q => q.cat === cat);
  if (!pool.length) return;
  if (sessionIndex === null) {
    // full topic or wrong-only across topic
    const qs = wrongOnly ? pool.filter(q => !(q.id in state.answered)) : shuffle(pool);
    quiz = { mode: 'practice', qs: qs.slice(0, 15), i: 0, answers: [], cat, sessionIndex: null, retryWrong: wrongOnly, questionStartedAt: 0, questionTimes: [], questionCompleted: false };
    // set in-progress key for topic-wide session
    state.sessions.inprogress = { key: `${cat}:topic`, qsIds: quiz.qs.map(q => q.id), answers: quiz.answers, i: quiz.i, questionTimes: quiz.questionTimes };
    persist();
  } else {
    const chunks = chunkArray(pool, 15);
    const chunk = chunks[sessionIndex] || [];
    let qs;
    if (wrongOnly) {
      const key = `${cat}:${sessionIndex}`;
      const sess = state.sessions[key];
      if (sess && Array.isArray(sess.wrongIds) && sess.wrongIds.length) {
        qs = chunk.filter(q => sess.wrongIds.includes(q.id));
      } else {
        // fallback: unanswered in this chunk
        qs = chunk.filter(q => !(q.id in state.answered));
      }
    } else {
      qs = chunk;
    }
    quiz = { mode: 'practice', qs, i: 0, answers: [], cat, sessionIndex, retryWrong: wrongOnly, questionStartedAt: 0, questionTimes: [], questionCompleted: false };
    // set in-progress key for this specific session
    state.sessions.inprogress = { key: `${cat}:${sessionIndex}`, qsIds: quiz.qs.map(q => q.id), answers: quiz.answers, i: quiz.i, questionTimes: quiz.questionTimes };
    persist();
  }
  $('#quiz-title').textContent = `${CATS[cat].name} — Session ${sessionIndex === null ? 'Topic' : sessionIndex + 1}`;
  $('#quiz-timer').classList.add('hidden');
  show('quiz');
  renderQuestion();
}

/* ---------- mock landing ---------- */
function renderMockLanding() {
  const list = $('#mock-history');
  if (!state.mocks.length) { list.innerHTML = '<div class="empty-note">No attempts yet. Your results will appear here.</div>'; return; }
  list.innerHTML = state.mocks.slice().reverse().map(m => `
    <div class="mock-row">
      <span class="mr-badge ${m.pass ? 'mr-pass' : 'mr-fail'}">${m.pass ? 'PASS' : 'FAIL'}</span>
      <span>${m.score} / ${m.total} correct</span>
      <span class="mr-date">${new Date(m.date).toLocaleString()}</span>
    </div>`).join('');
}

/* ---------- saved & wrong ---------- */
function reviewItem(q, cls, extra = '') {
  return `<div class="review-item ${cls}">
    <div class="ri-q">${esc(q.q)}</div>
    ${q.img ? `<img src="${q.img}" alt="sign" loading="lazy"/>` : ''}
    <div class="ri-a">✓ ${esc(q.options[q.answer])}</div>${extra}</div>`;
}
function renderSaved() {
  const list = $('#saved-list');
  const qs = state.saved.map(id => byId.get(id)).filter(Boolean);
  list.innerHTML = qs.length
    ? qs.map(q => reviewItem(q, '', `<div class="ri-actions"><button class="link-btn" data-unsave="${q.id}">Remove</button></div>`)).join('')
    : '<div class="empty-note">Nothing saved yet. Tap 🔖 on any question during practice.</div>';
  list.querySelectorAll('[data-unsave]').forEach(b => b.addEventListener('click', () => {
    state.saved = state.saved.filter(id => id !== +b.dataset.unsave); persist(); renderSaved();
  }));
}
function wrongIds() { return Object.keys(state.answered).filter(id => !state.answered[id]).map(Number); }
function renderWrong() {
  const list = $('#wrong-list');
  const qs = wrongIds().map(id => byId.get(id)).filter(Boolean);
  $('#btn-practice-wrong').style.display = qs.length ? '' : 'none';
  if (!qs.length) { list.innerHTML = '<div class="empty-note">No mistakes pending — great job! Wrong answers land here automatically.</div>'; return; }
  list.innerHTML = qs.map(q => `
    <div class="review-item bad">
      <div class="ri-q">${esc(q.q)}</div>
      ${q.img ? `<img src="${q.img}" alt="sign" loading="lazy"/>` : ''}
      <div class="ri-a">✓ ${esc(q.options[q.answer])}</div>
      <div class="ri-actions" style="margin-top:8px;display:flex;gap:8px">
        <button class="link-btn" data-study="${q.id}">Mark studied</button>
        <button class="link-btn" data-review="${q.id}">Practice now</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('[data-study]').forEach(b => b.addEventListener('click', () => {
    const id = +b.dataset.study;
    state.studied = state.studied || [];
    if (!state.studied.includes(id)) state.studied.push(id);
    delete state.answered[id]; persist(); renderWrong();
  }));
  list.querySelectorAll('[data-review]').forEach(b => b.addEventListener('click', () => { startPractice('wrong'); }));
}

/* ---------- quiz engine ---------- */
let quiz = null; // {mode, qs, i, answers[], timer, secsLeft, cat, questionStartedAt, questionTimes, questionCompleted}

function startPractice(cat) {
  const pool = cat === '*' ? BANK : cat === 'wrong' ? wrongIds().map(id => byId.get(id)).filter(Boolean) : BANK.filter(q => q.cat === cat);
  if (!pool.length) return;
  // unanswered first, then wrong, then the rest
  const fresh = pool.filter(q => !(q.id in state.answered));
  const rest = shuffle(pool.filter(q => q.id in state.answered));
  const qs = (cat === 'wrong' ? shuffle(pool) : fresh.concat(rest)).slice(0, cat === '*' ? 10 : 15);
  quiz = { mode: 'practice', qs, i: 0, answers: [], cat, questionStartedAt: 0, questionTimes: [], questionCompleted: false };
  $('#quiz-title').textContent = cat === '*' ? 'Quick Practice' : cat === 'wrong' ? 'Reviewing Mistakes' : CATS[cat].name;
  $('#quiz-timer').classList.add('hidden');
  show('quiz');
  renderQuestion();
}

function startMock() {
  // 30 questions drawn at random from every topic
  const qs = shuffle(BANK).slice(0, MOCK_N);
  quiz = { mode: 'mock', qs, i: 0, answers: [], questionStartedAt: 0, questionTimes: [], questionCompleted: false, qTimer: null };
  $('#quiz-title').textContent = 'Mock Test';
  playSound('start');
  show('quiz');
  renderQuestion();
}

function clearQuestionTimer() { if (quiz && quiz.qTimer) { clearInterval(quiz.qTimer); quiz.qTimer = null; } }

// Per-question 30-second countdown for the mock exam.
function startQuestionTimer() {
  clearQuestionTimer();
  let left = MOCK_Q_SECS;
  const t = $('#quiz-timer');
  t.classList.remove('hidden');
  const paint = () => {
    t.textContent = `⏱ 0:${String(left).padStart(2, '0')}`;
    t.classList.toggle('warn', left <= 10);
  };
  paint();
  quiz.qTimer = setInterval(() => {
    left--;
    paint();
    if (left <= 5 && left > 0) playSound('tick');
    if (left <= 0) {
      clearQuestionTimer();
      playSound('timeup');
      autoAdvanceMock();
    }
  }, 1000);
}

// Called when a mock question's time runs out: keep any selection, move on.
function autoAdvanceMock() {
  if (!quiz.questionCompleted && quiz.answers[quiz.i] === undefined) {
    quiz.questionTimes[quiz.i] = MOCK_Q_SECS * 1000;
    quiz.questionCompleted = true;
  }
  if (quiz.i < quiz.qs.length - 1) { quiz.i++; renderQuestion(); }
  else finishQuiz(true);
}

function downloadResultsPDF() {
  if (!lastResults) { setAuthMessage('No recent results to export.', 'error'); return; }
  // build HTML content for PDF
  const wrap = document.createElement('div');
  wrap.className = 'pdf-export';
  const header = `<div style="text-align:center;padding:18px 8px"><h1 style="margin:0;font-size:20px">RTO PRACTICE PORTAL</h1><div style="margin-top:6px;color:#666">Question & Answers — ${new Date().toLocaleDateString()}</div></div>`;
  const intro = `<div style="padding:8px 12px;color:#444">This document contains questions with their options and the correct answer. Use for revision only.</div>`;
  // build attractive QA list (no user answers)
  const body = lastResults.results.map((r, i) => {
    const q = r.q;
    const optionsHtml = q.options.map((opt, idx) => `<div style="padding:6px 8px;border-radius:6px;margin:6px 0;background:${idx===q.answer? '#e6f7ef':'#f7f7fb'};border:1px solid ${idx===q.answer? '#c7efd8':'#ececf5'}"><strong style="margin-right:8px">${String.fromCharCode(65+idx)}.</strong>${esc(opt)}</div>`).join('');
    return `<div style="margin:12px 0;padding:12px;border-radius:10px;border:1px solid #eef2fb;background:linear-gradient(180deg,#ffffff,#fbfdff)">
      <div style="font-weight:700;margin-bottom:8px">Q${i+1}. ${esc(q.q)}</div>
      ${q.img ? `<div style="text-align:center;margin-bottom:8px"><img src="${q.img}" style="max-width:360px;border-radius:8px" crossorigin="anonymous"/></div>` : ''}
      <div>${optionsHtml}</div>
      <div style="margin-top:8px;text-align:right;color:#0b6b3a;font-weight:700">Answer: ${esc(q.options[q.answer] || '—')}</div>
    </div>`;
  }).join('');
  wrap.innerHTML = header + intro + '<div style="padding:12px">' + body + '</div>';
  wrap.style.padding = '6px';
  wrap.style.fontFamily = 'Poppins, Inter, sans-serif';
  // footer
  const footer = document.createElement('div'); footer.style.textAlign='center'; footer.style.margin='18px 0 8px'; footer.innerHTML = '<small style="color:#666">RTO PRACTICE PORTAL — Made by Justin • instagram.com/justinkjames.xyz</small>';
  wrap.appendChild(footer);
  // use html2pdf
  try {
    const opt = { margin:0.6, filename: `rto_results_${Date.now()}.pdf`, image:{type:'jpeg',quality:0.92}, html2canvas:{useCORS:true, scale:1.4}, jsPDF:{unit:'in',format:'a4',orientation:'portrait'} };
    html2pdf().set(opt).from(wrap).save();
  } catch (e) { console.error('downloadResultsPDF failed', e); setAuthMessage('Could not generate PDF — see console.', 'error'); }
}

function renderQuestion() {
  const q = quiz.qs[quiz.i];
  quiz.questionStartedAt = performance.now();
  quiz.questionCompleted = false;
  $('#q-count').textContent = `QUESTION ${quiz.i + 1} OF ${quiz.qs.length}`;
  $('#quiz-progress-fill').style.width = (100 * quiz.i / quiz.qs.length) + '%';
  $('#q-text').textContent = q.q;
  const wrap = $('#q-image-wrap');
  if (q.img) { $('#q-image').src = q.img; wrap.classList.remove('hidden'); } else wrap.classList.add('hidden');

  const box = $('#q-options');
  box.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const b = document.createElement('button');
    b.className = 'q-option';
    b.innerHTML = `<span>${esc(opt)}</span><span class="opt-mark"></span>`;
    b.addEventListener('click', () => pick(idx, b));
    box.appendChild(b);
  });
  $('#q-feedback').className = 'q-feedback hidden';
  const next = $('#btn-next');
  next.disabled = true;
  next.textContent = quiz.i === quiz.qs.length - 1 ? (quiz.mode === 'mock' ? 'Submit Test ✓' : 'Finish ✓') : 'Next Question →';
  $('#btn-skip').classList.toggle('hidden', quiz.mode !== 'mock');
  // Mock questions are individually timed; practice has no timer.
  if (quiz.mode === 'mock') startQuestionTimer();
  else $('#quiz-timer').classList.add('hidden');
}

function resumeTopicSession(cat, sessionIndex) {
  const key = `${cat}:${sessionIndex}`;
  const ip = state.sessions && state.sessions.inprogress;
  if (!ip || ip.key !== key) { startTopicSession(cat, sessionIndex, false); return; }
  // rebuild quiz from stored qsIds
  const qs = ip.qsIds.map(id => byId.get(id)).filter(Boolean);
  quiz = { mode: 'practice', qs, i: ip.i || 0, answers: ip.answers || [], cat, sessionIndex, questionStartedAt: 0, questionTimes: ip.questionTimes || [], questionCompleted: false };
  $('#quiz-title').textContent = `${CATS[cat].name} — Session ${sessionIndex + 1}`;
  show('quiz'); renderQuestion();
}

function renderSessionDetail(cat, sessionIndex) {
  const key = `${cat}:${sessionIndex}`;
  const sess = state.sessions[key];
  if (!sess) { showTimingToast('No session data available'); return; }
  $('#session-title').textContent = `${CATS[cat].name} — Session ${sessionIndex + 1}`;
  $('#session-sub').textContent = `Completed ${sess.score} / ${sess.total} on ${new Date(sess.date).toLocaleString()}`;
  const list = $('#session-detail-list');
  list.innerHTML = '';
  if (sess.answers && sess.answers.length) {
    sess.answers.forEach(a => {
      const q = byId.get(a.id);
      if (!q) return;
      const div = document.createElement('div');
      div.className = 'session-detail-item ' + (a.ok ? 'ok' : 'bad');
      div.innerHTML = `<div class="session-qa">${esc(q.q)}</div>
        ${q.img ? `<img src="${q.img}" alt="sign"/>` : ''}
        <div class="session-meta">Your answer: ${a.picked !== undefined ? esc(q.options[a.picked]) : '—'} · Correct: ${esc(q.options[q.answer])} · Time: ${fmtSecs(a.time || 0)}</div>`;
      list.appendChild(div);
    });
  } else {
    // fallback: list wrongIds
    const wrong = sess.wrongIds || [];
    if (!wrong.length) list.innerHTML = '<div class="empty-note">No detailed answers saved.</div>';
    else list.innerHTML = wrong.map(id => { const q = byId.get(id); return q ? `<div class="session-detail-item bad"><div class="session-qa">${esc(q.q)}</div><div class="session-meta">Correct: ${esc(q.options[q.answer])}</div></div>` : ''; }).join('');
  }
  $('#btn-session-retry-wrong').onclick = () => startTopicSession(cat, sessionIndex, true);
  $('#btn-session-practice-again').onclick = () => startTopicSession(cat, sessionIndex, false);
  $('#btn-session-back').onclick = () => showTopicSessions(cat);
  show('session-detail');
}
 

function pick(idx, btn) {
  const q = quiz.qs[quiz.i];
  if (quiz.answers[quiz.i] !== undefined && quiz.mode === 'practice') return;
  const elapsed = performance.now() - quiz.questionStartedAt;
  quiz.questionTimes[quiz.i] = elapsed;
  quiz.questionCompleted = true;
  quiz.answers[quiz.i] = idx;
  const opts = $$('#q-options .q-option');
  if (quiz.mode === 'practice') {
    opts.forEach(o => o.disabled = true);
    const ok = idx === q.answer;
    opts[q.answer].classList.add('correct');
    opts[q.answer].querySelector('.opt-mark').textContent = '✓';
    if (!ok) { btn.classList.add('wrong'); btn.querySelector('.opt-mark').textContent = '✗'; }
    const fb = $('#q-feedback');
    fb.textContent = ok ? 'Correct! ' + q.options[q.answer] : 'The correct answer is: ' + q.options[q.answer];
    fb.className = 'q-feedback ' + (ok ? 'good' : 'bad');
    state.answered[q.id] = ok;
    persist();
    showTimingToast(`Completed in ${fmtSecs(elapsed)}`);
  } else {
    opts.forEach(o => { o.classList.remove('chosen'); o.querySelector('.opt-mark').textContent = ''; });
    btn.classList.add('chosen');
    btn.querySelector('.opt-mark').textContent = '●';
    playSound('select');
  }
  // save in-progress snapshot for resuming
  try {
    if (state.sessions && state.sessions.inprogress && state.sessions.inprogress.key) {
      state.sessions.inprogress.answers = quiz.qs.map((qq, idx) => ({ id: qq.id, picked: quiz.answers[idx], ok: quiz.answers[idx] === qq.answer, time: quiz.questionTimes[idx] || 0 }));
      state.sessions.inprogress.i = quiz.i;
      state.sessions.inprogress.questionTimes = quiz.questionTimes;
      persist();
    }
  } catch (e) { /* ignore */ }
  $('#btn-next').disabled = false;
}

function nextQuestion() {
  clearQuestionTimer();
  if (!quiz.questionCompleted && quiz.answers[quiz.i] === undefined) {
    quiz.questionTimes[quiz.i] = performance.now() - quiz.questionStartedAt;
    quiz.questionCompleted = true;
  }
  if (quiz.i < quiz.qs.length - 1) { quiz.i++; renderQuestion(); }
  else finishQuiz(false);
}

// Animate a 0→100 loader, then reveal the result. Resolves when the bar hits 100.
function runFinishLoader() {
  return new Promise(resolve => {
    const overlay = $('#finish-loader');
    const bar = $('#finish-loader-bar');
    const pctEl = $('#finish-loader-pct');
    if (!overlay || !bar) { resolve(); return; }
    bar.style.width = '0%';
    if (pctEl) pctEl.textContent = '0%';
    overlay.classList.remove('hidden');
    let pct = 0;
    const timer = setInterval(() => {
      pct = Math.min(100, pct + (pct < 70 ? 11 : 6));
      bar.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(() => { overlay.classList.add('hidden'); resolve(); }, 180);
      }
    }, 90);
  });
}

async function finishQuiz(timedOut) {
  if (quiz.timer) clearInterval(quiz.timer);
  clearQuestionTimer();
  // Show the loading overlay immediately so a slow tap never looks frozen.
  const loaderDone = runFinishLoader();

  const results = quiz.qs.map((q, i) => ({ q, picked: quiz.answers[i], ok: quiz.answers[i] === q.answer }));
  const score = results.filter(r => r.ok).length;
  const totalTime = quiz.questionTimes.reduce((sum, t) => sum + (t || 0), 0);
  const averageTime = quiz.questionTimes.length ? totalTime / quiz.questionTimes.length : 0;
  const fastest = quiz.questionTimes.length ? Math.min(...quiz.questionTimes.filter(Boolean)) : 0;
  const slowest = quiz.questionTimes.length ? Math.max(...quiz.questionTimes.filter(Boolean)) : 0;

  // If this was a topic session, store the session result for later review.
  try {
    if (quiz.mode === 'practice' && quiz.cat) {
      const key = quiz.sessionIndex === null ? `${quiz.cat}:topic` : `${quiz.cat}:${quiz.sessionIndex}`;
      const runAnswers = results.map((r, i) => ({ id: r.q.id, picked: r.picked, ok: r.ok, time: quiz.questionTimes[i] || 0 }));
      const existing = state.sessions[key];

      // BUG FIX: a "retry wrong" run only covers the questions you got wrong.
      // Merge those results back INTO the full session record instead of
      // replacing it — otherwise a 14/15 session became 0/1 (the "7%" bug).
      let mergedAnswers;
      if (quiz.retryWrong && existing && Array.isArray(existing.answers) && existing.answers.length) {
        const map = new Map(existing.answers.map(a => [a.id, a]));
        runAnswers.forEach(a => map.set(a.id, a));
        mergedAnswers = [...map.values()];
      } else {
        mergedAnswers = runAnswers;
      }
      const sessScore = mergedAnswers.filter(a => a.ok).length;

      state.sessions[key] = {
        score: sessScore,
        total: mergedAnswers.length,
        attemptedCount: mergedAnswers.length,
        date: Date.now(),
        answers: mergedAnswers,
        wrongIds: mergedAnswers.filter(a => !a.ok).map(a => a.id),
        correctIds: mergedAnswers.filter(a => a.ok).map(a => a.id)
      };
      if (state.sessions.inprogress && state.sessions.inprogress.key === key) delete state.sessions.inprogress;
      persist();
      // Save to Firestore in the BACKGROUND — never block the result screen on it.
      const user = auth.currentUser;
      if (user) {
        addDoc(collection(db, 'users', user.uid, 'sessions'), {
          key, score: sessScore, total: mergedAnswers.length, date: Date.now(), answers: mergedAnswers
        }).then(ref => console.log('Saved session to Firestore:', ref.id))
          .catch(e => console.warn('Could not save session to Firestore', e));
      }
    }
  } catch (e) {
    console.warn('Could not save session result', e);
  }

  if (quiz.mode === 'mock') {
    results.forEach(r => { if (r.picked !== undefined) { state.answered[r.q.id] = r.ok; } });
    const pass = score >= MOCK_PASS;
    state.mocks.push({ score, total: quiz.qs.length, pass, date: Date.now() });
    persist();
    playSound(pass ? 'pass' : 'fail');
    $('#result-emoji').textContent = pass ? '🎉' : '📚';
    $('#result-heading').textContent = timedOut ? (pass ? "Time's up — you passed!" : "Time's up!") : (pass ? 'You passed!' : 'Not this time');
    $('#result-score').textContent = `${score} / ${quiz.qs.length}`;
    $('#result-sub').textContent = pass
      ? `You cleared the pass mark of ${MOCK_PASS}. You're ready for the real thing!`
      : `You need ${MOCK_PASS} correct to pass. Review your mistakes and try again — you'll get there.`;
  } else {
    $('#result-emoji').textContent = score === quiz.qs.length ? '🏆' : score >= quiz.qs.length * 0.6 ? '👏' : '💪';
    $('#result-heading').textContent = 'Practice complete';
    $('#result-score').textContent = `${score} / ${quiz.qs.length}`;
    $('#result-sub').textContent = 'Instant feedback saved — wrong answers were added to Review Mistakes.';
  }
  $('#result-summary').innerHTML = `
    <div class="summary-grid">
      <div class="summary-card"><strong>${quiz.qs.length} questions</strong><span>Completed in ${fmtSecs(totalTime)}</span></div>
      <div class="summary-card"><strong>${score} correct</strong><span>Accuracy ${Math.round(100 * score / quiz.qs.length)}%</span></div>
      <div class="summary-card"><strong>${fmtSecs(averageTime)}</strong><span>Average time per question</span></div>
      <div class="summary-card"><strong>${fmtSecs(fastest)}</strong><span>Fastest response</span></div>
    </div>`;
  $('#result-bar-fill').style.width = '0';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $('#result-bar-fill').style.width = (100 * score / quiz.qs.length) + '%';
  }));
  document.querySelector('.result-bar .pass-mark').style.display = quiz.mode === 'mock' ? '' : 'none';

  // save last results for PDF export
  lastResults = { results, score, total: quiz.qs.length, totalTime, averageTime, fastest, slowest };

  const rev = $('#result-review');
  rev.classList.add('hidden');
  rev.innerHTML = results.map(r => reviewItem(r.q, r.ok ? 'ok' : 'bad',
    r.picked !== undefined && !r.ok ? `<div class="ri-x">✗ Your answer: ${esc(r.q.options[r.picked])}</div>`
      : r.picked === undefined ? `<div class="ri-x">— Not answered</div>` : '')).join('');
  $('#btn-result-review').style.display = '';
  // Wait for the loader to finish its 0→100 sweep, then reveal the result.
  await loaderDone;
  show('result');
  window.scrollTo(0, 0);
  quiz = null;
}

/* ---------- auth ---------- */
async function applySignedInUser(user) {
  if (!user) return;
  const displayName = user.displayName || user.email?.split('@')[0] || 'Learner';
  state.name = state.name || displayName;
  store.set('name', state.name);
  if ($('#student-name')) $('#student-name').value = state.name;
  if (!user.emailVerified) {
    showVerificationScreen(user.email);
    return;
  }
  // Pull saved progress from the cloud once per session BEFORE showing the
  // dashboard, so a returning user sees their real numbers, not zeros.
  if (!userStateLoaded) {
    try { await loadUserState(user); } catch (e) { console.warn(e); }
  }
  if (!$('#view-welcome').classList.contains('hidden')) enterApp();
  if (!$('#view-home').classList.contains('hidden')) renderDashboard();
}

async function signInWithGoogle() {
  // do not redirect here; ensureLocalPreviewHost handled at load

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    applySignedInUser(user);
  } catch (err) {
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, googleProvider);
    } catch (redirectErr) {
      const message = redirectErr?.code === 'auth/operation-not-allowed'
        ? 'Google sign-in is not enabled in Firebase Authentication.'
        : 'Google sign-in was cancelled or failed.';
      showTimingToast(message);
    }
  }
}

async function signUpWithEmail(e) {
  e.preventDefault();
  const name = $('#student-name').value.trim();
  const email = $('#signup-email').value.trim();
  const password = $('#signup-password').value;
  const confirm = $('#signup-confirm').value;
  if (!name || !email || !password || !confirm) {
    setAuthMessage('Please fill in all fields.', 'error');
    return;
  }
  if (password !== confirm) {
    setAuthMessage('Passwords do not match.', 'error');
    return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    try {
      await sendEmailVerification(cred.user, actionCodeSettings);
      console.log('sendEmailVerification: email sent to', email);
      setAuthMessage(`Verification email sent to ${email}. ⚠️ It usually lands in your SPAM/JUNK folder — please check there too!`, 'success');
      $('#verification-actions').classList.remove('hidden');
      // reset local progress for a fresh account
      state.answered = {};
      state.saved = [];
      state.mocks = [];
      state.sessions = {};
      state.studied = [];
      persist();
      // show verification view and start polling for email verification
      showVerificationScreen(email);
    } catch (sevErr) {
      console.error('sendEmailVerification failed', sevErr);
      setAuthMessage('Verification email could not be sent. Check console for details.', 'error');
    }
    $('#signup-form').reset();
    updatePasswordStrength('');
    state.name = name;
    store.set('name', name);
  } catch (err) {
    const message = err?.code === 'auth/email-already-in-use'
      ? 'This email is already registered. Please log in instead.'
      : err?.code === 'auth/weak-password'
        ? 'Password must be at least 8 characters.'
        : err?.code === 'auth/invalid-email'
          ? 'Please enter a valid email address.'
          : 'Could not create your account right now.';
    setAuthMessage(message, 'error');
  }
}

async function loginWithEmail(e) {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  if (!email || !password) {
    setAuthMessage('Please enter your email and password.', 'error');
    return;
  }
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (!result.user.emailVerified) {
      showVerificationScreen(result.user.email);
      return;
    }
    applySignedInUser(result.user);
  } catch (err) {
    console.warn('login failed', err?.code);
    let message;
    switch (err?.code) {
      case 'auth/user-not-found':
        message = 'No account exists with this email. Please create an account first — tap "Sign Up" above.';
        break;
      case 'auth/wrong-password':
        message = 'This email is registered, but the password is wrong. Try again or tap "Forgot Password?".';
        break;
      case 'auth/invalid-credential':
        message = 'Email or password is incorrect. If you don\'t have an account yet, tap "Sign Up" to create one first.';
        break;
      case 'auth/invalid-email':
        message = 'Please enter a valid email address.';
        break;
      case 'auth/user-disabled':
        message = 'This account has been disabled. Please contact support.';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please wait a few minutes and try again, or reset your password.';
        break;
      case 'auth/network-request-failed':
        message = 'Network problem — check your internet connection and try again.';
        break;
      default:
        message = 'Could not log in right now. Please try again.';
    }
    setAuthMessage(message, 'error');
  }
}

async function resetPasswordFlow() {
  const email = $('#reset-email').value.trim();
  if (!email) {
    setAuthMessage('Enter your email to receive a reset link.', 'error');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    setAuthMessage('Password reset email sent. ⚠️ Check your SPAM/JUNK folder too — it often lands there!', 'success');
    $('#reset-panel').classList.add('hidden');
  } catch (err) {
    const message = err?.code === 'auth/invalid-email'
      ? 'Please enter a valid email address.'
      : 'Could not send the reset email.';
    setAuthMessage(message, 'error');
  }
}

async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) {
    setAuthMessage('No signed-in user to resend verification for.', 'error');
    return;
  }
  try {
    await sendEmailVerification(user, actionCodeSettings);
    console.log('resendVerificationEmail: sent to', user.email);
    setAuthMessage('Verification email sent again. ⚠️ Don\'t forget to check your SPAM/JUNK folder!', 'success');
  } catch (err) {
    console.error('resendVerificationEmail failed', err);
    setAuthMessage('Could not resend the verification email. See console.', 'error');
  }
}

function showVerificationScreen(email) {
  if (!email && auth.currentUser) email = auth.currentUser.email;
  $('#verify-email').textContent = email || '—';
  show('verification');
  // start polling verification status every 8s for up to 10 minutes
  if (verificationTimer) clearInterval(verificationTimer);
  let checks = 0; const maxChecks = Math.ceil(600000 / 8000);
  verificationTimer = setInterval(async () => {
    checks++;
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser && auth.currentUser.emailVerified) {
        clearInterval(verificationTimer); verificationTimer = null;
        setAuthMessage('Email verified — welcome!', 'success');
        applySignedInUser(auth.currentUser);
      }
      if (checks >= maxChecks) { clearInterval(verificationTimer); verificationTimer = null; }
    } catch (e) { console.error('verification poll failed', e); }
  }, 8000);
}

function renderProfile() {
  const user = auth.currentUser;
  if (!user) { $('#profile-name').textContent = '—'; $('#profile-email').textContent = '—'; return; }
  $('#profile-name').textContent = user.displayName || '—';
  $('#profile-email').textContent = user.email || '—';
  $('#profile-provider').textContent = (user.providerData && user.providerData[0] && user.providerData[0].providerId) || 'password';
  $('#profile-created').textContent = user.metadata?.creationTime || '—';
  $('#profile-last').textContent = user.metadata?.lastSignInTime || '—';
}

async function deleteAccountFlow() {
  if (!auth.currentUser) { setAuthMessage('No user is signed in.', 'error'); return; }
  const confirm1 = confirm('Deleting your account will permanently remove your account and local app data. This cannot be undone. Do you want to continue?');
  if (!confirm1) return;
  const confirm2 = confirm('Please confirm again to permanently delete your account and all associated data. This is irreversible. Proceed?');
  if (!confirm2) return;
  try {
    // clear local data
    ['answered','saved','mocks','sessions','name','guest','theme'].forEach(k => store.set(k, null));
    // attempt to delete firebase user
    await deleteUser(auth.currentUser);
    console.log('Account deleted for', auth.currentUser && auth.currentUser.email);
    setAuthMessage('Account deleted.', 'success');
    try { await signOut(auth); } catch {};
    show('welcome');
  } catch (e) {
    console.error('deleteAccountFlow failed', e);
    if (e?.code === 'auth/requires-recent-login') setAuthMessage('Please sign in again before deleting your account (recent login required).', 'error');
    else setAuthMessage('Could not delete account — see console for details.', 'error');
  }
}

function toggleTheme() {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  store.set('theme', next);
  document.documentElement.classList.toggle('dark', next === 'dark');
}

/* ---------- events ---------- */
function enterApp() { $('#view-welcome').classList.add('hidden'); show('home'); }

document.addEventListener('DOMContentLoaded', async () => {
  if (ensureLocalPreviewHost()) return;

  const res = await fetch('questions.json');
  BANK = await res.json();
  byId = new Map(BANK.map(q => [q.id, q]));

  $$('[data-nav]').forEach(b => b.addEventListener('click', () => show(b.dataset.nav)));
  $('#signup-form').addEventListener('submit', signUpWithEmail);
  $('#login-form').addEventListener('submit', loginWithEmail);
  // wire resend buttons (inline and main)
  if ($('#btn-resend-verification')) $('#btn-resend-verification').addEventListener('click', resendVerificationEmail);
  if ($('#btn-resend-verification-inline')) $('#btn-resend-verification-inline').addEventListener('click', resendVerificationEmail);
  if ($('#btn-check-verification')) $('#btn-check-verification').addEventListener('click', async () => {
    try {
      if (!auth.currentUser) { setAuthMessage('No signed-in user. Please sign in and try again.', 'error'); return; }
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setAuthMessage('Email verified — welcome!', 'success');
        applySignedInUser(auth.currentUser);
      } else {
        setAuthMessage('Email still not verified. We will keep checking automatically.', 'error');
      }
    } catch (e) { console.error('check verification failed', e); setAuthMessage('Could not check verification — see console.', 'error'); }
  });
  if ($('#btn-verify-logout')) $('#btn-verify-logout').addEventListener('click', async () => { await signOut(auth); show('welcome'); });
  if ($('#btn-theme-toggle')) $('#btn-theme-toggle').addEventListener('click', toggleTheme);
  if ($('#btn-theme-float')) $('#btn-theme-float').addEventListener('click', toggleTheme);
  $('#btn-google-signin').addEventListener('click', signInWithGoogle);
  $('#btn-guest').addEventListener('click', enterApp);
  $('#btn-guest').addEventListener('click', () => { store.set('guest', true); enterApp(); });
  $('#btn-reset-password').addEventListener('click', resetPasswordFlow);
  $('#btn-cancel-reset').addEventListener('click', () => $('#reset-panel').classList.add('hidden'));
  $('#forgot-password-link').addEventListener('click', () => $('#reset-panel').classList.remove('hidden'));
  $$('.auth-tab').forEach(tab => tab.addEventListener('click', () => setActiveAuthTab(tab.dataset.authTab)));
  $$('.toggle-password').forEach(btn => btn.addEventListener('click', () => togglePasswordVisibility(btn.dataset.target)));
  $('#signup-password').addEventListener('input', e => updatePasswordStrength(e.target.value));
  $('#side-start-practice').addEventListener('click', () => startPractice('*'));
  $('#qa-random').addEventListener('click', () => startPractice('*'));
  $('#btn-practice-wrong').addEventListener('click', () => startPractice('wrong'));
  $('#btn-mock-start').addEventListener('click', startMock);
  $('#btn-next').addEventListener('click', nextQuestion);
  $('#btn-skip').addEventListener('click', () => { if (quiz) { quiz.answers[quiz.i] = quiz.answers[quiz.i]; nextQuestion(); } });
  $('#quiz-close').addEventListener('click', () => {
    if (quiz && quiz.mode === 'mock' && !confirm('Exit the mock test? This attempt will be discarded.')) return;
    if (quiz && quiz.timer) clearInterval(quiz.timer);
    clearQuestionTimer();
    quiz = null;
    show('home');
  });
  $$('.mute-btn').forEach(b => b.addEventListener('click', toggleMute));
  updateMuteButtons();
  $('#btn-save-q').addEventListener('click', () => {
    if (!quiz) return;
    const id = quiz.qs[quiz.i].id;
    const i = state.saved.indexOf(id);
    if (i >= 0) state.saved.splice(i, 1); else state.saved.push(id);
    persist();
    $('#btn-save-q').classList.toggle('saved', state.saved.includes(id));
  });
  $('#btn-result-review').addEventListener('click', () => {
    $('#result-review').classList.toggle('hidden');
  });
  $('#btn-result-home').addEventListener('click', () => show('home'));
  if ($('#btn-download-qa')) $('#btn-download-qa').addEventListener('click', downloadResultsPDF);

  // mobile hamburger: toggle sidebar visibility
  if ($('#btn-hamburger')) $('#btn-hamburger').addEventListener('click', () => {
    const sb = document.querySelector('.sidebar');
    const backdrop = $('#sidebar-backdrop');
    if (!sb || !backdrop) return;
    sb.classList.toggle('open');
    backdrop.classList.toggle('hidden', !sb.classList.contains('open'));
  });

  if ($('#sidebar-backdrop')) {
    $('#sidebar-backdrop').addEventListener('click', () => {
      const sb = document.querySelector('.sidebar');
      $('#sidebar-backdrop').classList.add('hidden');
      if (sb) sb.classList.remove('open');
    });
  }

  if ($('#btn-sidebar-close')) {
    $('#btn-sidebar-close').addEventListener('click', () => {
      const sb = document.querySelector('.sidebar');
      const backdrop = $('#sidebar-backdrop');
      if (sb) sb.classList.remove('open');
      if (backdrop) backdrop.classList.add('hidden');
    });
  }

  $$('.side-nav .nav-item').forEach(b => b.addEventListener('click', () => {
    const sb = document.querySelector('.sidebar');
    const backdrop = $('#sidebar-backdrop');
    if (sb) sb.classList.remove('open');
    if (backdrop) backdrop.classList.add('hidden');
  }));

  onAuthStateChanged(auth, (user) => {
    if (user) applySignedInUser(user);
  });

  try {
    const result = await getRedirectResult(auth);
    if (result?.user) applySignedInUser(result.user);
  } catch (err) {
    console.warn('Redirect sign-in result could not be processed.', err);
  }

  // If user returned from an email action link, apply the action (verify email)
  try {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode === 'verifyEmail' && oobCode) {
      try {
        await applyActionCode(auth, oobCode);
        console.log('applyActionCode: email verified via action link');
        setAuthMessage('Your email has been verified. Please sign in.', 'success');
        // remove query params from URL
        history.replaceState({}, '', window.location.pathname);
      } catch (acErr) {
        console.error('applyActionCode failed', acErr);
        setAuthMessage('Verification link invalid or expired.', 'error');
      }
    }
  } catch (e) { console.error('email action handling failed', e); }

  if (state.name || Object.keys(state.answered).length) enterApp();
  else show('welcome');
  // Light mode is the default; only go dark if the user explicitly chose it.
  document.documentElement.classList.toggle('dark', store.get('theme', 'light') === 'dark');
  // wire profile / logout
  if ($('#nav-profile')) $('#nav-profile').addEventListener('click', () => { renderProfile(); show('profile'); });
  if ($('#btn-logout')) $('#btn-logout').addEventListener('click', async () => { try { await signOut(auth); } catch {} store.set('guest', false); show('welcome'); });
  if ($('#btn-profile-delete')) $('#btn-profile-delete').addEventListener('click', deleteAccountFlow);
  if ($('#btn-profile-back')) $('#btn-profile-back').addEventListener('click', () => { renderDashboard(); show('home'); });
});
})();
