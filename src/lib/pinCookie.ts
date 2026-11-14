// 웹 화면 PIN 잠금의 쿠키. PIN 그 자체를 쿠키에 넣지 않고 해시를 넣는다.
// APP_PIN 이 없으면(로컬 개발) 잠그지 않는다.
export const PIN_COOKIE = "sls_pin";

export async function pinToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`sl_sports:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
