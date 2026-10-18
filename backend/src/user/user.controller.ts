import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Header,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SystemAdmin } from 'src/access';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @SystemAdmin()
  @Get()
  findAll() {
    return this.userService.findAllUsers();
  }

  @Get('profile')
  @Header('Content-Type', 'application/json')
  async getProfile(@Req() req): Promise<unknown> {
    return this.userService.findOneUser(req.user.userId, req.user.aal);
  }

  // Declared before `:userId` so "me" is never read as a user id.
  @Delete('me')
  deleteMyAccount(@Req() req) {
    return this.userService.deleteMyAccount(req.user.userId);
  }

  @SystemAdmin()
  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.userService.findOneUser(userId);
  }

  @SystemAdmin()
  @Patch(':userId')
  updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(userId, updateUserDto);
  }

  @SystemAdmin()
  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.userService.removeUser(userId);
  }
}
