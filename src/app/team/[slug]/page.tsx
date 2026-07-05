import { notFound } from "next/navigation";
import {
  getTeamBySlug,
  getTeamRoster,
  getTeamNews,
  getTeamHighlights,
  getTeamPodcasts,
  getUpcomingGames,
  getRecentGames,
} from "@/lib/data";
import { getTeamColor, SPORT_EMOJI } from "@/lib/teamTheme";
import { TeamTabs } from "./TeamTabs";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const [roster, news, highlightsList, podcasts, upcoming, recent] = await Promise.all([
    getTeamRoster(team.id),
    getTeamNews(team.id),
    getTeamHighlights(team.id),
    getTeamPodcasts(team.id),
    getUpcomingGames(team.id),
    getRecentGames(team.id),
  ]);

  const color = getTeamColor(team.slug);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="-mx-4 -mt-6 flex items-center gap-4 px-4 py-6 text-white sm:mx-0 sm:mt-0 sm:rounded-2xl"
        style={{ background: `linear-gradient(135deg, ${color} 0%, #0a0f1f 130%)` }}
      >
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full bg-white object-contain p-1" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl">
            {SPORT_EMOJI[team.sport] ?? ""}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{team.name}</h1>
          <p className="text-sm text-white/80">
            {team.league} · {team.country}
          </p>
        </div>
      </div>

      <TeamTabs
        team={team}
        color={color}
        roster={roster}
        news={news}
        highlightsList={highlightsList}
        podcasts={podcasts}
        upcoming={upcoming}
        recent={recent}
      />
    </div>
  );
}
