"use client";

import Logo from "./Logo";
import { useEffect, useRef, useState } from "react";
import { exportDocx, parseBlocks, prepareFile } from "@/lib/client";
import Board, { Tips } from "./Board";
import History from "./History";
import Setup from "./Setup";
import { gradeChoices, subjectChoices } from "@/lib/subjects";

const LAST_KEY = "misli-sam-last";
const readLast = () => {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) || "{}");
  } catch {
    return {};
  }
};


const LOADING = {
  analyze: ["Разчитаме материала…", "Проверяваме колко лесно би го решил ИИ…", "Подбираме предложения…", "Почти готово…"],
  finalize: ["Обединяваме избраните промени…", "Пишем новата версия…", "Оценяваме я отново…"],
  open: ["Отваряме материала…"],
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

const RISK_WORD = { high: "висок риск", mid: "среден риск", low: "нисък риск" };

function ScoreTile({ label, value }) {
  const tone = scoreTone(value);
  return (
    <div className={`tile tone-${tone}`}>
      <div className="tile-k">{label}</div>
      <div className="tile-v">
        {value}
        <small>/10</small>
      </div>
      <div className="tile-s">{RISK_WORD[tone]}</div>
    </div>
  );
}

const gradeLabel = (g) => (!g ? "" : /клас/.test(g) ? g : `${g} клас`);
const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

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
          : "Създайте личен профил. В него ще се пазят вашите материали. Изберете ПИН от 4 до 6 цифри, който ще запомните."}
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
  const [ctx, setCtx] = useState({ grade: "", subject: "" });
  const [me, setMe] = useState(null); // null = checking, {loggedIn:false} or {loggedIn:true,...}
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState([]);
  const [final, setFinal] = useState(null);
  const [compareTab, setCompareTab] = useState("after"); // phones only: which version to show
  const [view, setView] = useState("work"); // "work" | "history"
  const [assignmentId, setAssignmentId] = useState(null);

  const settings = me?.loggedIn ? me.settings : null;
  const subjects = subjectChoices(settings);
  const grades = gradeChoices(settings);

  // Fill in subject/grade from the teacher's settings and their last choice.
  function applyDefaults(st = settings) {
    if (!st) return;
    const last = readLast();
    const subs = subjectChoices(st);
    const grs = gradeChoices(st);
    setCtx({
      subject: subs.includes(last.subject) ? last.subject : subs[0] || "",
      grade: grs.includes(last.grade) ? last.grade : "",
    });
  }

  useEffect(() => {
    applyDefaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(settings)]);
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
        if (!file) throw new Error("Качете файл с материала.");
        payload = await prepareFile(file);
      } else {
        if (text.trim().length < 15) throw new Error("Поставете текста на материала.");
        payload = { kind: "text", text };
      }
    } catch (e) {
      setError(e.message);
      return;
    }
    setBusy("analyze");
    try {
      const context = {
        subject: ctx.subject,
        grade: ctx.grade ? `${ctx.grade} клас` : "",
        stages: settings?.stages || [],
      };
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify({ subject: ctx.subject, grade: ctx.grade }));
      } catch {}
      const data = await post("/api/analyze", { ...payload, context });
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
      if (!res.ok) throw new Error(data.error || "Материалът не можа да бъде отворен.");
      setAnalysis(data.analysis);
      setAssignmentId(data.id);
      setCtx({ grade: "", subject: "", ...(data.context || {}) });
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
    applyDefaults();
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
        <button className="brand" onClick={() => me?.loggedIn && me.settings && newAssignment()} aria-label="Мисли сам – начало">
          <Logo />
          <span className="brand-name">Мисли сам</span>
        </button>
        {me?.loggedIn && me.settings && (
          <nav className="nav">
            <button className={view === "work" ? "on" : ""} onClick={newAssignment}>Нов материал</button>
            <button className={view === "history" ? "on" : ""} onClick={() => { setError(""); setView("history"); }}>Моите материали</button>
            <button className={view === "settings" ? "on" : ""} onClick={() => setView("settings")}>Настройки</button>
          </nav>
        )}
        {me?.loggedIn && (
          <div className="account-box">
            <span className="who" title={`${me.teacher || ""} · ${me.school || ""}`}>
              <span className="avatar">{initials(me.teacher)}</span>
              <span className="who-text">
                <strong>{me.teacher}</strong>
                <small>
                  {me.school}
                  {me.limit != null && me.used != null ? ` · ${me.used}/${me.limit} този месец` : ""}
                </small>
              </span>
            </span>
            <button className="logout" onClick={signOut}>Изход</button>
          </div>
        )}
      </header>

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
        ) : !me.settings ? (
          <Setup firstTime onSaved={(st) => setMe({ ...me, settings: st })} />
        ) : view === "settings" ? (
          <Setup
            initial={me.settings}
            onSaved={(st) => {
              setMe({ ...me, settings: st });
              setView("work");
            }}
            onCancel={() => setView("work")}
          />
        ) : busy ? (
          <Loading kind={busy} />
        ) : view === "history" ? (
          <History onOpen={openSaved} onNew={newAssignment} onLoggedOut={(err) => setMe({ loggedIn: false, error: err })} />
        ) : step === "input" ? (
          <section className="upload">
            <div className="hero-text">
              <span className="eyebrow">Нов материал</span>
              <h1>Направете материала<br />по-труден за ИИ</h1>
              <p className="lead">Качете задание, тест или работен лист като PDF или снимка, или поставете текста. Ще видите колко лесно ученик може да го реши с ИИ и конкретни предложения как да го промените.</p>
            </div>
            <div className="card">

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
                    {preview ? <img src={preview} alt="Преглед на материала" /> : <div className="pdf-badge">PDF</div>}
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
                placeholder="Поставете текста на материала тук…"
                rows={9}
              />
            )}

            <div className="context-row">
              {subjects.length > 1 && (
                <div className="ctx-group">
                  <span className="ctx-label">Предмет</span>
                  <div className="chips">
                    {subjects.map((sub) => (
                      <button key={sub} type="button" className={`chip-btn ${ctx.subject === sub ? "on" : ""}`} aria-pressed={ctx.subject === sub} onClick={() => setCtx({ ...ctx, subject: sub })}>
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {grades.length > 0 && (
                <div className="ctx-group">
                  <span className="ctx-label">
                    Клас <span className="optional">(по избор)</span>
                  </span>
                  <div className="chips">
                    {grades.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`chip-btn round ${ctx.grade === g ? "on" : ""}`}
                        aria-pressed={ctx.grade === g}
                        onClick={() => setCtx({ ...ctx, grade: ctx.grade === g ? "" : g })}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {subjects.length === 1 && (
              <p className="hint ctx-note">
                Предмет: {subjects[0]} ·{" "}
                <button className="link" onClick={() => setView("settings")}>промени</button>
              </p>
            )}

            {error && <p className="error" role="alert">{error}</p>}

            <button className="primary big" onClick={analyze}>
              Анализирай материала →
            </button>
            <p className="privacy">Моля, не качвайте материали с имена или лични данни на ученици.</p>
            </div>
          </section>
        ) : step === "results" && analysis ? (
          <section>
            <div className="hero">
              <div className="hero-text">
                {(ctx.grade || ctx.subject) && <span className="eyebrow">{[gradeLabel(ctx.grade), ctx.subject].filter(Boolean).join(" · ")}</span>}
                <h1>{analysis.title || "Анализ на материала"}</h1>
                <p className="lead">{analysis.score_reason}</p>
              </div>
              <div className="tiles">
                <ScoreTile label="Лесно за ИИ" value={analysis.ai_score_before} />
                <div className="tile tone-violet">
                  <div className="tile-k">Предложения</div>
                  <div className="tile-v">{analysis.suggestions.length}</div>
                  <div className="tile-s">{chosenCount} избрани</div>
                </div>
              </div>
            </div>

            <Tips tips={analysis.delivery_tips || []} />

            <div className="section-bar">
              <h2>Предложения до всяка част</h2>
              <span className="hint">Задръжте курсора върху предложение, за да видите частта му</span>
            </div>

            <Board
              parts={analysis.parts}
              suggestions={analysis.suggestions}
              selected={selected}
              onToggle={(i) => setSelected((arr) => arr.map((v, j) => (j === i ? !v : v)))}
            />

            {error && <p className="error" role="alert">{error}</p>}

            <div className="dock">
              <span className="dock-text">
                <b>
                  {chosenCount} от {analysis.suggestions.length}
                </b>{" "}
                предложения избрани
              </span>
              <span className="dock-btns">
                <button className="ghost" onClick={restart}>Нов материал</button>
                <button className="primary" onClick={finalize} disabled={!chosenCount}>
                  Създай новата версия →
                </button>
              </span>
            </div>
          </section>
        ) : step === "final" && final ? (
          <section>
            <div className="hero">
              <div className="hero-text">
                <span className="eyebrow">✓ Запазено в „Моите материали“</span>
                <h1>{final.title}</h1>
                <p className="lead">{final.score_reason}</p>
              </div>
              <div className="tiles">
                <ScoreTile label="Преди" value={analysis.ai_score_before} />
                <div className="tiles-arrow">→</div>
                <ScoreTile label="След" value={final.ai_score_after} />
              </div>
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

            <div className="actions final-actions">
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
            <div className="center">
              <button className="link" onClick={restart}>Анализирай друг материал</button>
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
