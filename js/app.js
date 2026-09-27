(() => {
  const STORAGE_KEY = "learningcorean.v1";
  const QUIZ_LENGTH = 10;

  const $ = (id) => document.getElementById(id);
  const els = {
    setup: $("setup"), quiz: $("quiz"), result: $("result"),
    level: $("level"), subtitle: $("subtitle"), answerMode: $("answerMode"),
    rate: $("rate"), rateLabel: $("rateLabel"), weakOnly: $("weakOnly"),
    start: $("start"), voiceWarning: $("voiceWarning"),
    progress: $("progress"), score: $("score"),
    play: $("play"), playSlow: $("playSlow"),
    caption: $("caption"), hint: $("hint"),
    form: $("answerForm"), input: $("answerInput"), choices: $("choices"),
    skip: $("skip"), feedback: $("feedback"), next: $("next"),
    resultSummary: $("resultSummary"), resultList: $("resultList"),
    retryWrong: $("retryWrong"), backToSetup: $("backToSetup"),
    stats: $("stats"), resetStats: $("resetStats"),
  };

  // ---------- 保存データ ----------
  function loadStats() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }
  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch { /* 保存不可でも続行 */ }
  }
  let stats = loadStats();
  const isWeak = (w) => { const s = stats[w.ko]; return s && s.wrong > 0 && s.streak < 2; };

  function record(word, ok) {
    const s = stats[word.ko] || { right: 0, wrong: 0, streak: 0 };
    if (ok) { s.right++; s.streak++; } else { s.wrong++; s.streak = 0; }
    stats[word.ko] = s;
    saveStats(stats);
  }

  function renderStats() {
    const seen = WORDS.filter((w) => stats[w.ko]);
    const weak = WORDS.filter(isWeak);
    els.stats.textContent = `学習済み ${seen.length} / ${WORDS.length} 語　・　苦手 ${weak.length} 語`;
    els.weakOnly.disabled = weak.length === 0;
    if (weak.length === 0) els.weakOnly.checked = false;
  }

  // ---------- 音声 ----------
  let koVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    koVoice = voices.find((v) => /^ko(-|_|$)/i.test(v.lang)) || null;
    els.voiceWarning.hidden = !!koVoice || voices.length === 0;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
  } else {
    els.voiceWarning.hidden = false;
    els.voiceWarning.textContent = "このブラウザは音声合成に対応していません。Chrome / Safari / Edge をお使いください。";
  }

  function speak(text, rateScale = 1) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (koVoice) u.voice = koVoice;
    u.rate = Number(els.rate.value) * rateScale;
    speechSynthesis.speak(u);
  }

  // ---------- 出題 ----------
  let state = null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pool() {
    const lv = els.level.value;
    let list = WORDS.filter((w) => lv === "all" || String(w.level) === lv);
    if (els.weakOnly.checked) list = list.filter(isWeak);
    return list;
  }

  function startQuiz(words) {
    if (words.length === 0) {
      els.voiceWarning.hidden = false;
      els.voiceWarning.textContent = "出題できる単語がありません。レベルか「苦手な単語だけ」の設定を変えてください。";
      return;
    }
    state = {
      words: shuffle(words).slice(0, QUIZ_LENGTH),
      index: 0, correct: 0, answered: false, log: [],
      subtitle: els.subtitle.value, answerMode: els.answerMode.value,
    };
    show("quiz");
    showQuestion();
  }

  function show(name) {
    for (const k of ["setup", "quiz", "result"]) els[k].hidden = k !== name;
  }

  // 漢字の上にハングルの音をルビで振る（1字1音節）
  function renderCaption(word, revealAll) {
    els.caption.replaceChildren();
    const mode = state.subtitle;
    const showHanja = revealAll || mode !== "none";
    const showHangul = revealAll || mode === "both";
    if (!showHanja) {
      els.caption.textContent = "？？";
      els.caption.classList.add("masked");
      return;
    }
    els.caption.classList.remove("masked");
    const hanja = [...word.hanja];
    const hangul = [...word.ko];
    hanja.forEach((ch, i) => {
      const ruby = document.createElement("ruby");
      ruby.append(ch);
      const rt = document.createElement("rt");
      rt.textContent = showHangul ? (hangul[i] || "") : "";
      ruby.append(rt);
      els.caption.append(ruby);
    });
  }

  function showQuestion() {
    const word = state.words[state.index];
    state.answered = false;
    els.progress.textContent = `${state.index + 1} / ${state.words.length}`;
    els.score.textContent = `正解 ${state.correct}`;
    els.feedback.hidden = true;
    els.feedback.className = "feedback";
    els.next.hidden = true;
    els.skip.hidden = false;
    els.hint.hidden = state.subtitle !== "none";
    renderCaption(word, false);

    if (state.answerMode === "choice") {
      els.form.hidden = true;
      els.choices.hidden = false;
      renderChoices(word);
    } else {
      els.form.hidden = false;
      els.choices.hidden = true;
      els.input.value = "";
      els.input.disabled = false;
      els.input.focus();
    }
    speak(word.ko);
  }

  function renderChoices(word) {
    const others = shuffle(WORDS.filter((w) => w.ko !== word.ko)).slice(0, 3);
    const options = shuffle([word, ...others]);
    els.choices.replaceChildren(...options.map((w) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice";
      b.textContent = w.ja[0];
      b.dataset.ko = w.ko;
      b.addEventListener("click", () => answer(w.ko === word.ko ? word.ja[0] : w.ja[0], b));
      return b;
    }));
  }

  function answer(input, button) {
    if (state.answered) return;
    state.answered = true;
    const word = state.words[state.index];
    const ok = isCorrect(word, input);
    if (ok) state.correct++;
    record(word, ok);
    state.log.push({ word, input, ok });

    els.score.textContent = `正解 ${state.correct}`;
    els.input.disabled = true;
    els.skip.hidden = true;
    if (state.answerMode === "choice") {
      for (const b of els.choices.children) {
        b.disabled = true;
        if (b.dataset.ko === word.ko) b.classList.add("correct");
      }
      if (!ok && button) button.classList.add("wrong");
    }
    renderCaption(word, true);

    const readings = word.ja.filter((j) => /^[ぁ-ゟ]+$/.test(j));
    const kanji = word.ja.filter((j) => !/^[ぁ-ゟ]+$/.test(j));
    els.feedback.replaceChildren();
    const head = document.createElement("p");
    head.className = "verdict";
    head.textContent = ok ? "⭕ 正解！" : (input ? `❌ 不正解（あなたの答え：${input}）` : "❌ スキップ");
    const body = document.createElement("p");
    body.append(`${word.ko}（${word.hanja}）＝ `);
    const strong = document.createElement("strong");
    strong.textContent = kanji.join("・");
    body.append(strong, readings.length ? `（${readings.join("・")}）` : "");
    els.feedback.append(head, body);
    if (word.note) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = `💡 ${word.note}`;
      els.feedback.append(note);
    }
    els.feedback.classList.add(ok ? "ok" : "ng");
    els.feedback.hidden = false;
    els.next.hidden = false;
    els.next.textContent = state.index + 1 < state.words.length ? "次へ ▶" : "結果を見る";
    els.next.focus();
  }

  function nextQuestion() {
    state.index++;
    if (state.index < state.words.length) showQuestion();
    else showResult();
  }

  function showResult() {
    speechSynthesis?.cancel?.();
    const { correct, words, log } = state;
    els.resultSummary.textContent = `${words.length} 問中 ${correct} 問正解（${Math.round((correct / words.length) * 100)}%）`;
    els.resultList.replaceChildren(...log.map(({ word, ok }) => {
      const li = document.createElement("li");
      li.className = ok ? "ok" : "ng";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mini";
      btn.textContent = "🔊";
      btn.title = "発音を聞く";
      btn.addEventListener("click", () => speak(word.ko));
      li.append(btn, ` ${ok ? "⭕" : "❌"} ${word.ko}　${word.hanja}　→ ${word.ja[0]}`);
      return li;
    }));
    const wrong = log.filter((l) => !l.ok).map((l) => l.word);
    els.retryWrong.hidden = wrong.length === 0;
    els.retryWrong.onclick = () => startQuiz(wrong);
    renderStats();
    show("result");
  }

  // ---------- イベント ----------
  els.rate.addEventListener("input", () => { els.rateLabel.textContent = `${Number(els.rate.value).toFixed(1)}x`; });
  els.start.addEventListener("click", () => startQuiz(pool()));
  els.play.addEventListener("click", () => speak(state.words[state.index].ko));
  els.playSlow.addEventListener("click", () => speak(state.words[state.index].ko, 0.6));
  els.hint.addEventListener("click", () => showHintOnce());
  els.form.addEventListener("submit", (e) => { e.preventDefault(); if (els.input.value.trim()) answer(els.input.value.trim()); });
  els.skip.addEventListener("click", () => answer(""));
  els.next.addEventListener("click", nextQuestion);
  els.backToSetup.addEventListener("click", () => { renderStats(); show("setup"); });
  $("quit").addEventListener("click", () => { speechSynthesis?.cancel?.(); renderStats(); show("setup"); });
  // confirm() が使えない環境もあるため、2回押しで確定する
  let resetArmed = false;
  els.resetStats.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      els.resetStats.textContent = "もう一度押すとリセット";
      setTimeout(() => { resetArmed = false; els.resetStats.textContent = "記録をリセット"; }, 3000);
      return;
    }
    resetArmed = false;
    els.resetStats.textContent = "記録をリセット";
    stats = {}; saveStats(stats); renderStats();
  });

  // 字幕なしモードのヒント：漢字だけ表示する
  function showHintOnce() {
    const word = state.words[state.index];
    els.caption.classList.remove("masked");
    els.caption.replaceChildren();
    for (const ch of word.hanja) {
      const ruby = document.createElement("ruby");
      ruby.append(ch, document.createElement("rt"));
      els.caption.append(ruby);
    }
    els.hint.hidden = true;
  }

  document.addEventListener("keydown", (e) => {
    if (els.quiz.hidden) return;
    if (e.key === "Enter" && state.answered) { e.preventDefault(); nextQuestion(); }
    else if (e.key === " " && document.activeElement !== els.input) { e.preventDefault(); speak(state.words[state.index].ko); }
    else if (state.answerMode === "choice" && !state.answered && /^[1-4]$/.test(e.key)) {
      els.choices.children[Number(e.key) - 1]?.click();
    }
  });

  renderStats();
})();
