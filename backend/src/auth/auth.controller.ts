import { Controller, Post, Body, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService
    ) {}

    @Post('/signup')
    async signup(@Body() signupDto: SignupDto) {
        return this.authService.regsiter(signupDto);
    }

    @Post('/login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('/refresh')
    async refresh(@Body('refreshToken') refreshToken: string) {
        if (!refreshToken) throw new UnauthorizedException('No refresh token provided');
        return this.authService.refresh(refreshToken);
    }

    @Post('/logout')
    async logout(@Req() req) {
        return { message: `Logout successful` };
    }
}