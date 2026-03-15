import rateLimit from 'express-rate-limit';

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'รีเควสจากIP เกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'จำนวนรีเควสเกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
      retryAfter: Math.ceil(15 * 60)
    });
  }
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'รีเควสในการลงทะเบียน/เข้าสู่ระบบเกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true,
});

export const paymentRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: {
    error: 'รีเควสในการชำระเงินเกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '5 minutes'
  }
});

export const orderRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    error: 'จำนวนรีเควสในการาั่งออเดอร์เกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minute'
  }
});