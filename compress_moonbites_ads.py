import os, glob
from PIL import Image

folder = r"C:\Users\archi\Desktop\CLAUDE\PRIVATE LABEL FINDER\public\moonbites-ads"
files = glob.glob(os.path.join(folder, "*.jpg")) + glob.glob(os.path.join(folder, "*.png"))
print(f"Compressing {len(files)} images...")
total_old = 0
total_new = 0
for f in files:
    try:
        old_size = os.path.getsize(f) / 1024 / 1024
        if old_size < 2:
            print(f"  {os.path.basename(f)}: {old_size:.1f}MB -> skipped (already small)")
            continue
        img = Image.open(f)
        img = img.convert("RGB")
        w, h = img.size
        if w > 2200:
            ratio = 2200 / w
            img = img.resize((2200, int(h * ratio)), Image.LANCZOS)
        out = os.path.splitext(f)[0] + ".jpg"
        img.save(out, "JPEG", quality=92, optimize=True)
        new_size = os.path.getsize(out) / 1024 / 1024
        total_old += old_size
        total_new += new_size
        print(f"  {os.path.basename(out)}: {old_size:.1f}MB -> {new_size:.2f}MB")
    except Exception as e:
        print(f"  ERROR {f}: {e}")
print(f"\nTotal: {total_old:.0f}MB -> {total_new:.0f}MB")
print("Done!")
