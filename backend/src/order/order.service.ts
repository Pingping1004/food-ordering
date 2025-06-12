import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    const deliverTime = new Date(createOrderDto.deliverAt);

    if (isNaN(deliverTime.getTime())) throw new Error('รูปแบบของการตั้้งเวลาจัดส่งไม่ถูกต้อง');

    const currentTime = new Date();
    if (deliverTime <= currentTime) throw new Error('สามารถรับออเดอร์ได้หลังจากเวลาที่สั่งออเดอร์เท่านั้น');

    const orderData = {
      name: createOrderDto.name,
      price: createOrderDto.price,
      status: createOrderDto.status,
      restaurantName: createOrderDto.restaurantName,
      orderAt: createOrderDto.orderAt,
      deliverAt: deliverTime,
      details: createOrderDto.details,
      isPaid: createOrderDto.isPaid,
      orderMenus: {
        create: createOrderDto.orderMenus.map(menu => ({
          units: menu.units,
          value: menu.value,
        })),
      },
    };

    const includeOptions = {
      orderMenus: true,
    }

    const newOrder = {
      data: orderData,
      include: includeOptions,
    }

    return this.prisma.order.create(newOrder);
  }

  findAll() {
    return `This action returns all order`;
  }

  findOne(id: number) {
    return `This action returns a #${id} order`;
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
