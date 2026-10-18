import { Module } from '@nestjs/common';
import {
  AdminComplaintController,
  SchoolComplaintController,
  StudentComplaintController,
} from './complaint.controller';
import { ComplaintService } from './complaint.service';

@Module({
  controllers: [
    StudentComplaintController,
    SchoolComplaintController,
    AdminComplaintController,
  ],
  providers: [ComplaintService],
})
export class ComplaintModule {}
