"""Convert bundled sprites to exact lossless WebP; --check verifies pixel hashes.

Requires Pillow with WebP support. Story filenames remain stable; only physical
asset paths in the bundle change. Original images remain recoverable in Git.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = [ROOT / 'assets' / 'images' / name for name in ('kei', 'fubuki', 'hoshino', 'hina', 'mari')]
MANIFEST = ROOT / 'scripts' / 'fixtures' / 'sprite-webp.json'


def pixels(data):
    with Image.open(io.BytesIO(data)) as image:
        rgba = image.convert('RGBA')
        return rgba.size, rgba.tobytes()


def verify(entries):
    for entry in entries:
        path = ROOT / entry['file']
        data = path.read_bytes()
        assert data[:4] == b'RIFF' and data[8:12] == b'WEBP', path
        assert b'VP8L' in data[:32], f'Not lossless WebP: {path}'
        size, raw = pixels(data)
        assert list(size) == entry['size'], path
        assert hashlib.sha256(raw).hexdigest() == entry['rgbaSha256'], path
        assert len(data) == entry['bytes'], path
        assert len(data) < entry['originalBytes'], path
    before = sum(entry['originalBytes'] for entry in entries)
    after = sum(entry['bytes'] for entry in entries)
    print(f'{len(entries)} sprites: {before:,} -> {after:,} bytes; saved {before - after:,} ({(1 - after / before) * 100:.1f}%)')
    print('PASS exact RGBA pixel hashes (including transparent RGB), dimensions, alpha and lossless encoding')


def convert():
    sources = sorted(path for folder in FOLDERS for path in folder.iterdir() if path.suffix.lower() in ('.png', '.jpg'))
    if not sources:
        verify(json.loads(MANIFEST.read_text(encoding='utf-8')))
        return
    entries, converted = [], []
    for source in sources:
        # All mutations target individual files inside the named sprite folders.
        assert source.resolve().parent in [folder.resolve() for folder in FOLDERS], source
        target = source.with_suffix('.webp')
        assert not target.exists(), f'Refusing to overwrite {target}'
        original = source.read_bytes()
        with Image.open(io.BytesIO(original)) as image:
            assert image.format == 'PNG', f'Expected a lossless source: {source}'
            output = io.BytesIO()
            image.save(output, format='WEBP', lossless=True, exact=True, method=6)
        encoded = output.getvalue()
        size, raw = pixels(original)
        assert (size, raw) == pixels(encoded), f'Pixel mismatch: {source}'
        assert len(encoded) < len(original), f'No size saving: {source}'
        entries.append({'file': target.relative_to(ROOT).as_posix(), 'original': source.relative_to(ROOT).as_posix(),
                        'originalBytes': len(original), 'bytes': len(encoded), 'size': list(size),
                        'rgbaSha256': hashlib.sha256(raw).hexdigest()})
        converted.append((source, target, encoded))
    # Finish validation of every image before replacing any source or reference.
    for source, target, encoded in converted:
        target.write_bytes(encoded)
    for filename in ('constants/eventAssets.ts', 'constants/characters.ts'):
        path = ROOT / filename
        text = path.read_text(encoding='utf-8')
        for entry in entries:
            text = text.replace('../' + entry['original'], '../' + entry['file'])
        path.write_text(text, encoding='utf-8', newline='\n')
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    verify(entries)
    for source, target, encoded in converted:
        assert source.resolve().parent in [folder.resolve() for folder in FOLDERS], source
        source.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        verify(json.loads(MANIFEST.read_text(encoding='utf-8')))
    else:
        convert()
