import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorsHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const allowedOrigins = [
      'https://localhost:8000',
      'http://localhost:3000',
      'https://4e448ea267fb.ngrok-free.app',
    ];
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