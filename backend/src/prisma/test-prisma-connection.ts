import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const logger = new Logger('Test prisma connection');

async function testConnection() {
  try {
    await prisma.$connect();
    logger.log('✅ Prisma connected successfully');
  } catch (err) {
    logger.error('❌ Prisma connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
