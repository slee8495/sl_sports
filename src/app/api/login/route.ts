import { NextResponse } from "next/server";
import { PIN_COOKIE, pinToken } from "@/lib/pinCookie";

export async function POST(req: Request) {
  const form = await req.formData();
  const pin = process.env.APP_PIN;
  const ok = !!pin && String(form.get("pin") ?? "").trim() === pin;
  const res = NextResponse.redirect(new URL(ok ? "/" : "/login?wrong=1", req.url), 303);
  if (ok && pin)
    res.cookies.set(PIN_COOKIE, await pinToken(pin), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  return res;
}
