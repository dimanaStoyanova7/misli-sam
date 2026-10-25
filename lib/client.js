"use client";

import { splitMath, texToRuns } from "@/lib/math";

// ---------- File reading ----------

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Файлът не можа да бъде прочетен."));
    r.readAsDataURL(file);
  });
}

// Upload budget: Vercel accepts request bodies up to 4.5 MB, and base64 adds a third,
// so an image must end up at most ~3.4 MB as base64 (~2.5 MB of JPEG).
const MAX_BASE64 = 3_400_000;
const LONG_SIDE = 2400; // enough to read small print and handwriting

const isHeic = (file) => /hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

// Decodes a photo, honouring the phone's rotation (EXIF), into something drawable.
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    throw new Error(
      isHeic(file)
        ? "Тази снимка е във формат HEIC и браузърът не може да я отвори. На iPhone: Настройки → Камера → Формати → „Най-съвместим“, или я изпратете като JPG."
        : "Не успях да отворя снимката. Опитайте с JPG или PNG."
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Phone photos are often 3–12 MB. Shrink them in the browser until they fit: first lower
// the JPEG quality a little, then the dimensions, so text stays as sharp as possible.
async function compressImage(file) {
  const img = await decode(file);
  const w0 = img.width;
  const h0 = img.height;
  let scale = Math.min(1, LONG_SIDE / Math.max(w0, h0));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  for (let round = 0; round < 8; round++) {
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.75, 0.65]) {
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length - 23 <= MAX_BASE64) {
        img.close?.();
        return { data: url.slice(url.indexOf(",") + 1), mediaType: "image/jpeg" };
      }
    }
    scale *= 0.8;
  }
  img.close?.();
  throw new Error("Снимката е твърде голяма дори след смаляване. Опитайте да снимате само листа.");
}

export async function prepareFile(file) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error("PDF файлът е над 3 MB. Изпратете само страниците със задачата, или ги снимайте с телефона – снимките смалявам сам.");
    }
    const url = await readAsDataURL(file);
    return { kind: "pdf", data: url.split(",")[1], mediaType: "application/pdf" };
  }
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|hei[cf])$/i.test(file.name)) {
    const { data, mediaType } = await compressImage(file);
    return { kind: "image", data, mediaType };
  }
  throw new Error("Мога да прочета снимка (JPG, PNG, WEBP) или PDF.");
}

// ---------- Tiny formatter (## headings, - bullets, paragraphs) ----------

export function parseBlocks(text = "") {
  const blocks = [];
  let list = null;
  for (const raw of text.replace(/\*\*/g, "").split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) {
      if (!list) {
        list = { type: "list", items: [] };
        blocks.push(list);
      }
      list.items.push(bullet[1]);
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    const h = line.match(/^#{1,3}\s+(.*)$/);
    blocks.push(h ? { type: "heading", text: h[1] } : { type: "para", text: line.trim() });
  }
  return blocks;
}

// ---------- Word export ----------

export async function exportDocx({ title, assignment }) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  // Formulas become real subscripts and superscripts in Word (C₆⁴ rather than C_6^4).
  const runs = (text) =>
    splitMath(text).flatMap((p) =>
      p.type === "text"
        ? [new TextRun({ text: p.value })]
        : texToRuns(p.tex).map((r) => new TextRun({ text: r.text, subScript: !!r.sub, superScript: !!r.sup }))
    );
  const children = [new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 240 }, children: runs(title) })];
  for (const b of parseBlocks(assignment)) {
    if (b.type === "heading") {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: runs(b.text) }));
    } else if (b.type === "list") {
      for (const item of b.items) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: runs(item) }));
    } else {
      children.push(new Paragraph({ spacing: { after: 160 }, children: runs(b.text) }));
    }
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(title || "zadacha").replace(/[\\/:*?"<>|]+/g, "").slice(0, 60) || "zadacha"}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
