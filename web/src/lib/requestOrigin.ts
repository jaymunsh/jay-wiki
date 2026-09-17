/** Reverse proxy host/protocol must be set by the trusted ingress. */
export function hasAllowedOrigin(request: Request, requireOrigin = false): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return !requireOrigin;
  try {
    const url = new URL(request.url);
    const protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
    if (!['http', 'https'].includes(protocol)) return false;
    const expected = new URL(`${protocol}://${request.headers.get('host') ?? url.host}`);
    return new URL(origin).origin === expected.origin && origin !== 'null';
  } catch {
    return false;
  }
}

export function isLocalManagementRequest(request: Request): boolean {
  if (!hasAllowedOrigin(request, true)) return false;
  const host = new URL(request.headers.get('origin')!).hostname;
  return ['localhost', 'blog.localhost', 'admin.localhost', '127.0.0.1', '[::1]'].includes(host);
}
