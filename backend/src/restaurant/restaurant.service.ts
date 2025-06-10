import { Injectable } from '@nestjs/common';
import { createRestaurantDto } from './dto/create-restaurant.dto';
import { PrismaService } from 'prisma/prisma.service';
import { updateRestaurantDto } from './dto/update-restaurant.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RestaurantService {
    constructor(private prisma: PrismaService) {}

    async createRestaurant(createRestaurantDto: createRestaurantDto) {
        const hashedPassword = await bcrypt.hash(createRestaurantDto.password, 10);
        return this.prisma.restaurant.create({
            data: {
                name: createRestaurantDto.name,
                email: createRestaurantDto.email,
                password: hashedPassword,
                categories: createRestaurantDto.categories,
                openTime: createRestaurantDto.openTime,
                closeTime: createRestaurantDto.closeTime,
                adminName: createRestaurantDto.adminName,
                adminSurname: createRestaurantDto.adminSurname,
                adminTel: createRestaurantDto.adminTel,
                adminEmail: createRestaurantDto.adminEmail,
            }
        });
    }

    async findAllRestaurant() {
        return this.prisma.restaurant.findMany();
    }

    async findRestaurant(restaurantId: string) {
        return this.prisma.restaurant.findUnique({
            where: { restaurantId },
        });
    }

    async findRestaurantByname(name: string) {
        return this.prisma.restaurant.findUnique({
            where: { name: name },
        });
    }

    async updateRestaurant(restaurantId: string, updateRestaurantDto: updateRestaurantDto) {
        return this.prisma.restaurant.update({
            where: { restaurantId },
            data: updateRestaurantDto,
        });
    }

    async removeRestaurant(restaurantId: string) {
        return this.prisma.restaurant.delete({
            where: { restaurantId },
        });
    }
}
