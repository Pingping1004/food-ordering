// src/csrf/csrf.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { CsrfTokenService } from './csrf.service';
import { Public } from 'src/decorators/public.decorator';

@Controller('csrf-token')
export class CsrfController {
  constructor(private csrfTokenService: CsrfTokenService) {}

  @Public() // This endpoint itself must be public, as it's accessed before any tokens exist
  @Get()
  getCsrfToken(@Res({ passthrough: true }) res: Response): { csrfToken: string } {
    const token = this.csrfTokenService.generateToken();
    // Set the XSRF-TOKEN cookie.
    // httpOnly: false is crucial as frontend JS needs to read this cookie.
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production', // Use secure in production for HTTPS
      sameSite: 'lax', // Recommended for CSRF tokens
      // maxAge: 3600000 * 24 // Example: Token valid for 24 hours, or match your session
    });
    return { csrfToken: token }; // Optionally return it in the body too (though cookie is primary)
  }
}