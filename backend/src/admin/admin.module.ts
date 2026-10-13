import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UserModule } from 'src/user/user.module';
import { PrismaService } from '../prisma/prisma.service';
import { CsrfModule } from 'src/csrf/csrf.module';

@Module({
  imports: [UserModule, CsrfModule],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
})
export class AdminModule {}
