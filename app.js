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

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ---------- 데이터 ----------
const VOCAB = Object.entries(window.VOCAB_RAW).flatMap(([cat, rows]) =>
  rows.map(([w, r, m]) => ({ id: 'v:' + w + ':' + r, w, r, m, cat })));
const KANJI = window.KANJI.map((k) => ({ ...k, id: 'k:' + k.k }));
const GRAMMAR = window.GRAMMAR;

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

// ---------- 학습 기록 (연속 학습일) ----------
const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD

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
  if (!days.has(d.toLocaleDateString('sv-SE'))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toLocaleDateString('sv-SE'))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ---------- 라우터 ----------
const routes = { home: renderHome, vocab: renderVocab, kanji: renderKanji, grammar: renderGrammar, quiz: renderQuiz };

function route() {
  const name = location.hash.slice(1) || 'home';
  const fn = routes[name] || renderHome;
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === (routes[name] ? name : 'home')));
  speechSynthesis?.cancel?.();
  view.innerHTML = '';
  fn();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// ---------- 홈 ----------
function renderHome() {
  const dueCount = [...VOCAB, ...KANJI].filter((it) => isDue(it.id)).length;
  const count = (items, st) => items.filter((it) => status(it.id) === st).length;
  const gramDone = store.get('grammarDone', []).length;
  const history = store.get('quizHistory', []);

  const bar = (label, done, total) => `
    <div class="progress-row">
      <div class="row"><span>${label}</span><span class="spacer"></span><span class="muted">${done} / ${total}</span></div>
      <div class="bar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
    </div>`;

  view.innerHTML = `
    <div class="card hero">
      <div class="stat"><div class="num">${dueCount}</div><div class="lbl">오늘 복습할 카드</div></div>
      <div class="stat"><div class="num">${streak()}</div><div class="lbl">연속 학습일 🔥</div></div>
      <div class="stat"><div class="num">${history[0] ? history[0].score + '%' : '—'}</div><div class="lbl">최근 퀴즈</div></div>
    </div>

    <div class="section-title">바로 시작</div>
    <div class="grid2">
      <button class="tile" data-go="vocab"><b>단어 카드</b><span>${VOCAB.length}개 단어</span></button>
      <button class="tile" data-go="kanji"><b>한자 카드</b><span>${KANJI.length}개 한자</span></button>
      <button class="tile" data-go="grammar"><b>문법 정리</b><span>${GRAMMAR.length}개 문형</span></button>
      <button class="tile" data-go="quiz"><b>모의 퀴즈</b><span>실력 점검</span></button>
    </div>

    <div class="section-title">학습 현황</div>
    <div class="card">
      ${bar('단어 암기 완료', count(VOCAB, 'known'), VOCAB.length)}
      ${bar('한자 암기 완료', count(KANJI, 'known'), KANJI.length)}
      ${bar('문법 학습 완료', gramDone, GRAMMAR.length)}
      <p class="small muted" style="margin:10px 0 0">카드에서 '알아요'를 3번 이상 누르면 암기 완료로 표시됩니다.</p>
    </div>

    <div class="center"><button class="btn ghost small" id="reset">학습 기록 초기화</button></div>
  `;

  $$('[data-go]', view).forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
  $('#reset').addEventListener('click', () => {
    if (!confirm('모든 학습 기록을 지울까요? 되돌릴 수 없습니다.')) return;
    ['srs', 'days', 'grammarDone', 'quizHistory'].forEach((k) => store.set(k, k === 'srs' ? {} : []));
    srs = {};
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
      container.innerHTML = `
        <div class="card empty">
          <div class="big">🎉</div>
          <h3>이번 세트 완료!</h3>
          <p class="muted">${total}장을 학습했어요. 틀린 카드는 곧 다시 나옵니다.</p>
          <button class="btn primary" id="again">계속 학습하기</button>
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
      <div class="card flash" id="flash">
        <button class="speak" id="say" aria-label="발음 듣기">🔊</button>
        ${opts.front(item)}
        <div id="back" hidden>${opts.back(item)}</div>
        <div class="hint" id="hint">탭해서 정답 보기</div>
      </div>
      <div class="grade" id="grade" style="visibility:hidden">
        <button class="btn again" data-g="0">다시<small>1분 후</small></button>
        <button class="btn hard" data-g="1">애매해요<small>내일</small></button>
        <button class="btn good" data-g="2">알아요<small>${nextLabel(item.id)}</small></button>
      </div>`;

    $('#flash', container).addEventListener('click', (e) => {
      if (e.target.closest('#say')) return;
      flip();
    });
    $('#say', container).addEventListener('click', () => speak(opts.say(item)));
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

  function onKey(e) {
    if (!container.isConnected) return document.removeEventListener('keydown', onKey);
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (flipped && ['1', '2', '3'].includes(e.key)) answer(Number(e.key) - 1);
  }
  document.addEventListener('keydown', onKey);

  show();
}

function nextLabel(id) {
  const box = Math.min(((srs[id] && srs[id].box) || 0) + 1, INTERVALS.length - 1);
  return INTERVALS[box] + '일 후';
}

function emptyDeck(container, label, onPractice) {
  container.innerHTML = `
    <div class="card empty">
      <div class="big">✅</div>
      <h3>오늘 할 ${label} 카드를 모두 끝냈어요</h3>
      <p class="muted">복습 시기가 된 카드가 없어요. 자유 연습으로 더 공부할 수 있어요.</p>
      <button class="btn primary" id="practice">자유 연습 (무작위 10장)</button>
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
  view.innerHTML = '';
  view.append(segment([['cards', '카드 학습'], ['list', '단어 목록']], vocabState.mode, (m) => { vocabState.mode = m; renderVocab(); }));

  const chips = document.createElement('div');
  chips.className = 'chips';
  const cats = [['all', '전체'], ...Object.entries(window.VOCAB_CATEGORIES)];
  chips.innerHTML = cats.map(([k, l]) => `<button class="chip ${vocabState.cat === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { vocabState.cat = b.dataset.k; renderVocab(); }
  });
  view.append(chips);

  const items = VOCAB.filter((v) => vocabState.cat === 'all' || v.cat === vocabState.cat);
  const body = document.createElement('div');
  view.append(body);

  if (vocabState.mode === 'cards') startVocabCards(body, items);
  else renderVocabList(body, items);
}

