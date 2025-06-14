import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,

    exceptionFactory: (errors) => {
      const messages = errors.map(error => {
        // Collect all constraint messages
        return Object.values(error.constraints || {}).join(', ');
      }).filter(Boolean); // Filter out empty strings

      console.error('ValidationPipe exceptionFactory invoked. Errors:', errors);
      console.error('ValidationPipe exceptionFactory messages:', messages);

      // Throw a BadRequestException with the collected messages
      return new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: messages.length > 0 ? messages : ['Invalid input data'],
      });
    },
  }));

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
    credentials: true,
  })
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
