import { ConflictException } from '@nestjs/common';
import * as codeUtil from '../utils/invite-code';
import { generateGloballyUniqueCode } from './unique-code';

describe('generateGloballyUniqueCode', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retries while the code exists in School.inviteCode OR InviteCode.code', async () => {
    jest
      .spyOn(codeUtil, 'generateInviteCode')
      .mockReturnValueOnce('AAAAAAAA') // taken by a school
      .mockReturnValueOnce('BBBBBBBB') // taken by a typed code
      .mockReturnValueOnce('CCCCCCCC');
    const prisma = {
      school: {
        findUnique: jest.fn(async ({ where }) =>
          where.inviteCode === 'AAAAAAAA' ? { schoolId: 's' } : null,
        ),
      },
      inviteCode: {
        findUnique: jest.fn(async ({ where }) =>
          where.code === 'BBBBBBBB' ? { id: 'c' } : null,
        ),
      },
    };
    await expect(generateGloballyUniqueCode(prisma)).resolves.toBe('CCCCCCCC');
    expect(prisma.school.findUnique).toHaveBeenCalledTimes(3);
    expect(prisma.inviteCode.findUnique).toHaveBeenCalledTimes(3);
  });

  it('gives up with a 409 after too many collisions', async () => {
    const prisma = {
      school: { findUnique: jest.fn().mockResolvedValue({ schoolId: 's' }) },
      inviteCode: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    await expect(generateGloballyUniqueCode(prisma, 3)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.school.findUnique).toHaveBeenCalledTimes(3);
  });
});
