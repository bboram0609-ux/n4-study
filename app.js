'use strict';

// ---------- 유틸 ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const view = $('#view');
const modal = $('#modal');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sample = (arr, n) => shuffle(arr).slice(0, n);

// 브라우저 저장소 (비공개 모드 등에서 실패해도 앱은 동작)
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('n4:' + key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem('n4:' + key, JSON.stringify(value)); } catch { /* 무시 */ }
  },
};

// 화면이 바뀌면 이전 화면의 키보드 단축키를 정리한다
let keyHandler = null;
function bindKeys(fn) { keyHandler = fn; }
document.addEventListener('keydown', (e) => {
  if (keyHandler && !modal.open && !/INPUT|TEXTAREA/.test(e.target.tagName)) keyHandler(e);
});

// ---------- 음성 (TTS) ----------
const TTS_OK = 'speechSynthesis' in window;
const tts = { voices: [], slow: store.get('slow', false) };
const MALE_VOICE = /otoya|ichiro|keita|daichi|naoki|hattori|male|男/i;

function loadVoices() {
  tts.voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
}
if (TTS_OK) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice(who) {
  if (!tts.voices.length) return null;
  const male = tts.voices.find((v) => MALE_VOICE.test(v.name));
  const female = tts.voices.find((v) => !MALE_VOICE.test(v.name));
  return (who === 'M' ? male : female) || tts.voices[0];
}

// lines: [화자, 문장] 배열. 화자 M/F는 목소리 높이를 달리해 구분한다.
function speakLines(lines, rate) {
  if (!TTS_OK) return Promise.resolve();
  speechSynthesis.cancel();
  const r = rate || (tts.slow ? 0.7 : 0.95);
  return new Promise((resolve) => {
    lines.forEach(([who, text], i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      const v = pickVoice(who);
      if (v) u.voice = v;
      u.pitch = who === 'M' ? 0.75 : who === 'F' ? 1.25 : 1;
      u.rate = r;
      if (i === lines.length - 1) { u.onend = resolve; u.onerror = resolve; }
      speechSynthesis.speak(u);
    });
  });
}

const speak = (text) => speakLines([['N', text]], 0.9);

const ICON_SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const speakBtn = (text, id = '') => `<button class="speak" ${id ? `id="${id}"` : ''} data-say="${esc(text)}" aria-label="발음 듣기">${ICON_SPEAK}</button>`;

// ---------- 마스코트 ----------
const svg = (inner) => `<svg class="mascot" viewBox="0 0 200 170" aria-hidden="true">${inner}</svg>`;

