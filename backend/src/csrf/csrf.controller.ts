import { Controller, Get, Req, Res } from '@nestjs/common';
import { CsrfTokenService } from './csrf.service';
import { Public } from 'src/decorators/public.decorator';
import { Request, Response } from 'express';

@Controller('csrf-token')
export class CsrfController {
  constructor(private readonly csrfTokenService: CsrfTokenService) { }

  @Get()
  @Public()
  getCsrfToken(@Req() req: Request, @Res() res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://promptserve.online',
      'https://api.promptserve.online',
      'https://promptserve-mvp.onrender.com',
      'https://localhost:8000',
      process.env.FRONTEND_BASE_URL,
      process.env.NEXT_PUBLIC_BACKEND_API_URL,
      process.env.WEBHOOK_ENDPOINT,
    ].map((origin) => origin?.replace(/\/$/, ''));

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, Authorization, X-CSRF-Token, x-csrf-token, XSRF-TOKEN',
      );
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      );
      res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
    }

    const headerToken = req.headers['x-csrf-token'] as string;
    if (headerToken && this.csrfTokenService.verifyToken(headerToken)) {
      console.log('Reusing valid token from header');
      return res.status(200).json({ csrfToken: headerToken });
    }

    // Generate CSRF token and set it as cookie
    const token = this.csrfTokenService.generateToken();

    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      domain: isProd ? '.promptserve.online' : undefined,
    });

    return res.status(200).json({ csrfToken: token });
  }
}
