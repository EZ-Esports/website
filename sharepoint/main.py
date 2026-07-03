import os
import re
import shutil
import pandas as pd
import requests

MASTER_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1qEzCT6bvpGEm2bjf0TR0WK-iJ2yMyiE_Ol7BuLID1Gs/export?format=xlsx"
OUTPUT_DIR = "./bronze_data"

def sanitize_filename(name):
    name = str(name).strip()
    # Replace illegal characters in directory/file names with underscore
    name = re.sub(r'[\\/*?:"<>|]', '_', name)
    return name

def get_spreadsheet_id(url):
    if not isinstance(url, str):
        return None
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
    return match.group(1) if match else None

def to_export_url(url):
    spreadsheet_id = get_spreadsheet_id(url)
    if not spreadsheet_id:
        return None
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=xlsx"

def fetch_spreadsheet_title(url):
    try:
        # Try to extract the title from the spreadsheet edit HTML
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            match = re.search(r'<title>(.*?)</title>', res.text)
            if match:
                title = match.group(1)
                if title.endswith(" - Google Sheets"):
                    title = title[:-16]
                return title.strip()
    except Exception as e:
        print(f"   ⚠️ Warning: Failed to fetch online title for {url} ({e})")
    return None

def main():
    print(f"🧹 Preparing output directory '{OUTPUT_DIR}'...")
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"📥 Downloading master spreadsheet ledger...")
    master_scratch = "master_ledger.xlsx"
    try:
        res = requests.get(MASTER_SPREADSHEET_URL, timeout=15)
        if res.status_code != 200:
            print(f"❌ Failed to download master ledger (HTTP {res.status_code})")
            return
        with open(master_scratch, "wb") as f:
            f.write(res.content)
    except Exception as e:
        print(f"❌ Error downloading master ledger: {e}")
        return

    try:
        # Load the MAIN sheet from the master ledger workbook
        xl_master = pd.ExcelFile(master_scratch)
        if 'MAIN' not in xl_master.sheet_names:
            print("❌ The master ledger does not contain a 'MAIN' sheet.")
            return

        df = pd.read_excel(xl_master, sheet_name='MAIN')
    except Exception as e:
        print(f"❌ Error reading master ledger: {e}")
        return
    finally:
        if os.path.exists(master_scratch):
            os.remove(master_scratch)

    # Ensure required columns are present
    required_cols = ['season_id', 'game_id', 'division', 'data_type', 'access']
    for col in required_cols:
        if col not in df.columns:
            print(f"❌ Missing required column '{col}' in MAIN sheet.")
            return

    # Keep track of already processed Spreadsheet IDs to avoid duplicate work
    processed_ids = set()
    scratchpad = "raw_download.xlsx"

    print(f"🚀 Starting dynamic bronze data extraction...")

    for idx, row in df.iterrows():
        url = row['access']
        spreadsheet_id = get_spreadsheet_id(url)

        # Skip if no valid spreadsheet ID found
        if not spreadsheet_id:
            continue

        # De-duplicate URLs
        if spreadsheet_id in processed_ids:
            print(f"⏩ Row {idx+1}: Spreadsheet {spreadsheet_id} already processed. Skipping.")
            continue

        print(f"\n📂 Row {idx+1}: Processing spreadsheet ID {spreadsheet_id}...")

        # 1. Fetch title of the spreadsheet
        # Fallback name constructed from metadata: season_id, game_id, division, data_type
        meta_parts = []
        for key in ['season_id', 'game_id', 'division', 'data_type']:
            val = row[key]
            if pd.notna(val) and str(val).strip() and str(val).lower() != 'nan':
                meta_parts.append(str(val).strip())
        fallback_name = "_".join(meta_parts) if meta_parts else f"spreadsheet_{spreadsheet_id}"

        title = fetch_spreadsheet_title(url)
        if title:
            dir_name = sanitize_filename(title)
            print(f"   🏷️ Fetched title: '{title}'")
        else:
            dir_name = sanitize_filename(fallback_name)
            print(f"   ⚠️ Using fallback directory name: '{dir_name}'")

        sub_dir_path = os.path.join(OUTPUT_DIR, dir_name)
        os.makedirs(sub_dir_path, exist_ok=True)

        # 2. Download spreadsheet
        dl_url = to_export_url(url)
        print(f"   📥 Downloading workbook...")
        try:
            res = requests.get(dl_url, timeout=20)
            if res.status_code != 200:
                print(f"   ⚠️ Failed to download (HTTP {res.status_code})")
                continue

            with open(scratchpad, "wb") as f:
                f.write(res.content)

            # 3. Read and export all sheets
            xl = pd.ExcelFile(scratchpad)
            for sheet_name in xl.sheet_names:
                df_sheet = pd.read_excel(scratchpad, sheet_name=sheet_name, header=None)

                safe_sheet_name = sanitize_filename(sheet_name)
                csv_path = os.path.join(sub_dir_path, f"{safe_sheet_name}.csv")

                df_sheet.to_csv(csv_path, index=False, header=False)
                print(f"   💾 Saved sheet '{sheet_name}' to: {csv_path}")

            processed_ids.add(spreadsheet_id)

        except Exception as e:
            print(f"   ❌ Error extracting spreadsheet: {e}")

    if os.path.exists(scratchpad):
        os.remove(scratchpad)

    print(f"\n🎉 Finished! All bronze data is organized hierarchically in '{OUTPUT_DIR}'.")

if __name__ == "__main__":
    main()
