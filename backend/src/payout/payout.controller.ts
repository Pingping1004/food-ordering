import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { UpdatePayoutDto } from './dto/update-payout.dto';
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
  findPayout(payoutId?: string) {
    return this.payoutService.findPayout(payoutId);
  }

  @Get()
  calculatePayout(
    @Query('amount') amount: number,
  ) {
    return calculatePayout(amount);
  }

  @Get()
  findAllPayout(payoutId?: string) {
    return this.payoutService.findAllPayout();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePayoutDto: UpdatePayoutDto) {
    return this.payoutService.update(+id, updatePayoutDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.payoutService.remove(+id);
  }
}
