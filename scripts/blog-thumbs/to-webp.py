"""Convert rendered thumbnails to website/assets/blog/<id>.webp (+ og/<id>.jpg)."""
import os, sys
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
src = Path(os.environ.get("THUMBS_PNG_DIR", here / ".png"))
dst = here.parent.parent / "website" / "assets" / "blog"
dst.mkdir(parents=True, exist_ok=True)
for png in sorted(src.glob("*.png")):
    out = dst / (png.stem + ".webp")
    img = Image.open(png).convert("RGB")
    img.save(out, "WEBP", quality=84, method=6)
    # JPEG copy for og:image / twitter:image (not every network reads WebP)
    og = dst / "og" / (png.stem + ".jpg")
    og.parent.mkdir(exist_ok=True)
    img.save(og, "JPEG", quality=86, optimize=True, progressive=True)
    print(f"{out.name}  {out.stat().st_size // 1024} KB  + og {og.stat().st_size // 1024} KB")
