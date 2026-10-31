"""Extract aligned counter occlusion layers from the approved expanded room pixels."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / 'public/sprites/sushi/tiers'
# Full-canvas masks retain exact pixel alignment. No illustration is regenerated.
COUNTERS = {
    2: [(430, 414), (519, 374), (968, 600), (1056, 574), (1124, 610),
        (1124, 634), (1094, 647), (1094, 727), (962, 796), (440, 534)],
    3: [(520, 411), (604, 373), (1137, 637), (1221, 548), (1315, 591),
        (1315, 620), (1292, 631), (1292, 685), (1065, 802), (523, 539)],
}

if __name__ == '__main__':
    for tier, points in COUNTERS.items():
        source = Image.open(ROOT / f'tier-{tier}-expanded.png').convert('RGBA')
        assert source.size == (1536, 1024)
        mask = Image.new('L', source.size)
        ImageDraw.Draw(mask).polygon(points, fill=255)
        foreground = Image.new('RGBA', source.size)
        foreground.paste(source, (0, 0), mask)
        destination = ROOT / f'tier-{tier}-expanded-front.png'
        foreground.save(destination, optimize=True)
        print(destination.name)
