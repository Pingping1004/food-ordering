import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  // async onModuleInit() {
  //   await this.$connect();
  // }
  async onModuleInit() {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.$connect();
        break;
      } catch {
        attempt++;
        this.logger.error(
          `🔁 Prisma connect attempt ${attempt} failed. Retrying...`,
        );
        await new Promise((res) => setTimeout(res, 2000)); // wait 2s
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDb() {
    await this.$transaction([]);
  }
}
