import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto, CreateOrderMenusDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'prisma/prisma.service';
import * as fs from 'fs/promises';
import { createHash } from 'crypto';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) { }

  async validateExisting(params: {
    restaurantId: string;
    orderMenus: CreateOrderMenusDto[];
  }): Promise<void> {

    const { restaurantId, orderMenus } = params;

    // 1. Validate restaurant
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
    });

    if (!restaurant) throw new BadRequestException(`ไม่พบร้านอาหารที่ระบุ`);

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

  async hashingFile(file: Express.Multer.File):Promise<string> {
    const buffer = await fs.readFile(file.path);
    return createHash('sha256').update(buffer).digest('hex');
  }

  async validateDuplicateSlip(slipHash: string) {

    const existingSlip = await this.prisma.order.findUnique({
      where: { slipHash },
    });

    if (existingSlip) throw new BadRequestException('คุณได้อัปโหลดสลิปนี้ไปแล้ว');

    // Internet banking payment logic...
  }

  async createOrder(createOrderDto: CreateOrderDto, file: Express.Multer.File) {
    console.log('Incoming createOrderDto:', JSON.stringify(createOrderDto, null, 2));
    console.log('Incoming createOrderDto.orderMenus:', JSON.stringify(createOrderDto.orderMenus, null, 2));

    const deliverTime = new Date(createOrderDto.deliverAt);
    const orderSlipUrl = `uploads/order-slips/${file.filename}`

    // Step 1.1: Hashing and validating unique payment slip
    const slipHash = await this.hashingFile(file);
    await this.validateDuplicateSlip(slipHash);

    // Step 1: Validate deliver time
    if (isNaN(deliverTime.getTime())) throw new BadRequestException('รูปแบบของการตั้งเวลาจัดส่งไม่ถูกต้อง');

    const currentTime = new Date();
    if (deliverTime <= currentTime) throw new BadRequestException('ช่วงเวลาในการรับออเดอร์ได้ผ่านไปแล้ว โปรดตั้งเวลาในอนาคต');

    // Step 2: Validate orderMenus relate to restaurant and menu 
    // and map them to orderMenus

    const orderMenusArray = createOrderDto.orderMenus as unknown as CreateOrderMenusDto[];

    await this.validateExisting({
      restaurantId: createOrderDto.restaurantId,
      orderMenus: createOrderDto.orderMenus as unknown as CreateOrderMenusDto[],
    });

    const mappedOrderMenus = orderMenusArray.map(menu => ({
      quantity: menu.quantity,
      value: menu.value,
      price: menu.price,
      menuId: menu.menuId,
    }))

    // Step 3: Create order object
    const newOrder = {
      data: {
        name: createOrderDto.name,
        price: createOrderDto.price,
        status: createOrderDto.status,
        orderSlip: orderSlipUrl,
        restaurantId: createOrderDto.restaurantId,
        slipHash,
        deliverAt: new Date(createOrderDto.deliverAt),
        orderAt: new Date(createOrderDto.orderAt),
        orderMenus: {
          create: mappedOrderMenus,
        },
      },
      include: { orderMenus: true },
    };

    const result = await this.prisma.order.create(newOrder);

    // Step 4: Return newOrder object to controller
    return { result, message: 'Create order successfully', fileInfo: file };
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
        orderMenus: order.orderMenus.map((menu) => ({ menuId: menu.menuId, quantity: menu.quantity, value: menu.value, price: menu.price })),
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