function vocabCardOpts(restart) {
  return {
    front: (v) => `<div class="big">${esc(v.w)}</div>`,
    back: (v) => `
      ${v.w !== v.r ? `<div class="reading">${esc(v.r)}</div>` : ''}
      <div class="meaning">${esc(v.m)}</div>
      <div class="extra">${esc(window.VOCAB_CATEGORIES[v.cat])}</div>`,
    say: (v) => v.r,
    onRestart: restart,
  };
}

function startVocabCards(body, items, practice = false) {
  const deck = practice ? sample(items, 10) : buildDeck(items);
  const restart = () => startVocabCards(body, items);
  if (!deck.length) return emptyDeck(body, '단어', () => startVocabCards(body, items, true));
  runFlashcards(body, deck, vocabCardOpts(restart));
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
        <button class="speak" data-say="${esc(v.r)}" aria-label="발음 듣기">🔊</button>
      </div>`).join('') : '<div class="empty muted">검색 결과가 없어요</div>';
  };
  $('.search', body).addEventListener('input', (e) => { vocabState.query = e.target.value; draw(); });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (b) speak(b.dataset.say);
  });
  draw();
}

// ---------- 한자 ----------
const kanjiState = { mode: 'cards' };

function renderKanji() {
  view.innerHTML = '';
  view.append(segment([['cards', '카드 학습'], ['list', '한자 목록']], kanjiState.mode, (m) => { kanjiState.mode = m; renderKanji(); }));
  const body = document.createElement('div');
  view.append(body);
  if (kanjiState.mode === 'cards') startKanjiCards(body);
  else renderKanjiGrid(body);
}

const exHtml = (ex) => ex.map(([w, r, m]) => `<div>${esc(w)} <span class="muted">(${esc(r)})</span> ${esc(m)}</div>`).join('');

function startKanjiCards(body, practice = false) {
  const deck = practice ? sample(KANJI, 10) : buildDeck(KANJI);
  if (!deck.length) return emptyDeck(body, '한자', () => startKanjiCards(body, true));
  runFlashcards(body, deck, {
    front: (k) => `<div class="big" style="font-size:88px">${esc(k.k)}</div>`,
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
    <p class="small muted">한자를 누르면 자세한 정보를 볼 수 있어요. <span class="badge learning">● 학습 중</span> <span class="badge known">● 암기 완료</span></p>
    <div class="kanji-grid">${KANJI.map((k, i) => {
      const st = status(k.id);
      return `<button class="kanji-cell" data-i="${i}">${esc(k.k)}${st !== 'new' ? `<span class="dot ${st}"></span>` : ''}</button>`;
    }).join('')}</div>`;
  $('.kanji-grid', body).addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) showKanji(KANJI[Number(b.dataset.i)]);
  });
}

