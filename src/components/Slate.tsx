import Link from "next/link";
import type { ShelfCard } from "@/lib/sources";
import type { Game } from "@/lib/sources/types";
import { gameLabel, isToday, relative, timeLabel } from "@/lib/format";
import { highlightQuery, nameTokens } from "@/lib/highlight";
import { findHighlight, type Highlight } from "@/lib/sources/youtube";
import { LiveDot, PlayMark, matchup, scoreline } from "@/components/Bits";

/*
  첫 화면(도시 고르기) 맨 위의 경기 목록. 도시 안이 아니라 **여기** 둔다 — 앱을 열자마자
  "지금 뭐 하나, 다음에 뭐 하나" 가 보여야지, 도시를 하나씩 들어가 봐야 알면 소용없다.
*/

/** 맨 위에 늘어놓는 앞으로의 경기 수. */
const UP_NEXT = 5;

/** 그 밑에 늘어놓는 끝난 경기 수. */
const RECENT = 5;

const STALE_AFTER = 6 * 3_600_000;

type Slot = { card: ShelfCard; game: Game };

/**
 * 우리 팀끼리 붙은 경기는 한 줄로.
 *
 * 덕스-아일랜더스 경기가 "Ducks at Islanders L 2–3" 과 "Islanders vs Ducks W 3–2" 로 두 번 떠서
 * 다섯 자리 중 둘을 먹었다. 같은 경기는 출처가 같은 id 를 준다. 남는 쪽은 `TEAMS` 에서 앞선 팀이다.
 */
