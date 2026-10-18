import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Liveness: the process is up. Never touches the database, so a DB blip does not get the API restarted. */
  @Public()
  @Get('/health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: can this instance serve traffic (database reachable within 2 s)? Point the load balancer here. */
  @Public()
  @Get('/ready')
  async getReady() {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout')), 2000).unref()),
      ]);
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', db: 'down' });
    }
    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}