function showKanji(k) {
  modal.innerHTML = `
    <div class="modal-body">
      <div class="kanji-big">${esc(k.k)}</div>
      <div class="center" style="font-weight:700;font-size:18px">${esc(k.m)}</div>
      <dl class="kv">
        <dt>음독</dt><dd>${esc(k.on)}</dd>
        <dt>훈독</dt><dd>${esc(k.kun)}</dd>
      </dl>
      <div class="section-title" style="margin-top:0">예시 단어</div>
      ${k.ex.map(([w, r, m]) => `
        <div class="ex">
          <button class="speak" data-say="${esc(r)}" aria-label="발음 듣기">🔊</button>
          <div><div class="jp">${esc(w)} <span class="muted small">${esc(r)}</span></div><div class="ko">${esc(m)}</div></div>
        </div>`).join('')}
      <button class="btn block" id="close" style="margin-top:14px">닫기</button>
    </div>`;
  modal.showModal();
  $('#close', modal).addEventListener('click', () => modal.close());
  $$('[data-say]', modal).forEach((b) => b.addEventListener('click', () => speak(b.dataset.say)));
}

modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

// ---------- 문법 ----------
function renderGrammar() {
  const done = new Set(store.get('grammarDone', []));
  view.innerHTML = '<div id="gwrap"></div>';
  const wrap = $('#gwrap');
  wrap.innerHTML = `
    <p class="small muted">${done.size} / ${GRAMMAR.length}개 학습 완료 · 문형을 눌러 설명과 예문을 확인하세요.</p>
    ${GRAMMAR.map((g) => `
      <details class="gram" data-id="${g.id}">
        <summary>
          <div class="grow" style="flex:1">
            <div class="t">${esc(g.t)}</div>
            <div class="m">${esc(g.m)}</div>
          </div>
          ${done.has(g.id) ? '<span class="badge known">완료</span>' : ''}
        </summary>
        <div class="body">
          <div class="form"><b>접속</b> · ${esc(g.f)}</div>
          ${g.ex.map(([jp, ko]) => `
            <div class="ex">
              <button class="speak" data-say="${esc(jp)}" aria-label="발음 듣기">🔊</button>
              <div><div class="jp">${esc(jp)}</div><div class="ko">${esc(ko)}</div></div>
            </div>`).join('')}
          <label class="check"><input type="checkbox" ${done.has(g.id) ? 'checked' : ''}> 이 문법을 익혔어요</label>
        </div>
      </details>`).join('')}`;

  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (b) speak(b.dataset.say);
  });
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
    $('p', wrap).textContent = `${set.size} / ${GRAMMAR.length}개 학습 완료 · 문형을 눌러 설명과 예문을 확인하세요.`;
  });
}

// ---------- 퀴즈 ----------
const QUIZ_TYPES = {
  vmean: { label: '단어 → 뜻', desc: '일본어 단어를 보고 한국어 뜻 고르기' },
  vread: { label: '단어 → 읽기', desc: '한자 단어의 올바른 읽기 고르기' },
  kmean: { label: '한자 → 훈·음', desc: '한자를 보고 뜻 고르기' },
  gram: { label: '문법 빈칸', desc: '문장의 빈칸에 알맞은 표현 고르기' },
  mix: { label: '종합 (모의 테스트)', desc: '모든 유형을 섞어서 출제' },
};

