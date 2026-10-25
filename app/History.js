"use client";

import { plainMath } from "@/lib/math";
import { useEffect, useState } from "react";

const dateFmt = new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric" });

function tone(n) {
  if (n >= 7) return "high";
  if (n >= 4) return "mid";
  return "low";
}

function ScorePill({ before, after }) {
  if (before == null) return null;
  return (
    <span className="score-pill">
      <span className={`s-${tone(before)}`}>{before}</span>
      {after != null && (
        <>
          <span className="s-arrow">→</span>
          <span className={`s-${tone(after)}`}>{after}</span>
        </>
      )}
      <small>/10</small>
    </span>
  );
}

export default function History({ onOpen, onNew, onLoggedOut }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/assignments")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (d.needsLogin) return onLoggedOut(d.error);
        if (!r.ok) throw new Error(d.error || "Списъкът не можа да бъде зареден.");
        setItems(d.assignments);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(item) {
    if (!window.confirm(`Изтриване на „${item.title}“? Това не може да се отмени.`)) return;
    setError("");
    try {
      const r = await fetch(`/api/assignments/${item.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Материалът не можа да бъде изтрит.");
      setItems((list) => list.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  const q = filter.trim().toLocaleLowerCase("bg");
  const shown = (items || []).filter(
    (it) => !q || [it.title, it.context?.subject, it.context?.grade].filter(Boolean).join(" ").toLocaleLowerCase("bg").includes(q)
  );

  return (
    <section className="history">
      <div className="history-head">
        <div>
          <h1>Моите материали</h1>
          <p className="lead">Тук пазя всичко, което сме прегледали. Отворете материал, за да вземете новата версия или да изберете други бележки.</p>
        </div>
        <button className="primary" onClick={onNew}>Нов материал</button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {items === null && !error ? (
        <div className="loading"><div className="spinner" /></div>
      ) : items && items.length === 0 ? (
        <div className="card empty">
          <h2>Още нищо не сме преглеждали</h2>
          <p className="hint">Покажете ми първия си материал и той ще се появи тук.</p>
          <button className="primary" onClick={onNew}>Покажи ми материал</button>
        </div>
      ) : items ? (
        <>
          {items.length > 5 && (
            <input className="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Търсене по заглавие, предмет или клас…" />
          )}
          <ul className="history-list">
            {shown.map((it) => (
              <li key={it.id} className="history-item">
                <button className="history-open" onClick={() => onOpen(it.id)}>
                  <span className="history-title">{plainMath(it.title)}</span>
                  <span className="history-meta">
                    {[it.context?.grade, it.context?.subject, dateFmt.format(new Date(it.updated_at))].filter(Boolean).join(", ")}
                  </span>
                  <span className="history-status">
                    <ScorePill before={it.score_before} after={it.has_final ? it.score_after : null} />
                    {!it.has_final && <span className="draft">само бележки</span>}
                  </span>
                </button>
                <button className="ghost small" onClick={() => remove(it)} aria-label={`Изтрий ${it.title}`}>
                  Изтрий
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="hint center">Няма материали, които да отговарят на търсенето.</p>}
        </>
      ) : null}
    </section>
  );
}
