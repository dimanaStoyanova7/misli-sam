"use client";

import { useEffect, useRef, useState } from "react";
import { exportDocx, parseBlocks, prepareFile } from "@/lib/client";

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const LOADING = {
  analyze: ["Разчитаме задачата…", "Проверяваме колко лесно би я решил ИИ…", "Подбираме предложения…", "Почти готово…"],
  finalize: ["Обединяваме избраните промени…", "Пишем новата задача…", "Оценяваме я отново…"],
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
      <small>Обикновено отнема 20–40 секунди.</small>
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

// ---------- Page ----------

export default function Home() {
  const [step, setStep] = useState("input");
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState("");
  const [ctx, setCtx] = useState({ grade: "", subject: "", setting: "home", grading: "mid" });
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState([]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [final, setFinal] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const topRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("misli-sam-code");
      if (saved) setCode(saved);
    } catch {}
  }, []);

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
      headers: { "Content-Type": "application/json", "x-access-code": code },
      body: JSON.stringify(payload),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      throw new Error(res.status === 413 ? "Файлът е твърде голям." : "Сървърът не отговори правилно. Опитайте отново.");
    }
    if (res.status === 401 && data.needsCode) {
      setNeedsCode(true);
      throw new Error(code ? "Кодът за достъп е грешен." : "Въведете кода за достъп.");
    }
    if (!res.ok) throw new Error(data.error || "Нещо се обърка.");
    try {
      if (code) localStorage.setItem("misli-sam-code", code);
    } catch {}
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
      setSelected(data.suggestions.map(() => true));
      setFinal(null);
      setShowOriginal(false);
      setStep("results");
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
      const data = await post("/api/finalize", {
        original: analysis.extracted_text,
        suggestions: chosen,
        context: ctx,
        scoreBefore: analysis.ai_score_before,
      });
      setFinal(data);
      setStep("final");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  function restart() {
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
    <div className="shell" ref={topRef}>
      <header className="top">
        <div className="brand">
          <span className="mark">М</span>
          <div>
            <strong>Мисли сам</strong>
            <small>задачи, които карат учениците да мислят</small>
          </div>
        </div>
        <Steps step={step} />
      </header>

      <main>
        {busy ? (
          <Loading kind={busy} />
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

            {needsCode && (
              <label className="code">
                Код за достъп
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="въведете кода" autoComplete="off" />
              </label>
            )}

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
                  <button className="link" onClick={() => setShowOriginal((s) => !s)}>
                    {showOriginal ? "Скрий разчетения текст" : "Покажи разчетения текст"}
                  </button>
                </div>
                <ScoreMeter label="Сега" value={analysis.ai_score_before} reason={analysis.score_reason} />
              </div>
              {showOriginal && <pre className="original">{analysis.extracted_text}</pre>}
            </div>

            <h2 className="section-title">
              Предложения <span>{chosenCount} от {analysis.suggestions.length} избрани</span>
            </h2>

            <div className="sugs">
              {analysis.suggestions.map((s, i) => (
                <article key={i} className={`sug ${selected[i] ? "chosen" : "off"}`}>
                  <header>
                    <div>
                      <span className={`impact impact-${s.impact === "висок" ? "high" : s.impact === "среден" ? "mid" : "low"}`}>
                        {s.impact} ефект
                      </span>
                      <h3>{s.title}</h3>
                    </div>
                    <button
                      className={`toggle ${selected[i] ? "on" : ""}`}
                      aria-pressed={!!selected[i]}
                      onClick={() => setSelected((arr) => arr.map((v, j) => (j === i ? !v : v)))}
                    >
                      {selected[i] ? "✓ Включено" : "Включи"}
                    </button>
                  </header>
                  <div className="sug-body">
                    <div className="sug-row">
                      <h4>Какво да промените</h4>
                      <p>{s.change}</p>
                    </div>
                    <div className="sug-row problem">
                      <h4>Какъв проблем решава</h4>
                      <p>{s.problem}</p>
                    </div>
                    <div className="sug-row example">
                      <h4>Как може да звучи</h4>
                      <p>{s.example}</p>
                    </div>
                  </div>
                  {s.costs?.length > 0 && (
                    <div className="costs">
                      {s.costs.map((c, j) => (
                        <span key={j}>{c}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>

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

            <div className="card doc print-area">
              <h1 className="doc-title">{final.title}</h1>
              <RichText text={final.assignment} />
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
