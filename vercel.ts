import type { VercelConfig } from "@vercel/config/v1";

/**
 * **크론이 없다.**
 *
 * 예전에는 매일 크론이 돌면서 Claude 에게 팀마다 웹을 뒤지게 하고 그 결과를 DB 에 적었다.
 * 그게 이 앱의 유일한 고정 비용이었고(2026-08 에 그래서 껐다), 데이터는 늘 하루쯤 낡아 있었다.
 *
 * 지금은 화면을 열 때 ESPN 공개 JSON 과 학교 캘린더를 그 자리에서 읽는다. 아무것도 안
 * 돌려도 늘 최신이고, 모델을 안 태우니 고정 비용이 0 이다. 되살릴 크론이 없다 —
 * 다시 넣지 말 것.
 */
export const config: VercelConfig = {
  framework: "nextjs",
};
