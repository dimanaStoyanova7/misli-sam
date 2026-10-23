"use client";

import { useState } from "react";
import { MAX_SUBJECTS, STAGES, SUBJECTS, needsSubjects } from "@/lib/subjects";

// First-time setup after creating a profile, and the "Настройки" page later.
export default function Setup({ initial, firstTime, onSaved, onCancel }) {
  const [stages, setStages] = useState(initial?.stages || []);
  const startSubjects = initial?.subjects || [];
  const [subjects, setSubjects] = useState(startSubjects.filter((s) => SUBJECTS.includes(s)));
  const [other, setOther] = useState(startSubjects.find((s) => !SUBJECTS.includes(s)) || "");
  const [otherOn, setOtherOn] = useState(Boolean(startSubjects.find((s) => !SUBJECTS.includes(s))));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const wantSubjects = needsSubjects(stages);
  const total = subjects.length + (otherOn ? 1 : 0);
  const full = total >= MAX_SUBJECTS;

  const toggleStage = (id) => setStages((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const toggleSubject = (name) =>
    setSubjects((list) => (list.includes(name) ? list.filter((x) => x !== name) : full ? list : [...list, name]));

  async function save() {
    setError("");
    const all = wantSubjects ? [...subjects, ...(otherOn && other.trim() ? [other.trim()] : [])] : [];
    if (!stages.length) return setError("Изберете поне един етап.");
    if (wantSubjects && !all.length) return setError("Изберете поне един предмет.");
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages, subjects: all }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Настройките не можаха да бъдат запазени.");
      onSaved(data.settings);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card setup">
      <h1>{firstTime ? "Какво преподавате?" : "Настройки"}</h1>
      <p className="lead">
        {firstTime
          ? "Кажете ми веднъж и няма да питам при всеки материал. Може да го промените по всяко време от „Настройки“."
          : "Етапите и предметите, които преподавате."}
      </p>

      <h2 className="sub">В кои класове?</h2>
      <p className="hint">Може да изберете повече от един етап.</p>
      <div className="stage-grid">
        {STAGES.map((s) => {
          const on = stages.includes(s.id);
          return (
            <button key={s.id} type="button" className={`stage ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggleStage(s.id)}>
              <span className="check">{on ? "✓" : ""}</span>
              <strong>{s.label}</strong>
              <small>{s.note}</small>
            </button>
          );
        })}
      </div>

      {wantSubjects && (
        <>
          <h2 className="sub">
            Кои предмети? <span className="counter">избрани {total} от {MAX_SUBJECTS}</span>
          </h2>
          <p className="hint">
            Изберете до {MAX_SUBJECTS}.{stages.includes("1-4") ? " За 1–4 клас не е нужно – там се включват всички предмети." : ""}
          </p>
          <div className="subject-grid">
            {SUBJECTS.map((name) => {
              const on = subjects.includes(name);
              return (
                <button key={name} type="button" className={`chip-btn ${on ? "on" : ""}`} aria-pressed={on} disabled={!on && full} onClick={() => toggleSubject(name)}>
                  {name}
                </button>
              );
            })}
            <button
              type="button"
              className={`chip-btn ${otherOn ? "on" : ""}`}
              aria-pressed={otherOn}
              disabled={!otherOn && full}
              onClick={() => setOtherOn((v) => !v)}
            >
              Друг…
            </button>
          </div>
          {otherOn && (
            <label className="other">
              Име на предмета
              <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="напр. Предприемачество" maxLength={60} autoFocus />
            </label>
          )}
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="actions">
        {!firstTime && (
          <button className="ghost" onClick={onCancel}>
            Отказ
          </button>
        )}
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "Запазване…" : firstTime ? "Готово" : "Запази"}
        </button>
      </div>
    </section>
  );
}
