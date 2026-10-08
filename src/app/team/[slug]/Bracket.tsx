"use client";

import { useEffect, useRef, useState } from "react";
import { championOf, currentRound, layoutBracket, type BracketLayout, type Cell } from "@/lib/sources/bracket";
import type { BracketRound, BracketTeam, Fetched, Matchup } from "@/lib/sources/types";
import { gameLabel, relative } from "@/lib/format";
import { Empty, Failed, LiveDot, SectionTitle } from "@/components/Bits";

/**
 * 포스트시즌 브래킷.
 *
 * **리그가 그리는 그림 그대로 — 양쪽에서 가운데 결승으로 모이는 나무다**(소유자가 NBA 공식
 * 브래킷 그림을 보여 주며 요청). 서쪽이 왼쪽, 동쪽이 오른쪽. 칸에는 이름 대신 로고·시드·
 * 점수만 둔다 — 그래야 폰 폭에 일곱 줄이 들어간다. 이름과 경기 시각은 칸을 누르면 아래에 뜬다.
 *
 * 나무가 안 서는 브래킷(라운드가 하나뿐인 학교 대회 같은 것)은 라운드별 목록으로 그린다.
 */
export function BracketTab({ rounds, accent }: { rounds: Fetched<BracketRound[]>; accent: string }) {
  if (rounds === null) return <Failed what="the bracket" />;
  if (rounds.length === 0) return <Empty>The postseason hasn&apos;t started.</Empty>;

  const layout = layoutBracket(rounds);
  return layout ? <Tree layout={layout} rounds={rounds} accent={accent} /> : <BracketList rounds={rounds} accent={accent} />;
}

/* ────────────────────────────── 나무 ────────────────────────────── */

/**
 * 칸 폭·높이. **폰(375px)에서 NBA 브래킷 일곱 줄이 가로로 한 화면에 들어가는 크기다** —
 * 2·3·(47+6)+47 = 365. 그 폭에 세 자리 농구 점수가 들어가도록 시드는 로고 귀퉁이에 얹는다.
 * NCAA(한쪽에 다섯 줄)는 옆으로 민다.
 */
const W = 47;
const GAP = 6;
const ROW = 24;
const BOX = ROW * 2 + 2;
const UNIT = BOX + 10;

/** 칸 위의 라운드 이름. 칸이 좁아서 리그 그림처럼 줄여 쓴다. */
function shortRound(name: string): string {
  return name
    .replace(/^Conference Semifinals$/, "Conf. Semis")
    .replace(/^Conference Finals?$/, "Conf. Finals")
    .replace(/^Conference Championship$/, "Conf. Title")
    .replace(/^Championship Series$/, "LCS")
    .replace(/^Division Series$/, "Division")
    .replace(/^Wild Card Series$/, "Wild Card")
    .replace(/^Quarterfinals?$/, "Quarters")
    .replace(/^Semifinals?$/, "Semis");
}

