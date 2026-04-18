# -*- coding: utf-8 -*-
"""
sync_google_sheet.py
─────────────────────────────────────────────────────────────────────────────
Đồng bộ nhân viên từ Google Sheet → SQLite DB.

Hai chế độ xác thực:
  1. Service Account (chính thức, bảo mật) – cần file google_credentials.json
  2. Public link  – sheet & ảnh Drive để "Anyone with the link"

Cách dùng:
  # Tạo template sheet (cần credentials):
  python sync_google_sheet.py --create-template

  # Chạy đồng bộ:
  python sync_google_sheet.py --sync <SHEET_ID> [--dry-run]

  # Xem trạng thái:
  python sync_google_sheet.py --status

  # Gỡ lỗi (verbose):
  python sync_google_sheet.py --sync <SHEET_ID> -v
─────────────────────────────────────────────────────────────────────────────
"""
import os, sys, io, json, re, time, tempfile, shutil, urllib.request
from datetime import datetime

# ── Google API ───────────────────────────────────────────────────────────────
try:
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account
    import googleapiclient.discovery
    import googleapiclient.http
    HAS_GOOGLE_API = True
except ImportError:
    HAS_GOOGLE_API = False

# ── Pillow / TensorFlow (lazy) ───────────────────────────────────────────────
HAS_PIL = False
HAS_TF   = False
try:
    from PIL import Image
    import numpy as np
    HAS_PIL = True
except ImportError:
    pass


# ══════════════════════════════════════════════════════════════════════════════
#  Cấu hình
# ══════════════════════════════════════════════════════════════════════════════
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
CREDS_FILE   = os.path.join(SCRIPT_DIR, 'google_credentials.json')
UPLOAD_DIR   = os.path.join(SCRIPT_DIR, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Scopes
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
]


# ══════════════════════════════════════════════════════════════════════════════
#  Xác thực
# ══════════════════════════════════════════════════════════════════════════════
def get_drive_service():
    """Trả về Google Drive API service (Service Account)."""
    if not HAS_GOOGLE_API:
        raise SystemExit("Thiếu google-api-python-client. Chạy: pip install google-api-python-client google-auth-httplib2")
    creds = service_account.Credentials.from_service_account_file(
        CREDS_FILE, scopes=SCOPES)
    return googleapiclient.discovery.build('drive', 'v3', credentials=creds)


def get_sheets_service():
    """Trả về Google Sheets API service (Service Account)."""
    if not HAS_GOOGLE_API:
        raise SystemExit("Thiếu google-api-python-client. Chạy: pip install google-api-python-client google-auth-httplib2")
    creds = service_account.Credentials.from_service_account_file(
        CREDS_FILE, scopes=SCOPES)
    return googleapiclient.discovery.build('sheets', 'v4', credentials=creds)


