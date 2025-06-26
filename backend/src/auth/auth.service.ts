import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { Role, User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) { }

  async validateUser(email: string, password: string): Promise<Partial<User> | null> {
    const user = await this.userService.findOneByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  private async generateToken(payload: { sub: string, email: string, role: Role }) {
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '30m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) throw new UnauthorizedException('Email or password is incorrect');
    
    if (!user.userId || !user.email || !user.role) {
      throw new UnauthorizedException('User data is incomplete.');
    }

    const existingUser = await this.userService.findOneUser(user.userId);
    if (!existingUser) throw new NotFoundException('Not found account with email: ', user.email);

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
      }
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);

      const newPayload = { sub: payload.sub, email: payload.email, role: payload.role };
      const { accessToken, refreshToken: newRefreshToken } = await this.generateToken(newPayload);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async regsiter(signupDto: SignupDto) {
    const existingUser = await this.userService.findOneByEmail(signupDto.email);
    if (existingUser) throw new ConflictException('User with this email already exists');

    const newUser = await this.userService.createUser({ ...signupDto, role: Role.user });
    return this.login({ email: newUser.email, password: signupDto.password });
  }
}
