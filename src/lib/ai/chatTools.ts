import { tool } from "ai";
import { z } from "zod";
import { TEAMS, findTeam } from "@/lib/sources/teams";
import { defaultProgram, getNews, getPrograms, type Program } from "@/lib/sources";
import { splitSchedule } from "@/lib/sources/split";

/**
 * 챗이 쓰는 도구들.
 *
 * **DB 를 안 읽는다.** 예전에는 모델이 웹을 뒤져 DB 에 적어 둔 것을 다시 읽어 답했다 —
 * 하루 전 정보를 자신 있게 말하는 구조였다. 지금은 화면과 **같은 출처**를 그 자리에서 읽는다.
 * 화면에 "오늘 6시 38분" 이라고 적혀 있는데 챗이 다른 말을 하는 일이 없다.
 *
 * 부르는 값은 전부 캐시를 거치므로, 물어봤다고 남의 서버를 새로 부르는 것도 아니다.
 */

function gameOf(g: ReturnType<typeof splitSchedule>["next"]) {
  return g
    ? {
        opponent: g.opponent.name,
        home: g.isHome,
        startsAt: g.startsAt,
        timeTbd: g.timeTbd,
        venue: g.venue,
        broadcast: g.broadcast,
        note: g.note,
        result: g.result,
        score: g.ourScore != null ? `${g.ourScore}-${g.theirScore}` : null,
      }
    : null;
}

/** 종목을 고른다. 안 적어 주면 지금 시즌인 쪽 — 고등학교는 가을이면 풋볼이다. */
function pick(programs: Program[], sport?: string): Program | null {
  if (sport) {
    const found = programs.find((p) => p.key.toLowerCase() === sport.toLowerCase());
    if (found) return found;
  }
  return defaultProgram(programs);
}

export const listTeams = tool({
  description: "List the teams this app follows, with their league and slug. Call this first.",
  inputSchema: z.object({}),
  execute: async () =>
    TEAMS.map((t) => ({
      name: t.name,
      slug: t.slug,
      league: t.league,
      sport: t.sport,
      level: t.level,
      // 오렌지 루터란은 한 학교가 두 종목을 한다. 그걸 모르면 야구를 물어도 풋볼로 답한다.
      sports: t.source.kind === "school" ? t.source.programs.map((p) => p.key) : [t.sport.toLowerCase()],
    })),
});

export const getTeamDetails = tool({
  description:
    "Live detail for one team: record, next game, next home game, last result, coaches, injuries, standing and recent headlines. For a school that plays more than one sport, pass `sport` to choose; otherwise the one in season answers.",
  inputSchema: z.object({
    slug: z.string().describe("Team slug from listTeams, e.g. 'chargers'"),
    sport: z.string().optional().describe("For multi-sport schools: 'football' or 'baseball'"),
  }),
  execute: async ({ slug, sport }) => {
    const team = findTeam(slug);
    if (!team) return { error: `No team called "${slug}". Call listTeams for the list.` };

    const [programs, news] = await Promise.all([getPrograms(team), getNews(team, 6)]);
    // 못 가져온 것을 "없다" 로 바꿔 넘기지 않는다 — 모델이 그 빈칸을 상상으로 메운다.
    if (programs === null) {
      return { name: team.name, league: team.league, error: "The source didn't answer just now." };
    }

    const program = pick(programs, sport);
    if (!program) return { name: team.name, error: "No sport data for this team." };

    const split = splitSchedule(program.games);
    const ourRow = program.standings?.[0]?.rows.find((r) => r.isUs) ?? null;

    return {
      name: team.name,
      league: team.league,
      sport: program.label,
      inSeason: program.inSeason,
      record: program.snapshot.record,
      standingSummary: program.snapshot.standingSummary,
      /** 모든 시각은 UTC ISO 다. 사람에게 말할 때는 태평양 시간으로 바꿔서 말해야 한다. */
      nextGame: gameOf(split.next),
      nextHomeGame: gameOf(split.nextHome),
      lastGame: gameOf(split.last),
      liveGame: gameOf(split.live),
      remainingGames: split.upcoming.length,
      ticketsUrl: team.ticketsUrl,
      coaches: program.roster?.coaches.map((c) => `${c.name} (${c.title})`) ?? [],
      injuries: (program.injuries ?? []).slice(0, 12).map((i) => `${i.player}: ${i.status}`),
      standing: ourRow
        ? {
            group: program.standings?.[0]?.name,
            place: program.standings?.[0]?.ordered
              ? (program.standings[0].rows.findIndex((r) => r.isUs) + 1)
              : null,
            wins: ourRow.wins,
            losses: ourRow.losses,
            streak: ourRow.streak,
          }
        : null,
      headlines: (news ?? []).slice(0, 6).map((n) => ({ headline: n.headline, published: n.publishedAt, url: n.url })),
    };
  },
});

export const getFullSchedule = tool({
  description: "The full schedule for one team — every game with date, opponent, home/away and result.",
  inputSchema: z.object({ slug: z.string(), sport: z.string().optional() }),
  execute: async ({ slug, sport }) => {
    const team = findTeam(slug);
    if (!team) return { error: `No team called "${slug}".` };
    const programs = await getPrograms(team);
    if (programs === null) return { error: "The source didn't answer just now." };

    const chosen = sport ? [pick(programs, sport)].filter((p) => p !== null) : programs;
    return chosen.map((p) => ({
      sport: p.label,
      showingPastSeason: p.pastSeason,
      games: p.games.map((g) => ({
        startsAt: g.startsAt,
        opponent: g.opponent.name,
        home: g.isHome,
        status: g.status,
        score: g.ourScore != null ? `${g.ourScore}-${g.theirScore}` : null,
        result: g.result,
        venue: g.venue,
      })),
    }));
  },
});