function starPoints(cx, cy, R, r, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const MASCOTS = {
  // 졸린 달
  moon: (c = '#ecfbc6') => svg(`
    <text x="26" y="58" font-family="Jua" font-size="36" fill="#161616">Z</text>
    <text x="52" y="82" font-family="Jua" font-size="24" fill="#161616">z</text>
    <circle cx="112" cy="112" r="72" fill="${c}"/>
    <path class="ln" d="M82 104q10 10 20 0M122 104q10 10 20 0"/>
    <circle class="fill-ink" cx="112" cy="126" r="4"/>`),
  // 걷는 반달
  half: (c = '#e04bc9') => svg(`
    <path d="M42 156A62 62 0 0 1 166 156Z" fill="${c}"/>
    <circle class="fill-ink" cx="96" cy="122" r="4.5"/><circle class="fill-ink" cx="120" cy="122" r="4.5"/>
    <path class="ln" d="M101 134q7 6 14 0M160 128l22 12M78 156l-8 12M132 156l8 12"/>
    <circle class="fill-ink" cx="185" cy="141" r="7"/>`),
  // 명상하는 육각형
  hex: (c = '#cbe87a') => svg(`
    <polygon points="162,94 131,40 69,40 38,94 69,148 131,148" fill="${c}"/>
    <path class="ln" d="M76 90q8 8 16 0M108 90q8 8 16 0M94 106q6 6 12 0M40 100 18 74M160 100l22-26M70 148q30 16 60 0"/>
    <circle class="fill-ink" cx="16" cy="70" r="7"/><circle class="fill-ink" cx="184" cy="70" r="7"/>`),
  // 헤드폰 낀 네모 (청해)
  box: (c = '#cbe87a') => svg(`
    <rect x="52" y="50" width="106" height="88" rx="10" fill="${c}"/>
    <path class="ln" d="M42 94C42 14 168 14 168 94M80 138v22M130 138v22M96 104q9 10 18 0M52 112l-24 10"/>
    <circle class="ln" cx="44" cy="100" r="14"/><circle class="ln" cx="166" cy="100" r="14"/>
    <circle class="fill-ink" cx="88" cy="90" r="5"/><circle class="fill-ink" cx="122" cy="90" r="5"/>
    <circle class="fill-ink" cx="26" cy="123" r="7"/>
    <ellipse class="fill-ink" cx="76" cy="162" rx="10" ry="5"/><ellipse class="fill-ink" cx="134" cy="162" rx="10" ry="5"/>`),
  // 신난 별 (퀴즈)
  star: (c = '#cbe87a') => svg(`
    <polygon points="${starPoints(100, 92, 76, 54, 12)}" fill="${c}"/>
    <circle class="fill-ink" cx="86" cy="86" r="5"/><circle class="fill-ink" cx="114" cy="86" r="5"/>
    <path d="M86 102q14 18 28 0Z" fill="#161616"/>`),
  // 식은땀 흘리는 동그라미 (오답노트)
  drop: (c = '#f39ce4') => svg(`
    <circle cx="100" cy="100" r="64" fill="${c}"/>
    <path class="ln" d="M76 76l14 5M124 76l-14 5M84 116q8-7 16 0q8 7 16 0"/>
    <circle class="fill-ink" cx="84" cy="94" r="5"/><circle class="fill-ink" cx="116" cy="94" r="5"/>
    <path d="M158 40q12 18 0 27q-12-9 0-27Z" fill="#97a9f7" stroke="#161616" stroke-width="3"/>`),
};

// ---------- 데이터 ----------
const VOCAB = Object.entries(window.VOCAB_RAW).flatMap(([cat, rows]) =>
  rows.map(([w, r, m]) => ({ id: 'v:' + w + ':' + r, w, r, m, cat })));
const KANJI = window.KANJI.map((k) => ({ ...k, id: 'k:' + k.k }));
const GRAMMAR = window.GRAMMAR;
const DIALOGS = window.DIALOGS;
const SENTENCES = GRAMMAR.flatMap((g) => g.ex.map(([jp, ko]) => ({ jp, ko, t: g.t })));

// ---------- 간격 반복 (Leitner 방식) ----------
const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [0, 1, 3, 7, 14, 30, 60]; // 상자 번호별 복습 간격(일)
let srs = store.get('srs', {});

function grade(id, g) {
  // g: 0 = 다시, 1 = 애매, 2 = 알아요
  const s = srs[id] || { box: 0, due: 0 };
  if (g === 0) {
    s.box = 0;
    s.due = Date.now() + 60 * 1000;
  } else if (g === 1) {
    s.box = Math.max(1, s.box);
    s.due = Date.now() + DAY;
  } else {
    s.box = Math.min(s.box + 1, INTERVALS.length - 1);
    s.due = Date.now() + INTERVALS[s.box] * DAY;
  }
  srs[id] = s;
  store.set('srs', srs);
  markStudied();
}

function status(id) {
  const s = srs[id];
  if (!s) return 'new';
  return s.box >= 3 ? 'known' : 'learning';
}

const STATUS_LABEL = { new: '새 카드', learning: '학습 중', known: '암기 완료' };

const isDue = (id) => srs[id] && srs[id].due <= Date.now();

function buildDeck(items, newLimit = 10) {
  const due = items.filter((it) => isDue(it.id));
  const fresh = items.filter((it) => !srs[it.id]).slice(0, newLimit);
  return shuffle(due).concat(shuffle(fresh));
}

// ---------- 오답노트 ----------
const GRADUATE = 2; // 연속으로 이만큼 맞히면 오답노트에서 졸업
let wrongs = store.get('wrongs', {});

function addWrong(q, picked) {
  const w = wrongs[q.key] || { count: 0 };
  Object.assign(w, { q, picked, count: w.count + 1, right: 0, last: Date.now() });
  wrongs[q.key] = w;
  store.set('wrongs', wrongs);
}

// 오답노트에 있는 문제를 맞혔을 때. 졸업하면 true
function noteRight(key) {
  const w = wrongs[key];
  if (!w) return false;
  w.right = (w.right || 0) + 1;
  const graduated = w.right >= GRADUATE;
  if (graduated) delete wrongs[key];
  store.set('wrongs', wrongs);
  return graduated;
}

// ---------- 학습 기록 (연속 학습일) ----------
const dateKey = (d) => d.toLocaleDateString('sv-SE'); // YYYY-MM-DD
const today = () => dateKey(new Date());

function markStudied() {
  const days = store.get('days', []);
  if (!days.includes(today())) {
    days.push(today());
    store.set('days', days.slice(-400));
  }
}

function streak() {
  const days = new Set(store.get('days', []));
  const d = new Date();
  if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dateKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ---------- 라우터 ----------
const routes = {
  home: renderHome, vocab: renderVocab, kanji: renderKanji, grammar: renderGrammar,
  listen: renderListen, quiz: renderQuiz, notes: renderNotes,
};

function route() {
  const name = routes[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === name));
  if (TTS_OK) speechSynthesis.cancel();
  bindKeys(null);
  view.innerHTML = '';
  routes[name]();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// 화면 어디서든 data-say 버튼을 누르면 발음 재생
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-say]');
  if (b) { e.stopPropagation(); speak(b.dataset.say); }
}, true);

const pageHead = (title, sub) => `<header class="page-head"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</header>`;

// ---------- 온보딩 ----------
function showOnboarding() {
  const el = document.createElement('div');
  el.className = 'onboard';
  el.innerHTML = `
    <h1>N4 합격까지<br>즐겁게 가 볼까요?</h1>
    <div class="stage">
      <span class="dot" style="width:22px;height:22px;background:var(--lime-light);left:38%;top:6px"></span>
      <span class="dot" style="width:58px;height:58px;background:var(--pink);right:8px;top:160px"></span>
      <span class="dot" style="width:62px;height:62px;background:var(--peri);left:-6px;top:220px"></span>
      <div class="burst"><svg viewBox="0 0 130 130"><polygon points="${starPoints(65, 65, 64, 42, 11)}" fill="#cbe87a"/></svg><span>こんにちは!</span></div>
      <div class="bubble">같이 해요!</div>
      <div class="hero-mascot">${MASCOTS.box()}</div>
    </div>
    <button class="btn lime block">시작하기</button>`;
  document.body.append(el);
  $('button', el).addEventListener('click', () => {
    store.set('onboarded', true);
    el.remove();
  });
}

