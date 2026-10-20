import { NextResponse } from "next/server";
import { dbErrorResponse, login, withLoginCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Невалидна заявка." }, { status: 400 });
  }
  const code = String(body?.code || "").trim();
  if (!code) return NextResponse.json({ error: "Въведете кода на училището." }, { status: 400 });

  try {
    const result = await login(code, body?.name);
    if (!result) {
      await new Promise((r) => setTimeout(r, 600)); // slows down code guessing
      return NextResponse.json({ error: "Невалиден или неактивен код." }, { status: 401 });
    }
    return withLoginCookie(NextResponse.json({ school: result.school, teacher: result.teacher }), result.token);
  } catch (err) {
    return dbErrorResponse(err);
  }
}
