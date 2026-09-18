import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { ChatWidget } from "./ChatWidget";
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
  description: "Seven teams, one shelf. Next game, roster, standings — no guessing.",
  appleWebApp: {
    capable: true,
    title: "SL Sports",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101215",
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
        <ChatWidget />
      </body>
    </html>
  );
}
