"use client";

import { useState } from "react";
import Link from "next/link";
import type { Team } from "@/lib/sources/teams";
import type { Injury, Program, Roster } from "@/lib/sources";
import { recordOf, splitPrograms } from "@/lib/sources/split";
import type { Article, Fetched, Game, StandingsGroup, TeamSnapshot } from "@/lib/sources/types";
import { dayLabel, gameLabel, relative, shortDate, timeLabel } from "@/lib/format";
import { Empty, Failed, FormStrip, GameRow, LiveDot, scoreline, SectionTitle } from "@/components/Bits";

type Props = {
  team: Team;
  snapshot: TeamSnapshot;
  programs: Fetched<Program[]>;
  roster: Fetched<Roster>;
  standings: Fetched<StandingsGroup[]>;
  news: Fetched<Article[]>;
  injuries: Fetched<Injury[]>;
  live: Fetched<Game | null>;
};

type TabKey = "now" | "schedule" | "roster" | "standings" | "news";

export function TeamView(props: Props) {
  const { team, snapshot, programs, roster, standings, news, injuries } = props;

  const split = splitPrograms(programs ?? []);
  // 스코어보드 쪽이 더 빨리 갱신된다. 일정에 아직 안 반영된 진행 중 경기는 그쪽 것을 쓴다.
  const live = props.live ?? split.live;

  /*
    **없는 탭은 안 그린다.** 고등학교 팀에는 로스터도 순위표도 없다(학교가 안 내보낸다).
    빈 탭을 남겨 두면 누를 때마다 "없음" 을 보여 주는 셈이고, 그건 고장처럼 보인다.
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

  return (
    <main style={{ ["--team" as string]: team.colors.primary, ["--team-2" as string]: team.colors.secondary }}>
      <Link href="/" className="inline-block py-2 text-xs text-faint hover:text-dim">
        ← Shelf
      </Link>

      <Hero
        team={team}
        snapshot={snapshot}
        finished={split.finished}
        live={live}
        record={snapshot.record ?? recordOf(split.finished)}
      />

      <nav className="no-scrollbar -mx-5 mt-6 flex gap-5 overflow-x-auto border-b border-edge px-5">
        {visible.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 text-[13px] font-medium transition-colors ${
              tab === t.key ? "text-chalk" : "border-transparent text-faint hover:text-dim"
            }`}
            style={tab === t.key ? { borderColor: team.colors.primary } : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="pt-6">
        {tab === "now" && (
          <NowTab team={team} split={split} live={live} injuries={injuries} roster={roster} programs={programs} />
        )}
        {tab === "schedule" && <ScheduleTab team={team} programs={programs} />}
        {tab === "roster" && <RosterTab roster={roster} injuries={injuries} />}
        {tab === "standings" && <StandingsTab standings={standings} accent={team.colors.primary} />}
        {tab === "news" && <NewsTab news={news} />}
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
      className="relative overflow-hidden rounded-[4px] p-5 pl-6"
      style={{
        backgroundImage: `linear-gradient(115deg, ${team.colors.primary}33 0%, ${team.colors.primary}0d 45%, transparent 75%)`,
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
  programs,
}: {
  team: Team;
  split: ReturnType<typeof splitPrograms>;
  live: Game | null;
  injuries: Fetched<Injury[]>;
  roster: Fetched<Roster>;
  programs: Fetched<Program[]>;
}) {
  if (programs === null) return <Failed what="the schedule" />;

  const pastSeason = programs.find((p) => p.pastSeason)?.pastSeason ?? null;
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
        <Feature title="Playing now" game={live} accent={team.colors.primary} live />
      ) : split.next ? (
        <Feature title="Next game" game={split.next} accent={team.colors.primary} />
      ) : (
        <Empty>No games scheduled. Check back when the season opens.</Empty>
      )}

      {showNextHome && split.nextHome && (
        <section>
          <SectionTitle aside={relative(split.nextHome.startsAt)}>Next home game</SectionTitle>
          <div className="rounded-[3px] border border-edge px-4 py-3">
            <p className="text-sm">
              <span className="text-faint">vs </span>
              {split.nextHome.opponent.name}
            </p>
            <p className="mt-1 text-xs text-dim tnum">
              {gameLabel(split.nextHome.startsAt, split.nextHome.timeTbd)}
              {split.nextHome.venue ? ` · ${split.nextHome.venue}` : ""}
            </p>
          </div>
        </section>
      )}

      {split.last && (
        <section>
          <SectionTitle aside={relative(split.last.startsAt)}>Last game</SectionTitle>
          <GameRow game={split.last} accent={team.colors.primary} />
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
}: {
  title: string;
  game: Game;
  accent: string;
  live?: boolean;
}) {
  const score = scoreline(game);

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
            <p className="truncate text-[15px]">
              <span className="text-faint">{game.neutralSite ? "vs" : game.isHome === false ? "at" : "vs"} </span>
              {game.opponent.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-dim">
              {[game.venue, game.broadcast, game.note].filter(Boolean).join(" · ") || "Venue TBA"}
            </p>
          </div>
          {live && score && <span className="ml-auto text-2xl font-semibold tnum">{score}</span>}
        </div>

        {live && game.statusDetail && <p className="mt-3 text-xs text-dim">{game.statusDetail}</p>}

        {game.links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {game.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-[2px] border border-edge px-3 py-1.5 text-xs hover:border-dim"
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

function ScheduleTab({ team, programs }: { team: Team; programs: Fetched<Program[]> }) {
  const [programKey, setProgramKey] = useState<string | null>(null);
  if (programs === null) return <Failed what="the schedule" />;
  if (programs.length === 0) return <Empty>No schedule published yet.</Empty>;

  const active = programs.find((p) => p.key === programKey) ?? programs[0];
  const split = splitPrograms([active]);

  return (
    <div className="flex flex-col gap-8">
      {/* 종목이 둘 이상인 팀만 — 오렌지 루터란은 풋볼과 야구를 같이 본다. */}
      {programs.length > 1 && (
        <div className="flex gap-2">
          {programs.map((p) => (
            <button
              key={p.key}
              onClick={() => setProgramKey(p.key)}
              className={`rounded-[2px] border px-3 py-1.5 text-xs transition-colors ${
                p.key === active.key ? "border-transparent text-chalk" : "border-edge text-faint hover:text-dim"
              }`}
              style={p.key === active.key ? { background: `${team.colors.primary}2e` } : undefined}
            >
              {p.label}
              <span className="ml-1.5 text-faint tnum">{p.games.length}</span>
            </button>
          ))}
        </div>
      )}

      {split.upcoming.length > 0 && (
        <section>
          <SectionTitle aside={`${split.upcoming.length} left`}>Upcoming</SectionTitle>
          <div>
            {split.upcoming.map((g) => (
              <GameRow key={g.id} game={g} accent={team.colors.primary} />
            ))}
          </div>
        </section>
      )}

      {split.finished.length > 0 && (
        <section>
          <SectionTitle aside={recordOf(split.finished) ?? undefined}>Results</SectionTitle>
          <div>
            {[...split.finished].reverse().map((g) => (
              <GameRow key={g.id} game={g} accent={team.colors.primary} />
            ))}
          </div>
        </section>
      )}

      {split.upcoming.length === 0 && split.finished.length === 0 && (
        <Empty>Nothing on the calendar for {active.label.toLowerCase()}.</Empty>
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
                  <th className="pb-2 text-left font-normal">Team</th>
                  <th className="pb-2 text-right font-normal">W</th>
                  <th className="pb-2 text-right font-normal">L</th>
                  <th className="pb-2 text-right font-normal">PCT</th>
                  <th className="pb-2 text-right font-normal">GB</th>
                  <th className="pb-2 text-right font-normal">STRK</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {group.rows.map((r) => (
                  <tr
                    key={r.teamId ?? r.name}
                    className="border-t border-edge/70"
                    style={r.isUs ? { background: `${accent}1a` } : undefined}
                  >
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
