(() => {
  'use strict';
  // Runs exclusively inside the official M-invoice website, with the user's
  // normal browser session and its own legitimate anti-bot checks.
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const mst = params.get('hms_mst') || '';
  const code = params.get('hms_code') || '';
  if (!/^\d{10}(?:-\d{3})?$/.test(mst) || !/^[A-Za-z0-9_-]{6,128}$/.test(code)) return;
  if (location.pathname !== '/tra-cuu-hoa-don') return;
  // Remove the lookup code from address bar/history as soon as we read it.
  history.replaceState(history.state, '', location.pathname + location.search);

  const normalized = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const setNativeValue = (input, value) => {
    if (!input || input.value === value) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const findInput = phrase => {
    for (const label of document.querySelectorAll('label,span,div,p')) {
      if (label.children.length > 3) continue;
      if (!normalized(label.textContent).includes(phrase)) continue;
      const parent = label.closest('label, .ant-form-item, .el-form-item, .form-group, .flex, .row') || label.parentElement;
      const input = parent?.querySelector('input:not([type="hidden"])') ||
        parent?.parentElement?.querySelector('input:not([type="hidden"])');
      if (input instanceof HTMLInputElement && input.getClientRects().length) return input;
    }
    return null;
  };
  let tries = 0;
  let finished = false;
  const attempt = () => {
    if (finished || ++tries > 80) return;
    const inputs = [...document.querySelectorAll('input:not([type="hidden"])')]
      .filter(item => item instanceof HTMLInputElement && item.getClientRects().length);
    const tax = document.querySelector('input[name="masothue"],input[id*="masothue" i]') ||
      findInput('ma so thue ben ban') || inputs[0];
    const security = document.querySelector('input[name="sobaomat"],input[id*="sobaomat" i]') ||
      findInput('ma tra cuu') || inputs.find(item => item !== tax);
    if (!(tax instanceof HTMLInputElement) || !(security instanceof HTMLInputElement) || tax === security) return;
    setNativeValue(tax, mst);
    setNativeValue(security, code);
    // Let React/Vue state settle; do not click Tra cứu automatically.
    if (tax.value !== mst || security.value !== code) return;
    finished = true;
    observer.disconnect();
    const status = document.createElement('div');
    status.textContent = 'HoangMySoft: Đã điền MST và mã tra cứu. Bạn bấm Tra cứu để xem hóa đơn.';
    Object.assign(status.style, {
      position: 'fixed', zIndex: '2147483647', left: '50%', top: '12px',
      transform: 'translateX(-50%)', padding: '10px 18px', color: 'white',
      background: '#155e75', borderRadius: '8px', fontSize: '14px',
      boxShadow: '0 3px 14px #3335'
    });
    document.body.appendChild(status);
    setTimeout(() => status.remove(), 6000);
  };
  const observer = new MutationObserver(() => { if (!finished) attempt(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const interval = setInterval(() => {
    if (finished || tries > 80) { clearInterval(interval); observer.disconnect(); return; }
    attempt();
  }, 250);
  attempt();
})();