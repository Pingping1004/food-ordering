import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/guards/supabase-auth.guard';
import { NotificationService } from './notification.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { DeactivateDeviceTokenDto } from './dto/deactivate-device-token.dto';

@Controller('notification')
@UseGuards(SupabaseAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('device-token')
  async registerDeviceToken(@Req() req, @Body() dto: RegisterDeviceTokenDto) {
    const userId = req.user.userId as string;
    const token = await this.notificationService.registerDeviceToken(
      userId,
      dto,
    );

    return {
      message: 'ลงทะเบียนอุปกรณ์สำหรับแจ้งเตือนสำเร็จ',
      result: token,
    };
  }

  @Delete('device-token')
  async deactivateDeviceToken(
    @Req() req,
    @Body() dto: DeactivateDeviceTokenDto,
  ) {
    const userId = req.user.userId as string;
    await this.notificationService.deactivateDeviceToken(userId, dto.token);

    return {
      message: 'ปิดการใช้งานอุปกรณ์แจ้งเตือนสำเร็จ',
    };
  }
}
