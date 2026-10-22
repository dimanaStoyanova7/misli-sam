import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { MOCK_RESPONSES } from "@/lib/mock";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

// ---------- Errors ----------

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
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

const STAGE_TEXT = { "1-4": "1–4 клас (начален етап)", "5-7": "5–7 клас (прогимназиален етап)", "8-12": "8–12 клас (гимназиален етап)" };

export function describeContext(ctx = {}) {
  const lines = [];
  if (ctx.grade) lines.push(`Клас: ${ctx.grade}`);
  else if (Array.isArray(ctx.stages) && ctx.stages.length) {
    lines.push(`Класът не е посочен. Учителят преподава в: ${ctx.stages.map((s) => STAGE_TEXT[s] || s).join(", ")}. Определи класа от самия материал.`);
  }
  if (ctx.subject) lines.push(`Предмет: ${ctx.subject}`);
  return lines.length ? lines.join("\n") : "Не е посочен допълнителен контекст. Определи класа и предмета от самия материал.";
}

// ---------- Prompts ----------

const SYSTEM = `Ти си опитен методист в българското училищно образование и експерт по дизайн на учебни материали, устойчиви на използване на изкуствен интелект (ИИ) от ученици.

Терминология: „материал“ е целият документ, който учителят дава (задание, тест, работен лист, проект, есе). Отделните му части са задачи, въпроси или упражнения.

Принципи:
- Целта не е "да хванем" ученика, а да проектираме материали, при които мисленето на ученика е видимо и незаменимо.
- Променяй САМО това колко лесно материалът може да бъде изпълнен с ИИ. Запазвай нивото на езика, трудността, обема и учебните цели на оригинала. Не го прави по-лесен или по-труден, по-дълъг или по-сложен за възрастта. Не го превръщай в нещо друго.
- Работата в клас се извършва под наблюдението на учителя и БЕЗ телефони и други устройства. Приемай това за даденост и не го предлагай като отделна мярка („затворете телефоните“ и подобни). ИИ е достъпен само при работа извън клас (у дома). Затова основният въпрос е кои части учениците могат да свършат с ИИ у дома и как да се променят те или кои да се преместят в час.
- Разделяй две неща:
  1) СЪВЕТИ ЗА ПРОВЕЖДАНЕ (delivery_tips) – как учителят да проведе работата, без да се променя текстът на материала: работа в час, на ръка/на хартия, устна защита или кратък разговор, работа по етапи, предаване на чернова. Те отиват САМО в delivery_tips (най-много 2), никога в suggestions.
  2) ПРЕДЛОЖЕНИЯ (suggestions) – промени в САМИЯ ТЕКСТ на материала: формулировка, изискване, контекст, какво трябва да покаже ученикът, нова част. Всяко предложение трябва да може да се впише в новата версия на материала. Предложение, което само казва „направете го в час“ или „на ръка“, е съвет за провеждане, а не предложение.
- Не давай две предложения с една и съща идея. Всяко предложение трябва да носи нещо различно.
- „Ученикът поправя готов отговор от ИИ“ (критика на текст от ИИ) предлагай само за отворени въпроси, анализ или есе – не за въпроси за факти – и най-много веднъж на материал. За него needs_ai_sample = true и приложението само ще напише примерния отговор, затова не добавяй подготовка за учителя.
- Примерните формулировки пиши на език, подходящ за възрастта на учениците от оригинала.
- Възрастта определя КОИ стратегии са подходящи, а не нивото: в 1–4 клас домашната работа често се прави с помощ от родители, затова работата в клас и устната проверка са най-ефективни; в 5–7 клас – кратки етапи и работа в час; в 8–12 клас са възможни по-дълги самостоятелни задачи с междинни проверки и обосновка.
- Учителите имат малко време. Предпочитай промени, които добавят малко или никаква работа по проверката, и посочвай честно цената им. Не предлагай неща, които са непрактични за българско училище.
- Познати стратегии: лична връзка и собствен опит; местен контекст (град, училище, клас); работа по етапи с междинни проверки; използване на материали от конкретен час; обосновка на избора и рефлексия; устна защита; ръкописна работа в клас; анализ и критика на отговор, генериран от ИИ; конкретни данни, събрани от ученика; ограничения, които ИИ не знае.
- Бъди кратък. Учителят чете бързо: едно ясно изречение е по-добро от три.
- Бъди честен: никой материал не е 100% защитен. Оценявай реалистично.
- Пиши на ясен, естествен български език, без канцеларски изрази. Обръщай се към учителя на "вие".
- Не използвай markdown удебеляване (**).`;

