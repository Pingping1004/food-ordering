import { ForbiddenException } from '@nestjs/common';
import { InviteCodeType } from '@prisma/client';

export const OWNER_GRANT_REQUIRED_MESSAGE =
  'ต้องใช้รหัสเชิญเจ้าของร้านก่อนลงทะเบียนร้านค้า';

const grantWhere = (userId: string, schoolId: string) => ({
  userId,
  consumedAt: null,
  code: { type: InviteCodeType.SHOP_OWNER, schoolId },
});

/** Cheap pre-check (before uploads): does the user hold an unconsumed SHOP_OWNER grant for this school? */
export async function assertHasOwnerGrant(
  prisma: any,
  userId: string,
  schoolId: string,
): Promise<void> {
  const grant = await prisma.inviteRedemption.findFirst({
    where: grantWhere(userId, schoolId),
    select: { id: true },
  });
  if (!grant) throw new ForbiddenException(OWNER_GRANT_REQUIRED_MESSAGE);
}

/** Atomically consume one grant (call inside the transaction that creates the shop). 403 when none is left. */
export async function consumeOwnerGrant(
  tx: any,
  userId: string,
  schoolId: string,
): Promise<void> {
  const grant = await tx.inviteRedemption.findFirst({
    where: grantWhere(userId, schoolId),
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!grant) throw new ForbiddenException(OWNER_GRANT_REQUIRED_MESSAGE);
  const { count } = await tx.inviteRedemption.updateMany({
    where: { id: grant.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count === 0) throw new ForbiddenException(OWNER_GRANT_REQUIRED_MESSAGE);
}
