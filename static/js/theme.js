/* ==========================================================================
   Theme init – chạy TRƯỚC khi body render (đặt trong <head>)
   ========================================================================== */
(function () {
  try {
    var k = 'baseHrmLoginTheme';
    var v = localStorage.getItem(k);
    if (v === 'dark' || v === 'light') document.documentElement.setAttribute('data-theme', v);
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.setAttribute('data-theme', 'dark');
  } catch (_) {}
})();
