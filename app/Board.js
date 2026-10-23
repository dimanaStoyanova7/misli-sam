"use client";

import { useMemo, useRef, useState } from "react";

// The material is shown as one continuous sheet of paper, split into its parts.
// Suggestions sit in the margin next to the part they change, like a teacher's notes,
// and footnote numbers in the text point to them. Notes for the whole material sit
// beside the sheet's title.

const IMPACT_DOTS = { висок: 3, среден: 2, нисък: 1 };
const IMPACT_WORD = { висок: "Голям ефект", среден: "Среден ефект", нисък: "Малък ефект" };

function Dots({ n }) {
  return (
    <span className="dots" aria-hidden="true">
      {"●".repeat(n)}
      <i>{"●".repeat(3 - n)}</i>
    </span>
  );
}

const Tick = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);

function Note({ s, num, on, onToggle, otherTargets, onJump, onHover, active }) {
  const dots = IMPACT_DOTS[s.impact] || 1;
  const cost = s.costs?.[0]?.replace(/^\+\s*/, "");
  return (
    <article
      id={`sug-${num}`}
      className={`note ${on ? "chosen" : "off"} ${active ? "active" : ""}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="note-head">
        <span className="note-num">{num}</span>
        <h3>{s.title}</h3>
        <button
          className={`check ${on ? "on" : ""}`}
          role="checkbox"
          aria-checked={on}
          aria-label={on ? `Включено в новата версия: ${s.title}` : `Включи в новата версия: ${s.title}`}
          title={on ? "Включено в новата версия" : "Включи в новата версия"}
          onClick={onToggle}
          onFocus={() => onHover(true)}
          onBlur={() => onHover(false)}
        >
          <Tick />
        </button>
      </div>

      <div className="note-meta">
        <span>
          {IMPACT_WORD[s.impact] || "Ефект"}
          <Dots n={dots} />
        </span>
        {cost && <span className="cost">За вас: {cost}</span>}
        {otherTargets.length > 0 && (
          <span className="also">
            Също за{" "}
            {otherTargets.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <button onClick={() => onJump(p.id)}>{p.label}</button>
              </span>
            ))}
          </span>
        )}
      </div>

      <p className="note-why">
        <b>Защо.</b> {s.problem}
      </p>
      {s.example && <p className="note-example">„{s.example.replace(/^[„"“]+|[“"”]+$/g, "")}“</p>}
      {s.needs_ai_sample && <p className="note-auto">Отговорът от ИИ ще бъде написан в новата версия.</p>}
    </article>
  );
}

export default function Board({ parts, suggestions, selected, onToggle }) {
  const [hoverSug, setHoverSug] = useState(null); // index into suggestions
  const [hoverPart, setHoverPart] = useState(null); // part id
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(null);

  const partIndex = useMemo(() => Object.fromEntries(parts.map((p, i) => [p.id, i])), [parts]);
  const partById = useMemo(() => Object.fromEntries(parts.map((p) => [p.id, p])), [parts]);

  // Order: whole-material notes first, then by the first part they point to.
  const ordered = useMemo(() => {
    const items = suggestions.map((s, i) => {
      const targets = [...s.targets].sort((a, b) => partIndex[a] - partIndex[b]);
      return { s, i, targets, home: targets[0] ?? null };
    });
    items.sort((a, b) => {
      const pa = a.home === null ? -1 : partIndex[a.home];
      const pb = b.home === null ? -1 : partIndex[b.home];
      return pa - pb || a.i - b.i;
    });
    return items.map((it, k) => ({ ...it, num: k + 1 }));
  }, [suggestions, partIndex]);

  const general = ordered.filter((it) => it.home === null);
  const byHome = {};
  const refsByPart = {}; // part id -> notes that live at an earlier part but also apply here
  for (const it of ordered) {
    if (it.home === null) continue;
    (byHome[it.home] ||= []).push(it);
    for (const t of it.targets.slice(1)) (refsByPart[t] ||= []).push(it);
  }

  const lit = new Set(hoverSug !== null ? ordered.find((it) => it.i === hoverSug)?.targets || [] : []);
  if (flash) lit.add(flash);

  function jumpTo(elementId, partId) {
    document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (partId) {
      setFlash(partId);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1600);
    }
  }

  const note = (it) => (
    <Note
      key={it.i}
      s={it.s}
      num={it.num}
      on={!!selected[it.i]}
      onToggle={() => onToggle(it.i)}
      otherTargets={it.targets.slice(1).map((id) => partById[id]).filter(Boolean)}
      onJump={(id) => jumpTo(`part-${id}`, id)}
      onHover={(h) => setHoverSug(h ? it.i : null)}
      active={hoverPart !== null && it.targets.includes(hoverPart)}
    />
  );

  return (
    <div className="board">
      {general.length > 0 && (
        <div className="row">
          <div className="sheet-cell">
            <div className="part-body">
              <div className="part-label">Целият материал</div>
              <p className="sheet-sub">Бележките вдясно се отнасят за материала като цяло, а не за отделна задача.</p>
            </div>
          </div>
          <div className="notes-col">{general.map(note)}</div>
        </div>
      )}

      {parts.map((p) => {
        const home = byHome[p.id] || [];
        const refs = refsByPart[p.id] || [];
        const linked = [...home, ...refs].sort((a, b) => a.num - b.num);
        const empty = linked.length === 0;
        return (
          <div key={p.id} className={`row ${empty ? "row-empty" : ""}`}>
            <div
              id={`part-${p.id}`}
              className={`sheet-cell ${lit.has(p.id) ? "lit" : ""}`}
              onMouseEnter={() => !empty && setHoverPart(p.id)}
              onMouseLeave={() => setHoverPart(null)}
            >
              <div className="part-body">
              <div className="part-label">{p.label}</div>
              <p className={`part-text ${empty ? "quiet" : ""}`}>
                {p.text}
                {!empty && (
                  <span className="fn-refs">
                    {linked.map((it, k) => (
                      <button
                        key={it.i}
                        className={`fn ${selected[it.i] ? "" : "off"}`}
                        title={it.s.title}
                        aria-label={`Бележка ${it.num}: ${it.s.title}`}
                        onClick={() => jumpTo(`sug-${it.num}`)}
                      >
                        {k > 0 ? `,${it.num}` : it.num}
                      </button>
                    ))}
                  </span>
                )}
              </p>
              </div>
            </div>

            <div className="notes-col">
              {home.map(note)}
              {refs.map((it) => (
                <button key={`ref-${it.i}`} className="note-ref" onClick={() => jumpTo(`sug-${it.num}`)}>
                  <b>{it.num}</b>
                  <span>
                    {it.s.title}, описано при {partById[it.home]?.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Advice on how to run the work (in class, by hand…). Not a suggestion: no checkbox,
// and it never goes into the new version.
export function Tips({ tips = [] }) {
  if (!tips.length) return null;
  return (
    <aside className="tips" aria-label="Съвет за провеждане">
      <h3>
        {tips.length > 1 ? "Съвети за провеждане" : "Съвет за провеждане"}
        <small>не променя текста на материала</small>
      </h3>
      <ul>
        {tips.map((t, i) => (
          <li key={i}>
            <strong>{t.title.replace(/[.!\s]+$/, "")}.</strong> {t.why}
          </li>
        ))}
      </ul>
    </aside>
  );
}
