#!/usr/bin/env python3
"""Build the batch-1 Task rows from Rachael's title list and the fetched images.

One task per title-list row whose image was found in BDRC. A row whose photo
BDRC split into two halves becomes two tasks (A and B) with the same title, so
the monks answer YES on the half that holds it and NO on the other.

Reuses verify/insert from ../prepare_tasks.py. Run fetch_images.py and upload
its output to S3 first, so --verify can check every URL.
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from prepare_tasks import Task, insert_tasks, read_database_url, verify_urls, write_csv  # noqa: E402

URL_PREFIX = "https://s3.us-east-1.amazonaws.com/monlam.ai.ocr/Marieke/title-checking/batch-1/"

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("--title-list", type=Path, required=True)
ap.add_argument("--manifest", type=Path, required=True, help="manifest.csv from fetch_images.py")
ap.add_argument("--output", type=Path, default=HERE / "batch-1_tasks.csv")
ap.add_argument("--batch-id", default="batch-1")
ap.add_argument("--group-id", type=int, default=1)
ap.add_argument("--verify", action="store_true")
ap.add_argument("--insert", action="store_true")
ap.add_argument("--database-url")
args = ap.parse_args()

with args.title_list.open(newline="", encoding="utf-8-sig") as f:
    # Row numbers match the spreadsheet (header is row 1), as in the mapping CSVs.
    titles = {str(i): r for i, r in enumerate(csv.DictReader(f), start=2)}

tasks, skipped = [], Counter()
with args.manifest.open(newline="", encoding="utf-8") as f:
    for m in csv.DictReader(f):
        if m["result"] not in ("ok", "cached"):
            skipped["image not fetched"] += 1
            continue
        t = titles[m["row"]]
        if (t["Batch_ID"], t["image_name"]) != (m["Batch_ID"], m["image_name"]):
            raise SystemExit(f'row {m["row"]} does not match the title list')
        batch_folder, file_name = m["file"].split("/", 1)
        tasks.append(Task(
            # The list has a few images twice with different titles, so the row
            # number keeps ids unique.
            id=f'{args.batch_id}_{m["row"]}_{file_name}',
            group_id=args.group_id,
            batch_id=args.batch_id,
            state="transcribing",
            image_name=file_name,
            url=URL_PREFIX + quote(batch_folder, safe="") + "/" + quote(file_name, safe=""),
            diplomatic_context=t["title_diplomatic"].strip(),
            normalised_context=t["title_normalised"].strip(),
        ))

if len({t.id for t in tasks}) != len(tasks):
    raise SystemExit("duplicate task ids")

if args.verify:
    reachable = verify_urls(tasks)
    skipped["url not reachable"] += len(tasks) - len(reachable)
    tasks = reachable

write_csv(tasks, args.output)
print(f"{len(tasks)} tasks from {len({t.id.split('_')[1] for t in tasks})} title-list rows -> {args.output}")
for reason, n in skipped.items():
    print(f"skipped {n}: {reason}")
print("sample:", tasks[0].url)

if args.insert:
    inserted = insert_tasks(tasks, read_database_url(args.database_url))
    print(f"Inserted {inserted} rows (existing ids left untouched).")
