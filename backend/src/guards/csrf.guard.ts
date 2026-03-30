import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { CsrfTokenService } from 'src/csrf/csrf.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrfTokenService: CsrfTokenService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    if (request.method === 'OPTIONS') return true;

    const methodsRequiringCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!methodsRequiringCsrf.includes(request.method.toUpperCase())) return true

    const csrfHeader = request.header('x-csrf-token') as string;

    // And verify the token's integrity using the CsrfTokenService
    if (!csrfHeader || !this.csrfTokenService.verifyToken(csrfHeader)) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'CSRF token ไม่ถูกต้อง',
        code: 'INVALID_CSRF_TOKEN',
      });
    }

    return true;
  }
}
