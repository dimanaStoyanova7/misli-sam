"use client";

import katex from "katex";
import { splitMath } from "@/lib/math";

// Renders text with typeset formulas ($…$ or bare notation like C_6^4).
// KaTeX escapes its input and never runs scripts, so the HTML is safe to insert.
export default function MathText({ text }) {
  if (!text) return null;
  const pieces = splitMath(String(text));
  if (pieces.length === 1 && pieces[0].type === "text") return text;
  return pieces.map((p, i) =>
    p.type === "text" ? (
      <span key={i}>{p.value}</span>
    ) : (
      <span
        key={i}
        className="math"
        dangerouslySetInnerHTML={{ __html: katex.renderToString(p.tex, { throwOnError: false, output: "html", strict: "ignore" }) }}
      />
    )
  );
}
