/* ==========================================================================
   Shared utilities (mojibake fix) – dùng chung cho mọi trang
   ========================================================================== */
(function () {
  const BAD_TEXT_RE = /(Ã.|Â.|â.|Ä.|áº|á»|Æ|Ê|Ð|Ñ|�)/;
  const fixText = (value) => {
    if (typeof value !== 'string' || !value || !BAD_TEXT_RE.test(value)) return value;
    try {
      let out = value;
      for (let i = 0; i < 2; i++) {
        const next = decodeURIComponent(escape(out));
        if (!next || next === out) break;
        out = next;
      }
      return out;
    } catch (_) {
      return value;
    }
  };

  window.__fixMojibakeNow = function () {
    document.title = fixText(document.title);
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      node.nodeValue = fixText(node.nodeValue);
      node = walker.nextNode();
    }
  };

  const oldInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (position, html) {
    return oldInsertAdjacentHTML.call(this, position, typeof html === 'string' ? fixText(html) : html);
  };

  document.addEventListener('DOMContentLoaded', window.__fixMojibakeNow);
})();
