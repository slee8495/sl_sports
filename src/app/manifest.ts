import type { MetadataRoute } from "next";

/*
  홈 화면에 얹었을 때의 모습. 아이콘은 `assets/icon/gen_icon.py` 가 만들어 둔 파일을 쓴다 —
  예전에는 요청이 올 때마다 서버에서 그렸는데, 1년에 한 번 바뀔까 말까 한 그림을 매번
  그릴 이유가 없다.
*/
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SL Sports",
    short_name: "SL Sports",
    description: "Seven teams, one shelf.",
    start_url: "/",
    display: "standalone",
    background_color: "#101215",
    theme_color: "#101215",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
