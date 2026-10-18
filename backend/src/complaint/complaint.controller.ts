import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ComplaintTarget } from '@prisma/client';
import { SchoolScope, SystemAdmin } from '../access';
import { ComplaintService } from './complaint.service';
import {
  CreateComplaintDto,
  ListComplaintsQueryDto,
} from './dto/complaint.dto';

/** Student side: complaints about the caller's own orders. */
@Controller('order/:orderId/complaint')
export class StudentComplaintController {
  constructor(private readonly complaints: ComplaintService) {}

  @Post()
  create(
    @Req() req,
    @Param('orderId') orderId: string,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaints.create(req.user.userId, orderId, dto);
  }
}

/** Complaints addressed to the school. */
@Controller('schools/:schoolId/complaints')
export class SchoolComplaintController {
  constructor(private readonly complaints: ComplaintService) {}

  @SchoolScope('schoolId')
  @Get()
  list(
    @Param('schoolId') schoolId: string,
    @Query() q: ListComplaintsQueryDto,
  ) {
    return this.complaints.list(
      { target: ComplaintTarget.SCHOOL, schoolId },
      q.status,
    );
  }

  @SchoolScope('schoolId')
  @Patch(':id/resolve')
  resolve(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.complaints.resolve(id, {
      target: ComplaintTarget.SCHOOL,
      schoolId,
    });
  }
}

/** Complaints addressed to the platform. */
@SystemAdmin()
@Controller('admin/complaints')
export class AdminComplaintController {
  constructor(private readonly complaints: ComplaintService) {}

  @Get()
  list(@Query() q: ListComplaintsQueryDto) {
    return this.complaints.list({ target: ComplaintTarget.SYSTEM }, q.status);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.complaints.resolve(id, { target: ComplaintTarget.SYSTEM });
  }
}
