import { NextResponse } from "next/server";
import { finish, requireSession, usedThisMonth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = await requireSession(req);
  if (auth.response) {
    // Not logged in is a normal state here, not an error.
    if (auth.response.status === 401) {
      const res = NextResponse.json({ loggedIn: false });
      res.cookies.set("ms_session", "", { path: "/", maxAge: 0 });
      return res;
    }
    return auth.response;
  }
  const s = auth.session;
  let used = null;
  try {
    used = s.monthlyLimit != null ? await usedThisMonth(s.schoolId) : null;
  } catch {}
  return finish(NextResponse.json({ loggedIn: true, school: s.school, teacher: s.teacher, limit: s.monthlyLimit, used }), s);
}
