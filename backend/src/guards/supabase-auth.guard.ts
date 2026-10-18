import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseService } from '../supabase/supabase.service';

const bearer = (req: Request): string | undefined => {
  const [type, token] = req.headers.authorization?.split(' ') ?? [];
  return type?.toLowerCase() === 'bearer' ? token : undefined;
};

/**
 * Replaces the old passport-jwt guard. Expects `Authorization: Bearer <Supabase access token>`.
 *  - protected route: valid token required → `req.user = { userId, email, role, aal }`
 *  - @Public route: never rejects, but still attaches `req.user` when a valid token is present
 * No cookies are read, so CSRF protection is not needed any more.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const token = bearer(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
    }

    try {
      const identity = await this.supabase.verifyAccessToken(token);
      if (!identity) {
        if (isPublic) return true;
        throw new UnauthorizedException('โทเคนไม่ถูกต้องหรือหมดอายุ');
      }
      request.user = {
        ...(await this.supabase.resolveUser(identity)),
        aal: identity.aal,
      };
      return true;
    } catch (err) {
      if (isPublic && err instanceof UnauthorizedException) return true;
      throw err;
    }
  }
}