export const ANALYZE_TOOL = {
  name: "report_analysis",
  description: "Върни анализа на материала и предложенията за промяна.",
  input_schema: {
    type: "object",
    properties: {
      parts: {
        type: "array",
        minItems: 1,
        maxItems: 30,
        description:
          "Материалът, разделен на логическите си части в оригиналния ред: общи указания, отделните задачи/въпроси/упражнения. Текстът на всички части заедно трябва да възпроизвежда ЦЕЛИЯ материал точно, без пропуски и без промени (ако е от снимка/PDF – разчетен). Ако материалът е едно цяло без подточки, върни една част.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Кратък идентификатор: p1, p2, p3…" },
            label: {
              type: "string",
              description: "Кратко име на частта, както учителят би я нарекъл: 'Указания', 'Задача 1', 'Въпрос 3', 'Упражнение 4б'. Използвай номерацията от оригинала.",
            },
            text: { type: "string", description: "Точният текст на частта. Запази новите редове." },
          },
          required: ["id", "label", "text"],
        },
      },
      readable: {
        type: "boolean",
        description: "false, ако във входа няма разпознаваем учебен материал (празна/нечетлива снимка, нещо несвързано).",
      },
      title: { type: "string", description: "Кратко заглавие на материала (до 8 думи), по което учителят лесно ще го разпознае, напр. „Отечество любезно – въпроси и есе“." },
      ai_score_before: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "Колко лесно ученик може да предаде работа, направена изцяло с ИИ, която учителят трудно ще различи. 1 = почти невъзможно, 10 = изключително лесно.",
      },
      score_reason: { type: "string", description: "Защо материалът е лесен или труден за ИИ – 1–2 кратки изречения." },
      delivery_tips: {
        type: "array",
        maxItems: 2,
        description:
          "0–2 съвета за провеждане: как учителят да проведе работата (в час, на ръка, устно, по етапи), без да се променя текстът на материала. Не се включват в новата версия. Празен масив, ако няма нужда.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Кратко заглавие като действие (до 7 думи), напр. „Задачи 1–3 в час, на ръка“." },
            why: { type: "string", description: "Защо помага – ЕДНО кратко изречение, което назовава проблема." },
          },
          required: ["title", "why"],
        },
      },
      suggestions: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Кратко заглавие, формулирано като действие и ясно кой какво прави (до 7 думи), напр. „Ученикът поправя готов отговор от ИИ“, „Свържете есето с родното място“.",
            },
            targets: {
              type: "array",
              items: { type: "string" },
              description:
                "id-тата на частите (от parts), за които се отнася предложението. Посочи конкретните части, когато промяната засяга съдържанието на определени въпроси. Празен масив = общо предложение за целия материал (така се дават мерките за начина на изпълнение – в час, на ръка, устно, по етапи – и то само веднъж).",
            },
            change: { type: "string", description: "Какво точно да се промени – едно изречение (използва се при създаване на новата версия)." },
            problem: {
              type: "string",
              description:
                "Защо – ЕДНО кратко изречение (до около 20 думи), което назовава ПРОБЛЕМА: какво в сегашната задача позволява на ИИ да я свърши и как промяната го затруднява. Не описвай само ползата.",
            },
            example: { type: "string", description: "Готов текст за учениците – как звучи променената част. До 2 кратки изречения." },
            impact: { type: "string", enum: ["висок", "среден", "нисък"], description: "Колко намалява възможността за изпълнение с ИИ." },
            cost: {
              type: "string",
              description:
                "Допълнителните усилия за учителя като кратка фраза, САМО ако има такива, напр. „~5 мин подготовка преди часа“, „~2 мин проверка на ученик“, „отнема част от часа“. Ако не е нужна допълнителна работа, остави празно (\"\"). Не пиши „без допълнителна работа“. Не смятай за усилие готов текст, който приложението ще генерира само (виж needs_ai_sample).",
            },
            needs_ai_sample: {
              type: "boolean",
              description:
                "true САМО ако учениците ще работят с готов отговор/текст от ИИ (напр. да го оценят и поправят). Тогава приложението само ще го напише в новата версия, така че учителят няма да го подготвя.",
            },
          },
          required: ["title", "targets", "change", "problem", "example", "impact", "cost", "needs_ai_sample"],
        },
      },
    },
    required: ["parts", "readable", "title", "ai_score_before", "score_reason", "delivery_tips", "suggestions"],
  },
};

