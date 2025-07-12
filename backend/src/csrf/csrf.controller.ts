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
    const origin = req.headers.origin;
    const allowedOrigins = [
    'https://food-orderingv1.vercel.app',
    'https://food-ordering-five-rho.vercel.app',
    'https://food-ordering-mvp.onrender.com',
    process.env.FRONTEND_BASE_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
    process.env.WEBHOOK_ENDPOINT,
  ].map(origin => origin?.replace(/\/$/, '')); // strip trailing slashesƒ

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-CSRF-Token, x-csrf-token, XSRF-TOKEN');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
    }

    // Generate CSRF token and set it as cookie
    const token = this.csrfTokenService.generateToken();

    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    });

    return res.status(200).json({ csrfToken: token });
  }
}