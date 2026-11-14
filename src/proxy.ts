import { NextResponse, type NextRequest } from "next/server";
import { PIN_COOKIE, pinToken } from "@/lib/pinCookie";

// 웹 화면만 PIN 으로 잠근다. /api/* 는 전부 통과 — SLKeyboard 가 부르는 엔드포인트는
// 각자 isAuthorizedRequest 로 스스로 확인한다. iOS 셸(WKWebView)은 웹과 같이 한 번 넣으면 쿠키로 기억한다.
export async function proxy(req: NextRequest) {
  const pin = process.env.APP_PIN;
  if (!pin) return NextResponse.next();
  if (req.cookies.get(PIN_COOKIE)?.value === (await pinToken(pin))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|api/|_next/|favicon|apple-icon|icon|manifest|opengraph-image|twitter-image|robots|sitemap).*)",
  ],
};
