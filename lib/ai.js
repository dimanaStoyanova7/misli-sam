import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

// ---------- Access + errors ----------

export function checkAccess(req) {
  const code = process.env.ACCESS_CODE;
  if (!code) return true;
  return (req.headers.get("x-access-code") || "").trim() === code.trim();
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(err) {
  console.error(err);
  if (err?.message === "NO_KEY") {
    return json({ error: "Сървърът няма настроен ANTHROPIC_API_KEY." }, 500);
  }
  const status = err?.status;
  if (status === 401) return json({ error: "Невалиден API ключ на сървъра." }, 500);
  if (status === 429) return json({ error: "Твърде много заявки в момента. Опитайте отново след минута." }, 429);
  if (status === 529 || status === 503) return json({ error: "ИИ услугата е претоварена. Опитайте отново след малко." }, 503);
  const detail = String(err?.error?.error?.message || err?.message || "");
  if (/credit balance/i.test(detail)) {
    return json({ error: "Няма достатъчно кредити в акаунта в Anthropic. Добавете кредити в console.anthropic.com → Billing." }, 402);
  }
  if (status === 404 || /model/i.test(detail)) {
    return json({ error: `Проблем с модела на ИИ (${MODEL}). Подробности: ${detail}` }, 500);
  }
  if (status === 400) return json({ error: `ИИ услугата отказа заявката. Подробности: ${detail}` }, 400);
  if (err?.message === "NO_TOOL") return json({ error: "Неочакван отговор от ИИ. Опитайте отново." }, 502);
  return json({ error: "Нещо се обърка. Опитайте отново." }, 500);
}

// ---------- Context ----------

const SETTING = { home: "у дома (домашна работа)", class: "в клас, под наблюдение", both: "отчасти в клас, отчасти у дома" };
const GRADING = { low: "много малко време за проверка", mid: "умерено време за проверка", high: "достатъчно време за проверка" };

export function describeContext(ctx = {}) {
  const lines = [];
  if (ctx.grade) lines.push(`Клас: ${ctx.grade}`);
  if (ctx.subject) lines.push(`Предмет: ${ctx.subject}`);
  if (ctx.setting) lines.push(`Къде се изпълнява: ${SETTING[ctx.setting] || ctx.setting}`);
  if (ctx.grading) lines.push(`Време на учителя за проверка: ${GRADING[ctx.grading] || ctx.grading}`);
  return lines.length ? lines.join("\n") : "Не е посочен допълнителен контекст.";
}

// ---------- Prompts ----------

const SYSTEM = `Ти си опитен методист в българското училищно образование и експерт по дизайн на задачи, устойчиви на използване на изкуствен интелект (ИИ) от ученици.

Принципи:
- Целта не е "да хванем" ученика, а да проектираме задачи, при които мисленето на ученика е видимо и незаменимо.
- Запазвай учебните цели на оригиналната задача. Не превръщай задачата в нещо друго.
- Съобразявай се с възрастта, предмета, къде се изпълнява задачата и колко време има учителят за проверка. Не предлагай неща, които са непрактични за българско училище.
- Познати стратегии: лична връзка и собствен опит; местен контекст (град, училище, клас); работа по етапи с междинни проверки; използване на материали от конкретен час; обосновка на избора и рефлексия; устна защита; ръкописна работа в клас; анализ и критика на отговор, генериран от ИИ; конкретни данни, събрани от ученика; ограничения, които ИИ не знае.
- Бъди честен: никоя задача не е 100% защитена. Оценявай реалистично.
- Пиши на ясен, естествен български език, без канцеларски изрази. Обръщай се към учителя на "вие".
- Не използвай markdown удебеляване (**).`;

export const ANALYZE_TOOL = {
  name: "report_analysis",
  description: "Върни анализа на задачата и предложенията за промяна.",
  input_schema: {
    type: "object",
    properties: {
      extracted_text: {
        type: "string",
        description: "Пълният текст на задачата, точно както е в оригинала (ако е от снимка/PDF – разчетен). Запази структурата с нови редове.",
      },
      readable: {
        type: "boolean",
        description: "false, ако във входа няма разпознаваема учебна задача (празна/нечетлива снимка, нещо несвързано).",
      },
      summary: { type: "string", description: "1–2 изречения: какво изисква задачата и каква е учебната ѝ цел." },
      ai_score_before: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "Колко лесно ученик може да предаде отговор, направен изцяло от ИИ, който учителят трудно ще различи. 1 = почти невъзможно, 10 = изключително лесно.",
      },
      score_reason: { type: "string", description: "Кратко обяснение на оценката (1–2 изречения)." },
      suggestions: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Кратко име на промяната (до 8 думи)." },
            change: { type: "string", description: "Какво конкретно да се промени в задачата." },
            problem: {
              type: "string",
              description: "Какъв проблем решава: какво в сегашната задача позволява на ИИ да я свърши и защо тази промяна го затруднява.",
            },
            example: { type: "string", description: "Готов текст – как би звучала променената част от задачата, директно за учениците." },
            impact: { type: "string", enum: ["висок", "среден", "нисък"], description: "Колко намалява възможността за изпълнение с ИИ." },
            costs: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
              description: "Кратки етикети за допълнителните усилия, напр. '+5 мин подготовка', '+време за проверка', 'нужно е време в час', 'без допълнителна работа'.",
            },
          },
          required: ["title", "change", "problem", "example", "impact", "costs"],
        },
      },
    },
    required: ["extracted_text", "readable", "summary", "ai_score_before", "score_reason", "suggestions"],
  },
};

export const FINALIZE_TOOL = {
  name: "report_final",
  description: "Върни окончателната преработена задача.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Заглавие на задачата." },
      assignment: {
        type: "string",
        description:
          "Пълният текст на новата задача, готов за раздаване на учениците. Формат: обикновен текст; подзаглавия започват с '## '; изброявания започват с '- '; празен ред между абзаците. Без ** удебеляване.",
      },
      teacher_notes: {
        type: "string",
        description: "Кратки бележки само за учителя: как да проведе задачата и на какво да внимава при проверка. Изброявания с '- '.",
      },
      ai_score_after: { type: "integer", minimum: 1, maximum: 10, description: "Същата скала като преди: колко лесно е да се изпълни с ИИ сега." },
      score_reason: { type: "string", description: "Кратко обяснение защо оценката се промени." },
    },
    required: ["title", "assignment", "teacher_notes", "ai_score_after", "score_reason"],
  },
};

// ---------- Call ----------

export async function callTool({ content, tool, maxTokens = 4000 }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("NO_KEY");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block) throw new Error("NO_TOOL");
  return block.input;
}
