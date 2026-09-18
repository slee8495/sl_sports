import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findTeam, TEAMS } from "@/lib/sources/teams";
import { getLive, getNews, getPrograms } from "@/lib/sources";
import { splitSchedule } from "@/lib/sources/split";
import { findHighlight, type Highlight } from "@/lib/sources/youtube";
import { highlightQuery, nameTokens } from "@/lib/highlight";
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

  /*
    **최근 경기 하이라이트만 미리 찾아 둔다.**

    일정 표에는 시즌 전체가 들어 있어서(야구는 162경기) 경기마다 찾으면 화면 한 장에
    백오십 번 나간다. 표에서는 검색 주소만 만들고(부르는 것이 없다), 실제로 눌러서 볼
    자리인 "최근 경기" 한 장만 영상을 찾는다 — 종목마다 한 번, 반나절 캐시.
  */
  const highlights: Record<string, Highlight> = {};
  await Promise.all(
    (programs ?? []).map(async (p) => {
      const last = splitSchedule(p.games).last;
      if (!last) return;
      const query = highlightQuery(team.shortName, last);
      highlights[p.key] = await findHighlight(
        query,
        nameTokens(team.name, team.shortName, team.nickname),
        nameTokens(last.opponent.name, last.opponent.shortName),
      );
    }),
  );

  return <TeamView team={team} programs={programs} news={news} live={live} highlights={highlights} />;
}
