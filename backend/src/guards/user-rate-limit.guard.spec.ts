import { HttpException } from '@nestjs/common';
import { UserRateLimitGuard } from './user-rate-limit.guard';

const ctx = (method: string, path: string, userId?: string) => {
  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => (headers[k] = v) };
  const req = { method, path, user: userId ? { userId } : undefined };
  return {
    headers,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any,
  };
};

describe('UserRateLimitGuard', () => {
  it('should not limit anonymous requests (the IP limiter covers those)', () => {
    const g = new UserRateLimitGuard();
    for (let i = 0; i < 1000; i++) expect(g.canActivate(ctx('POST', '/api/order/create').ctx)).toBe(true);
  });

  it('should cap order creation per user and set Retry-After, without affecting other users', () => {
    const g = new UserRateLimitGuard();
    for (let i = 0; i < 30; i++) expect(g.canActivate(ctx('POST', '/api/order/create', 'stu-1').ctx)).toBe(true);
    const over = ctx('POST', '/api/order/create', 'stu-1');
    expect(() => g.canActivate(over.ctx)).toThrow(HttpException);
    expect(Number(over.headers['Retry-After'])).toBeGreaterThan(0);
    expect(g.canActivate(ctx('POST', '/api/order/create', 'stu-2').ctx)).toBe(true);
  });

  it('should let 2,500 distinct students each place an order from one shared IP', () => {
    const g = new UserRateLimitGuard();
    for (let i = 0; i < 2500; i++) expect(g.canActivate(ctx('POST', '/api/order/create', `stu-${i}`).ctx)).toBe(true);
  });

  it('should still allow normal polling (one request per 20 s) indefinitely', () => {
    const g = new UserRateLimitGuard();
    for (let i = 0; i < 3; i++) expect(g.canActivate(ctx('GET', '/api/order/abc', 'stu-1').ctx)).toBe(true);
  });

  it('should apply the catch-all cap to read endpoints', () => {
    const g = new UserRateLimitGuard();
    for (let i = 0; i < 240; i++) g.canActivate(ctx('GET', '/api/order/mine', 'stu-1').ctx);
    expect(() => g.canActivate(ctx('GET', '/api/order/mine', 'stu-1').ctx)).toThrow(HttpException);
  });
});
