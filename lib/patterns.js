// "Чести слаби места": typical weak spots by type of question, and the usual fix.
// Shown on the start page. Kept in line with the strategies in the AI prompt (lib/ai.js).
// for: the kinds of subject where the pattern comes up most ("all" = every subject); used for ordering.
// examples: short, simple before/after pairs from different subjects and grades. The card shows the
// one closest to the teacher's chosen subject and grade; "Друг пример" cycles through the rest.
// The first example of each pattern is the default, so together they cover a spread of subjects.

export const PATTERNS = [
  {
    id: "fact",
    for: "all",
    pattern: "Въпрос за факт или изброяване",
    signs: "„Посочете…“, „Кои са…“, „Избройте…“",
    fix: "Избор и обосновка, с доказателство от текста или урока",
    examples: [
      { subject: "География и икономика", grade: 7, before: "Избройте реките в България.", after: "Коя река е най-близо до нашия град? Напишете два факта за нея от урока и едно нещо, което сте видели сами." },
      { subject: "Български език и литература", grade: 5, before: "Кои са героите в приказката?", after: "Кой герой постъпва най-честно? Посочете случката, която го показва." },
      { subject: "История и цивилизации", grade: 6, before: "Кога е покръстването на българите?", after: "Защо според вас Борис I покръства българите? Дайте една причина от урока и я обяснете." },
      { subject: "Биология", grade: 9, before: "Избройте органелите на клетката.", after: "Коя органела бихте сравнили с кухня и защо?" },
      { subject: "Човекът и природата", grade: 3, before: "Кои са сезоните?", after: "Кой сезон е навън сега? Напишете две неща, които виждате по пътя към училище и го показват." },
    ],
  },
  {
    id: "calc",
    for: ["stem"],
    pattern: "Стандартна задача за пресмятане",
    signs: "„Пресметнете…“, „Решете…“, „Намерете…“",
    fix: "Намиране на грешка в готово решение или обяснение на метода",
    examples: [
      { subject: "Математика", grade: 5, before: "Пресметнете $\\frac{3}{4} + \\frac{1}{2}$.", after: "Ани пише, че $\\frac{3}{4} + \\frac{1}{2} = \\frac{4}{6}$. Къде греши? Обяснете и пресметнете вярно." },
      { subject: "Математика", grade: 3, before: "Пресметнете 36 + 47.", after: "Измислете задача за пазаруване с числата 36 и 47 и я решете." },
      { subject: "Физика и астрономия", grade: 8, before: "Кола изминава 120 km за 2 h. Намерете скоростта ѝ.", after: "Засечете колко минути ви отнема пътят до училище и пресметнете средната си скорост." },
      { subject: "Химия и опазване на околната среда", grade: 8, before: "Изравнете: $H_2 + O_2 \\to H_2O$.", after: "Изравнете $H_2 + O_2 \\to H_2O$ и обяснете с едно изречение защо пред $H_2O$ стои 2." },
      { subject: "Математика", grade: 10, before: "Пресметнете $C_6^4$.", after: "Защо тук е $C_6^4$, а не $V_6^4$? Обяснете с едно изречение, после пресметнете." },
    ],
  },
  {
    id: "lang",
    for: ["lang"],
    pattern: "Превод или граматическо упражнение",
    signs: "„Преведете…“, „Попълнете с правилната форма…“",
    fix: "Изречения за собствения живот, с думи от урока",
    examples: [
      { subject: "Английски език", grade: 5, before: "Преведете: „Аз имам котка.“", after: "Напишете 3 изречения с have got за ваш домашен любимец или любимо животно." },
      { subject: "Английски език", grade: 7, before: "Попълнете глаголите в Past Simple.", after: "Напишете 5 изречения в Past Simple за миналия си уикенд, с поне 3 думи от урока." },
      { subject: "Немски език", grade: 10, before: "Преведете текста за Берлин.", after: "Опишете нашия град за немски турист в 5 изречения, с 3 думи от урока." },
      { subject: "Френски език", grade: 12, before: "Преведете писмото на френски.", after: "Напишете кратко писмо до френски връстник: какво бихте му показали в България и защо." },
    ],
  },
  {
    id: "analysis",
    for: ["text", "other"],
    pattern: "Анализ или тълкуване",
    signs: "„Каква е ролята на…“, „Анализирайте…“",
    fix: "Ученикът поправя готов отговор от ИИ. Приложението го пише с умишлени грешки и дава ключа",
    examples: [
      { subject: "Български език и литература", grade: 12, before: "Какви художествени средства използва авторът?", after: "Ето отговор, написан от ИИ. Намерете двете грешки и едно твърдение без доказателство от текста." },
      { subject: "Български език и литература", grade: 7, before: "Каква е ролята на природата в разказа?", after: "Ето отговор от ИИ за ролята на природата. Поправете двете грешки с примери от текста." },
      { subject: "История и цивилизации", grade: 10, before: "Анализирайте причините за Първата световна война.", after: "Ето кратък отговор от ИИ. Подчертайте твърдението без доказателство и добавете факт от урока." },
      { subject: "Философия", grade: 11, before: "Анализирайте мисълта „Познай себе си“.", after: "Ето тълкуване от ИИ. С кое не сте съгласни и защо? Дайте пример от своя живот." },
    ],
  },
  {
    id: "essay",
    for: ["text", "lang", "other"],
    pattern: "Есе или съчинение на обща тема",
    signs: "„Моят любим…“, „Какво означава… за мен“",
    fix: "Връзка с личен опит или с родния град, и работа на етапи",
    examples: [
      { subject: "Български език и литература", grade: 5, before: "Съчинение: „Моят любим сезон“.", after: "Опишете един ден от любимия си сезон, който помните: какво видяхте, чухте и почувствахте." },
      { subject: "Български език и литература", grade: 11, before: "Есе: „Какво означава родината за мен“.", after: "Опишете място в нашия град, което за вас е „родина“. Планът се прави в час, есето след това." },
      { subject: "Философия", grade: 12, before: "Есе на тема „Свободата“.", after: "Кога последно направихте избор, който ви е струвал нещо? Беше ли това свобода?" },
      { subject: "Английски език", grade: 9, before: "Write an essay about technology.", after: "Write about one app you use every day: what it changes in your day and what you would miss." },
    ],
  },
  {
    id: "retell",
    for: ["text", "lang", "other"],
    pattern: "Преразказ или резюме",
    signs: "„Преразкажете…“, „Обобщете…“",
    fix: "Друга гледна точка или ограничение, което ИИ не знае",
    examples: [
      { subject: "Български език и литература", grade: 3, before: "Преразкажете приказката.", after: "Разкажете приказката от името на вълка, в 5 изречения." },
      { subject: "История и цивилизации", grade: 6, before: "Преразкажете урока.", after: "Разкажете урока като репортер, който е бил там, в 6 изречения." },
      { subject: "Български език и литература", grade: 9, before: "Преразкажете разказа.", after: "Преразкажете епизода, обсъден в час, от гледната точка на друг герой, в 6 изречения." },
      { subject: "Биология", grade: 10, before: "Обобщете урока за имунитета.", after: "Обяснете урока за имунитета на 8-годишно дете, с едно сравнение от ежедневието." },
    ],
  },
  {
    id: "test",
    for: "all",
    pattern: "Тест с избираем отговор",
    signs: "„Оградете верния отговор“",
    fix: "Обосновка на избора при 2–3 въпроса",
    examples: [
      { subject: "Биология", grade: 6, before: "Оградете верния отговор.", after: "При въпроси 2 и 4 напишете защо другите отговори са грешни." },
      { subject: "Математика", grade: 7, before: "Оградете верния отговор.", after: "При задача 5 покажете как стигнахте до отговора, а при задача 8 посочете кой грешен отговор е най-примамлив и защо." },
      { subject: "География и икономика", grade: 11, before: "Оградете верния отговор.", after: "Изберете два въпроса и за всеки дайте пример от България, който подкрепя отговора." },
    ],
  },
  {
    id: "project",
    for: "all",
    pattern: "Проект, реферат или презентация",
    signs: "„Подгответе реферат…“, „Направете презентация…“",
    fix: "Данни, които ученикът събира сам, етапи и кратка устна защита",
    examples: [
      { subject: "Човекът и природата", grade: 5, before: "Презентация за растенията.", after: "Наблюдавайте едно растение у дома 5 дни, нарисувайте промените и разкажете за тях в час." },
      { subject: "История и цивилизации", grade: 12, before: "Реферат за прехода след 1989 г.", after: "Попитайте възрастен роднина как си спомня 1990 г. и сравнете с урока. В час: 2 минути разказ." },
      { subject: "Химия и опазване на околната среда", grade: 9, before: "Реферат за замърсяването на въздуха.", after: "Три дни наблюдавайте въздуха в квартала си и запишете какво виждате. В час: 2 минути за данните." },
      { subject: "Информационни технологии", grade: 8, before: "Презентация за социалните мрежи.", after: "Запишете колко време прекарвате в телефона за 3 дни и представете данните си в 3 слайда." },
    ],
  },
];

