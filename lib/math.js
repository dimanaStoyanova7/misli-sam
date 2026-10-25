// Maths in teachers' materials.
//
// The AI writes formulas in LaTeX between $…$ (e.g. $C_6^4$, $\frac{3}{4}$). Older saved
// materials may contain bare notation such as C_6^4 or x^2; that is detected too.
// This file splits text into plain and maths pieces, and converts LaTeX to plain text
// or to Word runs with real subscripts and superscripts.

// $$…$$, $…$, \(…\) and bare tokens like C_6^4, V_{10}^{3}, x^2, P_4
const SCRIPT = String.raw`(?:\{[^{}]*\}|[A-Za-z0-9])`;
// Kept short and standalone, so names like my_file or links with _ are left alone.
const BARE = String.raw`(?<![A-Za-z0-9\\$/._-])[A-Za-z0-9]{1,3}(?:_${SCRIPT}{1,3}(?:\^${SCRIPT}{1,3})?|\^${SCRIPT}{1,3}(?:_${SCRIPT}{1,3})?)(?![A-Za-z0-9_^])`;
const MATH_RE = new RegExp(String.raw`\$\$([^$]+)\$\$|\$([^$\n]+)\$|\\\(([^]*?)\\\)|(${BARE})`, "g");

// -> [{ type: "text", value } | { type: "math", tex, raw }]
export function splitMath(text = "") {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(MATH_RE)) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "math", tex: (m[1] ?? m[2] ?? m[3] ?? m[4]).trim(), raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

// Character ranges [start, end) that are maths, so an underline never cuts a formula in half.
export function mathRanges(text = "") {
  return [...String(text).matchAll(MATH_RE)].map((m) => [m.index, m.index + m[0].length]);
}

const SYMBOLS = {
  cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠",
  approx: "≈", infty: "∞", pi: "π", alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", theta: "θ",
  lambda: "λ", mu: "μ", sigma: "σ", Sigma: "Σ", omega: "ω", Omega: "Ω", circ: "°", degree: "°", angle: "∠",
  perp: "⊥", parallel: "∥", in: "∈", notin: "∉", subset: "⊂", cup: "∪", cap: "∩", emptyset: "∅",
  Rightarrow: "⇒", Leftrightarrow: "⇔", to: "→", rightarrow: "→", ldots: "…", dots: "…", quad: " ", qquad: "  ",
};
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋", "(": "₍", ")": "₎", n: "ₙ", k: "ₖ", m: "ₘ", i: "ᵢ", x: "ₓ" };
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻", "(": "⁽", ")": "⁾", n: "ⁿ", k: "ᵏ", m: "ᵐ", i: "ⁱ", x: "ˣ" };

const unbrace = (s) => s.replace(/^\{|\}$/g, "");

// Replaces commands that don't need sub/superscript handling (fractions, roots, symbols).
function simplify(tex) {
  let s = tex;
  for (let i = 0; i < 4; i++) {
    s = s
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => `${/^\w+$/.test(a) ? a : `(${a})`}/${/^\w+$/.test(b) ? b : `(${b})`}`)
      .replace(/\\sqrt\[([^\]]+)\]\{([^{}]*)\}/g, (_, n, x) => `${n}√(${x})`)
      .replace(/\\sqrt\{([^{}]*)\}/g, (_, x) => (/^\w+$/.test(x) ? `√${x}` : `√(${x})`))
      .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, "$1");
  }
  return s
    .replace(/\\left|\\right/g, "")
    .replace(/\\([A-Za-z]+)/g, (m, name) => SYMBOLS[name] ?? name)
    .replace(/\\[,;!: ]/g, " ")
    .replace(/\\\\/g, " ");
}

// -> [{ text, sub?, sup? }] for Word
export function texToRuns(tex) {
  const s = simplify(tex);
  const runs = [];
  let buf = "";
  const re = /([_^])(\{[^{}]*\}|.)/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    buf += s.slice(last, m.index);
    if (buf) runs.push({ text: buf.replace(/[{}]/g, "") });
    buf = "";
    runs.push({ text: unbrace(m[2]), [m[1] === "_" ? "sub" : "sup"]: true });
    last = m.index + m[0].length;
  }
  buf += s.slice(last);
  if (buf) runs.push({ text: buf.replace(/[{}]/g, "") });
  return runs;
}

// -> plain text with Unicode sub/superscripts where they exist (for "Копирай текста")
export function texToPlain(tex) {
  return texToRuns(tex)
    .map((r) => {
      if (!r.sub && !r.sup) return r.text;
      const map = r.sub ? SUB : SUP;
      const chars = [...r.text];
      return chars.every((c) => map[c]) ? chars.map((c) => map[c]).join("") : `${r.sub ? "_" : "^"}(${r.text})`;
    })
    .join("");
}

// Whole strings: replace every formula with its plain-text form.
export function plainMath(text = "") {
  return splitMath(text)
    .map((p) => (p.type === "math" ? texToPlain(p.tex) : p.value))
    .join("");
}
