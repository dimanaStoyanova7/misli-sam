"use client";

import { useState } from "react";
import MathText from "./MathText";
import { patternsFor } from "@/lib/patterns";

// A small cheat sheet beside the upload form: type of question → what I usually suggest.
// Each line opens to show a before/after example.
export default function Guide({ subject }) {
  const [open, setOpen] = useState(null);
  const items = patternsFor(subject);
  return (
    <section className="guide" aria-labelledby="guide-title">
      <h3 id="guide-title">Какво обикновено предлагам</h3>
      <p className="guide-lede">Според вида на въпроса. Отворете ред, за да видите пример.</p>
      <ul>
        {items.map((p) => {
          const on = open === p.id;
          return (
            <li key={p.id} className={on ? "open" : ""}>
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : p.id)}>
                <span className="guide-pattern">{p.pattern}</span>
                <span className="guide-fix">{p.fix}</span>
              </button>
              {on && (
                <div className="guide-example">
                  <p className="guide-signs">Познава се по: {p.signs}</p>
                  <p className="guide-before"><MathText text={p.before} /></p>
                  <p className="guide-after"><MathText text={p.after} /></p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="guide-foot">Съвети като „в час, на ръка“ ги пиша отделно, на жълто листче. Те не влизат в текста на материала.</p>
    </section>
  );
}
