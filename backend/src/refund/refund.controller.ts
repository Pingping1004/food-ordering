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
import { RestaurantRole } from '@prisma/client';
import { RestaurantScope, SchoolScope } from '../access';
import { RefundService } from './refund.service';
import {
  CreateRefundRequestDto,
  DecideRefundDto,
  ListRefundsQueryDto,
} from './dto/refund.dto';

/** Student side: only ever the caller's own orders / requests. */
@Controller()
export class StudentRefundController {
  constructor(private readonly refunds: RefundService) {}

  @Post('order/:orderId/refund-request')
  create(
    @Req() req,
    @Param('orderId') orderId: string,
    @Body() dto: CreateRefundRequestDto,
  ) {
    return this.refunds.create(req.user.userId, orderId, dto);
  }

  @Get('me/refund-requests')
  listMine(@Req() req) {
    return this.refunds.listMine(req.user.userId);
  }

  @Get('me/refund-requests/:id')
  getMine(@Req() req, @Param('id') id: string) {
    return this.refunds.getMine(req.user.userId, id);
  }
}

/** School admin decides; the system admin reads (writes need a support grant, see AccessService). */
@Controller('schools/:schoolId/refund-requests')
export class SchoolRefundController {
  constructor(private readonly refunds: RefundService) {}

  @SchoolScope('schoolId')
  @Get()
  list(
    @Param('schoolId') schoolId: string,
    @Query() query: ListRefundsQueryDto,
  ) {
    return this.refunds.listForSchool(schoolId, query);
  }

  // Static `summary` is declared before `:id`.
  @SchoolScope('schoolId')
  @Get('summary')
  summary(@Param('schoolId') schoolId: string) {
    return this.refunds.summary(schoolId);
  }

  @SchoolScope('schoolId')
  @Get(':id')
  get(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.refunds.getForSchool(schoolId, id);
  }

  @SchoolScope('schoolId')
  @Patch(':id')
  decide(
    @Req() req,
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() dto: DecideRefundDto,
  ) {
    return this.refunds.decide(req, schoolId, id, dto);
  }
}

/** Shop owner / staff: read-only view of their shop's requests. */
@Controller('restaurant/:restaurantId/refund-requests')
export class RestaurantRefundController {
  constructor(private readonly refunds: RefundService) {}

  @RestaurantScope({
    param: 'restaurantId',
    roles: [RestaurantRole.OWNER, RestaurantRole.ADMIN, RestaurantRole.STAFF],
    allowSchoolAdmin: true,
  })
  @Get()
  list(
    @Param('restaurantId') restaurantId: string,
    @Query() query: ListRefundsQueryDto,
  ) {
    return this.refunds.listForRestaurant(restaurantId, query);
  }
}
