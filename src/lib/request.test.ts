import { describe, it, expect } from 'vitest';
import { getClientIp } from './request';

function makeRequest(headers: Record<string, string>): Request {
  return new Request('http://example.com', { headers });
}

describe('getClientIp', () => {
  it('prefers x-nf-client-connection-ip over x-forwarded-for', () => {
    const req = makeRequest({
      'x-nf-client-connection-ip': '1.2.3.4',
      'x-forwarded-for': '5.6.7.8',
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('uses x-forwarded-for when the Netlify header is absent', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('uses the leftmost IP from a comma-separated x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('trims whitespace around the leftmost IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '   1.2.3.4   ,5.6.7.8' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('returns "unknown" when no IP headers are present', () => {
    expect(getClientIp(makeRequest({}))).toBe('unknown');
  });
});
