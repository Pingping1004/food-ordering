import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { createRestaurantDto } from './dto/create-restaurant.dto';
import { updateRestaurantDto } from './dto/update-restaurant.dto';

@Controller('restaurant')
export class RestaurantController {
    constructor(private readonly restaurantService: RestaurantService) {}

    @Post()
    async createRestaurant(@Body() createRestaurantDto: createRestaurantDto) {
        return this.restaurantService.createRestaurant(createRestaurantDto);
    }

    @Get()
    async findAllRestaurant() {
        return this.restaurantService.findAllRestaurant();
    }

    @Get(':restaurantId')
    async findRestaurant(@Param('restaurantId') restaurantId: string) {
        return this.restaurantService.findRestaurant(restaurantId);
    }

    @Patch(':restaurantId')
    async updateRestaurant(@Param('restaurantId') restaurantId: string, @Body() updateRestaurantDto: updateRestaurantDto) {
        return this.restaurantService.updateRestaurant(restaurantId, updateRestaurantDto);
    }

    @Delete(':restaurantId')
    async deleteRestaurant(@Param('restaurantId') restaurantId: string) {
        return this.restaurantService.removeRestaurant(restaurantId);
    }
}
