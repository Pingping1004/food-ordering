import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  uploadFile(file?: Express.Multer.File) {
    return { message: 'File uploaded successfully', filePath: file?.path }
  }
}


// async createRestaurant(createRestaurantDto: CreateRestaurantDto, file?: Express.Multer.File) {
//     try {
//       // 1. Determine the restaurant image URL
//       // If a file was uploaded, use its path. Otherwise, use the URL provided in the DTO (if any).
//       // Note: `file.filename` typically refers to the name Multer saved the file as.
//       const restaurantImgUrl = file ? `uploads/restaurants/${file.filename}` : createRestaurantDto.restaurantImg;

//       // 2. Hash the password for security
//       const hashedPassword = await bcrypt.hash(createRestaurantDto.password, 10);

//       // 3. Prepare the data for Prisma creation
//       const newRestaurantData = {
//         name: createRestaurantDto.name,
//         email: createRestaurantDto.email,
//         password: hashedPassword,
//         categories: createRestaurantDto.categories,
//         restaurantImg: restaurantImgUrl, // This will be the path or the DTO's original URL/null
//         openTime: createRestaurantDto.openTime,
//         closeTime: createRestaurantDto.closeTime,
//         adminName: createRestaurantDto.adminName,
//         adminSurname: createRestaurantDto.adminSurname,
//         adminTel: createRestaurantDto.adminTel,
//         adminEmail: createRestaurantDto.adminEmail,
//       };

//       console.log('Service: Data prepared for new restaurant creation.');
//       console.log('Service: Restaurant image URL to be saved:', newRestaurantData.restaurantImg);

//       // 4. Create the restaurant in the database
//       const result = await this.prisma.restaurant.create({
//         data: newRestaurantData,
//       });

//       console.log('Service: Restaurant created successfully in DB.');
//       return result; // Return the created restaurant object

//     } catch (error) {
//       // Log the full error details for debugging purposes
//       console.error('Service: Failed to create restaurant:', error);

//       // Re-throw the error as a NestJS HttpException for consistent API responses
//       // You might want to throw more specific exceptions based on error type
//       // For example:
//       // if (error.code === 'P2002') { // Prisma unique constraint violation
//       //   throw new ConflictException('Restaurant with this email or name already exists.');
//       // }
//       throw new Error(`Failed to create restaurant: ${error.message}`); // Generic error
//     }
//   }