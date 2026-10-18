import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { InviteCodeService } from './invite-code.service';
import { InviteCodeDto } from '../school/dto/school.dto';

/** Any logged-in user. The code (not the client) decides which role request is created. */
@Controller('me')
export class MeCodesController {
  constructor(private readonly codes: InviteCodeService) {}

  @Post('redeem-code')
  @HttpCode(200)
  redeem(@Req() req, @Body() dto: InviteCodeDto) {
    return this.codes.redeem(req.user.userId, dto.code);
  }
}