// ---------- 홈 ----------
function renderHome() {
  const dueV = VOCAB.filter((it) => isDue(it.id)).length;
  const dueK = KANJI.filter((it) => isDue(it.id)).length;
  const count = (items, st) => items.filter((it) => status(it.id) === st).length;
  const gramDone = store.get('grammarDone', []).length;
  const history = store.get('quizHistory', []);
  const wrongCount = Object.keys(wrongs).length;

  const hour = new Date().getHours();
  const hello = hour < 11 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요';

  // 이번 주 (월~일) 학습 기록
  const studied = new Set(store.get('days', []));
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = ['월', '화', '수', '목', '금', '토', '일'].map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const cls = [studied.has(dateKey(d)) && 'done', dateKey(d) === today() && 'today'].filter(Boolean).join(' ');
    return `<div class="day ${cls}"><b>${d.getDate()}</b><span>${label}</span></div>`;
  }).join('');

  const cards = [
    { go: 'vocab', ttl: '단어 카드', meta: dueV ? `복습 ${dueV}장` : `${VOCAB.length}개`, cls: 'c-lime', m: MASCOTS.moon() },
    { go: 'kanji', ttl: '한자 카드', meta: dueK ? `복습 ${dueK}장` : `${KANJI.length}자`, cls: 'c-pink', m: MASCOTS.half() },
    { go: 'grammar', ttl: '문법 정리', meta: `${gramDone} / ${GRAMMAR.length}`, cls: 'c-peri', m: MASCOTS.hex() },
    { go: 'listen', ttl: '청해 연습', meta: `대화 ${DIALOGS.length}개`, cls: 'c-mint', m: MASCOTS.box() },
    { go: 'quiz', ttl: '모의 퀴즈', meta: history[0] ? `최근 ${history[0].score}점` : '실력 점검', cls: 'c-navy', m: MASCOTS.star() },
    { go: 'notes', ttl: '오답노트', meta: `${wrongCount}문제`, cls: 'c-light', m: MASCOTS.drop() },
  ];

  const bar = (label, done, total) => `
    <div class="progress-row">
      <div class="row"><span>${label}</span><span class="spacer"></span><span class="muted">${done} / ${total}</span></div>
      <div class="bar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
    </div>`;

  view.innerHTML = `
    <div class="greet"><h1>${hello} 👋</h1><p>오늘도 N4 합격에 한 걸음 더!</p></div>
    <div class="week">${week}</div>
    <div class="stats">
      <div class="stat"><div class="num">${dueV + dueK}</div><div class="lbl">복습할 카드</div></div>
      <div class="stat"><div class="num">${streak()}일</div><div class="lbl">연속 학습 🔥</div></div>
      <div class="stat"><div class="num">${wrongCount}</div><div class="lbl">오답노트</div></div>
    </div>

    <div class="stack">
      ${cards.map((c) => `
        <button class="hcard ${c.cls}" data-go="${c.go}">
          <div class="top"><span class="ttl">${c.ttl}</span><span class="meta">${c.meta}</span></div>
          ${c.m}
        </button>`).join('')}
    </div>

    <div class="section-title">학습 현황</div>
    <div class="panel">
      ${bar('단어 암기 완료', count(VOCAB, 'known'), VOCAB.length)}
      ${bar('한자 암기 완료', count(KANJI, 'known'), KANJI.length)}
      ${bar('문법 학습 완료', gramDone, GRAMMAR.length)}
      <p class="small muted" style="margin:10px 0 0">카드에서 '알아요'를 3번 이상 누르면 암기 완료로 표시돼요.</p>
    </div>

    <div class="center"><button class="btn ghost small" id="reset">학습 기록 초기화</button></div>
  `;

  $$('[data-go]', view).forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
  $('#reset').addEventListener('click', () => {
    if (!confirm('모든 학습 기록과 오답노트를 지울까요? 되돌릴 수 없습니다.')) return;
    store.set('srs', {});
    store.set('wrongs', {});
    ['days', 'grammarDone', 'quizHistory'].forEach((k) => store.set(k, []));
    srs = {};
    wrongs = {};
    renderHome();
  });
}

// ---------- 플래시카드 (단어·한자 공용) ----------
function runFlashcards(container, deck, opts) {
  let i = 0;
  let flipped = false;
  const queue = deck.slice();
  const total = queue.length;
  let done = 0;

  function show() {
    if (i >= queue.length) {
      bindKeys(null);
      container.innerHTML = `
        <div class="empty ${opts.color}">
          ${MASCOTS.star('#fff')}
          <h3>이번 세트 완료!</h3>
          <p>${total}장을 학습했어요. 틀린 카드는 곧 다시 나와요.</p>
          <button class="btn ink" id="again">계속 학습하기</button>
        </div>`;
      $('#again', container).addEventListener('click', opts.onRestart);
      return;
    }
    const item = queue[i];
    flipped = false;
    container.innerHTML = `
      <div class="flash-top">
        <span>${done} / ${total}</span>
        <div class="bar" style="flex:1"><i style="width:${(done / total) * 100}%"></i></div>
        <span class="badge ${status(item.id)}">${STATUS_LABEL[status(item.id)]}</span>
      </div>
      <div class="flash ${opts.color}" id="flash">
        <span class="deco" style="width:90px;height:90px;background:#fff;left:-30px;bottom:-24px"></span>
        <span class="deco" style="width:26px;height:26px;background:#fff;left:28px;top:30px"></span>
        ${speakBtn(opts.say(item))}
        ${opts.front(item)}
        <div id="back" hidden>${opts.back(item)}</div>
        <div class="hint" id="hint">탭해서 정답 보기</div>
      </div>
      <div class="grade" id="grade" style="visibility:hidden">
        <button class="btn again" data-g="0">다시<small>1분 후</small></button>
        <button class="btn hard" data-g="1">애매해요<small>내일</small></button>
        <button class="btn good" data-g="2">알아요<small>${nextLabel(item.id)}</small></button>
      </div>`;

    $('#flash', container).addEventListener('click', flip);
    $$('[data-g]', container).forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.g))));
  }

  function flip() {
    if (flipped) return;
    flipped = true;
    $('#back', container).hidden = false;
    $('#hint', container).hidden = true;
    $('#grade', container).style.visibility = 'visible';
  }

  function answer(g) {
    const item = queue[i];
    grade(item.id, g);
    if (g === 0) queue.push(item); // 모르는 카드는 세트 끝에 다시
    else done++;
    i++;
    show();
  }

  bindKeys((e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (flipped && ['1', '2', '3'].includes(e.key)) answer(Number(e.key) - 1);
  });

  show();
}

