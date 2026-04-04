import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Request, Response } from 'express';
import { Public } from 'src/decorators/public.decorator';
import { CsrfTokenService } from 'src/csrf/csrf.service';
import { accessTokenCookieOptions, clearAccessToken, clearRefreshToken, csrfCookieOptions, refreshTokenCookieOptions } from '../utils/cookie-options.helper';
import { RefreshTokenService } from 'src/refreshToken/refresh-token.service';
import { JwtService } from '@nestjs/jwt';

// Extend the Request interface to include csrfToken
declare module 'express-serve-static-core' {
  interface Request {
    csrfToken?: () => string;
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly csrfTokenService: CsrfTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) { }

  private readonly logger = new Logger('AuthController');

  @Public()
  @Post('signup')
  async signup(
    @Body() signupDto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.register(signupDto);

    res.cookie('access_token', accessToken, accessTokenCookieOptions);
    res.cookie('refresh_token', refreshToken, refreshTokenCookieOptions);

    const csrfTokenForClient = this.csrfTokenService.generateToken()
    res.cookie('XSRF-TOKEN', csrfTokenForClient, csrfCookieOptions);

    return { message: 'Signup successful', user: user };
  }

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.login(loginDto);

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('access_token', { path: '/', domain: '.promptserve.online' });
    res.clearCookie('refresh_token', { path: '/', domain: '.promptserve.online' });

    res.cookie('access_token', accessToken, accessTokenCookieOptions);
    res.cookie('refresh_token', refreshToken, refreshTokenCookieOptions);

    const csrfTokenForClient = this.csrfTokenService.generateToken();
    res.cookie('XSRF-TOKEN', csrfTokenForClient, csrfCookieOptions);

    return { message: 'Login successful', user: user };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token']
    if (!refreshToken)
      throw new UnauthorizedException('ไม่พบโทเคน');

    const result = await this.authService.refresh(refreshToken);
    res.cookie('access_token', result.accessToken, accessTokenCookieOptions);
    res.cookie('refresh_token', result.refreshToken, refreshTokenCookieOptions);

    return { message: 'Token refreshed', user: result.user };
  }

  @Post('/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      try {
        const payload = this.jwtService.decode(refreshToken) as { jti: string };
        if (payload?.jti) await this.refreshTokenService.revokeToken(payload.jti);
      } catch (error) {
        this.logger.warn("Logout error: ", error.message);
      }
    }

    res.clearCookie('access_token', clearAccessToken);
    res.clearCookie('refresh_token', clearRefreshToken);
    res.clearCookie('XSRF-TOKEN', { path: '/', domain: clearAccessToken.domain });

    return { message: 'Logout successful' };
  }
}
