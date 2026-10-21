import { NextResponse } from "next/server";
import { dbErrorResponse, finish, requireSession } from "@/lib/auth";
import { listAssignments } from "@/lib/assignments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  try {
    return finish(NextResponse.json({ assignments: await listAssignments(auth.session) }), auth.session);
  } catch (err) {
    return finish(dbErrorResponse(err), auth.session);
  }
}
