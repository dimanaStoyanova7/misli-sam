import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const COOKIE = "ms_session";
const DAYS = 30;
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000; // extend the session at most once a day

const hash = (token) => createHash("sha256").update(token).digest("hex");

// Codes are case-insensitive and ignore spaces/dashes the teacher might type.
export const normalizeCode = (code = "") => String(code).toUpperCase().replace(/[\s-]+/g, "");

// Readable codes without look-alike characters (no 0/O, 1/I/L).
export function generateCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function dbErrorResponse(err) {
  console.error(err);
  if (err?.message === "NO_DB") {
    return NextResponse.json({ error: "Базата данни не е настроена (липсва DATABASE_URL)." }, { status: 500 });
  }
  return NextResponse.json({ error: "Проблем с базата данни. Опитайте отново." }, { status: 500 });
}

function setCookie(res, token) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DAYS * 24 * 60 * 60,
  });
}

export function clearCookie(res) {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// ---------- Teachers: name + PIN ----------

const scryptAsync = promisify(scrypt);
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Names are matched without caring about case or extra spaces.
export const cleanName = (name = "") => String(name).trim().replace(/\s+/g, " ").slice(0, 80);
export const nameKey = (name = "") => cleanName(name).toLocaleLowerCase("bg");
export const validPin = (pin = "") => /^\d{4,6}$/.test(String(pin));

async function hashPin(pin) {
  const salt = randomBytes(16);
  const key = await scryptAsync(String(pin), salt, 32);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

async function checkPin(pin, stored) {
  const [saltHex, keyHex] = String(stored || "").split(":");
  if (!saltHex || !keyHex) return false;
  const key = await scryptAsync(String(pin), Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}

export async function findSchool(code) {
  const rows = await query("SELECT id, name, active FROM schools WHERE code = $1", [normalizeCode(code)]);
  const school = rows[0];
  return school && school.active ? school : null;
}

// mode: "login" (existing profile) or "create" (new profile).
// Returns { ok, token, school, teacher, pinWasSet } or { error, status, ... }.
export async function loginTeacher({ code, name, pin, mode }) {
  const school = await findSchool(code);
  if (!school) return { error: "Невалиден или неактивен код на училището.", status: 401 };
  const display = cleanName(name);
  if (display.length < 2) return { error: "Въведете име и фамилия.", status: 400 };
  if (!validPin(pin)) return { error: "ПИН кодът трябва да е от 4 до 6 цифри.", status: 400 };
  const key = nameKey(display);

  let teacher = (await query("SELECT * FROM teachers WHERE school_id = $1 AND name_key = $2", [school.id, key]))[0];
  let pinWasSet = false;

  if (mode === "create") {
    if (teacher) {
      return { error: "Вече има профил с това име в училището. Изберете „Вход“ или добавете второ име.", status: 409, exists: true };
    }
    const rows = await query(
      "INSERT INTO teachers (school_id, name, name_key, pin_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (school_id, name_key) DO NOTHING RETURNING *",
      [school.id, display, key, await hashPin(pin)]
    );
    teacher = rows[0];
    if (!teacher) return { error: "Вече има профил с това име в училището.", status: 409, exists: true };
  } else {
    if (!teacher) {
      return { error: "Няма профил с това име в училището. Проверете името или създайте нов профил.", status: 404, notFound: true };
    }
    if (teacher.locked_until && new Date(teacher.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(teacher.locked_until) - Date.now()) / 60000);
      return { error: `Твърде много грешни опити. Опитайте отново след ${mins} мин.`, status: 429 };
    }
    if (!teacher.pin_hash) {
      // PIN was reset by the admin: the PIN entered now becomes the new one.
      await query("UPDATE teachers SET pin_hash = $1, failed_attempts = 0, locked_until = NULL WHERE id = $2", [await hashPin(pin), teacher.id]);
      pinWasSet = true;
    } else if (!(await checkPin(pin, teacher.pin_hash))) {
      const attempts = teacher.failed_attempts + 1;
      const lock = attempts >= MAX_ATTEMPTS;
      await query(
        `UPDATE teachers SET failed_attempts = $1, locked_until = ${lock ? `now() + interval '${LOCK_MINUTES} minutes'` : "NULL"} WHERE id = $2`,
        [lock ? 0 : attempts, teacher.id]
      );
      return {
        error: lock
          ? `Твърде много грешни опити. Профилът е заключен за ${LOCK_MINUTES} мин. Ако сте забравили ПИН кода, помолете администратора да го нулира.`
          : MAX_ATTEMPTS - attempts === 1 ? "Грешен ПИН код. Остава 1 опит." : `Грешен ПИН код. Остават ${MAX_ATTEMPTS - attempts} опита.`,
        status: 401,
      };
    }
  }

  await query("UPDATE teachers SET failed_attempts = 0, locked_until = NULL, last_login = now() WHERE id = $1", [teacher.id]);
  const token = randomBytes(32).toString("hex");
  await query(
    `INSERT INTO sessions (token_hash, school_id, teacher_id, teacher_name, expires_at)
     VALUES ($1, $2, $3, $4, now() + interval '${DAYS} days')`,
    [hash(token), school.id, teacher.id, teacher.name]
  );
  return { ok: true, token, school: school.name, teacher: teacher.name, pinWasSet };
}

export async function logout(req) {
  const token = req.cookies.get(COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hash(token)]);
}

export function withLoginCookie(res, token) {
  setCookie(res, token);
  return res;
}

// ---------- Session check ----------

// Returns { session } or { response } (an error response to send back as-is).
export async function requireSession(req) {
  const token = req.cookies.get(COOKIE)?.value;
  const loginNeeded = (error, status = 401) => {
    const res = NextResponse.json({ error, needsLogin: true }, { status });
    clearCookie(res);
    return { response: res };
  };
  if (!token) return loginNeeded("Моля, влезте с кода на училището.");

  let row;
  try {
    const rows = await query(
      `SELECT s.token_hash, s.teacher_id, s.created_at, s.expires_at, t.name AS teacher_name,
              sc.id AS school_id, sc.name AS school_name, sc.active, sc.monthly_limit
         FROM sessions s
         JOIN schools sc ON sc.id = s.school_id
         JOIN teachers t ON t.id = s.teacher_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hash(token)]
    );
    row = rows[0];
  } catch (err) {
    return { response: dbErrorResponse(err) };
  }

  if (!row) return loginNeeded("Моля, влезте отново.");
  if (!row.active) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [row.token_hash]).catch(() => {});
    return loginNeeded("Достъпът за това училище е спрян. Свържете се с нас.", 403);
  }

  // Sliding expiry: active teachers stay logged in.
  const expiresAt = new Date(row.expires_at).getTime();
  const renew = expiresAt - Date.now() < DAYS * 24 * 60 * 60 * 1000 - RENEW_AFTER_MS;
  if (renew) {
    await query(`UPDATE sessions SET expires_at = now() + interval '${DAYS} days' WHERE token_hash = $1`, [row.token_hash]).catch(() => {});
  }

  return {
    session: {
      token,
      renew,
      schoolId: row.school_id,
      teacherId: row.teacher_id,
      school: row.school_name,
      teacher: row.teacher_name,
      monthlyLimit: row.monthly_limit,
    },
  };
}

// Re-sends the cookie with a fresh 30 days when the session was extended.
export function finish(res, session) {
  if (session?.renew) setCookie(res, session.token);
  return res;
}

// ---------- Usage + limits ----------

export async function usedThisMonth(schoolId, kind = "analyze") {
  const rows = await query(
    "SELECT count(*)::int AS n FROM usage WHERE school_id = $1 AND kind = $2 AND created_at >= date_trunc('month', now())",
    [schoolId, kind]
  );
  return rows[0]?.n ?? 0;
}

export async function overLimit(session) {
  if (session.monthlyLimit == null) return false;
  return (await usedThisMonth(session.schoolId)) >= session.monthlyLimit;
}

export async function recordUsage(session, kind) {
  await query("INSERT INTO usage (school_id, teacher_id, teacher_name, kind) VALUES ($1, $2, $3, $4)", [
    session.schoolId,
    session.teacherId,
    session.teacher,
    kind,
  ]).catch(
    (e) => console.error("usage insert failed", e)
  );
}

// ---------- Admin ----------

export function isAdmin(req) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const given = createHash("sha256").update(req.headers.get("x-admin-password") || "").digest();
  return timingSafeEqual(given, createHash("sha256").update(pw).digest());
}
