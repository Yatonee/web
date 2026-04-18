# Hướng dẫn thiết lập Google Cloud để đồng bộ nhân sự từ Google Sheet

## Tổng quan

Hệ thống sẽ dùng **Google Sheets API** để đọc dữ liệu nhân viên và **Google Drive API** để tải ảnh khuôn mặt từ Google Drive. Toàn bộ xác thực qua **Service Account** — không cần đăng nhập Google của ai.

---

## Bước 1: Tạo Google Cloud Project

1. Truy cập [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Đặt tên project, ví dụ: `trueface-hr-sync`
4. Click **Create**

---

## Bước 2: Bật Google Sheets API

1. Sau khi tạo project, vào **APIs & Services** → **Library**
2. Tìm **Google Sheets API**, click vào → **Enable**

---

## Bước 3: Bật Google Drive API

1. Vào lại **Library** → tìm **Google Drive API** → **Enable**

---

## Bước 4: Tạo Service Account

1. Vào **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → chọn **Service Account**
3. Điền tên, ví dụ: `trueface-sync`
4. **Role**: chọn **Project** → **Editor** (đủ quyền)
5. Click **Done**

---

## Bước 5: Tạo JSON Key cho Service Account

1. Vào **APIs & Services** → **Credentials**
2. Click vào Service Account vừa tạo
3. Chuyển tab **KEYS** → **Add Key** → **Create new key**
4. Chọn loại **JSON** → **Create**
5. File JSON sẽ tự động tải về → **Đổi tên** thành `google_credentials.json`
6. **Copy file `google_credentials.json` vào thư mục `web_admin/`** (cùng chỗ với `app.py`)

---

## Bước 6: Chia sẻ Google Sheet cho Service Account

1. Mở Google Sheet template (hoặc Sheet hiện có của bạn)
2. Click **Share** → **Share**
3. Ở ô "Add people and groups", paste **email của Service Account**
   - Email có dạng: `trueface-sync@<project-id>.iam.gserviceaccount.com`
   - (Copy từ file `google_credentials.json` → field `"client_email"`)
4. Chọn quyền **Editor**
5. Click **Done**

> **Quan trọng:** Nếu không chia sẻ Sheet cho Service Account thì API sẽ trả lỗi 403 Forbidden.

---

## Bước 7: Chia sẻ thư mục ảnh Google Drive

1. Tạo thư mục Google Drive chứa ảnh nhân viên
2. Click chuột phải vào thư mục → **Share** → **Share**
3. Thêm email Service Account (cùng email như trên)
4. Chọn quyền **Viewer**
5. Click **Done**

> **Lưu ý:** Cách link ảnh trong Sheet:
> - Dùng hàm `=IMAGE("https://drive.google.com/uc?export=view&id=<FILE_ID>")`
> - Hoặc dùng link chia sẻ: `https://drive.google.com/file/d/<FILE_ID>/view`
> - **Quan trọng:** Service Account cần có quyền truy cập folder/drive file

---

## Bước 8: Cài thư viện Python

```bash
cd d:\Train\Face_Recognition\New folder\web_admin
pip install google-api-python-client google-auth-httplib2
```

---

## Cấu trúc file sau khi setup

```
web_admin/
├── app.py
├── database.py
├── google_credentials.json    ← Service Account key (bạn tải về)
├── sync_google_sheet.py        ← Script đồng bộ (sẽ tạo)
└── static/
```

---

## Cách lấy Sheet ID

Mở Google Sheet trong trình duyệt, URL sẽ có dạng:

```
https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
```

Copy phần `SHEET_ID_HERE` (chuỗi dài 44 ký tự giữa `/d/` và `/edit`).

---

## Cấu trúc Google Sheet template

Template sẽ có **1 sheet** tên `Employees` với các cột:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| code | name | department | position | shift | email | phone | birth_date | daily_wage | photo_url |
| MNV-001 | Nguyễn Văn A | Kỹ thuật | Lập trình viên | Ca sáng | a@company.com | 0901xxx | 1995-01-15 | 300000 | https://drive.google.com/... |
| MNV-002 | Trần Thị B | Kinh doanh | Nhân viên KD | Ca chiều | b@company.com | 0902xxx | 1998-03-20 | 280000 | https://drive.google.com/... |

Script tạo template: `python sync_google_sheet.py --create-template SHEET_ID`

---

## Chạy đồng bộ lần đầu

```bash
python sync_google_sheet.py --sync SHEET_ID
```

Script sẽ:
1. Đọc toàn bộ dòng trong Sheet (bỏ dòng header)
2. Với mỗi nhân viên: download ảnh từ Drive → tính embedding ArcFace
3. Tạo/cập nhật nhân viên trong SQLite
4. In ra bảng kết quả: thành công / lỗi từng dòng

---

## Cách bật "Anyone with link" thay vì Service Account

Nếu bạn không muốn dùng Service Account, có thể dùng cách đơn giản hơn:

1. **Sheet**: Share → "Anyone with the link" → Viewer
   - Dùng export CSV: `https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0`
   - Không cần API key, không cần Service Account

2. **Drive ảnh**: Share folder/file → "Anyone with the link"
   - Link dạng: `https://drive.google.com/uc?export=view&id=FILE_ID`
   - Không cần OAuth

Cách này đơn giản hơn nhưng kém bảo mật hơn. Bạn muốn dùng cách nào?
