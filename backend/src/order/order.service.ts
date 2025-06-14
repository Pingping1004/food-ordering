import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) { }

  async validateExisting(params: {
    restaurantId: string;
    orderMenus: { menuId: string }[];
  }): Promise<void> {

    const { restaurantId, orderMenus } = params;

    // 1. Validate restaurant
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
    });

    if (!restaurant) throw new Error(`ไม่พบร้านอาหารที่ระบุ`);

    // 2. Validate all menuIds are valid under single restaurant
    await Promise.all(
      orderMenus.map(async (menu) => {
        const existingMenu = await this.prisma.menu.findFirst({
          where: {
            restaurantId,
            menuId: menu.menuId,
          },
        });

        if (!existingMenu) throw new Error(`ไม่พบเมนูรหัส ${menu.menuId} จากร้านที่เลือก`);
      })
    )
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    const deliverTime = new Date(createOrderDto.deliverAt);

    // Step 1: Validate deliver time
    if (isNaN(deliverTime.getTime())) {
      throw new Error('รูปแบบของการตั้งเวลาจัดส่งไม่ถูกต้อง');
    }

    const currentTime = new Date();
    if (deliverTime <= currentTime) {
      throw new Error('สามารถรับออเดอร์ได้หลังจากเวลาที่สั่งออเดอร์เท่านั้น');
    }

    // Step 2: Validate orderMenus relate to restaurant and menu 
    // and map them to orderMenus

    await this.validateExisting({
      restaurantId: createOrderDto.restaurantId,
      orderMenus: createOrderDto.orderMenus,
    });

    // Step 3: Create order object
    const newOrder = await this.prisma.order.create({
      data: {
        name: createOrderDto.name,
        price: createOrderDto.price,
        status: createOrderDto.status,
        restaurantId: createOrderDto.restaurantId,
        deliverAt: new Date(createOrderDto.deliverAt),
        orderAt: new Date(),
        isPaid: createOrderDto.isPaid,
        orderMenus: {
          create: createOrderDto.orderMenus.map(menu => ({
            units: menu.units,
            value: menu.value,
            menuId: menu.menuId,
          })),
        },
      },
      include: { orderMenus: true },
    });


    // Step 4: Return newOrder object to controller
    return newOrder;
  }


  async findAllOrders() {
    return this.prisma.order.findMany();
  }

  async findOneOrder(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { orderId },
        include: { orderMenus: true },
      });

      if (!order) throw new Error('ไม่พบออเดอร์ที่ค้นหา');

      await this.validateExisting({
        restaurantId: order.restaurantId,
        orderMenus: order.orderMenus.map((menu) => ({ menuId: menu.menuId })),
      });

      return order;
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma "Record not found"
        throw new NotFoundException(
          `ไม่พบออเดอร์ที่มีID: ${orderId}`,
        );
      }

      throw error;
    }
  }

  async updateOrder(orderId: string, updateOrderDto: UpdateOrderDto) {
    // Find order with validate restaurant and menu logic
    await this.findOneOrder(orderId);

    if (!updateOrderDto.restaurantId) throw new Error('restaurantId is required');

    return this.prisma.order.update({
      where: { orderId },
      data: {
        status: updateOrderDto.status,
        deliverAt: updateOrderDto.deliverAt,
        isPaid: updateOrderDto.isPaid,
        isDelay: updateOrderDto.isDelay,
      },
    });
  }

  async removeOrder(orderId: string) {
    this.findOneOrder(orderId);

    return this.prisma.order.delete({
      where: { orderId },
    });
  }
}
