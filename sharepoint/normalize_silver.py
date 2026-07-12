import os
import re
import pandas as pd
import numpy as np

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
    'saintedmund': 'Saint Edmund Preparatory High School'
}

def clean_school_id(name):
    if not isinstance(name, str):
        return ""
    name = name.lower().strip()
    if 'bayside' in name: return 'bayside'
    if 'latin' in name: return 'brooklynlatin'
    if 'bronx' in name or 'bxsci' in name: return 'bxsci'
    if 'brooklyn tech' in name or 'btech' in name or 'bths' in name: return 'brooklyntech'
    if 'cardozo' in name: return 'cardozo'
    if 'fort hamilton' in name or 'forthamilton' in name: return 'forthamilton'
    if 'francis lewis' in name or 'francislewis' in name or 'flhs' in name: return 'francislewis'
    if 'goldstein' in name or 'lmg' in name: return 'lmg'
    if 'john dewey' in name or 'dewey' in name: return 'johndewey'
    if 'lafayette' in name: return 'lafayette'
    if 'midwood' in name: return 'midwood'
    if 'new dorp' in name or 'newdorp' in name: return 'newdorp'
    if 'new utrecht' in name or 'newutrecht' in name: return 'newutrecht'
    if 'queens' in name or 'qhss' in name: return 'qhss'
    if 'staten island' in name or 'sitech' in name or 'siths' in name: return 'sitech'
    if 'stuyvesant' in name or 'stuy' in name: return 'stuyvesant'
    if 'madison' in name: return 'jamesmadison'
    if 'tottenville' in name: return 'tottenville'
    if 'laguardia' in name: return 'laguardia'
    if 'edmund' in name: return 'saintedmund'
    if 'townsend' in name: return 'townsendharris'
    if 'wagner' in name: return 'sewagner'
    if 'hunter' in name: return 'hunterhs'
    if 'curtis' in name: return 'curtis'
    if 'murrow' in name: return 'murrow'
    if 'fdr' in name or 'roosevelt' in name: return 'fdr'
    if 'aviation' in name: return 'aviation'
    if 'urban' in name: return 'urbanassemblymaker'
    return re.sub(r'[^a-z0-9]', '', name)

def get_school_name(school_id):
    return SCHOOL_NAMES.get(school_id, school_id.capitalize())

# A "W-L" pair that Google Sheets coerced into a date, e.g. "8-1" -> 2025-08-01.
EXCEL_DATE_RE = re.compile(r'^20\d{2}-(\d{2})-(\d{2})')

def fix_excel_score(val):
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    match = EXCEL_DATE_RE.match(val_str)
    if match:
        m = int(match.group(1))
        d = int(match.group(2))
        if d == 13:
            return f"13-{m}"
        elif m == 13:
            return f"13-{d}"
    return val_str

def fix_excel_pair(val):
    """Recover a "W-L" pair that Google Sheets coerced into a date.
    Coercion only happens when the pair parses as month-day (e.g. "8-1" ->
    2025-08-01), so the inverse is always month-day."""
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    match = EXCEL_DATE_RE.match(val_str)
    if match:
        return f"{int(match.group(1))}-{int(match.group(2))}"
    return val_str

