import {
  BadRequestException,
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Query,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { RestaurantRole } from '@prisma/client';
import { PayoutService } from './payout.service';
import { UpdatePayoutDto } from './dto/update-payout.dto';
import {
  AccessService,
  AuditService,
  SystemAdmin,
  SysadminWrite,
} from '../access';

/** Payouts: a restaurant's owner may read their own; everything platform-wide is system admin only. */
@Controller('payout')
export class PayoutController {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  @Get('weekly')
  async findWeeklyPayout(
    @Req() req: any,
    @Query('date') date: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    if (!restaurantId) throw new BadRequestException('กรุณาระบุร้านอาหาร');
    await this.access.assertRestaurantRoleScoped(
      req.user,
      restaurantId,
      [RestaurantRole.OWNER],
      { cacheKey: req },
    );
    return this.payoutService.findWeeklyPayout(date, restaurantId);
  }

  // Static routes (`today`, `weekly`) must be declared before `:payoutId`.
  @SystemAdmin()
  @Get('today')
  getTodayPayout() {
    return this.payoutService.getTodayPayout();
  }

  @SystemAdmin()
  @Get()
  findAllPayout() {
    return this.payoutService.findAllPayout();
  }

  @Get(':payoutId')
  async findPayout(@Req() req: any, @Param('payoutId') payoutId: string) {
    const payout = await this.payoutService.findPayout(payoutId);
    if (!payout) throw new NotFoundException('ไม่พบข้อมูล');
    await this.access.assertRestaurantRoleScoped(
      req.user,
      payout.restaurantId,
      [RestaurantRole.OWNER],
      { cacheKey: req },
    );
    return payout;
  }

  @SystemAdmin()
  @SysadminWrite()
  @Patch('update/:payoutId')
  async updatePayout(
    @Req() req: any,
    @Param('payoutId') payoutId: string,
    @Body() updatePayoutDto: UpdatePayoutDto,
  ) {
    const result = await this.payoutService.updatePayoutStatus(
      payoutId,
      updatePayoutDto.payoutStatus,
    );
    await this.audit.record({
      req,
      actorRole: 'SYSADMIN',
      schoolId: null,
      action: 'PAYOUT_CONFIRM',
      entityType: 'PAYOUT',
      entityId: payoutId,
      meta: { payoutStatus: updatePayoutDto.payoutStatus },
    });
    return result;
  }
}
