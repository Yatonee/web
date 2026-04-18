/* ==========================================================================
   TrueFace Admin SPA – Vanilla JS
   ========================================================================== */

// ── API ────────────────────────────────────────────────────────────────────
const API = (() => {
  try {
    const q = new URLSearchParams(window.location.search)
    const apiQ = (q.get('api') || '').trim()
    const apiLS = safeGetItem('API_BASE', '')
    const api = apiQ || apiLS
    if (api) return api.replace(/\/$/, '')
  } catch (_) {}
  if (window.location.origin === 'null' || window.location.protocol === 'file:') return 'https://trueface.io.vn'
  return ''
})()

async function apiFetch(path, options = {}) {
  const token = safeGetItem('token')
  let body = options.body

  // Serialize object body to JSON (NOT FormData)
  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof ArrayBuffer) && !(body instanceof Blob)) {
    body = JSON.stringify(body)
  }

  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body instanceof FormData) {
    // FormData: browser sets Content-Type with boundary automatically
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers[k] = v
    }
  }

  const fetchOpts = {
    method: options.method || 'GET',
    headers,
  }
  if (body !== undefined && fetchOpts.method !== 'GET') {
    fetchOpts.body = body
  }

  const res = await fetch(API + path, fetchOpts)
  if (res.status === 401) {
    safeRemoveItem('token')
    window.location.href = '/login.html'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

const api = {
  get: path => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body }),
  postForm: (path, formData) => apiFetch(path, { method: 'POST', body: formData }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body }),
  delete: path => apiFetch(path, { method: 'DELETE' }),
}

// ── Config ────────────────────────────────────────────────────────────────────
// (Để dành cho mở rộng sau — hiện tại dùng OpenStreetMap không cần key)

// ── Excel helpers (SheetJS) ────────────────────────────────────────────────
/**
 * Xuất mảng 2 chiều (hàng đầu là header) ra file .xlsx và tải về.
 * @param {Array<Array>} aoa - mảng các dòng, dòng đầu là tiêu đề
 * @param {string} filename - tên file (kèm .xlsx)
 * @param {string} [sheetName='Sheet1']
 */
function exportToXlsx(aoa, filename, sheetName = 'Sheet1') {
  if (typeof XLSX === 'undefined') {
    alert('Không tải được thư viện Excel. Kiểm tra kết nối mạng và thử lại.')
    return
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  // Auto-width cho các cột dựa trên độ dài ký tự lớn nhất
  const colWidths = aoa[0].map((_, colIdx) => {
    const maxLen = aoa.reduce((max, row) => {
      const v = row[colIdx]
      const len = v == null ? 0 : String(v).length
      return Math.max(max, len)
    }, 0)
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) }
  })
  ws['!cols'] = colWidths
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

function fmtNum(n) { return new Intl.NumberFormat('vi-VN').format(n || 0) }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('vi-VN') : '-' }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('vi-VN') : '-' }
function fmtMonthVN(y, m) { const months = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']; return `${months[m-1]} ${y}` }
function buildMonthOptions(selectId, current) {
  const el = $sel(selectId)
  if (!el) return
  const now = new Date()
  const currentY = parseInt(current.split('-')[0]) || now.getFullYear()
  const currentM = parseInt(current.split('-')[1]) || now.getMonth() + 1
  let html = ''
  for (let y = now.getFullYear() - 2; y <= now.getFullYear(); y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === now.getFullYear() && m > now.getMonth() + 1) break
      const val = `${y}-${String(m).padStart(2,'0')}`
      html += `<option value="${val}" ${val === current ? 'selected' : ''}>${fmtMonthVN(y, m)}</option>`
    }
  }
  el.innerHTML = html
}

// ── Safe Storage (Tracking Prevention workaround) ───────────────────────────
function safeGetItem(key, fallback = null) {
  try { return localStorage.getItem(key) || fallback } catch (_) { return fallback }
}
function safeSetItem(key, val) {
  try { localStorage.setItem(key, val) } catch (_) {}
}
function safeRemoveItem(key) {
  try { localStorage.removeItem(key) } catch (_) {}
}

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container')
  const id = Date.now()
  const iconMap = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' }
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.innerHTML = `<span class="material-symbols-rounded" style="font-size:18px">${iconMap[type]}</span>${msg}`
  container.appendChild(el)
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300) }, 3500)
}

const toast$ = {
  success: (m) => toast(m, 'success'),
  error: (m) => toast(m, 'error'),
  warning: (m) => toast(m, 'warning'),
  info: (m) => toast(m, 'info'),
}

// ── Helpers ────────────────────────────────────────────────────────────────
function el(tag, cls, inner) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (inner) e.innerHTML = inner
  return e
}

function $sel(sel) { return document.querySelector(sel) }
function $selAll(sel) { return document.querySelectorAll(sel) }

function $on(el, ev, fn) { el && el.addEventListener(ev, fn) }

function renderPage(title, html, keepScroll = false) {
  const main = document.getElementById('mainContent')
  const scrollTop = keepScroll ? (main?.scrollTop || 0) : 0
  document.getElementById('pageContent').innerHTML = `
    <div class="main-header">
      <h1 class="main-title">${title}</h1>
    </div>
    <div class="table-wrap">${html}</div>
  `
  if (main) main.scrollTop = keepScroll ? scrollTop : 0
}

function emptyState(icon, msg) {
  return `<div class="empty-state">
    <span class="material-symbols-rounded">${icon}</span>
    <p>${msg}</p>
  </div>`
}

function loadingState() {
  return `<div style="text-align:center;padding:40px;color:#94a3b8;">Đang tải...</div>`
}

// ── Router ─────────────────────────────────────────────────────────────────
const routes = {}
let _activeTimer = null

function router(path) {
  // Xóa timer cũ
  if (_activeTimer) { clearInterval(_activeTimer); _activeTimer = null }

  // Update active nav
  $selAll('.nav-item').forEach(a => a.classList.remove('active'))
  const page = path.replace('#/', '').replace('#', '') || 'dashboard'
  const activeLink = document.querySelector(`.nav-item[data-page="${page}"]`)
  if (activeLink) activeLink.classList.add('active')

  // Route
  const handler = routes[page]
  if (handler) handler()
  else routes['dashboard']()
}

// ── Hash change listener (cho onclick inline như dashboard KPI cards) ──────
window.addEventListener('hashchange', () => router(location.hash))

function registerRoute(name, fn) { routes[name] = fn }

// Bind click trực tiếp vào nav items thay vì dùng hashchange
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar')
  const mobileOverlay = document.getElementById('mobileOverlay')
  const closeMobileSidebar = () => {
    if (window.matchMedia('(max-width: 1024px)').matches) {
      if (typeof window.__closeMobileSidebar === 'function') {
        window.__closeMobileSidebar()
      } else {
        if (sidebar) sidebar.classList.remove('open')
        if (mobileOverlay) mobileOverlay.style.display = 'none'
        document.body.classList.remove('sidebar-open')
      }
    }
  }
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault()
      const savedSidebarScroll = sidebar ? sidebar.scrollTop : 0
      const savedWindowScroll = window.scrollY || window.pageYOffset || 0
      const page = item.dataset.page
      history.pushState(null, '', `#/${page}`)
      router(`#/${page}`)
      closeMobileSidebar()
      // Khôi phục scroll SAU KHI DOM render xong
      requestAnimationFrame(() => {
        if (sidebar) sidebar.scrollTop = savedSidebarScroll
        window.scrollTo(0, savedWindowScroll)
      })
    })
  })
  const initialPath = location.hash || '#/dashboard'
  router(initialPath)
})
// ── Modal helpers ──────────────────────────────────────────────────────────
let _modalIdCounter = 0

function showModal(title, bodyHtml, footerHtml, wide = false) {
  const id = ++_modalIdCounter
  const overlay = el('div', `modal-overlay${id === _modalIdCounter ? '' : ''}`)
  overlay.innerHTML = `<div class="modal${wide ? ' modal-wide' : ''}">
    <div class="modal-header">
      <h2>${title}</h2>
      <button type="button" class="modal-close">✕</button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-footer">${footerHtml}</div>
  </div>`
  document.body.appendChild(overlay)
  $on(overlay.querySelector('.modal-close'), 'click', () => overlay.remove())
  $on(overlay, 'click', (e) => { if (e.target === overlay) overlay.remove() })
  return overlay
}

function closeAllModals() {
  $selAll('.modal-overlay').forEach(m => m.remove())
}

// ── Dashboard Page ─────────────────────────────────────────────────────────
registerRoute('dashboard', async function() {
  renderPage('Bảng điều khiển', loadingState())

  let stats = {}
  let attData = []
  let dashStats = {}

  try {
    [dashStats, attData] = await Promise.all([
      api.get('/api/dashboard/stats').catch(() => ({})),
      api.get('/api/attendance?limit=10&sort=desc').catch(() => []),
    ])
  } catch {}

  const alerts = []
  if ((dashStats.pending_leave || 0) > 0) alerts.push(`${dashStats.pending_leave} đơn nghỉ phép đang chờ duyệt.`)
  if ((dashStats.late_count || 0) > 0) alerts.push(`${dashStats.late_count} nhân viên đi muộn hôm nay.`)
  if ((dashStats.ot_count || 0) > 0) alerts.push(`${dashStats.ot_count} nhân viên làm thêm giờ.`)
  if (alerts.length === 0) alerts.push('Không có cảnh báo nào.')

  const attList = Array.isArray(attData) ? attData : (attData.data || [])

  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <div style="display:flex;gap:12px;">
        <a href="#/employees" class="btn-secondary" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <span class="material-symbols-rounded" style="font-size:18px">person_add</span> Thêm nhân sự
        </a>
        <a href="#/leave-requests" class="btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          <span class="material-symbols-rounded" style="font-size:18px">fact_check</span> Duyệt đơn
        </a>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
      <div class="kpi-card" onclick="location.hash='#/employees'" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="kpi-label">Tổng nhân sự</div>
            <div class="kpi-value kpi-stat-blue">${dashStats.total_employees || 0}</div>
          </div>
          <div style="width:40px;height:40px;border-radius:8px;background:#eff6ff;display:flex;align-items:center;justify-content:center;color:#2563eb">
            <span class="material-symbols-rounded">people</span>
          </div>
        </div>
      </div>
      <div class="kpi-card" onclick="location.hash='#/attendance'" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="kpi-label">Chấm công hôm nay</div>
            <div class="kpi-value kpi-stat-green">${dashStats.today_attendance || 0}</div>
          </div>
          <div style="width:40px;height:40px;border-radius:8px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;color:#16a34a">
            <span class="material-symbols-rounded">fingerprint</span>
          </div>
        </div>
      </div>
      <div class="kpi-card" onclick="location.hash='#/leave-requests'" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="kpi-label">Đơn chờ duyệt</div>
            <div class="kpi-value kpi-stat-orange">${dashStats.pending_leave || 0}</div>
          </div>
          <div style="width:40px;height:40px;border-radius:8px;background:#fff7ed;display:flex;align-items:center;justify-content:center;color:#ea580c">
            <span class="material-symbols-rounded">pending_actions</span>
          </div>
        </div>
      </div>
      <div class="kpi-card" onclick="location.hash='#/leave-requests'" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="kpi-label">Phép còn lại</div>
            <div class="kpi-value kpi-stat-green" style="font-size:22px">${dashStats.leave_balance || 0} ngày</div>
            ${(dashStats.leave_total || 0) > 0 ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">tổng ${dashStats.leave_total}/năm</div>` : ''}
          </div>
          <div style="width:40px;height:40px;border-radius:8px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;color:#16a34a">
            <span class="material-symbols-rounded">event_available</span>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:24px" class="dash-grid">
      <div class="chart-card">
        <h3 style="margin:0 0 16px">Chấm công 7 ngày gần nhất</h3>
        <div style="position:relative;height:220px"><canvas id="dashWeeklyChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h3 style="margin:0 0 16px">Tổng quan nhân sự</h3>
        <div style="position:relative;height:220px"><canvas id="dashStatusChart"></canvas></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px" class="dash-grid">
      <div class="chart-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0">Chấm công mới nhất</h3>
          <a href="#/attendance" class="btn-secondary" style="padding:6px 12px;font-size:13px;text-decoration:none">Xem tất cả</a>
        </div>
        ${attList.length === 0
          ? '<div style="color:#94a3b8;text-align:center;padding:24px 0">Chưa có bản ghi nào.</div>'
          : `<table style="margin:0;font-size:13px">
            <thead><tr><th>Nhân viên</th><th>Loại</th><th>Thời gian</th></tr></thead>
            <tbody>
              ${attList.slice(0, 8).map(a => `
                <tr>
                  <td style="font-weight:600">${a.employee_name || a.name || '-'}</td>
                  <td><span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:${a.type==='in'?'#dcfce7':a.type==='out'?'#e0f2fe':'#fef9c3'};color:${a.type==='in'?'#166534':a.type==='out'?'#075985':'#854d0e'}">${a.type==='in'?'Vào':a.type==='out'?'Ra':'Ngoài'}</span></td>
                  <td style="color:#64748b">${fmtDateTime(a.timestamp)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`
        }
      </div>
      <div class="chart-card" style="background:#fffbeb;border:1px solid #fde68a">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <span class="material-symbols-rounded" style="color:#d97706;font-size:20px">notifications_active</span>
          <h3 style="margin:0;color:#92400e">Cần chú ý</h3>
        </div>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#78350f">
          ${alerts.map(a => `<li style="margin-bottom:8px">${a}</li>`).join('')}
        </ul>
      </div>
    </div>

    <style>
      @media(max-width:900px){
        .dash-grid{grid-template-columns:1fr!important}
        .dash-kpi{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))!important}
      }
      @media(max-width:640px){
        .dash-kpi{grid-template-columns:repeat(2,1fr)!important}
        .dash-kpi .kpi-card .kpi-value{font-size:22px}
      }
    </style>
  `

  renderPage('Bảng điều khiển', html)

  // Charts - destroy existing charts first
  setTimeout(() => {
    if (typeof Chart !== 'function') {
      console.warn('Chart.js not loaded, skipping chart initialization')
      return
    }
    try {
    // Destroy existing charts to avoid "canvas already in use" error
    if (window._dashWeeklyChart) { window._dashWeeklyChart.destroy() }
    if (window._dashStatusChart) { window._dashStatusChart.destroy() }

    const weekly = dashStats.weekly_data || []
    const labels = weekly.map(d => d.label || d.date || '')
    const values = weekly.map(d => d.count || 0)

    const isDark = document.body.classList.contains('dark')
    const textColor = isDark ? '#94a3b8' : '#64748b'

    if (labels.length > 0) {
      window._dashWeeklyChart = new Chart(document.getElementById('dashWeeklyChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Lượt chấm công',
            data: values,
            backgroundColor: 'rgba(37,99,235,0.7)',
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: textColor } },
          },
        },
      })
    }

    const empStats = dashStats.employee_stats || { active: 0, inactive: 0 }
    window._dashStatusChart = new Chart(document.getElementById('dashStatusChart'), {
      type: 'doughnut',
      data: {
        labels: ['Đang làm việc', 'Đã nghỉ việc'],
        datasets: [{
          data: [empStats.active || 0, empStats.inactive || 0],
          backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(239,68,68,0.8)'],
          borderWidth: 0, borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 16 } } },
      },
    })
    } catch (err) { console.warn('Chart init error:', err) }
  }, 50)
})