def clean_cell(val, blanks=()):
    """Stripped cell text, or None for NaN/empty/blank-token cells."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    if not s or s.lower() in blanks:
        return None
    return s

def parse_team_division(label):
    """Split a team label like "Midwood High School A" / "Bxsci (B)" into
    (school_id, division). Division is None when the label has no A/B suffix."""
    s = re.sub(r'\s+', ' ', str(label).strip())
    m = re.match(r'^(.+?)\s*\(([AB])\)$', s) or re.match(r'^(.+?)\s+([AB])$', s)
    if m:
        return clean_school_id(m.group(1)), m.group(2)
    return clean_school_id(s), None

def is_school_cell(val):
    """True when a schedule cell names a school (not a bye/section label)."""
    if pd.isna(val):
        return False
    s = str(val).strip().lower()
    if not s:
        return False
    return not any(token in s for token in ('break', 'community', 'tba', 'tbd', 'bye', 'playoff', 'final'))

# MATCHES PROCESSORS
def process_matches_2021_22_a(records):
    path = 'bronze_data/Copy of 2021-22 Val A Schedule + Results/norm_schedule.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        home_score = 0
        away_score = 0
        is_forfeit = row.get('is_forfeit')
        if isinstance(is_forfeit, str):
            is_forfeit = is_forfeit.lower().strip() == 'true'
        else:
            is_forfeit = bool(is_forfeit)

        winner_id = clean_school_id(row.get('match_winner_id'))

        valid_games = 0
        for prefix in ['game1', 'game2', 'game3']:
            s1 = row.get(f'{prefix}_score_1')
            s2 = row.get(f'{prefix}_score_2')
            if pd.notna(s1) and pd.notna(s2):
                try:
                    if float(s1) > float(s2):
                        home_score += 1
                        valid_games += 1
                    elif float(s2) > float(s1):
                        away_score += 1
                        valid_games += 1
                except ValueError:
                    pass

        if is_forfeit and winner_id:
            h_id = clean_school_id(row.get('school_1_id'))
            a_id = clean_school_id(row.get('school_2_id'))
            if winner_id == h_id:
                home_score, away_score = 2, 0
            elif winner_id == a_id:
                home_score, away_score = 0, 2

        m_date = str(row.get('match_date')).split(' ')[0] if pd.notna(row.get('match_date')) else ""

        records.append({
            'match_id': row.get('match_id'),
            'season_id': '2021-22',
            'game_id': 'valorant',
            'division': 'A',
            'match_date': m_date,
            'match_time': row.get('match_time'),
            'home_team_id': clean_school_id(row.get('school_1_id')),
            'away_team_id': clean_school_id(row.get('school_2_id')),
            'home_score': home_score if (valid_games > 0 or is_forfeit) else None,
            'away_score': away_score if (valid_games > 0 or is_forfeit) else None,
            'winner_id': winner_id if winner_id else None,
            'is_forfeit': is_forfeit,
            'notes': row.get('notes')
        })

def process_matches_2021_22_b(records):
    raw_records = []
    folder = 'bronze_data/Copy of B team val schedule 2021-22'
    if not os.path.exists(folder):
        return
    for filename in os.listdir(folder):
        if not filename.endswith('.csv'):
            continue
        path = os.path.join(folder, filename)
        df = pd.read_csv(path, header=None)

        header_idx = None
        for idx, row in df.iterrows():
            row_str = [str(x).lower().strip() for x in row]
            if any('team 1' in x for x in row_str) and any('team 2' in x for x in row_str):
                header_idx = idx
                break
        if header_idx is None:
            continue

        headers = df.iloc[header_idx].tolist()
        headers = [str(h).strip() if pd.notna(h) else f'col_{i}' for i, h in enumerate(headers)]
        sub_df = df.iloc[header_idx+1:].copy()
        sub_df.columns = headers

        date_col = next((c for c in headers if 'date' in c.lower() or 'time' in c.lower()), None)
        team1_col = next((c for c in headers if 'team 1' in c.lower()), None)
        team2_col = next((c for c in headers if 'team 2' in c.lower()), None)

        if not (team1_col and team2_col):
            continue

        for _, row in sub_df.iterrows():
            t1 = row[team1_col]
            t2 = row[team2_col]
            if pd.isna(t1) or pd.isna(t2) or not str(t1).strip() or not str(t2).strip():
                continue
            d_val = row[date_col] if date_col else None
            raw_records.append({
                'match_date': d_val,
                'team_1': t1,
                'team_2': t2
            })

    unique_matches = {}
    for item in raw_records:
        t1 = clean_school_id(item['team_1'])
        t2 = clean_school_id(item['team_2'])
        pair = tuple(sorted([t1, t2]))

        date_val = item['match_date']
        date_str = ""
        time_str = None
        if pd.notna(date_val) and str(date_val).strip():
            date_part = str(date_val).strip().split(' ')
            date_str = date_part[0]
            if len(date_part) > 1:
                time_str = date_part[1]

        key = (date_str, pair)
        if key not in unique_matches:
            unique_matches[key] = {
                'match_date': date_str,
                'match_time': time_str,
                'home_team_id': t1,
                'away_team_id': t2
            }

    for i, item in enumerate(sorted(unique_matches.values(), key=lambda x: (x['match_date'], x['home_team_id']))):
        records.append({
            'match_id': f'2122_valo_b_{i+1:03d}',
            'season_id': '2021-22',
            'game_id': 'valorant',
            'division': 'B',
            'match_date': item['match_date'],
            'match_time': item['match_time'],
            'home_team_id': item['home_team_id'],
            'away_team_id': item['away_team_id'],
            'home_score': None,
            'away_score': None,
            'winner_id': None,
            'is_forfeit': False,
            'notes': None
        })

def process_matches_2022_23_val(records):
    path_norm = 'bronze_data/Copy of (Team) Valorant Schedule Sheet (22_23)/norm_Schedule.csv'
    path_raw = 'bronze_data/Copy of (Team) Valorant Schedule Sheet (22_23)/raw_Schedule.csv'
    if not os.path.exists(path_norm):
        return

    matchup_dates = {}
    if os.path.exists(path_raw):
        raw_df = pd.read_csv(path_raw)
        for idx, row in raw_df.iterrows():
            s1 = clean_school_id(row.get('School 1'))
            s2 = clean_school_id(row.get('School 2'))
            d = row.get('Date')
            if s1 and s2 and pd.notna(d) and d != '#########':
                matchup_dates[tuple(sorted([s1, s2]))] = str(d).split(' ')[0]

    norm_df = pd.read_csv(path_norm)
    for idx, row in norm_df.iterrows():
        s1 = clean_school_id(row.get('school_1_id'))
        s2 = clean_school_id(row.get('school_2_id'))
        m_date = row.get('match_date')

        if m_date == '#########' or pd.isna(m_date):
            pair = tuple(sorted([s1, s2]))
            m_date = matchup_dates.get(pair, "")
        else:
            m_date = str(m_date).split(' ')[0]

        records.append({
            'match_id': row.get('match_id'),
            'season_id': '2022-23',
            'game_id': 'valorant',
            'division': row.get('division'),
            'match_date': m_date,
            'match_time': row.get('match_time'),
            'home_team_id': s1,
            'away_team_id': s2,
            'home_score': None,
            'away_score': None,
            'winner_id': None,
            'is_forfeit': False,
            'notes': row.get('notes')
        })

def process_matches_2022_23_lol(records):
    path = 'bronze_data/copy LoL Division 2022-23 spreadsheet ezesports/Schedule.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s1 = clean_school_id(row.get('school_1_id'))
        s2 = clean_school_id(row.get('school_2_id'))
        winner_id = clean_school_id(row.get('winner_id'))

        is_forfeit = row.get('is_forfeit')
        if isinstance(is_forfeit, str):
            is_forfeit = is_forfeit.lower().strip() == 'true'
        else:
            is_forfeit = bool(is_forfeit)

        home_score = None
        away_score = None
        if winner_id:
            if winner_id == s1:
                home_score, away_score = 1, 0
            elif winner_id == s2:
                home_score, away_score = 0, 1

        m_date = str(row.get('match_date')).split(' ')[0] if pd.notna(row.get('match_date')) else ""

        records.append({
            'match_id': row.get('match_id'),
            'season_id': '2022-23',
            'game_id': 'league_of_legends',
            'division': row.get('division'),
            'match_date': m_date,
            'match_time': row.get('match_time'),
            'home_team_id': s1,
            'away_team_id': s2,
            'home_score': home_score,
            'away_score': away_score,
            'winner_id': winner_id if winner_id else None,
            'is_forfeit': is_forfeit,
            'notes': row.get('notes')
        })

def process_matches_2023_24_val(records):
    path = 'bronze_data/val23-24 ezesports/schedule.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    base_friday = pd.to_datetime('2023-10-27')

    for idx, row in df.iterrows():
        s1 = clean_school_id(row.get('school_1_id'))
        s2 = clean_school_id(row.get('school_2_id'))

        m_date = row.get('match_date')
        week = row.get('week')
        day = row.get('day_of_week')

        if (m_date == '#########' or pd.isna(m_date)) and pd.notna(week) and pd.notna(day):
            try:
                w_num = int(week)
                day_offset = 0
                if day.lower() == 'saturday':
                    day_offset = 1
                elif day.lower() == 'sunday':
                    day_offset = 2
                computed_date = base_friday + pd.Timedelta(weeks=w_num - 1) + pd.Timedelta(days=day_offset)
                m_date = computed_date.strftime('%Y-%m-%d')
            except Exception:
                m_date = ""
        else:
            if pd.notna(m_date):
                m_date = str(m_date).split(' ')[0]
            else:
                m_date = ""

        records.append({
            'match_id': row.get('match_id'),
            'season_id': '2023-24',
            'game_id': 'valorant',
            'division': row.get('division'),
            'match_date': m_date,
            'match_time': row.get('match_time'),
            'home_team_id': s1,
            'away_team_id': s2,
            'home_score': None,
            'away_score': None,
            'winner_id': None,
            'is_forfeit': False,
            'notes': row.get('notes')
        })

def process_matches_2023_24_lol(records):
    path = 'bronze_data/EZ Esports_ League of Legends Schedule (2023_2024)/Regular Season Schedule.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    current_date = ""
    rows = []
    for idx, row in df.iterrows():
        d = row.get('Dates')
        if pd.notna(d) and str(d).strip():
            current_date = str(d).split(' ')[0]

        s1_raw = row.get('Schools')
        s2_raw = row.iloc[4]
        if not (is_school_cell(s1_raw) and is_school_cell(s2_raw)):
            continue

        home_id, home_div = parse_team_division(s1_raw)
        away_id, away_div = parse_team_division(s2_raw)
        if not home_id or not away_id:
            continue

        rows.append({
            'date': current_date,
            'home_id': home_id, 'home_div': home_div or 'A',
            'away_id': away_id, 'away_div': away_div or 'A',
            'result': clean_cell(row.get('Result')),
            'mvp': clean_cell(row.get('MVP'), blanks=('n/a', 'na')),
        })

    def resolve(item, result):
        """Return (home_score, away_score, winner_id) or None if the result
        label doesn't identify either side."""
        if not result:
            return None
        w_id, w_div = parse_team_division(result)
        home_won = w_id == item['home_id'] and (w_div is None or w_div == item['home_div'])
        away_won = w_id == item['away_id'] and (w_div is None or w_div == item['away_div'])
        if home_won and not away_won:
            return 1, 0, item['home_id']
        if away_won and not home_won:
            return 0, 1, item['away_id']
        return None

    # The source sheet has a data-entry error where two same-date rows carry
    # each other's Result/MVP. When two unresolved results cross-match, swap.
    for i, a in enumerate(rows):
        if a['result'] is None or resolve(a, a['result']):
            continue
        for j in range(i + 1, len(rows)):
            b = rows[j]
            if b['date'] != a['date'] or b['result'] is None or resolve(b, b['result']):
                continue
            if resolve(a, b['result']) and resolve(b, a['result']):
                a['result'], b['result'] = b['result'], a['result']
                a['mvp'], b['mvp'] = b['mvp'], a['mvp']
                break

    for n, item in enumerate(rows, start=1):
        scored = resolve(item, item['result'])
        home_score, away_score, winner_id = scored if scored else (None, None, None)
        notes = None
        if item['result'] and not scored:
            notes = f"Result '{item['result']}' recorded but does not match either team"
        records.append({
            'match_id': f'2324_lol_{n:03d}',
            'season_id': '2023-24',
            'game_id': 'league_of_legends',
            'home_division': item['home_div'],
            'away_division': item['away_div'],
            'match_date': item['date'],
            'match_time': None,
            'home_team_id': item['home_id'],
            'away_team_id': item['away_id'],
            'home_score': home_score,
            'away_score': away_score,
            'winner_id': winner_id,
            'is_forfeit': False,
            'mvp': item['mvp'],
            'notes': notes
        })

