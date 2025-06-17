import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';

async function bootstrap() {
  console.log('----- NESTJS MAIN.TS LOADED - VERSION 3.14 -----');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));
  console.log('Static uploads path:', join(__dirname, '..', 'uploads'));


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validateCustomDecorators: true,

      exceptionFactory: (errors) => {
        console.log('----- Raw errors received by exceptionFactory -----');
        console.dir(errors, { depth: null, colors: true });
        // This helper function recursively formats validation errors
        const formatErrors = (validationErrors: any[]) => {
          return validationErrors.map(error => {
            if (error.children && error.children.length > 0) {
              // If there are nested errors (like for orderMenus), recurse into them
              return {
                property: error.property,
                children: formatErrors(error.children), // Recursively call formatErrors for children
              };
            }
            // For individual errors, get the constraint messages
            return {
              property: error.property,
              constraints: error.constraints, // Keep the original constraints object for debugging
              messages: error.constraints ? Object.values(error.constraints) : [], // Get just the string messages
            };
          });
        };

        const detailedErrors = formatErrors(errors); // Call the recursive formatter

        // Return a BadRequestException with the detailed, structured errors
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation failed', // A general message for the client
          errors: detailedErrors, // THIS IS THE KEY: The array of structured, detailed errors
        });
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Global unhandled exception/rejection handlers
  process.on('uncaughtException', (err) => {
    console.error('GLOBAL UNCAUGHT EXCEPTION:', err);
    process.exit(1); // Exit to prevent process from becoming zombie
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('GLOBAL UNHANDLED REJECTION at:', promise, 'reason:', reason);
    process.exit(1);
  });
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
    credentials: true,
  })
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();