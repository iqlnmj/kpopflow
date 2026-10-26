import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
export function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET minimal 32 karakter wajib dikonfigurasi.");
  return new TextEncoder().encode(s);
}
export function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export async function session() {
  const token = (await cookies()).get("ks-session")?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "kshorts",
      audience: "creator",
    });
    return payload.sub === "creator";
  } catch {
    return false;
  }
}
export async function issue() {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("creator")
    .setIssuer("kshorts")
    .setAudience("creator")
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  const expected =
    process.env.APP_ORIGIN ||
    `${new URL(req.url).protocol}//${req.headers.get("host")}`;
  return !!o && o === expected;
}
const attempts = new Map<string, { count: number; time: number }>();
export function rateLimit(key: string, max = 20, windowMs = 60000) {
  const now = Date.now();
  for (const [k, v] of attempts)
    if (now - v.time > windowMs) attempts.delete(k);
  const a = attempts.get(key);
  if (a && now - a.time < windowMs) {
    if (a.count >= max)
      throw new Error("Terlalu banyak permintaan. Coba lagi nanti.");
    a.count++;
  } else attempts.set(key, { count: 1, time: now });
}
