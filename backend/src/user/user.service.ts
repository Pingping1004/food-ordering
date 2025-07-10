import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, RoleRequestStatus } from '@prisma/client';

export type UserWithRestaurant = Prisma.UserGetPayload<{
  select: {
    userId: true;
    email: true;
    profileImg: true,
    name: true;
    role: true;
    createdAt: true;
    updatedAt: true;
    restaurant: {
      select: { restaurantId: true };
    };
  };
}>;

export type UserWithRestaurantWithoutPassword = Omit<UserWithRestaurant, 'password'>;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async createUser(createUserDto: CreateUserDto) {
    const existingUser = await this.findOneByEmail(createUserDto.email);
    if (existingUser) throw new ConflictException('User with this email already exists.');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = {
      email: createUserDto.email,
      password: hashedPassword,
      role: Role.user,
    };

    const result = await this.prisma.user.create({
      data: newUser
    });

    return result;
  }

  async findAllUsers() {
    return await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user;
  }

  async findOneUser(userId: string): Promise<UserWithRestaurantWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        profileImg: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        restaurant: {
          select: { restaurantId: true }
        }
      },
    });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้งานไอดี: ', userId);
    }

    return user;
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    const updatedUser = await this.prisma.user.update({
      where: { userId },
      data: updateUserDto,
    });

    return updatedUser;
  }

  async createRoleRequest(userId: string, requestRole: Role) {
    const existingPendingRequest = await this.prisma.roleRequest.findFirst({
      where: {
        userId,
        status: RoleRequestStatus.pending,
      },
    });

    if (existingPendingRequest) {
      throw new BadRequestException('Your request already sent, admin is processing');
    }

    const result = await this.prisma.roleRequest.create({
      data: {
        userId,
        requestRole,
        status: RoleRequestStatus.pending,
      }
    });

    return result;
  }

  async removeUser(userId: string) {
    const user = await this.prisma.user.delete({
      where: { userId }
    });

    return user;
  }
}
