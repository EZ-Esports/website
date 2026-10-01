"""Tests for TETR.IO silver-tier processors in normalize_silver.py.

Covers:
  - process_rosters_2023_24_tetrio: real bronze file layout (paired-row, positional columns)
  - process_matches_2023_24/2024_25/2025_26_tetrio: no-op when file absent
  - process_standings_2023_24/2024_25/2025_26_tetrio: no-op when file absent
  - placeholder processors: activate when CSV dropped in
  - normalize_gold.py: tetrio in GAME_SLUGS and GAMES
"""
import os
import sys
import csv
import tempfile
import shutil
import pytest

# Make the sharepoint package importable when running pytest from repo root.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import normalize_silver as ns
import normalize_gold as ng


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def write_csv(path, rows, fieldnames=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if fieldnames is None and rows:
        fieldnames = list(rows[0].keys())
    with open(path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def write_raw_csv(path, lines):
    """Write pre-formatted CSV text (including header line) to path."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='') as f:
        f.write(lines)


# ---------------------------------------------------------------------------
# normalize_gold.py: TETR.IO registration
# ---------------------------------------------------------------------------

class TestGoldRegistration:
    def test_tetrio_in_game_slugs(self):
        assert 'tetrio' in ng.GAME_SLUGS
        assert ng.GAME_SLUGS['tetrio'] == 'tetr-io'

    def test_tetrio_in_games_list(self):
        slugs = [g[0] for g in ng.GAMES]
        assert 'tetr-io' in slugs

    def test_tetrio_display_name(self):
        entry = next(g for g in ng.GAMES if g[0] == 'tetr-io')
        assert entry[1] == 'TETR.IO'
        assert entry[2] == 'TETR'


# ---------------------------------------------------------------------------
# process_rosters_2023_24_tetrio
# ---------------------------------------------------------------------------

class TestRosters2023_24Tetrio:
    """Tests run against the real bronze file layout (not a mock of the
    old layout that was never in production)."""

    @pytest.fixture(autouse=True)
    def tmp_dir(self, tmp_path, monkeypatch):
        """Run each test inside a temp dir that mirrors the bronze layout."""
        monkeypatch.chdir(tmp_path)
        return tmp_path

    def _write_real_roster(self, tmp_path):
        """Write a minimal version of the real bronze file."""
        path = tmp_path / 'bronze_data' / 'EzEsports Tetris Division 2023-24 Roster' / 'Sheet1.csv'
        path.parent.mkdir(parents=True, exist_ok=True)
        # Mirrors actual dump: first column unnamed (school/team label),
        # then First Name, Last Name, Grade, In-Game Name.
        path.write_text(
            " ,First Name,Last Name,Grade,In-Game Name\n"
            "Stuyvesant #1,Player,One,Junior,ign_one\n"
            ",Player,Two,Junior,ign_two\n"
            "Brooklyn Tech #1,Player,Three,Sophomore,ign_three\n"
            "John Dewey / Stuyvesant,Player,Four,Junior,ign_four\n"
        )
        return path

    def test_parses_real_layout(self, tmp_path):
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        assert len(records) == 4

    def test_school_label_carried_across_rows(self, tmp_path):
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        stuyvesant_rows = [r for r in records if r['school_id'] == 'stuyvesant']
        # Both Player One AND Player Two belong to Stuyvesant #1
        assert len(stuyvesant_rows) == 2

    def test_hash_suffix_stripped_from_school_label(self, tmp_path):
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        # "Brooklyn Tech #1" → 'brooklyntech'
        bt_rows = [r for r in records if r['school_id'] == 'brooklyntech']
        assert len(bt_rows) == 1

    def test_ign_populated(self, tmp_path):
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        igns = {r['ign'] for r in records}
        assert 'ign_one' in igns
        assert 'ign_two' in igns

    def test_grade_in_notes(self, tmp_path):
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        junior_notes = [r for r in records if r['notes'] == 'Grade: Junior']
        assert len(junior_notes) >= 1

    def test_season_and_game_ids(self, tmp_path):
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        for r in records:
            assert r['season_id'] == '2023-24'
            assert r['game_id'] == 'tetrio'
            assert r['division'] == 'all'

    def test_no_file_is_noop(self, tmp_path):
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        assert records == []

    def test_player_ids_unique(self, tmp_path):
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        ids = [r['player_id'] for r in records]
        assert len(ids) == len(set(ids))

    def test_player_ids_prefixed(self, tmp_path):
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        for r in records:
            assert r['player_id'].startswith('tetrio2324_')

    def test_slash_school_label(self, tmp_path):
        """'John Dewey / Stuyvesant' is an ambiguous label — maps to whatever
        clean_school_id resolves it to without crashing."""
        self._write_real_roster(tmp_path)
        records = []
        ns.process_rosters_2023_24_tetrio(records)
        # Row exists and has a non-empty player_id
        jd_stuy = [r for r in records if 'ign_four' == r['ign']]
        assert len(jd_stuy) == 1
        assert jd_stuy[0]['player_id']


# ---------------------------------------------------------------------------
# Placeholder processors: no-op when source absent
# ---------------------------------------------------------------------------

class TestPlaceholderNoOp:
    """All placeholder processors must be no-ops when their source file is
    absent so the pipeline doesn't break before data arrives."""

    @pytest.fixture(autouse=True)
    def tmp_dir(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

    def test_matches_2022_23_noop(self):
        r = []; ns.process_matches_2022_23_tetrio(r); assert r == []

    def test_matches_2023_24_noop(self):
        r = []; ns.process_matches_2023_24_tetrio(r); assert r == []

    def test_matches_2024_25_noop(self):
        r = []; ns.process_matches_2024_25_tetrio(r); assert r == []

    def test_matches_2025_26_noop(self):
        r = []; ns.process_matches_2025_26_tetrio(r); assert r == []

    def test_standings_2022_23_noop(self):
        r = []; ns.process_standings_2022_23_tetrio(r); assert r == []

    def test_standings_2023_24_noop(self):
        r = []; ns.process_standings_2023_24_tetrio(r); assert r == []

    def test_standings_2024_25_noop(self):
        r = []; ns.process_standings_2024_25_tetrio(r); assert r == []

    def test_standings_2025_26_noop(self):
        r = []; ns.process_standings_2025_26_tetrio(r); assert r == []

    def test_rosters_2022_23_noop(self):
        r = []; ns.process_rosters_2022_23_tetrio(r); assert r == []

    def test_rosters_2024_25_noop(self):
        r = []; ns.process_rosters_2024_25_tetrio(r); assert r == []

    def test_rosters_2025_26_noop(self):
        r = []; ns.process_rosters_2025_26_tetrio(r); assert r == []


# ---------------------------------------------------------------------------
# Placeholder processors: activate when source CSV present
# ---------------------------------------------------------------------------

class TestPlaceholderActivation:
    @pytest.fixture(autouse=True)
    def tmp_dir(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        return tmp_path

    # --- matches ---

    def _write_matches(self, tmp_path, season_dir):
        path = tmp_path / 'bronze_data' / season_dir / 'matches.csv'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            'match_id,match_date,home_team_id,away_team_id,home_score,away_score,winner_id,is_forfeit,notes\n'
            'tetrio_001,2024-03-15,stuyvesant,brooklyntech,2,1,stuyvesant,False,Round 1\n'
        )

    def test_matches_2022_23_activates(self, tmp_path):
        self._write_matches(tmp_path, 'tetrio_2022-23_matches')
        r = []
        ns.process_matches_2022_23_tetrio(r)
        assert len(r) == 1
        assert r[0]['season_id'] == '2022-23'
        assert r[0]['game_id'] == 'tetrio'
        assert r[0]['division'] == 'all'
        assert r[0]['home_team_id'] == 'stuyvesant'
        assert r[0]['away_team_id'] == 'brooklyntech'

    def test_matches_2023_24_activates(self, tmp_path):
        self._write_matches(tmp_path, 'tetrio_2023-24_matches')
        r = []
        ns.process_matches_2023_24_tetrio(r)
        assert len(r) == 1
        assert r[0]['season_id'] == '2023-24'
        assert r[0]['game_id'] == 'tetrio'
        assert r[0]['division'] == 'all'
        assert r[0]['home_team_id'] == 'stuyvesant'
        assert r[0]['away_team_id'] == 'brooklyntech'

    def test_matches_2024_25_activates(self, tmp_path):
        self._write_matches(tmp_path, 'tetrio_2024-25_matches')
        r = []
        ns.process_matches_2024_25_tetrio(r)
        assert len(r) == 1
        assert r[0]['season_id'] == '2024-25'

    def test_matches_2025_26_activates(self, tmp_path):
        self._write_matches(tmp_path, 'tetrio_2025-26_matches')
        r = []
        ns.process_matches_2025_26_tetrio(r)
        assert len(r) == 1
        assert r[0]['season_id'] == '2025-26'

    def test_matches_forfeit_parsed(self, tmp_path):
        path = tmp_path / 'bronze_data' / 'tetrio_2023-24_matches' / 'matches.csv'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            'match_id,match_date,home_team_id,away_team_id,home_score,away_score,winner_id,is_forfeit,notes\n'
            'tetrio_001,2024-03-15,stuyvesant,brooklyntech,2,0,stuyvesant,True,DQ\n'
        )
        r = []
        ns.process_matches_2023_24_tetrio(r)
        assert r[0]['is_forfeit'] is True

    # --- standings ---

    def _write_standings(self, tmp_path, season_dir, season_tag):
        path = tmp_path / 'bronze_data' / season_dir / 'standings.csv'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            'rank,school_id,player_name,player_ign,points,wins,losses,games_played,win_pct,notes\n'
            f'1,stuyvesant,Player One,ign_one,100,5,1,6,0.833,\n'
            f'2,brooklyntech,Player Two,ign_two,80,4,2,6,0.667,\n'
        )

    def test_standings_2022_23_activates(self, tmp_path):
        self._write_standings(tmp_path, 'tetrio_2022-23_standings', '2223')
        r = []
        ns.process_standings_2022_23_tetrio(r)
        assert len(r) == 2
        assert r[0]['season_id'] == '2022-23'
        assert r[0]['game_id'] == 'tetrio'
        assert r[0]['division'] == 'all'
        assert r[0]['rank'] == 1

    def test_standings_2023_24_activates(self, tmp_path):
        self._write_standings(tmp_path, 'tetrio_2023-24_standings', '2324')
        r = []
        ns.process_standings_2023_24_tetrio(r)
        assert len(r) == 2
        assert r[0]['season_id'] == '2023-24'
        assert r[0]['game_id'] == 'tetrio'
        assert r[0]['division'] == 'all'
        assert r[0]['rank'] == 1

    def test_standings_2024_25_activates(self, tmp_path):
        self._write_standings(tmp_path, 'tetrio_2024-25_standings', '2425')
        r = []
        ns.process_standings_2024_25_tetrio(r)
        assert len(r) == 2
        assert r[0]['season_id'] == '2024-25'

    def test_standings_2025_26_activates(self, tmp_path):
        self._write_standings(tmp_path, 'tetrio_2025-26_standings', '2526')
        r = []
        ns.process_standings_2025_26_tetrio(r)
        assert len(r) == 2
        assert r[0]['season_id'] == '2025-26'

    def test_standings_standing_id_unique(self, tmp_path):
        self._write_standings(tmp_path, 'tetrio_2023-24_standings', '2324')
        r = []
        ns.process_standings_2023_24_tetrio(r)
        ids = [row['standing_id'] for row in r]
        assert len(ids) == len(set(ids))

    # --- rosters 2024-25 and 2025-26 ---

    def _write_roster(self, tmp_path, season_dir, season_tag):
        path = tmp_path / 'bronze_data' / season_dir / 'rosters.csv'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            'school_id,player_name,ign,discord,grade\n'
            f'stuyvesant,Player One,ign_one,user1#1234,Junior\n'
            f'brooklyntech,Player Two,ign_two,user2#5678,Sophomore\n'
        )

    def test_rosters_2022_23_activates(self, tmp_path):
        self._write_roster(tmp_path, 'tetrio_2022-23_rosters', '2223')
        r = []
        ns.process_rosters_2022_23_tetrio(r)
        assert len(r) == 2
        assert r[0]['season_id'] == '2022-23'
        assert r[0]['game_id'] == 'tetrio'
        assert r[0]['division'] == 'all'

    def test_rosters_2024_25_activates(self, tmp_path):
        self._write_roster(tmp_path, 'tetrio_2024-25_rosters', '2425')
        r = []
        ns.process_rosters_2024_25_tetrio(r)
        assert len(r) == 2
        assert r[0]['season_id'] == '2024-25'
        assert r[0]['game_id'] == 'tetrio'
        assert r[0]['division'] == 'all'

    def test_rosters_2025_26_activates(self, tmp_path):
        self._write_roster(tmp_path, 'tetrio_2025-26_rosters', '2526')
        r = []
        ns.process_rosters_2025_26_tetrio(r)
        assert len(r) == 2
        assert r[0]['season_id'] == '2025-26'

    def test_rosters_2022_23_player_id_prefix(self, tmp_path):
        self._write_roster(tmp_path, 'tetrio_2022-23_rosters', '2223')
        r = []
        ns.process_rosters_2022_23_tetrio(r)
        for row in r:
            assert row['player_id'].startswith('tetrio2223_')

    def test_rosters_player_id_prefix(self, tmp_path):
        self._write_roster(tmp_path, 'tetrio_2024-25_rosters', '2425')
        r = []
        ns.process_rosters_2024_25_tetrio(r)
        for row in r:
            assert row['player_id'].startswith('tetrio2425_')

    def test_rosters_2025_26_player_id_prefix(self, tmp_path):
        self._write_roster(tmp_path, 'tetrio_2025-26_rosters', '2526')
        r = []
        ns.process_rosters_2025_26_tetrio(r)
        for row in r:
            assert row['player_id'].startswith('tetrio2526_')
