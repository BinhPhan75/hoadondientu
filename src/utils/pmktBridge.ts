export interface PmktTaxpayerCredentials {
  taxCode: string;
  password: string;
}

export type PmktBridgeStatus = 'checking' | 'blocked' | 'awaiting' | 'connected' | 'refreshing';

export interface PmktBridgeState {
  status: PmktBridgeStatus;
  message: string;
  taxpayer?: PmktTaxpayerCredentials;
}

const bridgeOrigin = parseConfiguredOrigin(
  import.meta.env.VITE_PMKT_ORIGIN || 'https://pmkt.nghiatingold.com'
);
let bridgeToken: string | null = null;
let refreshRequestedForToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function parseConfiguredOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isSecure = url.protocol === 'https:';
    const isLocalhost = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    return url.origin === value && (isSecure || isLocalhost) ? url.origin : null;
  } catch {
    return null;
  }
}

function requestRefresh(onState: (state: PmktBridgeState) => void): void {
  if (!bridgeOrigin || !bridgeToken || refreshRequestedForToken === bridgeToken) return;

  refreshRequestedForToken = bridgeToken;
  onState({
    status: 'refreshing',
    message: 'Phiên tích hợp cần được làm mới. Đang yêu cầu PMKT cấp phiên mới.'
  });
  window.parent.postMessage({ type: 'HOADON_BRIDGE_REFRESH_REQUEST' }, bridgeOrigin);
}

function scheduleRefreshRequest(onState: (state: PmktBridgeState) => void): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;

  if (!bridgeToken) return;
  try {
    const payload = bridgeToken.split('.')[1];
    if (!payload) return;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    if (typeof claims.exp !== 'number') return;

    const delay = Math.max(0, claims.exp * 1000 - Date.now() - 60_000);
    refreshTimer = setTimeout(() => requestRefresh(onState), delay);
  } catch {
    // The server is authoritative for token validation; malformed tokens are rejected there.
  }
}

export function installPmktBridge(onState: (state: PmktBridgeState) => void): () => void {
  if (!bridgeOrigin) {
    onState({
      status: 'blocked',
      message: 'Thiếu cấu hình VITE_PMKT_ORIGIN hợp lệ. Hãy mở module từ phần mềm PMKT sau khi quản trị cấu hình tích hợp.'
    });
    return () => {};
  }

  let parentOrigin: string | null = null;
  try {
    if (document.referrer) parentOrigin = new URL(document.referrer).origin;
  } catch {
    // The origin-checked message handler remains authoritative if referrer is unavailable.
  }
  if (window.parent === window || (parentOrigin && parentOrigin !== bridgeOrigin)) {
    onState({
      status: 'blocked',
      message: 'Module này chỉ hoạt động khi được mở từ phần mềm PMKT đã tích hợp.'
    });
    return () => {};
  }

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== bridgeOrigin || event.source !== window.parent) return;
    const message = event.data;
    if (
      !message ||
      message.type !== 'PMKT_EINVOICE_SESSION' ||
      typeof message.token !== 'string' ||
      !message.token ||
      !message.taxpayer ||
      typeof message.taxpayer.taxCode !== 'string' ||
      typeof message.taxpayer.password !== 'string' ||
      !message.taxpayer.taxCode.trim() ||
      !message.taxpayer.password
    ) {
      return;
    }

    bridgeToken = message.token;
    refreshRequestedForToken = null;
    const taxpayer = {
      taxCode: message.taxpayer.taxCode.trim(),
      password: message.taxpayer.password
    };
    scheduleRefreshRequest(onState);
    onState({ status: 'connected', message: 'Đã kết nối với PMKT.', taxpayer });
  };

  window.addEventListener('message', handleMessage);
  onState({ status: 'awaiting', message: 'Đang chờ PMKT chuyển phiên đăng nhập và thông tin doanh nghiệp.' });
  window.parent.postMessage({ type: 'HOADON_BRIDGE_READY' }, bridgeOrigin);
  const handshakeTimeout = setTimeout(() => {
    if (!bridgeToken) {
      onState({
        status: 'blocked',
        message: 'Không nhận được phiên tích hợp từ PMKT. Hãy mở lại module từ phần mềm PMKT đã đăng nhập.'
      });
    }
  }, 15_000);

  return () => {
    window.removeEventListener('message', handleMessage);
    clearTimeout(handshakeTimeout);
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    bridgeToken = null;
    refreshRequestedForToken = null;
  };
}

export function installBridgeApiAuthorization(): void {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestUrl = input instanceof Request
      ? new URL(input.url)
      : new URL(input.toString(), window.location.href);

    if (requestUrl.origin !== window.location.origin || !requestUrl.pathname.startsWith('/api/')) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    const requestToken = bridgeToken;
    if (requestToken) headers.set('Authorization', `Bearer ${requestToken}`);

    const response = await nativeFetch(input, { ...init, headers });
    if (response.status === 401 && requestToken && requestToken === bridgeToken) {
      window.dispatchEvent(new CustomEvent('pmkt-bridge-token-expired'));
    }
    return response;
  };
}

export function watchPmktBridgeRefresh(onState: (state: PmktBridgeState) => void): () => void {
  const handler = () => requestRefresh(onState);
  window.addEventListener('pmkt-bridge-token-expired', handler);
  return () => window.removeEventListener('pmkt-bridge-token-expired', handler);
}
