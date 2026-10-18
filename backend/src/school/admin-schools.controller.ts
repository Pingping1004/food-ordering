import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { InviteCodeType } from '@prisma/client';
import {
  AccessService,
  AuditService,
  SystemAdmin,
  SysadminWrite,
} from '../access';
import { InviteCodeService } from '../invite/invite-code.service';
import {
  CreateSchoolCodeDto,
  ListCodesQueryDto,
} from '../invite/dto/invite.dto';
import { SchoolService } from './school.service';
import {
  CreateSchoolDto,
  ListSchoolsQueryDto,
  SchoolStatusDto,
} from './dto/school.dto';

/** System admin (role ADMIN + aal2) only. */
@SystemAdmin()
@Controller('admin/schools')
export class AdminSchoolsController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly codes: InviteCodeService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** Only SCHOOL_ADMIN codes are a platform operation; other code types are school-admin writes. */
  private async requireGrantForSchoolWrite(req: any, schoolId: string) {
    req.sysadminWrite = false;
    await this.access.enforceSysadminPolicy(req.user, schoolId, req);
  }

  @Get()
  list(@Query() query: ListSchoolsQueryDto) {
    return this.schoolService.listSchools(query.status);
  }

  @SysadminWrite()
  @Post()
  async create(@Req() req, @Body() dto: CreateSchoolDto) {
    const result = await this.schoolService.createSchool(req.user.userId, dto);
    await this.audit.record({
      req,
      actorRole: 'SYSADMIN',
      schoolId: result.school.schoolId,
      action: 'SCHOOL_CREATE',
      entityType: 'SCHOOL',
      entityId: result.school.schoolId,
      meta: { name: result.school.name },
    });
    return result;
  }

  @SysadminWrite()
  @Patch(':schoolId/status')
  async setStatus(
    @Req() req,
    @Param('schoolId') schoolId: string,
    @Body() dto: SchoolStatusDto,
  ) {
    const result = await this.schoolService.setSchoolStatus(
      schoolId,
      dto.status,
    );
    await this.audit.record({
      req,
      actorRole: 'SYSADMIN',
      schoolId,
      action: 'SCHOOL_STATUS_CHANGE',
      entityType: 'SCHOOL',
      entityId: schoolId,
      reason: dto.reason,
      meta: { from: result.previous, to: result.status },
    });
    return { schoolId, status: result.status, reason: dto.reason };
  }

  @Get(':schoolId')
  get(@Param('schoolId') schoolId: string) {
    return this.schoolService.getSchoolAsAdmin(schoolId);
  }

  @Post(':schoolId/invite-code/rotate')
  rotate(@Param('schoolId') schoolId: string) {
    return this.schoolService.rotateInviteCode(schoolId);
  }

  @SysadminWrite()
  @Get(':schoolId/codes')
  listCodes(
    @Param('schoolId') schoolId: string,
    @Query() query: ListCodesQueryDto,
  ) {
    return this.codes.listSchoolCodes(schoolId, query.type);
  }

  @SysadminWrite()
  @Post(':schoolId/codes')
  async createCode(
    @Req() req,
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateSchoolCodeDto,
  ) {
    const isAdminCode = dto.type === InviteCodeType.SCHOOL_ADMIN;
    if (!isAdminCode) await this.requireGrantForSchoolWrite(req, schoolId);
    const created = await this.codes.createSchoolCode(
      schoolId,
      req.user.userId,
      dto,
    );
    if (isAdminCode)
      await this.audit.record({
        req,
        actorRole: 'SYSADMIN',
        schoolId,
        action: 'SCHOOL_ADMIN_CODE_CREATE',
        entityType: 'INVITE_CODE',
        entityId: (created as any)?.id ?? null,
        meta: {
          maxUses: dto.maxUses ?? null,
          expiresInDays: dto.expiresInDays ?? null,
        },
      });
    return created;
  }

  @SysadminWrite()
  @Delete(':schoolId/codes/:codeId')
  async revokeCode(
    @Req() req,
    @Param('schoolId') schoolId: string,
    @Param('codeId') codeId: string,
  ) {
    const type = await this.codes.getSchoolCodeType(schoolId, codeId);
    const isAdminCode = type === InviteCodeType.SCHOOL_ADMIN;
    if (!isAdminCode) await this.requireGrantForSchoolWrite(req, schoolId);
    const result = await this.codes.revokeSchoolCode(schoolId, codeId);
    if (isAdminCode)
      await this.audit.record({
        req,
        actorRole: 'SYSADMIN',
        schoolId,
        action: 'SCHOOL_ADMIN_CODE_REVOKE',
        entityType: 'INVITE_CODE',
        entityId: codeId,
      });
    return result;
  }

  @SysadminWrite()
  @Delete(':schoolId/codes/:codeId/permanent')
  async deleteCode(
    @Req() req,
    @Param('schoolId') schoolId: string,
    @Param('codeId') codeId: string,
  ) {
    const type = await this.codes.getSchoolCodeType(schoolId, codeId);
    const isAdminCode = type === InviteCodeType.SCHOOL_ADMIN;
    if (!isAdminCode) await this.requireGrantForSchoolWrite(req, schoolId);
    const result = await this.codes.deleteSchoolCode(schoolId, codeId);
    if (isAdminCode)
      await this.audit.record({
        req,
        actorRole: 'SYSADMIN',
        schoolId,
        action: 'SCHOOL_ADMIN_CODE_DELETE',
        entityType: 'INVITE_CODE',
        entityId: codeId,
      });
    return result;
  }
}
