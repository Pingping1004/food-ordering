import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorsHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const allowedOrigins = [
    'https://food-orderingv1.vercel.app',
    'https://food-ordering-five-rho.vercel.app',
    'https://food-ordering-mvp.onrender.com',
    process.env.FRONTEND_BASE_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
    process.env.WEBHOOK_ENDPOINT,
  ].map(origin => origin?.replace(/\/$/, '')); // strip trailing slashesƒ
    const origin = req.headers.origin as string;

    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-CSRF-Token, x-csrf-token, XSRF-TOKEN, x-xsrf-token');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Expose-Headers', 'Set-Cookie');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  }
}