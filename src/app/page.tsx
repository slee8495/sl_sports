import Link from "next/link";
import {
  getTeamsGroupedBySport,
  getNextGameForEachTeam,
  getLatestActivity,
  getTodaysContentUpdates,
  SPORT_LABELS,
} from "@/lib/data";
import { formatGameTime, formatDate } from "@/lib/format";
import { SPORT_EMOJI, getTeamColor } from "@/lib/teamTheme";

export const dynamic = "force-dynamic";

const ACTIVITY_ICON: Record<string, string> = {
  news: "📰",
  highlight: "🎬",
  podcast: "🎙️",
};

export default async function Home() {
  const [grouped, nextGames, activity, todaysUpdates] = await Promise.all([
    getTeamsGroupedBySport(),
    getNextGameForEachTeam(),
    getLatestActivity(16),
    getTodaysContentUpdates(),
  ]);

  const hasLatest = activity.length > 0;

  return (
    <div className="flex flex-col gap-10">
      {todaysUpdates.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <span>🔄</span>
            <span>Updated {formatDate(todaysUpdates[0].ranAt)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {todaysUpdates.map((u) => (
              <Link
                key={u.teamSlug}
                href={`/team/${u.teamSlug}`}
                className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium transition hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                {u.teamName}
              </Link>
            ))}
          </div>
        </div>
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

      {activity.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span>🗞️</span>
            <span>Latest</span>
          </h2>
          <div className="flex flex-col gap-2">
            {activity.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span className="mt-0.5 shrink-0">{ACTIVITY_ICON[item.type]}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {item.teamName}
                    {item.meta ? ` · ${item.meta}` : ""} · {formatDate(item.publishedAt ?? item.fetchedAt)}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{item.title}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
