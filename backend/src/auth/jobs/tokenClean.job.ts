import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';

const prisma = new PrismaClient();
const logger = new Logger('Expire token clean job');

export const deleteExpiredTokens = async () => {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { isRevoked: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    logger.log(`⏰ Deleted ${result.count} expired/invalid tokens`);
  } catch (error) {
    logger.error('❌ Failed to clean up tokens:', error);
  }
};

// Run every day at midnight
cron.schedule('0 0 * * *', deleteExpiredTokens);