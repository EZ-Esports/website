"""Gold-tier normalization: silver_data/*.csv -> gold_data/*.csv.

Produces load-ready, DB-shaped CSVs for db/seed-gold.ts. All entity
resolution that requires judgment happens HERE, so the TS seed is a dumb
loader:

  - game ids -> site slugs (league_of_legends -> league-of-legends, ...)
  - school ids -> canonical slug + display name (fixes stray ids like
    'hchs' -> hunterhs, names schools missing from SCHOOL_NAMES)
  - divisions A/B/all -> Varsity/JV/All labels the public pages filter on;
    blank divisions (2023-24 rosters) resolved from that school's match
    participation, defaulting to Varsity
  - members deduped across seasons/games by (school, first, last) or IGN
  - is_captain / graduation year recovered from bronze (silver dropped them)
  - one captain per (season, game, school, division); extras noted as
    co-captains in the player bio
  - match status inference: forfeit flag -> forfeit, scores -> completed,
    otherwise completed with null scores for past matches (the
    roster_standings view ignores null-score rows); unscored matches dated
    today or later are upcoming fixtures -> 'scheduled'
  - standings derived from completed matches for seasons that have matches
    but no standings sheet (2023-24 LoL); skipped while a season still has
    scheduled fixtures. Ranked per division, except for the seasons declared
    in COMBINED_STANDINGS which ran as one table; rows keep their own division
    either way, and assert_derived_standings_sound() refuses to write a tally
    that does not add up

Run: python3 normalize_gold.py  (from sharepoint/; stdlib only)
"""
import csv
import os
import re
from collections import defaultdict
from datetime import date

GAME_SLUGS = {
    'valorant': 'valorant',
    'league_of_legends': 'league-of-legends',
    'teamfight_tactics': 'team-fight-tactics',
}

GAMES = [
    ('valorant', 'Valorant', 'VAL', '/images/games/val-banner.png'),
    ('league-of-legends', 'League of Legends', 'LoL', '/images/games/lol-banner.png'),
    ('team-fight-tactics', 'Teamfight Tactics', 'TFT', '/images/games/tft-banner.png'),
]

SCHOOL_NAMES = {
    'bayside': 'Bayside High School',
    'bxsci': 'Bronx High School of Science',
    'brooklyntech': 'Brooklyn Technical High School',
    'cardozo': 'Benjamin N. Cardozo High School',
    'forthamilton': 'Fort Hamilton High School',
    'francislewis': 'Francis Lewis High School',
    'lmg': 'Leon M. Goldstein High School',
    'johndewey': 'John Dewey High School',
    'lafayette': 'Lafayette High School',
    'midwood': 'Midwood High School',
    'newdorp': 'New Dorp High School',
    'newutrecht': 'New Utrecht High School',
    'qhss': 'Queens High School for the Sciences at York College',
    'sitech': 'Staten Island Technical High School',
    'stuyvesant': 'Stuyvesant High School',
    'townsendharris': 'Townsend Harris High School',
    'sewagner': 'Susan E. Wagner High School',
    'hunterhs': 'Hunter College High School',
    'curtis': 'Curtis High School',
    'murrow': 'Edward R. Murrow High School',
    'fdr': 'Franklin D. Roosevelt High School',
    'aviation': 'Aviation Career & Technical Education High School',
    'urbanassemblymaker': 'Urban Assembly Maker Academy',
    'jamesmadison': 'James Madison High School',
    'tottenville': 'Tottenville High School',
    'laguardia': 'Fiorello H. LaGuardia High School',
    'brooklynlatin': 'The Brooklyn Latin School',
    'saintedmund': 'Saint Edmund Preparatory High School',
}

# Stray school ids that slipped through silver's clean_school_id.
SCHOOL_REMAP = {'hchs': 'hunterhs'}

DIVISION_LABELS = {'A': 'Varsity', 'B': 'JV', 'all': 'All'}

