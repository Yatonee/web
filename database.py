# -*- coding: utf-8 -*-
"""
Database – Khởi tạo kết nối SQLite và tạo bảng.
Chỉ chứa: DB_PATH, get_db(), init_db() và các hàm DB helper không phụ thuộc Flask.
Hỗ trợ multi-tenant: dùng get_database_path() từ config.
"""
import os
import sqlite3
from datetime import datetime
from werkzeug.security import generate_password_hash

# Import từ config để dùng chung logic multi-tenant
try:
    from config import get_database_path
    DB_PATH = get_database_path()
except ImportError:
    # Fallback nếu chạy độc lập (không qua app.py)
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    _db_path_env = os.environ.get('DATABASE_PATH', '').strip()
    if _db_path_env:
        DB_PATH = os.path.abspath(os.path.join(BASE_DIR, _db_path_env)) if not os.path.isabs(_db_path_env) else _db_path_env
    else:
        DB_PATH = os.path.join(BASE_DIR, 'data', 'attendance.db')

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Tạo/migrate tất cả các bảng SQLite. Gọi 1 lần khi khởi động app."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            department TEXT,
            department_id INTEGER REFERENCES departments(id),
            position_id INTEGER REFERENCES positions(id),
            shift_id INTEGER REFERENCES shifts(id),
            photo_filename TEXT,
            embedding TEXT,
            email TEXT,
            phone TEXT,
            birth_date TEXT,
            hire_date TEXT,
            daily_wage REAL NOT NULL DEFAULT 0,
            paid_leave_days_per_year INTEGER NOT NULL DEFAULT 12,
            salary_policy_id INTEGER,
            office_id INTEGER,
            employee_type_id INTEGER,
            allowed_checkin INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL
        )
    ''')
    try:
        conn.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_email ON employees(email) WHERE email IS NOT NULL AND email != ""')
        conn.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_phone ON employees(phone) WHERE phone IS NOT NULL AND phone != ""')
    except Exception:
        pass
    conn.execute('''
        CREATE TABLE IF NOT EXISTS employee_zones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            radius_meters REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees (id)
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS employee_offices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            office_id INTEGER NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE,
            UNIQUE(employee_id, office_id)
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            display_name TEXT,
            profile_birth_date TEXT,
            profile_department TEXT,
            profile_position_id INTEGER,
            profile_shift_id INTEGER,
            profile_employee_code TEXT,
            employee_id INTEGER REFERENCES employees(id),
            created_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            check_type TEXT NOT NULL,
            check_at TEXT NOT NULL,
            image_path TEXT,
            latitude REAL,
            longitude REAL,
            reason TEXT,
            status TEXT NOT NULL DEFAULT 'approved',
            created_at TEXT NOT NULL,
            shift_id INTEGER REFERENCES shifts(id),
            FOREIGN KEY (employee_id) REFERENCES employees (id)
        )
    ''')
    try:
        conn.execute("ALTER TABLE attendance ADD COLUMN reason TEXT")
    except Exception:
        pass
    # Indexes for attendance (performance optimization)
    conn.execute('CREATE INDEX IF NOT EXISTS idx_att_employee_id ON attendance(employee_id)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_att_check_at ON attendance(check_at)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_att_emp_check ON attendance(employee_id, check_at)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_att_type_status ON attendance(check_type, status)')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            base_salary REAL NOT NULL DEFAULT 0,
            allowance REAL NOT NULL DEFAULT 0,
            standard_hours REAL NOT NULL DEFAULT 8,
            hourly_rate REAL NOT NULL DEFAULT 0,
            overtime_multiplier REAL NOT NULL DEFAULT 1.5,
            created_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL,
            base_salary REAL NOT NULL DEFAULT 0,
            hourly_rate REAL NOT NULL DEFAULT 0,
            overtime_multiplier REAL NOT NULL DEFAULT 1.5
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS leave_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            from_date TEXT NOT NULL,
            to_date TEXT NOT NULL,
            leave_type TEXT NOT NULL,
            reason TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            reviewed_at TEXT,
            reviewed_by TEXT,
            review_note TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees (id)
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            sender_type TEXT NOT NULL,
            sender_username TEXT NOT NULL,
            message TEXT NOT NULL,
            attachment_name TEXT,
            attachment_url TEXT,
            attachment_type TEXT,
            attachment_size INTEGER,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )
    ''')
    cur = conn.execute("PRAGMA table_info(chat_messages)")
    chat_cols = [row[1] for row in cur.fetchall()]
    if 'attachment_name' not in chat_cols:
        conn.execute('ALTER TABLE chat_messages ADD COLUMN attachment_name TEXT')
    if 'attachment_url' not in chat_cols:
        conn.execute('ALTER TABLE chat_messages ADD COLUMN attachment_url TEXT')
    if 'attachment_type' not in chat_cols:
        conn.execute('ALTER TABLE chat_messages ADD COLUMN attachment_type TEXT')
    if 'attachment_size' not in chat_cols:
        conn.execute('ALTER TABLE chat_messages ADD COLUMN attachment_size INTEGER')
    if 'room_id' not in chat_cols:
        conn.execute('ALTER TABLE chat_messages ADD COLUMN room_id TEXT')
    if 'sender_employee_id' not in chat_cols:
        conn.execute('ALTER TABLE chat_messages ADD COLUMN sender_employee_id INTEGER')
    cur = conn.execute("PRAGMA table_info(positions)")
    pos_cols = [row[1] for row in cur.fetchall()]
    if 'base_salary' not in pos_cols:
        conn.execute('ALTER TABLE positions ADD COLUMN base_salary REAL NOT NULL DEFAULT 0')
    if 'allowance' not in pos_cols:
        conn.execute('ALTER TABLE positions ADD COLUMN allowance REAL NOT NULL DEFAULT 0')
    if 'standard_hours' not in pos_cols:
        conn.execute('ALTER TABLE positions ADD COLUMN standard_hours REAL NOT NULL DEFAULT 8')
    if 'hourly_rate' not in pos_cols:
        conn.execute('ALTER TABLE positions ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0')
    if 'overtime_multiplier' not in pos_cols:
        conn.execute('ALTER TABLE positions ADD COLUMN overtime_multiplier REAL NOT NULL DEFAULT 1.5')

    cur = conn.execute("PRAGMA table_info(leave_requests)")
    lr_cols = [row[1] for row in cur.fetchall()]
    if 'review_note' not in lr_cols:
        conn.execute('ALTER TABLE leave_requests ADD COLUMN review_note TEXT')
    cur = conn.execute("PRAGMA table_info(employees)")
    cols = [row[1] for row in cur.fetchall()]
    if 'position_id' not in cols:
        conn.execute('ALTER TABLE employees ADD COLUMN position_id INTEGER')
    if 'shift_id' not in cols:
        conn.execute('ALTER TABLE employees ADD COLUMN shift_id INTEGER')
    if 'paid_leave_days_per_year' not in cols:
        conn.execute('ALTER TABLE employees ADD COLUMN paid_leave_days_per_year INTEGER NOT NULL DEFAULT 12')
    if 'embedding' not in cols:
        conn.execute('ALTER TABLE employees ADD COLUMN embedding TEXT')
    if 'daily_wage' not in cols:
        conn.execute('ALTER TABLE employees ADD COLUMN daily_wage REAL NOT NULL DEFAULT 0')
    if 'status' not in cols:
        conn.execute("ALTER TABLE employees ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
    if 'email' not in cols:
        conn.execute('ALTER TABLE employees ADD COLUMN email TEXT')
    if 'phone' not in cols:
        conn.execute('ALTER TABLE employees ADD COLUMN phone TEXT')
    if 'birth_date' not in cols:
        conn.execute('ALTER TABLE employees ADD COLUMN birth_date TEXT')
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS employee_offices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                office_id INTEGER NOT NULL,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE,
                UNIQUE(employee_id, office_id)
            )
        ''')
    except Exception:
        pass
    cur = conn.execute("PRAGMA table_info(users)")
    user_cols = [row[1] for row in cur.fetchall()]
    if 'employee_id' not in user_cols:
        conn.execute('ALTER TABLE users ADD COLUMN employee_id INTEGER REFERENCES employees(id)')
    if 'email' not in user_cols:
        conn.execute('ALTER TABLE users ADD COLUMN email TEXT')
    if 'phone' not in user_cols:
        conn.execute('ALTER TABLE users ADD COLUMN phone TEXT')
    for _u_col, _u_ddl in (
        ('display_name', 'ALTER TABLE users ADD COLUMN display_name TEXT'),
        ('profile_birth_date', 'ALTER TABLE users ADD COLUMN profile_birth_date TEXT'),
        ('profile_department', 'ALTER TABLE users ADD COLUMN profile_department TEXT'),
        ('profile_position_id', 'ALTER TABLE users ADD COLUMN profile_position_id INTEGER'),
        ('profile_shift_id', 'ALTER TABLE users ADD COLUMN profile_shift_id INTEGER'),
        ('profile_employee_code', 'ALTER TABLE users ADD COLUMN profile_employee_code TEXT'),
    ):
        cur = conn.execute('PRAGMA table_info(users)')
        if _u_col not in [r[1] for r in cur.fetchall()]:
            conn.execute(_u_ddl)

    cur = conn.execute("PRAGMA table_info(shifts)")
    shift_cols = [row[1] for row in cur.fetchall()]
    if 'base_salary' not in shift_cols:
        conn.execute('ALTER TABLE shifts ADD COLUMN base_salary REAL NOT NULL DEFAULT 0')
    if 'hourly_rate' not in shift_cols:
        conn.execute('ALTER TABLE shifts ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0')
    if 'overtime_multiplier' not in shift_cols:
        conn.execute('ALTER TABLE shifts ADD COLUMN overtime_multiplier REAL NOT NULL DEFAULT 1.5')
    cur = conn.execute("PRAGMA table_info(attendance)")
    att_cols = [row[1] for row in cur.fetchall()]
    if 'shift_id' not in att_cols:
        conn.execute('ALTER TABLE attendance ADD COLUMN shift_id INTEGER REFERENCES shifts(id)')
    if 'status' not in att_cols:
        conn.execute("ALTER TABLE attendance ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'")

    cur = conn.execute("PRAGMA table_info(employees)")
    emp_dept_cols = [row[1] for row in cur.fetchall()]
    if 'department_id' not in emp_dept_cols:
        conn.execute('ALTER TABLE employees ADD COLUMN department_id INTEGER REFERENCES departments(id)')
    try:
        cur = conn.execute(
            "SELECT DISTINCT TRIM(department) AS dn FROM employees WHERE department IS NOT NULL AND TRIM(department) != ''"
        )
        _now_dep = datetime.utcnow().isoformat() + 'Z'
        for _row in cur.fetchall():
            _dn = (_row['dn'] or '').strip()
            if not _dn:
                continue
            conn.execute(
                'INSERT OR IGNORE INTO departments (name, description, created_at) VALUES (?, NULL, ?)',
                (_dn, _now_dep),
            )
        conn.execute(
            '''UPDATE employees SET department_id = (
                   SELECT id FROM departments WHERE departments.name = employees.department
               )
               WHERE department IS NOT NULL AND TRIM(department) != ''
               AND department_id IS NULL'''
        )
    except Exception:
        pass

    conn.execute('''
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            otp TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    ''')
    cur = conn.execute("PRAGMA table_info(password_resets)")
    pr_cols = [row[1] for row in cur.fetchall()]
    if 'channel' not in pr_cols:
        conn.execute("ALTER TABLE password_resets ADD COLUMN channel TEXT NOT NULL DEFAULT 'email'")

    # ── Offices (Văn phòng/Chi nhánh) ─────────────────────────────────────────
    conn.execute('''
        CREATE TABLE IF NOT EXISTS offices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT,
            address TEXT,
            description TEXT,
            latitude REAL,
            longitude REAL,
            radius_meters REAL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    cur = conn.execute("PRAGMA table_info(offices)")
    office_cols = [row[1] for row in cur.fetchall()]
    if 'code' not in office_cols:
        conn.execute('ALTER TABLE offices ADD COLUMN code TEXT')
    if 'address' not in office_cols:
        conn.execute('ALTER TABLE offices ADD COLUMN address TEXT')
    if 'is_active' not in office_cols:
        conn.execute('ALTER TABLE offices ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')
    if 'latitude' not in office_cols:
        conn.execute('ALTER TABLE offices ADD COLUMN latitude REAL')
    if 'longitude' not in office_cols:
        conn.execute('ALTER TABLE offices ADD COLUMN longitude REAL')
    if 'radius_meters' not in office_cols:
        conn.execute('ALTER TABLE offices ADD COLUMN radius_meters REAL')

    # ── Employee Types (Loại nhân viên: Full-time, Part-time...) ────────────────
    conn.execute('''
        CREATE TABLE IF NOT EXISTS employee_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT,
            description TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    cur = conn.execute("PRAGMA table_info(employee_types)")
    et_cols = [row[1] for row in cur.fetchall()]
    if 'code' not in et_cols:
        conn.execute('ALTER TABLE employee_types ADD COLUMN code TEXT')
    if 'is_active' not in et_cols:
        conn.execute('ALTER TABLE employee_types ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')

    # ── Salary Policies (Chính sách lương) ────────────────────────────────────
    conn.execute('''
        CREATE TABLE IF NOT EXISTS salary_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT,
            description TEXT,
            pay_frequency TEXT NOT NULL DEFAULT 'monthly',
            standard_work_days REAL NOT NULL DEFAULT 26,
            standard_hours_per_day REAL NOT NULL DEFAULT 8,
            overtime_multiplier REAL NOT NULL DEFAULT 1.5,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    cur = conn.execute("PRAGMA table_info(salary_policies)")
    sp_cols = [row[1] for row in cur.fetchall()]
    for _sp_col, _sp_ddl in (
        ('code', 'ALTER TABLE salary_policies ADD COLUMN code TEXT'),
        ('pay_frequency', "ALTER TABLE salary_policies ADD COLUMN pay_frequency TEXT NOT NULL DEFAULT 'monthly'"),
        ('standard_work_days', 'ALTER TABLE salary_policies ADD COLUMN standard_work_days REAL NOT NULL DEFAULT 26'),
        ('standard_hours_per_day', 'ALTER TABLE salary_policies ADD COLUMN standard_hours_per_day REAL NOT NULL DEFAULT 8'),
        ('overtime_multiplier', 'ALTER TABLE salary_policies ADD COLUMN overtime_multiplier REAL NOT NULL DEFAULT 1.5'),
        ('is_active', 'ALTER TABLE salary_policies ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1'),
    ):
        cur = conn.execute('PRAGMA table_info(salary_policies)')
        sp_cols = [r[1] for r in cur.fetchall()]
        if _sp_col not in sp_cols:
            conn.execute(_sp_ddl)

    # Thêm employee_type_id và salary_policy_id vào bảng employees
    cur = conn.execute("PRAGMA table_info(employees)")
    emp_cols = [row[1] for row in cur.fetchall()]
    if 'employee_type_id' not in emp_cols:
        conn.execute('ALTER TABLE employees ADD COLUMN employee_type_id INTEGER REFERENCES employee_types(id)')
    if 'salary_policy_id' not in emp_cols:
        conn.execute('ALTER TABLE employees ADD COLUMN salary_policy_id INTEGER REFERENCES salary_policies(id)')

    # ── Work Areas (Khu vực làm việc) ──────────────────────────────────────────
    # Khu vực làm việc tương ứng với departments trong HRM
    conn.execute('''
        CREATE TABLE IF NOT EXISTS work_areas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT,
            description TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    cur = conn.execute("PRAGMA table_info(work_areas)")
    wa_cols = [row[1] for row in cur.fetchall()]
    if 'code' not in wa_cols:
        conn.execute('ALTER TABLE work_areas ADD COLUMN code TEXT')
    if 'is_active' not in wa_cols:
        conn.execute('ALTER TABLE work_areas ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')

    # Thêm work_area_id vào employees
    cur = conn.execute("PRAGMA table_info(employees)")
    emp_wa_cols = [row[1] for row in cur.fetchall()]
    if 'work_area_id' not in emp_wa_cols:
        conn.execute('ALTER TABLE employees ADD COLUMN work_area_id INTEGER REFERENCES work_areas(id)')

    # ── Position Types (Loại chức vụ: Director, Manager, Staff...) ───────────────
    conn.execute('''
        CREATE TABLE IF NOT EXISTS position_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT,
            description TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    cur = conn.execute("PRAGMA table_info(position_types)")
    pt_cols = [row[1] for row in cur.fetchall()]
    if 'code' not in pt_cols:
        conn.execute('ALTER TABLE position_types ADD COLUMN code TEXT')
    if 'is_active' not in pt_cols:
        conn.execute('ALTER TABLE position_types ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')

    # Thêm position_type_id vào positions
    cur = conn.execute("PRAGMA table_info(positions)")
    pos_pt_cols = [row[1] for row in cur.fetchall()]
    if 'position_type_id' not in pos_pt_cols:
        conn.execute('ALTER TABLE positions ADD COLUMN position_type_id INTEGER REFERENCES position_types(id)')

    # ── Timesheets (Bảng chấm công) ────────────────────────────────────────────
    # Timesheet định nghĩa lịch làm việc: ca sáng, ca chiều, giờ nghỉ trưa...
    conn.execute('''
        CREATE TABLE IF NOT EXISTS timesheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT,
            description TEXT,
            work_type TEXT NOT NULL DEFAULT 'single',  -- single: 1 ca, double: 2 ca (sáng+chiều)
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    cur = conn.execute("PRAGMA table_info(timesheets)")
    ts_cols = [row[1] for row in cur.fetchall()]
    if 'code' not in ts_cols:
        conn.execute('ALTER TABLE timesheets ADD COLUMN code TEXT')
    if 'description' not in ts_cols:
        conn.execute('ALTER TABLE timesheets ADD COLUMN description TEXT')
    if 'work_type' not in ts_cols:
        conn.execute("ALTER TABLE timesheets ADD COLUMN work_type TEXT NOT NULL DEFAULT 'single'")
    if 'is_active' not in ts_cols:
        conn.execute('ALTER TABLE timesheets ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1')

    # ── Timesheet Details (Chi tiết bảng chấm công) ────────────────────────────
    # Mỗi timesheet có thể có nhiều shift entries (ca sáng, ca chiều)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS timesheet_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timesheet_id INTEGER NOT NULL,
            shift_name TEXT NOT NULL,        -- Tên ca: "Ca sáng", "Ca chiều"
            day_of_week TEXT NOT NULL,       -- Thứ trong tuần: mon, tue, wed, thu, fri, sat, sun
            is_working_day INTEGER NOT NULL DEFAULT 1,  -- 1: làm việc, 0: nghỉ
            check_in_start TEXT,             -- Giờ bắt đầu cho phép checkin
            check_in_end TEXT,               -- Giờ kết thúc cho phép checkin
            check_out_start TEXT,            -- Giờ bắt đầu cho phép checkout
            check_out_end TEXT,              -- Giờ kết thúc cho phép checkout
            shift_order INTEGER NOT NULL DEFAULT 1,  -- Thứ tự ca (1, 2)
            work_hours REAL NOT NULL DEFAULT 8,       -- Số giờ làm việc trong ca
            is_day_off INTEGER NOT NULL DEFAULT 0,    -- 1: ngày nghỉ cố định
            created_at TEXT NOT NULL,
            FOREIGN KEY (timesheet_id) REFERENCES timesheets(id) ON DELETE CASCADE
        )
    ''')
    cur = conn.execute("PRAGMA table_info(timesheet_details)")
    td_cols = [row[1] for row in cur.fetchall()]
    if 'shift_name' not in td_cols:
        conn.execute('ALTER TABLE timesheet_details ADD COLUMN shift_name TEXT')
    if 'is_day_off' not in td_cols:
        conn.execute('ALTER TABLE timesheet_details ADD COLUMN is_day_off INTEGER NOT NULL DEFAULT 0')
    if 'work_hours' not in td_cols:
        conn.execute('ALTER TABLE timesheet_details ADD COLUMN work_hours REAL NOT NULL DEFAULT 8')

    # Thêm timesheet_id vào employees
    cur = conn.execute("PRAGMA table_info(employees)")
    emp_ts_cols = [row[1] for row in cur.fetchall()]
    if 'timesheet_id' not in emp_ts_cols:
        conn.execute('ALTER TABLE employees ADD COLUMN timesheet_id INTEGER REFERENCES timesheets(id)')

    # Tạo tài khoản admin mặc định nếu chưa có
    cur = conn.execute('SELECT COUNT(*) FROM users')
    if cur.fetchone()[0] == 0:
        import os as _os
        _initial_pw = _os.environ.get('INITIAL_ADMIN_PASSWORD', 'admin')
        default_hash = generate_password_hash(_initial_pw, method='pbkdf2:sha256')
        conn.execute(
            'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
            ('admin', default_hash, datetime.utcnow().isoformat() + 'Z')
        )

    # ── Admin Users (Quản lý nhiều tài khoản admin) ────────────────────────────
    conn.execute('''
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            email TEXT,
            phone TEXT,
            role TEXT NOT NULL DEFAULT 'admin',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')
    cur = conn.execute("PRAGMA table_info(admin_users)")
    admin_cols = [row[1] for row in cur.fetchall()]
    if 'role' not in admin_cols:
        conn.execute("ALTER TABLE admin_users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'")
    if 'is_active' not in admin_cols:
        conn.execute("ALTER TABLE admin_users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")

    # Tạo admin mặc định nếu bảng rỗng
    cur = conn.execute('SELECT COUNT(*) FROM admin_users')
    if cur.fetchone()[0] == 0:
        import os as _os
        _initial_pw = _os.environ.get('INITIAL_ADMIN_PASSWORD', 'admin')
        default_hash = generate_password_hash(_initial_pw, method='pbkdf2:sha256')
        conn.execute(
            'INSERT INTO admin_users (username, password_hash, display_name, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            ('admin', default_hash, 'Quản trị viên', 'superadmin', 1, datetime.utcnow().isoformat() + 'Z')
        )

    conn.commit()
    conn.close()
