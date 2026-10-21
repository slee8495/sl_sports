import Link from "next/link";
import { CITIES, TEAMS } from "@/lib/sources/teams";
import { todayLabel } from "@/lib/format";

// 날짜 한 줄 때문에 매번 그린다. 구워 두면 배포한 날에 멈춘다.
export const dynamic = "force-dynamic";

/*
  **첫 화면은 갈림길이다.** LA·뉴욕·런던·한국 중 하나를 고르면 그 도시의 서가가 나온다.

  여기서는 아무것도 부르지 않는다 — 표에 적힌 로고만 늘어놓는다. 경기 정보는 도시를
  고른 뒤에 읽는다. 열여섯 팀을 다 읽고 나서야 네 칸짜리 갈림길이 뜨면 느리기만 하다.
*/
export default function Cities() {
  return (
    <main>
      <header className="pt-2 pb-7">
        <p className="text-xs tracking-wide text-faint">{todayLabel()}</p>
        <h1 className="wide mt-3 text-[26px] leading-[1.05] font-semibold sm:text-[32px]">SL Sports</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {CITIES.map((city) => {
          const teams = TEAMS.filter((t) => t.city === city.key);
          return (
            <Link key={city.key} href={`/${city.key}`} className="group block">
              <div
                className="rounded-[3px] border border-edge bg-riser p-5 transition-transform duration-200 group-hover:-translate-y-1"
                style={{ boxShadow: "0 10px 20px -14px rgba(16,20,28,.5)" }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  {/* 도시 이름은 팻말이지 제목이 아니다. 넓힌 글꼴은 경기 제목에만 쓴다. */}
                  <h2 className="text-[17px] leading-tight font-semibold">{city.name}</h2>
                  <span className="text-xs text-faint">{teams.length} {teams.length === 1 ? "team" : "teams"}</span>
                </div>

                {/* 로고 줄. 이름을 읽지 않고 어느 쪽인지 아는 자리다. */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {teams.map((t) => (
                    <span
                      key={t.slug}
                      className="h-9 w-9 rounded-[3px] p-1.5"
                      style={{ background: `${t.colors.primary}14` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.logo} alt={t.name} className="h-full w-full object-contain" />
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
