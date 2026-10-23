import { NextResponse } from "next/server";
import { dbErrorResponse, finish, requireSession } from "@/lib/auth";
import { cleanTitle, deleteAssignment, getAssignment, renameAssignment } from "@/lib/assignments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function withSession(req, params, fn) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return finish(NextResponse.json({ error: "Невалиден материал." }, { status: 400 }), auth.session);
  try {
    return finish(await fn(auth.session, id), auth.session);
  } catch (err) {
    return finish(dbErrorResponse(err), auth.session);
  }
}

export async function GET(req, { params }) {
  return withSession(req, params, async (session, id) => {
    const row = await getAssignment(session, id);
    if (!row) return NextResponse.json({ error: "Материалът не е намерен." }, { status: 404 });
    return NextResponse.json({
      id: row.id,
      title: row.title,
      context: row.context,
      analysis: { ...row.analysis, title: row.title, assignmentId: row.id },
      selected: row.selected,
      final: row.final ? { ...row.final, title: row.title } : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  });
}

export async function DELETE(req, { params }) {
  return withSession(req, params, async (session, id) => {
    const ok = await deleteAssignment(session, id);
    if (!ok) return NextResponse.json({ error: "Материалът не е намерен." }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}

// Body: { title } – rename the material.
export async function PATCH(req, { params }) {
  return withSession(req, params, async (session, id) => {
    const body = await req.json().catch(() => ({}));
    const title = cleanTitle(body?.title);
    if (!title) return NextResponse.json({ error: "Заглавието не може да е празно." }, { status: 400 });
    const saved = await renameAssignment(session, id, title);
    if (!saved) return NextResponse.json({ error: "Материалът не е намерен." }, { status: 404 });
    return NextResponse.json({ title: saved });
  });
}
