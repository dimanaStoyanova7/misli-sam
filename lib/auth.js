import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
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

// ---------- Login / logout ----------

export async function login(code, teacherName) {
  const rows = await query("SELECT id, name, active FROM schools WHERE code = $1", [normalizeCode(code)]);
  const school = rows[0];
  if (!school || !school.active) return null;
  const token = randomBytes(32).toString("hex");
  const name = (teacherName || "").trim().slice(0, 80) || null;
  await query(
    `INSERT INTO sessions (token_hash, school_id, teacher_name, expires_at)
     VALUES ($1, $2, $3, now() + interval '${DAYS} days')`,
    [hash(token), school.id, name]
  );
  return { token, school: school.name, teacher: name };
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
      `SELECT s.token_hash, s.teacher_name, s.created_at, s.expires_at,
              sc.id AS school_id, sc.name AS school_name, sc.active, sc.monthly_limit
         FROM sessions s JOIN schools sc ON sc.id = s.school_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hash(token)]
    );
    row = rows[0];
  } catch (err) {
    return { response: dbErrorResponse(err) };
  }

  if (!row) return loginNeeded("Сесията изтече. Моля, влезте отново.");
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
  await query("INSERT INTO usage (school_id, teacher_name, kind) VALUES ($1, $2, $3)", [session.schoolId, session.teacher, kind]).catch(
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
