import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

/**
 * IP buckets are a flood backstop, NOT the fairness control: a whole school (up to ~2,500 students) sits behind
 * one or a few egress IPs, so these are sized for the entire school. Per-user limits live in UserRateLimitGuard.
 */
const SCHOOL_NAT_MULTIPLIER = Number(process.env.IP_LIMIT_MULTIPLIER ?? '1');
const ipMax = (n: number) => Math.round(n * SCHOOL_NAT_MULTIPLIER);

export const globalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: ipMax(6000),
  message: {
    error: 'รีเควสจากIP เกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'จำนวนรีเควสเกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
      retryAfter: 60,
    });
  },
});

export const paymentRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: ipMax(1500),
  message: {
    error: 'รีเควสในการชำระเงินเกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minutes',
  },
});

export const orderRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: ipMax(1200),
  message: {
    error: 'จำนวนรีเควสในการสั่งออเดอร์เกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minute',
  },
});

export const orderFetchingLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: ipMax(3000),
  message: {
    error: 'จำนวนรีเควสในการดึงข้อมูลออเดอร์เกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minute',
  },
});

/** Brute-force guard for invite codes: only FAILED attempts (4xx) count, 10 per 15 min per IP. */
export const joinSchoolRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: ipMax(60),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      statusCode: 429,
      error: 'Too many requests',
      message: 'ลองใส่รหัสเชิญผิดหลายครั้งเกินไป กรุณาลองใหม่ในภายหลัง',
    });
  },
});

/** Mounted on `/api/me/school`; limits only `PATCH /` (the route that takes a code). `POST /api/me/redeem-code` mounts joinSchoolRateLimit directly, so both share one failure counter. */
export const schoolCodeRateLimit: RequestHandler = (req, res, next) => {
  const isChange =
    req.method === 'PATCH' && (req.path === '/' || req.path === '');
  return isChange ? joinSchoolRateLimit(req, res, next) : next();
};
