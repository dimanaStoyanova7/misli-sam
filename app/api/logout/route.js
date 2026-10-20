import { NextResponse } from "next/server";
import { clearCookie, logout } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    await logout(req);
  } catch (err) {
    console.error(err);
  }
  const res = NextResponse.json({ ok: true });
  clearCookie(res);
  return res;
}
