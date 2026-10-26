import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const r = NextResponse.json({ ok: true });
  r.cookies.delete("ks-session");
  return r;
}
