"""Download every resolved BDRC image and lay it out the way it will sit in S3.

Reads the CSV from resolve_sources.py, downloads each source key from
image-processing.bdrc.io with the AWS CLI, converts TIFF crops to JPEG with
macOS `sips` (browsers can't show TIFF), and writes the result to
<out>/<Batch_ID>/<name>, which mirrors the S3 prefix the tasks will point at.

The file name is BDRC's own, so an a/b half keeps its suffix; only TIFFs change
extension (to .jpg). Re-running skips files that are already there.
Writes <out>/manifest.csv mapping each title-list row (and half) to its file.
"""
import argparse
import csv
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

ap = argparse.ArgumentParser()
ap.add_argument("--sources", required=True)
ap.add_argument("--download-dir", required=True, help="raw BDRC files, kept apart from scripts")
ap.add_argument("--out", required=True)
ap.add_argument("--workers", type=int, default=16)
args = ap.parse_args()

BUCKET = "image-processing.bdrc.io"
CONVERT = {".tif", ".tiff"}

rows = [r for r in csv.DictReader(open(args.sources, encoding="utf-8")) if r["source_key"]]
# A timed-out download can leave a truncated file, so a raw file only counts
# as downloaded when it matches the size BDRC lists.
expected_size = {r["source_key"]: int(r["size"]) for r in rows}


def target_name(row):
    # Keep BDRC's file name exactly; only a converted TIFF changes extension.
    name = row["source_key"].rsplit("/", 1)[-1]
    stem, ext = os.path.splitext(name)
    return stem + ".jpg" if ext.lower() in CONVERT else name


for r in rows:
    r["file"] = f'{r["Batch_ID"]}/{target_name(r)}'

# Two different sources must never land on the same file.
owner = {}
for r in rows:
    prev = owner.setdefault(r["file"], r["source_key"])
    if prev != r["source_key"]:
        raise SystemExit(f'name clash: {r["file"]} <- {prev} and {r["source_key"]}')


def fetch(item):
    file, key = item
    dest = os.path.join(args.out, file)
    raw = os.path.join(args.download_dir, key)
    raw_ok = os.path.exists(raw) and os.path.getsize(raw) == expected_size[key]
    if raw_ok and os.path.exists(dest) and os.path.getsize(dest) > 0:
        return file, "cached"
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not raw_ok:
        p = subprocess.run(["aws", "s3api", "get-object", "--bucket", BUCKET, "--key", key, raw + ".part"],
                           capture_output=True, text=True)
        if p.returncode or os.path.getsize(raw + ".part") != expected_size[key]:
            return file, "download failed: " + (p.stderr.strip()[-200:] or "size mismatch")
        os.replace(raw + ".part", raw)
    if os.path.splitext(key)[1].lower() in CONVERT:
        tmp = dest + ".part.jpg"
        p = subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "90", raw, "--out", tmp],
                           capture_output=True, text=True)
        if p.returncode or not os.path.exists(tmp):
            return file, "convert failed: " + (p.stderr or p.stdout).strip()[-200:]
        os.replace(tmp, dest)
    else:
        with open(raw, "rb") as src, open(dest + ".part", "wb") as dst:
            dst.write(src.read())
        os.replace(dest + ".part", dest)
    return file, "ok"


with ThreadPoolExecutor(args.workers) as ex:
    results = dict(ex.map(fetch, owner.items()))

failed = {f: s for f, s in results.items() if s not in ("ok", "cached")}
with open(os.path.join(args.out, "manifest.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["row", "Batch_ID", "image_name", "half", "file", "source_key", "result"])
    w.writeheader()
    for r in rows:
        w.writerow({k: r[k] for k in ("row", "Batch_ID", "image_name", "half", "file", "source_key")}
                   | {"result": results[r["file"]]})

print(f"files: {len(owner)}  ok/cached: {len(owner) - len(failed)}  failed: {len(failed)}")
for f, s in sorted(failed.items()):
    print("FAILED", f, s)
