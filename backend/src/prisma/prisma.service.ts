import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    const connectionString =
      configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

    if (!connectionString) throw new Error('DATABASE_URL missing');

    const logger = new Logger(PrismaService.name);
    logger.log(
      `Connecting to: ${connectionString.replace(/:[^@]+@/, ':***@')}`,
    );

    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });

    pool.on('error', (err) => {
      logger.warn(`Unexpected error on idle database client: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);

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
        await this.$disconnect();

        if (attempt === maxRetries) throw err;

        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }

  async withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const message = err?.message || '';
      const retryable =
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'P1001' ||
        message.includes('Server has closed the connection') ||
        message.includes('Connection terminated unexpectedly') ||
        message.includes('Connection terminated due to connection timeout');

      if (retries > 0 && retryable) {
        this.logger.warn(
          `Retrying DB query due to connection drop... (${retries} left)`,
        );

        await new Promise((r) => setTimeout(r, 500));

        return this.withRetry(fn, retries - 1);
      }

      throw err;
    }
  }

  async withTimeout(promise, ms = 30000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB_TIMEOUT')), ms),
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
