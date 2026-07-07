"use client";

import { useState } from "react";
import { formatGameTime, formatDate, youtubeEmbedUrl } from "@/lib/format";
import type { teams, players, newsItems, highlights, podcastEpisodes, games } from "@/db/schema";

type Team = typeof teams.$inferSelect;
type Player = typeof players.$inferSelect;
type NewsItem = typeof newsItems.$inferSelect;
type Highlight = typeof highlights.$inferSelect;
type PodcastEpisode = typeof podcastEpisodes.$inferSelect;
type Game = typeof games.$inferSelect;

type Props = {
  team: Team;
  color: string;
  roster: Player[];
  news: NewsItem[];
  highlightsList: Highlight[];
  podcasts: PodcastEpisode[];
  upcoming: Game[];
  recent: Game[];
};

const TABS = ["Overview", "Standings", "Schedule", "Roster", "News", "Videos", "Podcasts"] as const;
type Tab = (typeof TABS)[number];

export function TeamTabs({ team, color, roster, news, highlightsList, podcasts, upcoming, recent }: Props) {
  const [tab, setTab] = useState<Tab>("Overview");

  const standings = team.standings ?? [];
  const bracket = team.isPlayoffs ? (team.playoffBracket ?? []) : [];

  // Group rows by conference/division (row.group), with this team's own group listed
  // first — falls back to a single ungrouped table for single-table leagues (most soccer).
  const standingsByGroup = new Map<string | null, typeof standings>();
  for (const row of standings) {
    const key = row.group ?? null;
    const list = standingsByGroup.get(key) ?? [];
    list.push(row);
    standingsByGroup.set(key, list);
  }
  const standingsGroups = [...standingsByGroup.entries()].sort(([, a], [, b]) => {
    const aFirst = a.some((r) => r.isThisTeam);
    const bFirst = b.some((r) => r.isThisTeam);
    return aFirst === bFirst ? 0 : aFirst ? -1 : 1;
  });

  const counts: Partial<Record<Tab, number>> = {
    Standings: standings.length,
    Schedule: upcoming.length + recent.length,
    Roster: roster.length,
    News: news.length,
    Videos: highlightsList.length,
    Podcasts: podcasts.length,
  };

  const stadiumVideo = team.stadiumVideoUrl ? youtubeEmbedUrl(team.stadiumVideoUrl) : null;
  const starPlayers = roster.filter((p) => p.isStarPlayer);
  const restOfRoster = roster.filter((p) => !p.isStarPlayer);

  return (
    <div>
      <div className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200 px-4 dark:border-zinc-800">
        {TABS.map((t) => {
          const active = tab === t;
          const count = counts[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-current text-zinc-900 dark:text-zinc-50"
                  : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
              style={active ? { color } : undefined}
            >
              {t}
              {count !== undefined && count > 0 && <span className="ml-1 text-xs text-zinc-400">{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === "Overview" && (
        <div className="flex flex-col gap-6">
          {team.history && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">History</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {team.history}
              </p>
            </div>
          )}

          {(team.stadiumName || team.stadiumDescription) && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Stadium</h3>
              {team.stadiumName && <h4 className="font-medium">{team.stadiumName}</h4>}
              {team.stadiumDescription && (
                <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {team.stadiumDescription}
                </p>
              )}
              {team.stadiumPhotos && team.stadiumPhotos.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {team.stadiumPhotos.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={`${team.stadiumName ?? team.name} photo ${i + 1}`}
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              {stadiumVideo && (
                <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg">
                  <iframe src={stadiumVideo} className="h-full w-full" allowFullScreen title="Stadium video" />
                </div>
              )}
            </div>
          )}

          {team.coachName && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Coach</h3>
              <h4 className="font-medium">{team.coachName}</h4>
              {team.coachBio && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{team.coachBio}</p>}
            </div>
          )}

          {!team.history && !team.stadiumName && !team.coachName && (
            <p className="text-sm text-zinc-500">Profile hasn&apos;t been fetched yet — check back after the next daily update.</p>
          )}
        </div>
      )}

      {tab === "Standings" && (
        <div className="flex flex-col gap-6">
          {standings.length === 0 && !bracket.length && (
            <p className="text-sm text-zinc-500">No standings data yet.</p>
          )}

          {standingsGroups.map(([groupName, rows]) => (
            <div key={groupName ?? "__all__"}>
              {groupName && (
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">{groupName}</h3>
              )}
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Team</th>
                      <th className="px-3 py-2 font-medium">P</th>
                      <th className="px-3 py-2 font-medium">W</th>
                      <th className="px-3 py-2 font-medium">L</th>
                      <th className="px-3 py-2 font-medium">D</th>
                      <th className="px-3 py-2 font-medium">Pts</th>
                      <th className="px-3 py-2 font-medium">GB</th>
                      <th className="px-3 py-2 font-medium">Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                        style={row.isThisTeam ? { backgroundColor: `${color}14` } : undefined}
                      >
                        <td className="px-3 py-2 text-zinc-500">{row.rank}</td>
                        <td className="px-3 py-2 font-medium" style={row.isThisTeam ? { color } : undefined}>
                          {row.teamName}
                        </td>
                        <td className="px-3 py-2">{row.played ?? "–"}</td>
                        <td className="px-3 py-2">{row.wins ?? "–"}</td>
                        <td className="px-3 py-2">{row.losses ?? "–"}</td>
                        <td className="px-3 py-2">{row.draws ?? "–"}</td>
                        <td className="px-3 py-2">{row.points ?? "–"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.gamesBehind ?? "–"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.streak ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {bracket.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Playoff bracket</h3>
              <div className="flex flex-col gap-4">
                {bracket.map((round) => (
                  <div key={round.roundName}>
                    <h4 className="mb-1.5 text-sm font-medium">{round.roundName}</h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {round.matchups.map((m, i) => {
                        const involvesTeam = m.teamA === team.name || m.teamB === team.name;
                        return (
                          <div
                            key={i}
                            className={`rounded-xl border p-3 ${involvesTeam ? "" : "border-zinc-200 dark:border-zinc-800"}`}
                            style={involvesTeam ? { borderColor: color, backgroundColor: `${color}14` } : undefined}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className={m.winner === m.teamA ? "font-semibold" : ""}>{m.teamA}</span>
                              <span className="text-zinc-500">{m.scoreA ?? ""}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className={m.winner === m.teamB ? "font-semibold" : ""}>{m.teamB}</span>
                              <span className="text-zinc-500">{m.scoreB ?? ""}</span>
                            </div>
                            {m.seriesStatus && <div className="mt-1 text-xs text-zinc-500">{m.seriesStatus}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Schedule" && (
        <div className="flex flex-col gap-2">
          {upcoming.length === 0 && recent.length === 0 && (
            <p className="text-sm text-zinc-500">No schedule data yet.</p>
          )}
          {upcoming.map((g) => (
            <div key={g.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">
                  {g.isHome ? "vs" : "@"} {g.opponent}
                </span>
                <span className="text-xs text-zinc-500">{formatGameTime(g.gameTime)}</span>
              </div>
              {g.competition && <div className="text-xs text-zinc-500">{g.competition}</div>}
              {g.keyPoints && g.keyPoints.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {g.keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {recent.map((g) => (
            <div key={g.id} className="rounded-xl border border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">
                  {g.isHome ? "vs" : "@"} {g.opponent}
                </span>
                <span className="text-xs text-zinc-500">{formatDate(g.gameTime)}</span>
              </div>
              {g.result && <div className="text-sm font-medium">{g.result}</div>}
              {g.keyPoints && g.keyPoints.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {g.keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "Roster" && (
        <div>
          {roster.length === 0 && <p className="text-sm text-zinc-500">No roster data yet.</p>}
          {starPlayers.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {starPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border p-3"
                  style={{ borderColor: color, backgroundColor: `${color}14` }}
                >
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {p.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium">
                      {p.name} {p.number && <span className="text-zinc-500">#{p.number}</span>}
                    </div>
                    <div className="text-xs text-zinc-500">{p.position}</div>
                    {p.bio && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{p.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {restOfRoster.map((p) => (
              <span key={p.id}>
                {p.name} {p.number && <span className="text-zinc-400">#{p.number}</span>}
                <span className="text-zinc-400"> · {p.position}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {tab === "News" && (
        <div className="flex flex-col gap-2">
          {news.length === 0 && <p className="text-sm text-zinc-500">No news yet.</p>}
          {news.map((n) => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="text-sm font-medium">{n.title}</div>
              {n.summary && <div className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{n.summary}</div>}
              <div className="mt-1 text-xs text-zinc-400">
                {n.source} · {formatDate(n.publishedAt)}
              </div>
            </a>
          ))}
        </div>
      )}

      {tab === "Videos" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {highlightsList.length === 0 && <p className="text-sm text-zinc-500">No videos yet.</p>}
          {highlightsList.map((h) => {
            const embed = youtubeEmbedUrl(h.videoUrl);
            return (
              <div key={h.id} className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {embed ? (
                  <div className="aspect-video w-full overflow-hidden rounded-lg">
                    <iframe src={embed} className="h-full w-full" allowFullScreen title={h.title} />
                  </div>
                ) : (
                  <a href={h.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                    Watch
                  </a>
                )}
                <div className="mt-1.5 text-sm font-medium">{h.title}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "Podcasts" && (
        <div className="flex flex-col gap-2">
          {podcasts.length === 0 && <p className="text-sm text-zinc-500">No podcasts yet.</p>}
          {podcasts.map((p) => (
            <a
              key={p.id}
              href={p.episodeUrl}
              className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="text-sm font-medium">{p.title}</div>
              <div className="mt-1 text-xs text-zinc-400">
                {p.showName} · {formatDate(p.publishedAt)}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
