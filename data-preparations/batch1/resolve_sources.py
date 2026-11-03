"""Resolve every BDRC-found title-list image to a key we can read in
image-processing.bdrc.io.

Elie's database points many crops at filemage-i-current.bdrc.io and
pt-copy.bdrc.io, which our AWS user can't read. The same crops live in
image-processing.bdrc.io (scam_cropped/PT/<batch>/ as TIFF, or
PT/Corr{2,3}_cropped/ with a NNNN_ prefix), so we match them there by batch and
file stem.

Inputs (from ~/Desktop/work): title-list-image-mapping.csv,
title-list-two-halves-565.csv, crops-not-uploaded.csv, plus two key listings of
image-processing.bdrc.io (PT/ and scam_cropped/PT/) as `Key<TAB>Size` TSVs.
Output: one row per file to fetch.
"""
import argparse
import collections
import csv
import os
import re

ap = argparse.ArgumentParser()
ap.add_argument("--work", default=os.path.expanduser("~/Desktop/work"))
ap.add_argument("--listing", nargs="+", required=True)
ap.add_argument("--output", required=True)
args = ap.parse_args()

BUCKET = "image-processing.bdrc.io"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
sizes = {}
for path in args.listing:
    for line in open(path, encoding="utf-8"):
        key, _, size = line.rstrip("\n").rpartition("\t")
        if key and os.path.splitext(key)[1].lower() in IMAGE_EXTS:
            sizes[key] = int(size)


def batch_token(text):
    """'Corr10_20240702_jpg' -> 'Corr10', 'Manual2-20240411' -> 'Manual2'."""
    m = re.search(r"(Corr\d+b?|Manual\d+|W2PD\d+)(?![0-9])", text)
    return m.group(1) if m else None


def stem(name):
    return os.path.splitext(name)[0].lower()


# (batch token, stem) -> keys; stems also indexed without a leading NNNN_ prefix.
index = collections.defaultdict(list)
for key in sizes:
    parts = key.split("/")
    tok = next((batch_token(p) for p in parts[:-1] if batch_token(p)), None)
    if not tok:
        continue
    s = stem(parts[-1])
    index[(tok, s)].append(key)
    unprefixed = re.sub(r"^\d{4}_", "", s)
    if unprefixed != s:
        index[(tok, unprefixed)].append(key)


def rank(key):
    # BDRC's JPEG crops (the same files filemage serves) first, then the TIFF
    # crops, then the batch's own original folder.
    if key.startswith("PT/cropped/"):
        return 0
    if key.startswith("scam_cropped/"):
        return 1
    if "_cropped/" in key:
        return 2
    return 3


def resolve(uri):
    bucket, _, key = uri[len("s3://"):].partition("/")
    if bucket == BUCKET and key in sizes:
        return key, "exact"
    mirrored = re.sub(r"^PaganTibet/", "PT/", key) if bucket == "filemage-i-current.bdrc.io" else None
    if mirrored in sizes:
        return mirrored, "mirror"
    tok = batch_token(key)
    name = key.rsplit("/", 1)[-1]
    cands = index.get((tok, stem(name)), [])
    if bucket == BUCKET:
        # Same bucket, different folder spelling: prefer the same top folder.
        same = [c for c in cands if c.split("/")[0] == key.split("/")[0]]
        cands = same or cands
    if not cands:
        return None, "unresolved"
    cands = sorted(set(cands), key=lambda c: (rank(c), c))
    return cands[0], "matched" if len(cands) == 1 else f"matched ({len(cands)} candidates)"


w = args.work
mapping = list(csv.DictReader(open(f"{w}/title-list-image-mapping.csv", encoding="utf-8")))
halves = {r["title_list_row"]: r for r in csv.DictReader(open(f"{w}/title-list-two-halves-565.csv", encoding="utf-8"))}
no_file = {r["title_list_row"]: r for r in csv.DictReader(open(f"{w}/crops-not-uploaded.csv", encoding="utf-8"))}

rows = []
for r in mapping:
    status = r["status"].split(":")[0]
    if status == "OK":
        wanted = [("", r["source_s3_uri"])]
    elif status == "CHOOSE":
        h = halves[r["row"]]
        wanted = [("A", h["half_1_s3_path"]), ("B", h["half_2_s3_path"])]
    elif status == "NO FILE" and no_file.get(r["row"], {}).get("bdrc_check", "").startswith("FOUND same batch"):
        wanted = [("", no_file[r["row"]]["bdrc_paths"])]
    else:
        continue
    for half, uri in wanted:
        key, how = resolve(uri)
        rows.append({
            "row": r["row"], "Batch_ID": r["Batch_ID"], "image_name": r["image_name"],
            "half": half, "listed_uri": uri, "source_key": key or "",
            "size": sizes.get(key, ""), "resolution": how,
        })

with open(args.output, "w", newline="", encoding="utf-8") as f:
    wr = csv.DictWriter(f, fieldnames=list(rows[0]))
    wr.writeheader()
    wr.writerows(rows)

print("files:", len(rows), "rows:", len({r["row"] for r in rows}))
print(collections.Counter(r["resolution"].split(" ")[0] for r in rows))
print("formats:", collections.Counter(os.path.splitext(r["source_key"])[1].lower() for r in rows if r["source_key"]))
print("GB:", round(sum(r["size"] or 0 for r in rows) / 1e9, 2))
for r in rows:
    if r["resolution"] == "unresolved":
        print("UNRESOLVED", r["row"], r["Batch_ID"], r["listed_uri"])