// ── Employees Page ─────────────────────────────────────────────────────────
registerRoute('employees', async function() {
  let page = 1
  let total = 0
  let search = ''
  let filterStatus = 'active'
  let filterDept = ''
  let departments = []
  let positions = []
  let shifts = []
  let offices = []
  let employeeTypes = []
  let salaryPolicies = []
  let list = []
  let selected = []
  let showModal = false
  let editId = null
  let formData = {}

  // ── Multi-select văn phòng ───────────────────────────────────────────
  async function loadDepts() {
    try {
      const d = await api.get('/api/departments')
      departments = Array.isArray(d) ? d : (d.data || [])
    } catch { departments = [] }
  }
  async function loadPositions() {
    try {
      const d = await api.get('/api/positions')
      positions = Array.isArray(d) ? d : (d.data || [])
    } catch { positions = [] }
  }
  async function loadShifts() {
    try {
      const d = await api.get('/api/shifts')
      shifts = Array.isArray(d) ? d : (d.data || [])
    } catch { shifts = [] }
  }
  async function loadOffices() {
    try {
      const d = await api.get('/api/offices')
      offices = Array.isArray(d) ? d : (d.data || [])
    } catch { offices = [] }
  }
  async function loadEmployeeTypes() {
    try {
      const d = await api.get('/api/employee-types')
      employeeTypes = Array.isArray(d) ? d : (d.data || [])
    } catch { employeeTypes = [] }
  }
  async function loadSalaryPolicies() {
    try {
      const d = await api.get('/api/salary-policies')
      salaryPolicies = Array.isArray(d) ? d : (d.data || [])
    } catch { salaryPolicies = [] }
  }
  async function loadZones() {
    try {
      const d = await api.get('/api/location-zones/admin')
      window._zones = Array.isArray(d) ? d : (d.data || [])
    } catch { window._zones = [] }
  }
  loadZones()

  async function loadList() {
    const params = new URLSearchParams({ page, limit: 20, status: filterStatus })
    if (search) params.set('search', search)
    if (filterDept) params.set('department_id', filterDept)
    try {
      const data = await api.get(`/api/employees?${params}`)
      list = Array.isArray(data) ? data : (data.data || [])
      total = data.total || list.length
    } catch {
      list = []
      toast$.error('Không tải được danh sách.')
    }
    render()
  }

  function openCreate() {
    editId = null
    formData = { code: '', name: '', email: '', phone: '', department_id: '', position_id: '', shift_id: '', office_ids: [], employee_type_id: '', salary_policy_id: '', paid_leave_days_per_year: 12 }
    showModal = true
    window._empFormData = formData
    render()
  }

  function openEdit(emp) {
    editId = emp.id
    // Nếu office_ids trống nhưng có office_id (từ bảng employees), dùng làm fallback
    var officeIds = emp.office_ids && emp.office_ids.length > 0
      ? emp.office_ids
      : (emp.office_id ? [emp.office_id] : [])
    formData = {
      code: emp.code || '', name: emp.name || '', email: emp.email || '', phone: emp.phone || '',
      department_id: emp.department_id || '', position_id: emp.position_id || '',
      shift_id: emp.shift_id || '', office_ids: officeIds, employee_type_id: emp.employee_type_id || '',
      salary_policy_id: emp.salary_policy_id || '', paid_leave_days_per_year: emp.paid_leave_days_per_year || 12,
      zones: emp.zones || [],
    }
    window._empFormData = formData
    showModal = true
    render()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData(e.target)

    // Thêm office_ids từ multi-select JS vào FormData
    if (window._empFormData && window._empFormData.office_ids) {
      window._empFormData.office_ids.forEach(id => fd.append('office_ids', id))
    }

    const cleanData = {}
    fd.forEach((v, k) => {
      if (v !== '' && v !== null) {
        if (cleanData[k] !== undefined) {
          if (!Array.isArray(cleanData[k])) cleanData[k] = [cleanData[k]]
          cleanData[k].push(v)
        } else {
          cleanData[k] = v
        }
      }
    })
    try {
      if (editId) {
        await api.patch(`/api/employees/${editId}`, cleanData)
        toast$.success('Cập nhật thành công.')
      } else {
        const postData = new FormData()
        cleanData.forEach((v, k) => {
          if (Array.isArray(v)) v.forEach(x => postData.append(k, x))
          else postData.append(k, v)
        })
        await api.post('/api/employees', postData)
        toast$.success('Tạo nhân viên thành công.')
      }
      showModal = false
      loadList()
    } catch (err) {
      toast$.error(err.message || 'Lỗi lưu.')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Xóa nhân viên này?')) return
    try {
      await api.delete(`/api/employees/${id}`)
      toast$.success('Đã xóa.')
      loadList()
    } catch (err) { toast$.error(err.message || 'Lỗi xóa.') }
  }

  async function bulkDelete() {
    if (!confirm(`Xóa ${selected.length} nhân viên đã chọn?`)) return
    try {
      await Promise.all(selected.map(id => api.delete(`/api/employees/${id}`)))
      toast$.success(`Đã xóa ${selected.length} nhân viên.`)
      selected = []
      loadList()
    } catch (err) { toast$.error(err.message || 'Lỗi xóa hàng loạt.') }
  }

  async function handleExportExcel() {
    try {
      const data = await api.get('/api/employees?limit=10000')
      const rows = Array.isArray(data) ? data : (data.data || [])
      const header = ['Mã NV', 'Họ tên', 'Phòng ban', 'Chức vụ', 'Email', 'Điện thoại', 'Trạng thái']
      const aoa = [header]
      rows.forEach(e => {
        aoa.push([
          e.code || '',
          e.name || '',
          e.department_name || e.department || '',
          e.position_name || '',
          e.email || '',
          e.phone || '',
          e.status === 'active' ? 'Đang làm' : 'Đã nghỉ',
        ])
      })
      exportToXlsx(aoa, 'danh_sach_nhan_su.xlsx', 'Nhân sự')
    } catch { toast$.error('Lỗi xuất file.') }
  }

  function toggleAll() {
    selected = selected.length === list.length ? [] : list.map(e => e.id)
    render()
  }

  function toggleSel(id) {
    selected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
    render()
  }

  function render() {
    const totalPages = Math.ceil(total / 20) || 1
    const modalHtml = showModal ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._empModalClose()">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h2>${editId ? 'Sửa nhân viên' : 'Tạo mới nhân viên'}</h2>
            <button type="button" class="modal-close" onclick="window._empModalClose()">✕</button>
          </div>
          <form id="empForm" onclick="event.stopPropagation()">
            <div class="modal-body" onclick="event.stopPropagation()">
              <div class="modal-form-row cols-2" onclick="event.stopPropagation()">
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Mã nhân viên ${editId ? '' : '*'}</label>
                  <input type="text" name="code" value="${formData.code || ''}" ${editId ? 'readonly' : 'required'} onclick="event.stopPropagation()" />
                </div>
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Họ tên *</label>
                  <input type="text" name="name" value="${formData.name || ''}" required onclick="event.stopPropagation()" />
                </div>
              </div>
              <div class="modal-form-row cols-2" onclick="event.stopPropagation()">
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Phòng ban</label>
                  <select name="department_id" onclick="event.stopPropagation()">
                    <option value="">— Không chọn —</option>
                    ${departments.map(d => `<option value="${d.id}" ${formData.department_id == d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Văn phòng</label>
                  <div id="officeMultiSelect" class="multi-select">
                    <div class="multi-select-display">
                      ${(formData.office_ids||[]).length === 0
                        ? '<span class="multi-select-placeholder">— Chọn văn phòng —</span>'
                        : (formData.office_ids||[]).map(oid => {
                            const o = (offices||[]).find(x => x.id === oid)
                            return o ? `<span class="multi-select-tag">${o.name}<span class="multi-select-remove" data-office-id="${o.id}">×</span></span>` : ''
                          }).join('')}
                    </div>
                    <div class="multi-select-dropdown" style="display:none">
                      <input type="text" class="multi-select-search" placeholder="Tìm kiếm..." />
                      <div class="multi-select-options"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-form-row cols-2" onclick="event.stopPropagation()">
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Chức vụ</label>
                  <select name="position_id" onclick="event.stopPropagation()">
                    <option value="">— Không chọn —</option>
                    ${positions.map(p => `<option value="${p.id}" ${formData.position_id == p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Loại nhân viên</label>
                  <select name="employee_type_id" onclick="event.stopPropagation()">
                    <option value="">— Không chọn —</option>
                    ${employeeTypes.map(et => `<option value="${et.id}" ${formData.employee_type_id == et.id ? 'selected' : ''}>${et.name}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="modal-form-row cols-2" onclick="event.stopPropagation()">
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Ca làm việc</label>
                  <select name="shift_id" onclick="event.stopPropagation()">
                    <option value="">— Không chọn —</option>
                    ${shifts.map(s => `<option value="${s.id}" ${formData.shift_id == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Chính sách lương</label>
                  <select name="salary_policy_id" onclick="event.stopPropagation()">
                    <option value="">— Mặc định (theo chức vụ) —</option>
                    ${salaryPolicies.map(sp => `<option value="${sp.id}" ${formData.salary_policy_id == sp.id ? 'selected' : ''}>${sp.name}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="modal-form-row cols-2" onclick="event.stopPropagation()">
                <div class="form-group" onclick="event.stopPropagation()"><label>Email</label><input type="email" name="email" value="${formData.email || ''}" onclick="event.stopPropagation()" /></div>
                <div class="form-group" onclick="event.stopPropagation()"><label>Điện thoại</label><input type="tel" name="phone" value="${formData.phone || ''}" onclick="event.stopPropagation()" /></div>
              </div>
              <div class="form-group" onclick="event.stopPropagation()">
                <label>Số ngày nghỉ có lương/năm</label>
                <input type="number" name="paid_leave_days_per_year" value="${formData.paid_leave_days_per_year || 12}" min="0" onclick="event.stopPropagation()" />
              </div>
              ${!editId ? `
                <div class="form-group" onclick="event.stopPropagation()">
                  <label>Ảnh khuôn mặt (5 ảnh để nhận diện tốt hơn) *</label>
                  <p style="color:#666;font-size:13px;margin:4px 0 8px">Chọn 5 ảnh khác nhau (góc mặt, ánh sáng khác nhau).</p>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    ${[1,2,3,4,5].map(i => `<div onclick="event.stopPropagation()"><label style="font-size:12px">Ảnh ${i}</label><input type="file" name="photo_${i}" accept="image/*" ${i<=2?'required':''} onclick="event.stopPropagation()" /></div>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
            <div class="modal-footer" onclick="event.stopPropagation()">
              <button type="button" class="btn-secondary" onclick="window._empModalClose()">Hủy</button>
              <button type="submit" class="btn-primary">${editId ? 'Cập nhật' : 'Tạo mới'}</button>
            </div>
          </form>
        </div>
      </div>
    ` : ''

    const html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="display:flex;gap:8px">
          <button type="button" class="btn-create" id="btnCreateEmp">
            <span class="material-symbols-rounded" style="font-size:20px">add</span> Tạo mới
          </button>
          <button type="button" class="btn-secondary" id="btnExportEmp">
            <span class="material-symbols-rounded" style="font-size:18px">table_chart</span> Excel
          </button>
          ${selected.length > 0 ? `
            <button type="button" class="btn-action danger" id="btnBulkDel">
              <span class="material-symbols-rounded" style="font-size:18px">delete</span> Xóa (${selected.length})
            </button>
          ` : ''}
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <input type="text" id="empSearch" placeholder="Tìm tên hoặc mã nhân sự..." value="${search}"
          style="flex:1;min-width:200px;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px" />
        <select id="empFilterStatus" style="padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px">
          <option value="all" ${filterStatus==='all'?'selected':''}>Tất cả trạng thái</option>
          <option value="active" ${filterStatus==='active'?'selected':''}>Đang làm việc</option>
          <option value="inactive" ${filterStatus==='inactive'?'selected':''}>Đã nghỉ việc</option>
        </select>
        <select id="empFilterDept" style="padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px">
          <option value="">Tất cả phòng ban</option>
          ${departments.map(d => `<option value="${d.id}" ${parseInt(filterDept) === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
        </select>
      </div>

      <style>
        .emp-chk, #chkAll { width: 18px; height: 18px; cursor: pointer; accent-color: #667eea; }
      </style>
      ${list.length === 0
        ? emptyState('people_outline', 'Chưa có nhân viên. Nhấn <strong>Tạo mới</strong> để thêm hồ sơ.')
        : `<div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style="width:40px"><input type="checkbox" id="chkAll" ${selected.length === list.length && list.length > 0 ? 'checked' : ''} onchange="window._toggleAll()" /></th>
                  <th>NHÂN SỰ</th>
                  <th>MÃ</th>
                  <th>TRẠNG THÁI</th>
                  <th>VĂN PHÒNG</th>
                  <th>PHÒNG BAN</th>
                  <th>LOẠI NV</th>
                  <th>CHỨC VỤ</th>
                  <th>CS LƯƠNG</th>
                  <th>EMAIL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${list.map(emp => `
                  <tr>
                    <td><input type="checkbox" class="emp-chk" value="${emp.id}" ${selected.includes(emp.id) ? 'checked' : ''} onchange="window._toggleSel(${emp.id})" /></td>
                      <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0">${(emp.name||'?').charAt(0).toUpperCase()}</div>
                        <span style="font-weight:600;font-size:14px">${emp.name}</span>
                      </div>
                    </td>
                    <td><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;color:#475569">${emp.code}</code></td>
                    <td><span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:${emp.status==='active'?'#dcfce7':'#fee2e2'};color:${emp.status==='active'?'#16a34a':'#dc2626'}">${emp.status==='active'?'Đang làm':'Đã nghỉ'}</span></td>
                    <td>${emp.office_name || '-'}</td>
                    <td>${emp.department_name || '-'}</td>
                    <td>${emp.employee_type_name || '-'}</td>
                    <td>${emp.position_name || '-'}</td>
                    <td>${emp.salary_policy_name || '-'}</td>
                    <td style="font-size:13px;color:#64748b">${emp.email || '-'}</td>
                    <td style="text-align:right;white-space:nowrap">
                      <button type="button" class="btn-secondary" style="padding:5px 12px;font-size:12px" onclick="window._openEdit(${emp.id})">Sửa</button>
                      <button type="button" class="btn-action danger" style="padding:5px 10px;font-size:12px" onclick="window._deleteEmp(${emp.id})">Xóa</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
      `
      }
      ${modalHtml}
    `

    renderPage('Danh sách nhân sự', html, showModal)

    // Events
    $on($sel('#btnCreateEmp'), 'click', openCreate)
    $on($sel('#btnExportEmp'), 'click', handleExportExcel)
    if ($sel('#btnBulkDel')) $on($sel('#btnBulkDel'), 'click', bulkDelete)

    let searchTimer
    $on($sel('#empSearch'), 'input', (e) => {
      search = e.target.value
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => { page = 1; loadList() }, 400)
    })
    $on($sel('#empFilterStatus'), 'change', (e) => { filterStatus = e.target.value; page = 1; loadList() })
    $on($sel('#empFilterDept'), 'change', (e) => { filterDept = e.target.value; page = 1; loadList() })
    if ($sel('#chkAll')) $on($sel('#chkAll'), 'change', toggleAll)
    $selAll('.emp-chk').forEach(chk => $on(chk, 'change', () => toggleSel(parseInt(chk.value))))
    $selAll('[data-page]').forEach(btn => { if (btn.tagName === 'BUTTON') $on(btn, 'click', () => { if (!btn.disabled) { page = parseInt(btn.dataset.page); loadList() } }) })
    $selAll('[data-edit]').forEach(btn => $on(btn, 'click', () => openEdit(list.find(e => e.id === parseInt(btn.dataset.edit)))))
    $selAll('[data-delete]').forEach(btn => $on(btn, 'click', () => handleDelete(parseInt(btn.dataset.delete))))

    // Global functions for table events
    window._toggleAll = () => toggleAll()
    window._toggleSel = (id) => toggleSel(id)
    window._openEdit = (id) => openEdit(list.find(e => e.id === id))
    window._deleteEmp = (id) => handleDelete(id)

    // ── Multi-select văn phòng ───────────────────────────────────────────
    ;(function(){
      var sel = $sel('#officeMultiSelect')
      if (!sel) return
      var disp = sel.querySelector('.multi-select-display')
      var dd = sel.querySelector('.multi-select-dropdown')
      var opt = sel.querySelector('.multi-select-options')
      var search = sel.querySelector('.multi-select-search')

      function renderOpts(filter) {
        var ids = window._empFormData ? window._empFormData.office_ids : []
        opt.innerHTML = (offices||[]).filter(function(o){ return !filter || o.name.toLowerCase().includes(filter.toLowerCase()) }).map(function(o){
return '<label style="display:flex!important;flex-direction:row;align-items:center;gap:8px;padding:7px 12px;font-weight:400;margin:0;cursor:pointer"><input type="checkbox" value="' + o.id + '" ' + (ids.indexOf(o.id)>=0?'checked':'') + ' /> ' + o.name + '</label>'
        }).join('')
      }

      $on(disp, 'click', function(e) {
        if (e.target.classList.contains('multi-select-remove')) {
          var oid = parseInt(e.target.dataset.officeId)
          var ids = window._empFormData ? window._empFormData.office_ids : []
          window._empFormData.office_ids = ids.filter(function(x){ return x !== oid })
          disp.innerHTML = window._empFormData.office_ids.length === 0
            ? '<span class="multi-select-placeholder">— Chọn văn phòng —</span>'
            : window._empFormData.office_ids.map(function(oid){
                var o = offices.find(function(x){ return x.id === oid })
                return o ? '<span class="multi-select-tag">' + o.name + '<span class="multi-select-remove" data-office-id="' + o.id + '">×</span></span>' : ''
              }).join('')
          renderOpts(search.value)
          return
        }
        dd.style.display = dd.style.display === 'block' ? 'none' : 'block'
        dd.style.width = (disp.offsetWidth || sel.offsetWidth) + 'px'
        search.value = ''
        renderOpts('')
        search.focus()
      })

      $on(dd, 'click', function(e) { e.stopPropagation() })
      $on(search, 'input', function() { renderOpts(search.value) })
      $on(opt, 'change', function(e) {
        if (e.target.type !== 'checkbox') return
        var oid = parseInt(e.target.value)
        var checked = e.target.checked
        var ids = window._empFormData ? window._empFormData.office_ids : []
        if (checked) { if (ids.indexOf(oid)<0) ids.push(oid) }
        else { ids = ids.filter(function(x){ return x !== oid }) }
        window._empFormData.office_ids = ids
        disp.innerHTML = ids.length === 0
          ? '<span class="multi-select-placeholder">— Chọn văn phòng —</span>'
          : ids.map(function(oid){
              var o = offices.find(function(x){ return x.id === oid })
              return o ? '<span class="multi-select-tag">' + o.name + '<span class="multi-select-remove" data-office-id="' + o.id + '">×</span></span>' : ''
            }).join('')
      })

      document.addEventListener('click', function(e) {
        if (!sel.contains(e.target)) dd.style.display = 'none'
      })
    })()

    // ── Multi-select vùng check-in ────────────────────────────────────────
    ;(function(){
      var sel = $sel('#zoneMultiSelect')
      if (!sel) return
      var disp = sel.querySelector('.multi-select-display')
      var dd = sel.querySelector('.multi-select-dropdown')
      var opt = sel.querySelector('.multi-select-options')
      var search = sel.querySelector('.multi-select-search')

      function renderOpts(filter) {
        var zones = window._zones || []
        var selectedIds = (window._empFormData && window._empFormData.zones) ? window._empFormData.zones.map(function(z){ return z.id }) : []
        opt.innerHTML = zones.filter(function(z){ return !filter || z.name.toLowerCase().includes(filter.toLowerCase()) }).map(function(z){
          return '<label><input type="checkbox" value="' + z.id + '" ' + (selectedIds.indexOf(z.id)>=0?'checked':'') + ' /> ' + z.name + '</label>'
        }).join('')
      }

      $on(disp, 'click', function(e) {
        if (e.target.classList.contains('multi-select-remove')) {
          var zid = parseInt(e.target.dataset.zoneId)
          if (window._empFormData && window._empFormData.zones) {
            window._empFormData.zones = window._empFormData.zones.filter(function(z){ return z.id !== zid })
          }
          disp.innerHTML = (window._empFormData && window._empFormData.zones && window._empFormData.zones.length > 0)
            ? window._empFormData.zones.map(function(z){ return '<span class="multi-select-tag">' + z.name + '<span class="multi-select-remove" data-zone-id="' + z.id + '">×</span></span>' }).join('')
            : '<span class="multi-select-placeholder">— Chọn vùng check-in —</span>'
          renderOpts(search.value)
          return
        }
        dd.style.display = dd.style.display === 'block' ? 'none' : 'block'
        if (dd.style.display === 'block') dd.style.width = disp.offsetWidth + 'px'
        search.value = ''
        renderOpts('')
        search.focus()
      })

      $on(dd, 'click', function(e) { e.stopPropagation() })
      $on(search, 'input', function() { renderOpts(search.value) })
      $on(opt, 'change', function(e) {
        if (e.target.type !== 'checkbox') return
        var zid = parseInt(e.target.value)
        var checked = e.target.checked
        if (!window._empFormData) window._empFormData = { zones: [] }
        if (!window._empFormData.zones) window._empFormData.zones = []
        var allZones = window._zones || []
        var zoneObj = allZones.find(function(z){ return z.id === zid })
        if (checked) {
          if (!window._empFormData.zones.find(function(z){ return z.id === zid })) {
            window._empFormData.zones.push({ id: zid, name: zoneObj ? zoneObj.name : 'Vùng ' + zid })
          }
        } else {
          window._empFormData.zones = window._empFormData.zones.filter(function(z){ return z.id !== zid })
        }
        disp.innerHTML = window._empFormData.zones.length === 0
          ? '<span class="multi-select-placeholder">— Chọn vùng check-in —</span>'
          : window._empFormData.zones.map(function(z){ return '<span class="multi-select-tag">' + z.name + '<span class="multi-select-remove" data-zone-id="' + z.id + '">×</span></span>' }).join('')
      })

      document.addEventListener('click', function(e) {
        if (!sel.contains(e.target)) dd.style.display = 'none'
      })
    })()

    var empForm = $sel('#empForm')
    if (empForm) $on(empForm, 'submit', handleSubmit)

    window._empModalClose = () => { showModal = false; render() }
  }

  await Promise.all([loadDepts(), loadPositions(), loadShifts(), loadOffices(), loadEmployeeTypes(), loadSalaryPolicies()])
  await loadList()
})

// ── Shifts Page ─────────────────────────────────────────────────────────────
registerRoute('shifts', async function() {
  let list = []
  let showM = false, editId = null
  let f = { name: '', start: '08:00', end: '17:00', description: '' }

  async function load() {
    try {
      const d = await api.get('/api/shifts')
      list = Array.isArray(d) ? d : (d.data || [])
    } catch { toast$.error('Không tải được.') }
    render()
  }

  function render() {
    const m = showM ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._sClose()">
        <div class="modal">
          <div class="modal-header"><h2>${editId?'Sửa ca':'Thêm ca'}</h2><button type="button" class="modal-close" onclick="window._sClose()">✕</button></div>
          <form id="shiftForm">
            <div class="modal-body">
              <div class="form-group"><label>Tên ca *</label><input type="text" name="name" value="${f.name||''}" required /></div>
              <div class="modal-form-row cols-2">
                <div class="form-group"><label>Giờ vào</label><input type="time" name="start_time" value="${f.start||''}" /></div>
                <div class="form-group"><label>Giờ ra</label><input type="time" name="end_time" value="${f.end||''}" /></div>
              </div>
              <div class="form-group"><label>Mô tả</label><input type="text" name="description" value="${f.description||''}" /></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="window._sClose()">Hủy</button>
              <button type="submit" class="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      </div>` : ''

    renderPage('Ca làm việc', `
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button type="button" class="btn-create" id="btnAddShift">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Thêm ca
        </button>
      </div>
      ${list.length===0 ? emptyState('schedule','Chưa có ca làm việc.') : `
        <table>
          <thead><tr><th>ID</th><th>Tên ca</th><th>Giờ vào</th><th>Giờ ra</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${list.map(s=>`<tr>
              <td>${s.id}</td><td style="font-weight:600">${s.name}</td><td>${s.start_time||s.start||''}</td><td>${s.end_time||s.end||''}</td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" data-edit="${s.id}">Sửa</button>
                <button type="button" class="btn-action danger" style="padding:6px 10px" data-del="${s.id}">Xóa</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
      ${m}
    `, showM)

    $on($sel('#btnAddShift'), 'click', () => { editId=null; f={name:'',start:'08:00',end:'17:00',description:''}; showM=true; render() })
    $selAll('[data-edit]').forEach(b=>$on(b,'click',()=>{const s=list.find(x=>x.id==b.dataset.edit);editId=s.id;f={name:s.name,start:s.start_time||s.start,end:s.end_time||s.end,description:s.description||''};showM=true;render()}))
    $selAll('[data-del]').forEach(b=>$on(b,'click',async()=>{if(!confirm('Xóa ca này?'))return;try{await api.delete(`/api/shifts/${b.dataset.del}`);toast$.success('Đã xóa.');load()}catch(e){toast$.error(e.message)}}))
    if(showM)$on($sel('#shiftForm'),'submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);try{if(editId)await api.patch(`/api/shifts/${editId}`,fd);else await api.post('/api/shifts',fd);toast$.success('Đã lưu.');showM=false;load()}catch(e){toast$.error(e.message)}})
    window._sClose=()=>{showM=false;render()}
  }
  await load()
});

// ── Departments Page ────────────────────────────────────────────────────────
registerRoute('departments', async function() {
  let list = []
  let showM = false, editId = null
  let f = { name: '', description: '' }

  async function load() {
    try {
      const d = await api.get('/api/departments')
      list = Array.isArray(d) ? d : (d.data || [])
    } catch {}
    render()
  }

  function render() {
    const m = showM ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._dClose()">
        <div class="modal">
          <div class="modal-header"><h2>${editId?'Sửa phòng ban':'Thêm phòng ban'}</h2><button type="button" class="modal-close" onclick="window._dClose()">✕</button></div>
          <form id="deptForm">
            <div class="modal-body">
              <div class="form-group"><label>Tên phòng ban *</label><input type="text" name="name" value="${f.name||''}" required /></div>
              <div class="form-group"><label>Mô tả</label><input type="text" name="description" value="${f.description||''}" /></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="window._dClose()">Hủy</button>
              <button type="submit" class="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      </div>` : ''

    renderPage('Phòng ban', `
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <label for="deptImportFile" class="btn-secondary" style="cursor:pointer;display:flex;align-items:center;gap:6px">
          <span class="material-symbols-rounded" style="font-size:18px">upload_file</span> Import CSV
        </label>
        <input type="file" id="deptImportFile" accept=".csv,.xlsx,.xls" style="display:none" />
        <button type="button" class="btn-create" id="btnAddDept">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Thêm phòng ban
        </button>
      </div>
      <div id="deptImportResult" style="margin-bottom:16px;display:none" class="alert-box"></div>
      ${list.length===0 ? emptyState('domain','Chưa có phòng ban.') : `
        <table>
          <thead><tr><th>ID</th><th>Tên phòng ban</th><th>Mô tả</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${list.map(d=>`<tr>
              <td>${d.id}</td><td style="font-weight:600">${d.name}</td><td style="color:#64748b">${d.description||'-'}</td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" data-edit="${d.id}">Sửa</button>
                <button type="button" class="btn-action danger" style="padding:6px 10px" data-del="${d.id}">Xóa</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
      ${m}
    `, showM)

    $on($sel('#btnAddDept'), 'click', () => { editId=null; f={name:'',description:''}; showM=true; render() })
    $selAll('[data-edit]').forEach(b=>$on(b,'click',()=>{const d=list.find(x=>x.id==b.dataset.edit);editId=d.id;f={name:d.name,description:d.description||''};showM=true;render()}))
    $selAll('[data-del]').forEach(b=>$on(b,'click',async()=>{if(!confirm('Xóa phòng ban?'))return;try{await api.delete(`/api/departments/${b.dataset.del}`);toast$.success('Đã xóa.');load()}catch(e){toast$.error(e.message)}}))
    if(showM)$on($sel('#deptForm'),'submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);try{if(editId)await api.patch(`/api/departments/${editId}`,fd);else await api.post('/api/departments',fd);toast$.success('Đã lưu.');showM=false;load()}catch(e){toast$.error(e.message)}})
    window._dClose=()=>{showM=false;render()}

    // Import departments
    $on($sel('#deptImportFile'), 'change', async e => {
      const file = e.target.files[0]
      if (!file) return
      const fd = new FormData()
      fd.append('file', file)
      try {
        const result = await fetch('/api/departments/import', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
          body: fd
        }).then(r => r.json())
        const box = $sel('#deptImportResult')
        if (result.ok) {
          box.style.display = 'block'
          box.style.background = '#d1fae5'
          box.style.color = '#065f46'
          box.innerHTML = `Import thành công! Tạo mới: ${result.created}, Cập nhật: ${result.updated}${result.errors.length ? '<br>Lỗi: ' + result.errors.join('; ') : ''}`
          load()
        } else {
          box.style.display = 'block'
          box.style.background = '#fee2e2'
          box.style.color = '#991b1b'
          box.textContent = 'Lỗi: ' + result.error
        }
      } catch(err) {
        toast$.error('Import thất bại.')
      }
      e.target.value = ''
    })
  }
  await load()
});

// ── OpenStreetMap Office Picker (Leaflet) ─────────────────────────────────────
function showOfficeMapPicker(opts = {}) {
  opts = { lat: '', lng: '', radius: 100, onConfirm: null, ...opts }
  const initLat = parseFloat(opts.lat) || 10.8231
  const initLng = parseFloat(opts.lng) || 106.6297
  const mapId = '__lfMap_' + Date.now()

  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px'
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;width:100%;max-width:780px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e2e8f0">
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:600">Chọn vị trí trên bản đồ</h3>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b">Kéo marker, click vào bản đồ hoặc tìm địa chỉ để chọn vị trí</p>
        </div>
        <button id="__mpClose" style="background:none;border:none;cursor:pointer;font-size:22px;color:#94a3b8;padding:4px;line-height:1;border-radius:6px">&times;</button>
      </div>
      <div style="display:flex;gap:8px;padding:10px 20px;border-bottom:1px solid #e2e8f0">
        <input id="__mpSearch" type="text" placeholder="Tìm địa chỉ... (VD: 123 Nguyễn Huệ, TP.HCM)" style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;outline:none" />
        <button id="__mpSearchBtn" style="padding:8px 16px;border:none;background:#0f2942;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;flex-shrink:0">Tìm</button>
        <div id="__mpSearching" style="display:none;align-items:center;gap:6px;color:#64748b;font-size:13px;flex-shrink:0;padding:8px">
          <span style="display:inline-block;width:14px;height:14px;border:2px solid #0f2942;border-top-color:transparent;border-radius:50%;animation:__lfSpin 0.6s linear infinite"></span>
          Đang tìm...
        </div>
      </div>
      <div id="${mapId}" style="flex:1;min-height:380px;background:#e2e8f0"></div>
      <div style="display:flex;gap:16px;padding:14px 20px;border-top:1px solid #e2e8f0;align-items:center;flex-wrap:wrap">
        <div style="display:flex;gap:8px;flex:1;min-width:200px">
          <div style="flex:1">
            <label style="font-size:11px;color:#64748b;font-weight:500;display:block;margin-bottom:3px">Vĩ độ</label>
            <input id="__mpLat" type="number" step="any" value="${initLat}" readonly style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:13px;background:#f8fafc;color:#475569" />
          </div>
          <div style="flex:1">
            <label style="font-size:11px;color:#64748b;font-weight:500;display:block;margin-bottom:3px">Kinh độ</label>
            <input id="__mpLng" type="number" step="any" value="${initLng}" readonly style="width:100%;padding:7px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:13px;background:#f8fafc;color:#475569" />
          </div>
        </div>
        <div id="__mpAddr" style="font-size:12px;color:#64748b;flex:1;min-width:160px"></div>
        <div style="display:flex;gap:8px">
          <button id="__mpCancel" style="padding:9px 20px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;color:#475569">Hủy</button>
          <button id="__mpConfirm" style="padding:9px 20px;border:none;background:#0f2942;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500">Xác nhận</button>
        </div>
      </div>
    </div>
    <style>@keyframes __lfSpin{to{transform:rotate(360deg)}}</style>`
  document.body.appendChild(overlay)

  let map, marker
  let currentAddr = ''

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    if (map) { try { map.remove() } catch {} }
  }

  overlay.querySelector('#__mpClose').addEventListener('click', close)
  overlay.querySelector('#__mpCancel').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  overlay.querySelector('#__mpConfirm').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('__mpLat').value)
    const lng = parseFloat(document.getElementById('__mpLng').value)
    if (opts.onConfirm) opts.onConfirm(lat, lng, currentAddr)
    close()
  })

  function updateMarker(lat, lng) {
    document.getElementById('__mpLat').value = lat.toFixed(7)
    document.getElementById('__mpLng').value = lng.toFixed(7)
    if (marker) {
      marker.setLatLng([lat, lng])
    } else {
      marker = L.marker([lat, lng], { draggable: true, autoPan: true }).addTo(map)
      marker.on('dragend', function() {
        const p = marker.getLatLng()
        document.getElementById('__mpLat').value = p.lat.toFixed(7)
        document.getElementById('__mpLng').value = p.lng.toFixed(7)
        reverseGeocode(p.lat, p.lng)
      })
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 15))
  }

  function reverseGeocode(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`)
      .then(r => r.json())
      .then(data => {
        if (data && data.display_name) {
          currentAddr = data.display_name
          document.getElementById('__mpAddr').textContent = data.display_name
        }
      })
      .catch(() => {})
  }

  function searchAddress(query) {
    if (!query.trim()) return
    const btn = overlay.querySelector('#__mpSearchBtn')
    const searching = overlay.querySelector('#__mpSearching')
    btn.style.display = 'none'
    searching.style.display = 'flex'
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=vi`)
      .then(r => r.json())
      .then(data => {
        btn.style.display = ''
        searching.style.display = 'none'
        if (data && data.length > 0) {
          const r = data[0]
          const lat = parseFloat(r.lat)
          const lng = parseFloat(r.lon)
          currentAddr = r.display_name
          document.getElementById('__mpAddr').textContent = r.display_name
          updateMarker(lat, lng)
        } else {
          alert('Không tìm thấy địa chỉ. Thử nhập địa chỉ khác.')
        }
      })
      .catch(() => {
        btn.style.display = ''
        searching.style.display = 'none'
      })
  }

  const searchInput = overlay.querySelector('#__mpSearch')
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(searchInput.value) } })
  overlay.querySelector('#__mpSearchBtn').addEventListener('click', () => searchAddress(searchInput.value))

  setTimeout(() => {
    map = L.map(mapId, { zoomControl: true }).setView([initLat, initLng], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    if (opts.lat && opts.lng) {
      updateMarker(initLat, initLng)
      reverseGeocode(initLat, initLng)
    }

    map.on('click', function(e) {
      updateMarker(e.latlng.lat, e.latlng.lng)
      reverseGeocode(e.latlng.lat, e.latlng.lng)
    })

    searchInput.focus()
  }, 50)
}

// ── Offices Page ──────────────────────────────────────────────────────────────
registerRoute('offices', async function() {
  let list = []
  let showM = false, editId = null
  let f = { name: '', code: '', address: '', description: '', latitude: '', longitude: '', radius_meters: 100 }

  async function load() {
    try {
      const d = await api.get('/api/offices')
      list = Array.isArray(d) ? d : (d.data || [])
    } catch {}
    render()
  }

  function render() {
    const m = showM ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._ofClose()">
        <div class="modal">
          <div class="modal-header"><h2>${editId?'Sửa văn phòng':'Thêm văn phòng'}</h2><button type="button" class="modal-close" onclick="window._ofClose()">✕</button></div>
          <form id="offForm">
            <div class="modal-body">
              <div class="modal-form-row cols-2">
                <div class="form-group"><label>Tên văn phòng *</label><input type="text" name="name" value="${f.name||''}" required /></div>
                <div class="form-group"><label>Mã văn phòng</label><input type="text" name="code" value="${f.code||''}" placeholder="VD: VP-001" /></div>
              </div>
              <div class="form-group">
                <label>Địa chỉ</label>
                <div style="display:flex;gap:8px;align-items:flex-start">
                  <input type="text" name="address" id="offAddress" value="${f.address||''}" placeholder="VD: 123 Nguyễn Huệ, Q1, TP.HCM" style="flex:1" />
                  <button type="button" id="btnPickMap" style="white-space:nowrap;padding:8px 14px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:#0f2942;flex-shrink:0">
                    <span style="font-size:14px;vertical-align:middle;margin-right:4px">📍</span> Chọn trên bản đồ
                  </button>
                </div>
              </div>
              <div class="form-group"><label>Mô tả</label><input type="text" name="description" value="${f.description||''}" /></div>
              <div class="modal-form-row cols-3">
                <div class="form-group">
                  <label>Vĩ độ (Latitude)</label>
                  <input type="number" step="any" name="latitude" id="offLat" value="${f.latitude||''}" placeholder="VD: 10.8231" />
                </div>
                <div class="form-group">
                  <label>Kinh độ (Longitude)</label>
                  <input type="number" step="any" name="longitude" id="offLng" value="${f.longitude||''}" placeholder="VD: 106.6297" />
                </div>
                <div class="form-group">
                  <label>Bán kính (m)</label>
                  <input type="number" name="radius_meters" value="${f.radius_meters||100}" min="50" placeholder="VD: 100" />
                  <small style="color:#94a3b8">Tối thiểu 50m</small>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="window._ofClose()">Hủy</button>
              <button type="submit" class="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      </div>` : ''

    renderPage('Văn phòng / Chi nhánh', `
      <div style="margin-bottom:16px;padding:12px 16px;background:#f0f7ff;border-radius:10px;font-size:14px;color:#1e40af">
        Quản lý địa điểm văn phòng, chi nhánh, cửa hàng của công ty.
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <label for="offImportFile" class="btn-secondary" style="cursor:pointer;display:flex;align-items:center;gap:6px">
          <span class="material-symbols-rounded" style="font-size:18px">upload_file</span> Import CSV
        </label>
        <input type="file" id="offImportFile" accept=".csv,.xlsx,.xls" style="display:none" />
        <button type="button" class="btn-create" id="btnAddOff">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Thêm văn phòng
        </button>
      </div>
      <div id="offImportResult" style="margin-bottom:16px;display:none" class="alert-box"></div>
      ${list.length===0 ? emptyState('business','Chưa có văn phòng nào.') : `
        <table>
          <thead><tr><th>ID</th><th>Mã</th><th>Tên văn phòng</th><th>Địa chỉ</th><th>Tọa độ</th><th>Bán kính</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${list.map(o=>`<tr>
              <td>${o.id}</td><td>${o.code||'-'}</td><td style="font-weight:600">${o.name}</td>
              <td style="color:#64748b">${o.address||'-'}</td>
              <td style="color:#64748b">${o.latitude && o.longitude ? `${parseFloat(o.latitude).toFixed(5)}, ${parseFloat(o.longitude).toFixed(5)}` : '-'}</td>
              <td>${o.radius_meters ? o.radius_meters+'m' : '-'}</td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" data-edit="${o.id}">Sửa</button>
                <button type="button" class="btn-action danger" style="padding:6px 10px" data-del="${o.id}">Xóa</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
      ${m}
    `, showM)

    $on($sel('#btnAddOff'), 'click', () => { editId=null; f={name:'',code:'',address:'',description:'',latitude:'',longitude:'',radius_meters:100}; showM=true; render() })
    $selAll('[data-edit]').forEach(b=>$on(b,'click',()=>{const o=list.find(x=>x.id==b.dataset.edit);editId=o.id;f={name:o.name,code:o.code||'',address:o.address||'',description:o.description||'',latitude:o.latitude||'',longitude:o.longitude||'',radius_meters:o.radius_meters||100};showM=true;render()}))
    $selAll('[data-del]').forEach(b=>$on(b,'click',async()=>{if(!confirm('Xóa văn phòng này?'))return;try{await api.delete(`/api/offices/${b.dataset.del}`);toast$.success('Đã xóa.');load()}catch(e){toast$.error(e.message)}}))
    if(showM)$on($sel('#offForm'),'submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);try{if(editId)await api.patch(`/api/offices/${editId}`,fd);else await api.post('/api/offices',fd);toast$.success('Đã lưu.');showM=false;load()}catch(e){toast$.error(e.message)}})
    window._ofClose=()=>{showM=false;render()}

    if(showM && $sel('#btnPickMap')) {
      $on($sel('#btnPickMap'), 'click', () => {
        const lat = $sel('#offLat').value
        const lng = $sel('#offLng').value
        showOfficeMapPicker({
          lat: lat,
          lng: lng,
          radius: f.radius_meters,
          onConfirm: (newLat, newLng, addr) => {
            $sel('#offLat').value = newLat
            $sel('#offLng').value = newLng
            f.latitude = newLat
            f.longitude = newLng
            if (addr) {
              $sel('#offAddress').value = addr
              f.address = addr
            }
          }
        })
      })
    }

    // Import handler
    $on($sel('#offImportFile'), 'change', async e => {
      const file = e.target.files[0]
      if (!file) return
      const fd = new FormData(); fd.append('file', file)
      try {
        const result = await fetch('/api/offices/import', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + safeGetItem('token') },
          body: fd
        }).then(r => r.json())
        const box = $sel('#offImportResult')
        if (result.ok) {
          box.style.display = 'block'; box.style.background = '#d1fae5'; box.style.color = '#065f46'
          box.innerHTML = `Import thành công! Tạo mới: ${result.created}, Cập nhật: ${result.updated}${result.errors.length ? '<br>Lỗi: ' + result.errors.join('; ') : ''}`
          load()
        } else {
          box.style.display = 'block'; box.style.background = '#fee2e2'; box.style.color = '#991b1b'
          box.textContent = 'Lỗi: ' + result.error
        }
      } catch { toast$.error('Import thất bại.') }
      e.target.value = ''
    })
  }
  await load()
});

// ── Employee Types Page ────────────────────────────────────────────────────────
registerRoute('employee-types', async function() {
  let list = []
  let showM = false, editId = null
  let f = { name: '', code: '', description: '' }

  async function load() {
    try {
      const d = await api.get('/api/employee-types')
      list = Array.isArray(d) ? d : (d.data || [])
    } catch {}
    render()
  }

  function render() {
    const m = showM ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._etClose()">
        <div class="modal">
          <div class="modal-header"><h2>${editId?'Sửa loại nhân viên':'Thêm loại nhân viên'}</h2><button type="button" class="modal-close" onclick="window._etClose()">✕</button></div>
          <form id="etForm">
            <div class="modal-body">
              <div class="modal-form-row cols-2">
                <div class="form-group"><label>Tên loại nhân viên *</label><input type="text" name="name" value="${f.name||''}" required placeholder="VD: Full-time" /></div>
                <div class="form-group"><label>Mã loại</label><input type="text" name="code" value="${f.code||''}" placeholder="VD: FT" /></div>
              </div>
              <div class="form-group"><label>Mô tả</label><input type="text" name="description" value="${f.description||''}" /></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="window._etClose()">Hủy</button>
              <button type="submit" class="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      </div>` : ''

    renderPage('Loại nhân viên', `
      <div style="margin-bottom:16px;padding:12px 16px;background:#f0fdf4;border-radius:10px;font-size:14px;color:#166534">
        Quản lý các loại nhân viên: Full-time, Part-time, Thực tập, Cộng tác viên...
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <label for="etImportFile" class="btn-secondary" style="cursor:pointer;display:flex;align-items:center;gap:6px">
          <span class="material-symbols-rounded" style="font-size:18px">upload_file</span> Import CSV
        </label>
        <input type="file" id="etImportFile" accept=".csv,.xlsx,.xls" style="display:none" />
        <button type="button" class="btn-create" id="btnAddEt">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Thêm loại nhân viên
        </button>
      </div>
      <div id="etImportResult" style="margin-bottom:16px;display:none" class="alert-box"></div>
      ${list.length===0 ? emptyState('badge','Chưa có loại nhân viên nào.') : `
        <table>
          <thead><tr><th>ID</th><th>Mã</th><th>Tên loại nhân viên</th><th>Mô tả</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${list.map(et=>`<tr>
              <td>${et.id}</td><td>${et.code||'-'}</td><td style="font-weight:600">${et.name}</td><td style="color:#64748b">${et.description||'-'}</td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" data-edit="${et.id}">Sửa</button>
                <button type="button" class="btn-action danger" style="padding:6px 10px" data-del="${et.id}">Xóa</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
      ${m}
    `, showM)

    $on($sel('#btnAddEt'), 'click', () => { editId=null; f={name:'',code:'',description:''}; showM=true; render() })
    $selAll('[data-edit]').forEach(b=>$on(b,'click',()=>{const et=list.find(x=>x.id==b.dataset.edit);editId=et.id;f={name:et.name,code:et.code||'',description:et.description||''};showM=true;render()}))
    $selAll('[data-del]').forEach(b=>$on(b,'click',async()=>{if(!confirm('Xóa loại nhân viên này?'))return;try{await api.delete(`/api/employee-types/${b.dataset.del}`);toast$.success('Đã xóa.');load()}catch(e){toast$.error(e.message)}}))
    if(showM)$on($sel('#etForm'),'submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);try{if(editId)await api.patch(`/api/employee-types/${editId}`,fd);else await api.post('/api/employee-types',fd);toast$.success('Đã lưu.');showM=false;load()}catch(e){toast$.error(e.message)}})
    window._etClose=()=>{showM=false;render()}

    // Import handler
    $on($sel('#etImportFile'), 'change', async e => {
      const file = e.target.files[0]
      if (!file) return
      const fd = new FormData(); fd.append('file', file)
      try {
        const result = await fetch('/api/employee-types/import', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + safeGetItem('token') },
          body: fd
        }).then(r => r.json())
        const box = $sel('#etImportResult')
        if (result.ok) {
          box.style.display = 'block'; box.style.background = '#d1fae5'; box.style.color = '#065f46'
          box.innerHTML = `Import thành công! Tạo mới: ${result.created}, Cập nhật: ${result.updated}${result.errors.length ? '<br>Lỗi: ' + result.errors.join('; ') : ''}`
          load()
        } else {
          box.style.display = 'block'; box.style.background = '#fee2e2'; box.style.color = '#991b1b'
          box.textContent = 'Lỗi: ' + result.error
        }
      } catch { toast$.error('Import thất bại.') }
      e.target.value = ''
    })
  }
  await load()
});

// ── Salary Policies Page ───────────────────────────────────────────────────────
registerRoute('salary-policies', async function() {
  let list = []
  let showM = false, editId = null
  let f = { name: '', code: '', description: '', pay_frequency: 'monthly', standard_work_days: 26, standard_hours_per_day: 8, overtime_multiplier: 1.5 }

  const freqLabels = { monthly: 'Hàng tháng', weekly: 'Hàng tuần', biweekly: '2 tuần/lần', daily: 'Hàng ngày', hourly: 'Theo giờ' }

  async function load() {
    try {
      const d = await api.get('/api/salary-policies')
      list = Array.isArray(d) ? d : (d.data || [])
    } catch {}
    render()
  }

  function render() {
    const m = showM ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._spClose()">
        <div class="modal">
          <div class="modal-header"><h2>${editId?'Sửa chính sách lương':'Thêm chính sách lương'}</h2><button type="button" class="modal-close" onclick="window._spClose()">✕</button></div>
          <form id="spForm">
            <div class="modal-body">
              <div class="modal-form-row cols-2">
                <div class="form-group"><label>Tên chính sách *</label><input type="text" name="name" value="${f.name||''}" required placeholder="VD: Lương tháng" /></div>
                <div class="form-group"><label>Mã</label><input type="text" name="code" value="${f.code||''}" placeholder="VD: L-thang" /></div>
              </div>
              <div class="form-group"><label>Kỳ trả lương</label>
                <select name="pay_frequency">
                  <option value="monthly" ${f.pay_frequency==='monthly'?'selected':''}>Hàng tháng</option>
                  <option value="weekly" ${f.pay_frequency==='weekly'?'selected':''}>Hàng tuần</option>
                  <option value="biweekly" ${f.pay_frequency==='biweekly'?'selected':''}>2 tuần/lần</option>
                  <option value="daily" ${f.pay_frequency==='daily'?'selected':''}>Hàng ngày</option>
                  <option value="hourly" ${f.pay_frequency==='hourly'?'selected':''}>Theo giờ</option>
                </select>
              </div>
              <div class="modal-form-row cols-3">
                <div class="form-group"><label>Ngày công chuẩn/tháng</label><input type="number" name="standard_work_days" value="${f.standard_work_days||26}" min="1" /></div>
                <div class="form-group"><label>Giờ làm/ngày</label><input type="number" name="standard_hours_per_day" value="${f.standard_hours_per_day||8}" min="1" step="0.5" /></div>
                <div class="form-group"><label>Hệ số OT</label><input type="number" name="overtime_multiplier" value="${f.overtime_multiplier||1.5}" min="1" step="0.1" /></div>
              </div>
              <div class="form-group"><label>Mô tả</label><input type="text" name="description" value="${f.description||''}" /></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="window._spClose()">Hủy</button>
              <button type="submit" class="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      </div>` : ''

    renderPage('Chính sách lương', `
      <div style="margin-bottom:16px;padding:12px 16px;background:#fef3c7;border-radius:10px;font-size:14px;color:#92400e">
        Định nghĩa cách tính lương: kỳ trả lương (tháng/tuần/ngày), ngày công chuẩn, giờ làm/ngày, hệ số tăng ca.
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <label for="spImportFile" class="btn-secondary" style="cursor:pointer;display:flex;align-items:center;gap:6px">
          <span class="material-symbols-rounded" style="font-size:18px">upload_file</span> Import CSV
        </label>
        <input type="file" id="spImportFile" accept=".csv,.xlsx,.xls" style="display:none" />
        <button type="button" class="btn-create" id="btnAddSp">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Thêm chính sách
        </button>
      </div>
      <div id="spImportResult" style="margin-bottom:16px;display:none" class="alert-box"></div>
      ${list.length===0 ? emptyState('payments','Chưa có chính sách lương nào.') : `
        <table>
          <thead><tr><th>ID</th><th>Mã</th><th>Tên</th><th>Kỳ trả</th><th>Ngày công</th><th>Giờ/ngày</th><th>Hệ số OT</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${list.map(sp=>`<tr>
              <td>${sp.id}</td><td>${sp.code||'-'}</td><td style="font-weight:600">${sp.name}</td>
              <td>${freqLabels[sp.pay_frequency]||sp.pay_frequency||'Tháng'}</td>
              <td>${sp.standard_work_days||26} ngày</td><td>${sp.standard_hours_per_day||8}h</td>
              <td>${sp.overtime_multiplier||1.5}x</td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" data-edit="${sp.id}">Sửa</button>
                <button type="button" class="btn-action danger" style="padding:6px 10px" data-del="${sp.id}">Xóa</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
      ${m}
    `, showM)

    $on($sel('#btnAddSp'), 'click', () => { editId=null; f={name:'',code:'',description:'',pay_frequency:'monthly',standard_work_days:26,standard_hours_per_day:8,overtime_multiplier:1.5}; showM=true; render() })
    $selAll('[data-edit]').forEach(b=>$on(b,'click',()=>{const sp=list.find(x=>x.id==b.dataset.edit);editId=sp.id;f={name:sp.name,code:sp.code||'',description:sp.description||'',pay_frequency:sp.pay_frequency||'monthly',standard_work_days:sp.standard_work_days||26,standard_hours_per_day:sp.standard_hours_per_day||8,overtime_multiplier:sp.overtime_multiplier||1.5};showM=true;render()}))
    $selAll('[data-del]').forEach(b=>$on(b,'click',async()=>{if(!confirm('Xóa chính sách này?'))return;try{await api.delete(`/api/salary-policies/${b.dataset.del}`);toast$.success('Đã xóa.');load()}catch(e){toast$.error(e.message)}}))
    if(showM)$on($sel('#spForm'),'submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);try{if(editId)await api.patch(`/api/salary-policies/${editId}`,fd);else await api.post('/api/salary-policies',fd);toast$.success('Đã lưu.');showM=false;load()}catch(e){toast$.error(e.message)}})
    window._spClose=()=>{showM=false;render()}

    // Import handler
    $on($sel('#spImportFile'), 'change', async e => {
      const file = e.target.files[0]
      if (!file) return
      const fd = new FormData(); fd.append('file', file)
      try {
        const result = await fetch('/api/salary-policies/import', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + safeGetItem('token') },
          body: fd
        }).then(r => r.json())
        const box = $sel('#spImportResult')
        if (result.ok) {
          box.style.display = 'block'; box.style.background = '#d1fae5'; box.style.color = '#065f46'
          box.innerHTML = `Import thành công! Tạo mới: ${result.created}, Cập nhật: ${result.updated}${result.errors.length ? '<br>Lỗi: ' + result.errors.join('; ') : ''}`
          load()
        } else {
          box.style.display = 'block'; box.style.background = '#fee2e2'; box.style.color = '#991b1b'
          box.textContent = 'Lỗi: ' + result.error
        }
      } catch { toast$.error('Import thất bại.') }
      e.target.value = ''
    })
  }
  await load()
});

// ── Positions Page ───────────────────────────────────────────────────────────
// ── Attendance Page ─────────────────────────────────────────────────────────
registerRoute('attendance', async function() {
  let month = new Date().toISOString().slice(0, 7)
  let search = ''
  let type = ''
  let list = []

  async function load() {
    const params = new URLSearchParams({ month })
    if (search) params.set('search', search)
    if (type) params.set('type', type)
    try {
      const d = await api.get(`/api/attendance?${params}`)
      list = Array.isArray(d) ? d : (d.data || [])
    } catch { toast$.error('Không tải được dữ liệu.') }
    render()
  }

  function handleExport() {
    const aoa = [['ID', 'Nhân viên', 'Mã', 'Loại', 'Thời gian', 'Vị trí']]
    list.forEach(a => {
      aoa.push([
        a.id,
        a.employee_name || a.name || '',
        a.employee_code || '',
        a.type === 'in' ? 'Vào' : a.type === 'out' ? 'Ra' : 'Ngoài',
        fmtDateTime(a.timestamp),
        a.lat && a.lng ? `${a.lat},${a.lng}` : '-',
      ])
    })
    exportToXlsx(aoa, `lich_su_cham_cong_${month}.xlsx`, 'Chấm công')
  }

  function render() {
    renderPage('Lịch sử chấm công', `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <select id="attMonthSelect" style="padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px"></select>
          <input type="month" id="attMonth" value="${month}" style="display:none" />
          <input type="text" id="attSearch" placeholder="Tên hoặc mã NV..." value="${search}"
            style="padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;flex:1;min-width:200px" />
          <select id="attType" style="padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px">
            <option value="">Tất cả loại</option>
            <option value="in" ${type==='in'?'selected':''}>Vào ca</option>
            <option value="out" ${type==='out'?'selected':''}>Ra ca</option>
            <option value="outside" ${type==='outside'?'selected':''}>Ra ngoài</option>
          </select>
        </div>
        <button type="button" class="btn-secondary" id="btnExportAtt">
          <span class="material-symbols-rounded" style="font-size:18px">table_chart</span> Excel
        </button>
      </div>
      ${list.length===0 ? emptyState('history','Chưa có bản ghi chấm công.') : `
        <table>
          <thead><tr><th>ID</th><th>Nhân viên</th><th>Mã</th><th>Loại</th><th>Thời gian</th><th>Vị trí</th></tr></thead>
          <tbody>
            ${list.map(a=>`<tr>
              <td>${a.id}</td><td style="font-weight:600">${a.employee_name||a.name||'-'}</td><td>${a.employee_code||''}</td>
              <td><span style="padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:${a.type==='in'?'#dcfce7':a.type==='out'?'#e0f2fe':'#fef9c3'};color:${a.type==='in'?'#166534':a.type==='out'?'#075985':'#854d0e'}">${a.type==='in'?'Vào':a.type==='out'?'Ra':'Ngoài'}</span></td>
              <td>${fmtDateTime(a.timestamp)}</td>
              <td style="color:#64748b">${a.lat&&a.lng?`${parseFloat(a.lat).toFixed(4)}, ${parseFloat(a.lng).toFixed(4)}`:'-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
    `)

    buildMonthOptions('#attMonthSelect', month)
    $on($sel('#attMonthSelect'), 'change', e => { month = e.target.value; $sel('#attMonth').value = month; load() })
    let st; $on($sel('#attSearch'), 'input', e => { search = e.target.value; clearTimeout(st); st = setTimeout(load, 400) })
    $on($sel('#attType'), 'change', e => { type = e.target.value; load() })
    $on($sel('#btnExportAtt'), 'click', handleExport)
  }

  await load()
});


// ── Leave Requests Page ──────────────────────────────────────────────────────
registerRoute('leave-requests', async function() {
  let list = []
  let filter = ''

  async function load() {
    const params = filter ? `?status=${filter}` : ''
    try {
      const d = await api.get(`/api/leave-requests${params}`)
      list = Array.isArray(d) ? d : (d.data || [])
    } catch { toast$.error('Không tải được.') }
    render()
  }

  async function action(id, act) {
    try {
      await api.post(`/api/leave-requests/${id}/${act}`)
      toast$.success(`Đã ${act==='approve'?'duyệt':'từ chối'} đơn.`)
      load()
    } catch (e) { toast$.error(e.message || 'Lỗi xử lý.') }
  }

  function render() {
    renderPage('Đơn xin nghỉ', `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <select id="lrFilter" style="padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px">
          <option value="">Tất cả</option>
          <option value="pending" ${filter==='pending'?'selected':''}>Chờ duyệt</option>
          <option value="approved" ${filter==='approved'?'selected':''}>Đã duyệt</option>
          <option value="rejected" ${filter==='rejected'?'selected':''}>Từ chối</option>
        </select>
      </div>
      ${list.length===0 ? emptyState('event_busy','Chưa có đơn nào.') : `
        <table>
          <thead><tr><th>ID</th><th>Nhân viên</th><th>Từ ngày</th><th>Đến ngày</th><th>Loại</th><th>Lý do</th><th>Trạng thái</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${list.map(r=>`<tr>
              <td>${r.id}</td><td style="font-weight:600">${r.employee_name||r.name||'-'}</td>
              <td>${r.start_date||''}</td><td>${r.end_date||''}</td>
              <td>${r.type||'Nghỉ phép'}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b">${r.reason||'-'}</td>
              <td><span style="padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:${r.status==='approved'?'#dcfce7':r.status==='rejected'?'#fee2e2':'#fef9c3'};color:${r.status==='approved'?'#166534':r.status==='rejected'?'#991b1b':'#92400e'}">${r.status==='approved'?'Đã duyệt':r.status==='rejected'?'Từ chối':'Chờ duyệt'}</span></td>
              <td style="text-align:right">
                ${r.status==='pending'?`<button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" data-appr="${r.id}">Duyệt</button><button type="button" class="btn-action danger" style="padding:6px 10px" data-rej="${r.id}">Từ chối</button>`:''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
    `)

    $on($sel('#lrFilter'), 'change', e => { filter = e.target.value; load() })
    $selAll('[data-appr]').forEach(b => $on(b,'click',()=>action(b.dataset.appr,'approve')))
    $selAll('[data-rej]').forEach(b => $on(b,'click',()=>action(b.dataset.rej,'reject')))
  }

  await load()
});

// ── Chat Page ───────────────────────────────────────────────────────────────
registerRoute('chat', async function() {
  let conversations = []
  let selectedEmployee = null
  let messages = []
  let text = ''
  let selectedFile = null

  async function loadConversations() {
    try {
      const d = await api.get('/api/chat/conversations')
      conversations = Array.isArray(d) ? d : []
    } catch { conversations = [] }
    render()
  }

  async function loadMessages(empId) {
    try {
      const d = await api.get(`/api/chat/messages?employee_id=${empId}`)
      messages = d.items || []
    } catch { messages = [] }
    render()
  }

  async function send(e) {
    e.preventDefault()
    const msgText = text.trim()
    if (!msgText && !selectedFile) return
    try {
      const fd = new FormData()
      fd.append('message', msgText)
      if (selectedEmployee) {
        fd.append('employee_id', selectedEmployee.employee_id)
      }
      if (selectedFile) {
        fd.append('file', selectedFile)
      }
      await api.post('/api/chat/messages', fd)
      text = ''
      selectedFile = null
      const preview = document.getElementById('imgPreview')
      const previewName = document.getElementById('imgPreviewName')
      if (preview) preview.style.display = 'none'
      if (previewName) previewName.textContent = ''
      const imgInput = document.getElementById('chatImgInput')
      if (imgInput) imgInput.value = ''
      loadMessages(selectedEmployee.employee_id)
    } catch (e) { toast$.error(e.message || 'Lỗi gửi tin nhắn.') }
  }

  function selectConversation(conv) {
    selectedEmployee = conv
    loadMessages(conv.employee_id)
  }

  function render() {
    const convListHtml = conversations.length === 0
      ? '<div style="padding:16px;color:#94a3b8;text-align:center">Chưa có cuộc hội thoại nào.</div>'
      : conversations.map(c => `
          <div class="conv-item ${selectedEmployee?.employee_id === c.employee_id ? 'active' : ''}"
               onclick="window._selectConv(${c.employee_id})" style="cursor:pointer">
            <div style="font-weight:600">${c.employee_name || '-'}</div>
            <div style="font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.last_message || '...'}</div>
            ${c.unread_count > 0 ? `<span style="background:#ef4444;color:#fff;border-radius:99px;padding:2px 6px;font-size:10px">${c.unread_count}</span>` : ''}
          </div>
        `).join('')

    function formatMessageWithImages(m) {
      const parts = []
      const isImage = m.attachment_type && m.attachment_type.startsWith('image/')
      const msg = m.message || ''
      
      if (!msg && isImage) {
        // Nếu không có message nhưng có ảnh đính kèm
        parts.push(`<div style="margin:4px 0;padding:6px 10px;background:${m.sender_type === 'admin' ? 'rgba(255,255,255,0.15)' : '#e2e8f0'};border-radius:8px;font-size:13px">
          <strong>image1_content:</strong> <span style="opacity:0.7">[Ảnh đính kèm: ${m.attachment_name || 'image'}]</span>
        </div>`)
        return parts.join('')
      }
      
      if (msg) {
        // Format: image1_content: nội dung -> hiển thị đẹp
        const imgPattern = /(image\d+_content:)([^\n]*)/gi
        let result = msg
        let imgCount = 0
        
        result = result.replace(imgPattern, (match, label, content) => {
          imgCount++
          const bgStyle = m.sender_type === 'admin' ? 'rgba(255,255,255,0.15)' : '#e2e8f0'
          const textColor = m.sender_type === 'admin' ? '#fff' : '#334155'
          return `<div style="margin:4px 0;padding:6px 10px;background:${bgStyle};border-radius:8px;font-size:13px;line-height:1.4">
  <strong style="color:${m.sender_type === 'admin' ? '#93c5fd' : '#3b82f6'}">${label}</strong> <span style="color:${textColor}">${content || '[Nội dung ảnh]'}</span>
</div>`
        })
        
        // Nếu không có pattern nào được thay thế, hiển thị message thường
        if (imgCount === 0) {
          result = `<div style="white-space:pre-wrap">${msg}</div>`
        }
        
        parts.push(result)
      }
      
      return parts.join('')
    }

    const msgListHtml = messages.length === 0
      ? '<div style="text-align:center;color:#94a3b8;padding:40px">Chưa có tin nhắn nào.</div>'
      : messages.map(m => `
          <div style="display:flex;flex-direction:column;align-items:${m.sender_type === 'admin' ? 'flex-end' : 'flex-start'}">
            <div style="max-width:70%;padding:10px 14px;border-radius:12px;background:${m.sender_type === 'admin' ? '#1a365d' : '#f1f5f9'};color:${m.sender_type === 'admin' ? '#fff' : '#334155'};font-size:14px">
              <div style="font-weight:600;font-size:12px;margin-bottom:2px;opacity:0.7">${m.sender_display_name || (m.sender_type === 'admin' ? 'Admin' : 'Nhân viên')}</div>
              ${formatMessageWithImages(m)}
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px">${fmtDateTime(m.created_at)}</div>
          </div>`).join('')

    renderPage('Nhắn tin nội bộ', `
      <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;height:calc(100vh - 200px)" class="chat-grid">
        <div class="chart-card" style="overflow-y:auto;padding:0">
          <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-weight:600">Danh sách hội thoại</div>
          ${convListHtml}
        </div>
        <div class="chart-card" style="display:flex;flex-direction:column">
          ${selectedEmployee ? `
            <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;font-weight:600">
              ${selectedEmployee.employee_name || 'Nhân viên'}
              ${selectedEmployee.department ? `<span style="font-weight:normal;color:#64748b;font-size:12px;margin-left:8px">${selectedEmployee.department}</span>` : ''}
            </div>
            <div id="chatMsgs" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:16px">
              ${msgListHtml}
            </div>
          ` : `
            <div style="flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8">
              Chọn một cuộc hội thoại để bắt đầu
            </div>
          `}
          ${selectedEmployee ? `
            <form id="chatForm" style="display:flex;gap:8px;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:8px;align-items:center">
              <label for="chatImgInput" style="cursor:pointer;padding:8px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center" title="Gửi ảnh">
                <span class="material-symbols-rounded" style="font-size:20px;color:#64748b">image</span>
              </label>
              <input type="file" id="chatImgInput" accept="image/*" style="display:none" />
              <input type="text" id="chatInput" value="${text}" placeholder="Nhập tin nhắn..."
                style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px" />
              <button type="submit" class="btn-primary" style="padding:10px 16px">
                <span class="material-symbols-rounded" style="font-size:20px">send</span>
              </button>
            </form>
            <div id="imgPreview" style="display:none;padding:8px 16px;background:#f8fafc;border-top:1px solid #e2e8f0">
              <span style="font-size:12px;color:#64748b">Ảnh đã chọn: </span>
              <span id="imgPreviewName" style="font-size:12px;color:#334155"></span>
              <button type="button" onclick="window._clearImg()" style="margin-left:8px;padding:2px 8px;background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer">Xóa</button>
            </div>
          ` : ''}
        </div>
      </div>
      <style>
        .conv-item { padding:12px 16px; border-bottom:1px solid #f1f5f9; }
        .conv-item:hover { background:#f8fafc; }
        .conv-item.active { background:#eff6ff; }
        @media(max-width:700px){.chat-grid{grid-template-columns:1fr!important}}
      </style>
    `)

    if (selectedEmployee) {
      const chatMsgs = $sel('#chatMsgs')
      if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight
      $on($sel('#chatInput'), 'input', e => { text = e.target.value })
      $on($sel('#chatForm'), 'submit', send)
      $on($sel('#chatImgInput'), 'change', e => {
        const file = e.target.files && e.target.files[0]
        selectedFile = file || null
        const preview = document.getElementById('imgPreview')
        const previewName = document.getElementById('imgPreviewName')
        if (preview && previewName) {
          if (file) {
            preview.style.display = 'block'
            previewName.textContent = file.name
          } else {
            preview.style.display = 'none'
            previewName.textContent = ''
          }
        }
      })
    }

    window._selectConv = (empId) => {
      const conv = conversations.find(c => c.employee_id === empId)
      if (conv) selectConversation(conv)
    }

    window._clearImg = () => {
      selectedFile = null
      const imgInput = document.getElementById('chatImgInput')
      const preview = document.getElementById('imgPreview')
      const previewName = document.getElementById('imgPreviewName')
      if (imgInput) imgInput.value = ''
      if (preview) preview.style.display = 'none'
      if (previewName) previewName.textContent = ''
    }
  }

  await loadConversations()
  _activeTimer = setInterval(loadConversations, 8000)
})

// ── Account Page ────────────────────────────────────────────────────────────
registerRoute('account', async function() {
  let admin = null
  let users = []
  let activeTab = 'profile'

  async function load() {
    try { admin = await api.get('/api/admin/profile') } catch {}
    try { users = await api.get('/api/admin/users') } catch {}
    render()
  }

  function render() {
    renderPage('Tài khoản', `
    <div style="margin-bottom:16px;display:flex;gap:8px">
      <button type="button" class="${activeTab==='profile'?'btn-primary':'btn-secondary'}" onclick="window._accTab('profile')">Thông tin cá nhân</button>
      <button type="button" class="${activeTab==='users'?'btn-primary':'btn-secondary'}" onclick="window._accTab('users')">Quản lý tài khoản</button>
    </div>

    ${activeTab==='profile' ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:800px" class="acc-grid">
      <div class="chart-card">
        <h3 style="margin:0 0 16px">Thông tin cá nhân</h3>
        <form id="accForm">
          <div class="form-group"><label>Họ tên</label><input type="text" name="employee_name" value="${admin?.display_name || admin?.employee_name || ''}" /></div>
          <div class="form-group"><label>Email</label><input type="email" name="email" value="${admin?.email || ''}" /></div>
          <div class="form-group"><label>Điện thoại</label><input type="tel" name="phone" value="${admin?.phone || ''}" /></div>
          <button type="submit" class="btn-primary">Lưu</button>
        </form>
      </div>
      <div class="chart-card">
        <h3 style="margin:0 0 16px">Đổi mật khẩu</h3>
        <form id="passForm">
          <div class="form-group"><label>Mật khẩu hiện tại</label><input type="password" name="current" /></div>
          <div class="form-group"><label>Mật khẩu mới</label><input type="password" name="new_pass" /></div>
          <div class="form-group"><label>Xác nhận mật khẩu mới</label><input type="password" name="confirm" /></div>
          <button type="submit" class="btn-primary">Đổi mật khẩu</button>
        </form>
      </div>
    </div>
    ` : `
    <div class="chart-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">Danh sách tài khoản admin</h3>
        <button type="button" class="btn-create" id="btnAddAdmin">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Thêm tài khoản
        </button>
      </div>
      ${users.length===0 ? '<p style="color:#64748b">Chưa có tài khoản nào.</p>' : `
        <table>
          <thead><tr><th>ID</th><th>Tên đăng nhập</th><th>Tên hiển thị</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${users.map(u=>`<tr>
              <td>${u.id}</td><td style="font-weight:600">${u.username}</td>
              <td>${u.display_name || '-'}</td>
              <td>${u.email || '-'}</td>
              <td><span style="padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:${u.role==='superadmin'?'#dbeafe':'#f0fdf4'};color:${u.role==='superadmin'?'#1d4ed8':'#166534'}">${u.role==='superadmin'?'Superadmin':'Admin'}</span></td>
              <td><span style="padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;background:${u.is_active?'#dcfce7':'#fee2e2'};color:${u.is_active?'#166534':'#991b1b'}">${u.is_active?'Hoạt động':'Khóa'}</span></td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" onclick="window._editAdmin(${u.id})">Sửa</button>
                <button type="button" class="btn-action danger" style="padding:6px 10px" onclick="window._delAdmin(${u.id},'${u.username}')">Xóa</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div id="adminFormModal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.5);align-items:center;justify-content:center">
      <div style="background:#fff;padding:24px;border-radius:12px;width:420px;max-width:95vw">
        <h3 id="adminFormTitle" style="margin:0 0 20px">Thêm tài khoản</h3>
        <form id="adminUserForm">
          <input type="hidden" id="editAdminId" />
          <div class="form-group"><label>Tên đăng nhập *</label><input type="text" id="fUsername" required /></div>
          <div class="form-group"><label>Mật khẩu *</label><input type="password" id="fPassword" /></div>
          <div class="form-group"><label>Tên hiển thị</label><input type="text" id="fDisplayName" /></div>
          <div class="form-group"><label>Email</label><input type="email" id="fEmail" /></div>
          <div class="form-group"><label>Điện thoại</label><input type="tel" id="fPhone" /></div>
          <div class="form-group"><label>Vai trò</label>
            <select id="fRole">
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <div class="form-group"><label>Trạng thái</label>
            <select id="fActive">
              <option value="1">Hoạt động</option>
              <option value="0">Khóa</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
            <button type="button" class="btn-secondary" onclick="window._closeAdminForm()">Hủy</button>
            <button type="submit" class="btn-primary">Lưu</button>
          </div>
        </form>
      </div>
    </div>
    `}

    <style>@media(max-width:600px){.acc-grid{grid-template-columns:1fr!important}}</style>
  `)}
  

  window._accTab = (tab) => { activeTab = tab; render() }

  window._editAdmin = (id) => {
    const u = users.find(x => x.id === id)
    if (!u) return
    $sel('#editAdminId').value = id
    $sel('#adminFormTitle').textContent = 'Sửa tài khoản'
    $sel('#fUsername').value = u.username
    $sel('#fUsername').disabled = true
    $sel('#fPassword').value = ''
    $sel('#fPassword').placeholder = 'Để trống nếu không đổi'
    $sel('#fDisplayName').value = u.display_name || ''
    $sel('#fEmail').value = u.email || ''
    $sel('#fPhone').value = u.phone || ''
    $sel('#fRole').value = u.role || 'admin'
    $sel('#fActive').value = u.is_active ? '1' : '0'
    $sel('#adminFormModal').style.display = 'flex'
  }

  window._delAdmin = async (id, username) => {
    if (!confirm(`Xóa tài khoản "${username}"?`)) return
    try {
      await api.delete(`/api/admin/users/${id}`)
      toast$.success('Đã xóa.')
      load()
    } catch (e) { toast$.error(e.message) }
  }

  window._closeAdminForm = () => {
    $sel('#adminFormModal').style.display = 'none'
    $sel('#editAdminId').value = ''
    $sel('#fUsername').disabled = false
    $sel('#fUsername').value = ''
    $sel('#fPassword').value = ''
    $sel('#fDisplayName').value = ''
    $sel('#fEmail').value = ''
    $sel('#fPhone').value = ''
    $sel('#fRole').value = 'admin'
    $sel('#fActive').value = '1'
  }

  $on($sel('#accForm'), 'submit', async e => {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      const data = {
        email: fd.get('email'),
        phone: fd.get('phone'),
      }
      if (fd.get('employee_name')) {
        data.employee_name = fd.get('employee_name')
      }
      await api.put('/api/admin/profile', data)
      toast$.success('Thông tin đã được lưu.')
    } catch (err) {
      toast$.error(err.message || 'Lỗi lưu.')
    }
  })

  $on($sel('#passForm'), 'submit', async e => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const current = fd.get('current')
    const newPass = fd.get('new_pass')
    const confirm = fd.get('confirm')
    if (!current || !newPass || !confirm) {
      toast$.error('Vui lòng điền đầy đủ các trường.')
      return
    }
    if (newPass !== confirm) {
      toast$.error('Mật khẩu mới không khớp.')
      return
    }
    try {
      await api.post('/api/admin/change-password', { current, new_password: newPass })
      toast$.success('Đã đổi mật khẩu.')
      e.target.reset()
    } catch (err) {
      toast$.error(err.message || 'Lỗi đổi mật khẩu.')
    }
  })

  $on($sel('#btnAddAdmin'), 'click', () => {
    $sel('#editAdminId').value = ''
    $sel('#adminFormTitle').textContent = 'Thêm tài khoản'
    $sel('#fUsername').value = ''
    $sel('#fUsername').disabled = false
    $sel('#fPassword').value = ''
    $sel('#fPassword').placeholder = ''
    $sel('#fDisplayName').value = ''
    $sel('#fEmail').value = ''
    $sel('#fPhone').value = ''
    $sel('#fRole').value = 'admin'
    $sel('#fActive').value = '1'
    $sel('#adminFormModal').style.display = 'flex'
  })

  $on($sel('#adminUserForm'), 'submit', async e => {
    e.preventDefault()
    const id = $sel('#editAdminId').value
    const data = {
      display_name: $sel('#fDisplayName').value,
      email: $sel('#fEmail').value,
      phone: $sel('#fPhone').value,
      role: $sel('#fRole').value,
      is_active: $sel('#fActive').value === '1',
    }
    const password = $sel('#fPassword').value
    if (password) data.password = password

    try {
      if (id) {
        await api.put(`/api/admin/users/${id}`, data)
      } else {
        if (!$sel('#fUsername').value || !$sel('#fPassword').value) {
          toast$.error('Tên đăng nhập và mật khẩu là bắt buộc.')
          return
        }
        data.username = $sel('#fUsername').value
        await api.post('/api/admin/users', data)
      }
      toast$.success('Đã lưu.')
      window._closeAdminForm()
      load()
    } catch (err) { toast$.error(err.message) }
  })

  await load()
});

// ── Settings Page ───────────────────────────────────────────────────────────
registerRoute('settings', async function() {
  // Mỗi guide: sample chứa mảng các dòng dữ liệu mẫu (tương ứng với cols).
  let guides = [
    { name: 'nhan_vien.xlsx', desc: 'Danh sách nhân viên', cols: ['ma_nv', 'ho_ten', 'pb_id', 'cv_id', 'vp_id', 'loai_nv_id', 'cs_luong_id', 'email', 'sdt', 'ngay_phep'],
      samples: [['NV001', 'Nguyễn Văn A', 1, 1, 1, 1, 1, 'email@vidu.com', '0909123456', 12]] },
    { name: 'phong_ban.xlsx', desc: 'Danh sách phòng ban', cols: ['ten_pb', 'ma_pb'],
      samples: [['Kỹ thuật', 'KT001']] },
    { name: 'chuc_vu.xlsx', desc: 'Danh sách chức vụ', cols: ['ten_cv', 'ma_cv'],
      samples: [['Nhân viên', 'CV001']] },
    { name: 'ca_lam.xlsx', desc: 'Danh sách ca làm việc', cols: ['ten_ca', 'gio_bat_dau', 'gio_ket_thuc', 'nguong_muon_phut'],
      samples: [['Ca sáng', '08:00', '17:00', 15]] },
    { name: 'van_phong.xlsx', desc: 'Danh sách văn phòng/chi nhánh', cols: ['ten_vp', 'ma_vp', 'dia_chi', 'vi_do', 'kinh_do', 'ban_kinh_met', 'mo_ta'],
      samples: [['Văn phòng chính', 'VP001', '123 Nguyễn Huệ Q1', 10.762912, 106.679814, 100, 'Trụ sở chính']] },
    { name: 'loai_nv.xlsx', desc: 'Danh sách loại nhân viên', cols: ['ten_loai', 'ma_loai', 'mo_ta'],
      samples: [['Full-time', 'FT', 'Nhân viên chính thức']] },
    { name: 'cs_luong.xlsx', desc: 'Danh sách chính sách lương', cols: ['ten_cs', 'ma_cs', 'mo_ta', 'ky_tra', 'ngay_cong', 'gio_ngay', 'he_so_ot'],
      samples: [['Lương tháng', 'L-thang', 'Lương hàng tháng', 'monthly', 26, 8, 1.5]] },
    { name: 'khu_vuc.xlsx', desc: 'Danh sách khu vực làm việc', cols: ['ten_kv', 'ma_kv', 'mo_ta'],
      samples: [['Kỹ thuật', 'KT', 'Khối kỹ thuật'], ['Kinh doanh', 'KD', 'Khối kinh doanh']] },
    { name: 'loai_chuc_vu.xlsx', desc: 'Danh sách loại chức vụ', cols: ['ten_lcv', 'ma_lcv', 'mo_ta'],
      samples: [['Giám đốc', 'GD', 'Quản lý cao cấp'], ['Trưởng phòng', 'TP', 'Quản lý cấp trung'], ['Nhân viên', 'NV', 'Nhân viên thường']] },
    { name: 'bang_cham_cong.xlsx', desc: 'Bảng chấm công', cols: ['ten_bcc', 'ten_ca', 'thu', 'la_viec', 'gio_vao_start', 'gio_vao_end', 'gio_ra_start', 'gio_ra_end', 'thu_tu', 'so_gio', 'nghi_co_dinh'],
      samples: [
        ['Giờ hành chính', 'Ca sáng', 'mon tue wed thu fri', 1, '08:00', '09:00', '12:00', '17:30', 1, 8, 0],
        ['Giờ hành chính', 'Ca chiều', 'mon tue wed thu fri', 1, '13:00', '13:30', '17:30', '18:00', 2, 4, 0],
        ['Nghỉ cuối tuần', 'Nghỉ', 'Sat Sun', 0, '', '', '', '', '', '', 1],
      ] },
  ]

  renderPage('Hướng dẫn', `
    <div class="chart-card" style="max-width:700px">
      <h3 style="margin:0 0 20px">Hướng dẫn & File mẫu Excel</h3>
      <p style="color:#64748b;margin-bottom:24px">Tải file mẫu Excel (.xlsx) bên dưới để import dữ liệu. Các cột bắt buộc được <strong>gạch chân</strong>.</p>
      
      ${guides.map((g, i) => `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div>
              <strong style="font-size:15px">${g.desc}</strong>
              <div style="color:#64748b;font-size:13px;margin-top:4px">${g.name}</div>
            </div>
            <button type="button" class="btn-secondary" onclick="downloadSampleExcel(${i})">
              <span class="material-symbols-rounded" style="font-size:18px">download</span> Tải file mẫu
            </button>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:13px">
            <strong>Các cột:</strong> ${g.cols.map((c, j) => `<span style="color:${j===0?'#e74c3c':'#334155'};text-decoration:${j===0?'underline':'none'}">${c}</span>${j < g.cols.length-1 ? ', ' : ''}`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `)

  window.downloadSampleExcel = function(idx) {
    const row = guides[idx]
    const aoa = [row.cols, ...(row.samples || [])]
    exportToXlsx(aoa, row.name, 'Mẫu')
  }
})

// ── Work Areas Page ─────────────────────────────────────────────────────────────
registerRoute('work-areas', async function() {
  let list = []
  let showM = false, editId = null
  let f = { name: '', code: '', description: '' }

  async function load() {
    try {
      const d = await api.get('/api/work-areas')
      list = Array.isArray(d) ? d : (d.data || [])
    } catch {}
    render()
  }

  function render() {
    const m = showM ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._waClose()">
        <div class="modal">
          <div class="modal-header"><h2>${editId?'Sửa khu vực':'Thêm khu vực'}</h2><button type="button" class="modal-close" onclick="window._waClose()">✕</button></div>
          <form id="waForm">
            <div class="modal-body">
              <div class="modal-form-row cols-2">
                <div class="form-group"><label>Tên khu vực *</label><input type="text" name="name" value="${f.name||''}" required placeholder="VD: Kỹ thuật" /></div>
                <div class="form-group"><label>Mã khu vực</label><input type="text" name="code" value="${f.code||''}" placeholder="VD: KT" /></div>
              </div>
              <div class="form-group"><label>Mô tả</label><input type="text" name="description" value="${f.description||''}" /></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="window._waClose()">Hủy</button>
              <button type="submit" class="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      </div>` : ''

    renderPage('Khu vực làm việc', `
      <div style="margin-bottom:16px;padding:12px 16px;background:#f0f7ff;border-radius:10px;font-size:14px;color:#1e40af">
        <strong>Khu vực làm việc</strong> là nơi nhân viên làm việc: VP HCM, Chi nhánh HN, Cửa hàng ĐN...
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <label for="waImportFile" class="btn-secondary" style="cursor:pointer;display:flex;align-items:center;gap:6px">
          <span class="material-symbols-rounded" style="font-size:18px">upload_file</span> Import CSV
        </label>
        <input type="file" id="waImportFile" accept=".csv,.xlsx,.xls" style="display:none" />
        <button type="button" class="btn-create" id="btnAddWa">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Thêm khu vực
        </button>
      </div>
      <div id="waImportResult" style="margin-bottom:16px;display:none" class="alert-box"></div>
      ${list.length===0 ? emptyState('map','Chưa có khu vực nào.') : `
        <table>
          <thead><tr><th>ID</th><th>Mã</th><th>Tên khu vực</th><th>Mô tả</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${list.map(w=>`<tr>
              <td>${w.id}</td><td>${w.code||'-'}</td><td style="font-weight:600">${w.name}</td><td style="color:#64748b">${w.description||'-'}</td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" data-edit="${w.id}">Sửa</button>
                <button type="button" class="btn-action danger" style="padding:6px 10px" data-del="${w.id}">Xóa</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
      ${m}
    `, showM)

    $on($sel('#btnAddWa'), 'click', () => { editId=null; f={name:'',code:'',description:''}; showM=true; render() })
    $selAll('[data-edit]').forEach(b=>$on(b,'click',()=>{const w=list.find(x=>x.id==b.dataset.edit);editId=w.id;f={name:w.name,code:w.code||'',description:w.description||''};showM=true;render()}))
    $selAll('[data-del]').forEach(b=>$on(b,'click',async()=>{if(!confirm('Xóa khu vực này?'))return;try{await api.delete(`/api/work-areas/${b.dataset.del}`);toast$.success('Đã xóa.');load()}catch(e){toast$.error(e.message)}}))
    if(showM)$on($sel('#waForm'),'submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);try{if(editId)await api.patch(`/api/work-areas/${editId}`,Object.fromEntries(fd));else await api.post('/api/work-areas',Object.fromEntries(fd));toast$.success('Đã lưu.');showM=false;load()}catch(err){toast$.error(err.message||'Lỗi lưu.')}})
    window._waClose=()=>{showM=false;render()}

    // Import handler
    $on($sel('#waImportFile'), 'change', async e => {
      const file = e.target.files[0]
      if (!file) return
      const fd = new FormData(); fd.append('file', file)
      try {
        const result = await fetch('/api/work-areas/import', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + safeGetItem('token') },
          body: fd
        }).then(r => r.json())
        const box = $sel('#waImportResult')
        if (result.ok) {
          box.style.display = 'block'; box.style.background = '#d1fae5'; box.style.color = '#065f46'
          box.innerHTML = `Import thành công! Tạo mới: ${result.created}, Cập nhật: ${result.updated}${result.errors.length ? '<br>Lỗi: ' + result.errors.join('; ') : ''}`
          load()
        } else {
          box.style.display = 'block'; box.style.background = '#fee2e2'; box.style.color = '#991b1b'
          box.textContent = 'Lỗi: ' + result.error
        }
      } catch { toast$.error('Import thất bại.') }
      e.target.value = ''
    })
  }
  await load()
});

// ── Position Types Page ─────────────────────────────────────────────────────────
registerRoute('position-types', async function() {
  let list = []
  let showM = false, editId = null
  let f = { name: '', code: '', description: '' }

  async function load() {
    try {
      const d = await api.get('/api/position-types')
      list = Array.isArray(d) ? d : (d.data || [])
    } catch {}
    render()
  }

  function render() {
    const m = showM ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._ptClose()">
        <div class="modal">
          <div class="modal-header"><h2>${editId?'Sửa loại chức vụ':'Thêm loại chức vụ'}</h2><button type="button" class="modal-close" onclick="window._ptClose()">✕</button></div>
          <form id="ptForm">
            <div class="modal-body">
              <div class="modal-form-row cols-2">
                <div class="form-group"><label>Tên loại chức vụ *</label><input type="text" name="name" value="${f.name||''}" required placeholder="VD: Giám đốc" /></div>
                <div class="form-group"><label>Mã</label><input type="text" name="code" value="${f.code||''}" placeholder="VD: GD" /></div>
              </div>
              <div class="form-group"><label>Mô tả</label><input type="text" name="description" value="${f.description||''}" /></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" onclick="window._ptClose()">Hủy</button>
              <button type="submit" class="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      </div>` : ''

    renderPage('Loại chức vụ', `
      <div style="margin-bottom:16px;padding:12px 16px;background:#f0fdf4;border-radius:10px;font-size:14px;color:#166534">
        Quản lý loại chức vụ: Giám đốc, Trưởng phòng, Phó phòng, Trưởng nhóm, Nhân viên...
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <label for="ptImportFile" class="btn-secondary" style="cursor:pointer;display:flex;align-items:center;gap:6px">
          <span class="material-symbols-rounded" style="font-size:18px">upload_file</span> Import CSV
        </label>
        <input type="file" id="ptImportFile" accept=".csv,.xlsx,.xls" style="display:none" />
        <button type="button" class="btn-create" id="btnAddPt">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Thêm loại chức vụ
        </button>
      </div>
      <div id="ptImportResult" style="margin-bottom:16px;display:none" class="alert-box"></div>
      ${list.length===0 ? emptyState('manage_history','Chưa có loại chức vụ nào.') : `
        <table>
          <thead><tr><th>ID</th><th>Mã</th><th>Tên loại chức vụ</th><th>Mô tả</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${list.map(pt=>`<tr>
              <td>${pt.id}</td><td>${pt.code||'-'}</td><td style="font-weight:600">${pt.name}</td><td style="color:#64748b">${pt.description||'-'}</td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary" style="padding:6px 12px;margin-right:4px" data-edit="${pt.id}">Sửa</button>
                <button type="button" class="btn-action danger" style="padding:6px 10px" data-del="${pt.id}">Xóa</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
      ${m}
    `)

    $on($sel('#btnAddPt'), 'click', () => { editId=null; f={name:'',code:'',description:''}; showM=true; render() })
    $selAll('[data-edit]').forEach(b=>$on(b,'click',()=>{const pt=list.find(x=>x.id==b.dataset.edit);editId=pt.id;f={name:pt.name,code:pt.code||'',description:pt.description||''};showM=true;render()}))
    $selAll('[data-del]').forEach(b=>$on(b,'click',async()=>{if(!confirm('Xóa loại chức vụ này?'))return;try{await api.delete(`/api/position-types/${b.dataset.del}`);toast$.success('Đã xóa.');load()}catch(e){toast$.error(e.message)}}))
    if(showM)$on($sel('#ptForm'),'submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);try{if(editId)await api.patch(`/api/position-types/${editId}`,Object.fromEntries(fd));else await api.post('/api/position-types',Object.fromEntries(fd));toast$.success('Đã lưu.');showM=false;load()}catch(err){toast$.error(err.message||'Lỗi lưu.')}})
    window._ptClose=()=>{showM=false;render()}

    // Import handler
    $on($sel('#ptImportFile'), 'change', async e => {
      const file = e.target.files[0]
      if (!file) return
      const fd = new FormData(); fd.append('file', file)
      try {
        const result = await fetch('/api/position-types/import', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + safeGetItem('token') },
          body: fd
        }).then(r => r.json())
        const box = $sel('#ptImportResult')
        if (result.ok) {
          box.style.display = 'block'; box.style.background = '#d1fae5'; box.style.color = '#065f46'
          box.innerHTML = `Import thành công! Tạo mới: ${result.created}, Cập nhật: ${result.updated}${result.errors.length ? '<br>Lỗi: ' + result.errors.join('; ') : ''}`
          load()
        } else {
          box.style.display = 'block'; box.style.background = '#fee2e2'; box.style.color = '#991b1b'
          box.textContent = 'Lỗi: ' + result.error
        }
      } catch { toast$.error('Import thất bại.') }
      e.target.value = ''
    })
  }
  await load()
});

// ── Timesheets Page ─────────────────────────────────────────────────────────────
registerRoute('timesheets', async function() {
  let list = []
  let showM = false, editId = null
  let f = { name: '', code: '', description: '', work_type: 'single', details: [] }

  const DAY_LABELS = { mon: 'T2', tue: 'T3', wed: 'T4', thu: 'T5', fri: 'T6', sat: 'T7', sun: 'CN' }

  async function load() {
    try {
      const d = await api.get('/api/timesheets')
      list = Array.isArray(d) ? d : (d.data || [])
    } catch { toast$.error('Không tải được bảng chấm công.') }
    render()
  }

  function openCreate() {
    editId = null
    f = { name: '', code: '', description: '', work_type: 'single', details: [{ shift_name: 'Ca chính', day_of_week: 'mon,tue,wed,thu,fri', is_working_day: true, check_in_start: '08:00', check_in_end: '09:00', check_out_start: '17:30', check_out_end: '18:00', shift_order: 1, work_hours: 8, is_day_off: false }] }
    showM = true
    render()
  }

  function openEdit(ts) {
    editId = ts.id
    f = {
      name: ts.name || '',
      code: ts.code || '',
      description: ts.description || '',
      work_type: ts.work_type || 'single',
      details: (ts.details || []).map(d => ({
        shift_name: d.shift_name || 'Ca',
        day_of_week: d.day_of_week || 'mon,tue,wed,thu,fri',
        is_working_day: d.is_working_day !== false,
        check_in_start: d.check_in_start || '',
        check_in_end: d.check_in_end || '',
        check_out_start: d.check_out_start || '',
        check_out_end: d.check_out_end || '',
        shift_order: d.shift_order || 1,
        work_hours: d.work_hours || 8,
        is_day_off: d.is_day_off === true || d.is_day_off === 1,
      }))
    }
    showM = true
    render()
  }

  function renderDetailRow(detail, idx) {
    const days = ['mon','tue','wed','thu','fri','sat','sun']
    const dayCheckboxes = days.map(day => {
      const checked = (detail.day_of_week || '').split(',').map(s=>s.trim()).includes(day) ? 'checked' : ''
      return `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:8px;font-size:12px"><input type="checkbox" class="day-chk" data-idx="${idx}" data-day="${day}" ${checked} />${DAY_LABELS[day]}</label>`
    }).join('')

    return `
      <div class="detail-row" style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;background:#f8fafc" onclick="event.stopPropagation()">
        <div class="form-group"><label>Tên ca</label><input type="text" class="detail-shift_name" data-idx="${idx}" value="${detail.shift_name||''}" placeholder="VD: Ca sáng" onclick="event.stopPropagation()" /></div>
        <div class="form-group"><label>Các ngày làm việc</label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px" onclick="event.stopPropagation()">${dayCheckboxes}</div></div>
        <div class="modal-form-row cols-2" onclick="event.stopPropagation()">
          <div class="form-group"><label>Giờ vào (start)</label><input type="time" class="detail-check_in_start" data-idx="${idx}" value="${detail.check_in_start||''}" onclick="event.stopPropagation()" /></div>
          <div class="form-group"><label>Giờ vào (end)</label><input type="time" class="detail-check_in_end" data-idx="${idx}" value="${detail.check_in_end||''}" onclick="event.stopPropagation()" /></div>
        </div>
        <div class="modal-form-row cols-2" onclick="event.stopPropagation()">
          <div class="form-group"><label>Giờ ra (start)</label><input type="time" class="detail-check_out_start" data-idx="${idx}" value="${detail.check_out_start||''}" onclick="event.stopPropagation()" /></div>
          <div class="form-group"><label>Giờ ra (end)</label><input type="time" class="detail-check_out_end" data-idx="${idx}" value="${detail.check_out_end||''}" onclick="event.stopPropagation()" /></div>
        </div>
        <div class="modal-form-row cols-3" onclick="event.stopPropagation()">
          <div class="form-group"><label>Thứ tự ca</label><input type="number" class="detail-shift_order" data-idx="${idx}" value="${detail.shift_order||1}" min="1" onclick="event.stopPropagation()" /></div>
          <div class="form-group"><label>Giờ làm</label><input type="number" class="detail-work_hours" data-idx="${idx}" value="${detail.work_hours||8}" min="0" step="0.5" onclick="event.stopPropagation()" /></div>
          <div class="form-group"><label>Ngày nghỉ cố định</label><input type="checkbox" class="detail-is_day_off" data-idx="${idx}" ${detail.is_day_off?'checked':''} onclick="event.stopPropagation()" /></div>
        </div>
        ${f.details.length > 1 ? `<button type="button" class="btn-action danger" style="padding:6px 10px;margin-top:8px" onclick="window._delDetail(${idx});event.stopPropagation()">Xóa ca này</button>` : ''}
      </div>`
  }

  function render() {
    const m = showM ? `
      <div class="modal-overlay" onclick="if(event.target===this)window._tsClose()">
        <div class="modal modal-wide" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>${editId?'Sửa bảng chấm công':'Tạo bảng chấm công'}</h2>
            <button type="button" class="modal-close" onclick="window._tsClose()">✕</button>
          </div>
          <form id="tsForm" onclick="event.stopPropagation()">
            <div class="modal-body" onclick="event.stopPropagation()">
              <div class="modal-form-row cols-2">
                <div class="form-group"><label>Tên bảng chấm công *</label><input type="text" name="name" value="${f.name||''}" required placeholder="VD: Giờ hành chính" /></div>
                <div class="form-group"><label>Mã</label><input type="text" name="code" value="${f.code||''}" placeholder="VD: GHC" /></div>
              </div>
              <div class="modal-form-row cols-2">
                <div class="form-group"><label>Loại</label>
                  <select name="work_type">
                    <option value="single" ${f.work_type==='single'?'selected':''}>1 ca làm việc</option>
                    <option value="double" ${f.work_type==='double'?'selected':''}>2 ca (sáng + chiều)</option>
                  </select>
                </div>
                <div class="form-group"><label>Mô tả</label><input type="text" name="description" value="${f.description||''}" /></div>
              </div>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px" onclick="event.stopPropagation()">
                <strong>Chi tiết các ca</strong>
                <button type="button" class="btn-secondary" onclick="window._addDetail();event.stopPropagation()">+ Thêm ca</button>
              </div>
              <div id="tsDetailsContainer" onclick="event.stopPropagation()">
                ${f.details.map((d, i) => renderDetailRow(d, i)).join('')}
              </div>
            </div>
            <div class="modal-footer" onclick="event.stopPropagation()">
              <button type="button" class="btn-secondary" onclick="window._tsClose()">Hủy</button>
              <button type="submit" class="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      </div>` : ''

    renderPage('Bảng chấm công', `
      <div style="margin-bottom:16px;padding:12px 16px;background:#fffbeb;border-radius:10px;font-size:14px;color:#92400e">
        <strong>Bảng chấm công</strong> định nghĩa giờ làm việc: ca sáng, ca chiều, giờ nghỉ trưa, ngày nghỉ cố định...
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <label for="tsImportFile" class="btn-secondary" style="cursor:pointer;display:flex;align-items:center;gap:6px">
          <span class="material-symbols-rounded" style="font-size:18px">upload_file</span> Import CSV
        </label>
        <input type="file" id="tsImportFile" accept=".csv,.xlsx,.xls" style="display:none" />
        <button type="button" class="btn-create" id="btnAddTs">
          <span class="material-symbols-rounded" style="font-size:18px">add</span> Tạo bảng chấm công
        </button>
      </div>
      <div id="tsImportResult" style="margin-bottom:16px;display:none" class="alert-box"></div>
      ${list.length===0 ? emptyState('calendar_month','Chưa có bảng chấm công nào.') : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px">
          ${list.map(ts=>`
            <div class="chart-card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div>
                  <strong style="font-size:16px">${ts.name}</strong>
                  ${ts.code ? `<span style="color:#64748b;font-size:12px;margin-left:8px">${ts.code}</span>` : ''}
                </div>
                <div style="display:flex;gap:4px">
                  <button type="button" class="btn-secondary" style="padding:4px 8px" data-edit="${ts.id}">Sửa</button>
                  <button type="button" class="btn-action danger" style="padding:4px 8px" data-del="${ts.id}">Xóa</button>
                </div>
              </div>
              <div style="font-size:12px;color:#64748b;margin-bottom:8px">${ts.description||''}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${(ts.details||[]).map(d=>`
                  <div style="background:#f1f5f9;border-radius:6px;padding:8px 10px;font-size:12px;min-width:120px">
                    <div style="font-weight:600">${d.shift_name||'Ca'}</div>
                    <div style="color:#64748b">${d.check_in_start||''} - ${d.check_out_end||''}</div>
                    <div style="color:#64748b">${d.work_hours||8}h</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `}
      ${m}
    `)

    $on($sel('#btnAddTs'), 'click', openCreate)
    $selAll('[data-edit]').forEach(b=>$on(b,'click',()=>{const ts=list.find(x=>x.id==b.dataset.edit);if(ts)openEdit(ts)}))
    $selAll('[data-del]').forEach(b=>$on(b,'click',async()=>{if(!confirm('Xóa bảng chấm công này?'))return;try{await api.delete(`/api/timesheets/${b.dataset.del}`);toast$.success('Đã xóa.');load()}catch(e){toast$.error(e.message)}}))

    if (showM) {
      // Bind add detail
      window._addDetail = () => {
        f.details.push({ shift_name: '', day_of_week: 'mon,tue,wed,thu,fri', is_working_day: true, check_in_start: '13:00', check_in_end: '13:30', check_out_start: '17:30', check_out_end: '18:00', shift_order: f.details.length + 1, work_hours: 4, is_day_off: false })
        render()
      }

      // Bind del detail
      window._delDetail = (idx) => {
        f.details.splice(idx, 1)
        render()
      }

      // Bind day checkboxes
      document.querySelectorAll('.day-chk').forEach(cb => {
        cb.addEventListener('change', e => {
          const idx = parseInt(cb.dataset.idx)
          const day = cb.dataset.day
          let days = f.details[idx].day_of_week.split(',').map(s=>s.trim()).filter(Boolean)
          if (e.target.checked) {
            if (!days.includes(day)) days.push(day)
          } else {
            days = days.filter(d=>d!==day)
          }
          days.sort((a,b)=>{const order=['mon','tue','wed','thu','fri','sat','sun'];return order.indexOf(a)-order.indexOf(b)})
          f.details[idx].day_of_week = days.join(',')
        })
      })

      // Bind inputs
      document.querySelectorAll('.detail-shift_name').forEach(inp => { inp.addEventListener('input', e => { f.details[parseInt(inp.dataset.idx)].shift_name = e.target.value }) })
      document.querySelectorAll('.detail-check_in_start').forEach(inp => { inp.addEventListener('change', e => { f.details[parseInt(inp.dataset.idx)].check_in_start = e.target.value }) })
      document.querySelectorAll('.detail-check_in_end').forEach(inp => { inp.addEventListener('change', e => { f.details[parseInt(inp.dataset.idx)].check_in_end = e.target.value }) })
      document.querySelectorAll('.detail-check_out_start').forEach(inp => { inp.addEventListener('change', e => { f.details[parseInt(inp.dataset.idx)].check_out_start = e.target.value }) })
      document.querySelectorAll('.detail-check_out_end').forEach(inp => { inp.addEventListener('change', e => { f.details[parseInt(inp.dataset.idx)].check_out_end = e.target.value }) })
      document.querySelectorAll('.detail-shift_order').forEach(inp => { inp.addEventListener('change', e => { f.details[parseInt(inp.dataset.idx)].shift_order = parseInt(e.target.value) || 1 }) })
      document.querySelectorAll('.detail-work_hours').forEach(inp => { inp.addEventListener('change', e => { f.details[parseInt(inp.dataset.idx)].work_hours = parseFloat(e.target.value) || 8 }) })
      document.querySelectorAll('.detail-is_day_off').forEach(inp => { inp.addEventListener('change', e => { f.details[parseInt(inp.dataset.idx)].is_day_off = e.target.checked }) })

      $on($sel('#tsForm'), 'submit', async e => {
        e.preventDefault()
        const fd = new FormData(e.target)
        const data = {
          name: fd.get('name'),
          code: fd.get('code'),
          description: fd.get('description'),
          work_type: fd.get('work_type'),
          details: f.details,
        }
        try {
          if (editId) {
            await api.put(`/api/timesheets/${editId}`, data)
          } else {
            await api.post('/api/timesheets', data)
          }
          toast$.success('Đã lưu.')
          showM = false
          load()
        } catch(err) { toast$.error(err.message || 'Lỗi lưu.') }
      })
    }

    window._tsClose = () => { showM = false; render() }

    // Import handler
    $on($sel('#tsImportFile'), 'change', async e => {
      const file = e.target.files[0]
      if (!file) return
      const fd = new FormData(); fd.append('file', file)
      try {
        const result = await fetch('/api/timesheets/import', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + safeGetItem('token') },
          body: fd
        }).then(r => r.json())
        const box = $sel('#tsImportResult')
        if (result.ok) {
          box.style.display = 'block'; box.style.background = '#d1fae5'; box.style.color = '#065f46'
          box.innerHTML = `Import thành công! Đã tạo ${result.timesheets_created} bảng chấm công, ${result.total} dòng chi tiết.${result.errors.length ? '<br>Lỗi: ' + result.errors.join('; ') : ''}`
          load()
        } else {
          box.style.display = 'block'; box.style.background = '#fee2e2'; box.style.color = '#991b1b'
          box.textContent = 'Lỗi: ' + result.error
        }
      } catch { toast$.error('Import thất bại.') }
      e.target.value = ''
    })
  }

  await load()
});

// ── Init ────────────────────────────────────────────────────────────────────
;(function init() {
  // Mobile menu
  const btn = document.getElementById('mobileMenuBtn')
  if (window.innerWidth <= 1024) btn.style.display = 'flex'
  window.addEventListener('resize', () => {
    btn.style.display = window.innerWidth <= 1024 ? 'flex' : 'none'
  })

  // Dark mode toggle
  document.getElementById('btnDarkMode').addEventListener('click', () => {
    document.body.classList.toggle('dark')
    // Re-render current page to update chart colors
    router(location.hash || '#/dashboard')
  })

  // Close sidebar button (mobile)
  const closeBtn = document.getElementById('sidebarCloseBtn')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar')
      if (sidebar) sidebar.classList.remove('open')
      document.body.classList.remove('sidebar-open')
    })
  }

  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    if (!confirm('Đăng xuất?')) return
    try { await api.post('/api/admin/logout') } catch {}
    window.location.href = '/login.html'
  })

  // Load admin info
  api.get('/api/admin/me').then(admin => {
    const el = document.getElementById('adminName')
    if (el && admin?.full_name) el.textContent = admin.full_name
    const initial = document.getElementById('sidebarAvatarInitial')
    if (initial && admin?.full_name) initial.textContent = admin.full_name.charAt(0).toUpperCase()
  }).catch(() => {})

  // Count pending leave requests
  api.get('/api/leave-requests?status=pending').then(data => {
    const list = Array.isArray(data) ? data : (data.data || [])
    const badge = document.getElementById('navPendingBadge')
    if (badge && list.length > 0) { badge.textContent = list.length; badge.style.display = 'inline' }
  }).catch(() => {})

  // Start router
  router(location.hash || '#/dashboard')
})()