def process_matches_2024_25_val(records):
    folder = 'bronze_data/VALORANT Regular Season Schedule 2024 - 2025'
    for div, filename in [('A', 'A Division.csv'), ('B', 'B Division.csv')]:
        path = os.path.join(folder, filename)
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path)
        current_date = ""
        n = 0
        for idx, row in df.iterrows():
            d = row.get('Dates')
            if pd.notna(d) and str(d).strip():
                current_date = str(d).split(' ')[0]

            s1_raw = row.get('Schools')
            s2_raw = row.iloc[4]
            if not (is_school_cell(s1_raw) and is_school_cell(s2_raw)):
                continue

            home_id = clean_school_id(s1_raw)
            away_id = clean_school_id(s2_raw)

            notes = clean_cell(row.get('Notes (if applicable)'))
            is_forfeit = bool(notes) and ('dq' in notes.lower() or 'forfeit' in notes.lower())

            home_score = None
            away_score = None
            winner_id = None
            result = row.get('Match Result')
            if pd.notna(result) and str(result).strip():
                w_id = clean_school_id(result)
                if w_id == home_id:
                    home_score, away_score, winner_id = 1, 0, home_id
                elif w_id == away_id:
                    home_score, away_score, winner_id = 0, 1, away_id

            mvp = clean_cell(row.get('M.V.P.'))

            n += 1
            records.append({
                'match_id': f'2425_valo_{div.lower()}_{n:03d}',
                'season_id': '2024-25',
                'game_id': 'valorant',
                'home_division': div,
                'away_division': div,
                'match_date': current_date,
                'match_time': None,
                'home_team_id': home_id,
                'away_team_id': away_id,
                'home_score': home_score,
                'away_score': away_score,
                'winner_id': winner_id,
                'is_forfeit': is_forfeit,
                'mvp': mvp,
                'notes': notes
            })

