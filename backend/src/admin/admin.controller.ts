import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Controller('request')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAll() {
    return this.adminService.findAllRequest();
  }

  @Get()
  findPendingRequest() {
    return this.adminService.findPendingRequest();
  }

  @Get(':requestId')
  findOne(@Param('requestId') requestId: string) {
    return this.adminService.findOneRequest(requestId);
  }

  @Patch(':requestId/approve')
  approveRequest(@Param('requestId') requestId: string) {
    return this.adminService.approveRoleRequest(requestId);
  }

  @Patch(':requestId/reject')
  rejectRequest(@Param('requestId') requestId: string) {
    return this.adminService.rejectRoleRequest(requestId);
  }

  @Delete(':requestId')
  remove(@Param('requestId') requestId: string) {
    return this.adminService.removeRequest(requestId);
  }
}
