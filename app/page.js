"use client";

import { useEffect, useRef, useState } from "react";
import { exportDocx, parseBlocks, prepareFile } from "@/lib/client";
import Board from "./Board";
import History from "./History";

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const LOADING = {
  analyze: ["Разчитаме задачата…", "Проверяваме колко лесно би я решил ИИ…", "Подбираме предложения…", "Почти готово…"],
  finalize: ["Обединяваме избраните промени…", "Пишем новата задача…", "Оценяваме я отново…"],
  open: ["Отваряме задачата…"],
};

// ---------- Small pieces ----------

function RichText({ text }) {
  return (
    <div className="rich">
      {parseBlocks(text).map((b, i) =>
        b.type === "heading" ? (
          <h3 key={i}>{b.text}</h3>
        ) : b.type === "list" ? (
          <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
        ) : (
          <p key={i}>{b.text}</p>
        )
      )}
    </div>
  );
}

function scoreTone(n) {
  if (n >= 7) return "high";
  if (n >= 4) return "mid";
  return "low";
}

function ScoreMeter({ label, value, reason }) {
  const tone = scoreTone(value);
  const words = { high: "лесно за ИИ", mid: "отчасти лесно", low: "трудно за ИИ" };
  return (
    <div className={`score score-${tone}`}>
      <div className="score-top">
        <span className="score-label">{label}</span>
        <span className="score-num">
          {value}<small>/10</small>
        </span>
      </div>
      <div className="score-bar" role="img" aria-label={`${value} от 10`}>
        <span style={{ width: `${value * 10}%` }} />
      </div>
      <div className="score-word">{words[tone]}</div>
      {reason && <p className="score-reason">{reason}</p>}
    </div>
  );
}

function Loading({ kind }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, LOADING[kind].length - 1)), 4500);
    return () => clearInterval(t);
  }, [kind]);
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      <p>{LOADING[kind][i]}</p>
      {kind !== "open" && <small>Обикновено отнема 20–40 секунди.</small>}
    </div>
  );
}

function Steps({ step }) {
  const items = ["Задача", "Предложения", "Нова задача"];
  const idx = { input: 0, results: 1, final: 2 }[step];
  return (
    <ol className="steps">
      {items.map((t, i) => (
        <li key={t} className={i === idx ? "on" : i < idx ? "done" : ""}>
          <span>{i + 1}</span>
          {t}
        </li>
      ))}
    </ol>
  );
}