// Extra instruction for the final version when a chosen suggestion needs a ready AI-written text.
export const AI_SAMPLE_RULE = `Едно от избраните предложения изисква учениците да работят с готов отговор от ИИ. Напиши този отговор САМ и го включи в новата версия под подзаглавие „## Отговор, генериран от ИИ“, точно след задачата, за която се отнася. Отговорът трябва да звучи правдоподобно и уверено, но да съдържа 2–3 умишлени слабости: една фактическа неточност, едно общо/празно твърдение без доказателство от текста и (ако е уместно) един пропуск. Не отбелязвай слабостите в текста за учениците. В бележките за учителя изброй кои са слабостите (ключ за проверка).`;

export const FINALIZE_TOOL = {
  name: "report_final",
  description: "Върни окончателната преработена версия на материала.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Заглавие на материала." },
      assignment: {
        type: "string",
        description:
          "Пълният текст на новата версия, готов за раздаване на учениците. Формат: обикновен текст; подзаглавия започват с '## '; изброявания започват с '- '; празен ред между абзаците. Без ** удебеляване.",
      },
      teacher_notes: {
        type: "string",
        description: "Кратки бележки само за учителя (2–4 точки): как да проведе работата и на какво да внимава при проверка. Изброявания с '- '.",
      },
      ai_score_after: { type: "integer", minimum: 1, maximum: 10, description: "Същата скала като преди: колко лесно е да се изпълни с ИИ сега." },
      score_reason: { type: "string", description: "Кратко обяснение защо оценката се промени – 1–2 изречения." },
    },
    required: ["title", "assignment", "teacher_notes", "ai_score_after", "score_reason"],
  },
};

// ---------- Call ----------

export async function callTool({ content, tool, maxTokens = 4000 }) {
  // MOCK_AI=1 returns canned answers: for local testing without spending tokens.
  if (process.env.MOCK_AI === "1") return structuredClone(MOCK_RESPONSES[tool.name]);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("NO_KEY");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  // Some models don't allow forcing a specific tool, so we ask for it in the prompt
  // and fall back to parsing JSON from the text if the model answers in text instead.
  const fullContent = [
    ...content,
    { type: "text", text: `Върни отговора САМО чрез извикване на инструмента "${tool.name}". Не пиши нищо друго.` },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      tools: [tool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: fullContent }],
    });
    const block = res.content.find((b) => b.type === "tool_use" && b.name === tool.name);
    if (block) return block.input;
    const parsed = parseJsonFromText(res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"));
    if (parsed && tool.input_schema.required.every((k) => k in parsed)) return parsed;
  }
  throw new Error("NO_TOOL");
}

function parseJsonFromText(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Makes the analysis safe for the UI: every part has a unique id, targets point to
// existing parts, and the full text is rebuilt from the parts for the final step.
export function normalizeAnalysis(result) {
  let parts = Array.isArray(result.parts) ? result.parts.filter((p) => p && typeof p.text === "string" && p.text.trim()) : [];
  if (!parts.length && result.extracted_text) parts = [{ id: "p1", label: "Задача", text: result.extracted_text }];
  const seen = new Set();
  parts = parts.map((p, i) => {
    let id = String(p.id || `p${i + 1}`);
    if (seen.has(id)) id = `p${i + 1}_${i}`;
    seen.add(id);
    return { id, label: String(p.label || `Част ${i + 1}`), text: p.text.trim() };
  });
  const ids = new Set(parts.map((p) => p.id));
  const suggestions = (result.suggestions || []).map((s) => ({
    ...s,
    targets: Array.isArray(s.targets) ? [...new Set(s.targets.map(String))].filter((t) => ids.has(t)) : [],
    // Older saved analyses have a "costs" list; newer ones a single "cost".
    // "No extra work" is shown as nothing at all.
    costs: (s.cost ? [String(s.cost)] : Array.isArray(s.costs) ? s.costs.slice(0, 1) : []).filter(
      (c) => c.trim() && !/без допълнителн/i.test(c)
    ),
    needs_ai_sample: Boolean(s.needs_ai_sample),
  }));
  const delivery_tips = (Array.isArray(result.delivery_tips) ? result.delivery_tips : [])
    .filter((t) => t && t.title)
    .slice(0, 2)
    .map((t) => ({ title: String(t.title), why: String(t.why || "") }));
  return { ...result, parts, suggestions, delivery_tips, extracted_text: parts.map((p) => p.text).join("\n\n") };
}
