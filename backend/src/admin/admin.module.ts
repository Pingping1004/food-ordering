import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UserModule } from 'src/user/user.module';
import { PrismaService } from '../prisma/prisma.service'

@Module({
  imports: [UserModule],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
})
export class AdminModule {}
