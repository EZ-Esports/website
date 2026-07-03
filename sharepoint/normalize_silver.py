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
    'urbanassemblymaker': 'Urban Assembly Maker Academy'
}

def clean_school_id(name):
    if not isinstance(name, str):
        return ""
    name = name.lower().strip()
    if 'bayside' in name: return 'bayside'
    if 'bronx' in name or 'bxsci' in name: return 'bxsci'
    if 'brooklyn tech' in name or 'btech' in name: return 'brooklyntech'
    if 'cardozo' in name: return 'cardozo'
    if 'fort hamilton' in name or 'forthamilton' in name: return 'forthamilton'
    if 'francis lewis' in name or 'francislewis' in name: return 'francislewis'
    if 'goldstein' in name or 'lmg' in name: return 'lmg'
    if 'john dewey' in name or 'dewey' in name: return 'johndewey'
    if 'lafayette' in name: return 'lafayette'
    if 'midwood' in name: return 'midwood'
    if 'new dorp' in name or 'newdorp' in name: return 'newdorp'
    if 'new utrecht' in name or 'newutrecht' in name: return 'newutrecht'
    if 'queens' in name or 'qhss' in name: return 'qhss'
    if 'staten island' in name or 'sitech' in name: return 'sitech'
    if 'stuyvesant' in name or 'stuy' in name: return 'stuyvesant'
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

def fix_excel_score(val):
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    match = re.match(r'^20\d{2}-(\d{2})-(\d{2})', val_str)
    if match:
        m = int(match.group(1))
        d = int(match.group(2))
        if d == 13:
            return f"13-{m}"
        elif m == 13:
            return f"13-{d}"
    return val_str

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

def process_standings_2022_23_tft(records):
    path = 'bronze_data/TFT Scoreboard/Sheet1.csv'
    if not os.path.exists(path):
        return
    df = pd.read_csv(path)
    parsed_rows = []
    for idx, row in df.iterrows():
        name = row.get('Name')
        school = row.get('School')
        total = row.get('Total')
        if pd.isna(name) and pd.isna(school):
            continue
        try:
            total_val = float(total) if pd.notna(total) else 0.0
        except ValueError:
            total_val = 0.0

        parsed_rows.append({
            'name': str(name).strip() if pd.notna(name) else "",
            'ign': str(row.get('League IGN')).strip() if pd.notna(row.get('League IGN')) else "",
            'school': str(school).strip() if pd.notna(school) else "",
            'discord': str(row.get('Discord ID')).strip() if pd.notna(row.get('Discord ID')) else "",
            'total': total_val
        })

    parsed_rows.sort(key=lambda x: x['total'], reverse=True)

    for rank_idx, item in enumerate(parsed_rows):
        s_id = clean_school_id(item['school'])
        records.append({
            'standing_id': f"std_2223_tft_all_p_{rank_idx+1}",
            'season_id': '2022-23',
            'game_id': 'teamfight_tactics',
            'division': 'all',
            'rank': rank_idx + 1,
            'school_id': s_id,
            'school_name': get_school_name(s_id),
            'wins': None,
            'losses': None,
            'games_played': None,
            'win_pct': None,
            'player_name': item['name'],
            'player_ign': item['ign'],
            'notes': f"Total Points: {item['total']} | Discord: {item['discord']}"
        })

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

    matches_df = pd.DataFrame(matches_records)
    # Ensure correct sorting
    if len(matches_df) > 0:
        matches_df.sort_values(by=['season_id', 'game_id', 'division', 'match_date', 'match_id'], inplace=True)
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

    standings_df = pd.DataFrame(standings_records)
    if len(standings_df) > 0:
        standings_df.sort_values(by=['season_id', 'game_id', 'division', 'rank'], inplace=True)
    standings_df.to_csv('silver_data/silver_standings.csv', index=False)
    print(f"   Saved {len(standings_df)} normalized standings to 'silver_data/silver_standings.csv'.")

    print("🎉 Silver Tier processing finished successfully!")

if __name__ == '__main__':
    main()
