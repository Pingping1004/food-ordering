import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleRequestStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
  ){}

  async findAllRequest() {
    return await this.prisma.roleRequest.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findPendingRequest() {
    return await this.prisma.roleRequest.findMany({
      where: { status: RoleRequestStatus.pending },
    });
  }

  async findOneRequest(requestId: string) {
    return await this.prisma.roleRequest.findUnique({
      where: { requestId },
    });
  }

  async approveRoleRequest(requestId: string) {
    const request = await this.prisma.roleRequest.findUnique({
      where: { requestId },
      include: { user: true },
    });

    if (!request) throw new NotFoundException('Role request not found');
    if (request.status !== RoleRequestStatus.pending) throw new BadRequestException('This request has already been processed');

    return this.prisma.$transaction(async (tx) => {
      // Update user role
      const updatedUser = await tx.user.update({
        where: { userId: request.userId },
        data: { role: request.requestRole },
      });

      // Update role request status to be approved
      const updatedRoleRequestStatus = await tx.roleRequest.update({
        where: { requestId },
        data: { status: RoleRequestStatus.accepted },
      });

      return { user: updatedUser, request: updatedRoleRequestStatus }
    })
  }

  async rejectRoleRequest(requestId: string) {
    const request = await this.prisma.roleRequest.findUnique({
      where: { requestId },
    });

    if (!request || request.status !== RoleRequestStatus.pending) throw new BadRequestException('This request has already been processed');

    return this.prisma.roleRequest.update({
      where: { requestId },
      data: { status: RoleRequestStatus.rejected },
    });
  }

  async removeRequest(requestId: string) {
    const result = await this.prisma.roleRequest.delete({
      where: { requestId },
    });

    return result;
  }
}
