import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, RoleRequestStatus } from '@prisma/client';
import { RestaurantService } from 'src/restaurant/restaurant.service';

export type UserWithRestaurant = Prisma.UserGetPayload<{
  select: {
    userId: true;
    email: true;
    profileImg: true;
    name: true;
    role: true;
    createdAt: true;
    updatedAt: true;
    restaurant: {
      select: { restaurantId: true, isApproved: true };
    };
    RoleRequest: {
      select: {
        requestId: true;
        userId: true;
        requestRole: true;
        status: true;
        createdAt: true;
        updatedAt: true;
      };
    };
  };
}>;

export type UserWithRestaurantWithoutPassword = Omit<
  UserWithRestaurant,
  'password'
>;

export type UserProfile = Omit<UserWithRestaurantWithoutPassword, 'RoleRequest'> & {
  roleRequest: UserWithRestaurantWithoutPassword['RoleRequest'] | null;
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RestaurantService))
    private readonly restaurantService: RestaurantService
  ) { }

  async createUser(createUserDto: CreateUserDto) {
    const existingUser = await this.findOneByEmail(createUserDto.email);
    if (existingUser)
      throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = {
      name: createUserDto.email.split("@")[0],
      email: createUserDto.email,
      password: hashedPassword,
      role: Role.user,
    };

    const result = await this.prisma.user.create({
      data: newUser,
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
    const user = await this.prisma.safeRead(() =>
      this.prisma.user.findUnique({
        where: { email },
      }));

    return user;
  }

  async findOneUser(
    userId: string,
  ): Promise<UserProfile> {
    const user = await this.prisma.safeRead(() =>
      this.prisma.user.findUnique({
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
            select: {
              restaurantId: true,
              isApproved: true,
            },
          },
          RoleRequest: {
            select: {
              requestId: true,
              userId: true,
              requestRole: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }));

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้งานไอดี: ', userId);
    }

    const { RoleRequest, ...rest } = user;
    return {
      ...rest,
      roleRequest: RoleRequest ?? null,
    };
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    const updatedUser = await this.prisma.user.update({
      where: { userId },
      data: updateUserDto,
    });

    return updatedUser;
  }

  async createRoleRequest(userId: string, requestRole: Role) {
    if (requestRole !== Role.cooker) throw new BadRequestException('อนุญาตให้ขอเป็นร้านอาหารเท่านั้น');

    const { name } = await this.findOneUser(userId)
    const existingPendingRequest = await this.prisma.roleRequest.findFirst({
      where: {
        userId,
        status: RoleRequestStatus.pending,
      },
    });

    if (existingPendingRequest) throw new BadRequestException('คุณได้ส่งคำขอไปแล้ว ระบบกำลังรอการอนุมัติจากผู้ดูแลอยู่');

    try {
      const result = await this.prisma.roleRequest.create({
        data: {
          userId,
          username: name,
          requestRole,
          status: RoleRequestStatus.pending,
        },
      });

      return result;
    } catch (error) {
      // Handle unique constraint on userId to provide a friendly message
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('คุณได้ส่งคำขอไปแล้ว ระบบกำลังรอการอนุมัติจากผู้ดูแลอยู่');
      }
      
      throw error;
    }
  }

  async updateRoleRequest(userId: string, requestRole: Role, status: RoleRequestStatus) {
    const roleRequest = await this.prisma.roleRequest.update({
      where: { userId },
      data: {
        requestRole,
        status,
      },
    });

    if (status === RoleRequestStatus.accepted) {
      await this.prisma.user.update({
        where: { userId },
        data: { role: requestRole },
      });
    }

    return roleRequest;
  }

  // activated once the request is rejected so user can resend new reqeust
  // async removeRoleRequest() {}

  async removeUser(userId: string) {
    const user = await this.prisma.user.delete({
      where: { userId },
    });

    return user;
  }
}
