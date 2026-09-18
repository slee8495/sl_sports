import Link from "next/link";
import { getShelfCard, type ShelfCard } from "@/lib/sources";
import { teamsByShelf } from "@/lib/sources/teams";
import { dayLabel, isToday, relative, timeLabel, todayLabel } from "@/lib/format";
import { LiveDot, matchup, scoreline } from "@/components/Bits";

/*
  값은 fetch 캐시가 들고 있고(출처마다 TTL 이 다르다), 이 페이지는 매번 새로 그린다 —
  "in 2h" 같은 글자는 구워 두면 몇 시간 뒤에 거짓말이 된다. 바깥으로 나가는 요청은
  캐시가 막아 주므로, 새로 그린다고 해서 남의 서버를 다시 부르는 것은 아니다.
*/
export const dynamic = "force-dynamic";

/** 일곱 팀 중 지금 제일 중요한 한 경기. 하는 중인 경기가 있으면 그게 언제나 이긴다. */
function headline(cards: ShelfCard[]): { card: ShelfCard; live: boolean } | null {
  const live = cards.find((c) => c.live);
  if (live) return { card: live, live: true };

  const next = cards
    .filter((c) => c.next?.startsAt)
    .sort((a, b) => (a.next!.startsAt ?? "").localeCompare(b.next!.startsAt ?? ""))[0];
  return next ? { card: next, live: false } : null;
}

export default async function Library() {
  const shelves = teamsByShelf();
  const cards = await Promise.all(shelves.flatMap((s) => s.teams).map(getShelfCard));
  const bySlug = new Map(cards.map((c) => [c.team.slug, c]));
  const top = headline(cards);

  return (
    <main>
      <header className="pt-2 pb-7">
        <p className="text-xs tracking-wide text-faint">{todayLabel()}</p>
        {top ? <Headline card={top.card} live={top.live} /> : (
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

function Headline({ card, live }: { card: ShelfCard; live: boolean }) {
  const game = live ? card.live! : card.next!;
  const score = scoreline(game);
  const today = isToday(game.startsAt);

  return (
    <Link href={`/team/${card.team.slug}`} className="group mt-3 block">
      <div className="flex items-start gap-4">
        <span
          className="mt-1 h-12 w-12 shrink-0 rounded-[3px] p-1.5"
          style={{ background: `${card.team.colors.primary}1f` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.snapshot.logo ?? card.team.logo} alt="" className="h-full w-full object-contain" />
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {live && <LiveDot />}
            <span className="text-xs font-semibold tracking-wide" style={{ color: card.team.colors.primary }}>
              {live ? "Playing now" : today ? "Today" : dayLabel(game.startsAt)}
            </span>
          </div>

          <h1 className="wide mt-1 text-[26px] leading-[1.05] font-semibold sm:text-[32px]">
            {card.team.shortName} {matchup(game)}
          </h1>

          <p className="mt-1.5 text-sm text-dim tnum">
            {live && score ? `${score} · ${game.statusDetail ?? "In progress"}` : null}
            {!live && (game.timeTbd ? "Time TBD" : `${timeLabel(game.startsAt)} · ${relative(game.startsAt)}`)}
            {game.venue ? ` · ${game.venue}` : ""}
          </p>
        </div>
      </div>
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
        className="relative aspect-[3/4] overflow-hidden rounded-[3px] bg-riser transition-transform duration-200 group-hover:-translate-y-1"
        style={{
          boxShadow: "0 10px 20px -12px rgba(0,0,0,.8)",
          backgroundImage: `radial-gradient(120% 90% at 50% 38%, ${team.colors.primary}2e 0%, transparent 62%)`,
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
              className="max-h-[62%] w-[66%] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,.55)]"
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
