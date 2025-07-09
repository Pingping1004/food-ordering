
import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    console.log('--- JwtAuthGuard handleRequest Method Invoked ---');
    console.log('Passport.js Error (err):', err);     // Will be non-null if Passport.js failed
    console.log('Validated User (user):', user);       // Will be null if Passport.js failed validation
    console.log('Auth Info (info):', info);

    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    if (info) {
      console.error(`  Info details: Name=${info.name}, Message=${info.message}`);
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

    console.log('JwtAuthGuard: User successfully authenticated.');
    return user;
  }
}
