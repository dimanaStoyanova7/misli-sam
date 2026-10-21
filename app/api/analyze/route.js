import { ANALYZE_TOOL, callTool, describeContext, errorResponse, json as plainJson, normalizeAnalysis } from "@/lib/ai";
import { dbErrorResponse, finish, overLimit, recordUsage, requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BASE64 = 4_000_000; // keeps the request under Vercel's 4.5 MB body limit
const MAX_TEXT = 20_000;

export async function POST(req) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  const session = auth.session;
  const json = (data, status) => finish(plainJson(data, status), session);

  try {
    if (await overLimit(session)) {
      return json({ error: `Училището достигна месечния лимит от ${session.monthlyLimit} анализа. Лимитът се подновява в началото на месеца.` }, 429);
    }
  } catch (err) {
    return finish(dbErrorResponse(err), session);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Невалидна заявка." }, 400);
  }

  const { kind, text, data, mediaType, context } = body || {};
  const content = [];

  if (kind === "text") {
    const t = (text || "").trim();
    if (t.length < 15) return json({ error: "Текстът на задачата е твърде кратък." }, 400);
    if (t.length > MAX_TEXT) return json({ error: "Текстът е твърде дълъг (до 20 000 знака)." }, 400);
    content.push({ type: "text", text: `ЗАДАЧА (поставен текст):\n"""\n${t}\n"""` });
  } else if (kind === "pdf" || kind === "image") {
    if (!data || typeof data !== "string") return json({ error: "Липсва файл." }, 400);
    if (data.length > MAX_BASE64) return json({ error: "Файлът е твърде голям (до около 3 MB)." }, 413);
    if (kind === "pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    } else {
      if (!IMAGE_TYPES.includes(mediaType)) return json({ error: "Неподдържан формат на изображението." }, 400);
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
    }
    content.push({ type: "text", text: "Задачата е в прикачения файл. Първо я разчети точно." });
  } else {
    return json({ error: "Неизвестен тип вход." }, 400);
  }

  content.push({
    type: "text",
    text: `КОНТЕКСТ:\n${describeContext(context)}\n\nАнализирай задачата: оцени колко лесно може да бъде изпълнена с ИИ и дай 3–8 конкретни предложения как да стане по-устойчива, подредени от най-полезното. Всяко предложение трябва ясно да казва какъв проблем решава. Първо раздели задачата на частите ѝ (parts), после свържи всяко предложение с конкретните части, за които се отнася (targets). Предпочитай конкретни предложения за определени въпроси пред общи съвети.`,
  });

  try {
    const result = await callTool({ content, tool: ANALYZE_TOOL, maxTokens: 6000 });
    if (result.readable === false) {
      return json({ error: "Не успяхме да разпознаем задача във файла. Опитайте с по-ясна снимка или поставете текста." }, 422);
    }
    await recordUsage(session, "analyze");
    return json(normalizeAnalysis(result));
  } catch (err) {
    return finish(errorResponse(err), session);
  }
}
