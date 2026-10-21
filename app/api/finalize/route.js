import { AI_SAMPLE_RULE, FINALIZE_TOOL, callTool, describeContext, errorResponse, json as plainJson } from "@/lib/ai";
import { dbErrorResponse, finish, recordUsage, requireSession } from "@/lib/auth";
import { getAssignment, saveFinal } from "@/lib/assignments";

export const runtime = "nodejs";
export const maxDuration = 60;

// Body: { assignmentId, selected: [true, false, ...] } – one flag per suggestion.
// The analysis itself is loaded from the database, so it can't be altered by the browser.
export async function POST(req) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  const session = auth.session;
  const json = (data, status) => finish(plainJson(data, status), session);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Невалидна заявка." }, 400);
  }

  const id = Number.parseInt(body?.assignmentId, 10);
  if (!Number.isFinite(id)) return json({ error: "Липсва материалът." }, 400);

  let row;
  try {
    row = await getAssignment(session, id);
  } catch (err) {
    return finish(dbErrorResponse(err), session);
  }
  if (!row) return json({ error: "Материалът не е намерен." }, 404);

  const { analysis, context } = row;
  const suggestions = analysis.suggestions || [];
  const selected = suggestions.map((_, i) => Boolean(body?.selected?.[i]));
  const chosen = suggestions.filter((_, i) => selected[i]);
  if (chosen.length === 0) return json({ error: "Изберете поне едно предложение." }, 400);

  const original = (analysis.parts || []).map((p) => `[${p.label}]\n${p.text}`).join("\n\n");
  const labelOf = Object.fromEntries((analysis.parts || []).map((p) => [p.id, p.label]));
  const chosenText = chosen
    .map((s, i) => {
      const where = s.targets?.length ? ` (за: ${s.targets.map((t) => labelOf[t] || t).join(", ")})` : " (за целия материал)";
      return `${i + 1}. ${s.title}${where}\n   Промяна: ${s.change}\n   Пример: ${s.example}`;
    })
    .join("\n\n");

  const text = `ОРИГИНАЛЕН МАТЕРИАЛ (по части):
"""
${original.slice(0, 20000)}
"""

КОНТЕКСТ:
${describeContext(context)}

ИЗБРАНИ ПРОМЕНИ (приложи само тези):
${chosenText}

Оценка преди промените: ${analysis.ai_score_before ?? "неизвестна"}/10.

Напиши една цялостна, преработена версия на материала, която обединява избраните промени естествено, запазва учебните цели, нивото и обема и е готова за раздаване на учениците. Частите без избрани промени запази почти без промяна. Ако някоя промяна изисква готов текст или материал, напиши го ти и го включи, за да няма допълнителна подготовка за учителя. След това оцени по същата скала колко лесно е да се изпълни с ИИ сега.${
    chosen.some((s) => s.needs_ai_sample || /отговор (от|на) ИИ|генериран от ИИ/i.test(`${s.title} ${s.change}`)) ? `\n\n${AI_SAMPLE_RULE}` : ""
  }`;

  try {
    const result = await callTool({ content: [{ type: "text", text }], tool: FINALIZE_TOOL, maxTokens: 6000 });
    await recordUsage(session, "finalize");
    await saveFinal(session, id, { selected, final: result }).catch((e) => console.error("saveFinal failed", e));
    return json(result);
  } catch (err) {
    return finish(errorResponse(err), session);
  }
}
