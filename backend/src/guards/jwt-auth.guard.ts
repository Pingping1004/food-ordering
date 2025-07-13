import {
  Injectable,
  UnauthorizedException,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger('JwtAuthGuard');
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
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
