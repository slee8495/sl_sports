import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findTeam, TEAMS } from "@/lib/sources/teams";
import {
  getInjuries,
  getLive,
  getNews,
  getRoster,
  getSchedule,
  getSnapshot,
  getStandings,
} from "@/lib/sources";
import { TeamView } from "./TeamView";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return TEAMS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = findTeam(slug);
  return { title: team ? `${team.name} · SL Sports` : "SL Sports" };
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = findTeam(slug);
  if (!team) notFound();

  /*
    **전부 동시에 부른다.** 탭을 누를 때마다 부르면 누를 때마다 기다리고, 줄 세워 부르면
    한 화면에 대여섯 번의 왕복이 쌓인다. 캐시가 앞에 있어서 대부분은 아예 안 나간다.
  */
  const [snapshot, programs, roster, standings, news, injuries, live] = await Promise.all([
    getSnapshot(team),
    getSchedule(team),
    getRoster(team),
    getStandings(team),
    getNews(team, 18),
    getInjuries(team),
    getLive(team),
  ]);

  return (
    <TeamView
      team={team}
      snapshot={snapshot}
      programs={programs}
      roster={roster}
      standings={standings}
      news={news}
      injuries={injuries}
      live={live}
    />
  );
}
