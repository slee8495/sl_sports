import type { Ball as BallKind } from "@/lib/sources";

/**
 * 종목을 고르는 단추에 그려지는 공.
 *
 * 글자로 "Football / Baseball" 이라고 써도 되지만, **공은 안 읽고도 안다.** 한 학교가 두
 * 종목을 하는 화면에서 지금 무엇을 보고 있는지는 한눈에 보여야 하는 것이고, 그건 읽는
 * 일보다 빠른 쪽이 낫다.
 *
 * 색은 팀 색을 쓰지 않는다 — 고른 것과 안 고른 것을 가르는 게 이 그림의 일이고, 거기에
 * 팀 색까지 끼면 무엇이 켜져 있는지가 흐려진다. 켜진 쪽은 진하게, 꺼진 쪽은 옅게.
 */
export function Ball({ kind, size = 22 }: { kind: BallKind; size?: number }) {
  const stroke = 1.6;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "football") {
    return (
      <svg {...common}>
        {/* 끝이 뾰족한 타원 — 미식축구공은 실루엣만으로 구분된다. */}
        <path d="M4.2 19.8c-1.1-4.6.1-9.9 3.4-13.2S15 2.3 19.8 4.2c1.1 4.6-.1 9.9-3.4 13.2S9 21.7 4.2 19.8Z" />
        <path d="M9.4 14.6 14.6 9.4" />
        <path d="M10.6 12.4l1.4 1.4M12.4 10.6l1.4 1.4" />
      </svg>
    );
  }

  if (kind === "baseball") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.6" />
        {/* 실밥 두 줄. 야구공을 야구공으로 만드는 건 이 곡선이다. */}
        <path d="M6.2 5.6c2 2.2 2.8 4.3 2.8 6.4s-.8 4.2-2.8 6.4" />
        <path d="M17.8 5.6c-2 2.2-2.8 4.3-2.8 6.4s.8 4.2 2.8 6.4" />
      </svg>
    );
  }

  if (kind === "basketball") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.6" />
        <path d="M12 3.4v17.2M3.4 12h17.2" />
        <path d="M5.9 5.9c3.4 3.4 3.4 8.8 0 12.2M18.1 5.9c-3.4 3.4-3.4 8.8 0 12.2" />
      </svg>
    );
  }

  // 하키는 공이 아니라 퍽이다. 둥근 원으로 그리면 농구공과 구분이 안 된다.
  return (
    <svg {...common}>
      <ellipse cx="12" cy="8.5" rx="8" ry="3.4" />
      <path d="M4 8.5v6.6c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4V8.5" />
    </svg>
  );
}
