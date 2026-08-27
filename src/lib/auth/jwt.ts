export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  full_name?: string;
  exp: number;
  iat: number;
  aud?: string;
}

function getJwtSecret(): string {
  return (
    process.env.JWT_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'default-pachas-jwt-secret-key-32-chars-long'
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array | string): string {
  let base64: string;
  if (typeof buffer === 'string') {
    if (typeof Buffer !== 'undefined') {
      base64 = Buffer.from(buffer, 'utf8').toString('base64');
    } else {
      base64 = btoa(unescape(encodeURIComponent(buffer)));
    }
  } else {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = typeof Buffer !== 'undefined' ? Buffer.from(binary, 'binary').toString('base64') : btoa(binary);
  }

  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  } else {
    return decodeURIComponent(escape(atob(base64)));
  }
}

function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    const arrayBuffer = new ArrayBuffer(buf.length);
    const u8 = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buf.length; i++) {
      u8[i] = buf[i];
    }
    return u8;
  } else {
    const binary = atob(base64);
    const arrayBuffer = new ArrayBuffer(binary.length);
    const u8 = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binary.length; i++) {
      u8[i] = binary.charCodeAt(i);
    }
    return u8;
  }
}

/**
 * Signs a payload into a standard JWT string using Web Crypto API HMAC-SHA256
 */
export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresInSeconds: number = 60 * 60 * 24 * 7
): Promise<string> {
  const secret = getJwtSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    aud: 'authenticated',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign));
  const encodedSignature = base64UrlEncode(signatureBuffer);

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verifies a JWT token using Web Crypto API HMAC-SHA256 (Edge Runtime & Node compatible)
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const secret = getJwtSecret();
  const dataToVerify = `${encodedHeader}.${encodedPayload}`;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = base64UrlToBytes(signature);
    const dataBytes = encoder.encode(dataToVerify);

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes as any, dataBytes);
    if (!isValid) return null;

    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