const quizState = { type: 'mix', count: 10 };

// 정답과 다른 보기 3개를 같은 그룹에서 우선 뽑는다
function distractors(answer, pool, n = 3) {
  const uniq = [...new Set(pool.filter((x) => x !== answer))];
  return sample(uniq, n);
}

function makeQuestion(type) {
  if (type === 'vmean') {
    const v = sample(VOCAB, 1)[0];
    const same = VOCAB.filter((x) => x.cat === v.cat).map((x) => x.m);
    return {
      prompt: '다음 단어의 뜻은?', main: v.w, sub: v.w !== v.r ? v.r : '', answer: v.m,
      options: shuffle([v.m, ...distractors(v.m, same)]), id: v.id, say: v.r,
    };
  }
  if (type === 'vread') {
    const kanjiWords = VOCAB.filter((x) => x.w !== x.r);
    const v = sample(kanjiWords, 1)[0];
    const same = kanjiWords.filter((x) => x.cat === v.cat).map((x) => x.r);
    return {
      prompt: '다음 단어의 읽는 법은?', main: v.w, answer: v.r, jpOptions: true,
      options: shuffle([v.r, ...distractors(v.r, same)]), id: v.id, explain: v.m, say: v.r,
    };
  }
  if (type === 'kmean') {
    const k = sample(KANJI, 1)[0];
    return {
      prompt: '다음 한자의 훈·음은?', main: k.k, answer: k.m,
      options: shuffle([k.m, ...distractors(k.m, KANJI.map((x) => x.m))]), id: k.id,
      explain: k.ex.map(([w, r]) => `${w}(${r})`).join(', '),
    };
  }
  const g = sample(GRAMMAR, 1)[0];
  return {
    prompt: `문법 · ${g.t}`, main: g.q.s, sentence: true, answer: g.q.a, jpOptions: true,
    options: shuffle([g.q.a, ...g.q.o]), explain: g.q.tr,
  };
}

function renderQuiz() {
  const history = store.get('quizHistory', []);
  view.innerHTML = `
    <div class="section-title" style="margin-top:0">문제 유형</div>
    <div class="options" id="types">
      ${Object.entries(QUIZ_TYPES).map(([k, t]) => `
        <button class="opt ${quizState.type === k ? 'correct' : ''}" data-k="${k}">
          <b>${t.label}</b><div class="small muted">${t.desc}</div>
        </button>`).join('')}
    </div>
    <div class="section-title">문제 수</div>
    <div class="segment" id="count">
      ${[10, 20, 30].map((n) => `<button data-n="${n}" class="${quizState.count === n ? 'on' : ''}">${n}문제</button>`).join('')}
    </div>
    <button class="btn primary block" id="start">퀴즈 시작</button>
    <p class="small muted center">틀린 단어·한자는 복습 카드에 자동으로 추가돼요.</p>
    ${history.length ? `
      <div class="section-title">최근 기록</div>
      <div class="card">${history.slice(0, 8).map((h) => `
        <div class="history-item"><span>${esc(h.date)} · ${esc(QUIZ_TYPES[h.type]?.label || '')}</span><b>${h.correct}/${h.total} (${h.score}%)</b></div>`).join('')}
      </div>` : ''}`;

  $('#types').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { quizState.type = b.dataset.k; renderQuiz(); }
  });
  $('#count').addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (b) { quizState.count = Number(b.dataset.n); renderQuiz(); }
  });
  $('#start').addEventListener('click', startQuiz);
}

function startQuiz() {
  const types = quizState.type === 'mix' ? ['vmean', 'vread', 'kmean', 'gram'] : [quizState.type];
  const questions = [];
  const seen = new Set();
  let guard = 0;
  while (questions.length < quizState.count && guard++ < 500) {
    const q = makeQuestion(types[questions.length % types.length]);
    if (seen.has(q.main)) continue; // 같은 문제 중복 방지
    seen.add(q.main);
    questions.push(q);
  }
  const quiz = { questions: shuffle(questions), i: 0, correct: 0, wrong: [] };
  showQuestion(quiz);
}

