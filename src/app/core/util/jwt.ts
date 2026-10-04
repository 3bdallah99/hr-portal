export type JwtClaims = Record<string, unknown> & { exp?: number };

/** يفك الـ payload مع دعم الحروف العربية (UTF-8) و base64url. */
export function parseJwt(token: string): JwtClaims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const json = decodeURIComponent(
      Array.from(binary, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

export function isExpired(claims: JwtClaims, skewSeconds = 15): boolean {
  return typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
