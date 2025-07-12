// src/common/guards/csrf.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException, HttpStatus, Logger } from '@nestjs/common';
import { Request } from 'express';
import { CsrfTokenService } from 'src/csrf/csrf.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'; // Import your Public decorator key

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrfTokenService: CsrfTokenService,
    private readonly reflector: Reflector // Used to check for @Public() decorator
  ) { }

  private readonly logger = new Logger(CsrfGuard.name);

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

    const csrfHeader = request.header('x-csrf-token') as string;
    const csrfCookie = request.cookies['XSRF-TOKEN'];
    
    this.logger.log('Req header: ', request.headers);
    this.logger.log('CSRF header: ' + csrfHeader);
    this.logger.log('CSRF cookie: ' + csrfCookie);

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