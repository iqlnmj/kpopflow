import { NextResponse } from "next/server";
import { equal, issue, rateLimit, sameOrigin } from "@/lib/auth";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Origin tidak diizinkan" },
      { status: 403 },
    );
  try {
    rateLimit("login", 8, 900000);
    const { password } = await req.json();
    if (!process.env.APP_PASSWORD)
      return NextResponse.json(
        { error: "APP_PASSWORD belum dikonfigurasi." },
        { status: 503 },
      );
    if (
      typeof password !== "string" ||
      !equal(password, process.env.APP_PASSWORD)
    )
      return NextResponse.json(
        { error: "Password tidak sesuai." },
        { status: 401 },
      );
    const res = NextResponse.json({ ok: true });
    res.cookies.set("ks-session", await issue(), {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(req.headers.get("origin")!).protocol === "https:",
      path: "/",
      maxAge: 43200,
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Login gagal" },
      { status: 429 },
    );
  }
}
