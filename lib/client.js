"use client";

// ---------- File reading ----------

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Файлът не можа да бъде прочетен."));
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Изображението не можа да бъде отворено. Опитайте JPG или PNG."));
    img.src = src;
  });
}

// Phone photos are often 5–10 MB; shrink them so they fit the upload limit.
async function compressImage(file) {
  const img = await loadImage(await readAsDataURL(file));
  const MAX = 2000;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.88;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 3_800_000 && quality > 0.5) {
    quality -= 0.1;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  return { data: url.split(",")[1], mediaType: "image/jpeg" };
}

export async function prepareFile(file) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    if (file.size > 3 * 1024 * 1024) throw new Error("PDF файлът е по-голям от 3 MB. Опитайте с по-малък файл или само страницата със задачата.");
    const url = await readAsDataURL(file);
    return { kind: "pdf", data: url.split(",")[1], mediaType: "application/pdf" };
  }
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
    const { data, mediaType } = await compressImage(file);
    return { kind: "image", data, mediaType };
  }
  throw new Error("Поддържани формати: PDF, JPG, PNG, WEBP.");
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
  const children = [new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 240 }, children: [new TextRun({ text: title })] })];
  for (const b of parseBlocks(assignment)) {
    if (b.type === "heading") {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: b.text })] }));
    } else if (b.type === "list") {
      for (const item of b.items) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: item })] }));
    } else {
      children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: b.text })] }));
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
