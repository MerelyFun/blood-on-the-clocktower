"""Rebuild phone-sized WebP artwork from preserved sources. Requires Pillow.

Run: python scripts/optimize-art.py
Originals are outside public/ so the website only ships the mobile versions.
"""
from pathlib import Path
from io import BytesIO
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source/mobile-originals'
OUTPUT = ROOT / 'public/art'
LIMITS = {'roles': 192, 'status': 72, 'teams': 96, 'scripts': 128,
          'factions': 96, 'brand': 256, 'cards': 256, 'community': 360,
          'decoration': 384, 'backgrounds': 768, 'table': 768}

sources = {}
for path in sorted(SOURCE.rglob('*')):
    if path.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg'):
        relative = path.relative_to(SOURCE).with_suffix('.webp')
        if relative not in sources or path.suffix.lower() == '.png':
            sources[relative] = path
for name in ('avatar-frame', 'player-avatar', 'round-avatar'):
    sources[Path('table') / f'{name}.webp'] = ROOT / 'assets/source/mobile-portraits' / f'{name}.png'

report = []
for relative, source in sorted(sources.items()):
    target = OUTPUT / relative
    before = target.stat().st_size if target.exists() else 0
    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original).convert('RGBA')
        limit = LIMITS.get(relative.parts[0], 192)
        if relative.stem in ('avatar-frame', 'player-avatar', 'round-avatar', 'death-slash'):
            limit = 192
        if relative.stem == 'parchment-texture':
            limit = 256
        im.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        # Preserve transparency; opaque artwork does not need an alpha channel.
        if im.getextrema()[3] == (255, 255):
            im = im.convert('RGB')
        payload = BytesIO()
        im.save(payload, format='WEBP', quality=55 if limit >= 360 else 65, method=6)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload.getvalue())
        report.append({'path': str(relative).replace('\\', '/'), 'width': im.width,
                       'height': im.height, 'beforeBytes': before, 'bytes': target.stat().st_size})

(ROOT / 'assets/mobile-art-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'images': len(report), 'beforeWebpBytes': sum(x['beforeBytes'] for x in report),
                  'afterWebpBytes': sum(x['bytes'] for x in report)}, ensure_ascii=False))
