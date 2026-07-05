import Link from "next/link";
import {
  getTeamsGroupedBySport,
  getNextGameForEachTeam,
  getLatestNews,
  getLatestHighlights,
  getLatestPodcasts,
  getLatestContentUpdate,
  SPORT_LABELS,
} from "@/lib/data";
import { formatGameTime, formatDate } from "@/lib/format";
import { SPORT_EMOJI, getTeamColor } from "@/lib/teamTheme";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [grouped, nextGames, news, highlightsList, podcasts, lastUpdate] = await Promise.all([
    getTeamsGroupedBySport(),
    getNextGameForEachTeam(),
    getLatestNews(8),
    getLatestHighlights(8),
    getLatestPodcasts(8),
    getLatestContentUpdate(),
  ]);

  const hasLatest = news.length > 0 || highlightsList.length > 0 || podcasts.length > 0;

  return (
    <div className="flex flex-col gap-10">
      {lastUpdate && (
        <Link
          href={`/team/${lastUpdate.teamSlug}`}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          <span>🔄</span>
          <span>
            Last refreshed: <span className="font-medium">{lastUpdate.teamName}</span> · {formatDate(lastUpdate.ranAt)}
          </span>
        </Link>
      )}

      <section className="flex flex-col gap-6">
        {[...grouped.entries()].map(([sport, teamsInSport]) => (
          <div key={sport}>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              <span>{SPORT_EMOJI[sport] ?? ""}</span>
              <span>{SPORT_LABELS[sport] ?? sport}</span>
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {teamsInSport.map((team) => {
                const next = nextGames.get(team.id);
                const color = getTeamColor(team.slug);
                return (
                  <Link
                    key={team.id}
                    href={`/team/${team.slug}`}
                    className="group flex items-center gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                    style={{ borderLeft: `4px solid ${color}` }}
                  >
                    {team.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={team.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-contain bg-white" />
                    ) : (
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {team.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{team.name}</div>
                      <div className="text-xs text-zinc-500">{team.league}</div>
                      {next ? (
                        <div className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">
                          {next.isHome ? "vs" : "@"} {next.opponent} · {formatGameTime(next.gameTime)}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-xs text-zinc-400">No upcoming game yet</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {!hasLatest && (
        <p className="text-sm text-zinc-500">
          No content yet — the update job hasn&apos;t run. Trigger /api/cron/update-content once to populate.
        </p>
      )}

      {news.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span>📰</span>
            <span>News</span>
          </h2>
          <div className="flex flex-col gap-2">
            {news.map((n) => (
              <a
                key={n.id}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {n.teamName} · {formatDate(n.publishedAt)}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{n.title}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {highlightsList.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span>🎬</span>
            <span>Highlights</span>
          </h2>
          <div className="flex flex-col gap-2">
            {highlightsList.map((h) => (
              <a
                key={h.id}
                href={h.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {h.teamName} · {formatDate(h.publishedAt)}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{h.title}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {podcasts.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span>🎙️</span>
            <span>Podcasts</span>
          </h2>
          <div className="flex flex-col gap-2">
            {podcasts.map((p) => (
              <a
                key={p.id}
                href={p.episodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {p.teamName} · {formatDate(p.publishedAt)}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{p.title}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
