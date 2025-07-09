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
      'https://localhost:8000',
      'http://localhost:3000',
      'https://4e448ea267fb.ngrok-free.app',
    ];

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