def process_matches_2025_26_val(records):
    folder = 'bronze_data/Copy of EZ Esports 2025-2026 Regular Season Schedule'
    for div, filename in [('A', 'A Division.csv'), ('B', 'B Division.csv')]:
        path = os.path.join(folder, filename)
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path)

        # The sheet marks the winner via bold formatting only; the score is
        # written winner-first. main.py exports a parallel bold mask.
        bold_path = path.replace('.csv', '__bold.csv')
        bold = pd.read_csv(bold_path, header=None) if os.path.exists(bold_path) else None

        current_date = ""
        n = 0
        for idx, row in df.iterrows():
            d = row.get('DATE')
            if pd.notna(d) and str(d).strip():
                current_date = str(d).split(' ')[0]

            s1_raw = row.get('SCHOOLS')
            s2_raw = row.iloc[5]
            if not (is_school_cell(s1_raw) and is_school_cell(s2_raw)):
                continue

            home_id = clean_school_id(s1_raw)
            away_id = clean_school_id(s2_raw)

            home_bold = False
            away_bold = False
            if bold is not None and idx + 1 < len(bold):
                home_bold = str(bold.iloc[idx + 1, 4]) == '1'
                away_bold = str(bold.iloc[idx + 1, 5]) == '1'

            notes = clean_cell(row.get('NOTES'))
            is_forfeit = bool(notes) and ('dq' in notes.lower() or 'forfeit' in notes.lower())

            home_score = None
            away_score = None
            winner_id = None
            result = fix_excel_pair(row.get('MATCH RESULT'))
            score_m = re.match(r'^(\d+)\s*-\s*(\d+)$', result)
            if score_m:
                w_score, l_score = int(score_m.group(1)), int(score_m.group(2))
                if home_bold and not away_bold:
                    home_score, away_score, winner_id = w_score, l_score, home_id
                elif away_bold and not home_bold:
                    home_score, away_score, winner_id = l_score, w_score, away_id
                else:
                    unresolved = f"Result {result} recorded but winner not bolded in source"
                    notes = f"{notes} | {unresolved}" if notes else unresolved

            n += 1
            records.append({
                'match_id': f'2526_valo_{div.lower()}_{n:03d}',
                'season_id': '2025-26',
                'game_id': 'valorant',
                'home_division': div,
                'away_division': div,
                'match_date': current_date,
                'match_time': None,
                'home_team_id': home_id,
                'away_team_id': away_id,
                'home_score': home_score,
                'away_score': away_score,
                'winner_id': winner_id,
                'is_forfeit': is_forfeit,
                'mvp': clean_cell(row.get('MVP')),
                'notes': notes
            })

# ROSTERS PROCESSORS
def process_rosters_2021_22_val(records):
    path = 'bronze_data/roster_valorant_2021-22/Sheet1.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        records.append({
            'player_id': row.get('participant_id'),
            'season_id': '2021-22',
            'game_id': 'valorant',
            'division': row.get('team_designation'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'first_name': row.get('first_name'),
            'last_name': row.get('last_name'),
            'full_name': row.get('full_name'),
            'ign': row.get('ign'),
            'discord_username': None,
            'pronouns': None,
            'role': row.get('role_on_team'),
            'mvp_count': 0,
            'tracker_url': None,
            'notes': row.get('notes')
        })

def process_rosters_2021_22_lol(records):
    path = 'bronze_data/roster_lol_2021-22/Sheet1.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        records.append({
            'player_id': row.get('participant_id'),
            'season_id': '2021-22',
            'game_id': 'league_of_legends',
            'division': row.get('team_designation'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'first_name': row.get('first_name'),
            'last_name': row.get('last_name'),
            'full_name': row.get('full_name'),
            'ign': row.get('ign'),
            'discord_username': None,
            'pronouns': None,
            'role': row.get('role_on_team'),
            'mvp_count': 0,
            'tracker_url': None,
            'notes': row.get('notes')
        })

def process_rosters_2021_22_tft(records):
    path = 'bronze_data/Teamfight Tactics 2021-22 EZ Esports Complete Roster/Sheet1.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        records.append({
            'player_id': row.get('participant_id'),
            'season_id': '2021-22',
            'game_id': 'teamfight_tactics',
            'division': row.get('team_designation'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'first_name': row.get('first_name'),
            'last_name': row.get('last_name'),
            'full_name': row.get('full_name'),
            'ign': row.get('ign'),
            'discord_username': None,
            'pronouns': None,
            'role': row.get('role_on_team'),
            'mvp_count': 0,
            'tracker_url': None,
            'notes': row.get('notes')
        })

