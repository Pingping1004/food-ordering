import { Controller, Get, Post, Body, Patch, Param, Delete, Req, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '@prisma/client';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAllUsers();
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.userService.findOneUser(userId);
  }

  @Patch(':userId')
  updateUser(@Param('userId') userId: string, updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(userId, updateUserDto);
  }
  
  @Post('request-role')
  async createRoleRequest(@Req() req, @Body('role') requestRole: Role) {
    const userId = req.user.userId;

    await this.userService.createRoleRequest(userId, requestRole);
    return { message: 'Your role upgrade request has been submitted for admin approval.' };
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.userService.removeUser(userId);
  }
}
