#!/usr/bin/env python3
"""Génère l'image d'aperçu social 1200x630 de Neon Jackpot."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "og.png")
FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")

def font(name, size):
    for candidate in (name, "segoeuib.ttf", "segoeui.ttf", "arialbd.ttf"):
        path = os.path.join(FONTS, candidate)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

title_font = font("segoeuib.ttf", 84)
sub_font = font("segoeui.ttf", 28)
desc_font = font("segoeui.ttf", 20)
chip_font = font("segoeuib.ttf", 17)
mono_font = font("consola.ttf", 20)
small_font = font("segoeui.ttf", 18)

img = Image.new("RGB", (W, H), "#07070f")
px = img.load()
for y in range(H):
    t = y / H
    px_color = (
        int(7 + 20 * (1 - t) + 14 * t),
        int(7 + 6 * (1 - t)),
        int(15 + 34 * (1 - t) + 18 * t),
    )
    for x in range(W):
        px[x, y] = px_color

# halos
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for cx, cy, rad, color in [
    (980, 80, 340, (255, 79, 216, 65)),
    (1060, 580, 300, (34, 211, 238, 44)),
    (100, 600, 260, (139, 92, 246, 40)),
]:
    gd.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=color)
glow = glow.filter(ImageFilter.GaussianBlur(90))
img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
draw = ImageDraw.Draw(img)

# grille
for x in range(0, W, 52):
    draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 4), width=1)
for y in range(0, H, 52):
    draw.line([(0, y), (W, y)], fill=(255, 255, 255, 4), width=1)

# cadre
draw.rounded_rectangle((34, 34, W - 34, H - 34), radius=28, outline=(255, 255, 255, 20), width=2)

# logo 7 avec halo
logo = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
ld = ImageDraw.Draw(logo)
ld.rounded_rectangle((8, 8, 232, 232), radius=56, fill=(255, 79, 216, 22), outline=(255, 130, 225, 190), width=3)
ld.text((120, 120), "7", font=font("segoeuib.ttf", 150), fill=(255, 255, 255, 255), anchor="mm")
logo_glow = logo.filter(ImageFilter.GaussianBlur(20))
base = img.crop((78, 100, 318, 340)).convert("RGBA")
base = Image.alpha_composite(base, logo_glow)
base = Image.alpha_composite(base, logo)
img.paste(base.convert("RGB"), (78, 100))

# panneau de texte
panel = Image.new("RGBA", (810, 460), (0, 0, 0, 0))
pd = ImageDraw.Draw(panel)
pd.rounded_rectangle((0, 0, 810, 460), radius=26, fill=(12, 8, 26, 205), outline=(255, 255, 255, 28), width=1)
img.paste(panel.convert("RGB"), (340, 80), panel)

# titre dégradé
title = "NEON JACKPOT"
mask = Image.new("L", (760, 112), 0)
md = ImageDraw.Draw(mask)
md.text((0, 0), title, font=title_font, fill=255)
grad = Image.new("RGB", (760, 112), "#ffffff")
gp = grad.load()
for x in range(760):
    t = x / 760
    for y in range(112):
        tt = y / 112
        r = int(255 * (1 - tt) + 255 * tt)
        g = int(255 * (1 - tt) + 125 * tt)
        b = int(255 * (1 - tt) + 235 * tt)
        gp[x, y] = (r, g, b)
img.paste(grad, (372, 125), mask)
draw = ImageDraw.Draw(img)

draw.text((374, 238), "Le casino incrémental qui ne dort jamais.", font=sub_font, fill=(242, 236, 255))
draw.text((374, 282), "Plinko physique · 11 jeux · auto partout · 100 % virtuel", font=desc_font, fill=(201, 191, 224))

# chips
chips = [
    ("10 JEUX", (255, 100, 220)),
    ("213 SUCCÈS", (255, 206, 105)),
    ("AUTO PARTOUT", (80, 225, 240)),
    ("100 % VIRTUEL", (95, 230, 150)),
]
x = 374
y = 333
for label, color in chips:
    tw = draw.textlength(label, font=chip_font)
    draw.rounded_rectangle((x, y, x + tw + 30, y + 40), radius=20, fill=(255, 255, 255, 10), outline=color, width=1)
    draw.text((x + 15, y + 9), label, font=chip_font, fill=color)
    x += tw + 42

draw.line([(374, 415), (1110, 415)], fill=(255, 255, 255, 28), width=1)
draw.text((374, 437), "casifox.github.io/neon-jackpot", font=mono_font, fill=(255, 210, 110))
draw.text((374, 474), "Jouez gratuitement dans votre navigateur.", font=small_font, fill=(201, 191, 224))
draw.text((374, 506), "Aucun argent réel · aucune boutique payante · aucune publicité", font=small_font, fill=(151, 141, 174))

# symboles
for i, (sym, col) in enumerate([("♠", "#80e5f0"), ("♥", "#ff64dc"), ("♣", "#f8fafc"), ("♦", "#ffc857")]):
    draw.text((995 + (i % 2) * 60, 425 + (i // 2) * 55), sym, font=font("segoeuib.ttf", 44), fill=col)

img.save(OUT, "PNG")
print(f"Image générée : {os.path.abspath(OUT)}")
