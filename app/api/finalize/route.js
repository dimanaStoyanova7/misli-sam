import { FINALIZE_TOOL, callTool, checkAccess, describeContext, errorResponse, json } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  if (!checkAccess(req)) return json({ error: "Невалиден код за достъп.", needsCode: true }, 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Невалидна заявка." }, 400);
  }

  const { original, suggestions, context, scoreBefore } = body || {};
  if (!original || typeof original !== "string") return json({ error: "Липсва оригиналната задача." }, 400);
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return json({ error: "Изберете поне едно предложение." }, 400);
  }

  const chosen = suggestions
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.title}\n   Промяна: ${s.change}\n   Пример: ${s.example}`)
    .join("\n\n");

  const text = `ОРИГИНАЛНА ЗАДАЧА:
"""
${original.slice(0, 20000)}
"""

КОНТЕКСТ:
${describeContext(context)}

ИЗБРАНИ ПРОМЕНИ (приложи само тези):
${chosen}

Оценка преди промените: ${scoreBefore ?? "неизвестна"}/10.

Напиши една цялостна, преработена задача, която обединява избраните промени естествено, запазва учебните цели и е готова за раздаване на учениците. След това оцени по същата скала колко лесно е да се изпълни с ИИ сега.`;

  try {
    const result = await callTool({ content: [{ type: "text", text }], tool: FINALIZE_TOOL, maxTokens: 6000 });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
