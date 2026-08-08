# Data preparation

Converts the raw title identification spreadsheets in `csv/` into rows that match the
`Task` table, and optionally loads them into the deployed Postgres database.

## What the script does

For every row of the source CSV (`Batch_ID`, `image_name`, `title_diplomatic`,
`title_normalised`) it produces one task:

| Column                | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| `id`                  | `test-batch_<image_name>`, e.g. `test-batch_0007_DSCN5220.JPG`       |
| `group_id`            | `1`                                                                  |
| `batch_id`            | `test-batch`                                                         |
| `state`               | `transcribing`                                                       |
| `image_name`          | the source `image_name`                                              |
| `url`                 | built from the S3 template below                                     |
| `diplomatic_context`  | `title_diplomatic`                                                   |
| `normalised_context`  | `title_normalised`                                                   |

The image URL uses the batch from the spreadsheet (the folder the scans actually
live in, e.g. `Correction-2`), not the `test-batch` label written to the database:

```
https://s3.us-east-1.amazonaws.com/monlam.ai.ocr/Marieke/Correction-source/{batch_id}/{image_id}
```

Both path segments are percent-encoded, since filenames contain spaces,
parentheses and Tibetan characters.

Rows missing any of the four source fields are skipped with a warning, as are
duplicate ids.

## Filename overrides

Some spreadsheet filenames don't match the object actually stored in S3, so
`overrides.json` holds the corrections found by probing the bucket:

- `rename` maps a spreadsheet filename to the real S3 filename. Most entries drop
  a trailing `a`/`b` page marker the spreadsheet added (`0011_DSCN5224b.JPG` is
  stored as `0011_DSCN5224.JPG`), and a few add the numeric page prefix the
  spreadsheet omitted (`DSCN5214.JPG` is stored as `0001_DSCN5214.JPG`).
- `skip` lists images that have no object in the bucket at all. Four rows from
  the current sheet fall in here and are left out of the import.

The renamed value is what ends up in `image_name`, `url` and `id`, so the task
always refers to the file that really exists.

## Usage

Write the prepared CSV to `output/tasks.csv`:

```bash
python3 prepare_tasks.py
```

Check every generated URL against S3 before trusting it. The bucket denies
listing, so a missing object answers `403` rather than `404`; anything that isn't
`200` is reported and dropped:

```bash
python3 prepare_tasks.py --verify
```

Insert straight into the database as well:

```bash
pip install -r requirements.txt
python3 prepare_tasks.py --verify --insert
```

The connection string is read from `--database-url`, then `DATABASE_URL`, then
the repo's `.env`. Point it at the Render database's external connection string
to load the deployed instance. Inserts use `ON CONFLICT (id) DO NOTHING`, so
re-running is safe.

Useful overrides:

```bash
python3 prepare_tasks.py \
  --input csv/some-other-export.csv \
  --batch-id batch-1 \
  --group-id 2 \
  --output output/batch-1.csv \
  --strict
```

`--strict` turns skipped rows (and, with `--verify`, unreachable images) into a
failure instead of a warning.

## Loading the CSV without Python's database driver

`output/tasks.csv` has the exact `Task` column names, so it can also be loaded
with psql:

```bash
psql "$DATABASE_URL" -c '\copy "Task"(id, group_id, batch_id, state, image_name, url, diplomatic_context, normalised_context) FROM '"'"'output/tasks.csv'"'"' WITH (FORMAT csv, HEADER true)'
```

Note that `\copy` has no conflict handling, so it fails if any id already exists.
