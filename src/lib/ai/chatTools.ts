import { tool } from "ai";
import { z } from "zod";
import { TEAMS, findTeam } from "@/lib/sources/teams";
import { getInjuries, getNews, getRoster, getSchedule, getSnapshot, getStandings } from "@/lib/sources";
import { splitPrograms } from "@/lib/sources/split";

/**
 * 챗이 쓰는 도구들.
 *
 * **DB 를 안 읽는다.** 예전에는 모델이 웹을 뒤져 DB 에 적어 둔 것을 다시 읽어 답했다 —
 * 하루 전 정보를 자신 있게 말하는 구조였다. 지금은 화면과 **같은 출처**를 그 자리에서 읽는다.
 * 화면에 "오늘 6시 38분" 이라고 적혀 있는데 챗이 다른 말을 하는 일이 없다.
 *
 * 부르는 값은 전부 캐시를 거치므로, 물어봤다고 남의 서버를 새로 부르는 것도 아니다.
 */

export const listTeams = tool({
  description: "List the teams this app follows, with their league and slug. Call this first.",
  inputSchema: z.object({}),
  execute: async () =>
    TEAMS.map((t) => ({ name: t.name, slug: t.slug, league: t.league, sport: t.sport, level: t.level })),
});

export const getTeamDetails = tool({
  description:
    "Live detail for one team by slug: record, next game, next home game, last result, coaches, injuries, standings position, and recent headlines.",
  inputSchema: z.object({ slug: z.string().describe("Team slug from listTeams, e.g. 'chargers'") }),
  execute: async ({ slug }) => {
    const team = findTeam(slug);
    if (!team) return { error: `No team called "${slug}". Call listTeams for the list.` };

    const [snapshot, programs, roster, standings, news, injuries] = await Promise.all([
      getSnapshot(team),
      getSchedule(team),
      getRoster(team),
      getStandings(team),
      getNews(team, 6),
      getInjuries(team),
    ]);

    // 못 가져온 것을 "없다" 로 바꿔 넘기지 않는다 — 모델이 그 빈칸을 상상으로 메운다.
    if (programs === null) {
      return { name: team.name, league: team.league, error: "The schedule source didn't answer just now." };
    }

    const split = splitPrograms(programs);
    const game = (g: typeof split.next) =>
      g
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

    const ourRow = standings?.[0]?.rows.find((r) => r.isUs) ?? null;

    return {
      name: team.name,
      league: team.league,
      record: snapshot.record,
      standingSummary: snapshot.standingSummary,
      /** 모든 시각은 UTC ISO 다. 사람에게 말할 때는 태평양 시간으로 바꿔서 말해야 한다. */
      nextGame: game(split.next),
      nextHomeGame: game(split.nextHome),
      lastGame: game(split.last),
      liveGame: game(split.live),
      remainingGames: split.upcoming.length,
      coaches: roster?.coaches.map((c) => `${c.name} (${c.title})`) ?? [],
      injuries: (injuries ?? []).slice(0, 12).map((i) => `${i.player}: ${i.status}`),
      standing: ourRow
        ? { group: standings?.[0]?.name, seed: ourRow.playoffSeed, wins: ourRow.wins, losses: ourRow.losses, streak: ourRow.streak }
        : null,
      headlines: (news ?? []).slice(0, 6).map((n) => ({ headline: n.headline, published: n.publishedAt, url: n.url })),
    };
  },
});

export const getFullSchedule = tool({
  description: "The full schedule for one team — every game with date, opponent, home/away and result.",
  inputSchema: z.object({ slug: z.string() }),
  execute: async ({ slug }) => {
    const team = findTeam(slug);
    if (!team) return { error: `No team called "${slug}".` };
    const programs = await getSchedule(team);
    if (programs === null) return { error: "The schedule source didn't answer just now." };

    return programs.map((p) => ({
      program: p.label,
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
