/* ==========================================================================
   Login JS – Web Admin Login Page
   ========================================================================== */
const API = (() => {
  try {
    const q = new URLSearchParams(window.location.search);
    const normalize = (v) => (v || '').trim().replace(/\/$/, '');
    const apiQ = normalize(q.get('api') || q.get('api_base') || '');
    const apiLS = normalize(localStorage.getItem('API_BASE') || '');
    const apiTS = normalize(localStorage.getItem('TAILSCALE_API_BASE') || '');
    const api = apiQ || apiLS || apiTS;
    if (api) return api;
  } catch (_) {}
  if (window.location.origin === 'null' || window.location.protocol === 'file:') return 'https://trueface.io.vn';
  return '';
})();
const form = document.getElementById('formLogin');
const btn = document.getElementById('btnLogin');
const msgEl = document.getElementById('msg');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');

function showMsg(text, isError) {
  msgEl.innerHTML = text ? '<div class="msg ' + (isError ? 'error' : 'success') + '">' + text + '</div>' : '';
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) { showMsg('Nhập tên đăng nhập và mật khẩu.', true); return; }
  showMsg('');
  btn.disabled = true;
  try {
    const r = await fetch(API + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      showMsg(data.error || 'Đăng nhập thất bại.', true);
      btn.disabled = false;
      return;
    }
    try { localStorage.setItem('token', data.token); } catch (_) {}
    try { localStorage.setItem('username', data.username); } catch (_) {}
    showMsg('Đăng nhập thành công. Đang chuyển...', false);
    setTimeout(() => { window.location.href = '/'; }, 500);
  } catch (err) {
    showMsg(err.message || 'Lỗi kết nối.', true);
    btn.disabled = false;
  }
};

togglePassword.addEventListener('change', () => {
  passwordInput.type = togglePassword.checked ? 'text' : 'password';
});

const THEME_KEY = 'baseHrmLoginTheme';
const themeToggle = document.getElementById('themeToggle');
const themeToggleIcon = document.getElementById('themeToggleIcon');
function applyThemeIcon() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  themeToggleIcon.textContent = dark ? 'light_mode' : 'dark_mode';
}
applyThemeIcon();
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  applyThemeIcon();
});

function fpChannel() {
  const r = document.querySelector('input[name="fp_channel"]:checked');
  return r ? r.value : 'email';
}

// Quên mật khẩu (OTP email / SMS)
function openForgotPassword() {
  document.getElementById('forgotModal').style.display = 'flex';
  document.getElementById('forgotMsg').innerHTML = '';
}
function closeForgotPassword() {
  document.getElementById('forgotModal').style.display = 'none';
}
function forgotEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/** kind: true = error, false = success, 'warning' = chưa gửi được email/SMS thật; detail = gợi ý kỹ thuật (tuỳ chọn) */
function showForgotMsg(text, kind, detail) {
  const el = document.getElementById('forgotMsg');
  if (!text) { el.innerHTML = ''; return; }
  var cls = 'success';
  if (kind === true || kind === 'error') cls = 'error';
  else if (kind === 'warning') cls = 'warning';
  var inner = forgotEsc(text).replace(/\r\n|\n|\r/g, '<br>');
  if (detail) {
    inner += '<span class="forgot-msg-detail">' + forgotEsc(detail).replace(/\r\n|\n|\r/g, '<br>') + '</span>';
  }
  el.innerHTML = '<div class="msg ' + cls + '">' + inner + '</div>';
}

document.getElementById('btnSendOtp').onclick = async () => {
  const username = (document.getElementById('fp_username').value || '').trim();
  const ch = fpChannel();
  if (!username) {
    showForgotMsg('Nhập tên đăng nhập.', true);
    return;
  }
  const body = { username, channel: ch };
  try {
    const r = await fetch(API + '/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      var errMsg = data.error || 'Không gửi được mã OTP.';
      if (data.detail) errMsg += '\n' + data.detail;
      showForgotMsg(errMsg, true);
      return;
    }
    var fallback = ch === 'email'
      ? 'Đã gửi mã OTP tới email đã lưu. Kiểm tra hộp thư (và thư mục spam).'
      : 'Đã gửi mã OTP tới số điện thoại đã lưu. Kiểm tra tin nhắn SMS.';
    var msgText = data.message || fallback;
    showForgotMsg(msgText, false);
  } catch (err) {
    showForgotMsg(err.message || 'Lỗi kết nối.', true);
  }
};

document.getElementById('btnResetPassword').onclick = async () => {
  const username = (document.getElementById('fp_username').value || '').trim();
  const otp = (document.getElementById('fp_otp').value || '').trim();
  const newPassword = document.getElementById('fp_new_password').value || '';
  if (!username || !otp || !newPassword) {
    showForgotMsg('Nhập đầy đủ tên đăng nhập, mã OTP và mật khẩu mới.', true);
    return;
  }
  if (newPassword.length < 6 || !/[0-9]/.test(newPassword) || !/[A-Za-z]/.test(newPassword)) {
    showForgotMsg('Mật khẩu mới: ít nhất 6 ký tự, có cả chữ cái và số.', true);
    return;
  }
  try {
    const r = await fetch(API + '/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, otp, new_password: newPassword }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      showForgotMsg(data.error || 'Không đặt lại được mật khẩu.', true);
      return;
    }
    showForgotMsg(data.message || 'Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.', false);
  } catch (err) {
    showForgotMsg(err.message || 'Lỗi kết nối.', true);
  }
};
