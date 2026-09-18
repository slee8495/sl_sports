"use client";

import { useState } from "react";
import Link from "next/link";
import type { Team } from "@/lib/sources/teams";
import { defaultProgram, type Injury, type Program, type Roster, type ScheduleSplit } from "@/lib/sources";
import { recordOf, splitSchedule } from "@/lib/sources/split";
import { Ball } from "@/components/Ball";
import type { Article, Fetched, Game, StandingsGroup, TeamSnapshot } from "@/lib/sources/types";
import { dayLabel, gameLabel, relative, shortDate, timeLabel } from "@/lib/format";
import { Empty, Failed, FormStrip, GameRow, LiveDot, PlayMark, scoreline, SectionTitle, Side, Tickets } from "@/components/Bits";
import type { Highlight } from "@/lib/sources/youtube";

type Props = {
  team: Team;
  programs: Fetched<Program[]>;
  news: Fetched<Article[]>;
  live: Fetched<Game | null>;
  /** 종목별 최근 경기 하이라이트. 서버가 미리 찾아 둔다(`page.tsx`). */
  highlights: Record<string, Highlight>;
};

type TabKey = "now" | "schedule" | "roster" | "standings" | "news";

export function TeamView({ team, programs, news, live: liveNow, highlights }: Props) {
  /*
    **종목이 화면의 단위다.** 오렌지 루터란은 한 학교가 풋볼도 야구도 하고, 전적도
    순위표도 로스터도 종목마다 다르다. 그래서 고른 종목이 이 화면 전체를 정한다 —
    탭 하나만 갈리는 게 아니다.
  */
  const list = programs ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const program = list.find((p) => p.key === picked) ?? defaultProgram(list);

  const split = splitSchedule(program?.games ?? []);
  // 스코어보드 쪽이 더 빨리 갱신된다. 일정에 아직 안 반영된 진행 중 경기는 그쪽 것을 쓴다.
  const live = liveNow ?? split.live;
  const roster = program?.roster ?? null;
  const standings = program?.standings ?? null;
  const injuries = program?.injuries ?? null;

  /*
    **없는 탭은 안 그린다.** 고등학교 야구에는 아직 순위표가 없고(비시즌), 로스터도 종목마다
    있고 없고가 다르다. 빈 탭을 남겨 두면 누를 때마다 "없음" 을 보여 주는 셈이고, 그건
    고장처럼 보인다.
  */
  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: "now", label: "Now", show: true },
    { key: "schedule", label: "Schedule", show: programs !== null },
    { key: "roster", label: "Roster", show: !!roster && roster.players.length > 0 },
    { key: "standings", label: "Standings", show: !!standings && standings.length > 0 },
    { key: "news", label: "News", show: !!news && news.length > 0 },
  ];
  const [tab, setTab] = useState<TabKey>("now");
  const visible = tabs.filter((t) => t.show);
  // 종목을 바꿨더니 지금 보던 탭이 사라지는 경우가 있다(야구에는 순위표가 없다).
  const active = visible.some((t) => t.key === tab) ? tab : "now";

  return (
    <main style={{ ["--team" as string]: team.colors.primary, ["--team-2" as string]: team.colors.secondary }}>
      <Link href="/" className="inline-block py-2 text-xs text-faint hover:text-dim">
        ← Shelf
      </Link>

      <Hero
        team={team}
        snapshot={program?.snapshot ?? { record: null, standingSummary: null, logo: team.logo, venue: null, venueCity: null }}
        finished={split.finished}
        live={live}
        record={program?.snapshot.record ?? recordOf(split.finished)}
      />

      {/*
        **종목 고르기.** 종목이 하나뿐인 팀에는 고를 것이 없으므로 이 줄이 아예 없다 —
        누를 수 없는 단추 하나를 남겨 두는 것보다 낫다.
      */}
      {list.length > 1 && (
        <div className="mt-4 flex gap-2">
          {list.map((p) => {
            const on = p.key === program?.key;
            return (
              <button
                key={p.key}
                onClick={() => setPicked(p.key)}
                aria-pressed={on}
                className={`flex items-center gap-2 rounded-[3px] border px-3 py-2 text-[13px] transition-colors ${
                  on ? "border-transparent font-medium text-ink" : "border-edge text-faint hover:text-dim"
                }`}
                style={on ? { background: `${team.colors.primary}1f` } : undefined}
              >
                <Ball kind={p.ball} size={on ? 22 : 20} />
                {p.label}
                {/* 지금 시즌인 종목을 표시한다. 겨울에 열면 둘 다 조용하다. */}
                {p.inSeason && <span className="h-1.5 w-1.5 rounded-full bg-win" aria-label="in season" />}
              </button>
            );
          })}
        </div>
      )}

      <nav className="no-scrollbar -mx-5 mt-6 flex gap-5 overflow-x-auto border-b border-edge px-5">
        {visible.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 text-[13px] font-medium transition-colors ${
              active === t.key ? "text-ink" : "border-transparent text-faint hover:text-dim"
            }`}
            style={active === t.key ? { borderColor: team.colors.primary } : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="pt-6">
        {active === "now" && (
          <NowTab
            team={team}
            split={split}
            live={live}
            injuries={injuries}
            roster={roster}
            program={program}
            failed={programs === null}
            highlight={program ? highlights[program.key] : undefined}
          />
        )}
        {active === "schedule" && <ScheduleTab team={team} split={split} program={program} failed={programs === null} />}
        {active === "roster" && <RosterTab roster={roster} injuries={injuries} />}
        {active === "standings" && <StandingsTab standings={standings} accent={team.colors.primary} />}
        {active === "news" && <NewsTab news={news} />}
      </div>
    </main>
  );
}

/**
 * 팀 배너.
 *
 * 서가에서 표지를 골라 들어온 화면이라 **같은 색이 그대로 이어져야 한다** — 표지의 책등이
 * 여기서 배너가 된다. 전적 옆에 최근 열 경기 띠를 붙인 이유는, 숫자는 얼마나 이겼는지만
 * 말하고 지금 흐름이 어떤지는 말하지 않기 때문이다.
 */
function Hero({
  team,
  snapshot,
  finished,
  live,
  record,
}: {
  team: Team;
  snapshot: TeamSnapshot;
  finished: Game[];
  live: Game | null;
  record: string | null;
}) {
  return (
    <header
      className="relative overflow-hidden rounded-[4px] border border-edge p-5 pl-6"
      style={{
        backgroundImage: `linear-gradient(115deg, ${team.colors.primary}26 0%, ${team.colors.primary}08 45%, transparent 75%)`,
        backgroundColor: "var(--color-riser)",
      }}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: team.colors.primary }} aria-hidden />

      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={snapshot.logo ?? team.logo} alt="" className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20" />

        <div className="min-w-0">
          <h1 className="wide text-[24px] leading-[1.05] font-semibold sm:text-[30px]">{team.name}</h1>
          <p className="mt-1 text-xs text-dim">{team.league}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {record && <span className="text-sm font-semibold tnum">{record}</span>}
            {snapshot.standingSummary && <span className="text-xs text-dim">{snapshot.standingSummary}</span>}
            <FormStrip games={finished} />
            {live && (
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <LiveDot /> {scoreline(live) ?? "Live"}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────── Now ────────────────────────────── */

function NowTab({
  team,
  split,
  live,
  injuries,
  roster,
  program,
  failed,
  highlight,
}: {
  team: Team;
  split: ScheduleSplit;
  live: Game | null;
  injuries: Fetched<Injury[]>;
  roster: Fetched<Roster>;
  program: Program | null;
  failed: boolean;
  highlight?: Highlight;
}) {
  if (failed) return <Failed what="the schedule" />;

  const pastSeason = program?.pastSeason ?? null;
  const showNextHome = split.nextHome && split.nextHome.id !== split.next?.id;
  const hurt = (injuries ?? []).filter((i) => !/^active$/i.test(i.status));

  return (
    <div className="flex flex-col gap-8">
      {pastSeason && (
        <p className="rounded-[3px] border border-edge px-3 py-2 text-xs text-dim">
          This season&apos;s schedule isn&apos;t out yet. Showing {pastSeason - 1}–{String(pastSeason).slice(2)}.
        </p>
      )}

      {live ? (
        <Feature title="Playing now" game={live} accent={team.colors.primary} live ticketsUrl={team.ticketsUrl} />
      ) : split.next ? (
        <Feature title="Next game" game={split.next} accent={team.colors.primary} ticketsUrl={team.ticketsUrl} />
      ) : (
        <Empty>No games scheduled. Check back when the season opens.</Empty>
      )}

      {showNextHome && split.nextHome && (
        <section>
          <SectionTitle aside={relative(split.nextHome.startsAt)}>Next home game</SectionTitle>
          <div className="rounded-[3px] border border-edge px-4 py-3">
            <p className="flex items-center gap-2 text-sm">
              <Side game={split.nextHome} accent={team.colors.primary} />
              {split.nextHome.opponent.name}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-dim tnum">
                {gameLabel(split.nextHome.startsAt, split.nextHome.timeTbd)}
                {split.nextHome.venue ? ` · ${split.nextHome.venue}` : ""}
              </span>
              {(() => {
                const perGame = split.nextHome?.links.find((l) => /ticket/i.test(l.label));
                const url = perGame?.url ?? team.ticketsUrl;
                return url ? <Tickets url={url} /> : null;
              })()}
            </div>
          </div>
        </section>
      )}

      {split.last && (
        <section>
          <SectionTitle aside={relative(split.last.startsAt)}>Last game</SectionTitle>
          <GameRow game={split.last} accent={team.colors.primary} teamName={team.shortName} />
          {highlight && (
            <a
              href={highlight.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-[3px] border border-edge px-3 py-2 text-xs hover:border-dim"
            >
              <PlayMark />
              {/*
                찾은 영상이면 제목을 그대로 보여 준다 — 무엇이 열릴지 알고 누르는 것과
                모르고 누르는 것은 다르다. 못 찾았으면 유튜브 검색으로 간다고 적는다.
              */}
              <span className="truncate">{highlight.exact ? (highlight.title ?? "Highlights") : "Search highlights"}</span>
            </a>
          )}
        </section>
      )}

      {roster && roster.coaches.length > 0 && (
        <section>
          <SectionTitle>Staff</SectionTitle>
          <ul className="flex flex-col gap-2">
            {roster.coaches.map((c) => (
              <li key={c.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span>{c.name}</span>
                <span className="text-xs text-dim">
                  {c.title}
                  {c.experience ? ` · ${c.experience}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hurt.length > 0 && (
        <section>
          <SectionTitle aside={`${hurt.length} out or limited`}>Injury report</SectionTitle>
          <ul className="flex flex-col divide-y divide-edge/70">
            {hurt.slice(0, 8).map((i) => (
              <li key={`${i.player}-${i.date ?? ""}`} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-sm">{i.player}</span>
                <span className="shrink-0 text-xs" style={{ color: "var(--color-loss)" }}>
                  {i.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** 다음 경기 한 장. 이 화면에 들어온 이유의 절반이 이 칸이다. */
function Feature({
  title,
  game,
  accent,
  live = false,
  ticketsUrl,
}: {
  title: string;
  game: Game;
  accent: string;
  live?: boolean;
  ticketsUrl?: string | null;
}) {
  const score = scoreline(game);
  const buyable = !live && game.isHome === true && !game.neutralSite;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {live && <LiveDot />}
        <h2 className="wide text-sm font-semibold">{title}</h2>
        {!live && <span className="text-xs text-faint tnum">{relative(game.startsAt)}</span>}
      </div>

      <div className="rounded-[4px] border border-edge bg-riser p-5" style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
        <p className="wide text-[22px] leading-tight font-semibold tnum sm:text-[26px]">
          {game.timeTbd ? dayLabel(game.startsAt) : `${dayLabel(game.startsAt)} · ${timeLabel(game.startsAt)}`}
        </p>

        <div className="mt-3 flex items-center gap-3">
          {game.opponent.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.opponent.logo} alt="" className="h-9 w-9 object-contain" />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-[15px]">
              <Side game={game} accent={accent} />
              {game.opponent.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-dim">
              {[game.venue, game.broadcast, game.note].filter(Boolean).join(" · ") || "Venue TBA"}
            </p>
          </div>
          {live && score && <span className="ml-auto text-2xl font-semibold tnum">{score}</span>}
        </div>

        {live && game.statusDetail && <p className="mt-3 text-xs text-dim">{game.statusDetail}</p>}

        {/*
          바깥으로 나가는 링크들. **홈경기면 티켓이 맨 앞이다** — 이 카드를 보는 이유의
          절반이 "보러 갈 수 있나" 이고, 그 답이 예일 때 할 일이 이것뿐이다.
        */}
        {(buyable || game.links.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {buyable && ticketsUrl && !game.links.some((l) => /ticket/i.test(l.label)) && (
              <a
                href={ticketsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-[2px] px-3 py-1.5 text-xs font-medium"
                style={{ background: `${accent}24`, color: "var(--color-ink)" }}
              >
                Tickets
              </a>
            )}
            {game.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className={`rounded-[2px] px-3 py-1.5 text-xs ${
                  /ticket/i.test(l.label) ? "font-medium" : "border border-edge hover:border-dim"
                }`}
                style={/ticket/i.test(l.label) ? { background: `${accent}24`, color: "var(--color-ink)" } : undefined}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────────── Schedule ────────────────────────────── */

function ScheduleTab({
  team,
  split,
  program,
  failed,
}: {
  team: Team;
  split: ScheduleSplit;
  program: Program | null;
  failed: boolean;
}) {
  if (failed) return <Failed what="the schedule" />;
  if (!program) return <Empty>No schedule published yet.</Empty>;

  return (
    <div className="flex flex-col gap-8">
      {split.upcoming.length > 0 && (
        <section>
          <SectionTitle aside={`${split.upcoming.length} left`}>Upcoming</SectionTitle>
          <div>
            {split.upcoming.map((g) => (
              <GameRow key={g.id} game={g} accent={team.colors.primary} ticketsUrl={team.ticketsUrl} />
            ))}
          </div>
        </section>
      )}

      {split.finished.length > 0 && (
        <section>
          <SectionTitle aside={recordOf(split.finished) ?? undefined}>Results</SectionTitle>
          <div>
            {[...split.finished].reverse().map((g) => (
              <GameRow key={g.id} game={g} accent={team.colors.primary} teamName={team.shortName} />
            ))}
          </div>
        </section>
      )}

      {split.upcoming.length === 0 && split.finished.length === 0 && (
        /*
          비시즌이다. **"없다" 가 아니라 "아직" 이라고 적는다** — 야구는 가을에 0건이고
          봄이 되면 채워진다. 그 둘을 같게 적으면 앱이 고장 난 것으로 읽힌다.
        */
        <Empty>
          Nothing on the {program.label.toLowerCase()} calendar yet. The season hasn&apos;t opened.
        </Empty>
      )}
    </div>
  );
}

/* ────────────────────────────── Roster ────────────────────────────── */

/** ESPN 은 그룹 이름을 "offense" 처럼 소문자로 준다. 제목 자리에 그대로 두면 덜 만든 화면처럼 보인다. */
function titleCase(text: string): string {
  return text.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function RosterTab({ roster, injuries }: { roster: Fetched<Roster>; injuries: Fetched<Injury[]> }) {
  if (roster === null) return <Failed what="the roster" />;
  if (roster.players.length === 0) return <Empty>No roster published for this team.</Empty>;

  /*
    부상 표시는 로스터에도 붙어 오지만 자주 비어 있다. 실제로 채워져 오는 쪽(코어 API)과
    이름으로 맞춰 붙인다 — **다친 선수를 성한 선수처럼 그리는 것이 이 화면의 제일 큰 거짓말이다.**
  */
  const hurtBy = new Map((injuries ?? []).map((i) => [i.player.toLowerCase(), i]));

  const groups = new Map<string, typeof roster.players>();
  for (const p of roster.players) {
    const key = p.positionGroup ?? "Players";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...groups.entries()].map(([group, players]) => (
        <section key={group}>
          <SectionTitle aside={`${players.length}`}>{titleCase(group)}</SectionTitle>
          <ul className="flex flex-col divide-y divide-edge/70">
            {players.map((p) => {
              const injury = p.injury ?? hurtBy.get(p.name.toLowerCase())?.status ?? null;
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-7 shrink-0 text-right text-xs text-faint tnum">{p.jersey ?? ""}</span>

                  {p.headshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.headshot} alt="" className="h-8 w-8 shrink-0 rounded-full bg-riser-2 object-cover object-top" />
                  ) : (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-riser-2 text-[10px] text-faint"
                      aria-hidden
                    >
                      {p.name.charAt(0)}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {p.name}
                      {injury && (
                        <span className="ml-2 text-[10px]" style={{ color: "var(--color-loss)" }}>
                          {injury}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-faint">
                      {/*
                        리그마다 뜻 있는 칸이 다르다 — 프로는 나이와 출신 대학, 고등학교는
                        학년(Sr./Jr.)이 그 자리다. 있는 것만 이어 붙인다.
                      */}
                      {[p.position, p.height, p.weight, p.experience, p.age ? `${p.age}` : null, p.college]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  {/* 다친 선수만 표시한다. 성한 선수까지 줄을 그으면 그 줄이 아무 뜻도 없어진다. */}
                  {injury && <span className="h-6 w-[2px] shrink-0 rounded-full bg-loss" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ────────────────────────────── Standings ────────────────────────────── */

function StandingsTab({ standings, accent }: { standings: Fetched<StandingsGroup[]>; accent: string }) {
  if (standings === null) return <Failed what="the standings" />;
  if (standings.length === 0) return <Empty>No standings for this league.</Empty>;

  return (
    <div className="flex flex-col gap-8">
      {standings.map((group) => (
        <section key={`${group.parent ?? ""}-${group.name}`}>
          <SectionTitle aside={group.parent ?? undefined}>{group.name}</SectionTitle>

          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="text-[11px] text-faint">
                  {group.ordered && <th className="w-6 pb-2 text-left font-normal">#</th>}
                  <th className="pb-2 text-left font-normal">Team</th>
                  <th className="pb-2 text-right font-normal">W</th>
                  <th className="pb-2 text-right font-normal">L</th>
                  <th className="pb-2 text-right font-normal">PCT</th>
                  <th className="pb-2 text-right font-normal">GB</th>
                  <th className="pb-2 text-right font-normal">STRK</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {group.rows.map((r, i) => (
                  <tr
                    key={r.teamId ?? r.name}
                    className="border-t border-edge/70"
                    style={r.isUs ? { background: `${accent}12` } : undefined}
                  >
                    {/* 줄을 세운 경우에만 번호를 붙인다. 모르는 순서에 1,2,3 을 적지 않는다. */}
                    {group.ordered && <td className="py-2 pr-1 text-faint">{i + 1}</td>}
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        {r.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.logo} alt="" className="h-5 w-5 shrink-0 object-contain" />
                        ) : (
                          <span className="h-5 w-5 shrink-0" />
                        )}
                        <span className={`truncate ${r.isUs ? "font-semibold" : ""}`}>{r.name}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right">{r.wins ?? "—"}</td>
                    <td className="py-2 text-right">{r.losses ?? "—"}</td>
                    <td className="py-2 text-right text-dim">{r.winPercent ?? "—"}</td>
                    <td className="py-2 text-right text-dim">{r.gamesBehind ?? "—"}</td>
                    <td className="py-2 text-right text-dim">{r.streak ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

/* ────────────────────────────── News ────────────────────────────── */

function NewsTab({ news }: { news: Fetched<Article[]> }) {
  if (news === null) return <Failed what="the news" />;
  if (news.length === 0) return <Empty>No stories yet.</Empty>;

  return (
    <ul className="flex flex-col divide-y divide-edge/70">
      {news.map((a) => (
        <li key={a.id}>
          <a
            href={a.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex gap-3 py-4 transition-opacity hover:opacity-80"
          >
            {a.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" className="h-16 w-24 shrink-0 rounded-[2px] bg-riser object-cover" />
            )}
            <div className="min-w-0">
              <p className="text-sm leading-snug font-medium">{a.headline}</p>
              {a.description && <p className="mt-1 line-clamp-2 text-xs text-dim">{a.description}</p>}
              <p className="mt-1.5 text-[11px] text-faint tnum">
                {[shortDate(a.publishedAt), a.kind === "Media" ? "Video" : null, a.byline].filter(Boolean).join(" · ")}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
