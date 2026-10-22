import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getShelfCard, type ShelfCard } from "@/lib/sources";
import { CITIES, findCity, teamsByShelf } from "@/lib/sources/teams";
import type { Game } from "@/lib/sources/types";
import { dayLabel, gameLabel, isToday, relative, timeLabel, todayLabel } from "@/lib/format";
import { LiveDot, matchup, scoreline } from "@/components/Bits";

/*
  값은 fetch 캐시가 들고 있고(출처마다 TTL 이 다르다), 이 페이지는 매번 새로 그린다 —
  "in 2h" 같은 글자는 구워 두면 몇 시간 뒤에 거짓말이 된다. 바깥으로 나가는 요청은
  캐시가 막아 주므로, 새로 그린다고 해서 남의 서버를 다시 부르는 것은 아니다.
*/
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const city = findCity((await params).city);
  return { title: city ? `${city.name} · SL Sports` : "SL Sports" };
}

/** 도시 서가 맨 위에 늘어놓는 앞으로의 경기 수. */
const UP_NEXT = 5;

type Slot = { card: ShelfCard; game: Game };

/**
 * 맨 위 두 줄 묶음 — 지금 하는 경기 전부, 그리고 이 도시 팀들의 다음 다섯 경기.
 *
 * 다섯은 팀을 가리지 않고 시각 순이다. 클리퍼스가 램스보다 먼저 두 번 뛰면 두 번 다 적는다 —
 * "다음에 뭘 볼 수 있나" 를 묻는 자리지, 팀마다 한 줄씩 나눠 주는 자리가 아니다.
 */
function slate(cards: ShelfCard[]): { live: Slot[]; next: Slot[] } {
  const live = cards.filter((c) => c.live).map((c) => ({ card: c, game: c.live! }));
  const next = cards
    .flatMap((c) => c.upcoming.filter((g) => g.startsAt).map((game) => ({ card: c, game })))
    .sort((a, b) => a.game.startsAt!.localeCompare(b.game.startsAt!))
    .slice(0, UP_NEXT);
  return { live, next };
}

export default async function Library({ params }: { params: Promise<{ city: string }> }) {
  const city = findCity((await params).city);
  if (!city) notFound();

  const shelves = teamsByShelf(city.key);
  const cards = await Promise.all(shelves.flatMap((s) => s.teams).map(getShelfCard));
  const bySlug = new Map(cards.map((c) => [c.team.slug, c]));
  const top = slate(cards);

  return (
    <main>
      <Link href="/" className="inline-block py-2 text-xs text-faint hover:text-dim">
        ← Cities
      </Link>

      <header className="pt-2 pb-7">
        <p className="text-xs tracking-wide text-faint">
          <span className="font-semibold text-dim">{city.name}</span> · {todayLabel()}
        </p>
        {top.live.length > 0 && (
          <SlateList title={<><LiveDot /> Live now</>} slots={top.live} live />
        )}
        {top.next.length > 0 && <SlateList title="Up next" slots={top.next} />}
        {top.live.length === 0 && top.next.length === 0 && (
          <p className="mt-3 text-sm text-dim">Nothing scheduled. Every team is between seasons.</p>
        )}
      </header>

      {shelves.map(({ shelf, teams }) => (
        <section key={shelf} className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="wide text-[13px] font-semibold text-dim">{shelf}</h2>
            <span className="h-px flex-1 bg-edge" />
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
            {teams.map((team) => {
              const card = bySlug.get(team.slug);
              return card ? <Cover key={team.slug} card={card} /> : null;
            })}
          </div>

          {/* 표지들이 놓인 선반. 카드가 허공에 뜨지 않게 바닥을 하나 그어 준다. */}
          <div className="mt-6 h-px bg-gradient-to-r from-transparent via-edge to-transparent" />
        </section>
      ))}
    </main>
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

/**
 * 한 팀의 표지.
 *
 * 서가에 꽂힌 경기 프로그램 한 권처럼 보이게 했다 — 왼쪽에 팀 색 책등, 가운데 로고, 아래
 * 다음 경기 한 줄. **로고를 크게 두는 게 요점이다.** 이름을 읽어서 고르는 화면이 아니라
 * 색과 모양으로 짚는 화면이다.
 */
function Cover({ card }: { card: ShelfCard }) {
  const { team, snapshot, next, live, last } = card;

  return (
    <Link href={`/team/${team.slug}`} className="group block">
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-[3px] border border-edge bg-riser transition-transform duration-200 group-hover:-translate-y-1"
        /*
          밝은 바탕에서는 팀색을 어두울 때만큼 넣으면 표지가 물든 종이처럼 보인다.
          번짐은 절반으로 줄이고, 대신 그림자를 또렷하게 해서 표지가 선반 위에 놓이게 했다.
        */
        style={{
          boxShadow: "0 10px 20px -14px rgba(16,20,28,.5)",
          backgroundImage: `radial-gradient(120% 90% at 50% 38%, ${team.colors.primary}1a 0%, transparent 64%)`,
        }}
      >
        {/* 책등. 이 색이 곧 팀 이름이다. */}
        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: team.colors.primary }} aria-hidden />

        <div className="flex h-full flex-col justify-between p-3 pl-4">
          <div className="flex justify-end">
            {live ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide">
                <LiveDot /> LIVE
              </span>
            ) : card.record ? (
              <span className="text-[11px] text-dim tnum">{card.record}</span>
            ) : null}
          </div>

          <div className="flex flex-1 items-center justify-center py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={snapshot.logo ?? team.logo}
              alt={team.name}
              className="max-h-[62%] w-[66%] object-contain drop-shadow-[0_5px_12px_rgba(16,20,28,.22)]"
            />
          </div>

          <div>
            <p className="wide truncate text-[13px] font-semibold leading-tight">{team.nickname}</p>
            <p className="truncate text-[10px] text-faint">{team.league}</p>
          </div>
        </div>
      </div>

      {/* 표지 밖의 쪽지. 다음에 언제 하는지는 표지가 아니라 여기 적힌다. */}
      <p className="mt-2 truncate text-[11px] leading-snug text-dim tnum">
        {live
          ? `${scoreline(live) ?? "In progress"} ${matchup(live)}`
          : card.scheduleFailed
            ? "Schedule unavailable"
            : next
              ? `${matchup(next)} · ${isToday(next.startsAt) ? "Tonight" : dayLabel(next.startsAt)}`
              : last
                ? `Season over · last ${last.result} ${scoreline(last) ?? ""}`
                : "No games scheduled"}
      </p>
    </Link>
  );
}
