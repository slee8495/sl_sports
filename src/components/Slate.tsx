import Link from "next/link";
import type { ShelfCard } from "@/lib/sources";
import type { Game } from "@/lib/sources/types";
import { gameLabel, isToday, relative, timeLabel } from "@/lib/format";
import { LiveDot, matchup, scoreline } from "@/components/Bits";

/*
  첫 화면(도시 고르기) 맨 위의 경기 목록. 도시 안이 아니라 **여기** 둔다 — 앱을 열자마자
  "지금 뭐 하나, 다음에 뭐 하나" 가 보여야지, 도시를 하나씩 들어가 봐야 알면 소용없다.
*/

/** 맨 위에 늘어놓는 앞으로의 경기 수. */
const UP_NEXT = 5;

const STALE_AFTER = 6 * 3_600_000;

type Slot = { card: ShelfCard; game: Game };

/**
 * 지금 하는 경기 전부, 그리고 **모든 도시를 합쳐** 다음 다섯 경기.
 *
 * 다섯은 팀도 도시도 가리지 않고 시각 순이다. 클리퍼스가 램스보다 먼저 두 번 뛰면 두 번 다 적는다 —
 * "다음에 뭘 볼 수 있나" 를 묻는 자리지, 팀마다 한 줄씩 나눠 주는 자리가 아니다.
 */
export function slate(cards: ShelfCard[]): { live: Slot[]; next: Slot[] } {
  const live = cards.filter((c) => c.live).map((c) => ({ card: c, game: c.live! }));
  /*
    캐시가 낡은 일정을 한 번 내줄 때(stale-while-revalidate) 사흘 전 경기가 "scheduled" 로
    남아 "Up next" 에 "3d ago" 로 섞였다. 시작한 지 여섯 시간이 넘은 경기는 다음 경기가 아니다.
  */
  const cutoff = Date.now() - STALE_AFTER;
  const next = cards
    .flatMap((c) =>
      c.upcoming.filter((g) => g.startsAt && Date.parse(g.startsAt) >= cutoff).map((game) => ({ card: c, game })),
    )
    .sort((a, b) => Date.parse(a.game.startsAt!) - Date.parse(b.game.startsAt!))
    .slice(0, UP_NEXT);
  return { live, next };
}

export function Slate({ cards }: { cards: ShelfCard[] }) {
  const { live, next } = slate(cards);
  if (live.length === 0 && next.length === 0) {
    return <p className="mt-3 text-sm text-dim">Nothing scheduled. Every team is between seasons.</p>;
  }
  return (
    <>
      {live.length > 0 && <SlateList title={<><LiveDot /> Live now</>} slots={live} live />}
      {next.length > 0 && <SlateList title="Up next" slots={next} />}
    </>
  );
}

function SlateList({ title, slots, live }: { title: React.ReactNode; slots: Slot[]; live?: boolean }) {
  return (
    <section className="mt-5">
      <h2 className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-faint uppercase">
        {title}
      </h2>
      <ul className="divide-y divide-edge">
        {slots.map(({ card, game }) => (
          <li key={`${card.team.slug}-${game.id}`}>
            <SlateRow card={card} game={game} live={live} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SlateRow({ card, game, live }: Slot & { live?: boolean }) {
  const score = scoreline(game);
  return (
    <Link href={`/team/${card.team.slug}`} className="group flex items-center gap-3 py-2.5">
      <span
        className="h-9 w-9 shrink-0 rounded-[3px] p-1.5"
        style={{ background: `${card.team.colors.primary}14` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.snapshot.logo ?? card.team.logo} alt="" className="h-full w-full object-contain" />
      </span>

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
