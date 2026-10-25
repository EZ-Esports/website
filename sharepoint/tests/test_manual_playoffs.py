"""The Discord playoff supplement merges into gold without touching standings."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import normalize_gold as ng


def test_playoff_file_loads_seven_varsity_matches_that_do_not_count():
    rows = ng.load_manual_playoff_matches()
    assert len(rows) == 7
    assert all(not ng.counts_for_standings(row) for row in rows)
    assert {row['game_slug'] for row in rows} == {'valorant'}
    assert {row['season'] for row in rows} == {'2025-26'}


def test_merge_adds_the_season_and_keeps_sheet_schools():
    schools = [('bayside-high-school', 'Bayside High School')]
    season_keys = {('valorant', '2024-25')}
    merged, rows = ng.merge_manual_playoffs(schools, season_keys)
    slugs = {slug for slug, _name in merged}
    assert 'bayside-high-school' in slugs
    assert 'brooklyn-technical-high-school' in slugs
    assert 'leon-m-goldstein-high-school' in slugs
    assert ('valorant', '2025-26') in season_keys
    assert ('valorant', '2024-25') in season_keys
    assert len(rows) == 7


def test_sheet_matches_still_count_when_the_column_is_absent():
    assert ng.counts_for_standings({}) is True
    assert ng.counts_for_standings({'counts_for_standings': 'true'}) is True
    assert ng.counts_for_standings({'counts_for_standings': 'false'}) is False
