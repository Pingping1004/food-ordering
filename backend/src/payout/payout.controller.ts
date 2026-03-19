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
import { UpdatePayoutDto } from './dto/update-payout.dto';

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
  findAllPayout() {
    return this.payoutService.findAllPayout();
  }

  @Patch('update/:payoutId')
  updatePayout(@Param('payoutId') payoutId: string, @Body() updatePayoutDto: UpdatePayoutDto) {
    return this.payoutService.updatePayout(payoutId, updatePayoutDto.isPaid)
  }
}
