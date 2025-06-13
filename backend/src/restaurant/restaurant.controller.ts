import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { createRestaurantDto } from './dto/create-restaurant.dto';
import { updateRestaurantDto } from './dto/update-restaurant.dto';
import { Roles } from '../decorators/role.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { Public } from '../decorators/public.decorator';

@Controller('restaurant')
@UseGuards(RolesGuard)
@Roles(['cooker'])
export class RestaurantController {
    constructor(private readonly restaurantService: RestaurantService) {}

    @Post()
    async createRestaurant(@Body() createRestaurantDto: createRestaurantDto) {
        return this.restaurantService.createRestaurant(createRestaurantDto);
    }

    @Public()
    @Get()
    async findAllRestaurant() {
        return this.restaurantService.findAllRestaurant();
    }

    @Public()
    @Get(':restaurantId')
    async findRestaurant(@Param('restaurantId') restaurantId: string) {
        return this.restaurantService.findRestaurants(restaurantId);
    }

    @Public()
    @Patch(':restaurantId')
    async updateRestaurant(@Param('restaurantId') restaurantId: string, @Body() updateRestaurantDto: updateRestaurantDto) {
        return this.restaurantService.updateRestaurant(restaurantId, updateRestaurantDto);
    }

    @Delete(':restaurantId')
    async deleteRestaurant(@Param('restaurantId') restaurantId: string) {
        return this.restaurantService.removeRestaurant(restaurantId);
    }
}