function nextLabel(id) {
  const box = Math.min(((srs[id] && srs[id].box) || 0) + 1, INTERVALS.length - 1);
  return INTERVALS[box] + '일 후';
}

function emptyDeck(container, label, color, onPractice) {
  container.innerHTML = `
    <div class="empty ${color}">
      ${MASCOTS.moon('#fff')}
      <h3>오늘 할 ${label} 카드 끝!</h3>
      <p>복습 시기가 된 카드가 없어요. 자유 연습으로 더 공부할 수 있어요.</p>
      <button class="btn ink" id="practice">자유 연습 (무작위 10장)</button>
    </div>`;
  $('#practice', container).addEventListener('click', onPractice);
}

function segment(options, current, onChange) {
  const el = document.createElement('div');
  el.className = 'segment';
  el.innerHTML = options.map(([k, label]) => `<button data-k="${k}" class="${k === current ? 'on' : ''}">${label}</button>`).join('');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) onChange(b.dataset.k);
  });
  return el;
}

// ---------- 단어 ----------
const vocabState = { mode: 'cards', cat: 'all', query: '' };

function renderVocab() {
  view.innerHTML = pageHead('단어', `N4 단어 ${VOCAB.length}개 · 간격 반복으로 외워요`);
  view.append(segment([['cards', '카드 학습'], ['list', '단어 목록']], vocabState.mode, (m) => { vocabState.mode = m; route(); }));

  const chips = document.createElement('div');
  chips.className = 'chips';
  const cats = [['all', '전체'], ...Object.entries(window.VOCAB_CATEGORIES)];
  chips.innerHTML = cats.map(([k, l]) => `<button class="chip ${vocabState.cat === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { vocabState.cat = b.dataset.k; route(); }
  });
  view.append(chips);

  const items = VOCAB.filter((v) => vocabState.cat === 'all' || v.cat === vocabState.cat);
  const body = document.createElement('div');
  view.append(body);

  if (vocabState.mode === 'cards') startVocabCards(body, items);
  else renderVocabList(body, items);
}

function startVocabCards(body, items, practice = false) {
  const deck = practice ? sample(items, 10) : buildDeck(items);
  if (!deck.length) return emptyDeck(body, '단어', 'c-lime', () => startVocabCards(body, items, true));
  runFlashcards(body, deck, {
    color: 'c-lime',
    front: (v) => `<div class="big">${esc(v.w)}</div>`,
    back: (v) => `
      ${v.w !== v.r ? `<div class="reading">${esc(v.r)}</div>` : ''}
      <div class="meaning">${esc(v.m)}</div>
      <div class="extra">${esc(window.VOCAB_CATEGORIES[v.cat])}</div>`,
    say: (v) => v.r,
    onRestart: () => startVocabCards(body, items),
  });
}

function renderVocabList(body, items) {
  body.innerHTML = `
    <input class="search" type="search" placeholder="단어·읽기·뜻 검색" value="${esc(vocabState.query)}">
    <div class="list" id="vlist"></div>`;
  const list = $('#vlist', body);
  const draw = () => {
    const q = vocabState.query.trim();
    const shown = items.filter((v) => !q || v.w.includes(q) || v.r.includes(q) || v.m.includes(q));
    list.innerHTML = shown.length ? shown.map((v) => `
      <div class="list-item">
        <div class="grow">
          <div class="w">${esc(v.w)} ${v.w !== v.r ? `<span class="r">${esc(v.r)}</span>` : ''}</div>
          <div class="m">${esc(v.m)}</div>
        </div>
        <span class="badge ${status(v.id)}">${STATUS_LABEL[status(v.id)]}</span>
        ${speakBtn(v.r)}
      </div>`).join('') : '<div class="empty muted">검색 결과가 없어요</div>';
  };
  $('.search', body).addEventListener('input', (e) => { vocabState.query = e.target.value; draw(); });
  draw();
}

// ---------- 한자 ----------
const kanjiState = { mode: 'cards' };

function renderKanji() {
  view.innerHTML = pageHead('한자', `N4 한자 ${KANJI.length}자 · 음독·훈독·예시 단어`);
  view.append(segment([['cards', '카드 학습'], ['list', '한자표']], kanjiState.mode, (m) => { kanjiState.mode = m; route(); }));
  const body = document.createElement('div');
  view.append(body);
  if (kanjiState.mode === 'cards') startKanjiCards(body);
  else renderKanjiGrid(body);
}

const exHtml = (ex) => ex.map(([w, r, m]) => `<div>${esc(w)} (${esc(r)}) ${esc(m)}</div>`).join('');

function startKanjiCards(body, practice = false) {
  const deck = practice ? sample(KANJI, 10) : buildDeck(KANJI);
  if (!deck.length) return emptyDeck(body, '한자', 'c-pink', () => startKanjiCards(body, true));
  runFlashcards(body, deck, {
    color: 'c-pink',
    front: (k) => `<div class="big" style="font-size:96px">${esc(k.k)}</div>`,
    back: (k) => `
      <div class="meaning">${esc(k.m)}</div>
      <div class="reading" style="font-size:16px">음: ${esc(k.on)} · 훈: ${esc(k.kun)}</div>
      <div class="extra jp">${exHtml(k.ex)}</div>`,
    say: (k) => k.ex[0][1],
    onRestart: () => startKanjiCards(body),
  });
}

function renderKanjiGrid(body) {
  body.innerHTML = `
    <p class="small muted">한자를 누르면 자세히 볼 수 있어요. <span class="badge learning">학습 중</span> <span class="badge known">암기 완료</span></p>
    <div class="kanji-grid">${KANJI.map((k, i) => `<button class="kanji-cell ${status(k.id)}" data-i="${i}">${esc(k.k)}</button>`).join('')}</div>`;
  $('.kanji-grid', body).addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) showKanji(KANJI[Number(b.dataset.i)]);
  });
}

function showKanji(k) {
  modal.innerHTML = `
    <div class="modal-body">
      <div class="kanji-hero"><div class="k">${esc(k.k)}</div><div class="m">${esc(k.m)}</div></div>
      <dl class="kv">
        <dt>음독</dt><dd>${esc(k.on)}</dd>
        <dt>훈독</dt><dd>${esc(k.kun)}</dd>
      </dl>
      ${k.ex.map(([w, r, m]) => `
        <div class="ex" style="background:var(--chip);color:var(--text)">
          ${speakBtn(r)}
          <div><div class="jp">${esc(w)} <span class="small muted">${esc(r)}</span></div><div class="ko">${esc(m)}</div></div>
        </div>`).join('')}
      <button class="btn ink block" id="close" style="margin-top:10px">닫기</button>
    </div>`;
  modal.showModal();
  $('#close', modal).addEventListener('click', () => modal.close());
}

modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

// ---------- 문법 ----------
function renderGrammar() {
  const done = new Set(store.get('grammarDone', []));
  const sub = (n) => `${n} / ${GRAMMAR.length}개 학습 완료 · 눌러서 설명과 예문 보기`;
  view.innerHTML = `${pageHead('문법', sub(done.size))}<div id="gwrap"></div>`;
  const wrap = $('#gwrap');
  wrap.innerHTML = GRAMMAR.map((g) => `
    <details class="gram" data-id="${g.id}">
      <summary>
        <div class="grow">
          <div class="t">${esc(g.t)}</div>
          <div class="m">${esc(g.m)}</div>
        </div>
        ${done.has(g.id) ? '<span class="badge known">완료</span>' : ''}
      </summary>
      <div class="body">
        <div class="form"><b>접속</b> · ${esc(g.f)}</div>
        ${g.ex.map(([jp, ko]) => `
          <div class="ex">
            ${speakBtn(jp)}
            <div><div class="jp">${esc(jp)}</div><div class="ko">${esc(ko)}</div></div>
          </div>`).join('')}
        <label class="check"><input type="checkbox" ${done.has(g.id) ? 'checked' : ''}> 이 문법을 익혔어요</label>
      </div>
    </details>`).join('');

  wrap.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const det = e.target.closest('details');
    const set = new Set(store.get('grammarDone', []));
    if (e.target.checked) set.add(det.dataset.id); else set.delete(det.dataset.id);
    store.set('grammarDone', [...set]);
    markStudied();
    const summary = $('summary', det);
    const badge = $('.badge', summary);
    if (e.target.checked && !badge) summary.insertAdjacentHTML('beforeend', '<span class="badge known">완료</span>');
    if (!e.target.checked && badge) badge.remove();
    $('.page-head p').textContent = sub(set.size);
  });
}

// ---------- 문제 유형 ----------
const GROUPS = {
  vocab: { label: '단어', color: 'c-lime' },
  kanji: { label: '한자', color: 'c-pink' },
  grammar: { label: '문법', color: 'c-peri' },
  listen: { label: '청해', color: 'c-mint' },
};

const KINDS = {
  vmean: { group: 'vocab', label: '단어 → 뜻', desc: '일본어 단어를 보고 뜻 고르기', m: 'moon', c: 'c-lime' },
  vread: { group: 'vocab', label: '단어 → 읽기', desc: '한자 단어의 올바른 읽기 고르기', m: 'moon', c: 'c-light' },
  kmean: { group: 'kanji', label: '한자 → 훈·음', desc: '한자를 보고 뜻 고르기', m: 'half', c: 'c-pink' },
  gram: { group: 'grammar', label: '문법 빈칸', desc: '빈칸에 알맞은 표현 고르기', m: 'hex', c: 'c-peri' },
  lword: { group: 'listen', label: '단어 듣기', desc: '들리는 단어의 뜻 고르기', m: 'moon', c: 'c-lime' },
  lsent: { group: 'listen', label: '문장 듣기', desc: '들리는 문장의 해석 고르기', m: 'hex', c: 'c-peri' },
  ldialog: { group: 'listen', label: '대화 듣기', desc: `JLPT식 대화 ${DIALOGS.length}개 · 질문에 답하기`, m: 'box', c: 'c-mint' },
};

const MIX = { label: '종합 모의 테스트', desc: '단어·한자·문법을 섞어서 출제', m: 'star', c: 'c-navy' };

// 정답과 겹치지 않는 보기 n개
function distractors(answer, pool, n = 3) {
  return sample([...new Set(pool.filter((x) => x !== answer))], n);
}

function makeQuestion(kind) {
  if (kind === 'vmean' || kind === 'lword') {
    const v = sample(VOCAB, 1)[0];
    const same = VOCAB.filter((x) => x.cat === v.cat).map((x) => x.m);
    const base = { kind, key: `${kind}:${v.id}`, id: v.id, answer: v.m, options: shuffle([v.m, ...distractors(v.m, same)]) };
    const word = v.w !== v.r ? `${v.w} (${v.r})` : v.r;
    if (kind === 'lword') return { ...base, prompt: '들리는 단어의 뜻은?', audio: [['N', v.r]], reveal: word, noteText: word };
    return { ...base, prompt: '다음 단어의 뜻은?', main: v.w, sub: v.w !== v.r ? v.r : '', say: v.r, noteText: word };
  }
  if (kind === 'vread') {
    const kanjiWords = VOCAB.filter((x) => x.w !== x.r);
    const v = sample(kanjiWords, 1)[0];
    const same = kanjiWords.filter((x) => x.cat === v.cat).map((x) => x.r);
    return {
      kind, key: `${kind}:${v.id}`, id: v.id, prompt: '다음 단어의 읽는 법은?', main: v.w, noteText: v.w,
      answer: v.r, jpOptions: true, options: shuffle([v.r, ...distractors(v.r, same)]), explain: v.m, say: v.r,
    };
  }
  if (kind === 'kmean') {
    const k = sample(KANJI, 1)[0];
    return {
      kind, key: `${kind}:${k.id}`, id: k.id, prompt: '다음 한자의 훈·음은?', main: k.k, noteText: k.k,
      answer: k.m, options: shuffle([k.m, ...distractors(k.m, KANJI.map((x) => x.m))]),
      explain: k.ex.map(([w, r]) => `${w}(${r})`).join(', '), say: k.ex[0][1],
    };
  }
  if (kind === 'lsent') {
    const s = sample(SENTENCES, 1)[0];
    return {
      kind, key: `${kind}:${s.jp}`, prompt: '들리는 문장의 뜻은?', audio: [['N', s.jp]], reveal: s.jp, noteText: s.jp,
      answer: s.ko, options: shuffle([s.ko, ...distractors(s.ko, SENTENCES.map((x) => x.ko))]), explain: `문법 · ${s.t}`,
    };
  }
  if (kind === 'ldialog') {
    const d = sample(DIALOGS, 1)[0];
    return {
      kind, key: `${kind}:${d.id}`, prompt: `대화 듣기 · ${d.title}`, ask: d.q, noteText: d.q,
      audio: [...d.lines, ['N', d.q]], script: d.lines, explain: d.tr,
      answer: d.a, jpOptions: true, options: shuffle([d.a, ...d.o]),
    };
  }
  const g = sample(GRAMMAR, 1)[0];
  return {
    kind: 'gram', key: `gram:${g.id}`, prompt: `문법 · ${g.t}`, main: g.q.s, noteText: g.q.s, sentence: true,
    answer: g.q.a, jpOptions: true, options: shuffle([g.q.a, ...g.q.o]), explain: g.q.tr,
  };
}

function buildSet(kinds, count) {
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < count && guard++ < 1000) {
    const q = makeQuestion(kinds[out.length % kinds.length]);
    if (seen.has(q.key)) continue; // 같은 문제 중복 방지
    seen.add(q.key);
    out.push(q);
  }
  return shuffle(out);
}

// 모드 선택 카드 목록 (퀴즈·청해 공용)
function modePicker(entries, current) {
  return `<div class="modes">${entries.map(([k, t]) => `
    <button class="mode ${t.c} ${current === k ? 'on' : ''}" data-k="${k}">
      <span class="check-dot">✓</span>
      <div class="grow"><b>${t.label}</b><div class="d">${t.desc}</div></div>
      ${MASCOTS[t.m]()}
    </button>`).join('')}</div>`;
}

function historyHtml(filter) {
  const history = store.get('quizHistory', []).filter(filter);
  if (!history.length) return '';
  return `
    <div class="section-title">최근 기록</div>
    <div class="panel">${history.slice(0, 6).map((h) => `
      <div class="history-item"><span>${esc(h.date)} · ${esc((KINDS[h.type] || MIX).label)}</span><b>${h.correct}/${h.total} (${h.score}점)</b></div>`).join('')}
    </div>`;
}

// ---------- 청해 ----------
const listenState = { type: 'ldialog', count: 5 };

function renderListen() {
  const counts = listenState.type === 'ldialog' ? [5, 10, 15] : [10, 20];
  if (!counts.includes(listenState.count)) listenState.count = counts[0];
  const entries = Object.entries(KINDS).filter(([, t]) => t.group === 'listen');

  view.innerHTML = `
    ${pageHead('청해 연습', '일본어 음성을 듣고 알맞은 답을 골라요')}
    ${TTS_OK ? '' : '<div class="notice">이 브라우저는 음성 재생을 지원하지 않아요. Chrome이나 Safari 최신 버전을 사용해 주세요.</div>'}
    ${modePicker(entries, listenState.type)}
    <div class="section-title">문제 수</div>
    <div class="segment" id="count">
      ${counts.map((n) => `<button data-n="${n}" class="${listenState.count === n ? 'on' : ''}">${n}문제</button>`).join('')}
    </div>
    <button class="btn ink block" id="start">듣기 시작</button>
    <p class="small muted center">이어폰을 끼면 더 잘 들려요 🎧 · 틀린 문제는 오답노트에 저장돼요</p>
    ${historyHtml((h) => KINDS[h.type]?.group === 'listen')}`;

  $('.modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { listenState.type = b.dataset.k; renderListen(); }
  });
  $('#count').addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (b) { listenState.count = Number(b.dataset.n); renderListen(); }
  });
  const start = () => runSession(buildSet([listenState.type], listenState.count), { type: listenState.type, back: renderListen, retry: start });
  $('#start').addEventListener('click', start);
}

// ---------- 퀴즈 ----------
const quizState = { type: 'mix', count: 10 };

function renderQuiz() {
  const entries = [...Object.entries(KINDS).filter(([, t]) => t.group !== 'listen'), ['mix', MIX]];
  view.innerHTML = `
    ${pageHead('모의 퀴즈', '유형을 골라 실력을 점검해요')}
    ${modePicker(entries, quizState.type)}
    <div class="section-title">문제 수</div>
    <div class="segment" id="count">
      ${[10, 20, 30].map((n) => `<button data-n="${n}" class="${quizState.count === n ? 'on' : ''}">${n}문제</button>`).join('')}
    </div>
    <button class="btn ink block" id="start">퀴즈 시작</button>
    <p class="small muted center">틀린 문제는 오답노트와 복습 카드에 자동으로 추가돼요</p>
    ${historyHtml((h) => KINDS[h.type]?.group !== 'listen')}`;

  $('.modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { quizState.type = b.dataset.k; renderQuiz(); }
  });
  $('#count').addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (b) { quizState.count = Number(b.dataset.n); renderQuiz(); }
  });
  const start = () => {
    const kinds = quizState.type === 'mix' ? ['vmean', 'vread', 'kmean', 'gram'] : [quizState.type];
    runSession(buildSet(kinds, quizState.count), { type: quizState.type, back: renderQuiz, retry: start });
  };
  $('#start').addEventListener('click', start);
}

// ---------- 문제 풀이 (퀴즈·청해·오답노트 공용) ----------
// ctx: { type, back, retry, notes(오답노트 복습이면 true) }
function runSession(questions, ctx) {
  const s = { i: 0, correct: 0, wrong: [], graduated: 0 };
  if (!questions.length) return ctx.back();
  showQuestion();

  function showQuestion() {
    const q = questions[s.i];
    const n = questions.length;
    const color = GROUPS[KINDS[q.kind].group].color;
    view.innerHTML = `
      <div class="flash-top">
        <span>${s.i + 1} / ${n}</span>
        <div class="bar" style="flex:1"><i style="width:${(s.i / n) * 100}%"></i></div>
        <span>정답 ${s.correct}</span>
      </div>
      <div class="qcard ${color}">
        <div class="q-prompt">${esc(q.prompt)}</div>
        ${q.audio ? `
          <div class="player">
            ${MASCOTS.box('#fff')}
            <div class="row">
              <button class="btn ink" id="play">▶ 듣기</button>
              <button class="btn" id="slow" style="background:#fff;color:var(--ink)">🐢 느리게 ${tts.slow ? 'ON' : 'OFF'}</button>
            </div>
          </div>` : `
          <div class="q-main ${q.sentence ? 'sentence' : ''}">${esc(q.main)}</div>
          ${q.sub ? `<div class="q-sub">${esc(q.sub)}</div>` : ''}`}
        ${q.ask ? `<div class="q-ask">Q. ${esc(q.ask)}</div>` : ''}
      </div>
      <div class="options">
        ${q.options.map((o, i) => `<button class="opt ${q.jpOptions ? 'jp' : ''}" data-i="${i}">${esc(o)}</button>`).join('')}
      </div>
      <div class="feedback" id="fb"></div>
      <div class="actions">
        <button class="btn ghost" id="quit">그만하기</button>
        <span class="spacer"></span>
        <button class="btn ink" id="next" hidden>${s.i + 1 < n ? '다음 문제 →' : '결과 보기'}</button>
      </div>`;

    let answered = false;

    const play = () => {
      const btn = $('#play');
      if (!btn) return;
      btn.classList.add('playing');
      speakLines(q.audio).then(() => btn.isConnected && btn.classList.remove('playing'));
    };
    if (q.audio) {
      $('#play').addEventListener('click', play);
      $('#slow').addEventListener('click', (e) => {
        tts.slow = !tts.slow;
        store.set('slow', tts.slow);
        e.currentTarget.textContent = `🐢 느리게 ${tts.slow ? 'ON' : 'OFF'}`;
        play();
      });
      setTimeout(play, 300);
    }

    const choose = (idx) => {
      if (answered) return;
      answered = true;
      const picked = q.options[idx];
      const ok = picked === q.answer;
      $$('.opt', view).forEach((x, i) => {
        if (q.options[i] === q.answer) x.classList.add('correct');
        else if (i === idx) x.classList.add('wrong');
      });
      let graduated = false;
      if (ok) {
        s.correct++;
        graduated = noteRight(q.key);
        if (graduated) s.graduated++;
      } else {
        s.wrong.push(q);
        addWrong(q, picked);
        if (q.id) grade(q.id, 0);
      }
      markStudied();
      $('#fb').innerHTML = feedbackHtml(q, ok, graduated);
      if (q.say) speak(q.say);
      $('#next').hidden = false;
    };

    const next = () => {
      if (!answered) return;
      s.i++;
      if (s.i < n) showQuestion(); else showResult();
    };

    $$('.opt', view).forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.i))));
    $('#next').addEventListener('click', next);
    $('#quit').addEventListener('click', () => { if (TTS_OK) speechSynthesis.cancel(); bindKeys(null); ctx.back(); });
    bindKeys((e) => {
      if (['1', '2', '3', '4'].includes(e.key)) choose(Number(e.key) - 1);
      else if (e.key === 'Enter' && answered) { e.preventDefault(); next(); }
      else if (e.key.toLowerCase() === 'r' && q.audio) play();
    });
  }

  function showResult() {
    bindKeys(null);
    const total = questions.length;
    const score = Math.round((s.correct / total) * 100);
    if (!ctx.notes) {
      const history = store.get('quizHistory', []);
      history.unshift({ date: today(), type: ctx.type, correct: s.correct, total, score });
      store.set('quizHistory', history.slice(0, 40));
    }
    const msg = score >= 90 ? '훌륭해요! 합격권이에요 🎉' : score >= 70 ? '좋아요! 조금만 더 다듬어 봐요 💪' : '오답노트로 복습하고 다시 도전해 봐요 📚';
    const color = score >= 90 ? 'c-lime' : score >= 70 ? 'c-peri' : 'c-pink';

    view.innerHTML = `
      <div class="result ${color}">
        ${score >= 70 ? MASCOTS.star('#fff') : MASCOTS.drop('#fff')}
        <div class="score-big">${score}<span style="font-size:26px">점</span></div>
        <p>${s.correct} / ${total} 정답 · ${msg}</p>
        ${ctx.notes ? `<p><b>🎓 오답노트에서 ${s.graduated}문제 졸업!</b></p>` : ''}
        <div class="row" style="justify-content:center">
          <button class="btn" id="back" style="background:#fff;color:var(--ink)">돌아가기</button>
          <button class="btn ink" id="retry">다시 풀기</button>
        </div>
      </div>
      ${s.wrong.length ? `
        <div class="section-title">이번에 틀린 문제</div>
        <div class="list">${s.wrong.map(noteHtml).join('')}</div>
        <button class="btn ink block" style="margin-top:12px" id="to-notes">오답노트 전체 보기</button>` : ''}`;
    $('#back').addEventListener('click', ctx.back);
    $('#retry').addEventListener('click', ctx.retry);
    $('#to-notes')?.addEventListener('click', () => { location.hash = 'notes'; });
  }
}

function scriptHtml(lines) {
  return `<div class="script">${lines.map(([who, text]) => `
    <div class="line"><span class="who ${who}">${who === 'M' ? '男' : '女'}</span><span>${esc(text)}</span></div>`).join('')}</div>`;
}

function feedbackHtml(q, ok, graduated) {
  return `
    <div class="fb">
      <div class="head ${ok ? 'ok' : 'ng'}">${ok ? '정답이에요!' : '아쉬워요!'}</div>
      ${ok ? '' : `<div>정답: <b class="jp">${esc(q.answer)}</b></div>`}
      ${q.reveal ? `<div class="jp" style="font-weight:700;margin-top:6px">${esc(q.reveal)} ${speakBtn(q.audio[0][1])}</div>` : ''}
      ${q.script ? scriptHtml(q.script) : ''}
      ${q.explain ? `<div class="${q.script ? 'script' : ''} muted" style="margin-top:6px">${esc(q.explain)}</div>` : ''}
      ${graduated ? '<div style="margin-top:8px;font-weight:700">🎓 오답노트에서 졸업했어요!</div>' : ''}
      ${!ok ? '<div class="small muted" style="margin-top:6px">오답노트에 저장했어요.</div>' : ''}
    </div>`;
}

// ---------- 오답노트 ----------
const notesState = { group: 'all' };

function noteHtml(q, w) {
  const g = GROUPS[KINDS[q.kind].group];
  const sayText = q.audio ? q.audio.map(([, t]) => t).join(' ') : q.say;
  return `
    <div class="note">
      <span class="tag ${g.color}">${g.label} · ${esc(KINDS[q.kind].label)}</span>
      <div class="q ${q.sentence || q.kind === 'lsent' || q.kind === 'ldialog' ? 'sentence' : ''}">${esc(q.noteText)}</div>
      <div class="ans">
        ${w && w.picked ? `<s>${esc(w.picked)}</s> → ` : ''}정답 <b>${esc(q.answer)}</b>
      </div>
      ${q.kind !== 'ldialog' && q.explain ? `<div class="exp">${esc(q.explain)}</div>` : ''}
      ${w ? `
        <div class="foot">
          <span>${w.count}번 틀림</span>
          <span class="pips" title="연속 정답">${Array.from({ length: GRADUATE }, (_, i) => `<i class="${i < (w.right || 0) ? 'on' : ''}"></i>`).join('')}</span>
          <span class="spacer"></span>
          ${sayText ? `<button class="icon-btn" data-say="${esc(sayText)}">🔊 듣기</button>` : ''}
          <button class="icon-btn" data-del="${esc(q.key)}">삭제</button>
        </div>` : ''}
    </div>`;
}

function renderNotes() {
  const all = Object.values(wrongs).sort((a, b) => b.last - a.last);
  const inGroup = (w, g) => g === 'all' || KINDS[w.q.kind].group === g;
  const shown = all.filter((w) => inGroup(w, notesState.group));
  const chips = [['all', '전체'], ...Object.entries(GROUPS).map(([k, g]) => [k, g.label])];

  view.innerHTML = `
    ${pageHead('오답노트', `틀린 문제를 모아 다시 풀어요 · ${GRADUATE}번 연속으로 맞히면 졸업!`)}
    <div class="chips">${chips.map(([k, l]) => {
      const n = all.filter((w) => inGroup(w, k)).length;
      return `<button class="chip ${notesState.group === k ? 'on' : ''}" data-k="${k}">${l} ${n}</button>`;
    }).join('')}</div>
    ${shown.length ? `
      <button class="btn ink block" id="retest" style="margin-bottom:14px">오답 다시 풀기 (${Math.min(shown.length, 20)}문제)</button>
      <div class="list">${shown.map((w) => noteHtml(w.q, w)).join('')}</div>` : `
      <div class="empty c-light">
        ${MASCOTS.hex()}
        <h3>${all.length ? '이 유형에는 오답이 없어요' : '오답노트가 비어 있어요'}</h3>
        <p>퀴즈나 청해에서 틀린 문제가 여기에 모여요.</p>
        <button class="btn ink" id="go-quiz">퀴즈 풀러 가기</button>
      </div>`}`;

  $('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { notesState.group = b.dataset.k; renderNotes(); }
  });
  $('#go-quiz')?.addEventListener('click', () => { location.hash = 'quiz'; });
  view.addEventListener('click', onNoteDelete);
  $('#retest')?.addEventListener('click', function retest() {
    const qs = sample(Object.values(wrongs).filter((w) => inGroup(w, notesState.group)), 20)
      .map((w) => ({ ...w.q, options: shuffle(w.q.options) }));
    runSession(qs, { type: 'notes', notes: true, back: () => route(), retry: retest });
  });
}

function onNoteDelete(e) {
  const b = e.target.closest('[data-del]');
  if (!b || location.hash !== '#notes') return;
  delete wrongs[b.dataset.del];
  store.set('wrongs', wrongs);
  view.removeEventListener('click', onNoteDelete);
  renderNotes();
}

// ---------- 시작 ----------
route();
if (!store.get('onboarded', false)) showOnboarding();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 기능 없이 동작 */ });
}
