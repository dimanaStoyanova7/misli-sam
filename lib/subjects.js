// Shared by the setup screen and the server-side validation.

export const STAGES = [
  { id: "1-4", label: "1–4 клас", note: "Начален етап", grades: ["1", "2", "3", "4"] },
  { id: "5-7", label: "5–7 клас", note: "Прогимназиален етап", grades: ["5", "6", "7"] },
  { id: "8-12", label: "8–12 клас", note: "Гимназиален етап", grades: ["8", "9", "10", "11", "12"] },
];

export const SUBJECTS = [
  "Български език и литература",
  "Математика",
  "Английски език",
  "Немски език",
  "Френски език",
  "Испански език",
  "Руски език",
  "История и цивилизации",
  "География и икономика",
  "Биология",
  "Физика и астрономия",
  "Химия и опазване на околната среда",
  "Човекът и природата",
  "Информационни технологии",
  "Информатика",
  "Философия",
  "Гражданско образование",
  "Музика",
  "Изобразително изкуство",
  "Технологии и предприемачество",
  "Физическо възпитание и спорт",
  "Религия",
];

export const PRIMARY_SUBJECT = "Начален етап (всички предмети)";
export const MAX_SUBJECTS = 3;

// True when the teacher needs to choose subjects (i.e. teaches beyond grades 1–4).
export const needsSubjects = (stages = []) => stages.some((s) => s !== "1-4");

// Subject choices offered on the upload page.
export function subjectChoices(settings) {
  if (!settings) return [];
  const list = needsSubjects(settings.stages) ? [...(settings.subjects || [])] : [];
  if (settings.stages?.includes("1-4") && list.length) list.unshift(PRIMARY_SUBJECT);
  return list;
}

export function gradeChoices(settings) {
  return STAGES.filter((s) => settings?.stages?.includes(s.id)).flatMap((s) => s.grades);
}

// Returns clean settings, or { error }.
export function validateSettings(input = {}) {
  const ids = STAGES.map((s) => s.id);
  const stages = [...new Set(Array.isArray(input.stages) ? input.stages : [])].filter((s) => ids.includes(s));
  if (!stages.length) return { error: "Изберете поне един етап." };
  stages.sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
  let subjects = [];
  if (needsSubjects(stages)) {
    subjects = [...new Set((Array.isArray(input.subjects) ? input.subjects : []).map((s) => String(s).trim().replace(/\s+/g, " ").slice(0, 60)))].filter(
      (s) => s.length >= 2 && s !== PRIMARY_SUBJECT
    );
    if (!subjects.length) return { error: "Изберете поне един предмет." };
    if (subjects.length > MAX_SUBJECTS) return { error: `Изберете до ${MAX_SUBJECTS} предмета.` };
  }
  return { stages, subjects };
}
