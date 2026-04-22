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
  
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('✅ Prisma connected');
        return;
      } catch (err) {
        this.logger.error(`❌ Attempt ${attempt} failed`);
        await this.$disconnect(); // reset connection
  
        if (attempt === maxRetries) throw err;
  
        await new Promise(res => setTimeout(res, 2000));
      }
    }
  }

  async withRetry(fn, retries = 2) {
    try {
      return await fn();
    } catch (err) {
      const retryable =
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNRESET' ||
        err.code === 'P1001';

      if (retries > 0 && retryable) {
        this.logger.warn(`Retrying DB query... (${retries} left)`);

        await this.$disconnect(); // 🔥 critical

        await new Promise(r => setTimeout(r, 300));

        return this.withRetry(fn, retries - 1);
      }

      throw err;
    }
  }

  async withTimeout(promise, ms = 30000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB_TIMEOUT')), ms)
      ),
    ]);
  }

  async read(fn) {
    return this.withRetry(fn);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async safeRead(fn) {
    return this.withRetry(() => this.withTimeout(fn(), 5000), 2);
  }

  async cleanDb() {
    await this.$transaction([]);
  }
}
