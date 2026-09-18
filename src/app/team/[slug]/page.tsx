import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findTeam, TEAMS } from "@/lib/sources/teams";
import { getLive, getNews, getPrograms } from "@/lib/sources";
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

  // 종목마다 자기 일정·전적·순위표·로스터를 들고 온다(`getPrograms`). 뉴스와 진행 중인
  // 경기는 종목을 안 가리므로 따로 부른다.
  const [programs, news, live] = await Promise.all([
    getPrograms(team),
    getNews(team, 18),
    getLive(team),
  ]);

  return <TeamView team={team} programs={programs} news={news} live={live} />;
}
