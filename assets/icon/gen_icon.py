# -*- coding: utf-8 -*-
"""SL Sports 앱 마크 — 천장에 걸린 배너.

경기장 천장에 걸린 우승 배너다. 램스 로열 블루에 흰 SL, 그 아래 말린 뿔 하나, 봉은
솔 옐로. **뿔은 직접 그렸다** — 팀 실물 로고를 쓰면 앱이 램스 것처럼 보인다. 아는
사람 눈에만 램스인 정도가 맞다.

(2026-10 전에는 차저스 파우더블루에 번개였다. 차저스를 램스로 바꾸면서 같이 바꿨다.)

만드는 법은 SVG 한 장 → qlmanage 로 1024 래스터 → sips 로 축소. 빌드에 안 끼워 뒀다 —
아이콘은 1년에 한 번 바뀔까 말까 한데, 매 배포마다 렌더하면 그만큼 느려지고 깨질 자리만 는다.

    python3 assets/icon/gen_icon.py

애플 아이콘만 **모서리를 안 깎는다**: iOS 가 자기 마스크를 한 번 더 씌우기 때문에,
둥근 판을 주면 두 번 깎여 타일이 작아 보인다.
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

INK = "#101215"
CHALK = "#FFFFFF"
DIM = "#8B939E"
BLUE = "#003594"   # 램스 로열 블루
GOLD = "#FFD100"   # 램스 솔 옐로
FONT = "Helvetica Neue, Helvetica, Arial"

BANNER = "M146 120 H 366 V 378 L 256 316 L 146 378 Z"
# 헬멧 이마에서 뒤로 넘어가 아래로 말리는 뿔. 512 판 위에서 그렸고 가운데가 대략 (280, 240).
# 크게 그리면 배너 아래 홈에 닿아서 0.36 배로 줄여 SL 과 홈 사이에 앉혔다(셋 그려 보고 고름).
HORN = "M120 330 C 150 170, 330 120, 392 210 C 440 280, 380 360, 318 330 C 270 306, 290 246, 336 256"


def horn(cx: float, cy: float, scale: float, stroke: float) -> str:
    return (f'<g transform="translate({cx} {cy}) scale({scale}) translate(-280 -240)">'
            f'<path d="{HORN}" fill="none" stroke="{GOLD}" stroke-width="{stroke / scale:.1f}" '
            f'stroke-linecap="round" stroke-linejoin="round"/></g>')


def svg(rounded: bool) -> str:
    plate = (f'<rect width="512" height="512" rx="112" fill="{INK}"/>' if rounded
             else f'<rect width="512" height="512" fill="{INK}"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  {plate}
  <rect x="104" y="104" width="304" height="14" rx="7" fill="{GOLD}"/>
  <circle cx="104" cy="111" r="12" fill="{GOLD}"/>
  <circle cx="408" cy="111" r="12" fill="{GOLD}"/>
  <path d="{BANNER}" fill="{BLUE}"/>
  <text x="256" y="226" font-family="{FONT}" font-size="100" font-weight="700" font-style="italic"
        text-anchor="middle" letter-spacing="-6" fill="{CHALK}">SL</text>
  {horn(256, 276, 0.36, 13)}
</svg>'''


def render(name: str, rounded: bool) -> str:
    """SVG 한 장을 1024 PNG 으로. qlmanage 는 결과를 <이름>.png 로 떨군다."""
    src = os.path.join(HERE, f"{name}.svg")
    with open(src, "w", encoding="utf-8") as f:
        f.write(svg(rounded))
    subprocess.run(["qlmanage", "-t", "-s", "1024", "-o", HERE, src],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out = os.path.join(HERE, f"{name}.svg.png")
    master = os.path.join(HERE, f"{name}_1024.png")
    os.replace(out, master)
    os.remove(src)
    return master


def resize(master: str, size: int, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.run(["sips", "-z", str(size), str(size), master, "--out", dest],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"  {os.path.relpath(dest, ROOT)}  {size}x{size}")


def main() -> None:
    rounded = render("sl_sports", rounded=True)
    square = render("sl_sports_square", rounded=False)
    print("wrote:")
    # 브라우저 탭·PWA
    resize(rounded, 512, os.path.join(ROOT, "src/app/icon.png"))
    resize(rounded, 512, os.path.join(ROOT, "public/icons/icon-512.png"))
    resize(rounded, 192, os.path.join(ROOT, "public/icons/icon-192.png"))
    # iOS 홈 화면 — 모서리는 iOS 가 깎는다
    resize(square, 180, os.path.join(ROOT, "src/app/apple-icon.png"))
    # 아이폰 앱 — 역시 모서리 안 깎은 판. **알파 채널이 있으면 App Store 가 업로드를 거절한다**
    # (qlmanage 는 불투명한 그림에도 알파를 붙여 내보낸다) — JPEG 를 한 번 거쳐 떼어 낸다.
    ios = os.path.join(ROOT, "ios/SLSports/Assets.xcassets/AppIcon.appiconset/icon-1024.png")
    flat = os.path.join(HERE, "_flat.jpg")
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "best", square, "--out", flat],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["sips", "-s", "format", "png", flat, "--out", ios],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(flat)
    print(f"  {os.path.relpath(ios, ROOT)}  1024x1024 (알파 없음)")


if __name__ == "__main__":
    main()