# Seasons whose (season, game) ran as ONE competition, even though their teams
# carry A/B division labels. Grouping derived standings by division assumes
# division partitions the competition into separate, self-contained tables.
# That holds for every season here but one, so it was never declared — it was
# assumed, and the assumption silently fabricated two fake tables.
#
# 2023-24 League of Legends is the exception. Evidence from
# bronze_data/EZ Esports_ League of Legends Schedule (2023_2024)/
# Regular Season Schedule.csv:
#
#   1. Ten team-entries, and every one of them played exactly 9 DISTINCT
#      opponents — every other entry, once. A complete single round-robin
#      over ten entries (45 fixtures + 3 replays = 48).
#   2. 23 of those 48 fixtures pair an A-labelled entry against a B-labelled
#      one, and three are a school against its OWN other squad, with results:
#        2024-03-29  Midwood A            vs Midwood B            -> A
#        2024-04-07  Bronx Science B      vs Bronx Science A      -> A
#        2024-04-19  Brooklyn Tech A      vs Brooklyn Tech B      -> A
#      A school cannot play itself across a division boundary. These are two
#      squads from one school, entered in one table.
#   3. Three schools are consistently suffixed A/B (Brooklyn Tech, Midwood,
#      Bronx Science); four are consistently unsuffixed. Zero schools are
#      written inconsistently, so this is not a transcription error.
#
# So the A/B label names WHICH SQUAD A SCHOOL ENTERED, not which bracket it is
# ranked in. Each standings row therefore keeps its own `division` value — that
# is still true and still useful, it is the squad. Only the RANKING GROUP is
# combined, so ranks run 1..10 over the competition that was actually played.
#
# The division-grouped output was measurably wrong: Varsity summed 39W-28L and
# JV 9W-20L, an 11-game imbalance in each direction, though globally 48-48. A
# closed round-robin must have W == L. See assert_derived_standings_sound().
COMBINED_STANDINGS = {
    ('2023-24', 'league-of-legends'),
}

ROLE_MAP = {'starter': 'player', 'player': 'player', 'sub': 'sub'}

# Marks the standings rows this script tallies itself, as opposed to the rows
# transcribed from a standings sheet. Only the former can be checked against
# the matches, so the soundness guard filters on it.
DERIVED_NOTE = 'Derived from match results'

# grade word -> years until graduation, counted from the season's end year
GRADE_WORD_OFFSET = {
    'senior': 0, 'seniors': 0,
    'junior': 1, 'juniors': 1,
    'sophomore': 2, 'sophomores': 2,
    'freshman': 3, 'freshmen': 3,
}


def slugify(name):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', name.lower())).strip('-')


def canonical_school(school_id):
    school_id = SCHOOL_REMAP.get(school_id, school_id)
    name = SCHOOL_NAMES.get(school_id)
    if not name:
        raise ValueError(f'Unmapped school id: {school_id!r}')
    return slugify(name), name


def season_end_year(season_id):
    # "2021-22" -> 2022
    start = int(season_id.split('-')[0])
    return start + 1


def parse_grad_year(raw, season_id):
    """Accepts '24', '2024', 'Senior', 'Grade: Junior' etc. -> int year or None."""
    if not raw:
        return None
    raw = str(raw).strip()
    m = re.fullmatch(r'(20)?(\d{2})(\.0)?', raw)
    if m:
        return 2000 + int(m.group(2))
    word = raw.lower().replace('grade:', '').strip()
    if word in GRADE_WORD_OFFSET:
        return season_end_year(season_id) + GRADE_WORD_OFFSET[word]
    return None