# ══════════════════════════════════════════════════════════════════════════════
#  Download ảnh từ Google Drive
# ══════════════════════════════════════════════════════════════════════════════
def extract_drive_file_id(url: str) -> str | None:
    """Trích file ID từ nhiều dạng Google Drive URL."""
    patterns = [
        r'/file/d/([a-zA-Z0-9_-]{10,})',
        r'id=([a-zA-Z0-9_-]{10,})',
        r'folders/([a-zA-Z0-9_-]{10,})',
        r'([a-zA-Z0-9_-]{10,})[?/&"\'\s]',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def download_image_from_drive(drive_service, file_id: str) -> bytes | None:
    """Tải nội dung file ảnh từ Google Drive. Trả về bytes hoặc None."""
    try:
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = googleapiclient.http.MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return fh.getvalue()
    except Exception as e:
        print(f"    [WARN] Không tải được file Drive {file_id}: {e}")
        return None


def download_image_public(url: str) -> bytes | None:
    """Tải ảnh qua link public (uc?export=view&id=...)."""
    if 'drive.google.com' not in url:
        return None
    file_id = extract_drive_file_id(url)
    if not file_id:
        return None
    # Chuẩn hóa: dùng endpoint export công khai
    public_url = f"https://drive.google.com/uc?export=view&id={file_id}"
    try:
        req = urllib.request.Request(
            public_url,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; TrueFaceBot/1.0)'}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            ct = resp.headers.get('Content-Type', '')
            if 'image' not in ct and resp.headers.get('Content-Length', '0') == '0':
                return None
            return resp.read()
    except Exception as e:
        print(f"    [WARN] Không tải được {public_url}: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
#  ArcFace embedding
# ══════════════════════════════════════════════════════════════════════════════
_arcface_model = None

def load_arcface():
    global _arcface_model
    if _arcface_model is not None:
        return _arcface_model
    model_path = os.path.join(
        os.path.dirname(SCRIPT_DIR), 'saved_model', 'arcface_embedding.h5')
    if not os.path.isfile(model_path):
        print(f"[WARN] Không tìm thấy ArcFace model: {model_path}")
        _arcface_model = False
        return None
    try:
        from tensorflow.keras.models import load_model
        _arcface_model = load_model(model_path, compile=False, safe_mode=False)
        print(f"[INFO] Đã nạp ArcFace model: {model_path}")
        return _arcface_model
    except Exception as e:
        print(f"[WARN] Không load được ArcFace: {e}")
        _arcface_model = False
        return None


def compute_embedding(image_bytes: bytes) -> list | None:
    """Tính embedding 512-d từ bytes ảnh. Trả về list hoặc None."""
    if not HAS_PIL:
        return None
    model = load_arcface()
    if not model:
        return None
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB').resize((112, 112))
        arr = np.array(img, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)
        emb = model.predict(arr, verbose=0)[0]
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        return emb.tolist()
    except Exception as e:
        print(f"    [WARN] compute_embedding lỗi: {e}")
        return None


def compute_embedding_from_images_bytes(images_bytes: list, max_images: int = 5) -> list | None:
    """Tính embedding trung bình từ danh sách bytes ảnh."""
    if not images_bytes:
        return None
    embeddings = []
    for b in images_bytes[:max_images]:
        emb = compute_embedding(b)
        if emb and len(emb) == 512:
            embeddings.append(np.array(emb, dtype=np.float32))
    if not embeddings:
        return None
    mean_emb = np.mean(embeddings, axis=0)
    norm = np.linalg.norm(mean_emb)
    if norm > 0:
        mean_emb = mean_emb / norm
    return mean_emb.tolist()


# ══════════════════════════════════════════════════════════════════════════════
#  Cơ sở dữ liệu (SQLite)
# ══════════════════════════════════════════════════════════════════════════════
def get_db_conn():
    from database import DB_PATH
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_department(cur, name: str) -> int | None:
    """Đảm bảo department tồn tại, trả về id."""
    if not name or not name.strip():
        return None
    name = name.strip()
    cur.execute("SELECT id FROM departments WHERE name = ?", (name,))
    row = cur.fetchone()
    if row:
        return row['id']
    cur.execute("INSERT INTO departments (name) VALUES (?)", (name,))
    return cur.lastrowid


def ensure_position(cur, name: str) -> int | None:
    if not name or not name.strip():
        return None
    name = name.strip()
    cur.execute("SELECT id FROM positions WHERE name = ?", (name,))
    row = cur.fetchone()
    if row:
        return row['id']
    cur.execute("INSERT INTO positions (name, daily_wage, overtime_multiplier) VALUES (?, 0, 1.5)",
                (name,))
    return cur.lastrowid


def ensure_shift(cur, name: str) -> int | None:
    if not name or not name.strip():
        return None
    name = name.strip()
    cur.execute("SELECT id FROM shifts WHERE name = ?", (name,))
    row = cur.fetchone()
    if row:
        return row['id']
    cur.execute("INSERT INTO shifts (name, start_time, end_time, working_hours) VALUES (?, '08:00', '17:00', 8)",
                (name,))
    return cur.lastrowid


def upsert_employee(conn, data: dict, embedding: list | None) -> tuple[bool, str]:
    """
    Tạo hoặc cập nhật nhân viên theo code.
    Trả về (success, message).
    """
    code = (data.get('code') or '').strip()
    name = (data.get('name') or '').strip()
    if not code or not name:
        return False, "Thiếu code hoặc name"

    cur = conn.cursor()

    # Resolve foreign keys
    dept_id    = ensure_department(cur, data.get('department', ''))
    position_id = ensure_position(cur, data.get('position', ''))
    shift_id    = ensure_shift(cur, data.get('shift', ''))

    cur.execute("SELECT id, embedding FROM employees WHERE code = ?", (code,))
    existing = cur.fetchone()

    now = datetime.now().isoformat()

    if existing:
        emp_id = existing['id']
        old_emb = existing['embedding']
        # Nếu chưa có embedding trong DB → cập nhật
        need_emb = (not old_emb or old_emb == 'null') and embedding
        fields = {
            'name': name,
            'department': data.get('department', ''),
            'department_id': dept_id,
            'position_id': position_id,
            'shift_id': shift_id,
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'birth_date': data.get('birth_date', ''),
            'daily_wage': data.get('daily_wage', 0),
        }
        if need_emb:
            fields['embedding'] = json.dumps(embedding)
        set_clause = ', '.join(f"{k} = ?" for k in fields)
        vals = list(fields.values()) + [emp_id]
        cur.execute(f"UPDATE employees SET {set_clause} WHERE id = ?", vals)
        msg = "cập nhật"
    else:
        # Tạo mới
        fields = {
            'code': code,
            'name': name,
            'department': data.get('department', ''),
            'department_id': dept_id,
            'position_id': position_id,
            'shift_id': shift_id,
            'allowed_checkin': 1,
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'birth_date': data.get('birth_date', ''),
            'daily_wage': data.get('daily_wage', 0),
            'status': 'active',
            'created_at': now,
        }
        if embedding:
            fields['embedding'] = json.dumps(embedding)
        cols  = ', '.join(fields.keys())
        ph   = ', '.join('?' * len(fields))
        cur.execute(f"INSERT INTO employees ({cols}) VALUES ({ph})",
                    list(fields.values()))
        emp_id = cur.lastrowid
        msg = "tạo mới"

    conn.commit()
    return True, f"{msg} (id={emp_id})"


# ══════════════════════════════════════════════════════════════════════════════
#  Đọc Google Sheet
# ══════════════════════════════════════════════════════════════════════════════
SHEET_HEADERS = [
    'code', 'name', 'department', 'position', 'shift',
    'email', 'phone', 'birth_date', 'daily_wage', 'photo_url',
]

def read_sheet_rows(sheet_id: str, service=None) -> list[dict]:
    """Đọc tất cả dòng từ Sheet, trả về list dict theo SHEET_HEADERS."""
    if service is None:
        # Public CSV fallback
        url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid=0"
        with urllib.request.urlopen(url, timeout=20) as resp:
            raw = resp.read().decode('utf-8-sig')
        import csv, io as _io
        reader = csv.reader(_io.StringIO(raw))
        rows = list(reader)
    else:
        result = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range='Employees!A:J',
            valueInputOption='USER_ENTERED',
        ).execute()
        rows = result.get('values', [])

    if not rows:
        return []

    # Bỏ dòng header (row[0] == 'code')
    data_rows = [r for r in rows if r and r[0] and r[0].strip().lower() != 'code']
    records = []
    for row in data_rows:
        rec = {}
        for i, header in enumerate(SHEET_HEADERS):
            rec[header] = row[i].strip() if i < len(row) else ''
        records.append(rec)
    return records


# ══════════════════════════════════════════════════════════════════════════════
#  Tạo template Sheet
# ══════════════════════════════════════════════════════════════════════════════
def create_template_sheet(sheet_id: str, service) -> None:
    """Điền header + 3 dòng mẫu vào Sheet."""
    body = {
        'values': [
            SHEET_HEADERS,
            [
                'MNV-001', 'Nguyễn Văn An', 'Kỹ thuật', 'Lập trình viên', 'Ca sáng',
                'an.nv@company.com', '0901000001', '1995-01-15', '300000',
                'https://drive.google.com/file/d/XXXXXXXX/view',
            ],
            [
                'MNV-002', 'Trần Thị Bình', 'Kinh doanh', 'Nhân viên KD', 'Ca chiều',
                'binh.tt@company.com', '0902000002', '1998-05-22', '280000',
                '',
            ],
            [
                'MNV-003', 'Lê Văn Cường', 'Nhân sự', 'Chuyên viên HCNS', 'Ca sáng',
                'cuong.lv@company.com', '0903000003', '1990-08-10', '320000',
                'https://drive.google.com/file/d/YYYYYYYY/view',
            ],
        ]
    }
    service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range='Employees!A1:J4',
        valueInputOption='USER_ENTERED',
        body=body,
    ).execute()
    print("[OK] Đã ghi template vào Sheet. Điền thêm dòng từ dòng 5 trở đi.")


