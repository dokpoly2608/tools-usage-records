// 跨上下文复制文本。
// 安全上下文（HTTPS 或 localhost）用 Clipboard API；HTTP 部署下 navigator.clipboard
// 为 undefined，降级到 execCommand + 临时 textarea，避免静默失败（远程复制没反应）。
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* 权限拒绝等 → 降级 */
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
