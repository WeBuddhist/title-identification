#!/usr/bin/env python3
"""Turn the raw title identification spreadsheets into rows for the Task table.

The source CSVs carry the batch the images were scanned under (e.g.
"Correction-2"), which is what the S3 key is built from. The batch we load into
the database is a separate, deliberately chosen label so the data can be grouped
per import run rather than per scanning batch.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, fields
from pathlib import Path
from urllib.parse import quote

DEFAULT_URL_TEMPLATE = (
    "https://s3.us-east-1.amazonaws.com/monlam.ai.ocr/Marieke/"
    "Correction-source/{batch_id}/{image_id}"
)
DEFAULT_BATCH_ID = "test-batch"
DEFAULT_GROUP_ID = 1
DEFAULT_STATE = "transcribing"

HERE = Path(__file__).resolve().parent
DEFAULT_INPUT = HERE / "csv"
DEFAULT_OUTPUT = HERE / "output" / "tasks.csv"
DEFAULT_OVERRIDES = HERE / "overrides.json"

# Header names drift between hand-exported sheets, so each field is looked up
# through a list of accepted spellings.
COLUMN_ALIASES = {
    "source_batch_id": ("batch_id", "batch id", "batchid"),
    "image_name": ("image_name", "image name", "imagename", "image_id"),
    "diplomatic_context": ("title_diplomatic", "diplomatic_context", "diplomatic"),
    "normalised_context": ("title_normalised", "normalised_context", "normalised"),
}


@dataclass
class Task:
    id: str
    group_id: int
    batch_id: str
    state: str
    image_name: str
    url: str
    diplomatic_context: str
    normalised_context: str


COLUMNS = [f.name for f in fields(Task)]


def normalise_headers(row: dict) -> dict:
    """Lower-case and trim keys so alias lookups are case/whitespace tolerant."""
    return {
        (key or "").replace("\ufeff", "").strip().lower(): (value or "").strip()
        for key, value in row.items()
    }


def get_field(row: dict, field: str) -> str:
    for alias in COLUMN_ALIASES[field]:
        value = row.get(alias)
        if value:
            return value
    return ""


def load_overrides(path: Path | None) -> tuple[dict[str, str], dict[str, str]]:
    """Load spreadsheet-to-S3 filename fixes and the list of images to drop."""
    if path is None or not path.exists():
        return {}, {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("rename", {}), data.get("skip", {})


def build_url(template: str, source_batch_id: str, image_name: str) -> str:
    # Image names contain spaces, parentheses and Tibetan characters, so the
    # path segments have to be percent-encoded to survive as a URL.
    return template.format(
        batch_id=quote(source_batch_id, safe=""),
        image_id=quote(image_name, safe=""),
    )


def read_rows(input_path: Path) -> list[tuple[Path, int, dict]]:
    if input_path.is_dir():
        files = sorted(input_path.glob("*.csv"))
    else:
        files = [input_path]
    if not files:
        raise SystemExit(f"No CSV files found in {input_path}")

    rows = []
    for file in files:
        with file.open(newline="", encoding="utf-8-sig") as handle:
            for line_number, row in enumerate(csv.DictReader(handle), start=2):
                rows.append((file, line_number, normalise_headers(row)))
    return rows


def build_tasks(
    rows: list[tuple[Path, int, dict]],
    *,
    batch_id: str,
    group_id: int,
    state: str,
    url_template: str,
    renames: dict[str, str] | None = None,
    skips: dict[str, str] | None = None,
) -> tuple[list[Task], list[str]]:
    renames = renames or {}
    skips = skips or {}
    tasks: list[Task] = []
    problems: list[str] = []
    seen: dict[str, str] = {}

    for file, line_number, row in rows:
        location = f"{file.name}:{line_number}"
        source_batch_id = get_field(row, "source_batch_id")
        image_name = get_field(row, "image_name")
        diplomatic = get_field(row, "diplomatic_context")
        normalised = get_field(row, "normalised_context")

        if image_name in skips:
            problems.append(f"{location}: {image_name} ({skips[image_name]})")
            continue
        image_name = renames.get(image_name, image_name)

        missing = [
            name
            for name, value in (
                ("Batch_ID", source_batch_id),
                ("image_name", image_name),
                ("title_diplomatic", diplomatic),
                ("title_normalised", normalised),
            )
            if not value
        ]
        if missing:
            problems.append(f"{location}: missing {', '.join(missing)}")
            continue

        task_id = f"{batch_id}_{image_name}"
        if task_id in seen:
            problems.append(f"{location}: duplicate id {task_id} (first at {seen[task_id]})")
            continue
        seen[task_id] = location

        tasks.append(
            Task(
                id=task_id,
                group_id=group_id,
                batch_id=batch_id,
                state=state,
                image_name=image_name,
                url=build_url(url_template, source_batch_id, image_name),
                diplomatic_context=diplomatic,
                normalised_context=normalised,
            )
        )

    return tasks, problems


def verify_urls(tasks: list[Task]) -> list[Task]:
    """HEAD every image URL and return the tasks whose image is really there.

    The bucket denies listing, so a missing object comes back as 403 rather than
    404; anything other than 200 is treated as unusable.
    """

    def check(task: Task) -> tuple[Task, str]:
        request = urllib.request.Request(task.url, method="HEAD")
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return task, "ok" if response.status == 200 else str(response.status)
        except urllib.error.HTTPError as error:
            return task, str(error.code)
        except Exception as error:  # network problems shouldn't crash the run
            return task, str(error)

    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(check, tasks))

    reachable = []
    for task, status in results:
        if status == "ok":
            reachable.append(task)
        else:
            print(f"unreachable image ({status}): {task.image_name}", file=sys.stderr)
    return reachable


def write_csv(tasks: list[Task], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        for task in tasks:
            writer.writerow(asdict(task))


def insert_tasks(tasks: list[Task], database_url: str) -> int:
    try:
        import psycopg
    except ImportError as error:
        raise SystemExit(
            "psycopg is required for --insert. Run: pip install -r requirements.txt"
        ) from error

    # state is a Postgres enum, so the text parameter needs an explicit cast.
    placeholders = ", ".join(
        '%s::"State"' if column == "state" else "%s" for column in COLUMNS
    )
    columns = ", ".join(f'"{column}"' for column in COLUMNS)
    statement = (
        f'INSERT INTO "Task" ({columns}) VALUES ({placeholders}) '
        "ON CONFLICT (id) DO NOTHING"
    )
    values = [tuple(asdict(task)[column] for column in COLUMNS) for task in tasks]

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            group_id = tasks[0].group_id
            cursor.execute('SELECT 1 FROM "Group" WHERE id = %s', (group_id,))
            if cursor.fetchone() is None:
                raise SystemExit(
                    f"Group {group_id} does not exist; create it before inserting tasks."
                )
            cursor.executemany(statement, values)
            inserted = cursor.rowcount
        connection.commit()
    return inserted


def read_database_url(explicit: str | None) -> str:
    if explicit:
        return explicit
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    env_file = HERE.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            if separator and key.strip() == "DATABASE_URL":
                return value.strip().strip('"').strip("'")

    raise SystemExit("No database URL found. Pass --database-url or set DATABASE_URL.")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help="CSV file or directory of CSV files to read (default: %(default)s)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Where to write the prepared CSV (default: %(default)s)",
    )
    parser.add_argument(
        "--batch-id",
        default=DEFAULT_BATCH_ID,
        help="batch_id stored in the database (default: %(default)s)",
    )
    parser.add_argument(
        "--group-id",
        type=int,
        default=DEFAULT_GROUP_ID,
        help="group_id stored in the database (default: %(default)s)",
    )
    parser.add_argument(
        "--state",
        default=DEFAULT_STATE,
        choices=["transcribing", "trashed", "submitted", "accepted", "finalised"],
        help="Initial task state (default: %(default)s)",
    )
    parser.add_argument(
        "--url-template",
        default=DEFAULT_URL_TEMPLATE,
        help="S3 URL template using {batch_id} and {image_id}",
    )
    parser.add_argument(
        "--overrides",
        type=Path,
        default=DEFAULT_OVERRIDES,
        help="JSON file of image renames and images to skip (default: %(default)s)",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="HEAD each image URL and drop rows whose image is missing from S3",
    )
    parser.add_argument(
        "--insert",
        action="store_true",
        help="Also insert the prepared rows into the database",
    )
    parser.add_argument(
        "--database-url",
        help="Postgres connection string (defaults to DATABASE_URL or ../.env)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with an error if any row was skipped",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    rows = read_rows(args.input)
    renames, skips = load_overrides(args.overrides)
    tasks, problems = build_tasks(
        rows,
        batch_id=args.batch_id,
        group_id=args.group_id,
        state=args.state,
        url_template=args.url_template,
        renames=renames,
        skips=skips,
    )

    for problem in problems:
        print(f"skipped {problem}", file=sys.stderr)
    if problems and args.strict:
        return 1

    if args.verify:
        reachable = verify_urls(tasks)
        if len(reachable) != len(tasks) and args.strict:
            return 1
        tasks = reachable

    if not tasks:
        print("No rows to write.", file=sys.stderr)
        return 1

    write_csv(tasks, args.output)
    print(f"Prepared {len(tasks)} rows from {len(rows)} source rows -> {args.output}")
    print(f"Sample url: {tasks[0].url}")

    if args.insert:
        inserted = insert_tasks(tasks, read_database_url(args.database_url))
        print(f"Inserted {inserted} rows (existing ids left untouched).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
