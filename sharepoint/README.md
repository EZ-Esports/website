# Sharepoint data pipeline (bronze → silver → gold)

Normalizes the EZ Esports historical spreadsheets into load-ready CSVs for the
website database. Driven by the master ledger spreadsheet
(`1qEzCT6bvpGEm2bjf0TR0WK-iJ2yMyiE_Ol7BuLID1Gs`, `MAIN` tab), which lists one
row per (season, game, division, data_type) with a link to the source sheet.

## Run

```bash
cd sharepoint
python3 main.py               # bronze: download every ledger sheet -> bronze_data/
python3 normalize_silver.py   # silver: flat matches/rosters/standings CSVs
python3 normalize_gold.py     # gold:   DB-shaped CSVs for db/seed-gold.ts
cd .. && npm run db:seed:gold # load into the database (wipes + reloads)
```

`main.py` and `normalize_silver.py` need the venv (`uv sync`; pandas,
openpyxl, requests). `normalize_gold.py` is stdlib-only.

## Tiers

- **bronze_data/** — raw sheet dumps, one dir per spreadsheet (named by its
  live title; when two spreadsheets share a title, every member of the group
  gets a short spreadsheet-id suffix — e.g. `TFT Scoreboard_1-YH2U` and
  `TFT Scoreboard_1ha50m` — so the mapping is stable regardless of ledger
  row order). Every tab is dumped as `<tab>.csv` plus a `<tab>__bold.csv`
  mask — some schedules (2025-26 Valorant) mark the match winner only via
  bold formatting, which a plain CSV dump loses.
  Wiped and regenerated on every run of `main.py`.
- **silver_data/** — `silver_matches.csv`, `silver_rosters.csv`,
  `silver_standings.csv`. One hand-written processor per source sheet in
  `normalize_silver.py`; new data means writing a new `process_*` function
  and registering it in `main()`. Matches carry per-side divisions
  (`home_division`/`away_division`) because cross-division matches exist
  (2023-24 LoL ran Midwood A vs Midwood B), plus `mvp`. Standings carry
  `points` for point-based competitions (TFT, regular-season points).
- **gold_data/** — 8 CSVs shaped for `db/seed-gold.ts` (games, schools,
  seasons, rosters, members, players, matches, standings). All judgment
  lives in `normalize_gold.py`: school canonicalization (hard-fails on
  unmapped ids), division labels (A/B/all → Varsity/JV/All), member dedup,
  captain recovery, match status inference (unscored matches dated today or
  later are `scheduled`, past ones are historical `completed`), roster
  shells for seasons with matches but no roster sheet, and standings derived
  from match results for seasons without a standings sheet (2023-24 LoL) —
  skipped while a season still has scheduled or unrecorded matches, so
  partial data never publishes a wrong champion.

## Coverage (2026-07)

| Season | Valorant | LoL | TFT |
|---|---|---|---|
| 2021-22 | matches A/B, rosters, standings | matches, rosters, standings | rosters, standings |
| 2022-23 | matches, rosters, standings | matches, rosters, standings | rosters, standings |
| 2023-24 | matches, rosters, standings | matches (winner+MVP), rosters, derived standings | rosters, points standings |
| 2024-25 | matches A/B (winner+MVP), standings+points — **no rosters** | — | — (see open items) |
| 2025-26 | matches A/B (scores via bold-winner), rosters — ongoing | — | — |

Tetris and Minecraft are **deferred**: their results live on Challonge
brackets (2022-23 pages on the old site; challonge.com/ezesportstetrio for
2023-24) which block scraping. Only a 2023-24 Tetris lineup sheet exists.

## Open items (data chasing)

- Confirm which season the `TFT Scoreboard` sheet `1ha50…` covers — the
  ledger lists it under BOTH 2023-24 results and 2024-25 schedule/results;
  the pipeline assumes **2023-24**, leaving 2024-25 TFT with no data.
- 2022-23 TFT schedule sheet (`1LFjqHEbs…`) returns HTTP 401 — sharing must
  be fixed before it can be pulled.
- 2024-25 Valorant rosters and 2024-25 TFT: ledger says "Edison needs to
  data chase".
- 2021-22 Valorant B results: documented on Discord, manual scraping needed.
- One 2025-26 match (Bayside vs Wagner, B division, 2-1) has no bolded
  winner in the source sheet — stored unscored with a note.
- The 2023-24 LoL schedule had two same-date rows with swapped Result/MVP
  cells (a source data-entry error); the silver processor detects and swaps
  cross-matched results automatically.
