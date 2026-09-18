# -*- coding: utf-8 -*-
"""SL Sports 앱 마크 — 천장에 걸린 배너.

경기장 천장에 걸린 우승 배너다. 차저스 파우더블루(한 톤 올린 값)에 흰 SL, 그 아래
번개, 봉은 골드. **번개는 직접 그렸다** — 팀 실물 로고를 앱 아이콘에 쓰면 앱이 차저스
것처럼 보이고, 무엇보다 로고 본체가 파우더블루라 파란 배너 위에서 죽는다(확인함).

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
BLUE = "#12A3E0"   # 차저스 파우더블루를 한 톤 올린 값
GOLD = "#FFC20E"
FONT = "Helvetica Neue, Helvetica, Arial"

BANNER = "M146 120 H 366 V 378 L 256 316 L 146 378 Z"
# 0..158 x 0..62 안에서 그린 번개. 여섯 개 그려 보고 고른 모양이다.
BOLT = "M0 30 L 78 30 L 56 4 L 158 24 L 100 30 L 118 58 Z"


def bolt(cx: float, cy: float, w: float) -> str:
    s = w / 158
    return (f'<g transform="translate({cx - w / 2:.1f} {cy - 62 * s / 2:.1f}) scale({s:.4f})">'
            f'<path d="{BOLT}" fill="{GOLD}"/></g>')


def svg(rounded: bool) -> str:
    plate = (f'<rect width="512" height="512" rx="112" fill="{INK}"/>' if rounded
             else f'<rect width="512" height="512" fill="{INK}"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  {plate}
  <rect x="104" y="104" width="304" height="14" rx="7" fill="{GOLD}"/>
  <circle cx="104" cy="111" r="12" fill="{GOLD}"/>
  <circle cx="408" cy="111" r="12" fill="{GOLD}"/>
  <path d="{BANNER}" fill="{BLUE}"/>
  <text x="256" y="236" font-family="{FONT}" font-size="100" font-weight="700" font-style="italic"
        text-anchor="middle" letter-spacing="-6" fill="{CHALK}">SL</text>
  {bolt(256, 282, 182)}
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


if __name__ == "__main__":
    main()
