import crypto from 'crypto';

export function verifyPmktBridgeToken(token: string, secret = process.env.PMKT_BRIDGE_SECRET): boolean {
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return false;

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header?.alg !== 'HS256') return false;
    if (
      typeof claims?.sub !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.sub) ||
      claims.iss !== 'pmkt-v2' ||
      !(claims.aud === 'hoadondientu' || (Array.isArray(claims.aud) && claims.aud.includes('hoadondientu'))) ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Date.now() / 1000 ||
      (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > Date.now() / 1000))
    ) {
      return false;
    }

    const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2], 'base64url');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
