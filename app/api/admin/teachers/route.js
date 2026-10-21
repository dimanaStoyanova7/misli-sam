import { NextResponse } from "next/server";
import { dbErrorResponse, isAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deny = () => NextResponse.json({ error: "Грешна парола." }, { status: 401 });

async function listTeachers(schoolId) {
  return query(
    `SELECT t.id, t.name, t.created_at, t.last_login, (t.pin_hash IS NULL) AS pin_reset,
            (t.locked_until IS NOT NULL AND t.locked_until > now()) AS locked,
            (SELECT count(*)::int FROM usage u WHERE u.teacher_id = t.id AND u.kind = 'analyze' AND u.created_at >= date_trunc('month', now())) AS analyses_month,
            (SELECT count(*)::int FROM assignments a WHERE a.teacher_id = t.id) AS saved
       FROM teachers t
      WHERE t.school_id = $1
      ORDER BY t.name`,
    [schoolId]
  );
}

export async function GET(req) {
  if (!isAdmin(req)) return deny();
  const schoolId = Number.parseInt(new URL(req.url).searchParams.get("schoolId"), 10);
  if (!Number.isFinite(schoolId)) return NextResponse.json({ error: "Липсва училище." }, { status: 400 });
  try {
    return NextResponse.json({ teachers: await listTeachers(schoolId) });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

// { id, resetPin: true } – the teacher's next login sets a new PIN; also logs them out everywhere.
export async function PATCH(req) {
  if (!isAdmin(req)) return deny();
  const body = await req.json().catch(() => ({}));
  const id = Number.parseInt(body.id, 10);
  if (!Number.isFinite(id) || !body.resetPin) return NextResponse.json({ error: "Невалидна заявка." }, { status: 400 });
  try {
    const rows = await query(
      "UPDATE teachers SET pin_hash = NULL, failed_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING school_id",
      [id]
    );
    if (!rows.length) return NextResponse.json({ error: "Учителят не е намерен." }, { status: 404 });
    await query("DELETE FROM sessions WHERE teacher_id = $1", [id]);
    return NextResponse.json({ ok: true, teachers: await listTeachers(rows[0].school_id) });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

// Deletes the teacher's profile together with their saved assignments.
export async function DELETE(req) {
  if (!isAdmin(req)) return deny();
  const id = Number.parseInt(new URL(req.url).searchParams.get("id"), 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Невалидна заявка." }, { status: 400 });
  try {
    const rows = await query("DELETE FROM teachers WHERE id = $1 RETURNING school_id", [id]);
    if (!rows.length) return NextResponse.json({ error: "Учителят не е намерен." }, { status: 404 });
    return NextResponse.json({ ok: true, teachers: await listTeachers(rows[0].school_id) });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
