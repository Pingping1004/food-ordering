import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { SchoolService } from './school.service';
import { InviteCodeDto } from './dto/school.dto';

/** Self-scope school routes: the school always comes from `req.user`, never from the client. */
@Controller('me/school')
export class MeSchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Patch()
  change(@Req() req, @Body() dto: InviteCodeDto) {
    return this.schoolService.changeSchool(req.user.userId, dto.code);
  }

  @Get()
  getMine(@Req() req) {
    return this.schoolService.getMySchool(req.user.userId);
  }

  @Get('canteens/:canteenId/restaurants')
  canteenRestaurants(@Req() req, @Param('canteenId') canteenId: string) {
    return this.schoolService.getCanteenRestaurants(req.user.userId, canteenId);
  }
}
