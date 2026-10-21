import { NextResponse } from "next/server";
import { dbErrorResponse, findSchool, loginTeacher, withLoginCookie } from "@/lib/auth";

export const runtime = "nodejs";

const slow = () => new Promise((r) => setTimeout(r, 600)); // slows down guessing

// Step 1: { code } -> checks the school code and returns the school's name.
// Step 2: { code, name, pin, mode: "login" | "create" } -> logs the teacher in.
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
    if (body.name === undefined && body.pin === undefined) {
      const school = await findSchool(code);
      if (!school) {
        await slow();
        return NextResponse.json({ error: "Невалиден или неактивен код." }, { status: 401 });
      }
      return NextResponse.json({ school: school.name });
    }

    const mode = body.mode === "create" ? "create" : "login";
    const result = await loginTeacher({ code, name: body.name, pin: body.pin, mode });
    if (!result.ok) {
      if (result.status === 401) await slow();
      const { status, ...rest } = result;
      return NextResponse.json(rest, { status });
    }
    return withLoginCookie(
      NextResponse.json({ school: result.school, teacher: result.teacher, pinWasSet: result.pinWasSet }),
      result.token
    );
  } catch (err) {
    return dbErrorResponse(err);
  }
}