def process_rosters_2022_23_val(records):
    path = 'bronze_data/Copy of 2022-23 EZesports VALORANT Rosters/NORM_VALORANTROSTERDB.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        mvp = row.get('mvp_count')
        try:
            mvp = int(float(mvp)) if pd.notna(mvp) else 0
        except ValueError:
            mvp = 0

        records.append({
            'player_id': row.get('participant_id'),
            'season_id': '2022-23',
            'game_id': 'valorant',
            'division': row.get('division'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'first_name': row.get('first_name'),
            'last_name': row.get('last_name'),
            'full_name': row.get('full_name'),
            'ign': row.get('ign'),
            'discord_username': None,
            'pronouns': row.get('pronouns'),
            'role': row.get('role_on_team'),
            'mvp_count': mvp,
            'tracker_url': row.get('tracker_url'),
            'notes': row.get('notes')
        })

def process_rosters_2022_23_lol(records):
    path = 'bronze_data/copy LoL Division 2022-23 spreadsheet ezesports/Roster.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        mvp = row.get('mvp_count')
        try:
            mvp = int(float(mvp)) if pd.notna(mvp) else 0
        except ValueError:
            mvp = 0

        records.append({
            'player_id': row.get('participant_id'),
            'season_id': '2022-23',
            'game_id': 'league_of_legends',
            'division': row.get('division'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'first_name': row.get('first_name'),
            'last_name': row.get('last_name'),
            'full_name': row.get('full_name'),
            'ign': row.get('ign'),
            'discord_username': row.get('discord_username'),
            'pronouns': None,
            'role': row.get('role_on_team'),
            'mvp_count': mvp,
            'tracker_url': row.get('opgg_reference'),
            'notes': row.get('notes')
        })

def process_rosters_2022_23_tft(records):
    path = 'bronze_data/TFT Tourney Lineup/Sheet1.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        fname = row.get('First Name')
        lname = row.get('Last Name')
        ign = row.get('IGN')
        school = row.get('School')
        discord = row.get('Discord')
        grade = row.get('Grade')

        if pd.isna(fname) and pd.isna(lname) and pd.isna(ign) and pd.isna(school):
            continue

        s_id = clean_school_id(school)
        fname_str = str(fname).strip() if pd.notna(fname) else ""
        lname_str = str(lname).strip() if pd.notna(lname) else ""
        full_name = f"{fname_str} {lname_str}".strip()

        records.append({
            'player_id': f'tft2223_{idx+1:04d}',
            'season_id': '2022-23',
            'game_id': 'teamfight_tactics',
            'division': 'all',
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'first_name': fname_str if fname_str else None,
            'last_name': lname_str if lname_str else None,
            'full_name': full_name if full_name else None,
            'ign': str(ign).strip() if pd.notna(ign) else None,
            'discord_username': str(discord).strip() if pd.notna(discord) else None,
            'pronouns': None,
            'role': 'Player',
            'mvp_count': 0,
            'tracker_url': None,
            'notes': f"Grade: {grade}" if pd.notna(grade) else None
        })

def process_rosters_2023_24_val(records):
    path = 'bronze_data/val23-24 ezesports/complete rosters.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        records.append({
            'player_id': row.get('participant_id'),
            'season_id': '2023-24',
            'game_id': 'valorant',
            'division': row.get('division'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'first_name': row.get('first_name'),
            'last_name': row.get('last_name'),
            'full_name': row.get('full_name'),
            'ign': row.get('ign'),
            'discord_username': None,
            'pronouns': None,
            'role': row.get('role_on_team'),
            'mvp_count': 0,
            'tracker_url': None,
            'notes': row.get('notes')
        })

def process_rosters_2023_24_lol(records):
    path = 'bronze_data/2023-2024 EZ ESPORTS LEAGUE OF LEGENDS ROSTER (Responses)/Form Responses 1.csv'
    if not os.path.exists(path):
        return
    # The form's data rows are shifted one column left of the header row
    # (the Timestamp column is empty in the source sheet), so read by position:
    # 0=school, 1=captain name, 2=main-roster blob, 3=captain discord,
    # 4=captain riot id, 5=substitutes blob.
    df = pd.read_csv(path, header=None, skiprows=1)

    def parse_riot_lines(blob):
        out = []
        if pd.isna(blob):
            return out
        for line in str(blob).split('\n'):
            line = line.strip()
            if not line:
                continue
            m = re.match(r'^([A-Za-z /]+?)\s*[-–:]\s*(.+)$', line)
            if m:
                out.append((m.group(1).strip(), m.group(2).strip()))
            else:
                out.append((None, line))
        return out

    n = 0
    seen_school_divs = set()
    for idx, row in df.iterrows():
        school_raw = row.iloc[0]
        if pd.isna(school_raw) or not str(school_raw).strip():
            continue
        s_id = clean_school_id(school_raw)
        div_m = re.search(r'\(([AB])\)', str(school_raw))
        division = div_m.group(1) if div_m else 'A'
        # Some schools submitted two unlabelled rows (one per team); the
        # second submission is the B team (verified against schedule MVPs).
        if (s_id, division) in seen_school_divs:
            division = 'B'
        seen_school_divs.add((s_id, division))

        seen_igns = set()

        def add_player(first, last, full, ign, discord, role, lane=None):
            nonlocal n
            key = str(ign).strip().lower() if ign else None
            if key:
                if key in seen_igns:
                    return
                seen_igns.add(key)
            n += 1
            records.append({
                'player_id': f'lol2324_{n:04d}',
                'season_id': '2023-24',
                'game_id': 'league_of_legends',
                'division': division,
                'school_id': s_id,
                'school_name': get_school_name(s_id),
                'first_name': first,
                'last_name': last,
                'full_name': full,
                'ign': ign,
                'discord_username': discord,
                'pronouns': None,
                'role': role,
                'mvp_count': 0,
                'tracker_url': None,
                'notes': f"Lane: {lane}" if lane else None
            })

        cap_name = row.iloc[1]
        cap_ign = row.iloc[4]
        cap_ign = str(cap_ign).strip() if pd.notna(cap_ign) and str(cap_ign).strip().lower() not in ('none', 'nan') else None
        cap_discord = row.iloc[3]
        cap_discord = str(cap_discord).strip() if pd.notna(cap_discord) else None
        first = last = full = None
        if pd.notna(cap_name) and str(cap_name).strip():
            full = str(cap_name).strip()
            parts = full.rsplit(' ', 1)
            first = parts[0]
            last = parts[1] if len(parts) > 1 else None
        add_player(first, last, full, cap_ign, cap_discord, 'Captain')

        for lane, ign in parse_riot_lines(row.iloc[2]):
            add_player(None, None, None, ign, None, 'Starter', lane)
        for lane, ign in parse_riot_lines(row.iloc[5]):
            add_player(None, None, None, ign, None, 'Sub', lane)

def process_rosters_2023_24_tft(records):
    path = 'bronze_data/TFT Scoreboard_1ha50m/Sheet1.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        name = row.get('Full Name')
        school = row.get('High School')
        if pd.isna(name) and pd.isna(school):
            continue
        s_id = clean_school_id(school)
        full_name = clean_cell(name) or ""
        parts = full_name.rsplit(' ', 1)
        first = parts[0] if full_name else None
        last = parts[1] if len(parts) > 1 else None

        records.append({
            'player_id': f'tft2324_{idx+1:04d}',
            'season_id': '2023-24',
            'game_id': 'teamfight_tactics',
            'division': 'all',
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'first_name': first,
            'last_name': last,
            'full_name': full_name if full_name else None,
            'ign': clean_cell(row.get('Riot ID')),
            'discord_username': clean_cell(row.get('Discord')),
            'pronouns': None,
            'role': 'Player',
            'mvp_count': 0,
            'tracker_url': None,
            'notes': None
        })

def process_rosters_2025_26_val(records):
    folder = 'bronze_data/EZ Esports 2025-2026 PLAYER VERIFICATION'
    if not os.path.exists(folder):
        return
    n = 0
    for filename in sorted(os.listdir(folder)):
        if not filename.endswith('.csv') or filename.endswith('__bold.csv'):
            continue
        df = pd.read_csv(os.path.join(folder, filename), header=None)

        school_raw = df.iloc[0, 1] if len(df) > 0 else None
        if pd.isna(school_raw):
            continue
        s_id = clean_school_id(school_raw)

        # Team letter comes from the "TEAM ROSTER x Team" banner. One tab
        # (Goldstein) lists both letters; that school only fields an A team
        # in the 2025-26 schedule, so prefer 'A' when both appear.
        division = None
        header_idx = None
        in_roster_block = False
        for idx in range(len(df)):
            row_vals = [str(v) for v in df.iloc[idx].tolist() if pd.notna(v)]
            row_text = ' '.join(row_vals)
            if 'TEAM ROSTER' in row_text:
                letters = re.findall(r'([AB])[\s-]*Team', row_text)
                division = 'A' if 'A' in letters else ('B' if 'B' in letters else None)
                in_roster_block = True
                continue
            if 'TEAM MANAGEMENT' in row_text:
                break
            if in_roster_block and 'First Name' in row_vals:
                header_idx = idx
                continue
            if header_idx is not None:
                first_s = clean_cell(df.iloc[idx, 1])
                last_s = clean_cell(df.iloc[idx, 2])
                if not first_s and not last_s:
                    continue
                grade = df.iloc[idx, 3]
                position = df.iloc[idx, 4]
                ign = df.iloc[idx, 5]
                full = ' '.join(p for p in [first_s, last_s] if p) or None
                n += 1
                records.append({
                    'player_id': f'val2526_{n:04d}',
                    'season_id': '2025-26',
                    'game_id': 'valorant',
                    'division': division or 'A',
                    'school_id': s_id,
                    'school_name': get_school_name(s_id),
                    'first_name': first_s,
                    'last_name': last_s,
                    'full_name': full,
                    'ign': clean_cell(ign),
                    'discord_username': None,
                    'pronouns': None,
                    'role': clean_cell(position) or 'Starter',
                    'mvp_count': 0,
                    'tracker_url': None,
                    'notes': f"Grade: {clean_cell(grade)}" if clean_cell(grade) else None
                })

# STANDINGS PROCESSORS
def process_standings_2021_22(records):
    path = 'bronze_data/Standings TFT Valorant LoL 2021-22 EZ Esports/Sheet1.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        game = row.get('game_id')
        records.append({
            'standing_id': f"std_2122_{game}_{row.get('division')}_{s_id}_{idx}",
            'season_id': '2021-22',
            'game_id': game,
            'division': row.get('division'),
            'rank': row.get('final_rank'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'wins': row.get('wins'),
            'losses': row.get('losses'),
            'games_played': row.get('games_played'),
            'win_pct': row.get('win_pct'),
            'player_name': None,
            'player_ign': None,
            'notes': row.get('notes')
        })

def process_standings_2022_23_val(records):
    path = 'bronze_data/valorant standings 2022-23 ezesports/Sheet1.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        records.append({
            'standing_id': f"std_2223_valo_{row.get('division')}_{s_id}",
            'season_id': '2022-23',
            'game_id': 'valorant',
            'division': row.get('division'),
            'rank': row.get('final_rank'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'wins': row.get('wins'),
            'losses': row.get('losses'),
            'games_played': row.get('games_played'),
            'win_pct': row.get('win_pct'),
            'player_name': None,
            'player_ign': None,
            'notes': row.get('notes')
        })

def process_standings_2022_23_lol(records):
    path = 'bronze_data/copy LoL Division 2022-23 spreadsheet ezesports/Results.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        records.append({
            'standing_id': f"std_2223_lol_{row.get('division')}_{s_id}",
            'season_id': '2022-23',
            'game_id': 'league_of_legends',
            'division': row.get('division'),
            'rank': row.get('final_rank'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'wins': row.get('wins'),
            'losses': row.get('losses'),
            'games_played': row.get('games_played'),
            'win_pct': row.get('win_pct'),
            'player_name': None,
            'player_ign': None,
            'notes': None
        })

