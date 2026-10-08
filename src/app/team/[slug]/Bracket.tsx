"use client";

import { useState } from "react";
import { championOf, currentRound } from "@/lib/sources/bracket";
import type { BracketRound, BracketTeam, Fetched, Matchup } from "@/lib/sources/types";
import { gameLabel, relative } from "@/lib/format";
import { Empty, Failed, LiveDot } from "@/components/Bits";

/**
 * 포스트시즌 브래킷.
 *
 * **나무 그림이 아니라 라운드별 목록이다.** 이 앱은 대개 폰에서 열리고, NCAA 토너먼트는
 * 첫 라운드만 서른두 칸이다 — 폰 폭에 나무를 그리면 이름이 다 잘린다. 대신 라운드를 고르는
 * 줄을 두고, **지금 하는 라운드가 먼저 열린다.** 매치업 순서는 나무 순서 그대로라
 * (`orderBracket`) 위의 두 칸의 승자가 다음 라운드 첫 칸에서 만난다.
 */
export function BracketTab({ rounds, accent }: { rounds: Fetched<BracketRound[]>; accent: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (rounds === null) return <Failed what="the bracket" />;
  if (rounds.length === 0) return <Empty>The postseason hasn&apos;t started.</Empty>;

  const index = Math.min(picked ?? currentRound(rounds), rounds.length - 1);
  const round = rounds[index];
  const champion = championOf(rounds);

  // 묶음(AL/NL, East/West, 지역)이 있으면 그것대로 끊어 그린다. 결승처럼 묶음이 없는 라운드는 한 덩어리.
  const groups: { name: string | null; matchups: Matchup[] }[] = [];
  for (const m of round.matchups) {
    const last = groups[groups.length - 1];
    if (last && last.name === m.group) last.matchups.push(m);
    else groups.push({ name: m.group, matchups: [m] });
  }

  return (
    <div className="flex flex-col gap-6">
      {champion && (
        <div
          className="flex items-center gap-3 rounded-[4px] border border-edge bg-riser px-4 py-3"
          style={{ borderLeftColor: champion.isUs ? accent : undefined, borderLeftWidth: champion.isUs ? 3 : undefined }}
        >
          <TeamMark team={champion} size={32} />
          <div className="min-w-0">
            <p className="text-[11px] text-faint">Champion</p>
            <p className="wide truncate text-[17px] font-semibold">{champion.name}</p>
          </div>
        </div>
      )}

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {rounds.map((r, i) => {
          const on = i === index;
          const live = r.matchups.some((m) => m.status === "in");
          return (
            <button
              key={r.name}
              onClick={() => setPicked(i)}
              aria-pressed={on}
              className={`flex shrink-0 items-center gap-1.5 rounded-[3px] border px-3 py-1.5 text-[12px] transition-colors ${
                on ? "border-transparent font-medium text-ink" : "border-edge text-faint hover:text-dim"
              }`}
              style={on ? { background: `${accent}1f` } : undefined}
            >
              {live && <LiveDot />}
              {r.name}
            </button>
          );
        })}
      </div>

      {groups.map((g, gi) => (
        <section key={`${g.name ?? ""}-${gi}`}>
          {g.name && <h3 className="mb-2.5 text-xs font-medium text-dim">{g.name}</h3>}
          <div className="grid gap-3 sm:grid-cols-2">
            {g.matchups.map((m) => (
              <MatchupCard key={m.id} matchup={m} accent={accent} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MatchupCard({ matchup: m, accent }: { matchup: Matchup; accent: string }) {
  const ours = m.teams.some((t) => t?.isUs);
  const done = m.status === "final";
  const live = m.status === "in";

  /*
    아래 한 줄. 하는 중이면 이닝·쿼터, 끝났으면 시리즈 한 줄("LAD win series 3-1"),
    아직이면 **언제** — 다음 경기 시각이 이 칸을 보는 이유다.
  */
  let foot: string | null;
  if (live) foot = m.detail ?? "Live";
  else if (done) foot = m.detail ?? "Final";
  else if (m.startsAt) {
    const when = `${gameLabel(m.startsAt)} · ${relative(m.startsAt)}`;
    foot = m.detail ? `${m.detail} · ${when}` : when;
  } else foot = m.detail;

  return (
    <div
      className="rounded-[4px] border border-edge bg-riser"
      style={ours ? { borderLeftColor: accent, borderLeftWidth: 3 } : undefined}
    >
      {m.label && <p className="truncate px-3 pt-2.5 text-[11px] text-faint">{m.label}</p>}
      <div className="flex flex-col px-3 py-1.5">
        {m.teams.map((t, i) => (
          <Row key={t?.name ?? `tbd-${i}`} team={t} done={done} accent={accent} />
        ))}
      </div>
      {foot && (
        <p className="flex items-center gap-1.5 border-t border-edge/70 px-3 py-2 text-[11px] text-dim tnum">
          {live && <LiveDot />}
          <span className="truncate">{foot}</span>
        </p>
      )}
    </div>
  );
}

function Row({ team, done, accent }: { team: BracketTeam | null; done: boolean; accent: string }) {
  // 안 정해진 자리. 빈칸으로 두면 깨진 것처럼 보이고, "Winner G3" 를 팀처럼 적으면 거짓이다.
  if (!team) {
    return (
      <div className="flex h-8 items-center gap-2.5">
        <span className="h-5 w-5 shrink-0" />
        <span className="text-[13px] text-faint">TBD</span>
      </div>
    );
  }

  // 끝난 매치업에서는 진 쪽을 흐리게 — 누가 올라갔는지가 한눈에 보이게.
  const faded = done && !team.won;
  return (
    <div
      className={`-mx-3 flex h-8 items-center gap-2.5 px-3 ${faded ? "text-faint" : ""}`}
      style={team.isUs ? { background: `${accent}12` } : undefined}
    >
      <TeamMark team={team} size={20} />
      {team.seed != null && <span className="w-4 shrink-0 text-right text-[11px] text-faint tnum">{team.seed}</span>}
      <span className={`min-w-0 flex-1 truncate text-[13px] ${team.won || team.isUs ? "font-semibold" : ""}`}>
        {team.name}
      </span>
      {team.score != null && (
        <span className={`shrink-0 text-[14px] tnum ${team.won ? "font-semibold" : ""}`}>{team.score}</span>
      )}
    </div>
  );
}

function TeamMark({ team, size }: { team: BracketTeam; size: number }) {
  if (team.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo} alt="" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  // 고등학교 상대에는 로고가 없을 때가 있다. 일정 표와 같게, 첫 글자만 흐리게 둔다.
  return (
    <span
      className="flex shrink-0 items-center justify-center text-[11px] text-faint"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {team.name.charAt(0)}
    </span>
  );
}
