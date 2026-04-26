/**
 * Best-effort client IP extraction. Netlify forwards the original
 * client IP in `x-nf-client-connection-ip`; everything else falls
 * back to the leftmost address in `x-forwarded-for`.
 */
export function getClientIp(request: Request): string {
  const direct = request.headers.get('x-nf-client-connection-ip');
  if (direct) return direct.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return 'unknown';
}
