import rateLimit from 'express-rate-limit';

export const globalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  message: {
    error: 'รีเควสจากIP เกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minutes'
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
  max: 20,
  message: {
    error: 'รีเควสในการลงทะเบียน/เข้าสู่ระบบเกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minutes'
  },
  skipSuccessfulRequests: true,
});

export const paymentRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: {
    error: 'รีเควสในการชำระเงินเกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minutes'
  }
});

export const orderRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    error: 'จำนวนรีเควสในการสั่งออเดอร์เกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minute'
  }
});

export const orderFetchingLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: {
    error: 'จำนวนรีเควสในการดึงข้อมูลออเดอร์เกินขีดจำกัด กรุณาลองใหม่อีกครั้ง',
    retryAfter: '1 minute'
  }
});