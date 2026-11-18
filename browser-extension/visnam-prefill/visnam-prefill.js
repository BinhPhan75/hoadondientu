(() => {
  'use strict';
  // Runs only on the issuer's lookup website. Never handles CAPTCHA,
  // submits a form, sends invoice data, or calls provider APIs.
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const code = (params.get('hms_visnam_code') || '').trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) return;
  history.replaceState(history.state, '', location.pathname + location.search);

  const normalize = s => String(s || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const visible = el => el instanceof HTMLInputElement &&
    el.type !== 'hidden' && el.type !== 'password' && el.getClientRects().length > 0;
  const caption = el => normalize([
    el.name, el.id, el.placeholder, el.getAttribute('aria-label') || '',
    el.closest('label')?.textContent || '',
    el.parentElement?.textContent?.slice(0, 100) || ''
  ].join(' '));
  const choose = () => {
    const inputs = [...document.querySelectorAll('input')].filter(visible);
    const targets = inputs.filter(el => /ma so bi mat|ma tra cuu|ma bao mat|lookup|so bao mat|mabimat|mabaomat|sobimat|matau/.test(caption(el))
      && !/captcha|ma xac thuc|ma kiem tra|verification/.test(caption(el)));
    return targets.length === 1 ? targets[0] : null;
  };
  const apply = () => {
    const el = choose();
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, code);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return el.value === code;
  };
  if (apply()) return;
  let count = 0;
  const timer = setInterval(() => {
    if (apply() || ++count > 40) clearInterval(timer);
  }, 250);
})();
