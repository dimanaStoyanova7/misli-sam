import { NextResponse } from "next/server";
import { dbErrorResponse, finish, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { validateSettings } from "@/lib/subjects";

export const runtime = "nodejs";

// Body: { stages: ["5-7", "8-12"], subjects: ["Математика"] }
export async function PUT(req) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  const session = auth.session;
  const body = await req.json().catch(() => ({}));
  const clean = validateSettings(body);
  if (clean.error) return finish(NextResponse.json({ error: clean.error }, { status: 400 }), session);
  try {
    await query("UPDATE teachers SET settings = $1::jsonb WHERE id = $2", [JSON.stringify(clean), session.teacherId]);
    return finish(NextResponse.json({ settings: clean }), session);
  } catch (err) {
    return finish(dbErrorResponse(err), session);
  }
}
