import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { PayoutService } from './payout.service';
import { calculatePayout } from './payout-calculator';

@Controller('payout')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post(':orderId')
  createPayout(@Param('orderId') orderId: string) {
    return this.payoutService.createPayout(orderId);
  }

  @Get('weekly')
  findWeeklyPayout(
    @Query('date') date: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    return this.payoutService.findWeeklyPayout(date, restaurantId);
  }

  @Get(':payoutId')
  findPayout(payoutId: string) {
    return this.payoutService.findPayout(payoutId);
  }

  @Get('today')
  getTodayPayout() {
    return this.payoutService.getTodayPayout();
  }

  @Get()
  findAllPayout(payoutId?: string) {
    return this.payoutService.findAllPayout();
  }
}
