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
    scheduled fixtures

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

ROLE_MAP = {'starter': 'player', 'player': 'player', 'sub': 'sub'}

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
    derived = defaultdict(lambda: {'wins': 0, 'losses': 0})
    for m in matches:
        key = (m['season'], m['game_slug'])
        if key in covered or key in incomplete or (m['status'] not in ('completed', 'forfeit')):
            continue
        if m['home_score'] == '' or m['away_score'] == '':
            continue
        home = key + (m['home_division'], m['home_school_slug'])
        away = key + (m['away_division'], m['away_school_slug'])
        if m['home_score'] > m['away_score']:
            derived[home]['wins'] += 1
            derived[away]['losses'] += 1
        elif m['away_score'] > m['home_score']:
            derived[away]['wins'] += 1
            derived[home]['losses'] += 1

    by_group = defaultdict(list)
    for (season, game_slug, division, school_slug), rec in derived.items():
        by_group[(season, game_slug, division)].append((school_slug, rec['wins'], rec['losses']))
    for (season, game_slug, division), teams in sorted(by_group.items()):
        teams.sort(key=lambda t: (-t[1], t[2], t[0]))
        for rank, (school_slug, wins, losses) in enumerate(teams, start=1):
            games = wins + losses
            standings.append({
                'season': season, 'game_slug': game_slug, 'division': division,
                'school_slug': school_slug, 'rank': rank, 'wins': wins,
                'losses': losses, 'games_played': games,
                'win_pct': round(wins / games, 3) if games else '',
                'points': '', 'player_name': '', 'player_ign': '',
                'notes': 'Derived from match results',
            })

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
    write('gold_seasons.csv', ['game_slug', 'name', 'is_active'],
          [{'game_slug': g, 'name': s, 'is_active': s == latest[g]} for g, s in seasons])
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

    captains = sum(1 for p in players.values() if p['is_captain'])
    grads = sum(1 for m in members.values() if m['graduation_year'])
    print(f'  captains recovered: {captains}, members with grad year: {grads}/{len(members)}')


if __name__ == '__main__':
    main()
