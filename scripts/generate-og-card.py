#!/usr/bin/env python3
"""Generate the 1200x630 Open Graph card for dhruv.html.

Output: public/images/og/dhruv-og.png
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORTRAIT = ROOT / "public" / "images" / "dhruv" / "Dhruv.jpeg"
OUT_DIR = ROOT / "public" / "images" / "og"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "dhruv-og.png"

W, H = 1200, 630
BG = (255, 255, 255)
FG = (0, 0, 0)
MUTED = (85, 85, 85)
HAIRLINE = (200, 200, 200)

TIMES = "/System/Library/Fonts/Supplemental/Times New Roman.ttf"
TIMES_BOLD = "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf"
TIMES_ITALIC = "/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf"
import os
for candidate in [TIMES, "/Library/Fonts/Times.ttc", "/System/Library/Fonts/Times.ttc"]:
    if os.path.exists(candidate):
        TIMES = candidate
        break
for candidate in [TIMES_BOLD, "/Library/Fonts/Times.ttc", "/System/Library/Fonts/Times.ttc"]:
    if os.path.exists(candidate):
        TIMES_BOLD = candidate
        break
for candidate in [TIMES_ITALIC, "/Library/Fonts/Times.ttc", "/System/Library/Fonts/Times.ttc"]:
    if os.path.exists(candidate):
        TIMES_ITALIC = candidate
        break

def load(path, size):
    return ImageFont.truetype(path, size)

card = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(card)

# Portrait: fill the right 460px, full height, cover-crop.
PORTRAIT_W = 460
portrait_box = (W - PORTRAIT_W, 0, W, H)
pimg = Image.open(PORTRAIT).convert("RGB")
src_w, src_h = pimg.size
target_ratio = PORTRAIT_W / H
src_ratio = src_w / src_h
if src_ratio > target_ratio:
    new_w = int(src_h * target_ratio)
    left = (src_w - new_w) // 2
    pimg = pimg.crop((left, 0, left + new_w, src_h))
else:
    new_h = int(src_w / target_ratio)
    top = (src_h - new_h) // 2
    pimg = pimg.crop((0, top, src_w, top + new_h))
pimg = pimg.resize((PORTRAIT_W, H), Image.LANCZOS)
card.paste(pimg, portrait_box[:2])

# Left column typography.
PAD_L = 70
col_w = W - PORTRAIT_W - 2 * PAD_L

y = 80
label = "ZETESIS LABS  \u00b7  ARTPARK @ IISc"
f_label = load(TIMES_BOLD, 22)
draw.text((PAD_L, y), label, fill=MUTED, font=f_label)
y += 45

f_name = load(TIMES_BOLD, 96)
draw.text((PAD_L, y), "Dhruv Gupta", fill=FG, font=f_name)
y += 115

f_role = load(TIMES, 42)
draw.text((PAD_L, y), "Principal Investigator", fill=FG, font=f_role)
y += 70

draw.line([(PAD_L, y), (PAD_L + 340, y)], fill=FG, width=1)
y += 28

f_tag = load(TIMES_ITALIC, 30)
tagline_lines = [
    "Verified, long-horizon synthetic",
    "discovery with formal verification",
    "at the core.",
]
for line in tagline_lines:
    draw.text((PAD_L, y), line, fill=FG, font=f_tag)
    y += 40

f_url = load(TIMES, 26)
draw.text((PAD_L, H - 90), "zetesislabs.com/dhruv.html", fill=MUTED, font=f_url)

card.save(OUT, "PNG", optimize=True)
print(f"wrote {OUT}  ({W}x{H})")
