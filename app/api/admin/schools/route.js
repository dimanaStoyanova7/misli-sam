import { NextResponse } from "next/server";
import { dbErrorResponse, generateCode, isAdmin, normalizeCode } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deny = () =>
  NextResponse.json(
    { error: process.env.ADMIN_PASSWORD ? "Грешна парола." : "ADMIN_PASSWORD не е настроена във Vercel." },
    { status: 401 }
  );

const parseLimit = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

async function listSchools() {
  return query(
    `SELECT sc.id, sc.name, sc.code, sc.active, sc.monthly_limit, sc.created_at,
            (SELECT count(*)::int FROM usage u WHERE u.school_id = sc.id AND u.kind = 'analyze' AND u.created_at >= date_trunc('month', now())) AS analyses_month,
            (SELECT count(*)::int FROM usage u WHERE u.school_id = sc.id AND u.kind = 'analyze') AS analyses_total,
            (SELECT count(DISTINCT u.teacher_name)::int FROM usage u WHERE u.school_id = sc.id AND u.teacher_name IS NOT NULL) AS teachers,
            (SELECT count(*)::int FROM sessions s WHERE s.school_id = sc.id AND s.expires_at > now()) AS sessions
       FROM schools sc
      ORDER BY sc.created_at DESC`
  );
}

export async function GET(req) {
  if (!isAdmin(req)) return deny();
  try {
    return NextResponse.json({ schools: await listSchools() });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

// Create a school
export async function POST(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Въведете име на училището." }, { status: 400 });
  const limit = parseLimit(body.monthlyLimit);
  if (limit === undefined) return NextResponse.json({ error: "Лимитът трябва да е цяло число или празно поле." }, { status: 400 });
  const custom = normalizeCode(body.code || "");
  if (custom && !/^[A-Z0-9А-Я]{6,24}$/.test(custom)) {
    return NextResponse.json({ error: "Кодът трябва да е 6–24 букви или цифри." }, { status: 400 });
  }
  try {
    for (let i = 0; i < 5; i++) {
      const code = custom || generateCode();
      const rows = await query(
        "INSERT INTO schools (name, code, monthly_limit) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING id",
        [name, code, limit]
      );
      if (rows.length) return NextResponse.json({ ok: true, code, schools: await listSchools() });
      if (custom) return NextResponse.json({ error: "Този код вече се използва." }, { status: 409 });
    }
    return NextResponse.json({ error: "Не успяхме да създадем уникален код. Опитайте отново." }, { status: 500 });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

// Update a school: { id, active?, monthlyLimit?, newCode? }
export async function PATCH(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json().catch(() => ({}));
  const id = Number.parseInt(body.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Липсва училище." }, { status: 400 });
  try {
    if (typeof body.active === "boolean") {
      // Sessions of a stopped school are rejected (and removed) on their next request,
      // so teachers see a clear "access stopped" message.
      await query("UPDATE schools SET active = $1 WHERE id = $2", [body.active, id]);
    }
    if ("monthlyLimit" in body) {
      const limit = parseLimit(body.monthlyLimit);
      if (limit === undefined) return NextResponse.json({ error: "Лимитът трябва да е цяло число или празно поле." }, { status: 400 });
      await query("UPDATE schools SET monthly_limit = $1 WHERE id = $2", [limit, id]);
    }
    if (body.newCode) {
      // A new code also logs everyone out, in case the old one leaked.
      let done = false;
      for (let i = 0; i < 5 && !done; i++) {
        const rows = await query(
          "UPDATE schools SET code = $1 WHERE id = $2 AND NOT EXISTS (SELECT 1 FROM schools WHERE code = $1) RETURNING id",
          [generateCode(), id]
        );
        done = rows.length > 0;
      }
      await query("DELETE FROM sessions WHERE school_id = $1", [id]);
    }
    return NextResponse.json({ ok: true, schools: await listSchools() });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

// Delete a school (and its sessions + usage)
export async function DELETE(req) {
  if (!isAdmin(req)) return deny();
  const id = Number.parseInt(new URL(req.url).searchParams.get("id"), 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Липсва училище." }, { status: 400 });
  try {
    await query("DELETE FROM schools WHERE id = $1", [id]);
    return NextResponse.json({ ok: true, schools: await listSchools() });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
