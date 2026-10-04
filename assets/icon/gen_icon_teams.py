# -*- coding: utf-8 -*-
"""로고 후보 — 사용자의 네 팀 실제 엠블럼(9/17).

램스(NFL)·다저스(MLB)·덕스(NHL)·클리퍼스(NBA). 시판하지 않는 개인 앱이라
팀 마크를 그대로 쓴다(사용자 확인).

ESPN의 어두운 배경용(500-dark)을 받는다 — 기본 판은 밝은 배경 전제라 남색 위에
올리면 검은 획이 묻힌다. 받은 뒤 **투명 여백을 잘라** 실제 그림만 남긴다:
로고마다 여백이 달라 그대로 두면 크기가 제각각으로 보인다.
"""
import io, os, urllib.request
from PIL import Image, ImageDraw

OUT = os.path.dirname(os.path.abspath(__file__))
S = 1200
BG = (15, 23, 42)          # 남색(master)
BG_I = (30, 27, 75)        # 인디고(LP 개인용)

SRC = {
  'rams':     'https://a.espncdn.com/i/teamlogos/nfl/500-dark/lar.png',
  'dodgers':  'https://a.espncdn.com/i/teamlogos/mlb/500-dark/lad.png',
  'ducks':    'https://a.espncdn.com/i/teamlogos/nhl/500-dark/ana.png',
  'clippers': 'https://a.espncdn.com/i/teamlogos/nba/500-dark/lac.png',
}


def fetch(url):
    # ESPN은 Mozilla UA를 403으로 막는다 — urllib 기본 UA가 통과한다(9/4 실측).
    raw = urllib.request.urlopen(url, timeout=25).read()
    im = Image.open(io.BytesIO(raw)).convert('RGBA')
    bb = im.getchannel('A').getbbox()      # 투명 여백 제거
    return im.crop(bb) if bb else im


def place(base, art, cx, cy, h):
    """높이 h에 맞춰 얹는다. 로고마다 가로세로비가 달라 **높이**로 맞춰야 고르게 보인다."""
    w = max(1, round(art.width * h / art.height))
    a = art.resize((w, h), Image.LANCZOS)
    lay = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    lay.paste(a, (round(cx - w / 2), round(cy - h / 2)), a)
    return Image.alpha_composite(base, lay)


L = {k: fetch(v) for k, v in SRC.items()}


def build(layout, bg=BG):
    base = Image.new('RGBA', (S, S), bg + (255,))
    for key, cx, cy, h in layout:
        base = place(base, L[key], cx, cy, h)
    return base.convert('RGB').resize((1024, 1024), Image.LANCZOS)


CANDS = [
  ('M. 2×2 격자', [
      ('clippers', 330, 330, 380), ('dodgers', 870, 330, 380),
      ('rams', 330, 870, 340), ('ducks', 870, 870, 380)]),
  ('N. 2×2 크게·겹침', [
      ('clippers', 360, 350, 470), ('dodgers', 850, 340, 470),
      ('rams', 350, 860, 420), ('ducks', 860, 870, 470)]),
  ('O. 다저스 크게 + 셋', [
      ('dodgers', 600, 520, 560),
      ('clippers', 230, 960, 290), ('rams', 600, 1000, 250), ('ducks', 970, 960, 290)]),
  ('P. 셋 (덕스 뺌)', [
      ('clippers', 330, 380, 440), ('dodgers', 870, 380, 440),
      ('rams', 600, 880, 400)]),
  ('Q. 가로 한 줄', [
      ('clippers', 200, 600, 330), ('dodgers', 470, 600, 330),
      ('rams', 740, 600, 300), ('ducks', 1010, 600, 330)]),
  ('R. 둘 (다저스·램스)', [
      ('dodgers', 420, 440, 560), ('rams', 760, 790, 500)]),
]

sheet = Image.new('RGB', (3 * 360 + 40, 2 * 430 + 30), (12, 16, 28))
d = ImageDraw.Draw(sheet)
for i, (name, lay) in enumerate(CANDS):
    im = build(lay)
    im.save(f'{OUT}/logo{i+1}.png')
    x, y = 10 + (i % 3) * 360, 10 + (i // 3) * 430
    sheet.paste(im.resize((330, 330), Image.LANCZOS), (x, y))
    sheet.paste(im.resize((72, 72), Image.LANCZOS), (x + 240, y + 340))
    d.text((x + 4, y + 344), name, fill=(200, 210, 225))
    d.text((x + 4, y + 364), '오른쪽 72px', fill=(110, 125, 145))
sheet.save(f'{OUT}/logo_sheet.png')
print('  팀 엠블럼 후보 6종:', f'{OUT}/logo_sheet.png')
