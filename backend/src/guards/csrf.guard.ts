// src/common/guards/csrf.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { CsrfTokenService } from 'src/csrf/csrf.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'; // Import your Public decorator key

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrfTokenService: CsrfTokenService,
    private reflector: Reflector // Used to check for @Public() decorator
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if the route is marked with @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // If public, bypass CSRF check
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (request.method === 'OPTIONS') {
      return true;
    }

    const methodsRequiringCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!methodsRequiringCsrf.includes(request.method.toUpperCase())) {
      return true; // If method doesn't require CSRF, allow
    }

    // 1. Get CSRF token from the custom header (sent by frontend)
    const csrfHeader = request.header('x-csrf-token');
    if (!csrfHeader) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'CSRF token missing in X-CSRF-Token header.',
        code: 'CSRF_TOKEN_MISSING_HEADER'
      });
    }

    // 2. Get CSRF token from the cookie (set by server earlier)
    const csrfCookie = request.cookies['XSRF-TOKEN'];
    if (!csrfCookie) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'CSRF token missing in XSRF-TOKEN cookie.',
        code: 'CSRF_TOKEN_MISSING_COOKIE'
      });
    }

    // 3. Compare the header token with the cookie token
    // And verify the token's integrity using the CsrfTokenService
    if (csrfHeader !== csrfCookie || !this.csrfTokenService.verifyToken(csrfHeader)) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Invalid CSRF token.',
        code: 'INVALID_CSRF_TOKEN'
      });
    }

    return true;
  }
}