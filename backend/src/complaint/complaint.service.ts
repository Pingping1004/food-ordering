import { Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus, ComplaintTarget, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/complaint.dto';

const VIEW = {
  id: true,
  orderId: true,
  target: true,
  message: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  restaurantId: true,
  schoolId: true,
  order: {
    select: { totalAmount: true, restaurant: { select: { name: true } } },
  },
  school: { select: { name: true } },
} satisfies Prisma.ComplaintSelect;

@Injectable()
export class ComplaintService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, orderId: string, dto: CreateComplaintDto) {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      select: {
        userId: true,
        restaurantId: true,
        restaurant: { select: { canteen: { select: { schoolId: true } } } },
      },
    });
    if (!order || order.userId !== userId)
      throw new NotFoundException('ไม่พบออเดอร์ที่ค้นหา');

    await this.prisma.complaint.create({
      data: {
        orderId,
        userId,
        restaurantId: order.restaurantId,
        schoolId: order.restaurant.canteen.schoolId,
        target: dto.target,
        message: dto.message,
      },
    });
    return { ok: true };
  }

  list(
    where: { target: ComplaintTarget; schoolId?: string },
    status?: ComplaintStatus,
  ) {
    return this.prisma.complaint.findMany({
      where: { ...where, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: VIEW,
    });
  }

  async resolve(
    id: string,
    where: { target: ComplaintTarget; schoolId?: string },
  ) {
    const res = await this.prisma.complaint.updateMany({
      where: { id, ...where },
      data: { status: ComplaintStatus.RESOLVED, resolvedAt: new Date() },
    });
    if (res.count === 0) throw new NotFoundException('ไม่พบข้อร้องเรียน');
    return { ok: true };
  }
}
