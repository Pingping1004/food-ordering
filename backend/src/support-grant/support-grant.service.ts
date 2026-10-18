import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, SUPPORT_GRANT_TTL_MINUTES } from '../access';

@Injectable()
export class SupportGrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(req: any, schoolId: string, reason: string) {
    const school = await this.prisma.school.findUnique({
      where: { schoolId },
      select: { schoolId: true },
    });
    if (!school) throw new NotFoundException('ไม่พบข้อมูล');

    const grant = await this.prisma.supportGrant.create({
      data: {
        adminId: req.user.userId,
        schoolId,
        reason,
        expiresAt: new Date(Date.now() + SUPPORT_GRANT_TTL_MINUTES * 60_000),
      },
    });
    await this.audit.record({
      req,
      actorRole: 'SYSADMIN',
      schoolId,
      action: 'SUPPORT_GRANT_CREATE',
      entityType: 'SUPPORT_GRANT',
      entityId: grant.id,
      reason,
      supportGrantId: grant.id,
      meta: { expiresAt: grant.expiresAt },
    });
    return grant;
  }

  /** Ends the caller's own grant for that school. */
  async end(req: any, schoolId: string, id: string) {
    const grant = await this.prisma.supportGrant.findFirst({
      where: { id, schoolId, adminId: req.user.userId },
      select: { id: true, revokedAt: true },
    });
    if (!grant) throw new NotFoundException('ไม่พบข้อมูล');

    const revokedAt = grant.revokedAt ?? new Date();
    if (!grant.revokedAt)
      await this.prisma.supportGrant.update({
        where: { id },
        data: { revokedAt },
      });
    await this.audit.record({
      req,
      actorRole: 'SYSADMIN',
      schoolId,
      action: 'SUPPORT_GRANT_END',
      entityType: 'SUPPORT_GRANT',
      entityId: id,
      supportGrantId: id,
    });
    return { id, revokedAt };
  }

  async listActive(adminId: string) {
    const rows = await this.prisma.supportGrant.findMany({
      where: { adminId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { name: true } } },
    });
    return rows.map((g) => ({
      id: g.id,
      schoolId: g.schoolId,
      schoolName: g.school.name,
      reason: g.reason,
      expiresAt: g.expiresAt,
      createdAt: g.createdAt,
    }));
  }
}
