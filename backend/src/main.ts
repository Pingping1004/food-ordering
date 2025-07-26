import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from './libs/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { json, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import * as fs from 'fs';

dotenv.config();
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync('../cert/localhost-key.pem'),
    cert: fs.readFileSync('../cert/localhost.pem'),
  };

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { httpsOptions });
  app.setGlobalPrefix('api');
  const logger = new Logger('Bootstrap');

  const allowedOrigins = [
    'https://food-ordering.online',
    'https://api.food-ordering.online',
    'https://food-ordering-mvp.onrender.com',
    'https://localhost:3000',
    process.env.FRONTEND_BASE_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
    process.env.WEBHOOK_ENDPOINT,
  ].map((origin) => origin?.replace(/\/$/, ''));

  app.enableCors({
    origin: (origin, callback) => {
      const cleanOrigin = origin?.replace(/\/$/, '');
      const isAllowed = !origin || allowedOrigins.includes(cleanOrigin);

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`🚫 Blocked by CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'X-CSRF-Token',
      'x-csrf-token',
      'X-Csrf-Token',
      'x-xsrf-token',
      'Authorization',
      'skipauth',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  app.use(
    '/api/webhooks/omise',
    cors({
      origin: true,
      method: ['POST'],
      allowedHeaders: ['Content-Type'],
    }),
  );

  app.use('/api/webhooks/omise', express.raw({ type: 'application/json' }));

  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.use(helmet());
  app.use(compression());

  app.getHttpAdapter().get('/health', (req: Request, res: Response) => {
    res.send('OK');
  });

  function assertEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Environment variable ${name} is missing.`);
    }
    return value;
  }

  const APP_GLOBAL_SECRET = assertEnvVar('APP_GLOBAL_SECRET');
  if (!APP_GLOBAL_SECRET) {
    const errorMessage =
      '❌ CRITICAL: APP_GLOBAL_SECRET is missing. Cannot start the server.';
    logger.error(errorMessage);

    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
  app.set('secret', APP_GLOBAL_SECRET);

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
        // This helper function recursively formats validation errors
        const formatErrors = (validationErrors: any[]) => {
          return validationErrors.map((error) => {
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
              messages: error.constraints
                ? Object.values(error.constraints)
                : [], // Get just the string messages
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
      verify: (req: express.Request, res: express.Response, buf: Buffer) => {
        if (req.originalUrl === process.env.WEBHOOK_PATH) {
          req.rawBody = buf;
        }
      },
      limit: '10mb',
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Global unhandled exception/rejection handlers
  process.on('uncaughtException', (err) => {
    logger.error('GLOBAL UNCAUGHT EXCEPTION:', err);
    process.exit(1); // Exit to prevent process from becoming zombie
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('GLOBAL UNHANDLED REJECTION at:', promise, 'reason:', reason);
    process.exit(1);
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
}
bootstrap();
