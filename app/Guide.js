"use client";

import { useState } from "react";
import MathText from "./MathText";
import { bestExample, orderedPatterns } from "@/lib/patterns";

const short = (s) => s.replace(" и литература", "").replace(" и цивилизации", "").replace(" и икономика", "").replace(" и астрономия", "").replace(" и опазване на околната среда", "");

// A small cheat sheet beside the upload form: type of question → the usual fix.
// Each line opens to a simple before/after example, matched to the chosen subject and grade.
export default function Guide({ subject, grade }) {
  const [open, setOpen] = useState(null);
  const [shift, setShift] = useState({}); // pattern id → how many times "Друг пример" was pressed
  const items = orderedPatterns(subject);
  return (
    <section className="guide" aria-labelledby="guide-title">
      <h3 id="guide-title">Чести слаби места</h3>
      <p className="guide-lede">Видът на въпроса подсказва какво да се промени. Отворете ред за пример.</p>
      <ul>
        {items.map((p) => {
          const on = open === p.id;
          const n = p.examples.length;
          const ex = p.examples[(bestExample(p, subject, grade) + (shift[p.id] || 0)) % n];
          return (
            <li key={p.id} className={on ? "open" : ""}>
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : p.id)}>
                <span className="guide-pattern">{p.pattern}</span>
                <span className="guide-fix">{p.fix}</span>
              </button>
              {on && (
                <div className="guide-example">
                  <p className="guide-signs">Познава се по: {p.signs}</p>
                  <p className="guide-where">
                    {short(ex.subject)}, {ex.grade} клас
                  </p>
                  <p className="guide-before"><MathText text={ex.before} /></p>
                  <p className="guide-after"><MathText text={ex.after} /></p>
                  {n > 1 && (
                    <button type="button" className="link guide-more" onClick={() => setShift({ ...shift, [p.id]: (shift[p.id] || 0) + 1 })}>
                      Друг пример
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="guide-foot">Съвети като „в час, на ръка“ се показват отделно, на жълто листче, и не влизат в текста на материала.</p>
    </section>
  );
}
