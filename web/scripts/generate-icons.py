"""Regenerate the bundled PWA icons from TeleDrive's code-native cloud mark.

Optional authoring tool: Python with Pillow. Production builds use the checked-in PNGs.
"""
from pathlib import Path
from PIL import Image, ImageDraw

DESTINATION = Path(__file__).resolve().parents[1] / "public" / "icons"
DESTINATION.mkdir(parents=True, exist_ok=True)
BACKGROUND = "#e9ddff"
PRIMARY = "#65558f"


def icon(size, maskable=False):
    scale = 4
    canvas = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    edge = size * scale
    draw.rounded_rectangle((0, 0, edge, edge), radius=0 if maskable else edge * 0.28, fill=BACKGROUND)
    factor = edge / 64
    # Keep the complete mark within the maskable icon's central safe circle.
    shrink = 0.82 if maskable else 0.94

    def point(x, y):
        return ((32 + (x - 32) * shrink) * factor, (32 + (y - 32) * shrink) * factor)

    for x, y, radius in [(18, 35.5, 10.5), (32, 26, 15), (46, 37, 9)]:
        draw.ellipse((*point(x - radius, y - radius), *point(x + radius, y + radius)), fill=PRIMARY)
    draw.rectangle((*point(18, 28), *point(46, 46)), fill=PRIMARY)
    draw.polygon([point(x, y) for x, y in [(24, 35), (39, 29), (34, 43), (30, 38), (26, 40), (27, 33)]], fill=BACKGROUND)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


for filename, size, maskable in [
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("icon-maskable-512.png", 512, True),
    ("apple-touch-icon.png", 180, True),
]:
    icon(size, maskable).save(DESTINATION / filename, optimize=True)
    print(filename)
