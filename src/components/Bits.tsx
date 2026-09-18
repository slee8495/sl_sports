import type { Game } from "@/lib/sources/types";
import { gameLabel, relative, timeLabel } from "@/lib/format";

/**
 * 화면 여기저기서 같은 모양으로 되풀이되는 조각들.
 *
 * 경기 한 줄, 승패 띠, 빈 칸 — 세 군데 이상에서 쓰이는 것만 여기 둔다. 한 군데서만 쓰는
 * 모양을 미리 여기로 올리면, 고칠 때 그게 어디에 쓰이는지부터 찾아야 한다.
 */

/** 진행 중 표시. 이 앱에서 유일하게 움직이는 것이다. */
export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`live-dot inline-block h-1.5 w-1.5 rounded-full bg-loss ${className}`} aria-hidden />
  );
}

/**
 * 승·패를 네모 한 칸씩.
 *
 * 전적 "7-3" 은 얼마나 이겼는지만 말하고, **어떻게 흘러왔는지**는 말하지 않는다. 3연패 뒤
 * 7승과 7승 뒤 3연패는 완전히 다른 시즌인데 숫자로는 같다. 그래서 순서대로 늘어놓는다.
 */
export function FormStrip({ games, max = 10 }: { games: Game[]; max?: number }) {
  const recent = games.filter((g) => g.result).slice(-max);
  if (recent.length === 0) return null;

  return (
    <div className="flex items-center gap-[3px]" aria-label="Recent results">
      {recent.map((g) => (
        <span
          key={g.id}
          title={`${g.result} ${g.ourScore}-${g.theirScore} ${g.isHome ? "vs" : "@"} ${g.opponent.name}`}
          className={`h-[14px] w-[6px] rounded-[1px] ${
            g.result === "W" ? "bg-win" : g.result === "L" ? "bg-loss" : "bg-faint"
          }`}
        />
      ))}
    </div>
  );
}

/** 경기 한 줄을 말로. "vs Raiders" / "at Broncos" — 팬이 쓰는 그대로. */
export function matchup(game: Game): string {
  const side = game.neutralSite ? "vs" : game.isHome === false ? "at" : "vs";
  return `${side} ${game.opponent.shortName ?? game.opponent.name}`;
}

export function scoreline(game: Game): string | null {
  if (game.ourScore == null || game.theirScore == null) return null;
  return `${game.ourScore}–${game.theirScore}`;
}

/**
 * 한 경기를 한 줄로.
 *
 * 예정된 경기는 **언제**가 굵고, 끝난 경기는 **결과**가 굵다. 같은 줄이지만 보러 오는
 * 이유가 다르다.
 */
export function GameRow({ game, accent }: { game: Game; accent: string }) {
  const done = game.status === "final";
  const live = game.status === "in";
  const score = scoreline(game);

  return (
    <div className="flex items-center gap-3 border-b border-edge/70 py-3 last:border-b-0">
      <div className="w-7 shrink-0">
        {game.opponent.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.opponent.logo} alt="" className="h-7 w-7 object-contain" />
        ) : (
          /*
            **고등학교 상대에는 로고가 없다.** 빈 네모를 두면 "이미지가 깨졌다" 로 읽힌다.
            이름의 첫 글자만 흐리게 둔다 — 자리는 지키되 없는 것을 있는 척하지 않는다.
          */
          <span className="flex h-7 w-7 items-center justify-center text-[13px] text-faint" aria-hidden>
            {game.opponent.name.charAt(0)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] leading-tight">
          <span className="text-faint">{game.neutralSite ? "vs" : game.isHome === false ? "at" : "vs"} </span>
          <span className="font-medium">{game.opponent.name}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-dim tnum">
          {game.status === "postponed"
            ? "Postponed"
            : gameLabel(game.startsAt, game.timeTbd)}
          {game.note ? ` · ${game.note}` : ""}
          {game.broadcast ? ` · ${game.broadcast}` : ""}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {live && (
          <div className="flex items-center justify-end gap-1.5">
            <LiveDot />
            <span className="text-[15px] font-semibold tnum">{score ?? "Live"}</span>
          </div>
        )}
        {done && score && (
          <div className="flex items-center justify-end gap-2">
            <span
              className="text-[11px] font-bold"
              style={{ color: game.result === "W" ? "var(--color-win)" : game.result === "L" ? "var(--color-loss)" : "var(--color-dim)" }}
            >
              {game.result}
            </span>
            <span className="text-[15px] tnum">{score}</span>
          </div>
        )}
        {!done && !live && (
          <span className="text-xs text-faint tnum">{game.timeTbd ? "TBD" : timeLabel(game.startsAt)}</span>
        )}
      </div>

      {live && <span className="ml-1 h-8 w-[3px] rounded-full" style={{ background: accent }} aria-hidden />}
    </div>
  );
}

/**
 * 빈 칸.
 *
 * **못 가져온 것과 없는 것을 같게 적지 않는다.** "경기 없음" 과 "ESPN 이 대답을 안 한다" 는
 * 읽는 사람이 할 일이 다르다 — 하나는 기다리는 것이고 하나는 새로고침이다.
 */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-faint">{children}</p>;
}

export function Failed({ what }: { what: string }) {
  return (
    <p className="py-8 text-center text-sm text-faint">
      Couldn&apos;t load {what}. The source didn&apos;t answer — try again in a minute.
    </p>
  );
}

/** 섹션 제목. 위에 눈썹 라벨을 얹지 않는다 — 제목 하나로 충분하다. */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="wide text-sm font-semibold">{children}</h2>
      {aside && <span className="text-xs text-faint tnum">{aside}</span>}
    </div>
  );
}

export function whenLabel(game: Game): string {
  return `${gameLabel(game.startsAt, game.timeTbd)} · ${relative(game.startsAt)}`;
}
