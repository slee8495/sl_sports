import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

/*
  글꼴은 하나만 쓴다 — **폭(width)축이 있는 가변 글꼴**이라 한 벌로 두 목소리를 낸다.
  제목은 폭을 넓혀 유니폼 등번호처럼, 본문은 기본 폭으로. 제목용 글꼴을 따로 들이면
  데이터가 빽빽한 표에서 두 글꼴의 숫자 모양이 서로 안 맞는다.
*/
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SL Sports",
  description: "Eleven teams, one shelf. Next game, roster, standings — no guessing.",
  /*
    **남의 이미지를 부를 때 우리 주소를 안 밝힌다.** 네이버 이미지 서버(sports-phinf.pstatic.net)는
    다른 사이트에서 온 요청(Referer)을 "Referral Denied" 403 으로 막고, Referer 가 없으면 준다.
    그래서 LG·수원 화면의 로고가 전부 빈칸이었다(소유자 지적). ESPN·MaxPreps 이미지는
    Referer 가 없어도 그대로 온다(2026-10 확인).
  */
  referrer: "no-referrer",
  appleWebApp: {
    capable: true,
    title: "SL Sports",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f6f8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/*
          머리말을 여기 두지 않는다. 서가 화면과 팀 화면은 맨 위가 서로 다르게 생겼고
          (한쪽은 오늘, 한쪽은 팀 색 배너), 공통 머리띠를 얹으면 둘 다 반쯤 가려진다.
        */}
        <div
          className="mx-auto w-full max-w-4xl px-5"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 1.25rem)",
            paddingBottom: "max(env(safe-area-inset-bottom), 3rem)",
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
