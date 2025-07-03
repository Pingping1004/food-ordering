import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './libs/http-exception.filter';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { json, Request, Response } from 'express';
import * as cookieParser from 'cookie-parser'
import { ConfigService } from '@nestjs/config';
import * as session from 'express-session'
import * as dotenv from 'dotenv';
dotenv.config()

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  const APP_GLOBAL_SECRET = process.env.APP_GLOBAL_SECRET;
  if (!APP_GLOBAL_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL ERROR: APP_GLOBAL_SECRET is not defined in production environment!');
      process.exit(1);
    } else {
      console.warn('WARNING: APP_GLOBAL_SECRET is not defined. Using a fallback for development only.');
    }
  }
  app.set('secret', APP_GLOBAL_SECRET); 

  app.use(cookieParser());
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieSecure = isProduction;

  app.use((req: Request, res: Response, next: Function) => {
    console.log(`Backend Request Debug: URL: ${req.url}`);
    console.log(`Backend Request Debug: Method: ${req.method}`);
    console.log('Backend Request Debug: Headers[x-csrf-token]:', req.header('x-csrf-token'));
    console.log('Backend Request Debug: Cookies[XSRF-TOKEN]:', req.cookies['XSRF-TOKEN']);
    console.log('Backend Request Debug: req.secret:', req.secret); // <-- ADD THIS LINE
    next();
  });

  const uploadsDir = join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));
  // console.log('Serving uploads from:', uploadsDir);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
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
          errors: detailedErrors,
        });
      },
    }),
  );

  // IMPORTANT for webhooks: Configure body parser to get raw body
  app.use(
    json({
      verify: (req: any, res, buf) => {
        if (req.originalUrl === '/payments/webhooks') {
          req.rawBody = buf;
        }
      },
      limit: '10mb',
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

  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.1.34:3000',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, X-CSRF-Token, Authorization',
    credentials: true,
    exposedHeaders: ['set-cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const port = process.env.PORT || 4000;

  console.log('NESTJS is running on port: ', port);
  await app.listen(port);
}
bootstrap();