# Data Imports

## SAMPLE-mca-cet-2025.json

**This is fictional test data, not real official CAP cutoff data.**
5 made-up colleges, 1 branch each (MCA), across all 4 CAP rounds and
5 categories (OPEN/OBC/SC/TFWS/EWS), with cutoffs that gently relax
round-to-round the way real CAP cutoffs typically do. It exists purely
so the full pipeline (import → prediction → result page → college
details → PDF) can be tested end-to-end before real DTE Maharashtra
data is available.

Run it with:
```bash
npm run import:cutoffs data/imports/SAMPLE-mca-cet-2025.json
```

**What this import does and doesn't create:** the import engine only
knows what's in the cutoff JSON — college code, name, branch, category,
round, cutoff rank/percentile. It creates minimal college/branch
records from that. It does **not** set city, address, NAAC grade, fees,
or placement data, since none of that exists in the cutoff file at all.
That data is a separate concern, entered via the Admin Panel (Phase 9)
or a future dedicated import. After running this sample import, expect:
predictions and results to work fully (chance bands, preference order),
but the College Details page's info/fees/placement cards will be mostly
empty until that data is added separately.

## Real data format

The import engine expects a JSON array of row objects. Each row needs
these fields (key names are flexible — `"College Code"`, `"college_code"`,
and `"CollegeCode"` are all treated the same; see
`src/services/import/importValidators.js` for the full alias list):

| Field | Required | Notes |
|---|---|---|
| Year | Yes | e.g. `2025` |
| Round | Yes | Accepts `CAP1`, `"CAP Round I"`, `"Round 1"`, `1`, etc. — normalized to `CAP1`-`CAP4` |
| College Code | Yes | Official DTE institute code |
| College Name | Yes | |
| Branch Code | Yes | |
| Branch | Yes | |
| Status | No | Free text, stored as-is |
| Section | No | Free text, stored as-is |
| Stage | No | Free text, stored as-is |
| Category | Yes | Must match a category **code** already in the `categories` table (OPEN, OBC, SC, ST, VJ, NT1-3, SBC, EWS, TFWS, PWD, DEFENCE, MI, ORPHAN) |
| Cutoff Rank | One of Rank/Percentile required | |
| Percentile | One of Rank/Percentile required | 0–100 |

Re-running an import with the same or corrected data is always safe —
colleges, branches, and cutoff rows are all upserted, never duplicated.
Bad rows are skipped individually with a clear reason printed to the
console; they never block the good rows in the same file.

If your real official data uses a round format or category code not
covered here, extend `ROUND_ALIASES` in
`src/services/import/importValidators.js`, or add the missing category
via a new row in `database/seeds/002_categories.sql`.
