import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
  
    if (!connectionString) throw new Error("DATABASE_URL missing");

    const pool = new Pool({
      connectionString
    });

    const adapter = new PrismaPg(pool)
  
    super({
      adapter,
    });
  }

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
