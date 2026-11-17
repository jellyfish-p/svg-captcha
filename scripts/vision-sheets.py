"""Make neutral, labelled contact sheets for a visual-only evaluation.

Pillow is evaluation tooling only; the Node package does not use it.
Images are enlarged exactly 2x with nearest-neighbor interpolation, equally
for both conditions. No solution or group information is read or displayed.
"""

import json
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont


def main():
    directory = Path(sys.argv[1]).resolve()
    rows = json.loads((directory / "images.json").read_text(encoding="utf-8"))
    font = ImageFont.load_default()
    for font_name in ("DejaVuSans.ttf", "arial.ttf", "LiberationSans-Regular.ttf"):
        try:
            font = ImageFont.truetype(font_name, 22)
            break
        except OSError:
            pass
    sizes = []
    for row in rows:
        with Image.open(directory / (row["id"] + ".png")) as im:
            sizes.append(im.size)
    image_width = max(width for width, _ in sizes) * 2
    image_height = max(height for _, height in sizes) * 2
    cell_width, cell_height = image_width + 30, image_height + 44
    for start in range(0, len(rows), 8):
        page_rows = (min(8, len(rows) - start) + 1) // 2
        sheet = Image.new("RGB", (cell_width * 2, cell_height * page_rows), "#eeeeee")
        draw = ImageDraw.Draw(sheet)
        for index, row in enumerate(rows[start:start + 8]):
            left, top = (index % 2) * cell_width, (index // 2) * cell_height
            label = row["id"] + (" (%d chars)" % row["length"] if "length" in row else "")
            draw.text((left + 15, top + 8), label, fill="#111111", font=font)
            image = Image.open(directory / (row["id"] + ".png")).convert("RGBA")
            canvas = Image.new("RGBA", image.size, "white")
            canvas.alpha_composite(image)
            enlarged = canvas.convert("RGB").resize((image.width * 2, image.height * 2), Image.Resampling.NEAREST)
            sheet.paste(enlarged, (left + 15 + (image_width - enlarged.width) // 2, top + 36))
        target = directory / ("sheet-%02d.png" % (start // 8 + 1))
        sheet.save(target)
        print(target)


if __name__ == "__main__":
    main()
