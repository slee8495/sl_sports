export const metadata = { title: "SL Sports" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  const { wrong } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form method="post" action="/api/login" className="flex w-full max-w-xs flex-col gap-3">
        <h1 className="text-center text-xl font-semibold">SL Sports</h1>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="current-password"
          autoFocus
          placeholder="PIN 6자리"
          className="rounded-lg border border-current/20 bg-transparent px-4 py-3 text-center text-2xl tracking-[0.5em]"
        />
        {wrong && <p className="text-center text-sm text-red-500">PIN 이 맞지 않습니다. 다시 넣어 주세요.</p>}
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white">
          들어가기
        </button>
      </form>
    </main>
  );
}
