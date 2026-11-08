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
  description: "Four cities, sixteen teams. Next game, roster, standings — no guessing.",
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
          /*
            폭은 휴대폰에서 그대로(옆 20px)이고, 화면이 넓어질수록 여백과 상한만 늘린다.
            넓은 화면에서 한 줄이 끝없이 늘어지지 않게 — 2단으로 나누는 일은 화면마다 한다.
          */
          className="mx-auto w-full max-w-4xl px-5 md:px-8 lg:max-w-6xl"
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
