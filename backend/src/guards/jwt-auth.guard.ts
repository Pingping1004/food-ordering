import {
  Injectable,
  UnauthorizedException,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isObservable, lastValueFrom } from 'rxjs';
import { IS_PUBLIC_KEY } from 'src/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger('JwtAuthGuard');

  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const result = super.canActivate(context);
    if (result instanceof Promise) {
      return await result;
    } else if (isObservable(result)) {
      return await lastValueFrom(result);
    } else {
      return result;
    }
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    if (info) {
      this.logger.error(
        `  Info details: Name=${info.name}, Message=${info.message}`,
      );
      // Specific checks for common JWT errors:
      if (info.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token Expired');
      } else if (info.name === 'JsonWebTokenError') {
        // This is often due to an invalid signature (secret mismatch)
        throw new UnauthorizedException('Invalid Token Signature');
      } else if (info.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not active yet');
      }
      throw err || new UnauthorizedException('Unauthorized');
    }

    return user;
  }
}
