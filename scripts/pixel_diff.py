"""Diff two screenshots: python3 scripts/pixel_diff.py real.png local.png diff.png"""
import sys
from PIL import Image, ImageChops
import numpy as np

real_path, local_path, out_path = sys.argv[1:4]
a = Image.open(real_path).convert("RGB")
b = Image.open(local_path).convert("RGB")
if a.size != b.size:
    print(f"size mismatch real={a.size} local={b.size}")
    w = min(a.size[0], b.size[0])
    h = min(a.size[1], b.size[1])
    a = a.crop((0, 0, w, h))
    b = b.crop((0, 0, w, h))

na = np.asarray(a, dtype=np.int16)
nb = np.asarray(b, dtype=np.int16)
delta = np.abs(na - nb).max(axis=2)
diff = (delta > 12).astype(np.uint8)
ratio = float(diff.mean())
gray = (na.mean(axis=2) * 0.35 + 165).astype(np.uint8)
heat = np.stack([gray, gray, gray], axis=2).astype(np.uint8)
heat[diff > 0] = [255, 0, 80]
Image.fromarray(heat).save(out_path)
ImageChops.difference(a, b).save(out_path.replace(".png", "-raw.png"))
print(f"diff {ratio * 100:.3f}% of pixels · score {100 - ratio * 100:.1f}")

# Where the difference lives: 32px cells ranked by diff count, reported in CSS pixels (2x DPR).
cell = 64
h, w = diff.shape
rows, cols = h // cell, w // cell
if rows and cols:
    grid = diff[: rows * cell, : cols * cell].reshape(rows, cell, cols, cell).sum(axis=(1, 3))
    hottest = np.dstack(np.unravel_index(np.argsort(grid.ravel())[::-1][:5], grid.shape))[0]
    spots = []
    for r, c in hottest:
        if grid[r, c] == 0:
            break
        spots.append(f"({c * cell // 2},{r * cell // 2}) {int(grid[r, c])}px")
    if spots:
        print("hottest 32px cells (css x,y): " + " · ".join(spots))
