import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FixedWindowLimiter } from '../common/fixed-window-limiter';

type Rule = { method: string; test: RegExp; limiter: FixedWindowLimiter };

/**
 * Per-user limits, applied after authentication so the key is the verified user id. This is what protects
 * the write paths: the express-rate-limit IP buckets are deliberately loose because every student on a
 * school's Wi-Fi shares one egress IP.
 */
@Injectable()
export class UserRateLimitGuard implements CanActivate {
  private readonly rules: Rule[] = [
    // A student places a handful of orders at lunch, never dozens a minute.
    { method: 'POST', test: /^\/api\/order\/create\/?$/, limiter: new FixedWindowLimiter(8, 60_000) },
    { method: 'POST', test: /^\/api\/payment\/verify\/?$/, limiter: new FixedWindowLimiter(10, 5 * 60_000) },
    { method: 'POST', test: /^\/api\/order\/[^/]+\/refund-request\/?$/, limiter: new FixedWindowLimiter(5, 5 * 60_000) },
    { method: 'POST', test: /^\/api\/upload\//, limiter: new FixedWindowLimiter(30, 60_000) },
  ];
  /** Catch-all per user: polling (20–30 s) plus normal browsing stays far below this. */
  private readonly fallback = new FixedWindowLimiter(240, 60_000);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: { userId?: string } }>();
    const userId = req.user?.userId;
    if (!userId) return true; // public routes: the IP limiter covers them

    const path = req.path;
    const rule = this.rules.find((r) => r.method === req.method && r.test.test(path));
    for (const limiter of [this.fallback, rule?.limiter]) {
      if (!limiter) continue;
      const { allowed, retryAfterSec } = limiter.hit(userId);
      if (!allowed) {
        context.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retryAfterSec));
        throw new HttpException(
          { statusCode: 429, error: 'Too many requests', message: 'ส่งคำขอถี่เกินไป กรุณาลองใหม่อีกครั้งในอีกสักครู่' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }
}
