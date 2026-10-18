import {
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Patch,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  Req,
  Logger,
  InternalServerErrorException,
  UploadedFiles,
  BadRequestException,
  HttpException,
  Query,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { imageFileFilter, imageUploadLimits } from '../utils/file-upload.utils';

import { RestaurantService } from './restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { MembershipStatus, RestaurantRole } from '@prisma/client';
import { AccessService, RestaurantScope } from '../access';
import { InviteCodeService } from '../invite/invite-code.service';
import { CreateStaffCodeDto } from '../invite/dto/invite.dto';
import { MembershipQueryDto } from '../school/dto/school.dto';

const OWNER_ONLY = { param: 'restaurantId', roles: [RestaurantRole.OWNER] };
/** Day-to-day switches (close the shop, auto-accept) are open to cooks as well. */
const OWNER_OR_STAFF = {
  param: 'restaurantId',
  roles: [RestaurantRole.OWNER, RestaurantRole.STAFF],
};
const OWNER_OR_ADMIN = {
  param: 'restaurantId',
  roles: [RestaurantRole.OWNER, RestaurantRole.ADMIN],
};

/** Bank / payout fields that only the shop itself (and the platform) should see. contactTel stays: students call the shop. */
const PAYOUT_FIELDS = ['accountNumber', 'accountName', 'paymentQr', 'bankType', 'contactEmail'] as const;
const withoutPayoutDetails = <T extends object>(r: T): Omit<T, (typeof PAYOUT_FIELDS)[number]> => {
  const copy = { ...r } as Record<string, unknown>;
  for (const k of PAYOUT_FIELDS) delete copy[k];
  return copy as Omit<T, (typeof PAYOUT_FIELDS)[number]>;
};

@Controller('restaurant')
export class RestaurantController {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly access: AccessService,
    private readonly inviteCodes: InviteCodeService,
  ) {}

  private readonly logger = new Logger('RestaurantController');

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'restaurantImg', maxCount: 1 },
        { name: 'paymentQr', maxCount: 1 },
      ],
      { limits: imageUploadLimits(2), fileFilter: imageFileFilter },
    ),
  )
  async createRestaurant(
    @Req() req: any,
    @Body() createRestaurantDto: CreateRestaurantDto,
    @UploadedFiles()
    files?: {
      paymentQr?: Express.Multer.File[];
      restaurantImg?: Express.Multer.File[];
    },
  ) {
    const paymentQr = files?.paymentQr?.[0];

    if (!paymentQr) throw new BadRequestException('กรุณาอัพโหลด QR');

    const userId = req.user.userId;
    return this.restaurantService.createRestaurant(
      createRestaurantDto,
      userId,
      paymentQr,
      files.restaurantImg?.[0],
    );
  }

  /** Open restaurants of the caller's own school only. */
  @Get()
  async findAllRestaurant(@Req() req: any, @Query('limit') limit?: string) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 6, 1), 50);
    const { schoolId } = await this.access.getContext(req.user, req);
    const open = await this.restaurantService.getOpenRestaurants(schoolId, parsedLimit);
    // Students browse this list: it must not carry any shop's payout details.
    return open.map(withoutPayoutDetails);
  }

  @Get(':restaurantId')
  async findRestaurant(
    @Req() req: any,
    @Param('restaurantId') restaurantId: string,
  ) {
    await this.access.assertRestaurantVisible(req.user, restaurantId, req);
    const restaurant = await this.restaurantService.findRestaurant(restaurantId);

    // Payout account details are owner-only; everyone else (cooks, students) gets the number masked.
    const ctx = await this.access.getContext(req.user, req);
    const seesPayout =
      ctx.isSystemAdmin ||
      ctx.restaurantRoles.get(restaurantId) === RestaurantRole.OWNER;
    if (seesPayout) return restaurant;
    // Shop staff keep the masked view they always had; everyone else (students, other schools' admins) gets no
    // payout details at all. The PromptPay QR encodes the full account id, so masking the digits alone is not enough.
    const isMember = ctx.restaurantRoles.has(restaurantId);
    if (isMember) {
      const digits = restaurant.accountNumber ?? '';
      return {
        ...restaurant,
        accountNumber: digits ? `····${digits.slice(-4)}` : '',
      };
    }
    return withoutPayoutDetails(restaurant);
  }

  @Get(':restaurantId/hours')
  async getRestaurantHours(
    @Req() req: any,
    @Param('restaurantId') restaurantId: string,
  ) {
    await this.access.assertRestaurantVisible(req.user, restaurantId, req);
    return this.restaurantService.getRestaurantHours(restaurantId);
  }

  @Get(':restaurantId/hours-window')
  async getHoursWindow(
    @Req() req: any,
    @Param('restaurantId') restaurantId: string,
  ) {
    await this.access.assertRestaurantVisible(req.user, restaurantId, req);
    return this.restaurantService.getHoursWindow(restaurantId);
  }

  @RestaurantScope(OWNER_OR_ADMIN)
  @Put(':restaurantId/hours')
  async saveRestaurantHours(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: { hours: any[] },
  ) {
    return this.restaurantService.saveRestaurantHours(
      restaurantId,
      dto?.hours ?? [],
    );
  }

  @RestaurantScope(OWNER_ONLY)
  @Get(':restaurantId/staff-codes')
  async listStaffCodes(@Param('restaurantId') restaurantId: string) {
    return this.inviteCodes.listStaffCodes(restaurantId);
  }

  @RestaurantScope(OWNER_ONLY)
  @Post(':restaurantId/staff-codes')
  async createStaffCode(
    @Req() req: any,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateStaffCodeDto,
  ) {
    return this.inviteCodes.createStaffCode(restaurantId, req.user.userId, dto);
  }

  @RestaurantScope(OWNER_ONLY)
  @Delete(':restaurantId/staff-codes/:codeId')
  async revokeStaffCode(
    @Param('restaurantId') restaurantId: string,
    @Param('codeId') codeId: string,
  ) {
    return this.inviteCodes.revokeStaffCode(restaurantId, codeId);
  }

  @RestaurantScope(OWNER_ONLY)
  @Delete(':restaurantId/staff-codes/:codeId/permanent')
  async deleteStaffCode(
    @Param('restaurantId') restaurantId: string,
    @Param('codeId') codeId: string,
  ) {
    return this.inviteCodes.deleteStaffCode(restaurantId, codeId);
  }

  @RestaurantScope(OWNER_ONLY)
  @Get(':restaurantId/members')
  async listMembers(
    @Param('restaurantId') restaurantId: string,
    @Query() query: MembershipQueryDto,
  ) {
    return this.restaurantService.listMembers(restaurantId, query.status);
  }

  @RestaurantScope(OWNER_ONLY)
  @Patch(':restaurantId/members/:memberId/approve')
  async approveMember(
    @Param('restaurantId') restaurantId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.restaurantService.decideMember(
      restaurantId,
      memberId,
      'approve',
    );
  }

  @RestaurantScope(OWNER_ONLY)
  @Patch(':restaurantId/members/:memberId/reject')
  async rejectMember(
    @Param('restaurantId') restaurantId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.restaurantService.decideMember(
      restaurantId,
      memberId,
      'reject',
    );
  }

  @RestaurantScope(OWNER_ONLY)
  @Delete(':restaurantId/members/:memberId')
  async removeMember(
    @Param('restaurantId') restaurantId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.restaurantService.removeMember(restaurantId, memberId);
  }

  @RestaurantScope(OWNER_ONLY)
  @Patch(':restaurantId')
  @UseInterceptors(
    FileInterceptor('restaurantImg', {
      limits: imageUploadLimits(1),
      storage: null,
      fileFilter: imageFileFilter,
    }),
  )
  async updateRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      const dataToUpdate: UpdateRestaurantDto = { ...updateRestaurantDto };

      return await this.restaurantService.updateRestaurant(
        restaurantId,
        dataToUpdate,
        file,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update restaurant ${restaurantId} in controller: `,
        error,
      );
      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException('อัพเดทร้านอาหรรล้มเหลว');
    }
  }

  @RestaurantScope(OWNER_OR_STAFF)
  @Patch('temporarily-close/:restaurantId')
  async updateIsTemporarilyClose(
    @Param('restaurantId') restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
  ) {
    const updateData = await this.restaurantService.updateIsTemporailyClose(
      restaurantId,
      updateRestaurantDto,
    );
    return updateData;
  }

  @RestaurantScope(OWNER_OR_STAFF)
  @Patch('auto-accepted/:restaurantId')
  async updateIsAutoAcceptedOrder(
    @Param('restaurantId') restaurantId: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
  ) {
    const updateData = await this.restaurantService.updateIsAutoAcceptedOrder(
      restaurantId,
      updateRestaurantDto,
    );
    return updateData;
  }

  @RestaurantScope(OWNER_ONLY)
  @Delete(':restaurantId')
  async deleteRestaurant(@Param('restaurantId') restaurantId: string) {
    return await this.restaurantService.removeRestaurant(restaurantId);
  }
}
