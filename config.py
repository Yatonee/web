# -*- coding: utf-8 -*-
"""
Cấu hình cho Web Admin.
Đọc từ biến môi trường, có giá trị mặc định nếu không có.
Hỗ trợ multi-tenant: mỗi tenant có thư mục riêng chỉ định qua TENANT_DIR.
"""
import os


def _get_tenant_base():
    """Lấy thư mục gốc của tenant hiện tại."""
    # TENANT_DIR được set trong .env của tenant
    tenant_dir = os.environ.get('TENANT_DIR', '').strip()
    if tenant_dir:
        return os.path.abspath(tenant_dir)
    # Mặc định: dùng thư mục hiện tại (chế độ single-tenant / dev)
    return os.path.dirname(os.path.abspath(__file__))


# ─── Tenant ───────────────────────────────────────────────────────────────────
TENANT_BASE = _get_tenant_base()
TENANT_ID = os.environ.get('TENANT_ID', 'default')


# ─── Flask ────────────────────────────────────────────────────────────────────
_DEFAULT_SECRET = 'dev-secret-change-in-production'
SECRET_KEY = os.environ.get('SECRET_KEY', _DEFAULT_SECRET)
if SECRET_KEY == _DEFAULT_SECRET:
    import warnings
    warnings.warn(
        "SECRET_KEY is using the insecure default value. "
        "Set SECRET_KEY environment variable in production!",
        RuntimeWarning
    )
# Production mode: require explicit SECRET_KEY via env var
if os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENV') == 'production':
    if SECRET_KEY == _DEFAULT_SECRET:
        raise RuntimeError(
            'SECRET_KEY must be set via SECRET_KEY environment variable in production. '
            'Generate with: python -c "import secrets; print(secrets.token_hex(32))"'
        )
MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH_MB', 8)) * 1024 * 1024


# ─── JWT ─────────────────────────────────────────────────────────────────────
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRY_HOURS = int(os.environ.get('JWT_EXPIRY_HOURS', str(24 * 7)))


# ─── Upload ──────────────────────────────────────────────────────────────────
def get_upload_folder():
    """Thư mục uploads cho tenant hiện tại."""
    custom = os.environ.get('UPLOAD_FOLDER', '').strip()
    if custom:
        if os.path.isabs(custom):
            return custom
        return os.path.join(TENANT_BASE, custom)
    return os.path.join(TENANT_BASE, 'uploads')


def get_chat_upload_folder():
    """Thư mục uploads/chat cho tenant hiện tại."""
    return os.path.join(get_upload_folder(), 'chat')


def get_faces_upload_folder():
    """Thư mục uploads/faces cho tenant hiện tại."""
    return os.path.join(get_upload_folder(), 'faces')


# ─── Database ─────────────────────────────────────────────────────────────────
def get_database_path():
    """Đường dẫn database cho tenant hiện tại."""
    custom = os.environ.get('DATABASE_PATH', '').strip()
    if custom:
        if os.path.isabs(custom):
            return custom
        return os.path.join(TENANT_BASE, custom)
    return os.path.join(TENANT_BASE, 'data', 'attendance.db')


# ─── Model Face ───────────────────────────────────────────────────────────────
def get_arcface_model_path():
    """Đường dẫn model ArcFace. Ưu tiên: env > relative > absolute parent."""
    custom = os.environ.get('ARCFACE_MODEL_PATH', '').strip()
    if custom:
        return custom
    # Thử trong thư mục hiện tại
    local = os.path.join(TENANT_BASE, 'saved_model', 'arcface_embedding.h5')
    if os.path.exists(local):
        return local
    # Thử ở thư mục cha (single-tenant mode)
    parent = os.path.join(os.path.dirname(os.path.dirname(TENANT_BASE)), 'saved_model', 'arcface_embedding.h5')
    return parent


# ─── Assets ───────────────────────────────────────────────────────────────────
def get_assets_folder():
    """Thư mục assets (model TFLite, logo)."""
    custom = os.environ.get('ASSETS_FOLDER', '').strip()
    if custom:
        if os.path.isabs(custom):
            return custom
        return os.path.join(TENANT_BASE, custom)
    # Thử ở thư mục cha (single-tenant mode)
    return os.path.join(os.path.dirname(os.path.dirname(TENANT_BASE)), 'app', 'assets')


# ─── Face Recognition ─────────────────────────────────────────────────────────
FACE_RESET_MIN_SIMILARITY = float(os.environ.get('FACE_RESET_MIN_SIMILARITY', '0.42'))


# ─── OTP / Password Reset ─────────────────────────────────────────────────────
PASSWORD_RESET_OTP_MINUTES = max(1, int(os.environ.get('PASSWORD_RESET_OTP_MINUTES', '3')))


# ─── App Settings ─────────────────────────────────────────────────────────────
COMPANY_NAME = os.environ.get('COMPANY_NAME', 'Công ty TNHH TrueFace')
ATTENDANCE_RADIUS = int(os.environ.get('ATTENDANCE_RADIUS', '500'))
LATE_THRESHOLD = int(os.environ.get('LATE_THRESHOLD', '15'))
LANGUAGE = os.environ.get('LANGUAGE', 'vi')


# ─── Server ───────────────────────────────────────────────────────────────────
DEFAULT_PORT = int(os.environ.get('PORT', 3000))


# ─── Google Maps API ─────────────────────────────────────────────────────────
GOOGLE_PLACES_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY', '')