function LoginCard({ initialError, onLogin }) {
  const [stage, setStage] = useState("code"); // "code" -> "teacher"
  const [code, setCode] = useState("");
  const [school, setSchool] = useState("");
  const [mode, setMode] = useState("login"); // "login" | "create"
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState(initialError || "");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("misli-sam-school-code");
      if (saved) setCode(saved);
    } catch {}
  }, []);

  async function send(body) {
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function submitCode(e) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const { ok, data } = await send({ code });
      if (!ok) throw new Error(data.error || "Невалиден код.");
      setSchool(data.school);
      setStage("teacher");
      try {
        localStorage.setItem("misli-sam-school-code", code.trim());
      } catch {}
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function submitTeacher(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (mode === "create" && pin !== pin2) {
      setError("ПИН кодовете не съвпадат.");
      return;
    }
    setSending(true);
    try {
      const { ok, data } = await send({ code, name, pin, mode });
      if (!ok) {
        if (data.notFound) setInfo("Ако влизате за първи път, изберете „Нов профил“.");
        if (data.exists) setMode("login");
        throw new Error(data.error || "Входът не успя.");
      }
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const switchMode = (m) => {
    setMode(m);
    setError("");
    setInfo("");
    setPin("");
    setPin2("");
  };

  if (stage === "code") {
    return (
      <section className="card login">
        <h1>Добре дошли</h1>
        <p className="lead">Въведете кода на вашето училище.</p>
        <form onSubmit={submitCode}>
          <label>
            Код на училището
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="напр. K7MQ4XPA" autoComplete="off" autoCapitalize="characters" required autoFocus />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary big" type="submit" disabled={sending}>
            {sending ? "Проверка…" : "Напред"}
          </button>
        </form>
        <p className="privacy">Нямате код? Попитайте директора или администратора на училището.</p>
      </section>
    );
  }

  return (
    <section className="card login">
      <button className="link back" onClick={() => { setStage("code"); setError(""); setInfo(""); }}>← {school}</button>
      <h1>{mode === "login" ? "Вход" : "Нов профил"}</h1>
      <p className="lead">
        {mode === "login"
          ? "Въведете името и ПИН кода на вашия профил."
          : "Създайте личен профил. В него ще се пазят вашите задачи. Изберете ПИН от 4 до 6 цифри, който ще запомните."}
      </p>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => switchMode("login")}>
          Имам профил
        </button>
        <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "on" : ""} onClick={() => switchMode("create")}>
          Нов профил
        </button>
      </div>
      <form onSubmit={submitTeacher}>
        <label>
          Име и фамилия
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Мария Петрова" autoComplete="name" required autoFocus />
        </label>
        <label>
          ПИН код
          <input type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4–6 цифри" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
        </label>
        {mode === "create" && (
          <label>
            Повторете ПИН кода
            <input type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" required />
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {info && <p className="hint">{info}</p>}
        <button className="primary big" type="submit" disabled={sending}>
          {sending ? "Влизане…" : mode === "login" ? "Вход" : "Създай профил"}
        </button>
      </form>
      <p className="privacy">Ще останете влезли на това устройство 30 дни. Забравен ПИН? Администраторът може да го нулира.</p>
    </section>
  );
}

// ---------- Page ----------

export default function Home() {
  const [step, setStep] = useState("input");
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState("");
  const [ctx, setCtx] = useState({ grade: "", subject: "", setting: "home", grading: "mid" });
  const [me, setMe] = useState(null); // null = checking, {loggedIn:false} or {loggedIn:true,...}
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState([]);
  const [final, setFinal] = useState(null);
  const [compareTab, setCompareTab] = useState("after"); // phones only: which version to show
  const [view, setView] = useState("work"); // "work" | "history"
  const [assignmentId, setAssignmentId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const topRef = useRef(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.loggedIn ? d : { loggedIn: false, error: d.error }))
      .catch(() => setMe({ loggedIn: false, error: "Няма връзка със сървъра." }));
  }, []);

  function refreshUsage() {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => d.loggedIn && setMe(d))
      .catch(() => {});
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    setMe({ loggedIn: false });
    restart();
  }

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  function pickFile(f) {
    if (!f) return;
    setError("");
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function post(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      throw new Error(res.status === 413 ? "Файлът е твърде голям." : "Сървърът не отговори правилно. Опитайте отново.");
    }
    if (data.needsLogin) {
      setMe({ loggedIn: false, error: data.error });
      throw new Error(data.error);
    }
    if (!res.ok) throw new Error(data.error || "Нещо се обърка.");
    return data;
  }

  async function analyze() {
    setError("");
    let payload;
    try {
      if (mode === "file") {
        if (!file) throw new Error("Качете файл със задачата.");
        payload = await prepareFile(file);
      } else {
        if (text.trim().length < 15) throw new Error("Поставете текста на задачата.");
        payload = { kind: "text", text };
      }
    } catch (e) {
      setError(e.message);
      return;
    }
    setBusy("analyze");
    try {
      const data = await post("/api/analyze", { ...payload, context: ctx });
      setAnalysis(data);
      setAssignmentId(data.assignmentId);
      setSelected(data.suggestions.map(() => true));
      setFinal(null);
      setStep("results");
      refreshUsage();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function finalize() {
    setError("");
    const chosen = analysis.suggestions.filter((_, i) => selected[i]);
    if (!chosen.length) {
      setError("Изберете поне едно предложение.");
      return;
    }
    setBusy("finalize");
    try {
      const data = await post("/api/finalize", { assignmentId, selected });
      setFinal(data);
      setCompareTab("after");
      setStep("final");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function openSaved(id) {
    setError("");
    setBusy("open");
    try {
      const res = await fetch(`/api/assignments/${id}`);
      const data = await res.json().catch(() => ({}));
      if (data.needsLogin) {
        setMe({ loggedIn: false, error: data.error });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Задачата не можа да бъде отворена.");
      setAnalysis(data.analysis);
      setAssignmentId(data.id);
      setCtx({ grade: "", subject: "", setting: "home", grading: "mid", ...(data.context || {}) });
      setSelected(data.analysis.suggestions.map((_, i) => (data.selected ? Boolean(data.selected[i]) : true)));
      setFinal(data.final);
      setCompareTab("after");
      setView("work");
      setStep(data.final ? "final" : "results");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  function newAssignment() {
    restart();
    setView("work");
  }

  function restart() {
    setAssignmentId(null);
    setStep("input");
    setAnalysis(null);
    setFinal(null);
    setFile(null);
    setPreview(null);
    setText("");
    setError("");
  }

  const chosenCount = selected.filter(Boolean).length;

  return (
    <div className={`shell ${view === "work" && (step === "results" || step === "final") && me?.loggedIn && !busy ? "wide" : ""}`} ref={topRef}>
      <header className="top">
        <div className="brand">
          <span className="mark">М</span>
          <div>
            <strong>Мисли сам</strong>
            <small>задачи, които карат учениците да мислят</small>
          </div>
        </div>
        {me?.loggedIn && view === "work" && <Steps step={step} />}
      </header>

      {me?.loggedIn && (
        <div className="account">
          <span>
            {me.school}
            {me.teacher ? ` · ${me.teacher}` : ""}
            {me.limit != null && me.used != null ? ` · ${me.used} от ${me.limit} анализа този месец` : ""}
          </span>
          <span className="account-actions">
            {view === "work" && step !== "input" ? (
              <button className="link" onClick={newAssignment}>+ Нова задача</button>
            ) : null}
            {view !== "history" && (
              <button className="link" onClick={() => { setError(""); setView("history"); }}>Моите задачи</button>
            )}
            <button className="link" onClick={signOut}>Изход</button>
          </span>
        </div>
      )}

      <main>
        {me === null ? (
          <div className="loading"><div className="spinner" /></div>
        ) : !me.loggedIn ? (
          <LoginCard
            initialError={me.error}
            onLogin={(d) => {
              setMe({ loggedIn: true, ...d });
              newAssignment();
              refreshUsage();
            }}
          />
        ) : busy ? (
          <Loading kind={busy} />
        ) : view === "history" ? (
          <History onOpen={openSaved} onNew={newAssignment} onLoggedOut={(err) => setMe({ loggedIn: false, error: err })} />
        ) : step === "input" ? (
          <section className="card">
            <h1>Направете задачата по-трудна за решаване с ИИ</h1>
            <p className="lead">Качете задача като PDF или снимка, или поставете текста. Ще получите оценка колко лесно ученик може да я реши с ИИ и конкретни предложения как да я промените, с обяснение какъв проблем решава всяко.</p>

            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={mode === "file"} className={mode === "file" ? "on" : ""} onClick={() => setMode("file")}>
                Файл или снимка
              </button>
              <button role="tab" aria-selected={mode === "text"} className={mode === "text" ? "on" : ""} onClick={() => setMode("text")}>
                Текст
              </button>
            </div>

            {mode === "file" ? (
              <div
                className={`drop ${dragOver ? "over" : ""} ${file ? "has" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
                {file ? (
                  <div className="file-chosen">
                    {preview ? <img src={preview} alt="Преглед на задачата" /> : <div className="pdf-badge">PDF</div>}
                    <div>
                      <strong>{file.name}</strong>
                      <small>{(file.size / 1024 / 1024).toFixed(1)} MB · натиснете, за да смените</small>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="drop-icon">↑</div>
                    <strong>Изберете файл или го пуснете тук</strong>
                    <small>PDF до 3 MB, или снимка (от телефона също става)</small>
                  </>
                )}
              </div>
            ) : (
              <textarea
                className="paste"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Поставете текста на задачата тук…"
                rows={9}
              />
            )}

            <h2 className="sub">Контекст</h2>
            <p className="hint">Помага предложенията да са реалистични за вашия клас.</p>
            <div className="grid">
              <label>
                Клас
                <select value={ctx.grade} onChange={(e) => setCtx({ ...ctx, grade: e.target.value })}>
                  <option value="">– изберете –</option>
                  {GRADES.map((g) => (
                    <option key={g} value={`${g} клас`}>{g} клас</option>
                  ))}
                  <option value="университет">Университет</option>
                </select>
              </label>
              <label>
                Предмет
                <input value={ctx.subject} onChange={(e) => setCtx({ ...ctx, subject: e.target.value })} placeholder="напр. Български език и литература" />
              </label>
              <label>
                Къде се изпълнява
                <select value={ctx.setting} onChange={(e) => setCtx({ ...ctx, setting: e.target.value })}>
                  <option value="home">У дома</option>
                  <option value="class">В клас</option>
                  <option value="both">И двете</option>
                </select>
              </label>
              <label>
                Време за проверка
                <select value={ctx.grading} onChange={(e) => setCtx({ ...ctx, grading: e.target.value })}>
                  <option value="low">Малко</option>
                  <option value="mid">Средно</option>
                  <option value="high">Достатъчно</option>
                </select>
              </label>
            </div>

            {error && <p className="error" role="alert">{error}</p>}

            <button className="primary big" onClick={analyze}>
              Анализирай задачата
            </button>
            <p className="privacy">Моля, не качвайте задачи с имена или лични данни на ученици.</p>
          </section>
        ) : step === "results" && analysis ? (
          <section>
            <div className="card">
              <div className="results-head">
                <div>
                  <h1>Анализ на задачата</h1>
                  <p className="lead">{analysis.summary}</p>
                </div>
                <ScoreMeter label="Сега" value={analysis.ai_score_before} reason={analysis.score_reason} />
              </div>
            </div>

            <h2 className="section-title">
              Предложения до всяка част <span>{chosenCount} от {analysis.suggestions.length} избрани</span>
            </h2>
            <p className="hint board-hint">Номерата до всяка част показват кои предложения се отнасят за нея. Задръжте курсора върху предложение, за да видите частта му.</p>

            <Board
              parts={analysis.parts}
              suggestions={analysis.suggestions}
              selected={selected}
              onToggle={(i) => setSelected((arr) => arr.map((v, j) => (j === i ? !v : v)))}
            />

            {error && <p className="error" role="alert">{error}</p>}

            <div className="actions sticky">
              <button className="ghost" onClick={restart}>Нова задача</button>
              <button className="primary" onClick={finalize} disabled={!chosenCount}>
                Създай новата задача ({chosenCount})
              </button>
            </div>
          </section>
        ) : step === "final" && final ? (
          <section>
            <div className="compare card">
              <ScoreMeter label="Преди" value={analysis.ai_score_before} />
              <div className="arrow">→</div>
              <ScoreMeter label="След" value={final.ai_score_after} />
              <p className="compare-reason">{final.score_reason}</p>
            </div>

            <div className="tabs compare-tabs" role="tablist">
              <button role="tab" aria-selected={compareTab === "before"} className={compareTab === "before" ? "on" : ""} onClick={() => setCompareTab("before")}>
                Преди
              </button>
              <button role="tab" aria-selected={compareTab === "after"} className={compareTab === "after" ? "on" : ""} onClick={() => setCompareTab("after")}>
                След
              </button>
            </div>

            <div className={`versions show-${compareTab}`}>
              <div className="version before">
                <div className="version-label">Преди</div>
                <div className="card doc">
                  {analysis.parts.map((p) => (
                    <div key={p.id} className="old-part">
                      <div className="part-label">{p.label}</div>
                      <p>{p.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="version after">
                <div className="version-label">След</div>
                <div className="card doc print-area">
                  <h1 className="doc-title">{final.title}</h1>
                  <RichText text={final.assignment} />
                </div>
              </div>
            </div>

            <div className="card notes">
              <h2>Бележки за учителя</h2>
              <RichText text={final.teacher_notes} />
            </div>

            {error && <p className="error" role="alert">{error}</p>}

            <div className="actions">
              <button className="ghost" onClick={() => setStep("results")}>← Промени избора</button>
              <button className="ghost" onClick={() => window.print()}>Печат / PDF</button>
              <button
                className="primary"
                onClick={() => exportDocx(final).catch(() => setError("Word файлът не можа да бъде създаден."))}
              >
                Изтегли Word
              </button>
            </div>
            <p className="hint center">За PDF изберете „Запази като PDF“ в прозореца за печат.</p>
            <p className="hint center saved-note">✓ Запазено в „Моите задачи“.</p>
            <div className="center">
              <button className="link" onClick={restart}>Анализирай друга задача</button>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="foot">
        Предложенията са генерирани от ИИ. Прегледайте ги преди да ги използвате – вие познавате класа си най-добре.
      </footer>
    </div>
  );
}
