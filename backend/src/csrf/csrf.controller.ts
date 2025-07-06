import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { CsrfTokenService } from './csrf.service';
import { Public } from 'src/decorators/public.decorator';

@Controller('csrf-token')
export class CsrfController {
  constructor(private csrfTokenService: CsrfTokenService) {}

  @Public()
  @Get()
  getCsrfToken(@Res({ passthrough: true }) res: Response): { csrfToken: string } {
    const token = this.csrfTokenService.generateToken();
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 3600000 * 24,
      path: '/',
    });
    return { csrfToken: token };
  }
}