function once(slots: Slot[]): Slot[] {
  const seen = new Set<string>();
  return slots.filter(({ game }) => {
    const key = `${game.id}|${game.startsAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 지금 하는 경기 전부, 그리고 **모든 도시를 합쳐** 다음 다섯 경기.
 *
 * 다섯은 팀도 도시도 가리지 않고 시각 순이다. 클리퍼스가 램스보다 먼저 두 번 뛰면 두 번 다 적는다 —
 * "다음에 뭘 볼 수 있나" 를 묻는 자리지, 팀마다 한 줄씩 나눠 주는 자리가 아니다.
 */
export function slate(cards: ShelfCard[]): { live: Slot[]; next: Slot[]; recent: Slot[] } {
  const live = once(cards.filter((c) => c.live).map((c) => ({ card: c, game: c.live! })));
  /*
    캐시가 낡은 일정을 한 번 내줄 때(stale-while-revalidate) 사흘 전 경기가 "scheduled" 로
    남아 "Up next" 에 "3d ago" 로 섞였다. 시작한 지 여섯 시간이 넘은 경기는 다음 경기가 아니다.
  */
  const cutoff = Date.now() - STALE_AFTER;
  const next = once(
    cards.flatMap((c) =>
      c.upcoming.filter((g) => g.startsAt && Date.parse(g.startsAt) >= cutoff).map((game) => ({ card: c, game })),
    ),
  )
    .sort((a, b) => Date.parse(a.game.startsAt!) - Date.parse(b.game.startsAt!))
    .slice(0, UP_NEXT);
  // 끝난 경기도 같은 셈이다 — 도시·팀을 안 가리고, 가장 최근에 끝난 것부터 다섯.
  const recent = once(cards.flatMap((c) => c.recent.filter((g) => g.startsAt).map((game) => ({ card: c, game }))))
    .sort((a, b) => Date.parse(b.game.startsAt!) - Date.parse(a.game.startsAt!))
    .slice(0, RECENT);
  return { live, next, recent };
}

/**
 * 끝난 다섯 경기의 하이라이트는 **영상을 직접 찾는다.** 팀 화면의 "Last game" 과 같은 길이고
 * (`findHighlight`, 반나절 캐시), 못 찾으면 유튜브 검색 주소로 돌아간다. 다섯 번이면 부를 만하다.
 */
export async function Slate({ cards }: { cards: ShelfCard[] }) {
  const { live, next, recent } = slate(cards);
  if (live.length === 0 && next.length === 0 && recent.length === 0) {
    return <p className="mt-3 text-sm text-dim">Nothing scheduled. Every team is between seasons.</p>;
  }
  const highlights = await Promise.all(
    recent.map(({ card, game }) =>
      findHighlight(
        highlightQuery(card.team.shortName, game),
        nameTokens(card.team.name, card.team.shortName, card.team.nickname),
        nameTokens(game.opponent.name, game.opponent.shortName),
        game.startsAt,
      ),
    ),
  );
  return (
    <>
      {live.length > 0 && <SlateList title={<><LiveDot /> Live now</>} slots={live} live />}
      {next.length > 0 && <SlateList title="Up next" slots={next} />}
      {recent.length > 0 && <SlateList title="Recent" slots={recent} highlights={highlights} />}
    </>
  );
}

function SlateList({
  title,
  slots,
  live,
  highlights,
}: {
  title: React.ReactNode;
  slots: Slot[];
  live?: boolean;
  /** 끝난 경기 목록에만 — `slots` 와 같은 순서. */
  highlights?: Highlight[];
}) {
  return (
    <section className="mt-5">
      <h2 className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-faint uppercase">
        {title}
      </h2>
      <ul className="divide-y divide-edge">
        {slots.map(({ card, game }, i) => (
          <li key={`${card.team.slug}-${game.id}`}>
            {highlights ? (
              <FinalRow card={card} game={game} highlight={highlights[i]} />
            ) : (
              <SlateRow card={card} game={game} live={live} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamMark({ card }: { card: ShelfCard }) {
  return (
    <span
      className="h-9 w-9 shrink-0 rounded-[3px] p-1.5"
      style={{ background: `${card.team.colors.primary}14` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.snapshot.logo ?? card.team.logo} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

function SlateRow({ card, game, live }: Slot & { live?: boolean }) {
  const score = scoreline(game);
  return (
    <Link href={`/team/${card.team.slug}`} className="group flex items-center gap-3 py-2.5">
      <TeamMark card={card} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight group-hover:underline">
          {card.team.shortName} <span className="font-normal text-dim">{matchup(game)}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-dim tnum">
          {live
            ? [game.statusDetail ?? "In progress", game.venue].filter(Boolean).join(" · ")
            : [
                isToday(game.startsAt) ? (game.timeTbd ? "Today · time TBD" : `Today · ${timeLabel(game.startsAt)}`) : gameLabel(game.startsAt, game.timeTbd),
                relative(game.startsAt),
              ].join(" · ")}
        </p>
      </div>

      {live && score && <span className="shrink-0 text-[15px] font-semibold tnum">{score}</span>}
    </Link>
  );
}

/**
 * 끝난 경기 한 줄 — 결과가 굵고, 오른쪽 끝에 하이라이트.
 *
 * 줄 전체를 링크로 감싸지 않는다. 링크 안에 링크를 넣을 수 없어서, 팀 화면으로 가는 쪽과
 * 영상으로 가는 쪽을 나란히 둔다.
 */
function FinalRow({ card, game, highlight }: Slot & { highlight: Highlight }) {
  const score = scoreline(game);
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link href={`/team/${card.team.slug}`} className="group flex min-w-0 flex-1 items-center gap-3">
        <TeamMark card={card} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight group-hover:underline">
            {card.team.shortName} <span className="font-normal text-dim">{matchup(game)}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-dim tnum">
            {[gameLabel(game.startsAt, game.timeTbd), relative(game.startsAt)].join(" · ")}
          </p>
        </div>
        {score && (
          <span className="flex shrink-0 items-center gap-2">
            {game.result && (
              <span
                className="text-[11px] font-bold"
                style={{
                  color:
                    game.result === "W" ? "var(--color-win)" : game.result === "L" ? "var(--color-loss)" : "var(--color-dim)",
                }}
              >
                {game.result}
              </span>
            )}
            <span className="text-[15px] font-semibold tnum">{score}</span>
          </span>
        )}
      </Link>
      <a
        href={highlight.url}
        target="_blank"
        rel="noreferrer"
        // 찾은 영상이면 그 제목을, 못 찾았으면 검색으로 간다는 것을 손가락을 올렸을 때 알려 준다.
        title={highlight.exact ? (highlight.title ?? "Highlights") : "Search highlights on YouTube"}
        aria-label={`${card.team.shortName} ${matchup(game)} highlights`}
        className="flex shrink-0 items-center gap-1 rounded-[3px] border border-edge px-2 py-1 text-[11px] font-medium text-dim hover:border-dim hover:text-ink"
      >
        <PlayMark />
        Highlights
      </a>
    </div>
  );
}
