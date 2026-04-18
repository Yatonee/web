# -*- coding: utf-8 -*-
"""
Tạo tenant mới cho khách hàng.
Chạy: python create_tenant.py --name "Công ty ABC" --admin-password "Matkhau123"

Mỗi tenant có cấu trúc riêng:
    tenants/<tenant_id>/
    ├── data/
    │   └── attendance.db
    ├── uploads/
    │   ├── faces/
    │   └── chat/
    └── .env
"""
import os
import sys
import argparse
import secrets
import sqlite3
from datetime import datetime
from werkzeug.security import generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TENANTS_DIR = os.path.join(BASE_DIR, 'tenants')


def slugify(name: str) -> str:
    """Tạo slug từ tên công ty."""
    import re
    name = name.lower().strip()
    name = re.sub(r'[àáạảãâầấậẩẫăằắặẳẫ]', 'a', name)
    name = re.sub(r'[èéẹẻẽêềếệểễ]', 'e', name)
    name = re.sub(r'[ìíịỉĩ]', 'i', name)
    name = re.sub(r'[òóọỏõôồốộổỗơờớợởỡ]', 'o', name)
    name = re.sub(r'[ùúụủũưừứựửữ]', 'u', name)
    name = re.sub(r'[ỳýỵỷỹ]', 'y', name)
    name = re.sub(r'[đ]', 'd', name)
    name = re.sub(r'[^a-z0-9]+', '-', name)
    name = re.sub(r'^-|-$', '', name)
    return name


def random_suffix(length: int = 4) -> str:
    """Tạo chuỗi ngẫu nhiên cho tenant ID duy nhất."""
    return secrets.token_hex(length)[:length * 2]


def create_tenant(name: str, admin_password: str = None, admin_email: str = None):
    """Tạo tenant mới."""
    # Tạo tenant ID duy nhất
    base_slug = slugify(name)
    suffix = random_suffix(4)
    tenant_id = f"{base_slug}-{suffix}"
    
    tenant_dir = os.path.join(TENANTS_DIR, tenant_id)
    
    if os.path.exists(tenant_dir):
        print(f"[ERROR] Tenant '{tenant_id}' đã tồn tại!")
        return None
    
    # Tạo cấu trúc thư mục
    print(f"[INFO] Tạo cấu trúc thư mục cho tenant: {tenant_id}")
    os.makedirs(os.path.join(tenant_dir, 'data'), exist_ok=True)
    os.makedirs(os.path.join(tenant_dir, 'uploads', 'faces'), exist_ok=True)
    os.makedirs(os.path.join(tenant_dir, 'uploads', 'chat'), exist_ok=True)
    
    # Tạo database
    db_path = os.path.join(tenant_dir, 'data', 'attendance.db')
    create_database(db_path, admin_password or f"{name}@{random_suffix(4)}", admin_email)
    
    # Tạo .env
    create_env(os.path.join(tenant_dir, '.env'), tenant_id, name)
    
    # Tạo Dockerfile đơn giản
    create_dockerfile(tenant_dir, tenant_id)
    
    # Tạo docker-compose
    create_docker_compose(tenant_dir, tenant_id, name)
    
    print(f"\n✅ Đã tạo tenant thành công!")
    print(f"📁 Thư mục: {tenant_dir}")
    print(f"🆔 Tenant ID: {tenant_id}")
    print(f"\n📋 Để chạy tenant:")
    print(f"   cd {tenant_dir}")
    print(f"   docker-compose up -d")
    print(f"\n🌐 Truy cập: http://localhost:PORT (PORT xem trong docker-compose.yml)")
    
    return tenant_id


