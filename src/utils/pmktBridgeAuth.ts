import crypto from 'node:crypto';

export function verifyPmktBridgeToken(token: string, secret: string): boolean {
  if (!token || typeof token !== 'string' || !secret || typeof secret !== 'string') return false;
  if (secret.length < 16) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [headerB64, payloadB64, signature] = parts;

  try {
    const headerJson = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    if (headerJson.alg !== 'HS256') return false;

    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return false;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.iss !== 'pmkt-v2') return false;
    if (payload.aud !== 'hoadondientu') return false;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(payload.sub || ''))) {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