# ══════════════════════════════════════════════════════════════════════════════
#  Đồng bộ chính
# ══════════════════════════════════════════════════════════════════════════════
def sync_sheet(sheet_id: str, dry_run: bool = False, verbose: bool = False) -> None:
    use_creds = os.path.isfile(CREDS_FILE)
    if use_creds:
        print(f"[INFO] Dùng Service Account: {CREDS_FILE}")
        drive_svc  = get_drive_service()
        sheets_svc = get_sheets_service()
        rows = read_sheet_rows(sheet_id, service=sheets_svc)
    else:
        print("[WARN] Không có google_credentials.json – dùng chế độ Public Link (sheet & ảnh phải để 'Anyone with the link')")
        rows = read_sheet_rows(sheet_id, service=None)
        drive_svc = None

    if not rows:
        print("[INFO] Sheet trống hoặc không có dòng dữ liệu.")
        return

    print(f"\n{'='*60}")
    print(f"  ĐỒNG BỘ GOOGLE SHEET → DATABASE")
    print(f"  Sheet: {sheet_id}")
    print(f"  Số dòng dữ liệu: {len(rows)}")
    print(f"  Chế độ: {'DRY-RUN (không lưu gì)' if dry_run else 'THỰC TẾ'}")
    print(f"{'='*60}\n")

    if verbose:
        print("─" * 60)
        for r in rows:
            print(f"  {r['code']:12s} | {r['name']}")
        print("─" * 60 + "\n")

    ok_count, fail_count = 0, 0
    results = []

    # Dùng 1 connection cho toàn bộ sync (tránh mở/đóng liên tục)
    if not dry_run:
        conn = get_db_conn()
    else:
        conn = None

    for i, rec in enumerate(rows, 1):
        code = rec.get('code', '').strip()
        name = rec.get('name', '').strip()
        photo_url = rec.get('photo_url', '').strip()

        status_icon = '⏭ '
        status_msg  = 'bỏ qua'
        emp_id = None

        # Tải ảnh & tính embedding
        embedding = None
        if photo_url:
            img_bytes = None
            if use_creds and drive_svc:
                file_id = extract_drive_file_id(photo_url)
                if file_id:
                    img_bytes = download_image_from_drive(drive_svc, file_id)
            else:
                img_bytes = download_image_public(photo_url)

            if img_bytes:
                embedding = compute_embedding_from_images_bytes([img_bytes], max_images=1)
                if embedding:
                    status_icon = '✓ '
                    status_msg = 'có face'
                else:
                    status_icon = '⚠ '
                    status_msg = 'ảnh lỗi / không nhận diện'
            else:
                status_icon = '⚠ '
                status_msg = 'không tải được ảnh'

        if dry_run:
            print(f"  {status_icon} #{i:4d} | {code:12s} | {name:30s} | {status_msg}")
            ok_count += 1
            continue

        ok, msg = upsert_employee(conn, rec, embedding)

        if ok:
            print(f"  ✓ #{i:4d} | {code:12s} | {name:30s} | {msg}")
            ok_count += 1
        else:
            print(f"  ✗ #{i:4d} | {code:12s} | {name:30s} | LỖI: {msg}")
            fail_count += 1

        results.append({'code': code, 'name': name, 'ok': ok, 'msg': msg})
        time.sleep(0.1)  # Tránh rate-limit

    if conn:
        conn.close()

    print(f"\n{'='*60}")
    print(f"  Kết quả: {ok_count} thành công | {fail_count} thất bại")
    print(f"{'='*60}")