def create_database(db_path: str, admin_password: str, admin_email: str = None):
    """Tạo database và bảng cho tenant."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Bảng employees (đồng bộ với database.py)
    cursor.execute('''
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
            daily_wage REAL DEFAULT 0,
            paid_leave_days_per_year INTEGER DEFAULT 12,
            salary_policy_id INTEGER,
            office_id INTEGER,
            employee_type_id INTEGER,
            allowed_checkin INTEGER NOT NULL DEFAULT 1,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL
        )
    ''')
    
    # Bảng attendance (đồng bộ với database.py)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            check_type TEXT NOT NULL,
            check_at TEXT NOT NULL,
            image_path TEXT,
            latitude REAL,
            longitude REAL,
            location_name TEXT,
            status TEXT DEFAULT 'approved',
            reason TEXT,
            created_at TEXT NOT NULL,
            shift_id INTEGER REFERENCES shifts(id),
            FOREIGN KEY (employee_id) REFERENCES employees (id)
        )
    ''')
    # Indexes for attendance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_att_employee_id ON attendance(employee_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_att_check_at ON attendance(check_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_att_emp_check ON attendance(employee_id, check_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_att_type_status ON attendance(check_type, status)')
    
    # Bảng users (đồng bộ với database.py)
    cursor.execute('''
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
    
    # Bảng admin_users
    cursor.execute('''
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
    
    # Tạo admin mặc định
    default_hash = generate_password_hash(admin_password, method='pbkdf2:sha256')
    cursor.execute(
        '''INSERT INTO admin_users (username, password_hash, display_name, email, role, is_active, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        ('admin', default_hash, 'Quản trị viên', admin_email, 'superadmin', 1, datetime.utcnow().isoformat() + 'Z')
    )
    
    # Bảng leave_requests
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS leave_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            leave_type TEXT NOT NULL,
            from_date TEXT NOT NULL,
            to_date NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            reviewed_at TEXT,
            reviewed_by TEXT,
            review_note TEXT,
            FOREIGN KEY (employee_id) REFERENCES employees (id)
        )
    ''')
    
    # Bảng departments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Bảng positions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            department_id INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (department_id) REFERENCES departments (id)
        )
    ''')
    
    # Bảng shifts
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Bảng timesheets
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timesheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Bảng timesheet_details
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timesheet_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timesheet_id INTEGER NOT NULL,
            shift_name TEXT,
            day_of_week INTEGER,
            is_working_day INTEGER,
            check_in_start TEXT,
            check_in_end TEXT,
            check_out_start TEXT,
            check_out_end TEXT,
            shift_order INTEGER,
            work_hours REAL,
            is_day_off INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (timesheet_id) REFERENCES timesheets (id)
        )
    ''')
    
    # Bảng employee_shifts
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employee_shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            timesheet_id INTEGER NOT NULL,
            effective_from TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees (id),
            FOREIGN KEY (timesheet_id) REFERENCES timesheets (id)
        )
    ''')
    
    # Bảng chat_messages
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            sender_type TEXT NOT NULL,
            message TEXT,
            attachment_url TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees (id)
        )
    ''')
    
    # Bảng settings
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"[INFO] Đã tạo database: {db_path}")


def create_env(env_path: str, tenant_id: str, company_name: str):
    """Tạo file .env cho tenant."""
    env_content = f'''# Tenant: {company_name}
# ID: {tenant_id}
# Tự động tạo - KHÔNG SỬA TAY

# Database
DATABASE_PATH=data/attendance.db

# Flask
SECRET_KEY={secrets.token_hex(32)}
PORT=3000

# Cấu hình công ty
COMPANY_NAME={company_name}
ATTENDANCE_RADIUS=500
LATE_THRESHOLD=15
LANGUAGE=vi

# Face Recognition
FACE_RESET_MIN_SIMILARITY=0.42

# Upload
UPLOAD_FOLDER=uploads

# Google Maps (tùy chọn)
# GOOGLE_PLACES_API_KEY=

# SMTP Email (tùy chọn)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASSWORD=
# SMTP_FROM=

# Twilio SMS (tùy chọn)
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_PHONE_NUMBER=
'''
    
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
    
    print(f"[INFO] Đã tạo .env: {env_path}")


def create_dockerfile(tenant_dir: str, tenant_id: str):
    """Tạo Dockerfile cho tenant."""
    dockerfile_content = '''FROM python:3.11-slim

WORKDIR /app

# Cài đặt dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code admin (dùng chung)
COPY ../app.py .
COPY ../database.py .
COPY ../config.py .

# Copy model face (dùng chung)
COPY ../saved_model/ ../saved_model/
COPY ../app/assets/ ../assets/

EXPOSE 3000

CMD ["python", "app.py"]
'''
    
    dockerfile_path = os.path.join(tenant_dir, 'Dockerfile')
    with open(dockerfile_path, 'w', encoding='utf-8') as f:
        f.write(dockerfile_content)
    
    print(f"[INFO] Đã tạo Dockerfile: {dockerfile_path}")


def create_docker_compose(tenant_dir: str, tenant_id: str, company_name: str):
    """Tạo docker-compose.yml cho tenant."""
    # Tính port ngẫu nhiên từ 3001-3999
    import hashlib
    port = 3001 + (int(hashlib.md5(tenant_id.encode()).hexdigest(), 16) % 999)
    
    compose_content = f'''version: '3.8'

services:
  admin:
    build: .
    container_name: trueface-{tenant_id}
    restart: unless-stopped
    ports:
      - "{port}:3000"
    volumes:
      - ./uploads:/app/uploads
      - ./data:/app/data
      - ../saved_model:/app/saved_model:ro
      - ../app/assets:/app/assets:ro
    env_file:
      - .env
    environment:
      - FLASK_ENV=production
'''
    
    compose_path = os.path.join(tenant_dir, 'docker-compose.yml')
    with open(compose_path, 'w', encoding='utf-8') as f:
        f.write(compose_content)
    
    print(f"[INFO] Đã tạo docker-compose.yml (PORT: {port}): {compose_path}")


def list_tenants():
    """Liệt kê tất cả tenants."""
    if not os.path.exists(TENANTS_DIR):
        print("Chưa có tenant nào.")
        return
    
    tenants = os.listdir(TENANTS_DIR)
    if not tenants:
        print("Chưa có tenant nào.")
        return
    
    print(f"\n📋 Danh sách tenants ({len(tenants)}):")
    print("-" * 60)
    
    for tenant_id in sorted(tenants):
        tenant_dir = os.path.join(TENANTS_DIR, tenant_id)
        if not os.path.isdir(tenant_dir):
            continue
        
        env_path = os.path.join(tenant_dir, '.env')
        company_name = tenant_id
        
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('COMPANY_NAME='):
                        company_name = line.split('=', 1)[1].strip()
                        break
        
        # Đếm nhân viên
        db_path = os.path.join(tenant_dir, 'data', 'attendance.db')
        emp_count = 0
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cur = conn.execute('SELECT COUNT(*) FROM employees')
                emp_count = cur.fetchone()[0]
                conn.close()
            except:
                pass
        
        print(f"  🏢 {company_name}")
        print(f"     ID: {tenant_id}")
        print(f"     Nhân viên: {emp_count}")
        print(f"     Path: {tenant_dir}")
        print()


def main():
    parser = argparse.ArgumentParser(description='Quản lý tenants cho TrueFace Admin')
    subparsers = parser.add_subparsers(dest='command', help='Lệnh')
    
    # Lệnh create
    create_parser = subparsers.add_parser('create', help='Tạo tenant mới')
    create_parser.add_argument('--name', '-n', required=True, help='Tên công ty')
    create_parser.add_argument('--admin-password', '-p', help='Mật khẩu admin (mặc định: tự tạo)')
    create_parser.add_argument('--admin-email', '-e', help='Email admin')
    
    # Lệnh list
    list_parser = subparsers.add_parser('list', help='Liệt kê tenants')
    
    # Lệnh delete
    delete_parser = subparsers.add_parser('delete', help='Xóa tenant')
    delete_parser.add_argument('--tenant-id', '-t', required=True, help='ID tenant cần xóa')
    delete_parser.add_argument('--force', '-f', action='store_true', help='Xóa không cần xác nhận')
    
    args = parser.parse_args()
    
    if args.command == 'create':
        create_tenant(args.name, args.admin_password, args.admin_email)
    elif args.command == 'list':
        list_tenants()
    elif args.command == 'delete':
        tenant_dir = os.path.join(TENANTS_DIR, args.tenant_id)
        if not os.path.exists(tenant_dir):
            print(f"[ERROR] Tenant '{args.tenant_id}' không tồn tại!")
            return
        
        if not args.force:
            confirm = input(f"Bạn có chắc muốn xóa tenant '{args.tenant_id}'? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Đã hủy.")
                return
        
        import shutil
        shutil.rmtree(tenant_dir)
        print(f"✅ Đã xóa tenant: {args.tenant_id}")
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