def process_tft_scoreboard(records, path, season_id, id_tag, name_col, ign_col, school_col, discord_col):
    """Shared TFT weekly-points scoreboard -> individual standings ranked by Total."""
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    parsed_rows = []
    for idx, row in df.iterrows():
        name = row.get(name_col)
        school = row.get(school_col)
        total = row.get('Total')
        if pd.isna(name) and pd.isna(school):
            continue
        try:
            total_val = float(total) if pd.notna(total) else 0.0
        except ValueError:
            total_val = 0.0

        parsed_rows.append({
            'name': clean_cell(name) or "",
            'ign': clean_cell(row.get(ign_col)) or "",
            'school': clean_cell(school) or "",
            'discord': clean_cell(row.get(discord_col)) or "",
            'total': total_val
        })

    parsed_rows.sort(key=lambda x: x['total'], reverse=True)

    for rank_idx, item in enumerate(parsed_rows):
        s_id = clean_school_id(item['school'])
        records.append({
            'standing_id': f"std_{id_tag}_tft_all_p_{rank_idx+1}",
            'season_id': season_id,
            'game_id': 'teamfight_tactics',
            'division': 'all',
            'rank': rank_idx + 1,
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'wins': None,
            'losses': None,
            'games_played': None,
            'win_pct': None,
            'points': item['total'],
            'player_name': item['name'],
            'player_ign': item['ign'],
            'notes': f"Total Points: {item['total']} | Discord: {item['discord']}"
        })