const STEM = /Математика|Физика|Химия|Информатика|Информационни|Човекът и природата/;
const LANG = /^(Английски|Немски|Френски|Испански|Руски) език$/;
const TEXT = /Български език и литература/;

export function subjectKind(subject = "") {
  if (!subject || /Начален етап/.test(subject)) return null;
  return STEM.test(subject) ? "stem" : LANG.test(subject) ? "lang" : TEXT.test(subject) ? "text" : "other";
}

// All patterns, those most typical for the chosen subject first.
export function orderedPatterns(subject = "") {
  const kind = subjectKind(subject);
  if (!kind) return PATTERNS;
  const fits = (p) => p.for === "all" || p.for.includes(kind);
  return [...PATTERNS.filter(fits), ...PATTERNS.filter((p) => !fits(p))];
}

// Index of the example closest to the chosen subject and grade (grade "" = any).
// Same school stage matters most (a 12th-grade teacher shouldn't get a 5th-grade example),
// then the same subject, then the same kind of subject. With nothing chosen, the first example.
const stageOf = (g) => (g <= 4 ? 1 : g <= 7 ? 2 : 3);

export function bestExample(pattern, subject = "", grade = "") {
  const g = /Начален етап/.test(subject) && !grade ? 3 : Number.parseInt(grade, 10);
  const kind = subjectKind(subject);
  if (!subject && !g) return 0;
  let best = 0;
  let bestScore = -Infinity;
  pattern.examples.forEach((ex, i) => {
    let score = 0;
    if (ex.subject === subject) score += 50;
    else if (kind && subjectKind(ex.subject) === kind) score += 20;
    if (g) score += (stageOf(ex.grade) === stageOf(g) ? 80 : 0) - Math.abs(ex.grade - g) * 4;
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}
