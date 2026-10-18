import { ConflictException } from '@nestjs/common';
import { generateInviteCode } from '../utils/invite-code';

interface CodeLookup {
  school: { findUnique: (args: any) => Promise<unknown> };
  inviteCode: { findUnique: (args: any) => Promise<unknown> };
}

/**
 * Code strings are unique across School.inviteCode AND InviteCode.code, otherwise one string could mean two things.
 * Generates a code, retrying while either table already holds it.
 */
export async function generateGloballyUniqueCode(
  prisma: CodeLookup,
  attempts = 10,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generateInviteCode();
    const [school, other] = await Promise.all([
      prisma.school.findUnique({
        where: { inviteCode: code },
        select: { schoolId: true },
      }),
      prisma.inviteCode.findUnique({ where: { code }, select: { id: true } }),
    ]);
    if (!school && !other) return code;
  }
  throw new ConflictException('ไม่สามารถสร้างรหัสเชิญได้ กรุณาลองใหม่');
}
