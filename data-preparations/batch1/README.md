# batch-1

Rachael's title list (`Tibetan_Titles_Batches1to25.xlsx`, 2,128 rows) loaded as
`batch-1`, using the images found in BDRC. Images live in our public bucket at

```
s3://monlam.ai.ocr/Marieke/title-checking/batch-1/<Batch_ID>/<BDRC file name>
```

File names are BDRC's own; TIFF crops are converted to JPEG, so only their
extension changes (`P2100001a.tiff` -> `P2100001a.jpg`).

The 14 images over 18 MP (12 in Correction-4, 2 in Correction-9, all
6000x4000) were shrunk to 4000 px on the long side (`sips -Z 4000`) after the
512 MB Render instance went down while resizing one of them. The app never
sends the browser more than 1920 px, so the monks see no difference. Do the
same for any future batch before uploading.

## What went in

- 2,054 title-list rows, 2,619 tasks, all in group 1 (Group A).
- 565 rows are photos BDRC split into two halves. Each becomes two tasks (`…a`
  and `…b`) with the same title; the monks answer YES on the half with the title
  and NO on the other.
- Left out: the 67 Correction-18/24/25 rows not in BDRC, the 4 Correction-23
  `p001.jpg` rows (they point at a Correction-9 file), and 2 crops listed in
  Elie's database but missing from BDRC (`Baima_manual_text_30_01.jpg`,
  Correction-12; `སྒྲོན་མ་དབུ་ལགས་བཞུགས་སྷོ། (1).jpg`, Correction-2).

## Steps

Inputs from `~/Desktop/work`: `title-list-image-mapping.csv`,
`title-list-two-halves-565.csv`, `crops-not-uploaded.csv` and the title list.

1. List `image-processing.bdrc.io` (the only BDRC bucket our default AWS user
   can read; Elie's filemage/pt-copy paths have copies there):

   ```bash
   aws s3api list-objects-v2 --bucket image-processing.bdrc.io --prefix PT/ --query 'Contents[].[Key,Size]' --output text > ip_PT.tsv
   aws s3api list-objects-v2 --bucket image-processing.bdrc.io --prefix scam_cropped/PT/ --query 'Contents[].[Key,Size]' --output text > ip_scam.tsv
   ```

2. Resolve each image to a readable key -> `batch-1_sources.csv`:

   ```bash
   python3 resolve_sources.py --listing ip_PT.tsv ip_scam.tsv --output batch-1_sources.csv
   ```

3. Download, size-check and convert -> `<out>/<Batch_ID>/<name>` plus
   `manifest.csv` (re-runnable; keep the download dir apart from the scripts):

   ```bash
   python3 fetch_images.py --sources batch-1_sources.csv --download-dir <raw> --out <out>
   ```

4. Upload (needs the `monlam_ai_ocr` profile; the default user can't write):

   ```bash
   aws --profile monlam_ai_ocr s3 sync <out> s3://monlam.ai.ocr/Marieke/title-checking/batch-1/ --exclude manifest.csv
   ```

5. Build, verify and insert the tasks (`ON CONFLICT (id) DO NOTHING`):

   ```bash
   ../.venv/bin/python build_batch1.py --title-list "<title list csv>" --manifest batch-1_manifest.csv --verify --insert
   ```

   `--verify` runs 16 HEAD requests at once and S3 occasionally resets one; a
   dropped URL there is worth re-checking before treating it as missing.
