import { Controller, Get, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from '@prisma/client';
import { CsrfGuard } from 'src/guards/csrf.guard';

@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles([Role.admin])
@Controller('request')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAll() {
    return this.adminService.findAllRequest();
  }

  @Get('pending')
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