function Tree({ layout, rounds, accent }: { layout: BracketLayout; rounds: BracketRound[]; accent: string }) {
  const { columns, final, sides } = layout;
  const cols = columns.length;
  const half = columns[0].cells.length / 2;
  const height = half * UNIT;
  const width = 2 * cols * (W + GAP) + W;
  const champion = championOf(rounds);

  // 칸 하나의 자리. 왼쪽은 바깥에서 안으로, 오른쪽은 거울로.
  const xOf = (side: 0 | 1, c: number) => (side === 0 ? c * (W + GAP) : width - W - c * (W + GAP));
  const yOf = (c: number, i: number) => ((i + 0.5) * height) / (half / 2 ** c);
  const finalX = cols * (W + GAP);

  const all = [...columns.flatMap((c) => c.cells.map((x) => x.matchup)), final.matchup].filter((m): m is Matchup => !!m);

  /*
    처음 열면 **우리 팀 매치업**(가장 최근 것)이 아래에 펼쳐져 있다. 우리 팀이 없으면 지금
    하는 경기, 그것도 없으면 아무것도 안 펼친다.
  */
  const ours = [...all].reverse().find((m) => m.teams.some((t) => t?.isUs)) ?? null;
  const [picked, setPicked] = useState<string | null>((ours ?? all.find((m) => m.status === "in"))?.id ?? null);
  const selected = all.find((m) => m.id === picked) ?? null;

  // 폭이 화면보다 넓을 때(NCAA), 우리 팀이 오른쪽에 있으면 그쪽이 먼저 보이게.
  const scroller = useRef<HTMLDivElement>(null);
  const ourSide = columns[0].cells.findIndex((c) => c.matchup?.teams.some((t) => t?.isUs));
  useEffect(() => {
    const el = scroller.current;
    if (el && ourSide >= half) el.scrollLeft = el.scrollWidth;
  }, [ourSide, half]);

  // 이어 주는 선. 부전승 자리에서는 선이 안 나온다 — 거기서 올라오는 팀은 경기를 안 했다.
  const lines: string[] = [];
  for (const side of [0, 1] as const) {
    for (let c = 1; c < cols; c++) {
      const n = half / 2 ** c;
      for (let i = 0; i < n; i++) {
        const py = yOf(c, i);
        const px = side === 0 ? xOf(0, c) : xOf(1, c) + W;
        for (const k of [2 * i, 2 * i + 1]) {
          const child = columns[c - 1].cells[side * (half / 2 ** (c - 1)) + k];
          if (!child || child.bye) continue;
          const cy = yOf(c - 1, k);
          const cx = side === 0 ? xOf(0, c - 1) + W : xOf(1, c - 1);
          const mx = side === 0 ? cx + GAP / 2 : cx - GAP / 2;
          lines.push(`M${cx} ${cy}H${mx}V${py}H${px}`);
        }
      }
    }
    const last = columns[cols - 1].cells[side];
    if (last && !last.bye) {
      const cx = side === 0 ? xOf(0, cols - 1) + W : xOf(1, cols - 1);
      lines.push(`M${cx} ${height / 2}H${side === 0 ? finalX : finalX + W}`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {champion && <ChampionBanner team={champion} accent={accent} />}

      <div ref={scroller} className="no-scrollbar -mx-5 overflow-x-auto px-[3px]">
        <div className="mx-auto" style={{ width }}>
          {/* 라운드 이름. 칸 바로 위에, 칸 폭에 맞춰. */}
          <div className="relative h-8" style={{ width }}>
            {columns.map((col, c) =>
              ([0, 1] as const).map((side) => (
                <span
                  key={`${col.name}-${side}`}
                  className="absolute bottom-1.5 text-center text-[9px] leading-[1.1] font-medium tracking-wide text-faint uppercase"
                  style={{ left: xOf(side, c) - GAP / 2, width: W + GAP }}
                >
                  {shortRound(col.name)}
                </span>
              )),
            )}
            <span
              className="absolute bottom-1.5 text-center text-[9px] leading-[1.1] font-semibold tracking-wide text-dim uppercase"
              style={{ left: finalX - 2 * GAP, width: W + 4 * GAP }}
            >
              {final.name}
            </span>
          </div>

          <div className="relative" style={{ width, height }}>
            <svg className="absolute inset-0" width={width} height={height} aria-hidden>
              {lines.map((d, i) => (
                <path key={i} d={d} fill="none" stroke="var(--color-edge)" strokeWidth={1.5} />
              ))}
            </svg>

            {columns.map((col, c) =>
              col.cells.map((cell, i) => {
                // 칸 목록은 라운드 전체 폭이다 — 앞의 반이 왼쪽, 뒤의 반이 오른쪽.
                const n = col.cells.length / 2;
                const side = i < n ? 0 : 1;
                const at = side === 0 ? i : i - n;
                return (
                  <Box
                    key={`${c}-${i}`}
                    cell={cell}
                    mirror={side === 1}
                    accent={accent}
                    selected={!!cell.matchup && cell.matchup.id === picked}
                    onPick={setPicked}
                    style={{ left: xOf(side, c), top: yOf(c, at) - BOX / 2 }}
                  />
                );
              }),
            )}

            <Box
              cell={{ matchup: final.matchup, bye: false }}
              mirror={false}
              accent={accent}
              selected={!!final.matchup && final.matchup.id === picked}
              onPick={setPicked}
              style={{ left: finalX, top: height / 2 - BOX / 2 }}
            />
          </div>

          {/* 양쪽 이름 — 리그 그림처럼 아래에 크게. */}
          {(sides[0] || sides[1]) && (
            <div className="mt-2 flex justify-between px-1">
              <span className="wide text-[20px] font-semibold text-faint/60 uppercase">{sides[0]}</span>
              <span className="wide text-[20px] font-semibold text-faint/60 uppercase">{sides[1]}</span>
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <MatchupCard matchup={selected} accent={accent} />
      ) : (
        <p className="text-center text-xs text-faint">Tap a matchup for details.</p>
      )}

      {/* 나무 밖의 판 — 플레이인, First Four. */}
      {layout.pre.map((r) => (
        <section key={r.name}>
          <SectionTitle>{r.name}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {r.matchups.map((m) => (
              <MatchupCard key={m.id} matchup={m} accent={accent} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * 나무의 칸 하나 — 로고·시드·점수 두 줄.
 *
 * 왼쪽 반은 [시드 로고 점수], 오른쪽 반은 거울로 [점수 로고 시드] — 점수가 늘 가운데(결승)
 * 쪽을 본다. **하는 중이면 점수가 지금 경기의 점수이고 빨갛다**(시리즈 전적은 칸을 누르면
 * 아래에). 아직 안 정해진 칸은 빈 상자, 부전승 자리는 아무것도 없다.
 */
function Box({
  cell,
  mirror,
  accent,
  selected,
  onPick,
  style,
}: {
  cell: Cell;
  mirror: boolean;
  accent: string;
  selected: boolean;
  onPick: (id: string) => void;
  style: React.CSSProperties;
}) {
  if (cell.bye) return null;
  const m = cell.matchup;
  const ours = !!m?.teams.some((t) => t?.isUs);
  const live = m?.status === "in";

  return (
    <button
      type="button"
      disabled={!m}
      onClick={() => m && onPick(m.id)}
      aria-label={m ? m.teams.map((t) => t?.name ?? "TBD").join(" vs ") : "To be decided"}
      className={`absolute overflow-hidden rounded-[3px] border bg-riser text-left ${
        selected ? "border-ink" : ours ? "" : "border-edge"
      } ${m ? "cursor-pointer" : "cursor-default"}`}
      style={{ ...style, width: W, height: BOX, ...(ours && !selected ? { borderColor: accent } : null) }}
    >
      {live && <LiveDot className={`absolute top-[3px] ${mirror ? "left-[3px]" : "right-[3px]"}`} />}
      {[0, 1].map((i) => {
        const team = m?.teams[i] ?? null;
        const score = live && m?.live ? m.live[i] : (team?.score ?? null);
        return <BoxRow key={i} team={team} score={score} live={live} done={m?.status === "final"} mirror={mirror} accent={accent} />;
      })}
    </button>
  );
}

function BoxRow({
  team,
  score,
  live,
  done,
  mirror,
  accent,
}: {
  team: BracketTeam | null;
  score: number | null;
  live: boolean;
  done: boolean;
  mirror: boolean;
  accent: string;
}) {
  const faded = done && !!team && !team.won;
  return (
    <div
      className={`flex items-center gap-[3px] px-[3px] ${mirror ? "flex-row-reverse" : ""} ${faded ? "opacity-40" : ""}`}
      style={{ height: ROW, ...(team?.isUs ? { background: `${accent}1a` } : null) }}
    >
      <span className="relative shrink-0">
        {team ? <TeamMark team={team} size={18} /> : <span className="block h-[18px] w-[18px]" />}
        {team?.seed != null && (
          <span
            className={`absolute -bottom-[3px] ${mirror ? "-right-[3px]" : "-left-[3px]"} rounded-[2px] bg-riser px-[1px] text-[7px] leading-none font-medium text-dim tnum`}
          >
            {team.seed}
          </span>
        )}
      </span>
      <span
        className={`min-w-0 flex-1 text-[11px] tracking-tight tnum ${mirror ? "text-left" : "text-right"} ${team?.won ? "font-bold" : ""}`}
        style={live ? { color: "var(--color-loss)", fontWeight: 600 } : undefined}
      >
        {score ?? ""}
      </span>
    </div>
  );
}

function ChampionBanner({ team, accent }: { team: BracketTeam; accent: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[4px] border border-edge bg-riser px-4 py-3"
      style={team.isUs ? { borderLeftColor: accent, borderLeftWidth: 3 } : undefined}
    >
      <TeamMark team={team} size={32} />
      <div className="min-w-0">
        <p className="text-[11px] text-faint">Champion</p>
        <p className="wide truncate text-[17px] font-semibold">{team.name}</p>
      </div>
    </div>
  );
}

/* ────────────────────────────── 목록 (나무가 안 설 때) ────────────────────────────── */

/**
 * 라운드를 고르는 줄과 그 라운드의 매치업들. **지금 하는 라운드가 먼저 열린다.**
 * 아직 안 열린 빈 라운드는 고를 것이 없으니 줄에 안 넣는다.
 */
function BracketList({ rounds: all, accent }: { rounds: BracketRound[]; accent: string }) {
  const rounds = all.filter((r) => r.matchups.length > 0);
  const [picked, setPicked] = useState<number | null>(null);
  if (rounds.length === 0) return <Empty>The postseason hasn&apos;t started.</Empty>;

  const index = Math.min(picked ?? currentRound(rounds), rounds.length - 1);
  const round = rounds[index];
  const champion = championOf(all);

  // 묶음(AL/NL, East/West, 지역)이 있으면 그것대로 끊어 그린다. 결승처럼 묶음이 없는 라운드는 한 덩어리.
  const groups: { name: string | null; matchups: Matchup[] }[] = [];
  for (const m of round.matchups) {
    const last = groups[groups.length - 1];
    if (last && last.name === m.group) last.matchups.push(m);
    else groups.push({ name: m.group, matchups: [m] });
  }

  return (
    <div className="flex flex-col gap-6">
      {champion && <ChampionBanner team={champion} accent={accent} />}

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

/* ────────────────────────────── 매치업 한 장 ────────────────────────────── */

function MatchupCard({ matchup: m, accent }: { matchup: Matchup; accent: string }) {
  const ours = m.teams.some((t) => t?.isUs);
  const done = m.status === "final";
  const live = m.status === "in";
  // 시리즈가 하는 중이면 이긴 수 옆에 **지금 경기 점수**를 따로 둔다. 단판은 점수가 곧 그것이다.
  const liveGame = live && m.series && m.live ? m.live : null;

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
      {(m.label || m.group) && (
        <p className="truncate px-3 pt-2.5 text-[11px] text-faint">{[m.group, m.label].filter(Boolean).join(" · ")}</p>
      )}
      {liveGame && (
        <div className="flex justify-end gap-4 px-3 pt-2 text-[10px] text-faint">
          <span>Series</span>
          <span className="w-6 text-right">Now</span>
        </div>
      )}
      <div className="flex flex-col px-3 py-1.5">
        {m.teams.map((t, i) => (
          <Row key={t?.name ?? `tbd-${i}`} team={t} done={done} accent={accent} now={liveGame ? liveGame[i] : undefined} />
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

function Row({
  team,
  done,
  accent,
  now,
}: {
  team: BracketTeam | null;
  done: boolean;
  accent: string;
  /** 시리즈가 하는 중일 때 지금 경기의 점수. 아니면 undefined. */
  now?: number | null;
}) {
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
      {now !== undefined && (
        <span className="w-6 shrink-0 text-right text-[14px] font-semibold tnum" style={{ color: "var(--color-loss)" }}>
          {now ?? ""}
        </span>
      )}
    </div>
  );
}

function TeamMark({ team, size }: { team: BracketTeam; size: number }) {
  if (team.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo} alt="" title={team.name} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  // 고등학교 상대에는 로고가 없을 때가 있다. 일정 표와 같게, 첫 글자만 흐리게 둔다.
  return (
    <span
      className="flex shrink-0 items-center justify-center text-[11px] text-faint"
      style={{ width: size, height: size }}
      title={team.name}
      aria-hidden
    >
      {team.name.charAt(0)}
    </span>
  );
}
