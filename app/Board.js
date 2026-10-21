"use client";

import { useMemo, useRef, useState } from "react";

// Shows the assignment split into its parts, with each suggestion placed right next to
// the part it's about (like comments in a document). General suggestions go on top.

const IMPACT = { висок: "high", среден: "mid", нисък: "low" };

function SuggestionCard({ s, num, on, onToggle, otherTargets, onJump, onHover, active }) {
  return (
    <article
      id={`sug-${num}`}
      className={`sug ${on ? "chosen" : "off"} ${active ? "active" : ""}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <header>
        <div className="sug-title">
          <span className="num">{num}</span>
          <h3>{s.title}</h3>
        </div>
        <button className={`toggle ${on ? "on" : ""}`} aria-pressed={on} onClick={onToggle}>
          {on ? "✓ Включено" : "Включи"}
        </button>
      </header>

      <div className="sug-meta">
        <span className={`impact impact-${IMPACT[s.impact] || "low"}`}>{s.impact ? `${s.impact[0].toUpperCase()}${s.impact.slice(1)} ефект` : "Ефект"}</span>
        {s.costs?.[0] && (
          <span className="meta-item cost" title="Допълнителни усилия за вас">
            ⏱ За вас: {s.costs[0].replace(/^\+\s*/, "")}
          </span>
        )}
        {s.needs_ai_sample && <span className="meta-item ready">✓ Отговорът от ИИ се генерира автоматично</span>}
        {otherTargets.length > 0 && (
          <span className="meta-item also">
            също за{" "}
            {otherTargets.map((p) => (
              <button key={p.id} className="chip" onClick={() => onJump(p.id)}>
                {p.label} ↓
              </button>
            ))}
          </span>
        )}
      </div>

      <p className="why">
        <b>Защо:</b> {s.problem}
      </p>
      {s.example && (
        <div className="example">
          <span className="example-label">Как може да звучи</span>
          <p>„{s.example.replace(/^[„"“]+|[“"”]+$/g, "")}“</p>
        </div>
      )}
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

  // Order: general suggestions first, then by the first part they point to.
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
  const refsByPart = {}; // part id -> suggestions that live elsewhere but also point here
  for (const it of ordered) {
    if (it.home === null) continue;
    (byHome[it.home] ||= []).push(it);
    for (const t of it.targets.slice(1)) (refsByPart[t] ||= []).push(it);
  }

  const highlightedParts = new Set(hoverSug !== null ? ordered.find((it) => it.i === hoverSug)?.targets || [] : []);
  if (flash) highlightedParts.add(flash);

  function jumpTo(elementId, partId) {
    document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (partId) {
      setFlash(partId);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1600);
    }
  }

  const card = (it, homeId) => (
    <SuggestionCard
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
          <div className="part general">
            <div className="part-label">Целият материал</div>
            <p className="part-note">Тези предложения засягат материала като цяло, а не конкретен въпрос.</p>
          </div>
          <div className="notes-col">{general.map((it) => card(it, null))}</div>
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
              className={`part ${empty ? "quiet" : "linked"} ${highlightedParts.has(p.id) ? "lit" : ""}`}
              onMouseEnter={() => !empty && setHoverPart(p.id)}
              onMouseLeave={() => setHoverPart(null)}
            >
              <div className="part-head">
                <span className="part-label">{p.label}</span>
                {!empty && (
                  <span className="markers">
                    {linked.map((it) => (
                      <button
                        key={it.i}
                        className={`marker ${selected[it.i] ? "" : "marker-off"}`}
                        title={it.s.title}
                        onClick={() => jumpTo(`sug-${it.num}`)}
                      >
                        {it.num}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              <p className="part-text">{p.text}</p>
            </div>

            <div className="notes-col">
              {home.map((it) => card(it, p.id))}
              {refs.map((it) => (
                <button key={`ref-${it.i}`} className="ref" onClick={() => jumpTo(`sug-${it.num}`)}>
                  <span className="num small">{it.num}</span>
                  <span>
                    {it.s.title}
                    <small> · описано при {partById[it.home]?.label}</small>
                  </span>
                  <span className="ref-arrow">↑</span>
                </button>
              ))}
              {empty && <p className="no-sug">Без предложения за тази част.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
