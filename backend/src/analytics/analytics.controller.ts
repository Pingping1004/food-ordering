import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../decorators/public.decorator';
import { AnalyticsService } from './analytics.service';
import { CreateClientEventDto } from './dto/client-event.dto';

@Controller('events')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Client analytics beacon. Public so pre-login views count; userId is attached only when a valid token is sent. */
  @Public()
  @Post()
  @HttpCode(202)
  async create(
    @Body() dto: CreateClientEventDto,
    @Req() req: Request & { user?: { userId?: string } },
  ) {
    await this.analytics.recordClientEvent(dto, req.user?.userId);
    return { ok: true };
  }
}
