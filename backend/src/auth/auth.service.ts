import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
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

  async login(createAuthDto: CreateAuthDto) {
    const user = await this.validateUser(createAuthDto.email, createAuthDto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials.');

    if (!user.userId || !user.email || !user.role) {
      throw new UnauthorizedException('User data is incomplete.');
    }

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

  async registerUser(createAuthDto: CreateAuthDto) {
    const existingUser = await this.userService.findOneByEmail(createAuthDto.email);
    if (existingUser) throw new ConflictException('User with this email already exists');
    
    const newUser = await this.userService.createUser({ ...createAuthDto, role: Role.user });
    return this.login({ email: newUser.email, password: createAuthDto.password });
  }

  async registerCooker(createAuthDto: CreateAuthDto) {
    const newUser = await this.userService.createUser({ ...createAuthDto, role: Role.cooker });
    return this.login({ email: newUser.email, password: createAuthDto.password });
  }
}
