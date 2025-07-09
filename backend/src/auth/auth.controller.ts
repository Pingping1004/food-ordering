import { Controller, Post, Body, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Request, Response } from 'express';
import { Public } from 'src/decorators/public.decorator';
import { CsrfTokenService } from 'src/csrf/csrf.service';

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
        private readonly csrfTokenService: CsrfTokenService,
    ) { }

    @Public()
    @Post('signup')
    async signup(@Body() signupDto: SignupDto, @Res({ passthrough: true }) res: Response) {
        const { user, accessToken, refreshToken } = await this.authService.register(signupDto);

        res.cookie('access_token', accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 30 * 60 * 1000,
        });

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return {
            message: 'Signup successful',
            user: user,
        };
    }

    @Public()
    @Post('login')
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
        const { user, accessToken, refreshToken } = await this.authService.login(loginDto);

        res.cookie('access_token', accessToken, {
            httpOnly: true,
            // secure: process.env.NODE_ENV === 'production',
            secure: true,
            sameSite: 'none',
            maxAge: 30 * 60 * 1000,
        });

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            // secure: process.env.NODE_ENV === 'production',
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const csrfTokenForClient = this.csrfTokenService.generateToken(); // Use your service to generate the token
        res.cookie('XSRF-TOKEN', csrfTokenForClient, {
            httpOnly: false,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        return {
            message: 'Login successful',
            user: user,
            accessToken,
        };
    }

    @Post('refresh')
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const refreshToken = req.cookies['refresh_token'] || req.body.refreshToken;
        if (!refreshToken) throw new UnauthorizedException('No refresh token provided');

        const result = await this.authService.refresh(refreshToken);
        res.cookie('access_token', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development_https',
            sameSite: 'lax',
            expires: new Date(Date.now() + 15 * 60 * 1000),
            path: '/',
        });
        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development_https',
            sameSite: 'lax',
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            path: '/',
        });

        return { accessToken: result.accessToken, user: result.user };
    }

    @Post('/logout')
    async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        return { message: `Logout successful` };
    }
}