import { Controller, Get, Post, Body, Patch, Param, Delete, Req, BadRequestException, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role, User } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post()
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAllUsers();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req): Promise<Omit<User, 'password'>> {
    console.log('GET /user/profile route was successfully hit!');
    const userId = req.user.userId;
    const user = await this.userService.findOneUser(userId);
    return user;
  }

  @Post('request-role')
  async createRoleRequest(@Req() req, @Body('role') requestRole: Role) {
    const userId = req.user.userId;
    
    await this.userService.createRoleRequest(userId, requestRole);
    return { message: 'Your role upgrade request has been submitted for admin approval.' };
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.userService.findOneUser(userId);
  }

  @Patch(':userId')
  updateUser(@Param('userId') userId: string, updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(userId, updateUserDto);
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.userService.removeUser(userId);
  }
}
