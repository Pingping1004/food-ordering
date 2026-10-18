import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { imageFileFilter } from '../utils/file-upload.utils';
import { AuditService, SchoolScope } from '../access';
import { InviteCodeService } from '../invite/invite-code.service';
import {
  CreateSchoolCodeDto,
  ListCodesQueryDto,
} from '../invite/dto/invite.dto';
import { SchoolService } from './school.service';
import { SchoolAdminService, SUMMARY_RANGES } from './school-admin.service';
import {
  CreateCanteenDto,
  MembershipQueryDto,
  MoveRestaurantCanteenDto,
  RestaurantStatusDto,
  StatusQueryDto,
  UpdateCanteenDto,
  UpdateSchoolDto,
  AuditLogQueryDto,
} from './dto/school.dto';
import { Status } from '@prisma/client';

@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly adminService: SchoolAdminService,
    private readonly codes: InviteCodeService,
    private readonly audit: AuditService,
  ) {}

  /** Students check their own school's opening status (the school comes from the session, never trusted from the URL alone). */
  @Get(':schoolId/today-status')
  async todayStatus(@Param('schoolId') schoolId: string, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') {
      const me = await this.schoolService.getUserSchoolId(req.user.userId);
      if (me !== schoolId) throw new ForbiddenException();
    }
    return this.schoolService.getDayStatus(schoolId);
  }

  @SchoolScope('schoolId')
  @Get(':schoolId')
  get(@Param('schoolId') schoolId: string) {
    return this.schoolService.getSchoolForSchoolAdmin(schoolId);
  }

  @SchoolScope('schoolId')
  @Patch(':schoolId')
  update(@Param('schoolId') schoolId: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolService.updateSchool(schoolId, dto);
  }

  @SchoolScope('schoolId')
  @Post(':schoolId/invite-code/rotate')
  rotate(@Param('schoolId') schoolId: string) {
    return this.schoolService.rotateInviteCode(schoolId);
  }

  // ------------------------------------------------------------ audit trail (read only)
  @SchoolScope('schoolId')
  @Get(':schoolId/audit-log')
  auditLog(
    @Param('schoolId') schoolId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.audit.listForSchool(schoolId, query);
  }

  // ------------------------------------------------------------ metrics & summary
  @SchoolScope('schoolId')
  @Get(':schoolId/metrics/summary')
  getSummary(@Param('schoolId') schoolId: string, @Query('range') range?: string) {
    const r = SUMMARY_RANGES.find((x) => x === range);
    return this.adminService.getSchoolSummary(schoolId, r);
  }

  // ------------------------------------------------------------ hours & overrides
  @SchoolScope('schoolId')
  @Get(':schoolId/hours')
  getHours(@Param('schoolId') schoolId: string) {
    return this.adminService.getSchoolHours(schoolId);
  }

  @SchoolScope('schoolId')
  @Put(':schoolId/hours')
  saveHours(
    @Param('schoolId') schoolId: string,
    @Body() dto: { hours: any[] },
  ) {
    return this.adminService.saveSchoolHours(schoolId, dto?.hours ?? []);
  }

  @SchoolScope('schoolId')
  @Get(':schoolId/overrides')
  getOverrides(@Param('schoolId') schoolId: string) {
    return this.adminService.getSchoolOverrides(schoolId);
  }

  @SchoolScope('schoolId')
  @Put(':schoolId/overrides')
  saveOverrides(
    @Param('schoolId') schoolId: string,
    @Body() dto: { overrides: any[] },
  ) {
    return this.adminService.saveSchoolOverrides(schoolId, dto?.overrides ?? []);
  }

  // ------------------------------------------------------------ role-typed invite codes
  @SchoolScope('schoolId')
  @Get(':schoolId/codes')
  listCodes(
    @Param('schoolId') schoolId: string,
    @Query() query: ListCodesQueryDto,
  ) {
    return this.codes.listSchoolCodes(schoolId, query.type);
  }

  @SchoolScope('schoolId')
  @Post(':schoolId/codes')
  createCode(
    @Req() req,
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateSchoolCodeDto,
  ) {
    return this.codes.createSchoolCode(schoolId, req.user.userId, dto);
  }

  @SchoolScope('schoolId')
  @Delete(':schoolId/codes/:codeId')
  revokeCode(
    @Param('schoolId') schoolId: string,
    @Param('codeId') codeId: string,
  ) {
    return this.codes.revokeSchoolCode(schoolId, codeId);
  }

  @SchoolScope('schoolId')
  @Delete(':schoolId/codes/:codeId/permanent')
  deleteCode(
    @Param('schoolId') schoolId: string,
    @Param('codeId') codeId: string,
  ) {
    return this.codes.deleteSchoolCode(schoolId, codeId);
  }

  // ------------------------------------------------------------ canteens
  @SchoolScope('schoolId')
  @Get(':schoolId/canteens')
  listCanteens(@Param('schoolId') schoolId: string) {
    return this.adminService.listCanteens(schoolId);
  }

  @SchoolScope('schoolId')
  @Post(':schoolId/canteens')
  @UseInterceptors(
    FileInterceptor('profile', {
      storage: null,
      fileFilter: imageFileFilter,
    }),
  )
  createCanteen(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateCanteenDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adminService.createCanteen(schoolId, dto, file);
  }

  @SchoolScope('schoolId')
  @Patch(':schoolId/canteens/:canteenId')
  @UseInterceptors(
    FileInterceptor('profile', {
      storage: null,
      fileFilter: imageFileFilter,
    }),
  )
  updateCanteen(
    @Param('schoolId') schoolId: string,
    @Param('canteenId') canteenId: string,
    @Body() dto: UpdateCanteenDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adminService.updateCanteen(schoolId, canteenId, dto, file);
  }

  @SchoolScope('schoolId')
  @Delete(':schoolId/canteens/:canteenId')
  deleteCanteen(
    @Param('schoolId') schoolId: string,
    @Param('canteenId') canteenId: string,
  ) {
    return this.adminService.deleteCanteen(schoolId, canteenId);
  }

  // ------------------------------------------------------------ restaurants
  @SchoolScope('schoolId')
  @Get(':schoolId/restaurants')
  listRestaurants(
    @Param('schoolId') schoolId: string,
    @Query() query: StatusQueryDto,
  ) {
    return this.adminService.listRestaurants(schoolId, query.status);
  }

  @SchoolScope('schoolId')
  @Get(':schoolId/restaurants/:restaurantId')
  getRestaurant(
    @Param('schoolId') schoolId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.adminService.getRestaurant(schoolId, restaurantId);
  }

  @SchoolScope('schoolId')
  @Patch(':schoolId/restaurants/:restaurantId/status')
  setRestaurantStatus(
    @Param('schoolId') schoolId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: RestaurantStatusDto,
  ) {
    return this.adminService.setRestaurantStatus(
      schoolId,
      restaurantId,
      dto.status,
    );
  }

  @SchoolScope('schoolId')
  @Patch(':schoolId/restaurants/:restaurantId/canteen')
  moveRestaurantCanteen(
    @Param('schoolId') schoolId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: MoveRestaurantCanteenDto,
  ) {
    return this.adminService.moveRestaurantCanteen(
      schoolId,
      restaurantId,
      dto.canteenId,
    );
  }

  // ------------------------------------------------------------ members
  @SchoolScope('schoolId')
  @Get(':schoolId/members')
  listMembers(
    @Param('schoolId') schoolId: string,
    @Query() query: MembershipQueryDto,
  ) {
    return this.adminService.listMembers(schoolId, query.status);
  }

  @SchoolScope('schoolId')
  @Patch(':schoolId/members/:memberId/approve')
  approveMember(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.adminService.approveMember(schoolId, memberId);
  }

  @SchoolScope('schoolId')
  @Patch(':schoolId/members/:memberId/reject')
  rejectMember(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.adminService.rejectMember(schoolId, memberId);
  }

  @SchoolScope('schoolId')
  @Delete(':schoolId/members/:memberId')
  removeMember(
    @Param('schoolId') schoolId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.adminService.removeMember(schoolId, memberId);
  }
}
