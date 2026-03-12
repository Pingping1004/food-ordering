import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TokenCleanService {
  private readonly logger = new Logger(TokenCleanService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 0 * * *') // every day at midnight
  async deleteExpiredTokens() {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { isRevoked: true },
            { expiresAt: { lt: new Date() } },
          ],
        },
      });

      this.logger.log(`Deleted ${result.count} expired/invalid tokens`);
    } catch (error) {
      this.logger.error('Failed to clean tokens', error);
    }
  }
}