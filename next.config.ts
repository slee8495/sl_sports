import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    **남의 이미지를 부를 때 우리 주소를 안 밝힌다.** 네이버 이미지 서버(sports-phinf.pstatic.net)는
    다른 사이트에서 온 요청(Referer)을 "Referral Denied" 403 으로 막고, Referer 가 없으면 준다.
    그래서 LG·수원 화면의 로고가 전부 빈칸이었다(소유자 지적). ESPN·MaxPreps 이미지는
    Referer 가 없어도 그대로 온다(2026-10 확인).

    `<meta name="referrer">` 로는 안 된다 — 첫 화면의 <img> 는 브라우저가 HTML 을 읽어 들이는
    중에 먼저 부르고, 그때는 메타가 안 걸려 있었다(배포본에서 확인: 메타는 있는데 로고 셋 다
    403). 응답 헤더는 HTML 을 읽기 전에 걸린다.
  */
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};

export default nextConfig;