def show_status(sheet_id: str) -> None:
    """So sánh số nhân viên trong Sheet vs DB."""
    use_creds = os.path.isfile(CREDS_FILE)
    if use_creds:
        sheets_svc = get_sheets_service()
        rows = read_sheet_rows(sheet_id, service=sheets_svc)
    else:
        rows = read_sheet_rows(sheet_id, service=None)

    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as cnt FROM employees WHERE status = 'active'")
    db_count = cur.fetchone()['cnt']
    conn.close()

    print(f"\n  Sheet:  {len(rows)} dòng dữ liệu")
    print(f"  DB:     {db_count} nhân viên active")
    print(f"  Chênh:  {len(rows) - db_count:+d} dòng")


# ══════════════════════════════════════════════════════════════════════════════
#  CLI entry-point
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Đồng bộ nhân sự từ Google Sheet → SQLite DB.')
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument('--sync', metavar='SHEET_ID',
                   help='Chạy đồng bộ từ Sheet')
    g.add_argument('--create-template', metavar='SHEET_ID',
                   help='Ghi template header + mẫu vào Sheet')
    g.add_argument('--status', metavar='SHEET_ID',
                   help='So sánh số dòng Sheet vs DB')
    parser.add_argument('--dry-run', action='store_true',
                        help='Xem trước kết quả, không lưu gì vào DB')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='In chi tiết từng dòng')
    args = parser.parse_args()

    if not HAS_GOOGLE_API:
        print("[WARN] Thiếu google-api-python-client. Cài đặt bằng:")
        print("       pip install google-api-python-client google-auth-httplib2")

    if args.sync:
        sync_sheet(args.sync, dry_run=args.dry_run, verbose=args.verbose)
    elif args.create_template:
        if not os.path.isfile(CREDS_FILE):
            raise SystemExit(f"Thiếu {CREDS_FILE}. Làm theo GCP_SETUP_GUIDE.md trước.")
        svc = get_sheets_service()
        create_template_sheet(args.create_template, svc)
    elif args.status:
        show_status(args.status)