def process_standings_2022_23_tft(records):
    process_tft_scoreboard(
        records, 'bronze_data/TFT Scoreboard_1-YH2U/Sheet1.csv', '2022-23', '2223',
        name_col='Name', ign_col='League IGN', school_col='School', discord_col='Discord ID')

def process_standings_2023_24_val(records):
    path = 'bronze_data/val23-24 ezesports/standings.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    for idx, row in df.iterrows():
        s_id = clean_school_id(row.get('school_id'))
        diff = row.get('round_differential')
        notes_str = f"Round Diff: {diff}" if pd.notna(diff) else ""

        records.append({
            'standing_id': f"std_2324_valo_{row.get('division')}_{s_id}",
            'season_id': '2023-24',
            'game_id': 'valorant',
            'division': row.get('division'),
            'rank': row.get('final_rank'),
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'wins': row.get('match_wins'),
            'losses': row.get('match_losses'),
            'games_played': row.get('match_games_played'),
            'win_pct': row.get('match_win_pct'),
            'player_name': None,
            'player_ign': None,
            'notes': notes_str
        })

def process_standings_2023_24_tft(records):
    process_tft_scoreboard(
        records, 'bronze_data/TFT Scoreboard_1ha50m/Sheet1.csv', '2023-24', '2324',
        name_col='Full Name', ign_col='Riot ID', school_col='High School', discord_col='Discord')

def process_standings_2024_25_val(records):
    folder = 'bronze_data/VALORANT Regular Season Schedule 2024 - 2025'

    # Regular-season points table: A block in cols 0-1, B block in cols 4-5.
    points_by_team = {}
    points_path = os.path.join(folder, 'Regular Season Standings.csv')
    if os.path.exists(points_path):
        pdf = pd.read_csv(points_path, header=None)
        for idx in range(2, len(pdf)):
            for div, s_col, p_col in [('A', 0, 1), ('B', 4, 5)]:
                school = pdf.iloc[idx, s_col]
                pts = pdf.iloc[idx, p_col]
                if pd.notna(school) and str(school).strip() and pd.notna(pts):
                    try:
                        points_by_team[(div, clean_school_id(school))] = float(pts)
                    except ValueError:
                        pass

    for div, filename in [('A', 'A Division Standings.csv'), ('B', 'B Division Standings.csv')]:
        path = os.path.join(folder, filename)
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path, header=None, skiprows=2,
                         names=['school', 'record', 'maps', 'rnd_diff', 'rnd_wl', 'playoff'])
        for idx, row in df.iterrows():
            school_raw = row.get('school')
            if pd.isna(school_raw) or not str(school_raw).strip():
                continue
            rank_m = re.match(r'^(\d+)\.\s*(.+)$', str(school_raw).strip())
            rank = int(rank_m.group(1)) if rank_m else None
            s_id = clean_school_id(rank_m.group(2) if rank_m else school_raw)

            wins = losses = games = pct = None
            record = fix_excel_pair(row.get('record'))
            rec_m = re.match(r'^(\d+)\s*-\s*(\d+)$', record)
            if rec_m:
                wins, losses = int(rec_m.group(1)), int(rec_m.group(2))
                games = wins + losses
                pct = round(wins / games, 3) if games else None

            note_parts = []
            maps = fix_excel_pair(row.get('maps'))
            if maps:
                note_parts.append(f"Maps: {maps}")
            if pd.notna(row.get('rnd_diff')):
                note_parts.append(f"Round Diff: {row.get('rnd_diff')}")
            rnd_wl = fix_excel_pair(row.get('rnd_wl'))
            if rnd_wl:
                note_parts.append(f"Rounds: {rnd_wl}")
            if pd.notna(row.get('playoff')) and str(row.get('playoff')).strip():
                note_parts.append(str(row.get('playoff')).strip())

            records.append({
                'standing_id': f"std_2425_valo_{div}_{s_id}",
                'season_id': '2024-25',
                'game_id': 'valorant',
                'division': div,
                'rank': rank,
                'school_id': s_id,
                'school_name': get_school_name(s_id),
                'wins': wins,
                'losses': losses,
                'games_played': games,
                'win_pct': pct,
                'points': points_by_team.get((div, s_id)),
                'player_name': None,
                'player_ign': None,
                'notes': ' | '.join(note_parts) if note_parts else None
            })

