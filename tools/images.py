#!/usr/bin/env python3
"""Generate sized image derivatives for the site.

Run:  python3 tools/images.py
CI:   python3 tools/images.py --check

For every source image under PAGES/ and MEDIA/ this writes two JPEG
derivatives next to it:

    thumbs/<stem>.jpg     long edge 1400, used by the gallery
    thumbs/sm/<stem>.jpg  long edge 560,  used by cards, avatars, marks

Photographic PNG sources are re-encoded as JPEG, because a photo kept as
PNG is several times larger for the same pixels. Aspect ratio is never
changed, so nothing is cropped. Output is deterministic, so CI can fail
when the committed derivatives are stale.

SVG and animated GIF sources are left alone.
"""

import argparse
import os
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ROOTS = ["PAGES", "MEDIA"]
SKIP_DIRS = {"thumbs"}
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
SKIP_EXTS = {".gif", ".svg"}

MAX_FULL = 1400
MAX_SMALL = 560
QUALITY = 82


def sources():
    for top in ROOTS:
        base = ROOT / top
        if not base.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for name in sorted(filenames):
                ext = Path(name).suffix.lower()
                if ext in EXTS or ext in SKIP_EXTS:
                    yield Path(dirpath) / name


def to_rgb(image: Image.Image) -> Image.Image:
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        bg = Image.new("RGB", image.size, (255, 255, 255))
        bg.paste(image, mask=image.split()[-1])
        return bg
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def fit(image: Image.Image, limit: int) -> Image.Image:
    if max(image.size) <= limit:
        return image
    return ImageOps.contain(image, (limit, limit), method=Image.LANCZOS)


def encode_jpeg(image: Image.Image) -> bytes:
    buf = __import__("io").BytesIO()
    to_rgb(image).save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return buf.getvalue()


def process(path: Path, write: bool):
    """Returns (targets_written, original_bytes, derivative_bytes)."""
    if path.suffix.lower() in SKIP_EXTS:
        return [], 0, 0

    try:
        with Image.open(path) as im:
            im.load()
            original = im.size
            stem = path.stem
            plan = [
                (path.parent / "thumbs" / f"{stem}.jpg", MAX_FULL),
                (path.parent / "thumbs" / "sm" / f"{stem}.jpg", MAX_SMALL),
            ]
            written = []
            total = 0
            for target, limit in plan:
                payload = encode_jpeg(fit(im, limit))
                total += len(payload)
                if target.exists() and target.read_bytes() == payload:
                    continue
                if write:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(payload)
                written.append(target)
            if not written:
                return [], len(encode_jpeg(fit(im, MAX_FULL))), 0
            del original
            return written, 0, total
    except Exception as exc:
        raise SystemExit(f"error: cannot process {path.relative_to(ROOT)}: {exc}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    count = 0
    for path in sources():
        written, _, _ = process(path, write=not args.check)
        for target in written:
            count += 1
            size = target.stat().st_size if target.exists() else 0
            verb = "stale" if args.check else "wrote"
            print(f"{verb} {target.relative_to(ROOT)} ({size // 1024} KB)")

    if not count:
        print("derivatives are current")
        return 0
    if args.check:
        print("error: derivatives are stale, run python3 tools/images.py", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
