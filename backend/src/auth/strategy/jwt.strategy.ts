import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { Role } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger('JwtStrategy')
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.access_token;
        },
      ]),
      secretOrKey: jwtSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string; email: string; role: Role }) {
    try {
      const user = await this.userService.findOneUser(payload.sub);
      this.logger.log(`✅ User found from JWT: ${JSON.stringify(user)}`);

      return { userId: payload.sub, email: payload.email, role: payload.role };
    } catch (err) {
      this.logger.warn(`User not found or error in JWT validate: ${err.message}`);
      return null; // Important: Passport needs null to trigger 401
    }
  }
}