function showQuestion(quiz) {
  const q = quiz.questions[quiz.i];
  const n = quiz.questions.length;
  view.innerHTML = `
    <div class="flash-top">
      <span>${quiz.i + 1} / ${n}</span>
      <div class="bar" style="flex:1"><i style="width:${(quiz.i / n) * 100}%"></i></div>
      <span>정답 ${quiz.correct}</span>
    </div>
    <div class="card">
      <div class="q-prompt">${esc(q.prompt)}</div>
      <div class="q-main ${q.sentence ? 'sentence' : ''}">${esc(q.main)}</div>
      ${q.sub ? `<div class="center muted jp" style="margin-top:-10px;margin-bottom:12px">${esc(q.sub)}</div>` : ''}
      <div class="options">
        ${q.options.map((o) => `<button class="opt ${q.jpOptions ? 'jp' : ''}" data-o="${esc(o)}">${esc(o)}</button>`).join('')}
      </div>
      <div class="feedback" id="fb"></div>
    </div>
    <div class="row">
      <button class="btn ghost" id="quit">그만하기</button>
      <span class="spacer"></span>
      <button class="btn primary" id="next" hidden>${quiz.i + 1 < n ? '다음 문제' : '결과 보기'}</button>
    </div>`;

  let answered = false;
  $$('.opt', view).forEach((b) => b.addEventListener('click', () => {
    if (answered) return;
    answered = true;
    const ok = b.dataset.o === q.answer;
    $$('.opt', view).forEach((x) => {
      if (x.dataset.o === q.answer) x.classList.add('correct');
    });
    if (ok) {
      quiz.correct++;
    } else {
      b.classList.add('wrong');
      quiz.wrong.push(q);
      if (q.id) grade(q.id, 0);
    }
    markStudied();
    $('#fb').innerHTML = `${ok ? '<b style="color:var(--good)">정답!</b>' : `<b style="color:var(--bad)">오답</b> · 정답: <span class="jp">${esc(q.answer)}</span>`}
      ${q.explain ? `<div class="muted jp">${esc(q.explain)}</div>` : ''}`;
    if (q.say) speak(q.say);
    $('#next').hidden = false;
    $('#next').focus();
  }));

  $('#next').addEventListener('click', () => {
    quiz.i++;
    if (quiz.i < n) showQuestion(quiz); else showResult(quiz);
  });
  $('#quit').addEventListener('click', renderQuiz);
}

function showResult(quiz) {
  const total = quiz.questions.length;
  const score = Math.round((quiz.correct / total) * 100);
  const history = store.get('quizHistory', []);
  history.unshift({ date: today(), type: quizState.type, correct: quiz.correct, total, score });
  store.set('quizHistory', history.slice(0, 30));

  const msg = score >= 90 ? '훌륭해요! 합격권이에요 🎉' : score >= 70 ? '좋아요! 조금만 더 다듬어 봐요 💪' : '틀린 문제를 복습하고 다시 도전해 봐요 📚';
  view.innerHTML = `
    <div class="card center">
      <div class="q-prompt">결과</div>
      <div class="score-big">${score}<span style="font-size:24px">점</span></div>
      <p>${quiz.correct} / ${total} 정답 · ${msg}</p>
      <div class="row" style="justify-content:center">
        <button class="btn" id="back">유형 선택</button>
        <button class="btn primary" id="retry">다시 풀기</button>
      </div>
    </div>
    ${quiz.wrong.length ? `
      <div class="section-title">틀린 문제 복습</div>
      <div class="list">${quiz.wrong.map((q) => `
        <div class="list-item"><div class="grow">
          <div class="w" style="font-size:16px">${esc(q.main)}</div>
          <div class="m">정답: <b class="jp">${esc(q.answer)}</b></div>
          ${q.explain ? `<div class="r">${esc(q.explain)}</div>` : ''}
        </div></div>`).join('')}
      </div>` : ''}`;
  $('#back').addEventListener('click', renderQuiz);
  $('#retry').addEventListener('click', startQuiz);
}

// ---------- 시작 ----------
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 기능 없이 동작 */ });
}
