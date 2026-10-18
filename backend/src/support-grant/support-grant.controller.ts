import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { SystemAdmin, SysadminWrite } from '../access';
import { SupportGrantService } from './support-grant.service';
import { CreateSupportGrantDto } from './dto/support-grant.dto';

/** Break-glass sessions: system admin (role ADMIN + aal2) only. */
@SystemAdmin()
@Controller('admin')
export class SupportGrantController {
  constructor(private readonly grants: SupportGrantService) {}

  @SysadminWrite()
  @Post('schools/:schoolId/support-grants')
  create(
    @Req() req,
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateSupportGrantDto,
  ) {
    return this.grants.create(req, schoolId, dto.reason);
  }

  @SysadminWrite()
  @Delete('schools/:schoolId/support-grants/:id')
  end(
    @Req() req,
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
  ) {
    return this.grants.end(req, schoolId, id);
  }

  @Get('support-grants/active')
  active(@Req() req) {
    return this.grants.listActive(req.user.userId);
  }
}