def main():
    print("🚀 Starting Silver Tier data normalization...")
    os.makedirs('silver_data', exist_ok=True)

    # 1. Matches
    matches_records = []
    print("   Ingesting matches...")
    process_matches_2021_22_a(matches_records)
    process_matches_2021_22_b(matches_records)
    process_matches_2022_23_val(matches_records)
    process_matches_2022_23_lol(matches_records)
    process_matches_2023_24_val(matches_records)
    process_matches_2023_24_lol(matches_records)
    process_matches_2024_25_val(matches_records)
    process_matches_2025_26_val(matches_records)

    matches_df = pd.DataFrame(matches_records)
    # Older processors emit a single 'division'; newer ones emit per-side
    # divisions (cross-division matches exist, e.g. Midwood A vs Midwood B).
    if 'division' in matches_df.columns:
        if 'home_division' not in matches_df.columns:
            matches_df['home_division'] = np.nan
            matches_df['away_division'] = np.nan
        matches_df['home_division'] = matches_df['home_division'].fillna(matches_df['division'])
        matches_df['away_division'] = matches_df['away_division'].fillna(matches_df['division'])
        matches_df.drop(columns=['division'], inplace=True)
    if 'mvp' not in matches_df.columns:
        matches_df['mvp'] = None
    matches_df = matches_df[['match_id', 'season_id', 'game_id', 'home_division', 'away_division',
                             'match_date', 'match_time', 'home_team_id', 'away_team_id',
                             'home_score', 'away_score', 'winner_id', 'is_forfeit', 'mvp', 'notes']]
    # Ensure correct sorting
    if len(matches_df) > 0:
        matches_df.sort_values(by=['season_id', 'game_id', 'home_division', 'match_date', 'match_id'], inplace=True)
    matches_df.to_csv('silver_data/silver_matches.csv', index=False)
    print(f"   Saved {len(matches_df)} normalized matches to 'silver_data/silver_matches.csv'.")

    # 2. Rosters
    rosters_records = []
    print("   Ingesting rosters...")
    process_rosters_2021_22_val(rosters_records)
    process_rosters_2021_22_lol(rosters_records)
    process_rosters_2021_22_tft(rosters_records)
    process_rosters_2022_23_val(rosters_records)
    process_rosters_2022_23_lol(rosters_records)
    process_rosters_2022_23_tft(rosters_records)
    process_rosters_2023_24_val(rosters_records)
    process_rosters_2023_24_lol(rosters_records)
    process_rosters_2023_24_tft(rosters_records)
    process_rosters_2025_26_val(rosters_records)

    rosters_df = pd.DataFrame(rosters_records)
    if len(rosters_df) > 0:
        rosters_df.sort_values(by=['season_id', 'game_id', 'school_id', 'player_id'], inplace=True)
    rosters_df.to_csv('silver_data/silver_rosters.csv', index=False)
    print(f"   Saved {len(rosters_df)} normalized rosters to 'silver_data/silver_rosters.csv'.")

    # 3. Standings
    standings_records = []
    print("   Ingesting standings...")
    process_standings_2021_22(standings_records)
    process_standings_2022_23_val(standings_records)
    process_standings_2022_23_lol(standings_records)
    process_standings_2022_23_tft(standings_records)
    process_standings_2023_24_val(standings_records)
    process_standings_2023_24_tft(standings_records)
    process_standings_2024_25_val(standings_records)

    standings_df = pd.DataFrame(standings_records)
    if 'points' not in standings_df.columns:
        standings_df['points'] = None
    standings_df = standings_df[['standing_id', 'season_id', 'game_id', 'division', 'rank',
                                 'school_id', 'school_name', 'wins', 'losses', 'games_played',
                                 'win_pct', 'points', 'player_name', 'player_ign', 'notes']]
    if len(standings_df) > 0:
        standings_df.sort_values(by=['season_id', 'game_id', 'division', 'rank'], inplace=True)
    standings_df.to_csv('silver_data/silver_standings.csv', index=False)
    print(f"   Saved {len(standings_df)} normalized standings to 'silver_data/silver_standings.csv'.")

    print("🎉 Silver Tier processing finished successfully!")

if __name__ == '__main__':
    main()
