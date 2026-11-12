#!/usr/bin/env python3
"""Génère l'image d'aperçu social 1200x630 de Neon Jackpot (direction 2.0)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "og.png")
FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")

PAPER = (241, 231, 211)
PAPER_DEEP = (230, 217, 192)
INK = (23, 19, 13)
INK_SOFT = (74, 64, 51)
CREAM = (243, 234, 216)


def font(name, size):
    for candidate in (name, "segoeuib.ttf", "segoeui.ttf", "arialbd.ttf"):
        path = os.path.join(FONTS, candidate)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def serif(size):
    for candidate in ("bodoni.ttf", "BOD_B.TTF", "georgiab.ttf", "timesbd.ttf"):
        path = os.path.join(FONTS, candidate)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return font("georgiab.ttf", size)


title_font = serif(86)
sub_font = font("segoeui.ttf", 28)
desc_font = font("segoeui.ttf", 20)
chip_font = font("segoeuib.ttf", 17)
mono_font = font("consola.ttf", 20)
small_font = font("segoeui.ttf", 18)

img = Image.new("RGB", (W, H), PAPER)

# Trame papier très légère
for y in range(0, H, 5):
    for x in range(0, W, 97):
        img.putpixel((x, y), PAPER_DEEP)

# Bandeau sombre à droite
panel = Image.new("RGBA", (720, H), (0, 0, 0, 0))
pd = ImageDraw.Draw(panel)
pd.rectangle((0, 0, 720, H), fill=(18, 24, 21, 255))
img.paste(panel.convert("RGB"), (480, 0))

# Filets laiton
draw = ImageDraw.Draw(img)
for offset, alpha in ((0, 255), (10, 255), (20, 255)):
    draw.line([(480, 0), (480, H)], fill=(211, 174, 98), width=2)

draw.rectangle((28, 28, W - 29, H - 29), outline=INK, width=3)
draw.rectangle((40, 40, W - 41, H - 41), outline=(211, 174, 98), width=1)

# Logo : plaque d'encre et 7 crème
draw.rectangle((64, 64, 300, 300), fill=INK)
draw.rectangle((76, 76, 288, 288), outline=(211, 174, 98), width=2)
draw.text((182, 178), "7", font=serif(150), fill=CREAM, anchor="mm")

# Suites autour du logo
draw.text((92, 96), "♠", font=font("seguisym.ttf", 34), fill=CREAM)
draw.text((252, 96), "♦", font=font("seguisym.ttf", 34), fill=(226, 84, 58))
draw.text((92, 322), "♣", font=font("seguisym.ttf", 34), fill=(127, 203, 176))
draw.text((252, 322), "♥", font=font("seguisym.ttf", 34), fill=(226, 84, 58))

# Texte principal sur le bandeau
draw.text((540, 92), "CASINO INCRÉMENTAL · 100 % VIRTUEL", font=chip_font, fill=(211, 174, 98))
draw.text((540, 140), "NEON", font=title_font, fill=CREAM)
draw.text((540, 228), "JACKPOT", font=title_font, fill=(226, 84, 58))

draw.text((540, 330), "Le casino qui ne dort jamais.", font=sub_font, fill=CREAM)
draw.text((540, 372), "Plinko physique · 11 jeux · auto partout · 100 % virtuel", font=desc_font, fill=(217, 207, 186))

# Pastilles
chips = [
    ("11 JEUX", (211, 174, 98)),
    ("213 SUCCÈS", (226, 84, 58)),
    ("AUTO PARTOUT", (127, 203, 176)),
    ("100 % VIRTUEL", (134, 201, 155)),
]
x = 540
y = 420
for label, color in chips:
    tw = draw.textlength(label, font=chip_font)
    draw.rectangle((x, y, x + tw + 26, y + 36), outline=color, width=1)
    draw.text((x + 13, y + 8), label, font=chip_font, fill=color)
    x += tw + 36

draw.line([(540, 486), (1120, 486)], fill=(211, 174, 98), width=1)
draw.text((540, 502), "casifox.github.io/neon-jackpot", font=mono_font, fill=(211, 174, 98))
draw.text((540, 534), "Jouez gratuitement dans votre navigateur.", font=small_font, fill=(217, 207, 186))
draw.text((540, 562), "Aucun argent réel · aucune boutique payante · aucune publicité", font=small_font, fill=(154, 145, 131))

# Signature typographique
draw.text((74, 356), "SALLE DE JEU", font=chip_font, fill=INK_SOFT)
draw.text((74, 386), "PROGRAMME", font=chip_font, fill=(226, 84, 58))
draw.line([(74, 428), (300, 428)], fill=INK, width=1)
draw.text((74, 446), "PAPIER · LAITON · VERMILLON", font=small_font, fill=INK_SOFT)

img.save(OUT, "PNG")
print(f"Image générée : {os.path.abspath(OUT)}")
