import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserService, UserWithRestaurant } from 'src/user/user.service';
import { Role, User } from '@prisma/client';
import { RefreshTokenService } from 'src/refreshToken/refresh-token.service';
import { v4 as uuidv4 } from 'uuid';
import { CsrfTokenService } from 'src/csrf/csrf.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  user: Omit<UserWithRestaurant, 'password' | 'createdAt' | 'updatedAt'>;
}

interface ValidatedUserResult {
  user?: Omit<User, 'password'>;
  errorType?: 'EMAIL_NOT_FOUND' | 'INCORRECT_PASSWORD' | 'UNKNOWN_VALIDATION_ERROR';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly csrfTokenService: CsrfTokenService,
  ) { }

  private readonly logger = new Logger('AuthService');

  async validateUser(
    email: string,
    pass: string,
  ): Promise<ValidatedUserResult | null> {
    const user = await this.userService.findOneByEmail(email);

    let isPasswordValid = false;
    if (user) {
      isPasswordValid = await bcrypt.compare(pass, user.password);
    } else {
      // If user DOES NOT exist, *still* perform a time-consuming operation.
      const dummyHashedPassword = await bcrypt.hash('dummy_password_for_timing', 10); // Hash a dummy pass with a fixed salt rounds
      await bcrypt.compare(pass, dummyHashedPassword); // This takes roughly the same time as a real comparison.
      this.logger.warn(`Login attempt for non-existent email: ${email}`);
      return { errorType: 'EMAIL_NOT_FOUND' };
    }

    if (!isPasswordValid) {
      return null;
    }

    const { password, ...result } = user;
    return { user: result }
  }

  private async generateToken(payload: {
    sub: string;
    email: string;
    role: Role;
  }) {
    const jti = uuidv4();
    const accessToken = await this.jwtService.signAsync(
      { ...payload, jti },
      {
        expiresIn: '30m',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti } as RefreshTokenPayload,
      {
        expiresIn: '7d',
      },
    );

    const refreshTokenExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );
    await this.refreshTokenService.createRefreshtToken({
      token: refreshToken,
      jti,
      userId: payload.sub,
      expiresAt: refreshTokenExpiresAt,
      issuedAt: new Date(),
    });

    return { accessToken, refreshToken };
  }

  async login(loginDto: LoginDto) {
    this.csrfTokenService.generateToken();
    const validationResult = await this.validateUser(loginDto.email, loginDto.password);
    if (!validationResult) throw new NotFoundException('Validation result not found');

    if (validationResult.errorType) {
      this.logger.log(`Login failed: Email '${loginDto.email}' not found.`);
      throw new UnauthorizedException('...');
    }

    const user = validationResult.user;

    if (!user) throw new NotFoundException('User data not found');
    if (!user.userId || !user.email || !user.role) {
      this.logger.error(`User data is incomplete for user ID: ${user.userId}`);
      throw new UnauthorizedException('User profile is incomplete. Please contact support.');
    }

    const existingUser = await this.userService.findOneUser(user.userId);

    const payload = { sub: user.userId, email: user.email, role: user.role };
    const { accessToken, refreshToken } = await this.generateToken(payload);

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurant: {
          restaurantId: existingUser.restaurant?.restaurantId,
          isApproved: existingUser.restaurant?.isApproved,
        }
      },
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);

      if (!payload.jti || !payload.sub) {
        throw new UnauthorizedException(
          'Invalid refresh token payload: missing JTI or User ID',
        );
      }

      const storedToken = await this.refreshTokenService.findTokenByJti(
        payload.jti,
      );
      if (!storedToken || storedToken.isRevoked) {
        throw new UnauthorizedException('Invalid or revoked refresh token');
      }

      if (storedToken.isUsed) {
        await this.refreshTokenService.invalidateAllUserRefreshTokens(
          payload.sub,
        );
        throw new UnauthorizedException(
          'Compromised token detected. Please log in again.',
        );
      }

      await this.refreshTokenService.markTokenAsUsed(payload.jti);

      const user = await this.userService.findOneUser(payload.sub);
      if (!user) {
        await this.refreshTokenService.revokeToken(payload.jti);
        throw new UnauthorizedException(
          'User associated with refresh token not found.',
        );
      }

      const newAccessTokenPayload: AccessTokenPayload = {
        sub: user.userId,
        email: user.email,
        role: user.role,
      };

      const { accessToken, refreshToken: newRefreshToken } =
        await this.generateToken(newAccessTokenPayload);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          role: user.role,
          restaurant: user.restaurant
            ? { restaurantId: user.restaurant.restaurantId, isApproved: user.restaurant.isApproved }
            : null,
          profileImg: user.profileImg,
        },
      };
    } catch (error) {
      this.logger.error('Refresh token verification failed:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async register(signupDto: SignupDto) {
    this.csrfTokenService.generateToken();
    const existingUser = await this.userService.findOneByEmail(signupDto.email);
    if (existingUser)
      throw new ConflictException('User with this email already exists');

    const newUser = await this.userService.createUser({
      ...signupDto,
      role: Role.user,
    });
    return this.login({ email: newUser.email, password: signupDto.password });
  }
}
