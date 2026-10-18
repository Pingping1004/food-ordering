import { Module } from '@nestjs/common';
import { InviteModule } from '../invite/invite.module';
import { UploadModule } from '../upload/upload.module';
import { SchoolService } from './school.service';
import { SchoolAdminService } from './school-admin.service';
import { MeSchoolController } from './me-school.controller';
import { SchoolsController } from './schools.controller';
import { AdminSchoolsController } from './admin-schools.controller';

@Module({
  imports: [InviteModule, UploadModule],
  controllers: [MeSchoolController, SchoolsController, AdminSchoolsController],
  providers: [SchoolService, SchoolAdminService],
  exports: [SchoolService, SchoolAdminService],
})
export class SchoolModule {}