def read(path):
    with open(path, newline='', encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def truthy(v):
    return str(v).strip().lower() == 'true'


def load_bronze_extras():
    """participant_id -> {is_captain, is_co_captain, grad_raw} from bronze rosters."""
    sources = [
        ('bronze_data/roster_valorant_2021-22/Sheet1.csv', 'grade_norm'),
        ('bronze_data/roster_lol_2021-22/Sheet1.csv', 'grade_norm'),
        ('bronze_data/Teamfight Tactics 2021-22 EZ Esports Complete Roster/Sheet1.csv', 'grade_norm'),
        ('bronze_data/Copy of 2022-23 EZesports VALORANT Rosters/NORM_VALORANTROSTERDB.csv', 'hs_graduation_year'),
        ('bronze_data/copy LoL Division 2022-23 spreadsheet ezesports/Roster.csv', 'grade'),
        ('bronze_data/val23-24 ezesports/complete rosters.csv', 'grade_norm'),
    ]
    extras = {}
    for path, grade_col in sources:
        if not os.path.exists(path):
            continue
        for row in read(path):
            pid = (row.get('participant_id') or '').strip()
            if not pid:
                continue
            extras[pid] = {
                'is_captain': truthy(row.get('is_captain', '')),
                'is_co_captain': truthy(row.get('is_co_captain', '')),
                'grad_raw': (row.get(grade_col) or '').strip(),
            }
    return extras


PEOPLE_DIR = 'bronze_data/_ledger_people'


def find_staff_csvs():
    """Find all staff/people candidate CSVs in bronze_data (excluding game player rosters)."""
    candidates = []

    # 1. Direct dumps in _ledger_people
    if os.path.exists(PEOPLE_DIR):
        for f in sorted(os.listdir(PEOPLE_DIR)):
            if f.endswith('.csv'):
                candidates.append(os.path.join(PEOPLE_DIR, f))

    # 2. Specific staff roster files from SharePoint (e.g. staffroster_2021-25)
    if os.path.exists('bronze_data'):
        for root, _dirs, files in os.walk('bronze_data'):
            for f in sorted(files):
                if not f.endswith('.csv') or f.endswith('__bold.csv'):
                    continue
                path = os.path.join(root, f)
                if path in candidates:
                    continue
                fn_lower = f.lower()
                parent_lower = os.path.basename(root).lower()
                if 'staffroster' in fn_lower or 'staffroster' in parent_lower or 'staff_completeroster' in fn_lower or 'staff_completeroster' in parent_lower or fn_lower == 'people.csv':
                    candidates.append(path)

    return candidates


def flex_get(row, keys):
    """Retrieve string value for the first matching key (case-insensitive)."""
    for target in keys:
        target_lower = target.lower()
        for col_name in row.keys():
            if col_name and str(col_name).strip().lower() == target_lower:
                val = str(row.get(col_name) or '').strip()
                if val and val.lower() != 'nan':
                    return val
    return ''


def build_leadership():
    """
    Staff rows for the `leadership` table from SharePoint bronze staff exports.
    """
    csv_paths = find_staff_csvs()
    if not csv_paths:
        return [], ['No staff/people CSVs found in bronze_data — run main.py to refresh bronze']

    rows, skipped = [], []
    seen_keys = set()

    for csv_path in csv_paths:
        for i, r in enumerate(read(csv_path), start=2):
            first = flex_get(r, ['first', 'first_name', 'first name', 'first_name'])
            last = flex_get(r, ['last', 'last_name', 'last name', 'last_name'])
            full_name = flex_get(r, ['name', 'full_name', 'full name', 'person'])

            if not (first or last) and full_name:
                raw_full = re.sub(r'\s*\([^)]*\)', '', full_name).strip()
                parts = raw_full.split(' ', 1)
                first = parts[0]
                last = parts[1] if len(parts) > 1 else ''

            name = ' '.join(p for p in (first, last) if p)
            division = flex_get(r, ['division', 'department', 'dept'])
            position = flex_get(r, ['position', 'role', 'title', 'pos'])
            years = flex_get(r, ['years active', 'years_active', 'years', 'season_id', 'year', 'season'])

            missing = []
            if not name:
                missing.append('Name')
            if not position and not division:
                missing.append('Division/Position')
            if not years:
                missing.append('Years Active')
            if missing:
                skipped.append(f'{name or f"row {i} in {os.path.basename(csv_path)}"}: no {", ".join(missing)}')
                continue

            preferred = flex_get(r, ['preferred name', 'preferred_name', 'preferred', 'handle', 'discord'])
            if not preferred and full_name and '(' in full_name:
                m_handle = re.search(r'\(([^)]+)\)', full_name)
                if m_handle:
                    preferred = m_handle.group(1).strip()

            fun_fact = flex_get(r, ['fun fact', 'fun_fact', 'notes', 'bio'])
            high_school = flex_get(r, ['high school', 'high_school', 'highschool', 'high school name', 'hs'])
            university = flex_get(r, ['university', 'college', 'uni'])

            for season in re.split(r'[,;/]| and ', years):
                season = season.strip()
                if not season:
                    continue
                m = re.match(r'(\d{4})', season)
                if not m:
                    skipped.append(f'{name}: unparseable Years Active "{season}"')
                    continue

                parsed_year = m.group(1)
                dedupe_key = (name.lower(), position.lower(), division.lower(), parsed_year)
                if dedupe_key in seen_keys:
                    continue
                seen_keys.add(dedupe_key)

                rows.append({
                    'first_name': first,
                    'last_name': last,
                    'preferred_name': preferred,
                    'division': division,
                    'position': position,
                    'year': parsed_year,
                    'fun_fact': fun_fact,
                    'high_school': high_school,
                    'university': university,
                })

    return rows, skipped


def ranking_group(season, game_slug, division):
    """The table a standings row is ranked within.

    Normally one table per division, because a division is a self-contained
    competition. For the (season, game) pairs in COMBINED_STANDINGS the
    division names the squad a school entered rather than a bracket, so every
    entry is ranked in one table. Ranking and the soundness checks both read
    this, so they can never disagree about what a table is.
    """
    if (season, game_slug) in COMBINED_STANDINGS:
        return (season, game_slug)
    return (season, game_slug, division)


def assert_derived_standings_sound(standings, counted_matches):
    """Refuse to write standings this script tallied wrong.

    Checks only rows noted DERIVED_NOTE. The imported snapshot rows carry W/L
    transcribed from a league standings sheet, not tallied from the matches in
    this archive, so they are not this pipeline's arithmetic to defend. Dropping
    that filter does not tighten the guard, it breaks it, measured against the
    current output:

      - it never reaches an assertion. 45 of the 173 snapshot rows are TFT
        per-player rows scored in points, with `wins` blank, and check (a) sums
        that column: `0 + ''` raises TypeError.
      - past that, 6 of the 14 snapshot tables are already imbalanced, none of
        them wrongly: 2021-22 TFT Varsity sums 598W-0L (its `wins` holds TFT
        points, as the rows' own notes say), 2021-22 Valorant Varsity +2,
        2022-23 Valorant JV +2, 2023-24 Valorant Varsity -4 and JV -2, 2024-25
        Valorant JV +11 — sheets whose totals count games this archive never
        recorded.
      - and check (c) fails on all 173, because `counted_matches` holds only the
        matches the derivation consumed. No snapshot season contributes one, so
        every snapshot row is compared against 0 appearances.

    None of that is a bug in the tally this function exists to defend, so the
    filter stays.

    `counted_matches` must be the exact list the derivation consumed, so a
    mismatch can only mean the tally is wrong, never that the two disagree
    about which matches were in play.
    """
    derived = [s for s in standings if s['notes'] == DERIVED_NOTE]

    # (a) Every game hands out exactly one win and one loss, so a table whose
    # members only play each other must sum W == L. An imbalance means the
    # table's members played opponents who are not in it — i.e. it is not a
    # real table. The invariant belongs to the TABLE, not to the division
    # label: grouping this by (season, game, division) would fail on correct
    # output, because 2023-24 LoL rows keep their true A/B divisions (39-28
    # and 9-20) while being ranked as one ten-entry competition. So group by
    # the same ranking_group() the ranks are assigned in.
    tables = defaultdict(lambda: {'wins': 0, 'losses': 0, 'entries': 0, 'ranks': []})
    for s in derived:
        table = tables[ranking_group(s['season'], s['game_slug'], s['division'])]
        table['wins'] += s['wins']
        table['losses'] += s['losses']
        table['entries'] += 1
        table['ranks'].append(s['rank'])
    for group, t in sorted(tables.items()):
        if t['wins'] != t['losses']:
            raise AssertionError(
                f'Derived standings table {group} is not a closed competition: '
                f"{t['entries']} entries summing {t['wins']}W-{t['losses']}L "
                f"({t['wins'] - t['losses']:+d}). Its members played opponents "
                f'that are not ranked with them, so the table is fabricated. '
                f'If this (season, game) ran as one competition, declare it in '
                f'COMBINED_STANDINGS.'
            )
        # (b) A rank only means anything inside the table it was measured in,
        # so each table's ranks must be exactly 1..N. This is what catches the
        # ranking code disagreeing with ranking_group(): (a) reads the same
        # helper the ranks were assigned from, so on its own it is blind to
        # that divergence — division-ranked 2023-24 LoL rows still sum 48W-48L
        # over the combined table while handing out two 1sts and two 2nds.
        if sorted(t['ranks']) != list(range(1, t['entries'] + 1)):
            raise AssertionError(
                f'Derived standings table {group} has ranks '
                f"{sorted(t['ranks'])} for {t['entries']} entries, not "
                f"1..{t['entries']}. The ranks were assigned over some other "
                f'grouping than the table they are published in.'
            )

    # (c) A derived row's games_played must equal the matches that entry
    # actually appeared in, over that same consumed match set. A shortfall
    # means a result was dropped from the tally without being dropped from the
    # season — a drawn match, say, which scores as neither a win nor a loss.
    appearances = defaultdict(int)
    for m in counted_matches:
        key = (m['season'], m['game_slug'])
        appearances[key + (m['home_division'], m['home_school_slug'])] += 1
        appearances[key + (m['away_division'], m['away_school_slug'])] += 1
    for s in derived:
        entry = (s['season'], s['game_slug'], s['division'], s['school_slug'])
        played = appearances[entry]
        if s['games_played'] != played:
            raise AssertionError(
                f'Derived standings row {entry} counts {s["games_played"]} '
                f"games played ({s['wins']}W-{s['losses']}L) but that entry "
                f'appears in {played} of the matches the tally consumed. '
                f'{played - s["games_played"]} result(s) were silently dropped.'
            )

    # (d) Every entry that played a counted match must have got a row. (c)
    # iterates the derived ROWS, so it cannot see an entry that has none: an
    # entry scoring no win and no loss — every one of its matches drawn — never
    # enters `derived` at all and simply vanishes from the table, and a table
    # missing an entry still sums W == L with ranks 1..N, so (a) and (b) are
    # blind to it too. (c) usually catches it second-hand, through an opponent
    # whose games_played is short by that same drawn match — but not when the
    # drawn matches are confined to entries that are ALL rowless (two entries
    # that played only each other, to a draw, disappear together and leave every
    # surviving row consistent).
    #
    # Unlike (a)-(c), this iterates the seasons that CONSUMED MATCHES, not the
    # seasons that produced rows. Scoping it to `derived` would reintroduce the
    # same blindness one level up: a season whose every counted fixture was
    # drawn produces no derived rows at all, so it would appear in neither the
    # loop nor any earlier check, and its entire table would be written empty
    # with the script exiting 0. Keying off `entered` means a season that played
    # matches must account for every entry that played one.
    ranked = {(s['season'], s['game_slug'], s['division'], s['school_slug']) for s in derived}
    entered = defaultdict(set)
    for m in counted_matches:
        key = (m['season'], m['game_slug'])
        entered[key].add(key + (m['home_division'], m['home_school_slug']))
        entered[key].add(key + (m['away_division'], m['away_school_slug']))
    for key in sorted(entered):
        dropped = sorted(entered[key] - ranked)
        if dropped:
            raise AssertionError(
                f'Derived standings for {key} rank {len(entered[key]) - len(dropped)} '
                f'of the {len(entered[key])} entries that played a counted match. '
                f'Missing: {dropped}. An entry with no win and no loss — every '
                f'one of its matches drawn — is dropped from the table instead '
                f'of being ranked last.'
            )


def main():
    os.makedirs('gold_data', exist_ok=True)

    silver_matches = read('silver_data/silver_matches.csv')
    silver_rosters = read('silver_data/silver_rosters.csv')
    silver_standings = read('silver_data/silver_standings.csv')
    extras = load_bronze_extras()

    # --- blank-division resolution: which divisions a school played, per season/game
    school_match_divisions = defaultdict(set)
    for m in silver_matches:
        for side, div_col in (('home_team_id', 'home_division'), ('away_team_id', 'away_division')):
            slug, _ = canonical_school(m[side])
            school_match_divisions[(m['season_id'], m['game_id'], slug)].add(m[div_col])

    def division_label(raw, season_id, game_id, school_slug):
        raw = (raw or '').strip()
        if raw in DIVISION_LABELS:
            return DIVISION_LABELS[raw]
        played = school_match_divisions.get((season_id, game_id, school_slug), set())
        if played == {'B'}:
            return 'JV'
        return 'Varsity'  # only-A, both, or unknown

    # --- schools (union across all three silver files)
    school_ids = set()
    for m in silver_matches:
        school_ids.update([m['home_team_id'], m['away_team_id']])
    for r in silver_rosters:
        school_ids.add(r['school_id'])
    for s in silver_standings:
        school_ids.add(s['school_id'])
    schools = sorted({canonical_school(sid) for sid in school_ids})

    # --- seasons (latest per game is active)
    season_keys = set()
    for m in silver_matches:
        season_keys.add((GAME_SLUGS[m['game_id']], m['season_id']))
    for r in silver_rosters:
        season_keys.add((GAME_SLUGS[r['game_id']], r['season_id']))
    for s in silver_standings:
        season_keys.add((GAME_SLUGS[s['game_id']], s['season_id']))
    latest = {}
    for game_slug, season in season_keys:
        latest[game_slug] = max(latest.get(game_slug, ''), season)
    seasons = sorted(season_keys)

    # --- members + players
    members = {}         # member_key -> row
    players = {}         # (season, game_slug, school_slug, division, member_key) -> row
    captain_taken = set()  # roster keys that already have their one captain

    for r in silver_rosters:
        school_slug, _ = canonical_school(r['school_id'])
        game_slug = GAME_SLUGS[r['game_id']]
        season = r['season_id']
        division = division_label(r['division'], season, r['game_id'], school_slug)

        first = (r['first_name'] or '').strip()
        last = (r['last_name'] or '').strip()
        full = (r['full_name'] or '').strip()
        ign = (r['ign'] or '').strip()
        if not first and not last and full:
            parts = full.split()
            first, last = parts[0], ' '.join(parts[1:])
        if not first and not last:
            if not ign:
                continue  # nothing identifies this row
            first = ign
        member_key = f'{school_slug}|{first.lower()}|{last.lower()}'

        extra = extras.get((r['player_id'] or '').strip(), {})
        grad_year = parse_grad_year(extra.get('grad_raw', ''), season)
        if grad_year is None and 'grade' in (r['notes'] or '').lower():
            grad_year = parse_grad_year(r['notes'], season)

        member = members.setdefault(member_key, {
            'member_key': member_key, 'school_slug': school_slug,
            'first_name': first, 'last_name': last,
            'discord': '', 'graduation_year': '',
        })
        if not member['discord'] and (r['discord_username'] or '').strip():
            member['discord'] = r['discord_username'].strip()
        if not member['graduation_year'] and grad_year:
            member['graduation_year'] = grad_year

        roster_key = (season, game_slug, school_slug, division)
        player_key = roster_key + (member_key,)
        if player_key in players:
            continue  # duplicate entry for the same person in the same roster

        raw_role = (r['role'] or '').strip().lower()
        role = ROLE_MAP.get(raw_role, 'player')
        is_captain = extra.get('is_captain', False) or raw_role == 'captain'
        is_co_captain = extra.get('is_co_captain', False) or raw_role == 'co-captain'
        bio_parts = []
        if is_captain and roster_key in captain_taken:
            is_captain = False
            bio_parts.append('Co-captain')
        elif is_captain:
            captain_taken.add(roster_key)
            role = 'captain'
        elif is_co_captain:
            bio_parts.append('Co-captain')

        pronouns = (r['pronouns'] or '').strip()
        if pronouns:
            bio_parts.append(pronouns)
        mvp = (r['mvp_count'] or '').strip()
        if mvp and float(mvp) > 0:
            bio_parts.append(f'{int(float(mvp))}x MVP')
        tracker = (r['tracker_url'] or '').strip()
        if tracker:
            bio_parts.append(tracker)
        notes = (r['notes'] or '').strip()
        if notes and not notes.lower().startswith('grade'):
            bio_parts.append(notes)

        players[player_key] = {
            'season': season, 'game_slug': game_slug, 'school_slug': school_slug,
            'division': division, 'member_key': member_key,
            'role': role, 'is_captain': is_captain,
            'ign': ign, 'bio': ' · '.join(bio_parts),
        }

    # --- matches
    matches = []
    for m in silver_matches:
        home_slug, _ = canonical_school(m['home_team_id'])
        away_slug, _ = canonical_school(m['away_team_id'])
        season, game_id = m['season_id'], m['game_id']
        home_division = DIVISION_LABELS[m['home_division']]
        away_division = DIVISION_LABELS[m['away_division']]

        def score(v):
            v = (v or '').strip()
            return int(float(v)) if v else ''

        home_score, away_score = score(m['home_score']), score(m['away_score'])
        if truthy(m['is_forfeit']):
            status = 'forfeit'
        elif home_score != '' or away_score != '':
            status = 'completed'
        elif m['match_date'] >= date.today().isoformat():
            status = 'scheduled'  # unscored and not yet played
        else:
            status = 'completed'  # historical, result unrecorded

        matches.append({
            'season': season, 'game_slug': GAME_SLUGS[game_id],
            'home_division': home_division, 'away_division': away_division,
            'scheduled_at': f"{m['match_date']} {m['match_time'] or '19:00:00'}",
            'home_school_slug': home_slug, 'away_school_slug': away_slug,
            'home_score': home_score, 'away_score': away_score, 'status': status,
            'mvp': (m['mvp'] or '').strip(), 'notes': (m['notes'] or '').strip(),
        })

    # --- rosters (only matches + players need roster rows)
    roster_keys = {k[:4] for k in players}
    for m in matches:
        for side, div in (('home_school_slug', 'home_division'), ('away_school_slug', 'away_division')):
            roster_keys.add((m['season'], m['game_slug'], m[side], m[div]))
    rosters = sorted(roster_keys)

    # --- standings
    standings = []
    for s in silver_standings:
        school_slug, _ = canonical_school(s['school_id'])

        def num(v, cast=int):
            v = (v or '').strip()
            return cast(float(v)) if v else ''

        standings.append({
            'season': s['season_id'], 'game_slug': GAME_SLUGS[s['game_id']],
            'division': DIVISION_LABELS[s['division']], 'school_slug': school_slug,
            'rank': num(s['rank']), 'wins': num(s['wins']), 'losses': num(s['losses']),
            'games_played': num(s['games_played']),
            'win_pct': num(s['win_pct'], float),
            'points': num(s['points'], float),
            'player_name': (s['player_name'] or '').strip(),
            'player_ign': (s['player_ign'] or '').strip(),
            'notes': (s['notes'] or '').strip(),
        })

    # --- derived standings: finished seasons with matches but no standings
    # sheet (2023-24 LoL). Computed from completed/forfeit match results so
    # the archive pages can show final ranks and a champion. A season with
    # scheduled fixtures or unrecorded results gets no snapshot — ranking
    # partial data would publish a wrong champion; the live roster_standings
    # view serves those seasons from whatever scores exist.
    covered = {(s['season'], s['game_slug']) for s in standings}
    incomplete = {
        (m['season'], m['game_slug']) for m in matches
        if m['status'] == 'scheduled'
        or (m['status'] == 'completed' and (m['home_score'] == '' or m['away_score'] == ''))
    }
    # Materialized so assert_derived_standings_sound() can check the tally
    # against the very same matches, not against a re-derived filter.
    counted_matches = [
        m for m in matches
        if (m['season'], m['game_slug']) not in covered
        and (m['season'], m['game_slug']) not in incomplete
        and m['status'] in ('completed', 'forfeit')
        and m['home_score'] != '' and m['away_score'] != ''
    ]
    derived = defaultdict(lambda: {'wins': 0, 'losses': 0})
    for m in counted_matches:
        key = (m['season'], m['game_slug'])
        home = key + (m['home_division'], m['home_school_slug'])
        away = key + (m['away_division'], m['away_school_slug'])
        if m['home_score'] > m['away_score']:
            derived[home]['wins'] += 1
            derived[away]['losses'] += 1
        elif m['away_score'] > m['home_score']:
            derived[away]['wins'] += 1
            derived[home]['losses'] += 1

    # Ranked per ranking_group(), which is the division only when the division
    # really is its own competition — see COMBINED_STANDINGS. Each row keeps
    # its OWN division either way: the label is true, it names the squad the
    # school entered, and only the group the rank is measured against changes.
    by_group = defaultdict(list)
    for (season, game_slug, division, school_slug), rec in derived.items():
        by_group[ranking_group(season, game_slug, division)].append(
            (school_slug, division, rec['wins'], rec['losses']))
    for group, teams in sorted(by_group.items()):
        season, game_slug = group[0], group[1]
        # wins desc, losses asc, then name — with the division breaking ties
        # between two squads of one school, so the CSV is reproducible.
        teams.sort(key=lambda t: (-t[2], t[3], t[0], t[1]))
        for rank, (school_slug, division, wins, losses) in enumerate(teams, start=1):
            games = wins + losses
            standings.append({
                'season': season, 'game_slug': game_slug, 'division': division,
                'school_slug': school_slug, 'rank': rank, 'wins': wins,
                'losses': losses, 'games_played': games,
                'win_pct': round(wins / games, 3) if games else '',
                'points': '', 'player_name': '', 'player_ign': '',
                'notes': DERIVED_NOTE,
            })

    # Nothing gets written unless the tally holds up.
    assert_derived_standings_sound(standings, counted_matches)

    # --- write everything
    def write(name, fieldnames, rows):
        with open(f'gold_data/{name}', 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)
        print(f'  gold_data/{name}: {len(rows)} rows')

    write('gold_games.csv', ['slug', 'display_name', 'short_name', 'image_url'],
          [dict(zip(['slug', 'display_name', 'short_name', 'image_url'], g)) for g in GAMES])
    write('gold_schools.csv', ['slug', 'name', 'display_order'],
          [{'slug': s, 'name': n, 'display_order': i} for i, (s, n) in enumerate(schools)])
    # standings_format is DECLARED here, from COMBINED_STANDINGS, not inferred
    # downstream from the shape of the standings rows. Note `seasons` holds
    # (game_slug, season) while COMBINED_STANDINGS holds (season, game_slug).
    season_rows = [
        {'game_slug': g, 'name': s, 'is_active': s == latest[g],
         'standings_format': 'combined' if (s, g) in COMBINED_STANDINGS else 'divided'}
        for g, s in seasons
    ]
    # Every declared pair must land on exactly one season, or the declaration
    # names a (season, game) that does not exist and quietly does nothing.
    combined = [r for r in season_rows if r['standings_format'] == 'combined']
    if len(combined) != len(COMBINED_STANDINGS):
        raise AssertionError(
            f'COMBINED_STANDINGS declares {len(COMBINED_STANDINGS)} '
            f'(season, game) pair(s) but {len(combined)} season row(s) matched: '
            f'{sorted((r["name"], r["game_slug"]) for r in combined)}. Check the '
            f'season name and game slug spelling.'
        )
    # A combined season served from an IMPORTED snapshot is the one path no
    # other check covers. assert_derived_standings_sound() filters to
    # DERIVED_NOTE rows, so it inspects none of these; the cross-check above
    # only proves the declared pair names a real season; and the read layer's
    # snapshot branch trusts the ranks it is given. A snapshot recorded
    # per-division restarts its ranks in each division, so merging it into one
    # table publishes 1,1,2,2,3,3... — two firsts, two seconds, in an order that
    # is not a ranking. A combined season may legitimately carry a snapshot, but
    # only one the league recorded as a single table, which is exactly what
    # unique ranks mean here.
    for r in combined:
        key = (r['name'], r['game_slug'])
        ranks = [s['rank'] for s in standings
                 if (s['season'], s['game_slug']) == key
                 and s['notes'] != DERIVED_NOTE and not s['player_name'] and s['rank'] != '']
        duplicated = sorted({x for x in ranks if ranks.count(x) > 1})
        if duplicated:
            raise AssertionError(
                f'{key} is declared combined but its imported standings repeat '
                f'rank(s) {duplicated} across {len(ranks)} rows. The snapshot was '
                f'recorded as separate per-division tables, so merging it into one '
                f'would publish several teams sharing each place. Either the season '
                f'did not run as one table, or the snapshot needs re-importing as '
                f'the single table it was.'
            )
    write('gold_seasons.csv', ['game_slug', 'name', 'is_active', 'standings_format'],
          season_rows)
    write('gold_rosters.csv', ['season', 'game_slug', 'school_slug', 'division'],
          [{'season': k[0], 'game_slug': k[1], 'school_slug': k[2], 'division': k[3]} for k in rosters])
    write('gold_members.csv', ['member_key', 'school_slug', 'first_name', 'last_name', 'discord', 'graduation_year'],
          sorted(members.values(), key=lambda m: m['member_key']))
    write('gold_players.csv', ['season', 'game_slug', 'school_slug', 'division', 'member_key', 'role', 'is_captain', 'ign', 'bio'],
          sorted(players.values(), key=lambda p: (p['season'], p['game_slug'], p['school_slug'], p['division'], p['member_key'])))
    write('gold_matches.csv', ['season', 'game_slug', 'home_division', 'away_division', 'scheduled_at', 'home_school_slug', 'away_school_slug', 'home_score', 'away_score', 'status', 'mvp', 'notes'],
          matches)
    write('gold_standings.csv', ['season', 'game_slug', 'division', 'school_slug', 'rank', 'wins', 'losses', 'games_played', 'win_pct', 'points', 'player_name', 'player_ign', 'notes'],
          standings)

    leadership, skipped = build_leadership()
    write('gold_leadership.csv',
          ['first_name', 'last_name', 'preferred_name', 'division', 'position', 'year', 'fun_fact', 'high_school', 'university'],
          leadership)
    if skipped:
        # Loud on purpose. The People tab is the only surviving route back to the
        # 70 staff rows a seed destroyed, and every line here is a person who
        # cannot be imported until somebody fills a cell in.
        print(f'  ⚠️ {len(skipped)} staff row(s) not exportable:')
        for reason in skipped[:20]:
            print(f'       - {reason}')
        if len(skipped) > 20:
            print(f'       ... and {len(skipped) - 20} more')

    captains = sum(1 for p in players.values() if p['is_captain'])
    grads = sum(1 for m in members.values() if m['graduation_year'])
    print(f'  captains recovered: {captains}, members with grad year: {grads}/{len(members)}')


if __name__ == '__main__':
    main()
