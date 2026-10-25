"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import MathText from "./MathText";
import { mathRanges, plainMath } from "@/lib/math";

// The teacher's material as a marked-up sheet of paper.
// - Weak passages are underlined in red (or bracketed in the margin when the whole part is weak).
// - Each suggestion is a handwritten note in the right margin, placed next to its passage
//   and connected to it with a thin red line. Notes never overlap: later ones are pushed down.
// - Clicking a note (or an underline) unfolds the full suggestion: why it's weak and a rewrite.
// - On narrow screens the margin disappears and notes sit right under their passage.

const IMPACT = { висок: "голям", среден: "среден", нисък: "малък" };
const NARROW = "(max-width: 960px)";
const GAP = 16;          // space between notes in the margin
const MARGIN_TOP = 24;   // first note starts no higher than this (the margin holds only notes)

function scoreTone(n) {
  if (n >= 7) return "high";
  if (n >= 4) return "mid";
  return "low";
}

function Note({ it, on, open, inline, onOpen, onToggle, onHover, otherTargets, onJump, noteRef, top }) {
  const s = it.s;
  const cost = s.costs?.[0]?.replace(/^\+\s*/, "");
  return (
    <div
      id={`${inline ? "inote" : "note"}-${it.num}`}
      ref={noteRef}
      className={`note ${inline ? "inline" : ""} ${on ? "" : "off"} ${open ? "open" : ""}`}
      style={inline ? undefined : { top }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <button className="note-face" aria-expanded={open} onClick={onOpen}>
        <span className={`circ ${on ? "" : "off"}`}>{it.num}</span>
        <span className="note-mark">
          <span><MathText text={s.margin_note || s.title} /></span>
          {!open && <small><MathText text={s.title} /></small>}
        </span>
      </button>

      {open && (
        <div className="note-slip">
          <p className="slip-title"><MathText text={s.title} /></p>
          <span className="slip-k">Защо е слабо</span>
          <p><MathText text={s.problem} /></p>
          {s.rewrite && (
            <>
              <span className="slip-k">Предлагам така</span>
              <p className="slip-rewrite"><MathText text={s.rewrite} /></p>
            </>
          )}
          <div className="slip-meta">
            <span>Ефект: {IMPACT[s.impact] || "среден"}</span>
            {cost && <span>Допълнително за вас: {cost}</span>}
            {s.needs_ai_sample && <span className="slip-auto">Отговора от ИИ ще го напиша в новата версия.</span>}
            {otherTargets.length > 0 && (
              <span>
                Отнася се и за{" "}
                {otherTargets.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    <button onClick={() => onJump(p.id)}>{p.label}</button>
                  </span>
                ))}
              </span>
            )}
          </div>
          <button className={`include ${on ? "on" : ""}`} role="checkbox" aria-checked={on} onClick={onToggle}>
            <span className="box" aria-hidden="true" />
            Включи в новата версия
          </button>
        </div>
      )}
    </div>
  );
}

