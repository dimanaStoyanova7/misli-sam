"use client";

import Logo from "./Logo";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  analyze: ["Чета материала…", "Подчертавам слабите места…", "Пиша бележките в полето…", "Още малко…"],
  finalize: ["Преписвам материала начисто…", "Вписвам избраните промени…", "Проверявам го още веднъж…"],
  open: ["Отварям материала…"],
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

// The material's one title, edited in place like a Google Docs title:
// click it and type; Enter or clicking away saves, Esc puts the old title back.
function EditableTitle({ title, assignmentId, onRenamed }) {
  const [value, setValue] = useState(title);
  const [status, setStatus] = useState(""); // "", "saving", "saved", or an error message
  const ref = useRef(null);
  const mirror = useRef(null);
  const cancelled = useRef(false);

  useEffect(() => setValue(title), [title]);

  // Size the field to the title (like a document title): as wide as the text,
  // wrapping onto more lines only when it doesn't fit.
  useLayoutEffect(() => {
    const el = ref.current;
    const m = mirror.current;
    if (!el || !m) return;
    const max = el.parentElement.parentElement.clientWidth;
    el.style.width = `${Math.min(max, m.offsetWidth + 22)}px`;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  async function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = value.trim().replace(/\s+/g, " ");
    if (!next) {
      setValue(title);
      setStatus("Заглавието не може да е празно – върнах предишното.");
      return;
    }
    if (next === title) {
      setValue(title);
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не успях да запазя заглавието.");
      onRenamed(data.title);
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "" : s)), 1800);
    } catch (e) {
      setValue(title);
      setStatus(e.message);
    }
  }

  if (!assignmentId) return <h1>{title}</h1>;
  return (
    <div className="title-field">
      <span ref={mirror} className="title-input title-mirror" aria-hidden="true">
        {value || " "}
      </span>
      <textarea
        ref={ref}
        className="title-input"
        rows={1}
        value={value}
        maxLength={160}
        spellCheck={false}
        aria-label="Заглавие на материала (натиснете, за да го промените)"
        title="Натиснете, за да промените заглавието"
        onChange={(e) => {
          setValue(e.target.value.replace(/\n/g, " "));
          if (status && status !== "saving") setStatus("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancelled.current = true;
            setValue(title);
            e.currentTarget.blur();
          }
        }}
        onBlur={commit}
      />
      {status === "saving" && <span className="title-status">запазвам…</span>}
      {status === "saved" && <span className="title-status ok">запазено</span>}
      {status && status !== "saving" && status !== "saved" && <p className="title-status err">{status}</p>}
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
      {kind !== "open" && <small>Обикновено отнема около половин минута.</small>}
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
        <h1>Здравейте</h1>
        <p className="lede">Въведете кода на училището си. Ще ви го даде директорът или администраторът.</p>
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
      </section>
    );
  }

  return (
    <section className="card login">
      <button className="link back" onClick={() => { setStage("code"); setError(""); setInfo(""); }}>Друго училище</button>
      <h1>{school}</h1>
      <p className="lede">
        {mode === "login"
          ? "Влезте с името и ПИН кода си."
          : "Създайте си профил. В него ще пазя материалите, които прегледаме заедно. Изберете ПИН от 4 до 6 цифри."}
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
  const [mode, setMode] = useState("text");
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
  const [compareTab, setCompareTab] = useState("after"); // which version the final page shows
  const [copied, setCopied] = useState(false);
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

  // Plain-text copy of the new version, ready to paste into a document or Shkolo.
  async function copyHandout() {
    const body = parseBlocks(final.assignment)
      .map((b) => (b.type === "list" ? b.items.map((x) => `– ${x}`).join("\n") : b.text))
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(`${final.title}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не успях да копирам текста. Изтеглете го за Word.");
    }
  }

  function newAssignment() {
    restart();
    setView("work");
  }

  function restart() {
    setAssignmentId(null);
    setMode("text");
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
            <span className="who" title={`${me.teacher || ""}, ${me.school || ""}`}>
              <span className="avatar">{initials(me.teacher)}</span>
              <span className="who-text">
                <strong>{me.teacher}</strong>
                <small>
                  {me.school}
                  {me.limit != null && me.used != null ? `, ${me.used} от ${me.limit} анализа` : ""}
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
          <section className="handover">
            <div
              className="paper"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  pickFile(f);
                  setMode("file");
                }
              }}
            >
              <h1>Покажете ми материала и ще го прегледам.</h1>
              <p className="lede">
                Поставете текста по-долу или качете снимка или PDF. Ще подчертая местата, които ученик лесно би дал на ИИ, и ще ви предложа как да ги пренапишете.
              </p>

              {mode === "file" && file ? (
                <div className="file-row">
                  <span className="file-chip">
                    {preview ? <img src={preview} alt="" /> : null}
                    <span>
                      {file.name} <span className="hint">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </span>
                  </span>
                  <button
                    className="link"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setMode("text");
                    }}
                  >
                    Махни файла
                  </button>
                </div>
              ) : (
                <textarea
                  className="paste"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setMode("text");
                  }}
                  placeholder="Поставете текста тук – задание, тест, работен лист…"
                  aria-label="Текстът на материала"
                />
              )}

              <div className="file-row">
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,image/*,.heic,.heif"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      pickFile(f);
                      setMode("file");
                    }
                  }}
                />
                {!(mode === "file" && file) && (
                  <span>
                    Или{" "}
                    <button className="link" onClick={() => inputRef.current?.click()}>
                      качете снимка или PDF
                    </button>{" "}
                    – снимките от телефона ги смалявам сам, PDF до 3 MB. Може и да го пуснете върху листа.
                  </span>
                )}
              </div>
              {dragOver && <div className="drag-hint">Пуснете файла тук</div>}

              {error && <p className="error" role="alert">{error}</p>}

              <div className="handover-actions">
                <button className="primary big" onClick={analyze}>
                  Прегледай материала
                </button>
                <p className="privacy">Без имена на ученици, моля.</p>
              </div>
            </div>

            <aside className="handover-side">
              <div className="sticky">
                <h3>За кого е?</h3>
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
                {subjects.length === 1 && (
                  <p className="ctx-note">
                    {subjects[0]}.{" "}
                    <button className="link" onClick={() => setView("settings")}>Промени</button>
                  </p>
                )}
                {grades.length > 0 && (
                  <div className="ctx-group">
                    <span className="ctx-label">
                      Клас <span className="optional">(ако искате)</span>
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
            </aside>
          </section>
        ) : step === "results" && analysis ? (
          <section>
            <div className="review-head">
              <div>
                {(ctx.grade || ctx.subject) && <p className="context">{[gradeLabel(ctx.grade), ctx.subject].filter(Boolean).join(", ")}</p>}
                <EditableTitle
                  title={analysis.title || "Вашият материал"}
                  assignmentId={assignmentId}
                  onRenamed={(t) => {
                    setAnalysis((a) => ({ ...a, title: t }));
                    setFinal((f) => (f ? { ...f, title: t } : f));
                  }}
                />
                <p className="hint" style={{ marginTop: 8 }}>
                  Червеното е там, където ученик лесно би дал работата на ИИ. Отворете бележка, за да видите какво предлагам.
                </p>
              </div>
            </div>

            {/* on narrow screens the sticky note sits above the sheet; on wide screens it's in the margin */}
            <div className="tips-above">
              <Tips tips={analysis.delivery_tips || []} />
            </div>

            <Board
              parts={analysis.parts}
              suggestions={analysis.suggestions}
              selected={selected}
              verdict={analysis.score_reason}
              score={analysis.ai_score_before}
              tips={analysis.delivery_tips || []}
              onToggle={(i) => setSelected((arr) => arr.map((v, j) => (j === i ? !v : v)))}
            />

            {error && <p className="error" role="alert">{error}</p>}

            <div className="dock">
              <div className="dock-inner">
                <span className="dock-text">
                  В новата версия: <b>{chosenCount} от {analysis.suggestions.length}</b> бележки
                </span>
                <button className="quiet-btn" onClick={restart}>Нов материал</button>
                <button className="primary" onClick={finalize} disabled={!chosenCount}>
                  Препиши го начисто
                </button>
              </div>
            </div>
          </section>
        ) : step === "final" && final ? (
          <section>
            <div className="handout-head">
              <div>
                <p className="context">Препис начисто. Пазя го в „Моите материали“.</p>
                <EditableTitle
                  title={final.title}
                  assignmentId={assignmentId}
                  onRenamed={(t) => {
                    setAnalysis((a) => ({ ...a, title: t }));
                    setFinal((f) => ({ ...f, title: t }));
                  }}
                />
                <p className="lede">{final.score_reason}</p>
              </div>
              <div className="score-change" aria-label={`Колко лесно е за ИИ: преди ${analysis.ai_score_before}, сега ${final.ai_score_after} от 10`}>
                <span className="was">{analysis.ai_score_before}</span>
                <span className="arrow" aria-hidden="true">→</span>
                <span className="now">{final.ai_score_after}</span>
                <small>колко лесно е за ИИ, от 10</small>
              </div>
            </div>

            <div className="tabs compare-tabs" role="tablist">
              <button role="tab" aria-selected={compareTab === "after"} className={compareTab === "after" ? "on" : ""} onClick={() => setCompareTab("after")}>
                Новата версия
              </button>
              <button role="tab" aria-selected={compareTab === "before"} className={compareTab === "before" ? "on" : ""} onClick={() => setCompareTab("before")}>
                Оригиналът
              </button>
            </div>

            <div className={`versions show-${compareTab}`}>
              <div className="version before">
                <div className="paper handout">
                  {analysis.parts.map((p) => (
                    <div key={p.id} className="old-part">
                      <p>{p.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="version after">
                <div className="paper handout print-area">
                  <h2 className="doc-title">{final.title}</h2>
                  <RichText text={final.assignment} />
                </div>
              </div>
            </div>

            <div className="teacher-notes">
              <h2>Само за вас</h2>
              <RichText text={final.teacher_notes} />
            </div>

            {error && <p className="error" role="alert">{error}</p>}

            <div className="actions final-actions">
              <button className="ghost" onClick={() => setStep("results")}>Обратно към бележките</button>
              <span className="spacer" />
              {copied && <span className="copied">копирано</span>}
              <button className="ghost" onClick={copyHandout}>Копирай текста</button>
              <button className="ghost" onClick={() => window.print()}>Печат или PDF</button>
              <button className="primary" onClick={() => exportDocx(final).catch(() => setError("Word файлът не можа да бъде създаден."))}>
                Изтегли за Word
              </button>
            </div>
            <p className="final-foot">
              За PDF изберете „Запази като PDF“ в прозореца за печат.{" "}
              <button className="link" onClick={restart}>Прегледай друг материал</button>
            </p>
          </section>
        ) : null}
      </main>

      <footer className="foot">
        Предложенията са генерирани от ИИ. Прегледайте ги преди да ги използвате – вие познавате класа си най-добре.
      </footer>
    </div>
  );
}
