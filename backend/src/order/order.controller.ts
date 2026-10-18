import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Logger,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { isDebugAlwaysOpen } from '../utils/debug';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RestaurantRole, Status, OrderStatus } from '@prisma/client';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  AccessService,
  RestaurantScope,
  schoolSuspendedException,
} from '../access';

/** Kitchen endpoints: any approved member of the order's restaurant (owner, admin or cooker). */
const KITCHEN_BY_RESTAURANT = {
  param: 'restaurantId',
  roles: [RestaurantRole.OWNER, RestaurantRole.ADMIN, RestaurantRole.STAFF],
};
const KITCHEN_BY_ORDER = {
  param: 'orderId',
  roles: KITCHEN_BY_RESTAURANT.roles,
};

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,128}$/;
/** Optional `Idempotency-Key` header; a malformed one is rejected instead of silently ignored. */
export function parseIdempotencyKey(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !IDEMPOTENCY_KEY.test(raw))
    throw new BadRequestException('Idempotency-Key ไม่ถูกต้อง');
  return raw;
}

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly access: AccessService,
  ) {}

  private readonly logger = new Logger('OrderController');

  /** Login required; the shop must be in the caller's school. The order is bound to the caller. */
  @Post('create')
  async createOrder(@Body() createOrderDto: CreateOrderDto, @Req() req: any) {
    const idempotencyKey = parseIdempotencyKey(req.headers['idempotency-key']);
    const { status, schoolStatus } = await this.access.assertRestaurantVisible(
      req.user,
      createOrderDto.restaurantId,
      req,
    );
    if (!isDebugAlwaysOpen()) {
      if (schoolStatus === Status.SUSPENDED) throw schoolSuspendedException();
      if (status !== Status.ACTIVE)
        throw new BadRequestException('ร้านนี้ปิดให้บริการชั่วคราว');
    }

    try {
      return await this.orderService.createOrder(
        createOrderDto,
        req.user.userId,
        idempotencyKey,
      );
    } catch (error) {
      this.logger.error(
        'Error in createOrder controller function: ',
        error.message,
        error.stack,
      );
      throw error;
    }
  }

  @RestaurantScope(KITCHEN_BY_RESTAURANT)
  @Get('today/:restaurantId')
  async findRestaurantTodayOrders(@Param('restaurantId') restaurantId: string) {
    return this.orderService.findRestaurantTodayOrders(restaurantId);
  }

  @RestaurantScope(KITCHEN_BY_RESTAURANT)
  @Get('history/:restaurantId')
  async findRestaurantOrderHistory(
    @Param('restaurantId') restaurantId: string,
    @Query('range') range?: string,
  ) {
    const allowed = ['today', 'week', 'month', '3months', 'year', 'all'] as const;
    if (!allowed.includes(range as (typeof allowed)[number]))
      throw new BadRequestException('ช่วงเวลาไม่ถูกต้อง');
    return this.orderService.findRestaurantOrdersInRange(
      restaurantId,
      range as (typeof allowed)[number],
    );
  }

  @RestaurantScope(KITCHEN_BY_RESTAURANT)
  @Get('trend/:restaurantId')
  async findSalesTrend(
    @Param('restaurantId') restaurantId: string,
    @Query('range') range?: string,
  ) {
    const allowed = ['today', 'week', 'month', '3months', 'year'] as const;
    if (!allowed.includes(range as (typeof allowed)[number]))
      throw new BadRequestException('ช่วงเวลาไม่ถูกต้อง');
    return this.orderService.findSalesTrend(
      restaurantId,
      range as (typeof allowed)[number],
    );
  }

  @Get('active-count/:restaurantId')
  async countActiveKitchenOrders(
    @Req() req: any,
    @Param('restaurantId') restaurantId: string,
  ) {
    await this.access.assertRestaurantVisible(req.user, restaurantId, req);
    const count =
      await this.orderService.countActiveKitchenOrders(restaurantId);
    return { activeOrderCount: count };
  }

  /** The caller's own orders, newest first. Declared before `:orderId` so "mine" isn't treated as an id. */
  @Get('mine')
  async listMyOrders(@Req() req: any) {
    return this.orderService.listOrdersForUser(req.user.userId);
  }

  @Get(':orderId')
  async findOneOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return this.orderService.findOneOrderForUser(orderId, req.user.userId);
  }

  @RestaurantScope(KITCHEN_BY_RESTAURANT)
  @Get('new/:restaurantId')
  async getNewOrders(
    @Param('restaurantId') restaurantId: string,
    @Query('after') after?: Date,
  ) {
    const timestamp = after ? new Date(after) : undefined;
    return this.orderService.getOrdersAfterTimeStamp(restaurantId, timestamp);
  }

  @RestaurantScope(KITCHEN_BY_ORDER)
  @Patch('delay/:orderId')
  async updateDelay(
    @Param('orderId') orderId: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    if (!updateOrderDto.isDelay)
      throw new NotFoundException('ไม่พบสถานะออเดอร์ที่ต้องการแก้ไข');

    return this.orderService.updateDelay(orderId, updateOrderDto.isDelay);
  }

  @Patch('cancel/:orderId')
  async cancelOrder(@Req() req: any, @Param('orderId') orderId: string) {
    if (!orderId) throw new NotFoundException('ไม่พบออเดอร์ไอดี');
    await this.orderService.assertOrderOwner(orderId, req.user.userId);

    return this.orderService.cancelOrder(orderId);
  }

  @Patch('expire/:orderId')
  async expireOrder(@Req() req: any, @Param('orderId') orderId: string) {
    if (!orderId) throw new NotFoundException('ไม่พบออเดอร์ไอดี');
    await this.orderService.assertOrderOwner(orderId, req.user.userId);

    return this.orderService.expireOrder(orderId);
  }

  @RestaurantScope(KITCHEN_BY_ORDER)
  @Patch('reject/:orderId')
  async rejectOrder(@Param('orderId') orderId: string) {
    return this.orderService.updateOrderStatus(orderId, OrderStatus.rejected);
  }

  @RestaurantScope(KITCHEN_BY_ORDER)
  @Patch('accept/:orderId')
  async acceptOrder(@Param('orderId') orderId: string) {
    return this.orderService.acceptOrder(orderId);
  }

  @RestaurantScope(KITCHEN_BY_ORDER)
  @Patch('ready/:orderId')
  async readyOrder(@Param('orderId') orderId: string) {
    return this.orderService.updateOrderStatus(orderId, OrderStatus.ready);
  }

  @RestaurantScope(KITCHEN_BY_ORDER)
  @Patch('done/:orderId')
  @Patch('complete/:orderId')
  async doneOrder(@Param('orderId') orderId: string) {
    return this.orderService.updateOrderStatus(orderId, OrderStatus.done);
  }

  @RestaurantScope(KITCHEN_BY_ORDER)
  @Delete(':orderId')
  async removeOrder(@Param('orderId') orderId: string) {
    return this.orderService.removeOrder(orderId);
  }
}