// Splits a passage into plain text and underlined weak spots.
// An underline that starts or ends inside a formula is widened to the whole formula.
function segmentsFor(text, items) {
  const ranges = mathRanges(text);
  const found = [];
  for (const it of items) {
    const q = it.s.quote;
    if (!q) continue;
    let at = text.indexOf(q);
    if (at < 0) continue;
    let end = at + q.length;
    for (const [a, b] of ranges) {
      if (a < at && at < b) at = a;
      if (a < end && end < b) end = b;
    }
    found.push({ at, end, it });
  }
  found.sort((a, b) => a.at - b.at);
  const out = [];
  let pos = 0;
  for (const f of found) {
    if (f.at < pos) continue; // overlapping quotes: keep the first
    if (f.at > pos) out.push(text.slice(pos, f.at));
    out.push(f);
    pos = f.end;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

export default function Board({ parts, suggestions, selected, onToggle, verdict, score, tips = [] }) {
  const [openId, setOpenId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [layout, setLayout] = useState({ tops: {}, paths: {}, height: 0 });
  const sheetRef = useRef(null);
  const marginRef = useRef(null);
  const verdictRef = useRef(null);
  const textRef = useRef(null);
  const tipsRef = useRef(null);
  const anchorRefs = useRef({});
  const noteRefs = useRef({});
  const flashTimer = useRef(null);
  const frame = useRef(0);

  const partIndex = useMemo(() => Object.fromEntries(parts.map((p, i) => [p.id, i])), [parts]);
  const partById = useMemo(() => Object.fromEntries(parts.map((p) => [p.id, p])), [parts]);

  // Whole-material notes first, then in the order of the passages they mark.
  const ordered = useMemo(() => {
    const items = suggestions.map((s, i) => {
      const targets = [...(s.targets || [])].sort((a, b) => partIndex[a] - partIndex[b]);
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
  const linkedByPart = {};
  for (const it of ordered) {
    if (it.home !== null) (byHome[it.home] ||= []).push(it);
    for (const t of it.targets) (linkedByPart[t] ||= []).push(it);
  }

  const activeId = hoverId ?? openId;
  const active = ordered.find((it) => it.i === activeId);
  const litParts = new Set(active ? (active.s.quote ? active.targets.slice(1) : active.targets) : []);
  if (flash) litParts.add(flash);

  // ---------- Margin layout: place each note beside its anchor, without overlaps ----------
  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      const margin = marginRef.current;
      if (!sheet || !margin || margin.offsetWidth === 0) return;
      const sRect = sheet.getBoundingClientRect();
      const mRect = margin.getBoundingClientRect();
      // Right edge of the writing: connectors run along the line to here, then drop in the gutter.
      const tRect = textRef.current.getBoundingClientRect();
      const gutterX = tRect.right - sRect.left - 18;
      // The sticky note at the top of the margin: notes start below it.
      const tipsBottom = tipsRef.current ? tipsRef.current.getBoundingClientRect().bottom - mRect.top + 10 : 0;
      const anchors = ordered
        .map((it) => {
          const el = it.home === null ? verdictRef.current : anchorRefs.current[it.i];
          if (!el) return null;
          const rects = el.getClientRects();
          const box = el.getBoundingClientRect();
          const first = rects[0] || box;
          const last = rects[rects.length - 1] || first;
          const isQuote = el.tagName === "MARK";
          return {
            it,
            top: first.top - mRect.top,
            // underline: start just below the end of the underlined words, in the space between ruled lines
            // whole passage / whole material: start at the top right of the block
            from: isQuote
              ? { x: last.right - sRect.left + 2, y: last.bottom - sRect.top + 4 }
              : { x: Math.min(box.right - sRect.left + 6, gutterX), y: first.top - sRect.top + 16 },
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.top - b.top || a.it.num - b.it.num);

      const tops = {};
      const paths = {};
      let bottom = Math.max(MARGIN_TOP, tipsBottom) - GAP;
      for (const a of anchors) {
        const h = noteRefs.current[a.it.i]?.offsetHeight || 60;
        const y = Math.max(a.top - 2, bottom + GAP);
        tops[a.it.i] = Math.round(y);
        bottom = y + h;
        const x2 = mRect.left - sRect.left + 18;
        const y2 = mRect.top - sRect.top + y + 15;
        const { x: x1, y: y1 } = a.from;
        const xg = Math.max(x1 + 4, gutterX);
        const f = (n) => n.toFixed(1);
        // along the line, then a soft curve through the gutter into the note
        paths[a.it.i] = `M ${f(x1)} ${f(y1)} L ${f(xg)} ${f(y1)} C ${f(xg + 26)} ${f(y1)}, ${f(x2 - 26)} ${f(y2)}, ${f(x2)} ${f(y2)}`;
      }
      const next = { tops, paths, height: Math.round(bottom + 48) };
      setLayout((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    });
  }, [ordered]);

  useLayoutEffect(() => {
    measure();
  }, [measure, openId, selected]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (sheetRef.current) ro.observe(sheetRef.current);
    Object.values(noteRefs.current).forEach((el) => el && ro.observe(el));
    window.addEventListener("resize", measure);
    document.fonts?.ready?.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame.current);
    };
  }, [measure, openId]);

  function openNote(i, fromText) {
    setOpenId((cur) => (cur === i && !fromText ? null : i));
    if (fromText) {
      const it = ordered.find((x) => x.i === i);
      const narrow = window.matchMedia(NARROW).matches;
      setTimeout(() => document.getElementById(`${narrow ? "inote" : "note"}-${it.num}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 40);
    }
  }

  function jumpToPart(id) {
    document.getElementById(`part-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1600);
  }

  const noteProps = (it, inline) => ({
    it,
    inline,
    on: !!selected[it.i],
    open: openId === it.i,
    onOpen: () => openNote(it.i, false),
    onToggle: () => onToggle(it.i),
    onHover: (h) => setHoverId(h ? it.i : null),
    otherTargets: it.targets.slice(1).map((id) => partById[id]).filter(Boolean),
    onJump: jumpToPart,
    noteRef: inline ? undefined : (el) => (noteRefs.current[it.i] = el),
    top: layout.tops[it.i] ?? 0,
  });

  return (
    <div className="paper sheet" ref={sheetRef}>
      <div className="sheet-grid">
        <div className="sheet-text" ref={textRef}>
          <div className="verdict" ref={verdictRef}>
            <p><MathText text={verdict} /></p>
            <div className={`grade ${scoreTone(score) === "low" ? "low" : ""}`} aria-label={`Колко лесно е за ИИ: ${score} от 10`}>
              <span>
                <b>{score}</b>
                <small>лесно за ИИ</small>
              </span>
            </div>
          </div>
          {general.length > 0 && (
            <div className="inline-notes">
              {general.map((it) => (
                <Note key={`i-${it.i}`} {...noteProps(it, true)} />
              ))}
            </div>
          )}

          {parts.map((p) => {
            const home = byHome[p.id] || [];
            const linked = linkedByPart[p.id] || [];
            const wholePart = home.filter((it) => !it.s.quote || !p.text.includes(it.s.quote));
            const bracketed = wholePart.length > 0;
            const bracketOn = wholePart.some((it) => selected[it.i]);
            const segs = segmentsFor(p.text, home);
            return (
              <div
                key={p.id}
                id={`part-${p.id}`}
                className={`passage ${bracketed ? "bracketed" : ""} ${bracketed && !bracketOn ? "off" : ""} ${litParts.has(p.id) ? "lit" : ""}`}
                ref={(el) => wholePart.forEach((it) => (anchorRefs.current[it.i] = el))}
              >
                {linked.length > 0 && (
                  <span className="margin-nums">
                    {linked.map((it) => (
                      <button key={it.i} className={`circ ${selected[it.i] ? "" : "off"}`} title={plainMath(it.s.title)} onClick={() => openNote(it.i, true)}>
                        {it.num}
                      </button>
                    ))}
                  </span>
                )}
                <span className="passage-body">
                  {segs.map((seg, k) =>
                    typeof seg === "string" ? (
                      <span key={k}><MathText text={seg} /></span>
                    ) : (
                      <mark
                        key={k}
                        ref={(el) => (anchorRefs.current[seg.it.i] = el)}
                        className={`flag ${selected[seg.it.i] ? "" : "off"} ${activeId === seg.it.i ? "lit" : ""}`}
                        role="button"
                        tabIndex={0}
                        title={plainMath(seg.it.s.margin_note || seg.it.s.title)}
                        onClick={() => openNote(seg.it.i, true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openNote(seg.it.i, true);
                          }
                        }}
                        onMouseEnter={() => setHoverId(seg.it.i)}
                        onMouseLeave={() => setHoverId(null)}
                      >
                        <MathText text={p.text.slice(seg.at, seg.end)} />
                      </mark>
                    )
                  )}
                </span>
                {home.length > 0 && (
                  <div className="inline-notes">
                    {home.map((it) => (
                      <Note key={`i-${it.i}`} {...noteProps(it, true)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sheet-margin" ref={marginRef} style={{ minHeight: layout.height || undefined }}>
          {tips.length > 0 && (
            <div className="margin-tip" ref={tipsRef}>
              <Tips tips={tips} />
            </div>
          )}
          {ordered.map((it) => (
            <Note key={`m-${it.i}`} {...noteProps(it, false)} />
          ))}
        </div>
      </div>

      <svg className="connectors" aria-hidden="true">
        {ordered.map((it) =>
          layout.paths[it.i] ? <path key={it.i} d={layout.paths[it.i]} className={activeId === it.i ? "on" : ""} /> : null
        )}
      </svg>
    </div>
  );
}

// Advice on how to run the work (in class, by hand…): one sticky note, never part of the new version.
export function Tips({ tips = [] }) {
  if (!tips.length) return null;
  return (
    <aside className="sticky review-tip" aria-label="Съвет за провеждане">
      <h3>Преди да го дадете на учениците</h3>
      {tips.map((t, i) => (
        <p key={i}>
          <b><MathText text={t.title.replace(/[.!\s]+$/, "")} />.</b> <MathText text={t.why} />
        </p>
      ))}
    </aside>
  );
}
